import { pesos } from '../engine/dinero'
import type { Datos } from '../engine/tipos'

// Solo para la Fase 1: se reemplaza por Firestore en la Fase 3.
export const datosFicticios: Datos = {
  config: { tipoCambioUSD: 18.2, fechaProximoIngreso: '2026-11-15' },
  cuentas: [
    { id: 'deb', nombre: 'Débito', tipo: 'debito', moneda: 'MXN', saldoInicial: pesos(3000) },
    { id: 'efe', nombre: 'Efectivo', tipo: 'efectivo', moneda: 'MXN', saldoInicial: pesos(450) },
    { id: 'usd', nombre: 'Dólares', tipo: 'efectivo', moneda: 'USD', saldoInicial: pesos(40) },
  ],
  deudas: [
    { id: 'tdc', nombre: 'Tarjeta azul', tipo: 'tarjeta', moneda: 'MXN', saldoInicial: pesos(8200), tasaAnual: 62, minimo: pesos(410), pagoSinIntereses: pesos(1350), diaCorte: 3, diaPago: 13 },
    { id: 'tdc2', nombre: 'Tarjeta departamental', tipo: 'tarjeta', moneda: 'MXN', saldoInicial: pesos(2600), tasaAnual: 75, minimo: pesos(220), pagoSinIntereses: pesos(640), diaCorte: 25, diaPago: 15 },
    { id: 'tdc3', nombre: 'Tarjeta oro', tipo: 'tarjeta', moneda: 'MXN', saldoInicial: pesos(4100), tasaAnual: 58, minimo: pesos(260), pagoSinIntereses: pesos(900), diaCorte: 28, diaPago: 18 },
  ],
  compromisos: [
    { id: 'inet', nombre: 'Internet', monto: pesos(850), moneda: 'MXN', fechaVence: '2026-11-12', estado: 'pendiente' },
    { id: 'luz', nombre: 'Luz', monto: pesos(380), moneda: 'MXN', fechaVence: '2026-11-22', estado: 'pendiente' },
  ],
  movimientos: [
    { id: 'm1', ts: 1, tipo: 'gasto', monto: pesos(300), moneda: 'MXN', cuentaId: 'deb', quien: 'yo', afectaMisCifras: true, nota: 'súper', claveUnica: 'k1' },
    { id: 'm2', ts: 2, tipo: 'gasto', monto: pesos(200), moneda: 'MXN', cuentaId: 'deb', quien: 'pareja', afectaMisCifras: true, nota: 'gasolina', claveUnica: 'k2' },
  ],
}
