// Aviso de privacidad, aviso de que no es asesoría financiera y la forma de reportar algo en la beta.

// Quién responde por los datos y a dónde escribir. Mientras estén vacíos, el aviso lo dice y no hay botón de reportar.
export const RESPONSABLE = 'Mariana, desarrolladora de Entretanto'
export const CONTACTO = 'compraholicamx@gmail.com'

export const reportar = () =>
  `mailto:${CONTACTO}?subject=${encodeURIComponent('Entretanto beta: algo no funciona')}&body=${encodeURIComponent(
    `Qué pasó:\n\n\nQué esperabas que pasara:\n\n\n(Para ubicar el problema: ${navigator.userAgent})`,
  )}`

export function Aviso(p: { volver: () => void }) {
  return (
    <main class="aviso-legal">
      <header class="cabecera">
        <h1 class="marca"><span>Tu </span><span>privacidad</span></h1>
        <button type="button" class="pill boton" onClick={p.volver}>Volver</button>
      </header>

      <section aria-labelledby="t-asesoria">
        <h2 id="t-asesoria">No es asesoría financiera</h2>
        <p>Entretanto hace cuentas con lo que tú anotas. No te da asesoría financiera, de crédito ni de inversión. El plan de deudas y el simulador son estimaciones: revisa siempre tus estados de cuenta.</p>
      </section>

      <section aria-labelledby="t-beta">
        <h2 id="t-beta">Es una versión beta</h2>
        <p>La app está en pruebas con pocas personas. Puede cambiar y alguna vez podrías tener que ajustar tus datos. Descarga un respaldo de vez en cuando desde Tus datos.</p>
      </section>

      <section aria-labelledby="t-privacidad">
        <h2 id="t-privacidad">Aviso de privacidad</h2>
        <p><b>Quién es responsable.</b> Entretanto es un proyecto independiente a cargo de {RESPONSABLE || '[nombre pendiente]'}. Contacto: {CONTACTO || '[correo pendiente]'}.</p>
        <p><b>Qué datos guarda.</b> Tu nombre, correo y foto de tu cuenta de Google, solo para que entres. Y lo que tú anotas: cuentas y saldos, tarjetas, préstamos, ingresos, pagos fijos y movimientos.</p>
        <p><b>Para qué.</b> Solo para calcular tus cifras, tu plan de deudas y tus simulaciones. No se venden ni se comparten, y la app no tiene publicidad ni rastreo.</p>
        <p><b>Dónde se guardan.</b> En Google Firebase, con servidores en Estados Unidos. Cada cuenta solo puede leer lo suyo. Quien administra el proyecto tiene acceso técnico a la base de datos y solo lo usa para resolver un problema que tú reportes.</p>
        <p><b>Tus derechos.</b> Puedes ver y descargar todos tus datos con el respaldo, corregirlos en Tus datos, y pedir que se borre tu cuenta o que dejen de usarse escribiendo al contacto de arriba.</p>
        <p class="nota">Última actualización: 12 de noviembre de 2026.</p>
      </section>
    </main>
  )
}
