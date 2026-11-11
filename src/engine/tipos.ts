// Todos los montos son enteros en centavos de su moneda. Fechas en ISO 'YYYY-MM-DD'.
export type Moneda = 'MXN' | 'USD'

export interface Config {
  tipoCambioUSD: number // pesos por dólar
  fechaProximoIngreso?: string
  ingresoEsperado?: number
  presupuestoDeuda?: number // pesos al mes para deudas; lo que pase de los mínimos va por avalancha
}

export interface Cuenta {
  id: string
  nombre: string
  tipo: 'efectivo' | 'debito' | 'otro'
  moneda: Moneda
  saldoInicial: number
}

export interface Deuda {
  id: string
  nombre: string
  tipo: 'tarjeta' | 'prestamo'
  moneda: Moneda
  saldoInicial: number
  tasaAnual: number
  minimo: number // del último estado de cuenta
  pagoSinIntereses?: number // del último estado de cuenta
  diaCorte?: number // 1-31, cada tarjeta el suyo; si el mes es más corto se usa su último día
  diaPago?: number // 1-31, fecha límite de pago
  ordenPlan?: number // desempata la avalancha entre tasas iguales
  pagoCompleto?: boolean // la pago completa cada mes: sale de la avalancha y aparta su pago sin intereses
}

export interface Compromiso {
  id: string
  nombre: string
  monto: number
  moneda: Moneda
  fechaVence: string
  deudaId?: string
  estado: 'pendiente' | 'cubierto'
}

export interface Movimiento {
  id: string
  ts: number
  tipo: 'ingreso' | 'gasto' | 'pago_deuda' | 'reverso' | 'ajuste'
  monto: number // positivo, salvo 'ajuste' que lleva signo
  moneda: Moneda
  cuentaId?: string
  deudaId?: string
  compromisoId?: string
  quien: 'yo' | 'pareja' | 'otro'
  afectaMisCifras: boolean
  nota: string
  reversaDe?: string
  claveUnica: string
}

export interface Datos {
  config: Config
  cuentas: Cuenta[]
  deudas: Deuda[]
  compromisos: Compromiso[]
  movimientos: Movimiento[]
}
