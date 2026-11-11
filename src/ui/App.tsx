import type { ComponentChildren } from 'preact'
import { useState } from 'preact/hooks'
import type { Repositorio } from '../data/repositorio'
import { reversar } from '../engine/bitacora'
import { calcularCifras, type LineaPago } from '../engine/cifras'
import { formatear, formatearFecha } from '../engine/dinero'
import type { Datos, Movimiento } from '../engine/tipos'
import { Bitacora } from './Bitacora'
import { Calado } from './Calado'
import { Captura } from './Captura'
import { Ajustes } from './Ajustes'

const cobro = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric' }).replace(',', '')
const hoyISO = () => new Date().toLocaleDateString('en-CA') // YYYY-MM-DD en hora local

type Cual = 'tengo' | 'dueno'

export function App({ datos, repo }: { datos: Datos; repo: Repositorio }) {
  // Sin await: Firestore lo pinta al instante desde su caché y lo sube cuando hay señal.
  // Si el mismo movimiento llega dos veces, las reglas rechazan el segundo (sería una edición); no hay nada que avisar.
  const alRegistrar = (m: Movimiento) => { repo.registrar(m).catch(() => {}) }
  const alDeshacer = (id: string) => {
    const movs = reversar(datos.movimientos, id, Date.now())
    if (movs !== datos.movimientos) alRegistrar(movs[movs.length - 1]!)
  }
  const hoy = hoyISO()
  const c = calcularCifras(datos, hoy)
  const [abierta, setAbierta] = useState<Cual | null>(null)
  const [ajustes, setAjustes] = useState(false)
  const alternar = (k: Cual) => setAbierta(abierta === k ? null : k)
  const proximo = c.proximoCobro
  const vacia = datos.cuentas.length === 0 && datos.deudas.length === 0

  if (ajustes) return <Ajustes datos={datos} repo={repo} volver={() => { setAjustes(false); scrollTo(0, 0) }} />

  return (
    <main>
      <header class="cabecera">
        <h1 class="marca"><span>Entre</span><span>tanto</span></h1>
        {proximo
          ? <button type="button" class="pill boton" onClick={() => setAjustes(true)}>{proximo.nombre ?? 'Cobras'} el {cobro(proximo.fecha)}</button>
          : <button type="button" class="pill boton alerta" onClick={() => setAjustes(true)}>¿Cuándo cobras?</button>}
      </header>
      {!proximo && <p class="nota">Sin la fecha de tu próximo ingreso, la cifra es provisional. Agrégalo en tus datos.</p>}

      <section class="banner" aria-labelledby="t-queda">
        <Calado class="calado" />
        <h2 id="t-queda" class="banner-titulo">Me queda realmente</h2>
        <p class={c.meQueda < 0 ? 'banner-monto negativo' : 'banner-monto'}>{formatear(c.meQueda)}</p>
        <Barra apartados={c.desglose.apartados} libre={c.meQueda} />

        <Cifra id="tengo" titulo="Tengo hoy" monto={c.tengoHoy} abierta={abierta} alternar={alternar}>
          {c.desglose.cuentas.map(x => <Linea izq={x.nombre} der={formatear(x.saldoMXN)} />)}
        </Cifra>
        <Cifra id="dueno" titulo="Ya tiene dueño" monto={c.tieneDueno} abierta={abierta} alternar={alternar} marca>
          {!c.desglose.apartados.some(a => a.montoMXN > 0) && <p class="nota">Nada apartado hasta tu próximo ingreso.</p>}
          {c.desglose.apartados.filter(a => a.montoMXN > 0).map(a => (
            <Linea izq={a.nombre} sub={`${a.fechaVence < hoy ? 'Venció' : 'Vence'} el ${formatearFecha(a.fechaVence).replace(',', '')}`} der={formatear(a.montoMXN)} />
          ))}
        </Cifra>

        {c.falta > 0 && <p class="nota">Te faltan {formatear(c.falta)} para cubrir lo apartado.</p>}
        {c.cargosAjenos > 0 && <p class="nota">Cargos de otras personas que te afectan: {formatear(c.cargosAjenos)}.</p>}
        {c.meQuedaSiPagoSinIntereses !== c.meQueda && (
          <p class="nota">Si pagas las tarjetas completas para no generar intereses: {formatear(c.meQuedaSiPagoSinIntereses)}.</p>
        )}
      </section>

      <PagosTarjeta pagos={c.pagos} hoy={hoy} abrir={() => setAjustes(true)} objetivo={datos.config.presupuestoDeuda ? undefined : objetivoAvalancha(datos)} />

      {vacia
        ? <button type="button" class="registrar" onClick={() => setAjustes(true)}>Agrega tus cuentas y tarjetas para empezar</button>
        : <Captura datos={datos} registrar={alRegistrar} />}
      <Bitacora movimientos={datos.movimientos} cuentas={[...datos.cuentas, ...datos.deudas]} deshacer={alDeshacer} />
      <button type="button" class="enlace" onClick={() => setAjustes(true)}>Tus ingresos, cuentas, tarjetas y pagos fijos</button>
    </main>
  )
}

