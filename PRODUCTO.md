# PRODUCTO — qué es Mi Bolsillo y qué no

## La idea central

Todas las apps de finanzas muestran **lo que gastaste**. Ninguna muestra **lo que ya prometiste**.

En Chile eso es lo que realmente aprieta el bolsillo: las cuotas del retail, el dividendo, la
isapre, el CAE, las suscripciones, el permiso de circulación. Plata que todavía no sale de la
cuenta pero que ya no es tuya.

**Mi Bolsillo es la app que sabe cuánta de tu plata futura ya está comprometida.**

La cifra central del producto no es el saldo. Es el **sueldo libre**:

> **Sueldo libre de septiembre: $184.000**
> De tus $650.000, $466.000 ya están comprometidos.

Todo lo demás en la aplicación existe para alimentar, explicar o proteger ese número.

## Las tres funciones que definen el producto

### A. ¿Y SI LO PAGO EN CUOTAS?
El usuario ingresa una compra y un número de cuotas. La app no responde sí o no: dibuja sus
próximos 12 meses con esa compra dentro y señala el mes donde aprieta.

### B. MODO MARZO
La app sabe que en Chile marzo existe —matrículas, útiles escolares, permiso de circulación,
contribuciones— y empieza a advertir con meses de anticipación, no cuando ya llegó.

### C. FECHA DE LIBERACIÓN
El día exacto en que el usuario termina de pagar todo lo que debe hoy. Un dato que ninguna app
entrega y que motiva más que cualquier gráfico.

## El criterio para aceptar cualquier funcionalidad

> ¿Ayuda al usuario a entender o proteger su **sueldo libre**?

Si no, no se agrega, aunque otras apps la tengan.

## Qué NO va a ser (no-goals)

Si alguna vez se pide algo de esta lista, hay que recordar que se descartó a propósito:

- **No hay conexión a bancos** ni scraping de cartolas.
- **No hay multimoneda.** Solo CLP.
- **No hay recomendaciones personalizadas de inversión.** Educación sí, asesoría no.
- **No hay cuentas de usuario ni backend** hasta la última fase.
- **No hay OCR de boletas ni entrada por voz** en este ciclo; solo se deja el modelo de datos
  preparado para que quepan más adelante.
- **No hay gamificación pesada** ni funciones sociales.
- **No hay pantallas llenas de gráficos.** Mobile first, tarjetas, jerarquía visual clara.
- **No hay presupuestos por categoría como función principal.** Existen, pero son secundarios:
  el corazón de la app son los compromisos futuros, no los topes de gasto.

## El contexto chileno que la app debe modelar

Esto no es decoración local. Es la razón de existir del producto.

**Compras en cuotas.** 3, 6, 12 o más, con o sin interés, en tarjetas de casas comerciales
(CMR Falabella, Ripley, Cencosud, La Polar) y bancarias. Una compra en cuotas **no es un gasto
de hoy**: es un gasto de hoy más N compromisos futuros.

**Compromisos fijos típicos.** Dividendo o arriendo, isapre o Fonasa, CAE, cuota del auto,
seguros, internet, plan de celular, suscripciones.

**Gastos estacionales chilenos.**

| Cuándo | Qué llega |
|---|---|
| Marzo | Matrículas, útiles, uniformes |
| Marzo / agosto | Permiso de circulación |
| Abril, junio, septiembre, noviembre | Contribuciones |
| Septiembre | Fiestas patrias |
| Diciembre | Regalos y fin de año |

**Vocabulario.** Luca, palo, quina, plata, gamba, bencina, super, feria, Cuenta RUT, cuenta
vista, BE Pay, MACH, Tenpo, Mercado Pago, CMR, transferencia. "Gasté 8 lucas" son $8.000.
"Lo saqué en 12 cuotas" debe generar automáticamente 12 compromisos.

## Cómo le habla al usuario

Está en [VOZ.md](VOZ.md) y es spec obligatoria, no una guía de estilo opcional. Ahí se decide si
la gente vuelve a abrir la app en dos semanas.
