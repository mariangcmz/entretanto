import { calcularCifras } from './cifras'
import { convertir } from './dinero'
import { pagoDelCorte, sumarDias, ultimoCorte } from './fechas'
import type { Datos, Moneda } from './tipos'

// Simulador: "¿y si compro esto?". Calcula sobre una copia con la compra anotada; los datos reales no se tocan.

export interface Compra {
  monto: number // centavos
  moneda: Moneda
  origen: string // id de la cuenta o tarjeta con la que se pagaría
  meses: number // 1 = de contado; 3, 6, 9, 12… = meses sin intereses (solo con tarjeta)
}

export interface Simulacion {
  meQuedaAntes: number
  meQuedaDespues: number
  cuotas: { fecha: string; monto: number; moneda: Moneda }[] // en la moneda de la tarjeta o cuenta
}

/** Cuotas iguales; los centavos que no se reparten parejo van en la primera. */
function repartir(monto: number, meses: number): number[] {
  const cuota = Math.floor(monto / meses)
  return Array.from({ length: meses }, (_, i) => i === 0 ? monto - cuota * (meses - 1) : cuota)
}

export function simular(d: Datos, hoy: string, c: Compra): Simulacion {
  const antes = calcularCifras(d, hoy).meQueda
  const tarjeta = d.deudas.find(t => t.id === c.origen && t.tipo === 'tarjeta')
  const cuenta = d.cuentas.find(x => x.id === c.origen)
  const moneda = tarjeta?.moneda ?? cuenta?.moneda ?? c.moneda
  const enSuMoneda = convertir(c.monto, c.moneda, moneda, d.config.tipoCambioUSD)
  const meses = tarjeta ? Math.max(1, c.meses) : 1
  const montos = repartir(enSuMoneda, meses)

  // Cada cuota entra en un estado de cuenta: la primera en el que corta después de hoy, y así cada mes.
  let fecha = hoy
  const cuotas = montos.map((monto, i) => {
    if (tarjeta?.diaCorte !== undefined && tarjeta.diaPago !== undefined) {
      const corte = i === 0 ? pagoDelCorte(ultimoCorte(hoy, tarjeta.diaCorte), tarjeta.diaCorte) : pagoDelCorte(fecha, tarjeta.diaCorte)
      fecha = corte
      return { fecha: pagoDelCorte(corte, tarjeta.diaPago), monto, moneda }
    }
    // De contado con una cuenta, o una tarjeta sin días capturados: hoy y luego cada 30 días.
    return { fecha: sumarDias(hoy, 30 * i), monto, moneda }
  })

  // La compra como un gasto más (con tarjeta, solo la primera cuota cae en el estado de cuenta que viene).
  // structuredClone: nada de la simulación llega a los datos reales, ni por referencia.
  const copia = structuredClone(d)
  copia.movimientos = [...copia.movimientos, {
    id: 'simulacion', claveUnica: 'simulacion', ts: Date.parse(`${hoy}T12:00:00`), tipo: 'gasto',
    monto: montos[0]!, moneda, cuentaId: cuenta?.id, deudaId: tarjeta?.id,
    quien: 'yo', afectaMisCifras: true, nota: 'Simulación',
  }]
  return { meQuedaAntes: antes, meQuedaDespues: calcularCifras(copia, hoy).meQueda, cuotas }
}
