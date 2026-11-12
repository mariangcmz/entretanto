import { useState } from 'preact/hooks'
import type { Repositorio } from '../data/repositorio'
import { aRespaldo, leerRespaldo } from '../engine/respaldo'
import type { Datos } from '../engine/tipos'

// Descargar todo en un archivo y volver a cargarlo. Cargar no borra nada: la bitácora solo crece.

const cuantos = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`

export function Respaldo(p: { datos: Datos; repo: Repositorio }) {
  const [archivo, setArchivo] = useState<Datos | null>(null)
  const [aviso, setAviso] = useState('')
  const [cargando, setCargando] = useState(false)

  function descargar() {
    const hoy = new Date().toLocaleDateString('en-CA')
    const url = URL.createObjectURL(new Blob([aRespaldo(p.datos, new Date())], { type: 'application/json' }))
    const a = Object.assign(document.createElement('a'), { href: url, download: `entretanto-respaldo-${hoy}.json` })
    a.click()
    URL.revokeObjectURL(url)
  }

  async function elegir(e: Event) {
    const input = e.currentTarget as HTMLInputElement
    const f = input.files?.[0]
    input.value = '' // elegir el mismo archivo otra vez vuelve a leerlo
    if (!f) return
    setAviso('')
    try { setArchivo(leerRespaldo(await f.text())) } catch (err) { setArchivo(null); setAviso((err as Error).message) }
  }

  const ya = new Set(p.datos.movimientos.map(m => m.claveUnica))
  const nuevos = archivo?.movimientos.filter(m => !ya.has(m.claveUnica)) ?? []

  async function cargar() {
    if (!archivo) return
    setCargando(true)
    try {
      await p.repo.importar({ ...archivo, movimientos: nuevos })
      setArchivo(null)
      setAviso(`Respaldo cargado: ${cuantos(nuevos.length, 'movimiento nuevo', 'movimientos nuevos')}.`)
    } catch {
      setAviso('No se cargó todo el respaldo. Revisa tu conexión e inténtalo otra vez: lo que ya entró no se duplica.')
    } finally { setCargando(false) }
  }

  return (
    <section class="ajuste" aria-labelledby="t-respaldo">
      <h2 id="t-respaldo">Respaldo</h2>
      <p class="nota">Un archivo con todo lo que has anotado. Guárdalo donde quieras.</p>
      <button type="button" class="registrar" onClick={descargar}>Descargar respaldo</button>
      {archivo ? (
        <div class="respaldo-revision">
          <p class="nota">
            El archivo trae {cuantos(archivo.cuentas.length, 'cuenta', 'cuentas')}, {cuantos(archivo.deudas.length, 'tarjeta o préstamo', 'tarjetas y préstamos')} y {cuantos(archivo.movimientos.length, 'movimiento', 'movimientos')}
            {' '}({nuevos.length} que no tienes aquí). Tus cuentas, deudas, pagos fijos, ingresos y ajustes se reemplazan por los del archivo;
            lo que solo está aquí se queda y los movimientos se suman.
          </p>
          <button type="button" class="registrar" onClick={cargar} disabled={cargando}>{cargando ? 'Cargando…' : 'Cargar este respaldo'}</button>
          <button type="button" class="enlace" onClick={() => setArchivo(null)}>Cancelar</button>
        </div>
      ) : (
        <label class="enlace archivo">
          Cargar un respaldo
          <input type="file" accept="application/json,.json" class="oculto" onChange={elegir} />
        </label>
      )}
      <p class="aviso" role="status">{aviso}</p>
    </section>
  )
}
