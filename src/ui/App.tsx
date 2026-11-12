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
import { Aviso, CONTACTO, reportar } from './Aviso'
import type { Catalogo } from '../data/repositorio'
import { Plan } from './Plan'
import { Simulador } from './Simulador'

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
  const [pantalla, setPantalla] = useState<'inicio' | 'ajustes' | 'plan' | 'aviso'>('inicio')
  const [abrir, setAbrir] = useState<Catalogo | undefined>(undefined) // la sección de Tus datos que abre un primer paso
  const ir = (x: typeof pantalla, cat?: Catalogo) => { setPantalla(x); setAbrir(cat); scrollTo(0, 0) }
  const alternar = (k: Cual) => setAbierta(abierta === k ? null : k)
  const proximo = c.proximoCobro
  const vacia = datos.cuentas.length === 0 && datos.deudas.length === 0
  // Cuenta nueva: sin cuándo cobras ni cuánto tienes, las cifras no dicen nada todavía.
  const pasos: { hecho: boolean; texto: string; detalle: string; cat: Catalogo }[] = [
    { hecho: Boolean(datos.ingresos?.length || datos.config.fechaProximoIngreso), texto: 'Cuándo cobras', detalle: 'Tu sueldo, pensión o lo que te entre, y cada cuánto', cat: 'ingresos' },
    { hecho: datos.cuentas.length > 0, texto: 'Cuánto tienes hoy', detalle: 'Tu cuenta de débito o tu efectivo, con su saldo', cat: 'cuentas' },
    { hecho: datos.deudas.length > 0, texto: 'Tus tarjetas y préstamos', detalle: 'Con su día de corte y de pago. Si no tienes, sáltate este', cat: 'deudas' },
  ]
  const empezando = !pasos[0]!.hecho || !pasos[1]!.hecho

  if (pantalla === 'ajustes') return <Ajustes datos={datos} repo={repo} abrir={abrir} volver={() => ir('inicio')} aviso={() => ir('aviso')} />
  if (pantalla === 'aviso') return <Aviso volver={() => ir('inicio')} />
  if (pantalla === 'plan') return <Plan datos={datos} hoy={hoy} volver={() => ir('inicio')} ajustes={() => ir('ajustes')} />

  return (
    <main>
      <header class="cabecera">
        <h1 class="marca"><span>Entre</span><span>tanto</span></h1>
        {proximo
          ? <button type="button" class="pill boton" onClick={() => ir('ajustes')}>{proximo.nombre ?? 'Cobras'} el {cobro(proximo.fecha)}</button>
          : <button type="button" class="pill boton alerta" onClick={() => ir('ajustes')}>¿Cuándo cobras?</button>}
      </header>
      {empezando ? (
        <section class="pasos" aria-labelledby="t-pasos">
          <h2 id="t-pasos">Para empezar, tres datos</h2>
          <p class="nota">Con ellos Entretanto calcula cuánto te queda de verdad. Toma un par de minutos.</p>
          <ol>
            {pasos.map(x => (
              <li key={x.cat} class={x.hecho ? 'paso hecho' : 'paso'}>
                <button type="button" onClick={() => ir('ajustes', x.cat)}>
                  <span class="paso-texto">{x.texto}<small>{x.hecho ? 'Listo' : x.detalle}</small></span>
                  <span class="paso-marca" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ol>
        </section>
      ) : !proximo && <p class="nota">Sin la fecha de tu próximo ingreso, la cifra es provisional. Agrégalo en tus datos.</p>}

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

      <PagosTarjeta pagos={c.pagos} hoy={hoy} abrir={() => ir('ajustes')} objetivo={datos.config.presupuestoDeuda ? undefined : objetivoAvalancha(datos)} plan={() => ir('plan')} />

      {/* Sin cuentas ni tarjetas no hay de dónde anotar; los primeros pasos llevan a agregarlas. */}
      {!vacia && <Captura datos={datos} registrar={alRegistrar} />}
      {!vacia && <Simulador datos={datos} hoy={hoy} />}
      <Bitacora movimientos={datos.movimientos} cuentas={[...datos.cuentas, ...datos.deudas]} deshacer={alDeshacer} />
      <nav class="pie" aria-label="Más">
        <button type="button" class="enlace" onClick={() => ir('ajustes')}>Tus ingresos, cuentas, tarjetas y pagos fijos</button>
        {CONTACTO && <a class="enlace" href={reportar()}>Reportar algo que no funciona</a>}
        <button type="button" class="enlace" onClick={() => ir('aviso')}>Privacidad · no es asesoría financiera</button>
      </nav>
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
function PagosTarjeta(p: { pagos: LineaPago[]; hoy: string; abrir: () => void; plan: () => void; objetivo?: { nombre: string; tasaAnual: number } }) {
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
      <button type="button" class="enlace fuerte" onClick={p.plan}>¿Cuándo salgo de deudas? Ver tu plan</button>
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
