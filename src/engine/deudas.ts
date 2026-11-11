import { aMXN } from './dinero'
import type { Deuda } from './tipos'

export interface PagoPlaneado {
  pago: number // lo que toca pagar en este estado de cuenta, en la moneda de la tarjeta
  extra: number // la parte de `pago` que pone la avalancha encima del mínimo
}

/**
 * Avalancha: el mínimo a todas y lo que sobra del presupuesto mensual para deudas a la de mayor tasa,
 * hasta liquidarla; luego a la siguiente. Una tarjeta que se paga completa cada mes sale del plan y
 * aparta su pago sin intereses. Sin presupuesto no hay extra: solo mínimos.
 */
export function planAvalancha(deudas: Deuda[], presupuestoMXN: number | undefined, tc: number): Map<string, PagoPlaneado> {
  // shortcut: solo tarjetas; los préstamos con fecha fija entran en la Fase 4 con su tabla de seguimiento.
  const tarjetas = deudas.filter(t => t.tipo === 'tarjeta')
  const base = (t: Deuda) => t.pagoCompleto ? (t.pagoSinIntereses ?? t.minimo) : t.minimo
  const plan = new Map(tarjetas.map(t => [t.id, { pago: base(t), extra: 0 }]))

  let sobra = Math.max(0, (presupuestoMXN ?? 0) - tarjetas.reduce((s, t) => s + aMXN(base(t), t.moneda, tc), 0))
  const orden = tarjetas.filter(t => !t.pagoCompleto).sort((a, b) => b.tasaAnual - a.tasaAnual || (a.ordenPlan ?? 0) - (b.ordenPlan ?? 0))
  for (const t of orden) {
    if (sobra <= 0) break
    const cabe = aMXN(Math.max(0, t.saldoInicial - base(t)), t.moneda, tc)
    const daMXN = Math.min(sobra, cabe)
    const da = t.moneda === 'USD' ? Math.floor(daMXN / tc) : daMXN
    sobra -= daMXN
    plan.set(t.id, { pago: base(t) + da, extra: da })
  }
  return plan
}
