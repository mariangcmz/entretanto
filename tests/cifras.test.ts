import { describe, expect, it } from 'vitest'
import { calcularCifras, proximoCobro } from '../src/engine/cifras'
import { pesos } from '../src/engine/dinero'
import { pagoDelCorte, proximaFechaIngreso, ultimoCorte } from '../src/engine/fechas'
import type { Datos, Movimiento } from '../src/engine/tipos'

const HOY = '2026-11-10'

function base(): Datos {
  return {
    config: { tipoCambioUSD: 18, fechaProximoIngreso: '2026-11-15' },
    cuentas: [{ id: 'deb', nombre: 'Débito', tipo: 'debito', moneda: 'MXN', saldoInicial: pesos(3000) }],
    deudas: [],
    compromisos: [{ id: 'inet', nombre: 'Internet', monto: pesos(850), moneda: 'MXN', fechaVence: '2026-11-12', estado: 'pendiente' }],
    movimientos: [],
  }
}

let n = 0
const mov = (m: Partial<Movimiento>): Movimiento => ({
  id: `m${++n}`, ts: n, tipo: 'gasto', monto: 0, moneda: 'MXN', cuentaId: 'deb',
  quien: 'yo', afectaMisCifras: true, nota: '', claveUnica: `k${n}`, ...m,
})

describe('pruebas obligatorias', () => {
  it('con $3,000 y $850 apartados para internet, me queda $2,150', () => {
    const c = calcularCifras(base(), HOY)
    expect(c.tengoHoy).toBe(pesos(3000))
    expect(c.tieneDueno).toBe(pesos(850))
    expect(c.meQueda).toBe(pesos(2150))
  })

  it('pagar el internet baja el saldo a $2,150, cubre el compromiso y me queda sigue en $2,150', () => {
    const d = base()
    d.movimientos.push(mov({ tipo: 'pago_deuda', monto: pesos(850), compromisoId: 'inet' }))
    const c = calcularCifras(d, HOY)
    expect(c.tengoHoy).toBe(pesos(2150))
    expect(c.tieneDueno).toBe(0)
    expect(c.meQueda).toBe(pesos(2150))
  })

  it('un movimiento con afectaMisCifras = false no cambia ninguna cifra', () => {
    const antes = calcularCifras(base(), HOY)
    const d = base()
    d.movimientos.push(mov({ monto: pesos(500), quien: 'pareja', afectaMisCifras: false }))
    d.movimientos.push(mov({ tipo: 'pago_deuda', monto: pesos(850), compromisoId: 'inet', afectaMisCifras: false }))
    expect(calcularCifras(d, HOY)).toEqual(antes)
  })

  it('corregir con un reverso deshace el efecto y conserva el original', () => {
    const d = base()
    const gasto = mov({ monto: pesos(300) })
    d.movimientos.push(gasto, mov({ tipo: 'reverso', monto: pesos(300), reversaDe: gasto.id }))
    expect(calcularCifras(d, HOY).meQueda).toBe(pesos(2150))
    expect(d.movimientos).toContain(gasto)
  })
})

