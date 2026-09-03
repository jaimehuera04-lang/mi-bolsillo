# SUELDO LIBRE — la cifra que hace distinta a esta app

Todas las apps de finanzas muestran **lo que gastaste**. Esta muestra **lo que ya prometiste**:
la plata que todavía está en tu cuenta pero que ya no es tuya.

```
Sueldo libre de un mes
    = ingreso previsto
    − cuotas que caen ese mes
    − compromisos fijos (dividendo, isapre, internet, CAE…)
    − estacionales (marzo, permiso de circulación, el 18…)
    − lo que le prometiste a tus metas
```

Es la Fase 2, 3 y 4 del ROADMAP, construidas el **2026-09-03**. Hasta entonces los cajones
`compromisos`, `ingresosPrevistos`, `estacionales` y `simulaciones` estaban vacíos desde el
esquema 2 y nada los calculaba: la app hacía exactamente lo mismo que todas las demás.

---

## Las cuatro funciones

### 1. El número, con su desglose
Va arriba de todo en Inicio, antes que lo que gastaste. Se toca y se abre el detalle línea
por línea: cada peso comprometido tiene un nombre, una fecha y un monto.

**La cifra grande nunca se muestra sola.** Un número sin explicación es un número en el que
nadie confía, y esta app se juega entera en que la persona le crea a esta cifra.

### 2. ¿Y si lo pago en cuotas?
No responde sí o no. Dibuja tus próximos 12 meses con la compra adentro, marca el mes donde
aprieta y propone alternativas **calculadas de verdad**: cada una se simula y solo aparece si
mejora el mes más apretado. Proponer "compra en más cuotas" sin comprobar que ayuda es lo que
hace inútil a una app de finanzas.

Tres números distintos, y decir solo uno engañaría:
- `golpe` — cuánto empeora tu **peor** mes. Puede ser 0 y estar bien: significa que las
  cuotas no llegan hasta allá.
- `leSaca` — cuánto le quita al peor de los meses que la compra **sí toca**.
- `metesMesesEnRojo` — cuántos meses quedan sin cerrar **por culpa de esta compra**, separado
  de los que ya no cerraban.

`alcanza` es `true` solo si ningún mes queda en rojo. Definirlo como "no empeoró" haría que a
alguien que ya está en rojo la app le dijera que sí a todo.

### 3. Fecha de liberación
El día exacto en que terminas de pagar todo lo que debes hoy. **Cuenta solo las cuotas**: el
dividendo y la isapre no se "terminan de pagar" —son gastos de vivir— y meterlos correría la
fecha al infinito y la volvería inútil.

### 4. Modo Marzo
En Chile marzo no es una sorpresa: llega todos los años con la matrícula, los útiles y el
permiso de circulación. Lo que sorprende es llegar sin plata. La app avisa con meses de
anticipación y **con un número accionable**: cuánto guardar cada mes desde hoy para llegar
cubierto. Un aviso sin una acción al lado solo genera angustia.

`src/data/estacionales.js` trae el calendario chileno completo como plantillas. **Los montos
son sugerencias, no verdades**, y la pantalla lo dice: dependen del colegio, del auto y de la
comuna. Poner una cifra ajena como si fuera la tuya es la forma más rápida de que la persona
deje de creerle a la app.

---

## Decisiones que no conviene reabrir

**Los fijos son una REGLA, las cuotas son FILAS.** El dividendo se guarda como "todos los 5,
hasta 2038" y no como 200 filas: cambiar el monto del arriendo tiene que ser un solo cambio.
Una cuota, en cambio, es una fila con fecha y monto propios, porque la primera suele traer el
interés y porque una se puede pagar antes sin tocar las demás.

**El redondeo sobrante va a la PRIMERA cuota**, como hacen las casas comerciales. Así la suma
de las cuotas da exactamente el total; si el resto se dejara para el final, la última saldría
distinta y la persona creería que le cobraron de más.

**Terminar un compromiso no lo borra.** "Ya no pago el CAE" no significa que nunca lo pagué:
se le pone `hasta` y los meses anteriores siguen cuadrando. Además, así la app sabe que
después de esa fecha te va a sobrar esa plata.

**Borrar una cuota se lleva todas las de esa compra.** Media compra en cuotas no significa
nada y dejaría la fecha de liberación mintiendo.

**El aporte a una meta es un compromiso**, aunque sea contigo mismo. Si no se descontara, el
sueldo libre diría que tienes plata que en realidad ya destinaste. Una meta cumplida deja de
pedir aporte, y la última cuota pide solo lo que falta.

**El Modo Marzo usa la MEDIANA, no el promedio.** Un solo marzo muy malo arrastra el promedio
hacia abajo y después ningún mes parece anormal, que es justo lo contrario de lo que se busca.

**Pagar una cuota de tarjeta es una TRANSFERENCIA, no un gasto.** El gasto se contó al
comprar (Regla 8). Por eso `pagarCompromiso` acepta `comoTransferencia`.

---

## Cómo está armado

```
src/core/sueldo.js       las cuentas: funciones puras, la fecha de hoy entra como argumento
src/data/estacionales.js el calendario chileno, como datos
src/datos.js             la puerta: validar, ordenar y guardar
src/ui/sueldo.js         las pantallas
src/ui/sueldo.css        sus estilos
```

### Probarlo

```bash
node herramientas/probar-sueldo.js       # 58 pruebas del motor
node herramientas/probar-compromisos.js  # 55 de la puerta, con almacenamiento real
```

El caso de prueba es una persona chilena de verdad: sueldo de 750.000, dividendo, isapre,
plan de celular, un CAE que se termina en diciembre, un refrigerador en 12 cuotas, y marzo
con la matrícula y el permiso. Marzo queda en rojo y la app lo sabe desde octubre.

---

## Lo que falta

- **Compromisos en UF.** El dividendo de un crédito hipotecario sube con la UF y acá se
  guarda en pesos fijos. Habría que traer el valor de la UF, y eso significa internet.
- **Ingresos variables.** Quien trabaja a honorarios no tiene un monto fijo al mes; hoy hay
  que poner un promedio a mano.
- **Que las cuotas se marquen pagadas solas** al detectar el movimiento que las calza.
  `Sueldo.compromisosCumplidos()` ya sabe cuáles son; falta la pantalla que lo confirme.
