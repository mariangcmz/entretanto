import { describe, expect, it } from 'vitest'
import { pesos } from '../src/engine/dinero'
import { proyectar, saldoActual } from '../src/engine/seguimiento'
import { simular } from '../src/engine/simulador'
import type { Datos, Deuda, Movimiento } from '../src/engine/tipos'

const HOY = '2026-11-10'
const ts = (iso: string) => Date.parse(`${iso}T12:00:00`)

const tarjeta = (id: string, x: Partial<Deuda> = {}): Deuda => ({
  id, nombre: id, tipo: 'tarjeta', moneda: 'MXN', saldoInicial: pesos(1000), tasaAnual: 12, minimo: pesos(300),
  diaCorte: 3, diaPago: 13, actualizadaEl: '2026-11-04', ...x,
})

const datos = (deudas: Deuda[], presupuestoDeuda?: number): Datos => ({
  config: { tipoCambioUSD: 18, fechaProximoIngreso: '2026-11-15', presupuestoDeuda },
  cuentas: [{ id: 'deb', nombre: 'Débito', tipo: 'debito', moneda: 'MXN', saldoInicial: pesos(3000) }],
  deudas, compromisos: [], movimientos: [],
})

let n = 0
const mov = (m: Partial<Movimiento>): Movimiento => ({
  id: `m${++n}`, ts: ts(HOY), tipo: 'pago_deuda', monto: 0, moneda: 'MXN', cuentaId: 'deb',
  quien: 'yo', afectaMisCifras: true, nota: '', claveUnica: `k${n}`, ...m,
})

// Los cálculos de referencia se hicieron a mano, mes por mes: interés = saldo × tasa / 12, redondeado al centavo.
describe('tabla de seguimiento (cálculo de referencia)', () => {
  it('una tarjeta: $1,000 al 12% pagando $300 se liquida en 4 meses con $22.48 de intereses', () => {
    const s = proyectar(datos([tarjeta('A')]), HOY)
    expect(s.meses.map(m => [m.mes, m.pagos[0]!.interes, m.pagos[0]!.pago, m.saldoMXN])).toEqual([
      ['2026-12', 1000, 30000, 71000],
      ['2027-01', 710, 30000, 41710],
      ['2027-02', 417, 30000, 12127],
      ['2027-03', 121, 12248, 0],
    ])
    expect(s.interesesMXN).toBe(2248)
    expect(s.terminaEn).toBe('2027-03')
    expect(s.orden[0]!.liquidaEn).toBe('2027-03')
  })

  it('avalancha: el sobrante va a la tasa más alta y, al liquidarla, todo pasa a la siguiente', () => {
    const s = proyectar(datos([
      tarjeta('B', { saldoInicial: pesos(2000), tasaAnual: 24, minimo: pesos(200) }),
      tarjeta('A', { saldoInicial: pesos(500), tasaAnual: 60, minimo: pesos(100) }),
    ], pesos(1000)), HOY)
    expect(s.orden.map(o => o.id)).toEqual(['A', 'B'])
    const [m1, m2, m3] = s.meses
    // Mes 1: A 500+25 → paga 100 + 425 extra; B 2000+40 → paga 200 + 275 extra
    expect(m1!.pagos).toEqual([
      { id: 'A', interes: 2500, pago: 52500, extra: 42500, saldo: 0 },
      { id: 'B', interes: 4000, pago: 47500, extra: 27500, saldo: 156500 },
    ])
    expect(m1!.liquidadas).toEqual(['A'])
    // Mes 2: los 1,000 completos a B
    expect(m2!.pagos).toEqual([{ id: 'B', interes: 3130, pago: pesos(1000), extra: pesos(800), saldo: 59630 }])
    // Mes 3: B 596.30 + 11.93 de interés
    expect(m3!.pagos).toEqual([{ id: 'B', interes: 1193, pago: 60823, extra: 40823, saldo: 0 }])
    expect(s.interesesMXN).toBe(2500 + 4000 + 3130 + 1193)
    expect(s.terminaEn).toBe('2027-02')
  })

  it('al terminar un préstamo, su pago fijo se suma a lo que va a las tarjetas', () => {
    const s = proyectar(datos([
      { id: 'L', nombre: 'Préstamo', tipo: 'prestamo', moneda: 'MXN', saldoInicial: pesos(1000), tasaAnual: 0, minimo: pesos(500), diaPago: 3, actualizadaEl: '2026-11-04' },
      tarjeta('C', { saldoInicial: pesos(3000), tasaAnual: 0, minimo: pesos(100) }),
    ], pesos(300)), HOY)
    expect(s.presupuestoMXN).toBe(pesos(800))
    expect(s.meses.map(m => m.pagoMXN)).toEqual([pesos(800), pesos(800), pesos(800), pesos(800), pesos(800)])
    expect(s.meses.map(m => m.saldoMXN)).toEqual([pesos(3200), pesos(2400), pesos(1600), pesos(800), 0])
    expect(s.orden.map(o => o.liquidaEn)).toEqual(['2027-01', '2027-04'])
  })

  it('lo que sobra del último pago de un préstamo va a las tarjetas ese mismo mes', () => {
    const s = proyectar(datos([
      { id: 'L', nombre: 'Préstamo', tipo: 'prestamo', moneda: 'MXN', saldoInicial: pesos(700), tasaAnual: 0, minimo: pesos(500), diaPago: 3, actualizadaEl: '2026-11-04' },
      tarjeta('C', { saldoInicial: pesos(3000), tasaAnual: 0, minimo: pesos(100) }),
    ], pesos(300)), HOY)
    // Mes 2: el préstamo solo pide 200; los otros 300 van a C
    expect(s.meses[1]!.pagos).toEqual([
      { id: 'L', interes: 0, pago: pesos(200), extra: 0, saldo: 0 },
      { id: 'C', interes: 0, pago: pesos(600), extra: pesos(500), saldo: pesos(2100) },
    ])
    expect(s.meses.map(m => m.pagoMXN).slice(0, 3)).toEqual([pesos(800), pesos(800), pesos(800)])
  })

  it('sin presupuesto, supone que sigues pagando lo mismo: el mínimo liberado pasa a la siguiente', () => {
    const s = proyectar(datos([
      tarjeta('A', { saldoInicial: pesos(200), tasaAnual: 0, minimo: pesos(200) }),
      tarjeta('B', { saldoInicial: pesos(600), tasaAnual: 0, minimo: pesos(100) }),
    ]), HOY)
    expect(s.meses.map(m => m.pagoMXN)).toEqual([pesos(300), pesos(300), pesos(200)])
  })

  it('si el pago no alcanza ni para los intereses, la proyección dice que no se termina', () => {
    const s = proyectar(datos([tarjeta('A', { tasaAnual: 60, minimo: pesos(40) })]), HOY)
    expect(s.terminaEn).toBeUndefined()
  })

  it('pagar una deuda baja su saldo y la tabla se actualiza; los gastos con la tarjeta lo suben', () => {
    const d = datos([tarjeta('A')])
    d.movimientos.push(mov({ deudaId: 'A', monto: pesos(400) }))
    d.movimientos.push(mov({ tipo: 'gasto', deudaId: 'A', cuentaId: undefined, monto: pesos(100) }))
    d.movimientos.push(mov({ deudaId: 'A', monto: pesos(999), ts: ts('2026-11-01') })) // antes de capturar el saldo: ya incluido
    expect(saldoActual(d.deudas[0]!, d)).toBe(pesos(700))
    expect(proyectar(d, HOY).meses[0]!.saldoMXN).toBe(pesos(700 + 7 - 300))
  })

  it('las tarjetas que se pagan completas no entran en la tabla pero sí usan presupuesto', () => {
    const s = proyectar(datos([
      tarjeta('A', { tasaAnual: 0 }),
      tarjeta('Z', { pagoCompleto: true, pagoSinIntereses: pesos(250) }),
    ], pesos(800)), HOY)
    expect(s.orden.map(o => o.id)).toEqual(['A'])
    expect(s.meses[0]!.pagos[0]!.pago).toBe(pesos(550))
  })
})

