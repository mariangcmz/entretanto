import { aMXN } from './dinero'
import { planAvalancha } from './deudas'
import { fechaLocal, mesAntes, pagoDelCorte, proximaFechaIngreso, proximoPago, sumarDias, ultimoCorte } from './fechas'
import type { Datos, Movimiento } from './tipos'

export interface LineaCuenta { nombre: string; saldoMXN: number }
export interface LineaApartado {
  nombre: string
  fechaVence: string
  montoMXN: number
  extraSinInteresesMXN: number
  deudaId?: string // pago del estado de cuenta de esta tarjeta
  avalanchaMXN?: number // parte del monto que la avalancha pone encima del mínimo
}

/** Cómo va cada deuda en su siguiente fecha límite, para la lista de Próximos pagos. */
export interface LineaPago {
  deudaId: string
  nombre: string
  fechaVence: string
  estado: 'pagar' | 'cubierto' | 'por_cortar' | 'actualizar'
  montoMXN: number // pagar/actualizar: lo apartado; cubierto: lo que falta para no generar intereses
  avalanchaMXN?: number
  corte?: string // por_cortar: cuándo corta; actualizar: cuándo cortó
}

// Las deudas capturadas antes de guardar `actualizadaEl` se dieron de alta este día (salió la Fase 3).
const CAPTURA_INICIAL = '2026-11-11'

export interface Cifras {
  tengoHoy: number
  tieneDueno: number
  meQueda: number
  falta: number // cuánto falta si meQueda es negativa
  meQuedaSiPagoSinIntereses: number // si las tarjetas sin pago elegido se pagan completas
  cargosAjenos: number // gastos de pareja/otros que sí mueven mis cifras
  definitiva: boolean // false si falta la fecha del próximo ingreso
  proximoCobro?: { fecha: string; nombre?: string; montoMXN?: number }
  desglose: { cuentas: LineaCuenta[]; apartados: LineaApartado[] }
  pagos: LineaPago[]
}

const delta = (m: Movimiento) =>
  m.tipo === 'ingreso' || m.tipo === 'ajuste' ? m.monto : -m.monto

/** Movimientos que cuentan: afectan mis cifras, no son reversos y nadie los reversó. */
export function vigentes(movs: Movimiento[]): Movimiento[] {
  const revertidos = new Set(movs.filter(m => m.tipo === 'reverso').map(m => m.reversaDe))
  return movs.filter(m => m.afectaMisCifras && m.tipo !== 'reverso' && !revertidos.has(m.id))
}

