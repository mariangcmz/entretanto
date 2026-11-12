import { useEffect, useState } from 'preact/hooks'
import type { Catalogo, Repositorio } from '../data/repositorio'
import { salir } from '../data/firebase'
import { formatear, pesos } from '../engine/dinero'
import type { Config, Datos } from '../engine/tipos'
import { CONTACTO, reportar } from './Aviso'
import { Respaldo } from './Respaldo'

// Formularios de lo que sí se edita: cuentas, tarjetas y préstamos, pagos fijos y la config.
// Los movimientos no pasan por aquí: esos solo se agregan desde la captura.

type Campo = {
  k: string
  etiqueta: string
  tipo: 'texto' | 'dinero' | 'numero' | 'fecha' | 'opciones' | 'sino'
  opciones?: [string, string][]
  opcional?: boolean
  ayuda?: string
  si?: (v: Record<string, string>) => boolean // solo se muestra (y se guarda) cuando se cumple
  defecto?: (item: Item) => unknown // valor inicial si el item no lo trae
  min?: number
  max?: number
}
type Item = Record<string, unknown>

const FRECUENCIAS: [string, string][] = [['mensual', 'Cada mes'], ['quincenal', 'Cada quincena'], ['semanal', 'Cada semana'], ['una_vez', 'Una sola vez']]
const MONEDA: Campo = { k: 'moneda', etiqueta: 'Moneda', tipo: 'opciones', opciones: [['MXN', 'Pesos'], ['USD', 'Dólares']] }
const DIA = (k: string, etiqueta: string): Campo => ({ k, etiqueta, tipo: 'numero', opcional: true, min: 1, max: 31, ayuda: 'Día del mes, del 1 al 31' })

const CAMPOS: Record<Catalogo, Campo[]> = {
  cuentas: [
    { k: 'nombre', etiqueta: 'Nombre', tipo: 'texto' },
    { k: 'tipo', etiqueta: 'Tipo', tipo: 'opciones', opciones: [['debito', 'Débito'], ['efectivo', 'Efectivo'], ['otro', 'Otra']] },
    MONEDA,
    { k: 'saldoInicial', etiqueta: 'Saldo al empezar', tipo: 'dinero', ayuda: 'Lo que tenía al empezar a usar Entretanto' },
  ],
  deudas: [
    { k: 'nombre', etiqueta: 'Nombre', tipo: 'texto' },
    { k: 'tipo', etiqueta: 'Tipo', tipo: 'opciones', opciones: [['tarjeta', 'Tarjeta'], ['prestamo', 'Préstamo']] },
    MONEDA,
    { k: 'saldoInicial', etiqueta: 'Saldo que debes', tipo: 'dinero' },
    { k: 'tasaAnual', etiqueta: 'Tasa anual (%)', tipo: 'numero', min: 0, max: 300 },
    { k: 'minimo', etiqueta: 'Pago mínimo', tipo: 'dinero', ayuda: 'Del último estado de cuenta' },
    { k: 'pagoSinIntereses', etiqueta: 'Pago para no generar intereses', tipo: 'dinero', opcional: true },
    DIA('diaCorte', 'Día de corte'),
    DIA('diaPago', 'Día límite de pago'),
    { k: 'pagoCompleto', etiqueta: '¿La pagas completa cada mes?', tipo: 'sino', ayuda: 'Si sí, aparta el pago sin intereses y sale de la avalancha' },
  ],
  ingresos: [
    { k: 'nombre', etiqueta: 'Nombre', tipo: 'texto' },
    { k: 'monto', etiqueta: 'Cuánto esperas', tipo: 'dinero', opcional: true, ayuda: 'Si varía, déjalo vacío o pon lo mínimo que esperas' },
    MONEDA,
    {
      k: 'frecuencia', etiqueta: '¿Cada cuánto te pagan?', tipo: 'opciones', opciones: FRECUENCIAS,
      defecto: i => i.diaCobro !== undefined ? 'mensual' : 'una_vez', // los guardados antes de la frecuencia
    },
    { ...DIA('diaCobro', 'Día de cobro'), ayuda: 'El mismo día cada mes', si: v => v.frecuencia === 'mensual' },
    { ...DIA('diaCobro', 'Primer día de la quincena'), ayuda: 'Si lo dejas vacío, el 15', si: v => v.frecuencia === 'quincenal' },
    { ...DIA('diaCobro2', 'Segundo día de la quincena'), ayuda: 'Si lo dejas vacío, el último del mes', si: v => v.frecuencia === 'quincenal' },
    { k: 'fecha', etiqueta: 'Fecha del cobro', tipo: 'fecha', opcional: true, ayuda: 'Si ya sabes cuándo; si no, anótalo como ingreso cuando te paguen', si: v => v.frecuencia === 'una_vez' },
    { k: 'fecha', etiqueta: 'Un día en que te pagan', tipo: 'fecha', ayuda: 'De ahí se cuenta cada 7 días', si: v => v.frecuencia === 'semanal' },
  ],
  compromisos: [
    { k: 'nombre', etiqueta: 'Nombre', tipo: 'texto' },
    { k: 'monto', etiqueta: 'Monto', tipo: 'dinero' },
    MONEDA,
    { k: 'fechaVence', etiqueta: 'Vence el', tipo: 'fecha' },
  ],
}

