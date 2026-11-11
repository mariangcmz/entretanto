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

/** El siguiente día de pago en o después de hoy (préstamos con pago fijo al mes). */
export function proximoPago(hoy: string, diaPago: number): string {
  const [a, m] = partes(hoy)
  const este = fecha(a, m, diaPago)
  return este >= hoy ? este : fecha(a, m + 1, diaPago)
}

/** El mismo día de pago un mes antes. */
export function mesAntes(iso: string, dia: number): string {
  const [a, m] = partes(iso)
  return fecha(a, m - 1, dia)
}

/** El siguiente cobro de un ingreso en o después de hoy, según su frecuencia. */
export function proximaFechaIngreso(i: { frecuencia?: string; diaCobro?: number; diaCobro2?: number; fecha?: string }, hoy: string): string | undefined {
  const frecuencia = i.frecuencia ?? (i.diaCobro !== undefined ? 'mensual' : 'una_vez')
  if (frecuencia === 'mensual') return i.diaCobro === undefined ? undefined : proximoPago(hoy, i.diaCobro)
  if (frecuencia === 'quincenal') {
    const [a, b] = [proximoPago(hoy, i.diaCobro ?? 15), proximoPago(hoy, i.diaCobro2 ?? 31)]
    return a < b ? a : b
  }
  if (!i.fecha) return undefined
  if (frecuencia === 'una_vez') return i.fecha >= hoy ? i.fecha : undefined
  // semanal: de la fecha de referencia, de 7 en 7 hasta llegar a hoy
  const dias = Math.round((Date.parse(`${hoy}T00:00:00Z`) - Date.parse(`${i.fecha}T00:00:00Z`)) / 86_400_000)
  return dias <= 0 ? i.fecha : sumarDias(i.fecha, Math.ceil(dias / 7) * 7)
}

export function sumarDias(iso: string, n: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)
}
