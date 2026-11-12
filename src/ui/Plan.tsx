import { formatear } from '../engine/dinero'
import { proyectar } from '../engine/seguimiento'
import type { Datos } from '../engine/tipos'
import { Calado } from './Calado'

// Plan de deudas: cuándo sales, en qué orden se liquida cada una y la tabla mes por mes de la avalancha.

const mesLargo = (ym: string) => new Date(`${ym}-15T12:00:00`).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' }).replace(' de ', ' ')
const mesCorto = (ym: string) => new Date(`${ym}-15T12:00:00`).toLocaleDateString('es-MX', { month: 'short' }).replace('.', '')
const enSuMoneda = (c: number, m: 'MXN' | 'USD') => m === 'USD' ? `USD ${(c / 100).toLocaleString('es-MX', { minimumFractionDigits: 2 })}` : formatear(c)

export function Plan(p: { datos: Datos; hoy: string; volver: () => void; ajustes: () => void }) {
  const s = proyectar(p.datos, p.hoy)
  const nombre = new Map(s.orden.map(o => [o.id, o.nombre]))
  const primeraTarjeta = s.orden.find(o => o.tipo === 'tarjeta' && o.saldo > 0)
  // Sin fin, la tabla sería de 50 años: se muestran dos para ver que el saldo no baja.
  const meses = s.terminaEn ? s.meses : s.meses.slice(0, 24)

  return (
    <main>
      <header class="cabecera">
        <h1 class="marca"><span>Tu </span><span>plan</span></h1>
        <button type="button" class="pill boton" onClick={p.volver}>Listo</button>
      </header>

      <section class="banner" aria-labelledby="t-sales">
        <Calado class="calado" />
        {s.orden.length === 0 ? (
          <>
            <h2 id="t-sales" class="banner-titulo">No tienes deudas pendientes</h2>
            <p class="nota">Cuando agregues una tarjeta o préstamo con saldo, aquí verás cuándo terminas de pagarlo.</p>
          </>
        ) : s.terminaEn ? (
          <>
            <h2 id="t-sales" class="banner-titulo">Sales de deudas en</h2>
            <p class="banner-monto plan-fecha">{mesLargo(s.terminaEn)}</p>
            <p class="nota">
              Pagando {formatear(s.presupuestoMXN)} al mes, en {s.meses.length} {s.meses.length === 1 ? 'pago' : 'pagos'}.
              {' '}Intereses en el camino: {formatear(s.interesesMXN)}.
            </p>
          </>
        ) : (
          <>
            <h2 id="t-sales" class="banner-titulo">Con estos pagos, la deuda no baja</h2>
            <p class="nota">Lo que pagas al mes ({formatear(s.presupuestoMXN)}) se va casi todo en intereses. Subir lo que destinas a deudas, aunque sea un poco, cambia la fecha.</p>
            <button type="button" class="enlace fuerte-banner" onClick={p.ajustes}>Cambiar lo que pago a deudas</button>
          </>
        )}
      </section>

      {s.orden.length > 0 && (
        <section class="pagos" aria-labelledby="t-orden">
          <h2 id="t-orden">En este orden</h2>
          <p class="nota plan-intro">Mínimos a todas; lo que sobra va a la tarjeta con la tasa más alta hasta liquidarla.</p>
          <ol>
            {s.orden.map(o => (
              <li key={o.id} class="mov">
                <span class="mov-fecha">
                  {o.liquidaEn ? <><b>{mesCorto(o.liquidaEn)}</b>{o.liquidaEn.slice(0, 4)}</> : <b>—</b>}
                </span>
                <div class="mov-texto">
                  <span class="mov-nota">{o.nombre}</span>
                  <span class="mov-detalle">
                    {o.tipo === 'prestamo' ? 'Préstamo, pago fijo' : `${o.tasaAnual}% anual`}
                    {o.id === primeraTarjeta?.id && ' · recibe el extra ahora'}
                  </span>
                </div>
                <span class="mov-monto">{enSuMoneda(o.saldo, o.moneda)}<small>debes hoy</small></span>
              </li>
            ))}
          </ol>
          {p.datos.config.presupuestoDeuda === undefined && (
            <p class="nota">
              Supone que sigues pagando lo de hoy. <button type="button" class="enlace" onClick={p.ajustes}>Pon cuánto destinas a deudas al mes</button>
            </p>
          )}
        </section>
      )}

      {meses.length > 0 && (
        <details class="tabla-plan">
          <summary>Mes por mes</summary>
          <table>
            <caption class="oculto">Pagos y saldo de todas las deudas, mes por mes</caption>
            <thead><tr><th scope="col">Mes</th><th scope="col">Pagas</th><th scope="col">Debes después</th></tr></thead>
            <tbody>
              {meses.map(m => (
                <tr key={m.mes} class={m.liquidadas.length ? 'liquida' : undefined}>
                  <th scope="row">{mesCorto(m.mes)} {m.mes.slice(2, 4)}</th>
                  <td>{formatear(m.pagoMXN)}</td>
                  <td>
                    {m.saldoMXN === 0 ? 'Nada' : formatear(m.saldoMXN)}
                    {m.liquidadas.length > 0 && <small>Liquidas {m.liquidadas.map(id => nombre.get(id)).join(' y ')}</small>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p class="nota">Es una proyección: supone los mínimos de hoy y que no agregas cargos nuevos. Se actualiza con cada pago que anotas.</p>
        </details>
      )}
    </main>
  )
}
