import type { Movimiento } from './tipos'

export type TipoCaptura = Extract<Movimiento['tipo'], 'gasto' | 'ingreso' | 'pago_deuda'>

export interface LineaInterpretada {
  monto: number // centavos, positivo
  nota: string
  tipo: TipoCaptura // sugerido; la persona puede cambiarlo
}

// "1,500.50", "$300", "300.5", "1500"
const MONTO = /\$?\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?/
// \b no sirve con acentos ("pagué"), por eso los límites de palabra van a mano.
const palabra = (alt: string) => String.raw`(?<!\p{L})(?:${alt})(?!\p{L})`
const INGRESO = new RegExp(palabra('me pagaron|me depositaron|me cay[oó]|cobr[eé]|sueldo|n[oó]mina|quincena|ingresos?|entr[oó]|dep[oó]sito'), 'iu')
const PAGO = new RegExp(palabra('pagu[eé]|abon[eé]|pago') + '.*' + palabra('tarjeta|deuda|pr[eé]stamo|cr[eé]dito|m[ií]nimo|internet|luz|agua|renta|tel[eé]fono'), 'iu')
const VERBO = /^(gast[eé]|pagu[eé]|compr[eé]|abon[eé]|cobr[eé]|me pagaron|me depositaron|me cay[oó])\s+/i

/** Lee una línea como "gasté 300 súper". Devuelve null si no hay un monto mayor a cero. */
export function interpretarLinea(texto: string): LineaInterpretada | null {
  const t = texto.trim()
  const m = MONTO.exec(t)
  if (!m) return null
  const enteros = +m[1]!.replace(/,/g, '')
  const monto = enteros * 100 + +(m[2] ?? '0').padEnd(2, '0')
  if (monto <= 0) return null
  const tipo: TipoCaptura = INGRESO.test(t) ? 'ingreso' : PAGO.test(t) ? 'pago_deuda' : 'gasto'
  const sinMonto = (t.slice(0, m.index) + ' ' + t.slice(m.index + m[0].length)).replace(/\s+/g, ' ').trim()
  const nota = sinMonto.replace(VERBO, '').replace(/^(de|en|del|por)\s+/i, '').trim()
  return { monto, nota, tipo }
}
