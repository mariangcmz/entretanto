import type { ComponentChildren } from 'preact'
import { useState } from 'preact/hooks'
import { registrar, reversar } from '../engine/bitacora'
import { calcularCifras } from '../engine/cifras'
import { formatear, formatearFecha } from '../engine/dinero'
import type { Datos, Movimiento } from '../engine/tipos'
import { Bitacora } from './Bitacora'
import { Captura } from './Captura'
import { datosFicticios } from './datosFicticios'

const hoyISO = () => new Date().toLocaleDateString('en-CA') // YYYY-MM-DD en hora local

type Cual = 'tengo' | 'dueno' | 'queda'

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
      <p class="ingreso">
        {fecha ? <>Próximo ingreso: <strong>{formatearFecha(fecha)}</strong></> : <strong>¿Cuándo te vuelve a entrar dinero? Sin esa fecha la cifra es provisional.</strong>}
      </p>

      <Cifra id="tengo" titulo="Tengo hoy" monto={c.tengoHoy} abierta={abierta} alternar={alternar}>
        {c.desglose.cuentas.map(x => <Linea izq={x.nombre} der={formatear(x.saldoMXN)} />)}
      </Cifra>

      <Cifra id="dueno" titulo="Esto ya tiene dueño" monto={c.tieneDueno} abierta={abierta} alternar={alternar}>
        {c.desglose.apartados.length === 0 && <p class="nota">Nada apartado hasta tu próximo ingreso.</p>}
        {c.desglose.apartados.map(a => (
          <Linea izq={`${a.nombre} · ${a.fechaVence < hoy ? 'venció' : 'vence'} ${formatearFecha(a.fechaVence)}`} der={formatear(a.montoMXN)} />
        ))}
      </Cifra>

      <Cifra id="queda" titulo="Me queda realmente" monto={c.meQueda} abierta={abierta} alternar={alternar} principal>
        {c.falta > 0
          ? <p class="nota">Te faltan {formatear(c.falta)} para cubrir lo apartado.</p>
          : <p class="nota">Lo que tienes hoy menos lo que ya tiene dueño.</p>}
        {c.cargosAjenos > 0 && <p class="nota">Cargos de otras personas que te afectan: {formatear(c.cargosAjenos)}.</p>}
        {c.meQuedaSiPagoSinIntereses !== c.meQueda && (
          <p class="nota">Si pagas las tarjetas completas para no generar intereses: {formatear(c.meQuedaSiPagoSinIntereses)}.</p>
        )}
      </Cifra>

      <Captura datos={datos} registrar={alRegistrar} />
      <Bitacora movimientos={datos.movimientos} cuentas={[...datos.cuentas, ...datos.deudas]} deshacer={alDeshacer} />
    </main>
  )
}

function Cifra(p: { id: Cual; titulo: string; monto: number; abierta: Cual | null; alternar: (k: Cual) => void; principal?: boolean; children: ComponentChildren }) {
  const abierta = p.abierta === p.id
  return (
    <section class={p.principal ? 'cifra principal' : 'cifra'}>
      <button aria-expanded={abierta} aria-controls={`d-${p.id}`} onClick={() => p.alternar(p.id)}>
        <span class="titulo">{p.titulo}</span>
        <span class={p.monto < 0 ? 'monto negativo' : 'monto'}>{formatear(p.monto)}</span>
      </button>
      <div id={`d-${p.id}`} class="desglose" hidden={!abierta}>{p.children}</div>
    </section>
  )
}

const Linea = (p: { izq: string; der: string }) => (
  <p class="linea"><span>{p.izq}</span><span>{p.der}</span></p>
)
