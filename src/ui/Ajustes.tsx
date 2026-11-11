import { useState } from 'preact/hooks'
import type { Catalogo, Repositorio } from '../data/repositorio'
import { salir } from '../data/firebase'
import { formatear, pesos } from '../engine/dinero'
import type { Config, Datos } from '../engine/tipos'

// Formularios de lo que sí se edita: cuentas, tarjetas y préstamos, pagos fijos y la config.
// Los movimientos no pasan por aquí: esos solo se agregan desde la captura.

type Campo = {
  k: string
  etiqueta: string
  tipo: 'texto' | 'dinero' | 'numero' | 'fecha' | 'opciones'
  opciones?: [string, string][]
  opcional?: boolean
  ayuda?: string
  min?: number
  max?: number
}
type Item = Record<string, unknown>

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
  ],
  compromisos: [
    { k: 'nombre', etiqueta: 'Nombre', tipo: 'texto' },
    { k: 'monto', etiqueta: 'Monto', tipo: 'dinero' },
    MONEDA,
    { k: 'fechaVence', etiqueta: 'Vence el', tipo: 'fecha' },
  ],
}

const CAMPOS_CONFIG: Campo[] = [
  { k: 'fechaProximoIngreso', etiqueta: 'Próximo cobro', tipo: 'fecha', opcional: true },
  { k: 'ingresoEsperado', etiqueta: 'Cuánto esperas cobrar', tipo: 'dinero', opcional: true },
  { k: 'tipoCambioUSD', etiqueta: 'Tipo de cambio (pesos por dólar)', tipo: 'numero', min: 0.01 },
]

const NUEVO: Record<Catalogo, Item> = {
  cuentas: { tipo: 'debito', moneda: 'MXN' },
  deudas: { tipo: 'tarjeta', moneda: 'MXN' },
  compromisos: { moneda: 'MXN', estado: 'pendiente' },
}

const aTexto = (c: Campo, v: unknown) => v === undefined || v === null ? '' : c.tipo === 'dinero' ? String((v as number) / 100) : String(v)
function deTexto(c: Campo, s: string): unknown {
  const t = s.trim()
  if (t === '') return undefined
  if (c.tipo === 'dinero') return pesos(Number(t.replace(/[$,\s]/g, '')))
  if (c.tipo === 'numero') return Number(t)
  return t
}

function Editor(p: { campos: Campo[]; item: Item; guardar: (i: Item) => Promise<void>; boton: string }) {
  const [valores, setValores] = useState(() => Object.fromEntries(p.campos.map(c => [c.k, aTexto(c, p.item[c.k])])))
  const [aviso, setAviso] = useState('')
  const pon = (k: string, v: string) => { setValores(x => ({ ...x, [k]: v })); setAviso('') }

  function enviar(e: Event) {
    e.preventDefault()
    const item: Item = { ...p.item }
    for (const c of p.campos) {
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
      {p.campos.map(c => {
        const id = `${String(p.item.id ?? 'nuevo')}-${c.k}`
        return (
          <label key={c.k} class="campo" for={id}>
            <span>{c.etiqueta}{c.opcional && <small> (opcional)</small>}</span>
            {c.tipo === 'opciones'
              ? <select id={id} value={valores[c.k]} onChange={e => pon(c.k, e.currentTarget.value)}>
                  {c.opciones!.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
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
}

function Lista(p: { cat: Catalogo; datos: Datos; repo: Repositorio }) {
  const items = p.datos[p.cat] as unknown as (Item & { id: string; nombre: string; moneda: 'MXN' | 'USD' })[]
  const [titulo, agregar] = TITULOS[p.cat]
  const guardar = (i: Item) => p.repo.guardar(p.cat, i as never)
  // Lo que ya aparece en la bitácora no se quita: dejaría movimientos sin su cuenta.
  const enUso = new Set(p.datos.movimientos.flatMap(m => [m.cuentaId, m.deudaId, m.compromisoId]))
  const monto = (i: Item) => (i.saldoInicial ?? i.monto) as number

  return (
    <section class="ajuste" aria-labelledby={`t-${p.cat}`}>
      <h2 id={`t-${p.cat}`}>{titulo}</h2>
      {items.map(i => (
        <details key={i.id} class="ajuste-item">
          <summary><span>{i.nombre}</span><span>{formatear(monto(i), i.moneda)}</span></summary>
          <Editor campos={CAMPOS[p.cat]} item={i} guardar={guardar} boton="Guardar cambios" />
          {enUso.has(i.id)
            ? <p class="nota">Tiene movimientos en la bitácora, así que se queda.</p>
            : <button type="button" class="enlace fuerte" onClick={() => p.repo.borrar(p.cat, i.id)}>Quitar {i.nombre}</button>}
        </details>
      ))}
      <details class="ajuste-item nuevo">
        <summary>{agregar}</summary>
        <Editor
          key={items.length} campos={CAMPOS[p.cat]} item={{ ...NUEVO[p.cat], id: crypto.randomUUID() }}
          guardar={guardar} boton="Agregar"
        />
      </details>
    </section>
  )
}

export function Ajustes(p: { datos: Datos; repo: Repositorio; volver: () => void }) {
  return (
    <main>
      <header class="cabecera">
        <h1 class="marca"><span>Tus </span><span>datos</span></h1>
        <button type="button" class="pill boton" onClick={p.volver}>Listo</button>
      </header>
      <section class="ajuste" aria-labelledby="t-config">
        <h2 id="t-config">Cobro y tipo de cambio</h2>
        <Editor campos={CAMPOS_CONFIG} item={p.datos.config as unknown as Item} guardar={i => p.repo.guardarConfig(i as unknown as Config)} boton="Guardar" />
      </section>
      <Lista cat="cuentas" datos={p.datos} repo={p.repo} />
      <Lista cat="deudas" datos={p.datos} repo={p.repo} />
      <Lista cat="compromisos" datos={p.datos} repo={p.repo} />
      <button type="button" class="enlace" onClick={salir}>Cerrar sesión</button>
    </main>
  )
}
