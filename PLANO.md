# Entretanto — Plano

## Resumen
App web móvil (PWA) en español de México para personas que salen de deudas o viven de un ingreso al siguiente. Dice cuánto queda realmente después de apartar los pagos, lleva el plan de salida de deudas y guarda una bitácora que no se puede alterar sin dejar rastro. Primero para una usuaria (la autora); diseñada para venderse después, con una cuenta por persona.

Principio rector: si pide mucho esfuerzo, se deja de usar. Cada acción debe tomar el menor número de pasos posible.

## Alcance
- **v1 (imprescindible):**
  - Tres cifras en la pantalla principal: *Tengo hoy*, *Esto ya tiene dueño*, *Me queda realmente*, con la fecha del próximo ingreso y un desglose de cada una.
  - Captura en una línea de texto (monto + nota), sin categorías ni formularios largos.
  - Bitácora inmutable: cada movimiento guarda quién lo hizo, cuándo y si afecta las cifras. Las correcciones son movimientos nuevos que reversan al anterior.
  - Deudas con plan avalancha y tabla de seguimiento.
  - Simulador de compras (contado o meses sin intereses) que deja intactos los saldos reales.
  - MXN y USD, con tipo de cambio editable.
  - Respaldo (exportar e importar JSON).
- **Después (v2+):** que otra persona entre con su propio usuario a un libro compartido, chat con IA, sincronización bancaria, WhatsApp, voz, OCR, presupuestos por categoría, bola de nieve como estrategia alterna, cobro y planes de pago.
- **Fuera de alcance:** recomendaciones de crédito, asesoría financiera personalizada, inversión.

## Usuarios y recorridos
Un rol: la dueña de la cuenta. Entra con Google.

1. **Ver cuánto me queda:** abre la app → ve las tres cifras y la fecha del próximo ingreso → toca una cifra para ver el desglose.
2. **Registrar un movimiento:** escribe una línea ("gasté 300 súper") → elige si es gasto, ingreso o pago de deuda → confirma. Opcional: cambiar *quién* y *afecta mis cifras*.
3. **Anotar un cargo ajeno:** escribe la línea → marca *quién* = pareja u otro y *afecta mis cifras* = sí o no → queda en la bitácora y en el total aparte de "cargos de otras personas".
4. **Pagar una deuda:** marca el pago hecho → baja el saldo de la deuda y se cubre el compromiso → la tabla de seguimiento se actualiza.
5. **Simular una compra:** escribe el monto y si es a meses → ve cuánto te quedaría y cuándo entra cada cuota → no se guarda nada.

## Stack y herramientas
| Capa | Herramienta | Para qué |
|------|-------------|----------|
| Frontend | Vite + TypeScript + Preact | Interfaz ligera, móvil primero |
| Motor de cuentas | TypeScript puro, montos en centavos | Todas las cuentas, determinista |
| Pruebas | Vitest | Pruebas del motor y flujos |
| Login | Firebase Auth (Google) | Una cuenta por persona |
| Datos | Firestore (plan gratuito Spark) | Movimientos, deudas, compromisos |
| Hosting | Firebase Hosting | Publicar la PWA |
| PWA | vite-plugin-pwa | Instalable y funciona sin conexión básica |

Variables de entorno necesarias (solo nombres): `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`.

No se usan Cloud Functions ni IA en la v1 (requieren el plan de pago).

## Modelo de datos
Todo vive bajo `users/{uid}/`. Montos en enteros (centavos) más un campo de moneda (`MXN` o `USD`).

- **config** (un documento): `tipoCambioUSD`, `fechaProximoIngreso`, `ingresoEsperado`.
- **cuentas**: `nombre`, `tipo` (efectivo, débito, otro), `moneda`, `saldoInicial`. El saldo es el inicial más la suma de sus movimientos.
- **deudas**: `nombre`, `tipo` (tarjeta, préstamo), `moneda`, `saldoInicial`, `tasaAnual`, `minimo`, `pagoSinIntereses` (ambos del último estado de cuenta), `diaCorte`, `diaPago` (día del mes, distinto en cada tarjeta), `ordenPlan`.
- **compromisos**: `nombre`, `monto`, `moneda`, `fechaVence`, `deudaId` opcional, `estado` (pendiente o cubierto).
- **movimientos** (solo se agregan, nunca se editan ni borran): `id`, `ts`, `tipo` (ingreso, gasto, pago_deuda, reverso, ajuste), `monto`, `moneda`, `cuentaId` opcional, `deudaId` opcional, `compromisoId` opcional, `quien` (yo, pareja, otro), `afectaMisCifras` (verdadero o falso), `nota`, `reversaDe` opcional, `claveUnica`.

