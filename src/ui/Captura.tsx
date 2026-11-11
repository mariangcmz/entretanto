import { useState } from 'preact/hooks'
import { interpretarLinea, type TipoCaptura } from '../engine/captura'
import { vigentes } from '../engine/cifras'
import { Calado } from './Calado'
import { formatear } from '../engine/dinero'
import type { Datos, Moneda, Movimiento } from '../engine/tipos'

const TIPOS: [TipoCaptura, string][] = [['gasto', 'Gasto'], ['ingreso', 'Ingreso'], ['pago_deuda', 'Pago']]
// Compara sin acentos ni mayúsculas: "debito" encuentra "Débito".
const llano = (t: string) => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
// Una palabra del nombre escrita completa en la nota: "nu" encuentra Nu pero no "menú"; "travel" encuentra BofA Travel Rewards.
const menciona = (nota: string, nombre: string) =>
  llano(nombre).split(/\s+/).some(w => new RegExp(String.raw`(?<!\p{L})` + escapar(w) + String.raw`(?!\p{L})`, 'u').test(nota))
const escapar = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const MONEDAS: [Moneda, string][] = [['MXN', 'Pesos'], ['USD', 'Dólares']]
const QUIEN: [Movimiento['quien'], string][] = [['yo', 'Yo'], ['pareja', 'Mi pareja'], ['otro', 'Otra persona']]

