import { describe, expect, it } from 'vitest'
import { pesos } from '../src/engine/dinero'
import { aRespaldo, leerRespaldo } from '../src/engine/respaldo'
import type { Datos } from '../src/engine/tipos'

const datos: Datos = {
  config: { tipoCambioUSD: 18, presupuestoDeuda: pesos(6000) },
  cuentas: [{ id: 'deb', nombre: 'Débito', tipo: 'debito', moneda: 'MXN', saldoInicial: pesos(3000) }],
  deudas: [], compromisos: [], ingresos: [],
  movimientos: [{ id: 'k1', ts: 1, tipo: 'gasto', monto: pesos(300), moneda: 'MXN', cuentaId: 'deb', quien: 'yo', afectaMisCifras: true, nota: 'súper', claveUnica: 'k1' }],
}

describe('respaldo', () => {
  it('lo exportado se vuelve a leer igual', () => {
    expect(leerRespaldo(aRespaldo(datos, new Date(0)))).toEqual(datos)
  })

  it('rechaza archivos que no son respaldos o están dañados, con un mensaje claro', () => {
    const r = JSON.parse(aRespaldo(datos, new Date(0)))
    const con = (cambio: object) => JSON.stringify({ ...r, ...cambio })
    expect(() => leerRespaldo('no es json')).toThrow('no es un respaldo')
    expect(() => leerRespaldo(con({ app: 'otra' }))).toThrow('no es un respaldo')
    expect(() => leerRespaldo(con({ version: 99 }))).toThrow('versión más nueva')
    expect(() => leerRespaldo(con({ config: {} }))).toThrow('tipo de cambio')
    expect(() => leerRespaldo(con({ deudas: 'x' }))).toThrow('deudas')
    expect(() => leerRespaldo(con({ cuentas: [{ id: 'a' }] }))).toThrow('sin nombre')
    expect(() => leerRespaldo(con({ movimientos: [{ claveUnica: 'k', monto: 1.5 }] }))).toThrow('movimiento dañado')
  })
})
