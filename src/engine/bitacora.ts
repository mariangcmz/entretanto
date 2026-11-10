import type { Movimiento } from './tipos'

// La bitácora solo crece: cada registro devuelve un arreglo nuevo y congelado, con cada movimiento congelado.
// El tipo sigue siendo Movimiento[] para no tocar Datos; el congelado hace que editar o borrar truene en tiempo de ejecución.

/** Agrega un movimiento. Si su claveUnica ya existe (confirmar dos veces), no hace nada. */
export function registrar(movs: Movimiento[], m: Movimiento): Movimiento[] {
  if (movs.some(x => x.claveUnica === m.claveUnica)) return movs
  return Object.freeze([...movs, Object.freeze({ ...m })]) as Movimiento[]
}

export const fueReversado = (movs: Movimiento[], id: string) =>
  movs.some(m => m.tipo === 'reverso' && m.reversaDe === id)

/** Corrige un movimiento con uno nuevo que lo reversa. El original se queda tal cual. */
export function reversar(movs: Movimiento[], id: string, ts: number): Movimiento[] {
  const o = movs.find(m => m.id === id)
  if (!o || o.tipo === 'reverso') return movs
  // Clave fija por original: tocar "Deshacer" dos veces registra un solo reverso.
  const clave = `reverso:${id}`
  return registrar(movs, { ...o, id: clave, ts, tipo: 'reverso', reversaDe: id, claveUnica: clave })
}
