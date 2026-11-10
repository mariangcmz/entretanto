import { aMXN } from './dinero'
import { fechaLocal, pagoDelCorte, ultimoCorte } from './fechas'
import type { Datos, Movimiento } from './tipos'

export interface LineaCuenta { nombre: string; saldoMXN: number }
export interface LineaApartado { nombre: string; fechaVence: string; montoMXN: number; extraSinInteresesMXN: number }

export interface Cifras {
  tengoHoy: number
  tieneDueno: number
  meQueda: number
  falta: number // cuánto falta si meQueda es negativa
  meQuedaSiPagoSinIntereses: number // si las tarjetas sin pago elegido se pagan completas
  cargosAjenos: number // gastos de pareja/otros que sí mueven mis cifras
  definitiva: boolean // false si falta la fecha del próximo ingreso
  desglose: { cuentas: LineaCuenta[]; apartados: LineaApartado[] }
}

const delta = (m: Movimiento) =>
  m.tipo === 'ingreso' || m.tipo === 'ajuste' ? m.monto : -m.monto

/** Movimientos que cuentan: afectan mis cifras, no son reversos y nadie los reversó. */
export function vigentes(movs: Movimiento[]): Movimiento[] {
  const revertidos = new Set(movs.filter(m => m.tipo === 'reverso').map(m => m.reversaDe))
  return movs.filter(m => m.afectaMisCifras && m.tipo !== 'reverso' && !revertidos.has(m.id))
}

export function calcularCifras(d: Datos, hoy: string): Cifras {
  const tc = d.config.tipoCambioUSD
  const movs = vigentes(d.movimientos)

  // shortcut: asume que el movimiento va en la moneda de su cuenta; convertir si algún día se mezclan.
  const cuentas = d.cuentas.map(c => {
    const saldo = movs.filter(m => m.cuentaId === c.id).reduce((s, m) => s + delta(m), c.saldoInicial)
    return { nombre: c.nombre, saldoMXN: aMXN(saldo, c.moneda, tc) }
  })

  const cubiertos = new Set(movs.filter(m => m.tipo === 'pago_deuda').map(m => m.compromisoId))
  const corte = d.config.fechaProximoIngreso ?? hoy
  const vistos = new Set<string>()
  const apartados: LineaApartado[] = []
  for (const c of d.compromisos) {
    // Cada obligación una sola vez: una deuda aparta una vez por fecha de vencimiento.
    const clave = c.deudaId ? `${c.deudaId}|${c.fechaVence}` : c.id
    if (c.estado === 'cubierto' || cubiertos.has(c.id) || c.fechaVence > corte || vistos.has(clave)) continue
    vistos.add(clave)
    apartados.push({ nombre: c.nombre, fechaVence: c.fechaVence, montoMXN: aMXN(c.monto, c.moneda, tc), extraSinInteresesMXN: 0 })
  }

  // Cada tarjeta aparta solita el pago de su último corte, con su propio día de corte y de pago.
  // Reserva el mínimo; lo que ya se pagó desde ese corte se descuenta.
  for (const t of d.deudas) {
    if (t.tipo !== 'tarjeta' || t.diaCorte === undefined || t.diaPago === undefined) continue
    const desde = ultimoCorte(hoy, t.diaCorte)
    const vence = pagoDelCorte(desde, t.diaPago)
    if (vence > corte) continue
    const pagado = movs
      .filter(m => m.tipo === 'pago_deuda' && m.deudaId === t.id && fechaLocal(m.ts) >= desde)
      .reduce((s, m) => s + m.monto, 0)
    const reserva = Math.max(0, t.minimo - pagado)
    const extra = Math.max(0, (t.pagoSinIntereses ?? 0) - pagado - reserva)
    if (reserva + extra === 0) continue
    apartados.push({ nombre: t.nombre, fechaVence: vence, montoMXN: aMXN(reserva, t.moneda, tc), extraSinInteresesMXN: aMXN(extra, t.moneda, tc) })
  }

  const tengoHoy = cuentas.reduce((s, c) => s + c.saldoMXN, 0)
  const tieneDueno = apartados.reduce((s, a) => s + a.montoMXN, 0)
  const meQueda = tengoHoy - tieneDueno
  const cargosAjenos = movs
    .filter(m => m.quien !== 'yo' && m.tipo === 'gasto')
    .reduce((s, m) => s + aMXN(m.monto, m.moneda, tc), 0)

  return {
    tengoHoy,
    tieneDueno,
    meQueda,
    falta: Math.max(0, -meQueda),
    meQuedaSiPagoSinIntereses: meQueda - apartados.reduce((s, a) => s + a.extraSinInteresesMXN, 0),
    cargosAjenos,
    definitiva: d.config.fechaProximoIngreso !== undefined,
    desglose: { cuentas, apartados },
  }
}
