# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
La primera usuaria es la autora: vive de un ingreso al siguiente y está saliendo de deudas con cuatro tarjetas de crédito (Nu, Banamex Clásica, BofA Travel Rewards y BofA Unlimited, estas dos en USD). Después, otras personas en la misma situación, una cuenta por persona.

Usa la app en tres momentos:
- **En la calle, al pagar:** con prisa, a una mano, a veces bajo el sol; anota el gasto en segundos.
- **En la noche, revisando:** en casa, con calma y poca luz; ve cuánto le queda y planea.
- **Al cobrar o en día de pago:** cuando entra dinero o vence una tarjeta; reparte y paga.

## Product Purpose
Decir cuánto queda realmente después de apartar lo que ya tiene dueño, llevar el plan para salir de deudas y guardar una bitácora que no se puede alterar sin dejar rastro. El éxito: abrir la app y ver cuánto queda en menos de 10 segundos, y registrar un gasto en menos de 15, durante dos semanas seguidas.

## Positioning
No es un presupuesto por categorías ni un agregador bancario. Su mecanismo es una sola cuenta honesta: *Tengo hoy* menos *Esto ya tiene dueño* (compromisos y tarjetas hasta el próximo ingreso, y lo gastado con tarjeta desde ya) da *Me queda realmente*. La bitácora solo crece; corregir es agregar un reverso.

## Operating Context
- Captura en una línea de texto ("gasté 300 súper nu"), sin categorías ni formularios largos.
- Cada tarjeta tiene su propio día de corte y de pago.
- Pesos mexicanos y dólares, con tipo de cambio editable.
- PWA en el celular; login con Google y datos en Firestore (plan gratuito).

## Capabilities and Constraints
- v1: las tres cifras con desglose, captura en una línea, bitácora inmutable, plan avalancha de deudas, simulador de compras, MXN/USD y respaldo JSON. Ver PLANO.md.
- Fuera de alcance: recomendaciones de crédito, asesoría financiera, inversión.
- Presupuesto de $0: sin Cloud Functions ni IA en la v1.

## Brand Commitments
- Nombre: Entretanto (aún no verificado como marca).
- Español de México, MXN, fechas locales.
- Tono directo, cálido y sin regaños. Nunca culpa a la persona por sus deudas.

## Evidence on Hand
Desde la Fase 3 los datos son los que captura cada persona; no hay datos ficticios en el código. No hay testimonios, usuarios ni cifras reales; no inventarlos.

## Product Principles
1. Si pide mucho esfuerzo, se deja de usar: cada acción en el menor número de pasos.
2. La cifra que importa es *Me queda realmente*; todo lo demás la explica.
3. Honestidad sin culpa: mostrar lo que falta con claridad y sin regaños.
4. Nada se borra: la historia se corrige agregando, nunca editando.

## Accessibility & Inclusion
Una mano, botones grandes y contraste alto, legible bajo el sol y de noche con poca luz.
