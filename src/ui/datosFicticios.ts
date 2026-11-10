import { pesos } from '../engine/dinero'
import { registrar } from '../engine/bitacora'
import type { Datos, Movimiento } from '../engine/tipos'

const ts = (s: string) => new Date(s).getTime()

// Solo para las Fases 1 y 2: se reemplaza por Firestore en la Fase 3.
export const datosFicticios: Datos = {
  config: { tipoCambioUSD: 18.2, fechaProximoIngreso: '2026-11-15' },
  cuentas: [
    { id: 'deb', nombre: 'Débito', tipo: 'debito', moneda: 'MXN', saldoInicial: pesos(3000) },
    { id: 'efe', nombre: 'Efectivo', tipo: 'efectivo', moneda: 'MXN', saldoInicial: pesos(450) },
    { id: 'usd', nombre: 'Dólares', tipo: 'efectivo', moneda: 'USD', saldoInicial: pesos(40) },
  ],
  // Tus tarjetas reales con cifras inventadas; los saldos, mínimos y días de corte se capturan en serio en la Fase 3.
  deudas: [
    { id: 'nu', nombre: 'Nu', tipo: 'tarjeta', moneda: 'MXN', saldoInicial: pesos(8200), tasaAnual: 62, minimo: pesos(410), pagoSinIntereses: pesos(1350), diaCorte: 3, diaPago: 13 },
    { id: 'banamex', nombre: 'Banamex Clásica', tipo: 'tarjeta', moneda: 'MXN', saldoInicial: pesos(4100), tasaAnual: 58, minimo: pesos(260), pagoSinIntereses: pesos(900), diaCorte: 28, diaPago: 18 },
    { id: 'travel', nombre: 'BofA Travel Rewards', tipo: 'tarjeta', moneda: 'USD', saldoInicial: pesos(640), tasaAnual: 24, minimo: pesos(35), pagoSinIntereses: pesos(180), diaCorte: 5, diaPago: 2 },
    { id: 'unlimited', nombre: 'BofA Unlimited', tipo: 'tarjeta', moneda: 'USD', saldoInicial: pesos(310), tasaAnual: 26, minimo: pesos(25), pagoSinIntereses: pesos(95), diaCorte: 20, diaPago: 17 },
  ],
  compromisos: [
    { id: 'inet', nombre: 'Internet', monto: pesos(850), moneda: 'MXN', fechaVence: '2026-11-12', estado: 'pendiente' },
    { id: 'luz', nombre: 'Luz', monto: pesos(380), moneda: 'MXN', fechaVence: '2026-11-22', estado: 'pendiente' },
  ],
  movimientos: ([
    { id: 'm1', ts: ts('2026-11-09T13:20'), tipo: 'gasto', monto: pesos(300), moneda: 'MXN', cuentaId: 'deb', quien: 'yo', afectaMisCifras: true, nota: 'súper', claveUnica: 'k1' },
    { id: 'm2', ts: ts('2026-11-09T19:05'), tipo: 'gasto', monto: pesos(200), moneda: 'MXN', deudaId: 'nu', quien: 'pareja', afectaMisCifras: true, nota: 'gasolina', claveUnica: 'k2' },
  ] as Movimiento[]).reduce(registrar, []),
}
