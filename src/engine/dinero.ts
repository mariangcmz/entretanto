import type { Moneda } from './tipos'

export const pesos = (n: number) => Math.round(n * 100)

export const aMXN = (centavos: number, moneda: Moneda, tipoCambioUSD: number) =>
  moneda === 'USD' ? Math.round(centavos * tipoCambioUSD) : centavos

/** Pasa un monto a otra moneda: un gasto en pesos con una tarjeta en dólares se descuenta en dólares. */
export const convertir = (centavos: number, de: Moneda, a: Moneda, tipoCambioUSD: number) =>
  de === a ? centavos : a === 'MXN' ? Math.round(centavos * tipoCambioUSD) : Math.round(centavos / tipoCambioUSD)

const fmt = { MXN: new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }), USD: new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'USD' }) }
export const formatear = (centavos: number, moneda: Moneda = 'MXN') => fmt[moneda].format(centavos / 100)

export const formatearFecha = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
