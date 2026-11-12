import { onAuthStateChanged, type User } from 'firebase/auth'
import { useEffect, useMemo, useState } from 'preact/hooks'
import { auth, configurado, db, entrarConGoogle } from '../data/firebase'
import { crearRepositorio } from '../data/repositorio'
import type { Datos } from '../engine/tipos'
import { App } from './App'
import { Calado } from './Calado'
import { Aviso } from './Aviso'

/** Decide qué se ve: entrar con Google, cargando o la app con los datos de la cuenta. */
export function Raiz() {
  const [usuaria, setUsuaria] = useState<User | null | undefined>(undefined)
  useEffect(() => onAuthStateChanged(auth, setUsuaria), [])

  if (!configurado) return <Portada><p class="nota">Falta configurar Firebase: copia <code>.env.example</code> como <code>.env.local</code> y llénalo.</p></Portada>
  if (usuaria === undefined) return <Portada><p class="nota" role="status">Abriendo…</p></Portada>
  if (!usuaria) return <Entrada />
  return <ConDatos key={usuaria.uid} uid={usuaria.uid} />
}

function ConDatos(p: { uid: string }) {
  const repo = useMemo(() => crearRepositorio(db, p.uid), [p.uid])
  const [datos, setDatos] = useState<Datos | null>(null)
  const [error, setError] = useState('')
  useEffect(() => repo.escuchar(setDatos, e => setError(e.message)), [repo])

  if (error) return <Portada><p class="aviso" role="alert">No pudimos leer tus datos: {error}</p></Portada>
  if (!datos) return <Portada><p class="nota" role="status">Trayendo tus cifras…</p></Portada>
  return <App datos={datos} repo={repo} />
}

function Entrada() {
  const [error, setError] = useState('')
  const [entrando, setEntrando] = useState(false)
  const [aviso, setAviso] = useState(false)
  async function entrar() {
    setEntrando(true); setError('')
    try { await entrarConGoogle() } catch (e) {
      const code = (e as { code?: string }).code
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') setError('No se pudo entrar. Revisa tu conexión e inténtalo otra vez.')
    } finally { setEntrando(false) }
  }
  if (aviso) return <Aviso volver={() => setAviso(false)} />
  return (
    <Portada>
      <p class="portada-lema">Cuánto te queda de verdad, hasta que vuelvas a cobrar.</p>
      <button class="registrar" type="button" onClick={entrar} disabled={entrando}>{entrando ? 'Entrando…' : 'Entrar con Google'}</button>
      <p class="aviso" role="status">{error}</p>
      <p class="nota portada-pie">Versión beta. No es asesoría financiera. <button type="button" class="enlace" onClick={() => setAviso(true)}>Aviso de privacidad</button></p>
    </Portada>
  )
}

const Portada = (p: { children: preact.ComponentChildren }) => (
  <main class="portada">
    <section class="banner">
      <Calado class="calado" />
      <h1 class="marca portada-marca"><span>Entre</span><span>tanto</span></h1>
    </section>
    {p.children}
  </main>
)
