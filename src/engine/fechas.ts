// Fechas ISO 'YYYY-MM-DD'. Un día que no existe en el mes (31 en noviembre) cae en el último día.

/** mes0 empieza en 0 y puede salirse de 0..11; Date.UTC lo acomoda al año correcto. */
function fecha(anio: number, mes0: number, dia: number): string {
  const ultimo = new Date(Date.UTC(anio, mes0 + 1, 0)).getUTCDate()
  return new Date(Date.UTC(anio, mes0, Math.min(dia, ultimo))).toISOString().slice(0, 10)
}

const partes = (iso: string) => [+iso.slice(0, 4), +iso.slice(5, 7) - 1] as const

/** El corte más reciente en o antes de hoy. */
export function ultimoCorte(hoy: string, diaCorte: number): string {
  const [a, m] = partes(hoy)
  const este = fecha(a, m, diaCorte)
  return este <= hoy ? este : fecha(a, m - 1, diaCorte)
}

/** La fecha límite de pago que corresponde a un corte: el primer día de pago después de él. */
export function pagoDelCorte(corte: string, diaPago: number): string {
  const [a, m] = partes(corte)
  const este = fecha(a, m, diaPago)
  return este > corte ? este : fecha(a, m + 1, diaPago)
}

export const fechaLocal = (ts: number) => new Date(ts).toLocaleDateString('en-CA')