/** El ingreso más cercano en o después de hoy entre todas las fuentes; si no hay, la fecha suelta de la config. */
export function proximoCobro(d: Datos, hoy: string): Cifras['proximoCobro'] {
  const fechas = (d.ingresos ?? []).flatMap(i => {
    const f = proximaFechaIngreso(i, hoy)
    return f ? [{ fecha: f, nombre: i.nombre, montoMXN: i.monto === undefined ? undefined : aMXN(i.monto, i.moneda, d.config.tipoCambioUSD) }] : []
  }).sort((a, b) => a.fecha.localeCompare(b.fecha))
  if (fechas.length) return fechas[0]
  const f = d.config.fechaProximoIngreso
  return f && f >= hoy ? { fecha: f } : undefined
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
  // Pagos fijos: lo que vence hasta 7 días después del próximo cobro. Lo que vence justo tras cobrar
  // no da tiempo de juntarlo con ese ingreso, así que se aparta desde ya.
  const cobro = proximoCobro(d, hoy)
  const corte = sumarDias(cobro?.fecha ?? hoy, 7)
  const vistos = new Set<string>()
  const apartados: LineaApartado[] = []
  for (const c of d.compromisos) {
    // Cada obligación una sola vez: una deuda aparta una vez por fecha de vencimiento.
    const clave = c.deudaId ? `${c.deudaId}|${c.fechaVence}` : c.id
    if (c.estado === 'cubierto' || cubiertos.has(c.id) || c.fechaVence > corte || vistos.has(clave)) continue
    vistos.add(clave)
    apartados.push({ nombre: c.nombre, fechaVence: c.fechaVence, montoMXN: aMXN(c.monto, c.moneda, tc), extraSinInteresesMXN: 0 })
  }

  // Cada tarjeta aparta solita el pago de su último corte, con su propio día de corte y de pago, aunque venza
  // después del próximo ingreso: ese dinero ya se debe. Cuánto, lo dice el plan avalancha; lo pagado desde el corte se descuenta.
  const plan = planAvalancha(d.deudas, d.config.presupuestoDeuda, tc)
  const pagos: LineaPago[] = []
  for (const t of d.deudas) {
    // Préstamo con pago fijo al mes: aparta siempre su siguiente pago (como el estado de cuenta de una tarjeta,
    // ya se debe), descontando lo pagado desde el anterior.
    if (t.tipo === 'prestamo' && t.diaPago !== undefined) {
      const vence = proximoPago(hoy, t.diaPago)
      const desde = mesAntes(vence, t.diaPago)
      const pagado = movs
        .filter(m => m.tipo === 'pago_deuda' && m.deudaId === t.id && fechaLocal(m.ts) > desde)
        .reduce((s, m) => s + m.monto, 0)
      const reserva = Math.max(0, t.minimo - pagado)
      if (reserva > 0) apartados.push({ nombre: t.nombre, fechaVence: vence, montoMXN: aMXN(reserva, t.moneda, tc), extraSinInteresesMXN: 0, deudaId: t.id })
      pagos.push({ deudaId: t.id, nombre: t.nombre, fechaVence: vence, estado: reserva > 0 ? 'pagar' : 'cubierto', montoMXN: reserva > 0 ? aMXN(reserva, t.moneda, tc) : 0 })
      continue
    }
    if (t.tipo !== 'tarjeta' || t.diaCorte === undefined || t.diaPago === undefined) continue
    const desde = ultimoCorte(hoy, t.diaCorte)
    const vence = pagoDelCorte(desde, t.diaPago)
    const pagado = movs
      .filter(m => m.tipo === 'pago_deuda' && m.deudaId === t.id && fechaLocal(m.ts) >= desde)
      .reduce((s, m) => s + m.monto, 0)

    const { pago, extra: avalancha } = plan.get(t.id)!
    const reserva = Math.max(0, pago - pagado)
    const extra = Math.max(0, (t.pagoSinIntereses ?? 0) - Math.max(pago, pagado))
    if (reserva + extra > 0) {
      apartados.push({
        nombre: t.nombre, fechaVence: vence, montoMXN: aMXN(reserva, t.moneda, tc), extraSinInteresesMXN: aMXN(extra, t.moneda, tc),
        deudaId: t.id, avalanchaMXN: aMXN(Math.min(avalancha, reserva), t.moneda, tc),
      })
    }
    const siguienteCorte = pagoDelCorte(desde, t.diaCorte)
    const linea = { deudaId: t.id, nombre: t.nombre, fechaVence: vence }
    if (desde > (t.actualizadaEl ?? CAPTURA_INICIAL)) {
      // Ya cortó después de la última captura: mínimo y pago sin intereses son del estado de cuenta anterior.
      pagos.push({ ...linea, estado: 'actualizar', corte: desde, montoMXN: aMXN(reserva, t.moneda, tc) })
    } else if (reserva > 0) {
      pagos.push({ ...linea, estado: 'pagar', montoMXN: aMXN(reserva, t.moneda, tc), avalanchaMXN: aMXN(Math.min(avalancha, reserva), t.moneda, tc) })
    } else if (vence >= hoy) {
      pagos.push({ ...linea, estado: 'cubierto', montoMXN: aMXN(extra, t.moneda, tc) })
    } else {
      // Este estado de cuenta ya quedó pagado y vencido: lo que sigue es el próximo corte.
      pagos.push({ ...linea, estado: 'por_cortar', corte: siguienteCorte, fechaVence: pagoDelCorte(siguienteCorte, t.diaPago), montoMXN: 0 })
    }

    // Lo gastado con la tarjeta desde el corte aún no sale en el estado de cuenta: se aparta completo desde ya,
    // sin importar cuándo vence. Lo pagado de más sobre el estado de cuenta lo va cubriendo.
    // shortcut: un cargo anterior al corte se asume incluido en minimo/pagoSinIntereses; actualizar esos dos al recibir el estado de cuenta.
    const cargos = movs
      .filter(m => m.tipo === 'gasto' && m.deudaId === t.id && fechaLocal(m.ts) >= desde)
      .reduce((s, m) => s + m.monto, 0)
    const sobrante = Math.max(0, pagado - Math.max(pago, t.pagoSinIntereses ?? 0))
    const porCubrir = Math.max(0, cargos - sobrante)
    if (porCubrir > 0) {
      apartados.push({ nombre: `${t.nombre}: gastos desde el corte`, fechaVence: pagoDelCorte(siguienteCorte, t.diaPago), montoMXN: aMXN(porCubrir, t.moneda, tc), extraSinInteresesMXN: 0 })
    }
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
    definitiva: cobro !== undefined,
    proximoCobro: cobro,
    desglose: { cuentas, apartados },
    pagos: pagos.sort((a, b) => a.fechaVence.localeCompare(b.fechaVence)),
  }
}
