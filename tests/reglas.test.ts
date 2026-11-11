import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import reglas from '../firestore.rules?raw'

// Corre contra el emulador de Firestore: `npm run test:reglas` (necesita Java).
const conEmulador = Boolean(import.meta.env.FIRESTORE_EMULATOR_HOST)

const mov = (clave: string) => ({
  id: clave, ts: 1762800000000, tipo: 'gasto', monto: 30000, moneda: 'MXN', cuentaId: 'deb',
  quien: 'yo', afectaMisCifras: true, nota: 'súper', claveUnica: clave,
})

describe.skipIf(!conEmulador)('reglas de Firestore', () => {
  let env: RulesTestEnvironment
  beforeAll(async () => {
    env = await initializeTestEnvironment({ projectId: 'demo-entretanto', firestore: { rules: reglas } })
  })
  beforeEach(() => env.clearFirestore())
  afterAll(() => env.cleanup())

  const yo = () => env.authenticatedContext('ana').firestore()

  it('la dueña crea y lee sus movimientos', async () => {
    await assertSucceeds(setDoc(doc(yo(), 'users/ana/movimientos/k1'), mov('k1')))
    await assertSucceeds(getDoc(doc(yo(), 'users/ana/movimientos/k1')))
  })

  it('(obligatoria) bloquea update y delete de movimientos', async () => {
    await setDoc(doc(yo(), 'users/ana/movimientos/k1'), mov('k1'))
    await assertFails(updateDoc(doc(yo(), 'users/ana/movimientos/k1'), { monto: 1 }))
    await assertFails(setDoc(doc(yo(), 'users/ana/movimientos/k1'), mov('k1'))) // reenviar la misma clave es una edición
    await assertFails(deleteDoc(doc(yo(), 'users/ana/movimientos/k1')))
  })

  it('el id del movimiento debe ser su claveUnica y los campos válidos', async () => {
    await assertFails(setDoc(doc(yo(), 'users/ana/movimientos/otro'), mov('k1')))
    await assertFails(setDoc(doc(yo(), 'users/ana/movimientos/k2'), { ...mov('k2'), monto: 3.5 }))
    await assertFails(setDoc(doc(yo(), 'users/ana/movimientos/k3'), { ...mov('k3'), extra: true }))
  })

  it('nadie más lee ni escribe los datos de otra persona', async () => {
    const otra = env.authenticatedContext('beto').firestore()
    const anonima = env.unauthenticatedContext().firestore()
    await env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), 'users/ana/cuentas/deb'), { nombre: 'Débito' }))
    await assertFails(getDoc(doc(otra, 'users/ana/cuentas/deb')))
    await assertFails(getDoc(doc(anonima, 'users/ana/cuentas/deb')))
    await assertFails(setDoc(doc(otra, 'users/ana/movimientos/k1'), mov('k1')))
  })

  it('cuentas, deudas, compromisos, ingresos y config sí se editan y borran', async () => {
    for (const ruta of ['cuentas/deb', 'deudas/nu', 'compromisos/inet', 'ingresos/pension', 'config/principal']) {
      const d = doc(yo(), `users/ana/${ruta}`)
      await assertSucceeds(setDoc(d, { nombre: 'x' }))
      await assertSucceeds(updateDoc(d, { nombre: 'y' }))
      await assertSucceeds(deleteDoc(d))
    }
    await assertFails(setDoc(doc(yo(), 'users/ana/inventada/x'), { a: 1 }))
  })
})
