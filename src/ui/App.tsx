import type { ComponentChildren } from 'preact'
import { useState } from 'preact/hooks'
import { calcularCifras } from '../engine/cifras'
import { formatear, formatearFecha } from '../engine/dinero'
import { datosFicticios } from './datosFicticios'

const hoyISO = () => new Date().toLocaleDateString('en-CA') // YYYY-MM-DD en hora local

type Cual = 'tengo' | 'dueno' | 'queda'

export function App() {
  const datos = datosFicticios
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
        {c.cargosAjenos > 0 && <p class="nota">Incluye {formatear(c.cargosAjenos)} en cargos de otras personas.</p>}
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
        {c.meQuedaSiPagoSinIntereses !== c.meQueda && (
          <p class="nota">Si pagas las tarjetas completas para no generar intereses: {formatear(c.meQuedaSiPagoSinIntereses)}.</p>
        )}
      </Cifra>
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