/** Sin presupuesto fijo, lo que se pueda meter de más va a la tarjeta con la tasa más alta (avalancha). */
const objetivoAvalancha = (d: Datos) =>
  d.deudas.filter(t => t.tipo === 'tarjeta' && !t.pagoCompleto && t.saldoInicial > 0).sort((a, b) => b.tasaAnual - a.tasaAnual)[0]

// Dólares con su etiqueta para que no se confundan con pesos: "USD 35.00".
const enSuMoneda = (centavos: number, moneda: 'MXN' | 'USD') => moneda === 'USD' ? `USD ${(centavos / 100).toLocaleString('es-MX', { minimumFractionDigits: 2 })}` : formatear(centavos)

const corto = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }).replace('.', '')

/** Cada tarjeta y préstamo con su siguiente fecha límite y qué toca hacer: siempre a la vista en el inicio. */
function PagosTarjeta(p: { pagos: LineaPago[]; hoy: string; abrir: () => void; objetivo?: { nombre: string; tasaAnual: number } }) {
  if (p.pagos.length === 0) return null
  const f = (iso: string) => new Date(`${iso}T12:00:00`)
  const detalle = (a: LineaPago) => {
    if (a.estado === 'actualizar') return `Cortó el ${corto(a.corte!)}: actualiza tu mínimo y pago sin intereses`
    if (a.estado === 'por_cortar') return `Corta el ${corto(a.corte!)}`
    if (a.estado === 'cubierto') return a.monto > 0 ? `Mínimo cubierto; sin intereses faltan ${enSuMoneda(a.monto, a.moneda)}` : 'Pagado'
    return (a.fechaVence < p.hoy ? 'Ya venció' : 'Fecha límite') + (a.avalanchaMXN ? `, incluye ${formatear(a.avalanchaMXN)} extra (avalancha)` : '')
  }
  return (
    <section class="pagos" aria-labelledby="t-pagos">
      <h2 id="t-pagos">Próximos pagos</h2>
      <ol>
        {p.pagos.map(a => {
          const alerta = a.estado === 'actualizar' || (a.estado === 'pagar' && a.fechaVence < p.hoy)
          return (
            <li key={a.deudaId} class={a.estado === 'cubierto' || a.estado === 'por_cortar' ? 'mov apagado' : 'mov'}>
              <span class="mov-fecha"><b>{f(a.fechaVence).getDate()}</b>{f(a.fechaVence).toLocaleDateString('es-MX', { month: 'short' }).replace('.', '')}</span>
              <div class="mov-texto">
                <span class="mov-nota">{a.nombre}</span>
                {a.estado === 'actualizar'
                  ? <button type="button" class="enlace fuerte" onClick={p.abrir}>{detalle(a)}</button>
                  : <span class={alerta ? 'mov-detalle vencido' : 'mov-detalle'}>{detalle(a)}</span>}
              </div>
              <span class="mov-monto">
                {a.estado === 'pagar' || (a.estado === 'actualizar' && a.monto > 0) ? enSuMoneda(a.monto, a.moneda) : '—'}
                {a.moneda === 'USD' && a.monto > 0 && (a.estado === 'pagar' || a.estado === 'actualizar') && <small>≈ {formatear(a.montoMXN)}</small>}
              </span>
            </li>
          )
        })}
      </ol>
      {p.objetivo && <p class="nota">Lo que puedas meter de más, a {p.objetivo.nombre}: tiene la tasa más alta ({p.objetivo.tasaAnual}%).</p>}
    </section>
  )
}

/** Lo que tengo hoy partido en bloques: uno frambuesa por cada cosa apartada y lima para lo que queda libre. */
function Barra(p: { apartados: { nombre: string; montoMXN: number }[]; libre: number }) {
  const tengo = p.apartados.reduce((s, a) => s + a.montoMXN, 0) + Math.max(0, p.libre)
  if (tengo <= 0) return null
  return (
    <div class="barra" role="img" aria-label={`${formatear(Math.max(0, p.libre))} libres de ${formatear(tengo)}; el resto ya tiene dueño.`}>
      {p.apartados.map(a => <span key={a.nombre} class="barra-apartado" style={{ flexGrow: a.montoMXN }} />)}
      {p.libre > 0 && <span class="barra-libre" style={{ flexGrow: p.libre }} />}
    </div>
  )
}

function Cifra(p: { id: Cual; titulo: string; monto: number; abierta: Cual | null; alternar: (k: Cual) => void; marca?: boolean; children: ComponentChildren }) {
  const abierta = p.abierta === p.id
  return (
    <section class="cifra">
      <button aria-expanded={abierta} aria-controls={`d-${p.id}`} onClick={() => p.alternar(p.id)}>
        <span class="titulo">{p.marca && <i class="muestra" aria-hidden="true" />}{p.titulo}</span>
        <span class={p.monto < 0 ? 'monto negativo' : 'monto'}>{formatear(p.monto)}</span>
      </button>
      <div id={`d-${p.id}`} class="desglose" hidden={!abierta}>{p.children}</div>
    </section>
  )
}

const Linea = (p: { izq: string; der: string; sub?: string }) => (
  <p class="linea"><span>{p.izq}{p.sub && <small>{p.sub}</small>}</span><span>{p.der}</span></p>
)
