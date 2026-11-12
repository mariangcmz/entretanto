import { collection, deleteDoc, doc, onSnapshot, orderBy, query, setDoc, type Firestore, type Unsubscribe } from 'firebase/firestore'
import { registrar } from '../engine/bitacora'
import type { Compromiso, Config, Cuenta, Datos, Deuda, Ingreso, Movimiento } from '../engine/tipos'

// Todo vive bajo users/{uid}/. La config es un solo documento: users/{uid}/config/principal.
export type Catalogo = 'cuentas' | 'deudas' | 'compromisos' | 'ingresos'
type ItemDe<C extends Catalogo> = { cuentas: Cuenta; deudas: Deuda; compromisos: Compromiso; ingresos: Ingreso }[C]

export const CONFIG_INICIAL: Config = { tipoCambioUSD: 18 }

export function crearRepositorio(db: Firestore, uid: string) {
  const ruta = (...partes: string[]) => ['users', uid, ...partes].join('/')

  return {
    /** Escucha todo y avisa cada vez que algo cambia (también lo que se anotó sin conexión). */
    escuchar(alCambiar: (d: Datos) => void, alFallar: (e: Error) => void): Unsubscribe {
      const parcial: Partial<Datos> = {}
      const listo = () => {
        const { config, cuentas, deudas, compromisos, movimientos, ingresos } = parcial
        if (config && cuentas && deudas && compromisos && movimientos && ingresos) alCambiar({ config, cuentas, deudas, compromisos, movimientos, ingresos })
      }
      const lista = (nombre: Catalogo) =>
        onSnapshot(collection(db, ruta(nombre)), s => {
          ;(parcial as Record<Catalogo, unknown>)[nombre] = s.docs.map(d => ({ ...d.data(), id: d.id }))
          listo()
        }, alFallar)
      const subs = [
        onSnapshot(doc(db, ruta('config', 'principal')), s => {
          parcial.config = { ...CONFIG_INICIAL, ...(s.data() as Partial<Config> | undefined) }
          listo()
        }, alFallar),
        lista('cuentas'), lista('deudas'), lista('compromisos'), lista('ingresos'),
        onSnapshot(query(collection(db, ruta('movimientos')), orderBy('ts')), s => {
          // Se vuelve a congelar: la bitácora en memoria tampoco admite edición ni borrado.
          parcial.movimientos = s.docs.map(d => d.data() as Movimiento).reduce(registrar, [])
          listo()
        }, alFallar),
      ]
      return () => subs.forEach(u => u())
    },

    /** El id del documento es la claveUnica: un segundo envío sería una edición y las reglas lo rechazan. */
    registrar: (m: Movimiento) => setDoc(doc(db, ruta('movimientos', m.claveUnica)), m),

    // Documento completo, sin merge: así borrar la fecha del próximo cobro sí la borra.
    guardarConfig: (c: Config) => setDoc(doc(db, ruta('config', 'principal')), c),
    guardar: <C extends Catalogo>(cat: C, item: ItemDe<C>) => {
      const { id, ...resto } = item
      return setDoc(doc(db, ruta(cat, id)), resto)
    },
    borrar: (cat: Catalogo, id: string) => deleteDoc(doc(db, ruta(cat, id))),

    /**
     * Carga un respaldo: config y cada cuenta, deuda, pago fijo o ingreso del archivo se escriben encima (por id);
     * lo que solo existe aquí se queda. Recibe solo los movimientos nuevos: los que ya están no se pueden reescribir.
     */
    importar: (d: Datos) => {
      const cats: Catalogo[] = ['cuentas', 'deudas', 'compromisos', 'ingresos']
      return Promise.all([
        setDoc(doc(db, ruta('config', 'principal')), d.config),
        ...cats.flatMap(cat => ((d[cat] ?? []) as { id: string }[]).map(({ id, ...resto }) => setDoc(doc(db, ruta(cat, id)), resto))),
        ...d.movimientos.map(m => setDoc(doc(db, ruta('movimientos', m.claveUnica)), m)),
      ])
    },
  }
}

export type Repositorio = ReturnType<typeof crearRepositorio>
