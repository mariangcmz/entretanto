import { aMXN, convertir } from './dinero'
import { fechaLocal } from './fechas'
import type { Datos, Deuda } from './tipos'
import { vigentes } from './cifras'

// Tabla de seguimiento: mes por mes, cuánto se paga a cada deuda y cuánto queda, siguiendo la avalancha
// hasta que no quede nada. Cada deuda se lleva en su moneda; el presupuesto en pesos al tipo de cambio de hoy.

// Las deudas capturadas antes de guardar `actualizadaEl` se dieron de alta este día (salió la Fase 3).
const CAPTURA_INICIAL = '2026-11-11'
const TOPE_MESES = 600 // 50 años: si no termina antes, el pago no alcanza ni para los intereses

/**
 * Lo que se debe hoy: el saldo capturado más lo gastado con la deuda y menos lo pagado desde esa captura.
 * shortcut: un movimiento del mismo día de la captura se cuenta, aunque el saldo capturado ya lo incluyera.
 */
export function saldoActual(t: Deuda, d: Datos): number {
  const desde = t.actualizadaEl ?? CAPTURA_INICIAL
  return vigentes(d.movimientos)
    .filter(m => m.deudaId === t.id && (m.tipo === 'gasto' || m.tipo === 'pago_deuda') && fechaLocal(m.ts) >= desde)
    .reduce((s, m) => s + (m.tipo === 'gasto' ? 1 : -1) * convertir(m.monto, m.moneda, t.moneda, d.config.tipoCambioUSD), t.saldoInicial)
}

export interface PagoMes { id: string; interes: number; pago: number; extra: number; saldo: number } // en la moneda de la deuda
export interface Mes {
  mes: string // 'YYYY-MM'
  pagos: PagoMes[]
  pagoMXN: number
  saldoMXN: number // lo que queda de todas las deudas al cerrar el mes
  liquidadas: string[] // ids que llegan a cero este mes
}
export interface Seguimiento {
  meses: Mes[]
  orden: { id: string; nombre: string; tasaAnual: number; tipo: Deuda['tipo']; moneda: Deuda['moneda']; saldo: number; liquidaEn?: string }[]
  presupuestoMXN: number // lo que se paga al mes a deudas en la proyección
  interesesMXN: number
  terminaEn?: string // el mes en que se acaba la última; sin él, con estos pagos no se termina
}

const sumarMes = (ym: string, n: number) => {
  const f = new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7) - 1 + n, 1))
  return f.toISOString().slice(0, 7)
}

/**
 * Avalancha mes por mes desde el próximo mes. Cada mes cada deuda cobra su interés (tasa anual / 12) y recibe su
 * pago: el mínimo (o el pago fijo del préstamo) hasta liquidarla. Lo que sobra del presupuesto va a la tarjeta con
 * la tasa más alta; al liquidarla, su mínimo se suma al sobrante y pasa a la siguiente. Al terminar un préstamo,
 * su pago fijo se suma al presupuesto. Sin presupuesto capturado, se supone que sigues pagando lo de hoy.
 * Las tarjetas que se pagan completas cada mes no están en la tabla, pero su pago sí sale del presupuesto.
 * shortcut: el mínimo de una tarjeta se queda fijo (en la realidad baja con el saldo), así que la proyección es optimista.
 */