export function Captura(p: { datos: Datos; registrar: (m: Movimiento) => void }) {
  const { cuentas, deudas, compromisos } = p.datos
  // Una clave por borrador: confirmar dos veces manda la misma y la bitácora la ignora.
  const [clave, setClave] = useState(() => crypto.randomUUID())
  const [texto, setTexto] = useState('')
  const [tipoElegido, setTipoElegido] = useState<TipoCaptura | null>(null)
  const [quien, setQuien] = useState<Movimiento['quien']>('yo')
  const [afecta, setAfecta] = useState(true)
  const [origenElegido, setOrigenElegido] = useState<string | null>(null)
  const [ultimoGasto, setUltimoGasto] = useState<string | null>(null) // tu última tarjeta o cuenta de gasto
  const [destino, setDestino] = useState('')
  const [monedaElegida, setMonedaElegida] = useState<Moneda | null>(null)
  const [aviso, setAviso] = useState('')

  const linea = interpretarLinea(texto)
  const tipo = tipoElegido ?? linea?.tipo ?? 'gasto'

  const pagados = new Set(vigentes(p.datos.movimientos).filter(m => m.tipo === 'pago_deuda').map(m => m.compromisoId))
  const pendientes = compromisos.filter(c => c.estado === 'pendiente' && !pagados.has(c.id))
  const destinos = [
    ...pendientes.map(c => ({ valor: `c:${c.id}`, nombre: c.nombre, compromisoId: c.id, deudaId: c.deudaId })),
    ...deudas.map(d => ({ valor: `d:${d.id}`, nombre: d.nombre, compromisoId: undefined, deudaId: d.id })),
  ]
  const nota = llano(linea?.nota ?? '')
  // Los gastos pueden salir de una tarjeta de crédito; ingresos y pagos solo de cuentas.
  const tarjetas = tipo === 'gasto' ? deudas.filter(d => d.tipo === 'tarjeta') : []
  const origenes = [
    ...tarjetas.map(d => ({ valor: `d:${d.id}`, nombre: d.nombre, moneda: d.moneda, deudaId: d.id, cuentaId: undefined })),
    ...cuentas.map(c => ({ valor: `c:${c.id}`, nombre: c.nombre, moneda: c.moneda, deudaId: undefined, cuentaId: c.id })),
  ]
  // Lo que tocaste gana; si no, lo que nombra la nota ("efectivo", "nu"); si no, la última que usaste para gastar.
  const origen = origenes.find(o => o.valor === origenElegido) ?? origenes.find(o => menciona(nota, o.nombre))
    ?? (tipo === 'gasto' ? origenes.find(o => o.valor === ultimoGasto) : undefined) ?? origenes[0]
  // Lo que tocaste gana; si no, lo que dice la línea ("pesos", "usd"); si no, la moneda de la cuenta o tarjeta.
  const moneda = monedaElegida ?? linea?.moneda ?? origen?.moneda ?? 'MXN'
  const mostrarMoneda = origen?.moneda === 'USD' || moneda !== (origen?.moneda ?? 'MXN')
  const elegido = destinos.find(d => d.valor === destino) ?? destinos.find(d => menciona(nota, d.nombre)) ?? destinos[0]

  function confirmar(e: Event) {
    e.preventDefault()
    if (!linea) return
    const notaFinal = linea.nota || TIPOS.find(t => t[0] === tipo)![1]
    p.registrar({
      id: clave, claveUnica: clave, ts: Date.now(), tipo, monto: linea.monto, moneda,
      cuentaId: origen?.cuentaId, deudaId: origen?.deudaId, quien, afectaMisCifras: afecta, nota: notaFinal,
      ...(tipo === 'pago_deuda' && elegido ? { deudaId: elegido.deudaId, compromisoId: elegido.compromisoId } : {}),
    })
    // Solo se recuerda si es en pesos: heredar una tarjeta en dólares convertiría "90 tacos" en USD 90 sin querer.
    if (tipo === 'gasto' && origen?.moneda === 'MXN') setUltimoGasto(origen.valor)
    setAviso(`Registrado: ${notaFinal}, ${formatear(linea.monto, moneda)} en ${origen?.nombre}.`)
    setClave(crypto.randomUUID())
    setTexto(''); setTipoElegido(null); setOrigenElegido(null); setQuien('yo'); setAfecta(true); setDestino(''); setMonedaElegida(null)
  }

  return (
    <form class="captura" onSubmit={confirmar}>
      <Calado class="calado" />
      <label class="titulo" for="linea">Anota un movimiento</label>
      <input
        id="linea" class="entrada" type="text" inputMode="text" autoComplete="off" enterKeyHint="done"
        placeholder="gasté 300 súper" value={texto}
        onInput={e => { setTexto(e.currentTarget.value); setAviso('') }}
      />

      <fieldset class="segmentos">
        <legend class="oculto">Tipo</legend>
        {TIPOS.map(([v, txt]) => (
          <label key={v}><input type="radio" name="tipo" value={v} checked={tipo === v} onChange={() => setTipoElegido(v)} /><span>{txt}</span></label>
        ))}
      </fieldset>

      {origenes.length > 1 && (
        <fieldset class="segmentos">
          <legend>{tipo === 'ingreso' ? '¿A dónde entra?' : tipo === 'gasto' ? '¿Con qué pagaste?' : '¿De dónde sale?'}</legend>
          {origenes.map(o => (
            <label key={o.valor}><input type="radio" name="origen" value={o.valor} checked={origen?.valor === o.valor} onChange={() => setOrigenElegido(o.valor)} /><span>{o.nombre}</span></label>
          ))}
        </fieldset>
      )}

      {mostrarMoneda && (
        <fieldset class="segmentos">
          <legend>¿En qué moneda?</legend>
          {MONEDAS.map(([v, txt]) => (
            <label key={v}><input type="radio" name="moneda" value={v} checked={moneda === v} onChange={() => setMonedaElegida(v)} /><span>{txt}</span></label>
          ))}
        </fieldset>
      )}

      {tipo === 'pago_deuda' && destinos.length > 0 && (
        <label class="campo">¿Qué pagas?
          <select value={elegido?.valor} onChange={e => setDestino(e.currentTarget.value)}>
            {destinos.map(d => <option key={d.valor} value={d.valor}>{d.nombre}</option>)}
          </select>
        </label>
      )}

      <details class="opciones">
        <summary>Más opciones</summary>
        <fieldset class="segmentos">
          <legend>¿Quién lo hizo?</legend>
          {QUIEN.map(([v, txt]) => (
            <label key={v}><input type="radio" name="quien" value={v} checked={quien === v} onChange={() => setQuien(v)} /><span>{txt}</span></label>
          ))}
        </fieldset>
        <label class="casilla"><input type="checkbox" checked={afecta} onChange={e => setAfecta(e.currentTarget.checked)} /> Mueve mis cifras</label>
      </details>

      <button class="registrar" type="submit" disabled={!linea}>
        {linea ? `Registrar ${formatear(linea.monto, moneda)}` : 'Escribe un monto para registrar'}
      </button>
      <p class="aviso" role="status">{aviso}</p>
    </form>
  )
}