Reglas de Firestore: solo la dueña lee y crea sus documentos. En `movimientos`, `update` y `delete` están prohibidos.

La `claveUnica` evita que confirmar dos veces registre dos movimientos.

## Reglas de las cifras
- **Tengo hoy:** suma de cuentas líquidas (efectivo, débito, otros), con USD convertido al tipo de cambio de la configuración. Excluye líneas de crédito.
- **Esto ya tiene dueño:** compromisos pendientes vencidos o que vencen hasta la fecha del próximo ingreso, inclusive. Cada obligación cuenta una sola vez. Cada tarjeta aparta sola el pago de su último corte aunque venza después del próximo ingreso (ya se debe), con su propio día de corte y fecha límite de pago (si el mes no tiene ese día, se usa el último). Cuánto aparta lo dice el plan avalancha; descuenta lo pagado desde ese corte y muestra cuánto quedaría si se pagara el pago sin intereses.
- **Gastos con tarjeta de crédito:** no bajan *Tengo hoy*; lo gastado con cada tarjeta desde su último corte se aparta completo en *Esto ya tiene dueño* de inmediato, en su moneda convertida a MXN. Lo pagado por encima del estado de cuenta lo va cubriendo.
- **Me queda realmente:** la primera cifra menos la segunda. Si es negativa, muestra cuánto falta. Si falta la fecha del próximo ingreso, la pide antes de dar una cifra definitiva.
- Un movimiento con `afectaMisCifras = false` se registra pero no mueve saldos ni cifras.
- Los cargos de otras personas con `afectaMisCifras = true` sí mueven saldos y se muestran sumados aparte.

## Plan de deudas
Avalancha: pagar el mínimo a todas y el sobrante a la deuda con mayor tasa anual. Una tarjeta con saldo pequeño que se paga completa cada mes (sin intereses) sale del plan. El presupuesto mensual destinado a deuda es un valor configurable que sube cuando termina un préstamo con fecha fija. Ya funciona para tarjetas (`config.presupuestoDeuda`, `deuda.pagoCompleto`); falta en la Fase 4 la tabla de seguimiento y los préstamos.

## Estructura de carpetas
```
entretanto/
├── src/
│   ├── engine/      dinero, cifras, deudas, simulador (TypeScript puro)
│   ├── data/        firebase.ts y repositorio de datos
│   ├── ui/          pantallas y componentes
│   └── main.tsx
├── tests/           pruebas del motor y flujos
├── public/          manifest e íconos
├── firestore.rules
└── firebase.json
```

## Diseño
Móvil primero, una mano, cifras grandes y texto claro. Español de México, MXN, fechas locales. Tono directo, cálido y sin regaños. Contraste alto y botones grandes (accesibilidad). El detalle visual (paleta, tipografía) se define al llegar a la Fase 1.

## Plan de construcción
1. **Fase 1 — Motor y cifras** · terminado cuando: las tres cifras salen correctas con datos ficticios y pasan las pruebas obligatorias marcadas como Fase 1 (ver abajo).
2. **Fase 2 — Captura y bitácora** · terminado cuando: se registra un movimiento en una línea, la bitácora no admite edición ni borrado, y confirmar dos veces registra uno solo.
3. **Fase 3 — Login y datos en la nube** · terminado cuando: entras con Google, tus datos persisten en Firestore y las reglas bloquean `update` y `delete` de movimientos.
4. **Fase 4 — Deudas y seguimiento** · terminado cuando: el plan avalancha y la tabla de seguimiento coinciden con el cálculo de referencia.
5. **Fase 5 — Simulador y PWA** · terminado cuando: la simulación deja el estado intacto y la app se instala en el celular.