describe('reglas de las cifras', () => {
  it('convierte USD al tipo de cambio', () => {
    const d = base()
    d.cuentas.push({ id: 'usd', nombre: 'Dólares', tipo: 'efectivo', moneda: 'USD', saldoInicial: pesos(10) })
    expect(calcularCifras(d, HOY).tengoHoy).toBe(pesos(3180))
  })

  it('aparta pagos fijos hasta 7 días después del próximo ingreso y lo vencido; lo más lejano no', () => {
    const d = base() // cobro el 15: entra hasta el 22
    d.compromisos.push(
      { id: 'luz', nombre: 'Luz', monto: pesos(400), moneda: 'MXN', fechaVence: '2026-11-23', estado: 'pendiente' },
      { id: 'nat', nombre: 'Natura', monto: pesos(50), moneda: 'MXN', fechaVence: '2026-11-22', estado: 'pendiente' },
      { id: 'agua', nombre: 'Agua', monto: pesos(100), moneda: 'MXN', fechaVence: '2026-11-01', estado: 'pendiente' },
      { id: 'tel', nombre: 'Teléfono', monto: pesos(200), moneda: 'MXN', fechaVence: '2026-11-15', estado: 'pendiente' },
    )
    expect(calcularCifras(d, HOY).tieneDueno).toBe(pesos(1200))
  })

  it('el próximo cobro es el ingreso más cercano: el mensual por su día, el de una vez por su fecha', () => {
    const d = base()
    d.ingresos = [
      { id: 'pen', nombre: 'Pensión', moneda: 'MXN', monto: pesos(3575), diaCobro: 3 }, // ya pasó el 3: cae el 3 de dic
      { id: 'nat', nombre: 'Natura', moneda: 'MXN', fecha: '2026-11-20' },
      { id: 'vie', nombre: 'Natura vieja', moneda: 'MXN', fecha: '2026-11-01' }, // ya pasó: no cuenta
    ]
    expect(proximoCobro(d, HOY)).toEqual({ fecha: '2026-11-20', nombre: 'Natura', montoMXN: undefined })
    d.ingresos.pop(); d.ingresos.pop()
    expect(proximoCobro(d, HOY)).toEqual({ fecha: '2026-12-03', nombre: 'Pensión', montoMXN: pesos(3575) })
    // con ingresos, la fecha suelta de la config ya no manda: aparta pagos fijos hasta el 10 de dic
    d.compromisos.push({ id: 'luz', nombre: 'Luz', monto: pesos(400), moneda: 'MXN', fechaVence: '2026-12-08', estado: 'pendiente' })
    expect(calcularCifras(d, HOY).tieneDueno).toBe(pesos(850 + 400))
  })

  it('cada ingreso calcula su siguiente cobro según su frecuencia', () => {
    expect(proximaFechaIngreso({ frecuencia: 'mensual', diaCobro: 3 }, HOY)).toBe('2026-12-03')
    expect(proximaFechaIngreso({ frecuencia: 'quincenal' }, HOY)).toBe('2026-11-15') // 15 y último por omisión
    expect(proximaFechaIngreso({ frecuencia: 'quincenal' }, '2026-11-16')).toBe('2026-11-30')
    expect(proximaFechaIngreso({ frecuencia: 'quincenal', diaCobro: 1, diaCobro2: 16 }, '2026-11-17')).toBe('2026-12-01')
    expect(proximaFechaIngreso({ frecuencia: 'quincenal' }, '2027-02-16')).toBe('2027-02-28')
    expect(proximaFechaIngreso({ frecuencia: 'semanal', fecha: '2026-11-06' }, HOY)).toBe('2026-11-13')
    expect(proximaFechaIngreso({ frecuencia: 'semanal', fecha: '2026-11-03' }, HOY)).toBe('2026-11-10')
    expect(proximaFechaIngreso({ frecuencia: 'semanal', fecha: '2026-11-20' }, HOY)).toBe('2026-11-20')
    expect(proximaFechaIngreso({ frecuencia: 'una_vez', fecha: '2026-11-01' }, HOY)).toBeUndefined()
    expect(proximaFechaIngreso({ diaCobro: 3 }, HOY)).toBe('2026-12-03') // los guardados antes de la frecuencia
  })

  it('sin fecha de próximo ingreso la cifra no es definitiva', () => {
    const d = base()
    delete d.config.fechaProximoIngreso
    expect(calcularCifras(d, HOY).definitiva).toBe(false)
  })

  it('una obligación ligada a una deuda cuenta una sola vez por fecha', () => {
    const d = base()
    const pres = { nombre: 'Préstamo', monto: pesos(500), moneda: 'MXN' as const, fechaVence: '2026-11-14', deudaId: 'pres', estado: 'pendiente' as const }
    d.compromisos.push({ id: 'c1', ...pres }, { id: 'c2', ...pres })
    expect(calcularCifras(d, HOY).tieneDueno).toBe(pesos(1350))
  })

  it('si me queda negativo, dice cuánto falta', () => {
    const d = base()
    d.movimientos.push(mov({ monto: pesos(2500) }))
    expect(calcularCifras(d, HOY).falta).toBe(pesos(350))
  })

  it('cargos ajenos que sí me afectan mueven el saldo y se suman aparte', () => {
    const d = base()
    d.movimientos.push(mov({ monto: pesos(200), quien: 'pareja' }))
    const c = calcularCifras(d, HOY)
    expect(c.tengoHoy).toBe(pesos(2800))
    expect(c.cargosAjenos).toBe(pesos(200))
  })
})