const CAMPOS_CONFIG: Campo[] = [
  { k: 'tipoCambioUSD', etiqueta: 'Tipo de cambio (pesos por dólar)', tipo: 'numero', min: 0.01 },
  { k: 'presupuestoDeuda', etiqueta: 'Para deudas cada mes', tipo: 'dinero', opcional: true, ayuda: 'Lo que pase de los mínimos va a la tarjeta con la tasa más alta (avalancha)' },
]

const NUEVO: Record<Catalogo, Item> = {
  cuentas: { tipo: 'debito', moneda: 'MXN' },
  deudas: { tipo: 'tarjeta', moneda: 'MXN' },
  compromisos: { moneda: 'MXN', estado: 'pendiente' },
  ingresos: { moneda: 'MXN', frecuencia: 'mensual' },
}

const SINO: [string, string][] = [['', 'No'], ['si', 'Sí']]
const aTexto = (c: Campo, v: unknown) => v === undefined || v === null ? '' : c.tipo === 'sino' ? (v ? 'si' : '') : c.tipo === 'dinero' ? String((v as number) / 100) : String(v)
function deTexto(c: Campo, s: string): unknown {
  const t = s.trim()
  if (t === '') return undefined
  if (c.tipo === 'sino') return true
  if (c.tipo === 'dinero') return pesos(Number(t.replace(/[$,\s]/g, '')))
  if (c.tipo === 'numero') return Number(t)
  return t
}