describe('simulador', () => {
  it('una simulación deja saldos y compromisos intactos', () => {
    const d = datos([tarjeta('A')])
    d.compromisos.push({ id: 'inet', nombre: 'Internet', monto: pesos(850), moneda: 'MXN', fechaVence: '2026-11-12', estado: 'pendiente' })
    const copia = structuredClone(d)
    simular(d, HOY, { monto: pesos(1000), moneda: 'MXN', origen: 'A', meses: 3 })
    simular(d, HOY, { monto: pesos(1000), moneda: 'MXN', origen: 'deb', meses: 1 })
    expect(d).toEqual(copia)
  })

  it('de contado con débito, me queda baja todo el monto ese día', () => {
    const s = simular(datos([]), HOY, { monto: pesos(1000), moneda: 'MXN', origen: 'deb', meses: 6 })
    expect(s.meQuedaAntes - s.meQuedaDespues).toBe(pesos(1000))
    expect(s.cuotas).toEqual([{ fecha: HOY, monto: pesos(1000), moneda: 'MXN' }])
  })

  it('a meses con tarjeta: solo aparta la primera cuota y cada una cae en su fecha límite', () => {
    const s = simular(datos([tarjeta('A')]), HOY, { monto: pesos(1000), moneda: 'MXN', origen: 'A', meses: 3 })
    expect(s.cuotas).toEqual([
      { fecha: '2026-12-13', monto: 33334, moneda: 'MXN' },
      { fecha: '2027-01-13', monto: 33333, moneda: 'MXN' },
      { fecha: '2027-02-13', monto: 33333, moneda: 'MXN' },
    ])
    expect(s.meQuedaAntes - s.meQuedaDespues).toBe(33334)
  })

  it('una compra en pesos con tarjeta en dólares se calcula en dólares', () => {
    const s = simular(datos([tarjeta('U', { moneda: 'USD' })]), HOY, { monto: pesos(1800), moneda: 'MXN', origen: 'U', meses: 1 })
    expect(s.cuotas[0]).toMatchObject({ monto: pesos(100), moneda: 'USD' })
    expect(s.meQuedaAntes - s.meQuedaDespues).toBe(pesos(1800))
  })
})
