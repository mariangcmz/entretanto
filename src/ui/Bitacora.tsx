import { useState } from 'preact/hooks'
import { fueReversado } from '../engine/bitacora'
import { formatear } from '../engine/dinero'
import type { Movimiento } from '../engine/tipos'

const QUIEN = { yo: '', pareja: 'Mi pareja', otro: 'Otra persona' }
const cuando = (ts: number) => new Date(ts).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
const signo = (m: Movimiento) => (m.tipo === 'ingreso' || (m.tipo === 'ajuste' && m.monto > 0) ? '+' : '−')

export function Bitacora(p: { movimientos: Movimiento[]; cuentas: { id: string; nombre: string }[]; deshacer: (id: string) => void }) {
  const [confirmando, setConfirmando] = useState<string | null>(null)
  const porId = new Map(p.movimientos.map(m => [m.id, m]))

  if (p.movimientos.length === 0) return (
    <section class="bitacora"><h2>Bitácora</h2><p class="nota">Aquí aparece cada movimiento que anotes. Nada se borra.</p></section>
  )

  return (
    <section class="bitacora" aria-labelledby="t-bitacora">
      <h2 id="t-bitacora">Bitácora</h2>
      <ol>
        {[...p.movimientos].reverse().map(m => {
          const reverso = m.tipo === 'reverso'
          const deshecho = !reverso && fueReversado(p.movimientos, m.id)
          const detalles = [
            cuando(m.ts),
            p.cuentas.find(c => c.id === (m.cuentaId ?? m.deudaId))?.nombre,
            QUIEN[m.quien],
            !m.afectaMisCifras && 'no mueve tus cifras',
            deshecho && 'deshecho',
          ].filter(Boolean).join(', ')
          return (
            <li key={m.id} class={reverso || deshecho ? 'mov apagado' : 'mov'}>
              <div class="mov-texto">
                <span class={deshecho ? 'mov-nota tachado' : 'mov-nota'}>
                  {reverso ? `Deshace: ${porId.get(m.reversaDe!)?.nota ?? m.nota}` : m.nota}
                </span>
                <span class="mov-detalle">{detalles}</span>
              </div>
              <span class={deshecho ? 'mov-monto tachado' : 'mov-monto'}>
                {reverso ? '' : signo(m)}{formatear(Math.abs(m.monto), m.moneda)}
              </span>
              {!reverso && !deshecho && (
                confirmando === m.id
                  ? <span class="mov-acciones">
                      <button type="button" class="enlace fuerte" onClick={() => { p.deshacer(m.id); setConfirmando(null) }}>Sí, deshacer</button>
                      <button type="button" class="enlace" onClick={() => setConfirmando(null)}>Cancelar</button>
                    </span>
                  : <span class="mov-acciones">
                      <button type="button" class="enlace" onClick={() => setConfirmando(m.id)}>Deshacer</button>
                    </span>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
