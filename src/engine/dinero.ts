import type { Moneda } from './tipos'

export const pesos = (n: number) => Math.round(n * 100)

export const aMXN = (centavos: number, moneda: Moneda, tipoCambioUSD: number) =>
  moneda === 'USD' ? Math.round(centavos * tipoCambioUSD) : centavos

const fmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })
export const formatear = (centavos: number) => fmt.format(centavos / 100)

export const formatearFecha = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