Pruebas obligatorias:
- (Fase 1) Con $3,000 y $850 apartados para internet, *Me queda realmente* es $2,150.
- (Fase 1) Pagar el internet desde esa cuenta baja el saldo a $2,150, cubre el compromiso y *Me queda realmente* sigue en $2,150.
- (Fase 5) Una simulación deja saldos y compromisos intactos.
- (Fase 2) Confirmar dos veces registra un solo movimiento.
- (Fase 1) Un movimiento con `afectaMisCifras = false` no cambia ninguna cifra.
- (Fase 1) Corregir un movimiento crea un reverso y conserva el original.

## Criterio de terminado
Abres la app y ves cuánto te queda en menos de 10 segundos, y registras un gasto en menos de 15, durante dos semanas seguidas. Sin fecha límite fija; presupuesto: $0 (plan gratuito de Firebase).

## Riesgos y decisiones
- **Decisión:** Firebase en lugar de Supabase, porque los proyectos gratuitos de Supabase ya están ocupados.
- **Decisión:** v1 sin chat con IA; evita costo de API y más fallas.
- **Decisión:** sin acceso para la pareja en la v1; solo la dueña usa la cuenta.
- **Riesgo:** datos financieros personales. Antes de comercializar, hace falta aviso de privacidad y dejar claro que la app no da asesoría financiera.
- **Riesgo:** el plan gratuito de Firebase tiene límites de lecturas diarias; sobra para una usuaria, hay que revisarlo al crecer.
- **Riesgo:** el nombre *Entretanto* no está verificado como marca; revisarlo antes de lanzar.

## Historial
- 2026-11-10 · Plano inicial (modo rápido) · construido a partir del plan de salida de deudas y el prompt previo de Compraholica IA.
- 2026-11-10 · Fase 1 · cada tarjeta lleva su propio día de corte y de pago; el motor calcula su reserva sin compromisos manuales.
- 2026-11-10 · Fase 2 · captura en una línea con tipo sugerido, bitácora congelada que solo crece, corrección con "Deshacer" (reverso) y clave única por borrador. Los datos viven en memoria hasta la Fase 3.
- 2026-11-10 · Fase 2 · los gastos pueden salir de una tarjeta (Nu, Banamex Clásica, BofA Travel Rewards y BofA Unlimited en USD) y se apartan desde ya; la captura reconoce la cuenta o tarjeta nombrada en la nota y recuerda la última tarjeta en pesos.
- 2026-11-11 · Fase 3 · proyecto Firebase `entretanto-app` (Firestore en nam5, reglas publicadas). Entrada con Google (ventana emergente; si el celular la bloquea, redirección). Datos bajo `users/{uid}/` con caché local para anotar sin señal; el id de cada movimiento es su `claveUnica`, así que un segundo envío es una edición y las reglas lo rechazan. Pantalla "Tus datos" para cobro, tipo de cambio, cuentas, tarjetas y pagos fijos; una cuenta con movimientos no se puede quitar. Se retiran los datos ficticios. Pruebas de reglas con el emulador (`npm run test:reglas`, necesita Java); desarrollo local sin tocar la nube con `npm run emuladores` + `npm run dev:emuladores`.
- 2026-11-11 · Fase 3 · publicada en https://entretanto-app.web.app. Al publicar, el login usa el propio dominio como `authDomain` (con firebaseapp.com la redirección perdía la sesión); en desarrollo se entra con ventana emergente. Requisito: `https://entretanto-app.web.app/__/auth/handler` en los URIs de redireccionamiento del cliente OAuth web (Google Cloud > Credenciales). Login por redirección probado en producción.
- 2026-11-11 · Fase 3 · por uso real: cada tarjeta aparta su estado de cuenta ya cortado aunque venza después del cobro, y el monto lo decide la avalancha (mínimos + lo que sobre del presupuesto mensual para deudas a la tasa más alta; las que se pagan completas apartan su pago sin intereses). El inicio muestra los pagos de tarjeta con su fecha límite.