export function proyectar(d: Datos, hoy: string): Seguimiento {
  const tc = d.config.tipoCambioUSD
  const mxn = (t: Deuda, n: number) => aMXN(n, t.moneda, tc)
  const enSuMoneda = (t: Deuda, nMXN: number) => t.moneda === 'USD' ? Math.floor(nMXN / tc) : nMXN

  const completas = d.deudas.filter(t => t.tipo === 'tarjeta' && t.pagoCompleto)
  const fijoCompletas = completas.reduce((s, t) => s + mxn(t, t.pagoSinIntereses ?? t.minimo), 0)
  const deudas = d.deudas
    .filter(t => !t.pagoCompleto)
    .map(t => ({ t, saldo: Math.max(0, saldoActual(t, d)) }))
    .filter(x => x.saldo > 0)
    // Préstamos primero (no reciben extra), luego tarjetas por tasa; el orden de la avalancha es el de la lista.
    .sort((a, b) => Number(a.t.tipo === 'tarjeta') - Number(b.t.tipo === 'tarjeta') || b.t.tasaAnual - a.t.tasaAnual || (a.t.ordenPlan ?? 0) - (b.t.ordenPlan ?? 0))

  const tarjetasHoy = deudas.filter(x => x.t.tipo === 'tarjeta').reduce((s, x) => s + mxn(x.t, Math.min(x.t.minimo, x.saldo)), 0)
  // El presupuesto cubre tarjetas; los préstamos se pagan aparte hasta que terminan y su pago se suma.
  let presupuesto = d.config.presupuestoDeuda !== undefined ? d.config.presupuestoDeuda : tarjetasHoy + fijoCompletas
  const prestamosHoy = deudas.filter(x => x.t.tipo === 'prestamo').reduce((s, x) => s + mxn(x.t, Math.min(x.t.minimo, x.saldo)), 0)
  const presupuestoMXN = presupuesto + prestamosHoy

  const meses: Mes[] = []
  const liquidaEn = new Map<string, string>()
  let interesesMXN = 0
  let mes = hoy.slice(0, 7)
  for (let i = 0; i < TOPE_MESES && deudas.some(x => x.saldo > 0); i++) {
    mes = sumarMes(mes, 1)
    const pagos: PagoMes[] = []
    let liberado = 0 // pagos fijos de préstamos que terminan este mes: entran al presupuesto desde el siguiente
    let resto = 0 // lo que no se usó del último pago de un préstamo: va a las tarjetas este mismo mes
    for (const x of deudas) {
      if (x.saldo <= 0) continue
      const interes = Math.round(x.saldo * x.t.tasaAnual / 1200)
      x.saldo += interes
      interesesMXN += mxn(x.t, interes)
      const pago = Math.min(x.t.minimo, x.saldo)
      x.saldo -= pago
      pagos.push({ id: x.t.id, interes, pago, extra: 0, saldo: x.saldo })
      if (x.t.tipo === 'prestamo' && x.saldo === 0) { liberado += mxn(x.t, x.t.minimo); resto += mxn(x.t, x.t.minimo - pago) }
    }
    // El sobrante del presupuesto, después de los mínimos de las tarjetas, va por avalancha.
    const minimos = pagos.reduce((s, p) => { const x = deudas.find(y => y.t.id === p.id)!; return x.t.tipo === 'tarjeta' ? s + mxn(x.t, p.pago) : s }, 0)
    let sobra = Math.max(0, presupuesto - fijoCompletas - minimos) + resto
    for (const x of deudas) {
      if (sobra <= 0) break
      if (x.t.tipo !== 'tarjeta' || x.saldo <= 0) continue
      const da = Math.min(x.saldo, enSuMoneda(x.t, sobra))
      if (da <= 0) continue
      x.saldo -= da
      sobra -= mxn(x.t, da)
      const p = pagos.find(y => y.id === x.t.id)!
      p.pago += da; p.extra = da; p.saldo = x.saldo
    }
    presupuesto += liberado

    const liquidadas = pagos.filter(p => p.saldo === 0).map(p => p.id)
    for (const id of liquidadas) liquidaEn.set(id, mes)
    meses.push({
      mes, pagos, liquidadas,
      pagoMXN: pagos.reduce((s, p) => s + mxn(deudas.find(y => y.t.id === p.id)!.t, p.pago), 0),
      saldoMXN: deudas.reduce((s, x) => s + mxn(x.t, x.saldo), 0),
    })
  }

  const terminado = !deudas.some(x => x.saldo > 0)
  return {
    meses,
    orden: deudas.map(x => ({
      id: x.t.id, nombre: x.t.nombre, tasaAnual: x.t.tasaAnual, tipo: x.t.tipo, moneda: x.t.moneda,
      saldo: Math.max(0, saldoActual(x.t, d)), liquidaEn: liquidaEn.get(x.t.id),
    })),
    presupuestoMXN,
    interesesMXN,
    terminaEn: terminado ? (meses.at(-1)?.mes ?? hoy.slice(0, 7)) : undefined,
  }
}
