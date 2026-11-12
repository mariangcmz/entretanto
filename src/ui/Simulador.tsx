import { useState } from 'preact/hooks'
import { formatear, pesos } from '../engine/dinero'
import { simular } from '../engine/simulador'
import type { Datos } from '../engine/tipos'

// "¿Y si lo compro?": cuánto te quedaría y cuándo cae cada cuota. Nada se guarda.

const PLAZOS = [1, 3, 6, 9, 12, 18]
const fecha = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }).replace('.', '')
const enSuMoneda = (c: number, m: 'MXN' | 'USD') => m === 'USD' ? `USD ${(c / 100).toLocaleString('es-MX', { minimumFractionDigits: 2 })}` : formatear(c)

export function Simulador(p: { datos: Datos; hoy: string }) {
  const origenes = [
    ...p.datos.deudas.filter(t => t.tipo === 'tarjeta').map(t => ({ id: t.id, nombre: t.nombre, tarjeta: true })),
    ...p.datos.cuentas.map(c => ({ id: c.id, nombre: c.nombre, tarjeta: false })),
  ]
  const [texto, setTexto] = useState('')
  const [origenId, setOrigenId] = useState(origenes[0]?.id ?? '')
  const [meses, setMeses] = useState(1)
  if (origenes.length === 0) return null

  const origen = origenes.find(o => o.id === origenId) ?? origenes[0]!
  const n = Number(texto.replace(/[$,\s]/g, ''))
  const monto = Number.isFinite(n) && n > 0 ? pesos(n) : 0
  const plazo = origen.tarjeta ? meses : 1
  const r = monto ? simular(p.datos, p.hoy, { monto, moneda: 'MXN', origen: origen.id, meses: plazo }) : null

  return (
    <details class="captura simulador">
      <summary class="titulo">¿Y si lo compro?</summary>
      <div class="sim-cuerpo">
      <label class="campo" for="sim-monto">
        <span>Cuánto cuesta, en pesos</span>
        <input id="sim-monto" class="entrada" type="text" inputMode="decimal" placeholder="$0" value={texto} onInput={e => setTexto(e.currentTarget.value)} />
      </label>
      <label class="campo" for="sim-origen">
        <span>Con qué pagarías</span>
        <select id="sim-origen" value={origen.id} onChange={e => setOrigenId(e.currentTarget.value)}>
          {origenes.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
        </select>
      </label>
      {origen.tarjeta && (
        <fieldset class="segmentos">
          <legend>Plazo</legend>
          {PLAZOS.map(m => (
            <label key={m}>
              <input type="radio" name="sim-meses" checked={meses === m} onChange={() => setMeses(m)} />
              <span>{m === 1 ? 'Contado' : `${m} MSI`}</span>
            </label>
          ))}
        </fieldset>
      )}

      <div class="sim-resultado" aria-live="polite">
        {r && (
          <>
            <p class="sim-cifra">
              <span>Te quedarían</span>
              <b class={r.meQuedaDespues < 0 ? 'negativo' : undefined}>{formatear(r.meQuedaDespues)}</b>
              <small>Sin comprarlo: {formatear(r.meQuedaAntes)}</small>
            </p>
            {r.cuotas.length > 1 ? (
              <ol class="sim-cuotas">
                {r.cuotas.map((c, i) => (
                  <li key={c.fecha}><span>{i === 0 ? 'Primera cuota' : `Cuota ${i + 1}`}, {fecha(c.fecha)}</span><span>{enSuMoneda(c.monto, c.moneda)}</span></li>
                ))}
              </ol>
            ) : origen.tarjeta && (
              <p class="nota">Se paga completo el {fecha(r.cuotas[0]!.fecha)}, en el estado de cuenta que viene.</p>
            )}
          </>
        )}
        <p class="nota">Solo es una simulación: no se anota nada.</p>
      </div>
      </div>
    </details>
  )
}
