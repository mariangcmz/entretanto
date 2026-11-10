import { describe, expect, it } from 'vitest'
import { fueReversado, registrar, reversar } from '../src/engine/bitacora'
import { interpretarLinea } from '../src/engine/captura'
import { calcularCifras } from '../src/engine/cifras'
import { pesos } from '../src/engine/dinero'
import type { Datos, Movimiento } from '../src/engine/tipos'

const gasto = (clave: string, monto = pesos(300)): Movimiento => ({
  id: clave, ts: 1, tipo: 'gasto', monto, moneda: 'MXN', cuentaId: 'deb',
  quien: 'yo', afectaMisCifras: true, nota: 'súper', claveUnica: clave,
})

describe('bitácora', () => {
  it('(obligatoria) confirmar dos veces registra un solo movimiento', () => {
    const m = gasto('k1')
    const una = registrar([], m)
    const dos = registrar(una, { ...m })
    expect(dos).toHaveLength(1)
    expect(dos).toBe(una)
  })

  it('no admite edición ni borrado', () => {
    const movs = registrar([], gasto('k1'))
    expect(() => { movs[0]!.monto = 1 }).toThrow(TypeError)
    expect(() => { movs.pop() }).toThrow(TypeError)
    expect(() => { movs.splice(0, 1) }).toThrow(TypeError)
    expect(movs[0]!.monto).toBe(pesos(300))
  })

  it('no la altera quien registró: copiar el objeto antes de congelarlo', () => {
    const m = gasto('k1')
    registrar([], m)
    expect(Object.isFrozen(m)).toBe(false)
  })

  it('deshacer agrega un reverso, conserva el original y tocarlo dos veces no duplica', () => {
    const d: Datos = {
      config: { tipoCambioUSD: 18 },
      cuentas: [{ id: 'deb', nombre: 'Débito', tipo: 'debito', moneda: 'MXN', saldoInicial: pesos(3000) }],
      deudas: [], compromisos: [], movimientos: registrar([], gasto('k1')),
    }
    const una = reversar(d.movimientos, 'k1', 2)
    const dos = reversar(una, 'k1', 3)
    expect(dos).toHaveLength(2)
    expect(dos[0]).toEqual(gasto('k1'))
    expect(fueReversado(dos, 'k1')).toBe(true)
    expect(calcularCifras({ ...d, movimientos: dos }, '2026-11-10').tengoHoy).toBe(pesos(3000))
    expect(reversar(dos, dos[1]!.id, 4)).toBe(dos) // un reverso no se reversa
  })
})

describe('captura en una línea', () => {
  it.each([
    ['gasté 300 súper', pesos(300), 'súper', 'gasto'],
    ['$1,250.50 farmacia', 125050, 'farmacia', 'gasto'],
    ['taxi 85.5', 8550, 'taxi', 'gasto'],
    ['me pagaron 7500 quincena', pesos(7500), 'quincena', 'ingreso'],
    ['pagué 410 tarjeta azul', pesos(410), 'tarjeta azul', 'pago_deuda'],
    ['pagué 120 de tacos', pesos(120), 'tacos', 'gasto'],
    ['ingresos de efectivo 200', pesos(200), 'ingresos de efectivo', 'ingreso'],
    ['ingreso efectivo 300', pesos(300), 'ingreso efectivo', 'ingreso'],
  ])('%s', (texto, monto, nota, tipo) => {
    expect(interpretarLinea(texto)).toEqual({ monto, nota, tipo })
  })

  it('sin monto no hay movimiento', () => {
    expect(interpretarLinea('súper')).toBeNull()
    expect(interpretarLinea('0 nada')).toBeNull()
  })
})