describe('tarjetas con su propio corte y fecha límite', () => {
  const tarjeta = (id: string, diaCorte: number, diaPago: number) => ({
    id, nombre: id, tipo: 'tarjeta' as const, moneda: 'MXN' as const, saldoInicial: pesos(5000), tasaAnual: 60,
    minimo: pesos(300), pagoSinIntereses: pesos(1200), diaCorte, diaPago,
  })
  const ts = (iso: string) => new Date(`${iso}T12:00:00`).getTime()

  it('calcula corte y pago de cada tarjeta, incluso con meses cortos', () => {
    expect(ultimoCorte('2026-11-10', 3)).toBe('2026-11-03')
    expect(ultimoCorte('2026-11-10', 28)).toBe('2026-10-28')
    expect(ultimoCorte('2026-11-10', 31)).toBe('2026-10-31')
    expect(ultimoCorte('2027-03-01', 30)).toBe('2027-02-28')
    expect(ultimoCorte('2027-01-05', 20)).toBe('2026-12-20')
    expect(pagoDelCorte('2026-11-03', 23)).toBe('2026-11-23')
    expect(pagoDelCorte('2026-10-28', 18)).toBe('2026-11-18')
    expect(pagoDelCorte('2027-01-31', 30)).toBe('2027-02-28')
  })

  it('cada tarjeta aparta el pago de su último corte aunque venza después del próximo ingreso', () => {
    const d = base()
    d.deudas.push(
      tarjeta('A', 3, 13), // corte 3-nov, paga 13-nov
      tarjeta('B', 28, 18), // corte 28-oct, paga 18-nov: después del ingreso, pero ya se debe
      tarjeta('C', 20, 8), // corte 20-oct, pagaba 8-nov: vencida
    )
    const c = calcularCifras(d, HOY)
    expect(c.desglose.apartados.map(a => [a.nombre, a.fechaVence])).toEqual([
      ['Internet', '2026-11-12'], ['A', '2026-11-13'], ['B', '2026-11-18'], ['C', '2026-11-08'],
    ])
    expect(c.tieneDueno).toBe(pesos(850 + 300 * 3))
    expect(c.meQuedaSiPagoSinIntereses).toBe(c.meQueda - pesos(900 * 3))
  })

  it('próximos pagos: cada tarjeta dice si toca pagar, ya cubrió, espera su corte o ya cortó y hay que actualizarla', () => {
    const d = base()
    d.deudas.push(
      tarjeta('pagar', 3, 13),
      { ...tarjeta('cubierta', 3, 13), minimo: 0 }, // el mínimo ya se pagó
      { ...tarjeta('esperando', 20, 8), minimo: 0, pagoSinIntereses: 0 }, // pagada y vencida: sigue el corte del 20
      { ...tarjeta('vieja', 3, 13), actualizadaEl: '2026-11-01' }, // cortó el 3, se capturó el 1
    )
    const por = Object.fromEntries(calcularCifras(d, HOY).pagos.map(p => [p.nombre, [p.estado, p.fechaVence, p.montoMXN, p.corte]]))
    expect(por).toEqual({
      pagar: ['pagar', '2026-11-13', pesos(300), undefined],
      cubierta: ['cubierto', '2026-11-13', pesos(1200), undefined],
      esperando: ['por_cortar', '2026-12-08', 0, '2026-11-20'],
      vieja: ['actualizar', '2026-11-13', pesos(300), '2026-11-03'],
    })
  })

  it('un préstamo aparta siempre su siguiente pago fijo; lo pagado desde el anterior lo descuenta', () => {
    const d = base()
    d.deudas.push({ id: 'bravo', nombre: 'Bravo', tipo: 'prestamo', moneda: 'MXN', saldoInicial: pesos(50000), tasaAnual: 46, minimo: pesos(6316), pagoSinIntereses: pesos(6316), diaPago: 3 })
    const c = calcularCifras(d, HOY)
    expect(c.desglose.apartados.at(-1)).toMatchObject({ nombre: 'Bravo', fechaVence: '2026-12-03', montoMXN: pesos(6316), deudaId: 'bravo' })
    d.movimientos.push(mov({ tipo: 'pago_deuda', deudaId: 'bravo', monto: pesos(6316), ts: ts('2026-11-03') })) // el de noviembre: no cuenta
    d.movimientos.push(mov({ tipo: 'pago_deuda', deudaId: 'bravo', monto: pesos(1000), ts: ts('2026-11-09') }))
    expect(calcularCifras(d, HOY).tieneDueno).toBe(pesos(850 + 5316))
  })

  it('avalancha: lo que sobra del presupuesto va a la tasa más alta; la que se paga completa aparta su pago sin intereses', () => {
    const d = base()
    d.config.presupuestoDeuda = pesos(2000)
    d.deudas.push(
      tarjeta('A', 3, 13), // 60%
      { ...tarjeta('B', 3, 13), tasaAnual: 90 },
      { ...tarjeta('C', 3, 13), pagoSinIntereses: pesos(500), pagoCompleto: true },
    )
    const c = calcularCifras(d, HOY)
    // 2000 - (300 + 300 + 500) = 900 de extra, todo a B
    const por = Object.fromEntries(c.desglose.apartados.map(a => [a.nombre, [a.montoMXN, a.avalanchaMXN ?? 0]]))
    expect(por).toMatchObject({ A: [pesos(300), 0], B: [pesos(1200), pesos(900)], C: [pesos(500), 0] })
    expect(c.tieneDueno).toBe(pesos(850 + 2000))
  })

  it('avalancha: al llegar al saldo de una deuda, el resto pasa a la siguiente; USD se convierte', () => {
    const d = base()
    d.config.presupuestoDeuda = pesos(6000)
    d.deudas.push(
      { ...tarjeta('A', 3, 13), tasaAnual: 90, saldoInicial: pesos(1000) }, // cabe 700 encima del mínimo
      { ...tarjeta('U', 3, 13), moneda: 'USD', tasaAnual: 30, minimo: pesos(20), pagoSinIntereses: pesos(100), saldoInicial: pesos(500) },
    )
    const c = calcularCifras(d, HOY)
    // 6000 - 300 - 20×18 = 5340; A recibe 700; U recibe 4640 MXN = 257.77 USD, se redondea hacia abajo
    const u = c.desglose.apartados.find(a => a.nombre === 'U')!
    expect(c.desglose.apartados.find(a => a.nombre === 'A')!.montoMXN).toBe(pesos(1000))
    expect(u.montoMXN).toBe(Math.round((pesos(20) + 25777) * 18))
  })

  it('sin presupuesto para deudas, la avalancha no pone extra', () => {
    const d = base()
    d.deudas.push({ ...tarjeta('A', 3, 13), tasaAnual: 90 })
    expect(calcularCifras(d, HOY).tieneDueno).toBe(pesos(850 + 300))
  })

  it('un pago hecho después del corte descuenta la reserva; uno anterior no', () => {
    const d = base()
    d.deudas.push(tarjeta('A', 3, 13))
    d.movimientos.push(mov({ tipo: 'pago_deuda', deudaId: 'A', monto: pesos(100), ts: ts('2026-10-30') }))
    expect(calcularCifras(d, HOY).tieneDueno).toBe(pesos(850 + 300))
    d.movimientos.push(mov({ tipo: 'pago_deuda', deudaId: 'A', monto: pesos(300), ts: ts('2026-11-05') }))
    const c = calcularCifras(d, HOY)
    expect(c.tieneDueno).toBe(pesos(850))
    expect(c.meQuedaSiPagoSinIntereses).toBe(c.meQueda - pesos(900))
  })

  it('un gasto con tarjeta no baja lo que tengo y se aparta completo desde ya', () => {
    const d = base()
    d.deudas.push(tarjeta('B', 28, 18)) // su estado de cuenta (300) se aparta aparte de los gastos nuevos
    d.movimientos.push(mov({ cuentaId: undefined, deudaId: 'B', monto: pesos(250), ts: ts('2026-11-02') }))
    d.movimientos.push(mov({ cuentaId: undefined, deudaId: 'B', monto: pesos(999), ts: ts('2026-10-20') })) // antes del corte: ya va en el estado de cuenta
    const c = calcularCifras(d, HOY)
    expect(c.tengoHoy).toBe(pesos(3000))
    expect(c.tieneDueno).toBe(pesos(850 + 300 + 250))
    expect(c.desglose.apartados.at(-1)).toEqual({ nombre: 'B: gastos desde el corte', fechaVence: '2026-12-18', montoMXN: pesos(250), extraSinInteresesMXN: 0 })
  })

  it('lo pagado de más sobre el estado de cuenta cubre los gastos nuevos; USD se convierte', () => {
    const d = base()
    d.deudas.push({ ...tarjeta('A', 3, 13), moneda: 'USD', minimo: pesos(30), pagoSinIntereses: pesos(100) })
    d.movimientos.push(mov({ cuentaId: undefined, deudaId: 'A', moneda: 'USD', monto: pesos(50), ts: ts('2026-11-05') }))
    expect(calcularCifras(d, HOY).tieneDueno).toBe(pesos(850 + 30 * 18 + 50 * 18))
    d.movimientos.push(mov({ tipo: 'pago_deuda', cuentaId: undefined, deudaId: 'A', moneda: 'USD', monto: pesos(120), ts: ts('2026-11-06') }))
    expect(calcularCifras(d, HOY).tieneDueno).toBe(pesos(850 + 30 * 18))
  })
})
