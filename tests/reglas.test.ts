import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import reglasPublicadas from '../firestore.rules?raw'

// Corre contra el emulador de Firestore: `npm run test:reglas` (necesita Java).
const conEmulador = Boolean(import.meta.env.FIRESTORE_EMULATOR_HOST)

// Las pruebas invitan a ana@example.test (su SHA-256) en lugar de a las personas reales.
const reglas = reglasPublicadas.replace('// INVITADAS', "'ffc4b5d8fdf3544b2b24dba46e76a12a1fffb6d7561509033b0ea5eef0033eab',")

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

  const invitada = (uid: string, email: string) => env.authenticatedContext(uid, { email, email_verified: true }).firestore()
  const yo = () => invitada('ana', 'ana@example.test')

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
    const otra = invitada('beto', 'ana@example.test')
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

  it('beta cerrada: un correo sin invitación o sin verificar no lee ni escribe ni lo suyo', async () => {
    const extrana = env.authenticatedContext('eva', { email: 'eva@example.test', email_verified: true }).firestore()
    const sinVerificar = env.authenticatedContext('ana', { email: 'ana@example.test', email_verified: false }).firestore()
    await assertFails(getDoc(doc(extrana, 'users/eva/cuentas/deb')))
    await assertFails(setDoc(doc(extrana, 'users/eva/movimientos/k1'), mov('k1')))
    await assertFails(getDoc(doc(sinVerificar, 'users/ana/cuentas/deb')))
    await assertSucceeds(getDoc(doc(invitada('ana', 'ANA@example.test'), 'users/ana/cuentas/deb'))) // sin importar mayúsculas
  })
})
