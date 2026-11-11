import type { ComponentChildren } from 'preact'
import { useState } from 'preact/hooks'
import { registrar, reversar } from '../engine/bitacora'
import { calcularCifras } from '../engine/cifras'
import { formatear, formatearFecha } from '../engine/dinero'
import type { Datos, Movimiento } from '../engine/tipos'
import { Bitacora } from './Bitacora'
import { Calado } from './Calado'
import { Captura } from './Captura'
import { datosFicticios } from './datosFicticios'

const cobro = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric' }).replace(',', '')
const hoyISO = () => new Date().toLocaleDateString('en-CA') // YYYY-MM-DD en hora local

type Cual = 'tengo' | 'dueno'

export function App() {
  // shortcut: vive en memoria y se pierde al recargar; la Fase 3 lo guarda en Firestore.
  const [datos, setDatos] = useState<Datos>(datosFicticios)
  const alRegistrar = (m: Movimiento) => setDatos(d => ({ ...d, movimientos: registrar(d.movimientos, m) }))
  const alDeshacer = (id: string) => setDatos(d => ({ ...d, movimientos: reversar(d.movimientos, id, Date.now()) }))
  const hoy = hoyISO()
  const c = calcularCifras(datos, hoy)
  const [abierta, setAbierta] = useState<Cual | null>(null)
  const alternar = (k: Cual) => setAbierta(abierta === k ? null : k)
  const fecha = datos.config.fechaProximoIngreso

  return (
    <main>
      <header class="cabecera">
        <h1 class="marca"><span>Entre</span><span>tanto</span></h1>
        {fecha
          ? <p class="pill">Cobras el {cobro(fecha)}</p>
          : <p class="pill alerta">¿Cuándo cobras?</p>}
      </header>
      {!fecha && <p class="nota">Sin la fecha de tu próximo ingreso, la cifra es provisional.</p>}

      <section class="banner" aria-labelledby="t-queda">
        <Calado class="calado" />
        <h2 id="t-queda" class="banner-titulo">Me queda realmente</h2>
        <p class={c.meQueda < 0 ? 'banner-monto negativo' : 'banner-monto'}>{formatear(c.meQueda)}</p>
        <Barra apartados={c.desglose.apartados} libre={c.meQueda} />

        <Cifra id="tengo" titulo="Tengo hoy" monto={c.tengoHoy} abierta={abierta} alternar={alternar}>
          {c.desglose.cuentas.map(x => <Linea izq={x.nombre} der={formatear(x.saldoMXN)} />)}
        </Cifra>
        <Cifra id="dueno" titulo="Ya tiene dueño" monto={c.tieneDueno} abierta={abierta} alternar={alternar} marca>
          {c.desglose.apartados.length === 0 && <p class="nota">Nada apartado hasta tu próximo ingreso.</p>}
          {c.desglose.apartados.map(a => (
            <Linea izq={a.nombre} sub={`${a.fechaVence < hoy ? 'Venció' : 'Vence'} el ${formatearFecha(a.fechaVence).replace(',', '')}`} der={formatear(a.montoMXN)} />
          ))}
        </Cifra>

        {c.falta > 0 && <p class="nota">Te faltan {formatear(c.falta)} para cubrir lo apartado.</p>}
        {c.cargosAjenos > 0 && <p class="nota">Cargos de otras personas que te afectan: {formatear(c.cargosAjenos)}.</p>}
        {c.meQuedaSiPagoSinIntereses !== c.meQueda && (
          <p class="nota">Si pagas las tarjetas completas para no generar intereses: {formatear(c.meQuedaSiPagoSinIntereses)}.</p>
        )}
      </section>

      <Captura datos={datos} registrar={alRegistrar} />
      <Bitacora movimientos={datos.movimientos} cuentas={[...datos.cuentas, ...datos.deudas]} deshacer={alDeshacer} />
    </main>
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