function Editor(p: { campos: Campo[]; item: Item; guardar: (i: Item) => Promise<void>; boton: string }) {
  const [valores, setValores] = useState(() => Object.fromEntries(p.campos.map(c => [c.k, aTexto(c, p.item[c.k] ?? c.defecto?.(p.item))])))
  const visibles = p.campos.filter(c => !c.si || c.si(valores))
  const ocultos = p.campos.filter(c => !visibles.some(v => v.k === c.k)).map(c => c.k)
  const [aviso, setAviso] = useState('')
  const pon = (k: string, v: string) => { setValores(x => ({ ...x, [k]: v })); setAviso('') }

  function enviar(e: Event) {
    e.preventDefault()
    const item: Item = { ...p.item }
    for (const k of ocultos) delete item[k] // lo de otra frecuencia no se guarda
    for (const c of visibles) {
      const v = deTexto(c, valores[c.k] ?? '')
      if (typeof v === 'number' && (Number.isNaN(v) || (c.min !== undefined && v < c.min) || (c.max !== undefined && v > c.max)))
        return setAviso(`Revisa «${c.etiqueta}»${c.ayuda ? `: ${c.ayuda.toLowerCase()}` : ''}.`)
      if (v === undefined) delete item[c.k]; else item[c.k] = v
    }
    // Sin esperar a la nube: sin señal, Firestore lo guarda local y lo sube después.
    p.guardar(item).catch(() => setAviso('No se guardó. Inténtalo otra vez.'))
    setAviso('Guardado.')
    // En una lista, guardar cierra el desplegable.
    ;(e.currentTarget as HTMLFormElement).closest('details')?.removeAttribute('open')
  }

  return (
    <form class="editor" onSubmit={enviar}>
      {visibles.map(c => {
        const id = `${String(p.item.id ?? 'nuevo')}-${c.k}`
        return (
          <label key={c.k} class="campo" for={id}>
            <span>{c.etiqueta}{c.opcional && <small> (opcional)</small>}</span>
            {c.tipo === 'opciones' || c.tipo === 'sino'
              ? <select id={id} value={valores[c.k]} onChange={e => pon(c.k, e.currentTarget.value)}>
                  {(c.opciones ?? SINO).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                </select>
              : <input
                  id={id} required={!c.opcional} value={valores[c.k]} onInput={e => pon(c.k, e.currentTarget.value)}
                  {...(c.tipo === 'fecha' ? { type: 'date' } as const : { type: 'text' } as const)}
                  // Texto con teclado numérico: acepta "1,500.50" y no cambia el número al girar la rueda del mouse.
                  inputMode={c.tipo === 'dinero' || c.tipo === 'numero' ? 'decimal' : undefined}
                  pattern={c.tipo === 'dinero' ? String.raw`\$?\s*[\d,]*\.?\d{0,2}` : c.tipo === 'numero' ? String.raw`\d*\.?\d*` : undefined}
                />}
            {c.ayuda && <small>{c.ayuda}</small>}
          </label>
        )
      })}
      <button class="registrar" type="submit">{p.boton}</button>
      <p class="aviso" role="status">{aviso}</p>
    </form>
  )
}

const TITULOS: Record<Catalogo, [string, string]> = {
  cuentas: ['Cuentas', 'Agregar cuenta'],
  deudas: ['Tarjetas y préstamos', 'Agregar tarjeta o préstamo'],
  compromisos: ['Pagos fijos', 'Agregar pago fijo'],
  ingresos: ['Ingresos', 'Agregar ingreso'],
}

function Lista(p: { cat: Catalogo; datos: Datos; repo: Repositorio; abierta?: boolean }) {
  const items = (p.datos[p.cat] ?? []) as unknown as (Item & { id: string; nombre: string; moneda: 'MXN' | 'USD' })[]
  const [titulo, agregar] = TITULOS[p.cat]
  // Al guardar una deuda se anota el día: si después corta, la app sabe que sus cifras son del estado anterior.
  const guardar = (i: Item) => p.repo.guardar(p.cat, (p.cat === 'deudas' ? { ...i, actualizadaEl: new Date().toLocaleDateString('en-CA') } : i) as never)
  // Lo que ya aparece en la bitácora no se quita: dejaría movimientos sin su cuenta.
  const enUso = new Set(p.datos.movimientos.flatMap(m => [m.cuentaId, m.deudaId, m.compromisoId]))
  const monto = (i: Item & { moneda: 'MXN' | 'USD' }) => {
    const m = (i.saldoInicial ?? i.monto) as number | undefined
    return m === undefined ? 'Variable' : formatear(m, i.moneda)
  }

  return (
    <section class="ajuste" aria-labelledby={`t-${p.cat}`}>
      <h2 id={`t-${p.cat}`}>{titulo}</h2>
      {items.map(i => (
        <details key={i.id} class="ajuste-item">
          <summary>
            <span>{i.nombre}{p.cat === 'ingresos' && <small> · {FRECUENCIAS.find(f => f[0] === (i.frecuencia ?? (i.diaCobro !== undefined ? 'mensual' : 'una_vez')))?.[1].toLowerCase()}</small>}</span>
            <span>{monto(i)}</span>
          </summary>
          <Editor campos={CAMPOS[p.cat]} item={i} guardar={guardar} boton="Guardar cambios" />
          {enUso.has(i.id)
            ? <p class="nota">Tiene movimientos en la bitácora, así que se queda.</p>
            : <button type="button" class="enlace fuerte" onClick={() => p.repo.borrar(p.cat, i.id)}>Quitar {i.nombre}</button>}
        </details>
      ))}
      <details class="ajuste-item nuevo" open={p.abierta}>
        <summary>{agregar}</summary>
        <Editor
          key={items.length} campos={CAMPOS[p.cat]} item={{ ...NUEVO[p.cat], id: crypto.randomUUID() }}
          guardar={guardar} boton="Agregar"
        />
      </details>
    </section>
  )
}

export function Ajustes(p: { datos: Datos; repo: Repositorio; volver: () => void; aviso: () => void; abrir?: Catalogo }) {
  // Desde un primer paso: directo a esa sección, con su formulario de agregar abierto.
  useEffect(() => { if (p.abrir) document.getElementById(`t-${p.abrir}`)?.scrollIntoView() }, [])
  return (
    <main>
      <header class="cabecera">
        <h1 class="marca"><span>Tus </span><span>datos</span></h1>
        <button type="button" class="pill boton" onClick={p.volver}>Listo</button>
      </header>
      <section class="ajuste" aria-labelledby="t-config">
        <h2 id="t-config">Deudas y tipo de cambio</h2>
        <Editor campos={CAMPOS_CONFIG} item={p.datos.config as unknown as Item} guardar={i => p.repo.guardarConfig(i as unknown as Config)} boton="Guardar" />
      </section>
      {(['ingresos', 'cuentas', 'deudas', 'compromisos'] as const).map(cat => (
        <Lista key={cat} cat={cat} datos={p.datos} repo={p.repo} abierta={p.abrir === cat} />
      ))}
      <Respaldo datos={p.datos} repo={p.repo} />
      <nav class="pie" aria-label="Más">
        {CONTACTO && <a class="enlace" href={reportar()}>Reportar algo que no funciona</a>}
        <button type="button" class="enlace" onClick={p.aviso}>Privacidad · no es asesoría financiera</button>
        <button type="button" class="enlace" onClick={salir}>Cerrar sesión</button>
      </nav>
    </main>
  )
}
