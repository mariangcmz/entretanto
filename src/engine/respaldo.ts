import type { Datos } from './tipos'

// Respaldo en JSON: todo lo de la cuenta en un archivo que se puede volver a cargar.

const VERSION = 1

export const aRespaldo = (d: Datos, ahora: Date) =>
  JSON.stringify({ app: 'entretanto', version: VERSION, exportadoEl: ahora.toISOString(), ...d }, null, 2)

const esLista = (x: unknown): x is Record<string, unknown>[] => Array.isArray(x) && x.every(i => i !== null && typeof i === 'object')

/**
 * Lee un respaldo y lo revisa antes de cargarlo: viene de un archivo, así que no se confía en él.
 * Lanza un Error con un mensaje para la persona si algo no cuadra. Las reglas de Firestore revisan cada movimiento otra vez.
 */
export function leerRespaldo(texto: string): Datos {
  let o: Record<string, unknown>
  try { o = JSON.parse(texto) } catch { throw new Error('El archivo no es un respaldo de Entretanto.') }
  if (o?.app !== 'entretanto') throw new Error('El archivo no es un respaldo de Entretanto.')
  if (typeof o.version !== 'number' || o.version > VERSION) throw new Error('El respaldo es de una versión más nueva de Entretanto. Actualiza la app e inténtalo otra vez.')

  const config = o.config as Record<string, unknown> | undefined
  if (!config || typeof config.tipoCambioUSD !== 'number' || !(config.tipoCambioUSD > 0)) throw new Error('Al respaldo le falta el tipo de cambio.')
  const listas = ['cuentas', 'deudas', 'compromisos', 'movimientos'] as const
  for (const k of listas) if (!esLista(o[k])) throw new Error(`Al respaldo le falta la lista de ${k}.`)
  if (o.ingresos !== undefined && !esLista(o.ingresos)) throw new Error('La lista de ingresos del respaldo está dañada.')

  const catalogos = [o.cuentas, o.deudas, o.compromisos, o.ingresos ?? []] as Record<string, unknown>[][]
  if (catalogos.some(l => l.some(i => typeof i.id !== 'string' || !i.id || typeof i.nombre !== 'string')))
    throw new Error('Hay una cuenta, deuda, pago fijo o ingreso sin nombre en el respaldo.')
  if ((o.movimientos as Record<string, unknown>[]).some(m => typeof m.claveUnica !== 'string' || !m.claveUnica || !Number.isInteger(m.monto)))
    throw new Error('Hay un movimiento dañado en el respaldo.')

  const { cuentas, deudas, compromisos, movimientos, ingresos } = o
  return { config, cuentas, deudas, compromisos, movimientos, ingresos: ingresos ?? [] } as unknown as Datos
}
