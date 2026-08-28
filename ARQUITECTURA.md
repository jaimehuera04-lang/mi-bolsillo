# ARQUITECTURA

## Capas

```
  Interfaz (DOM, eventos, gráficos SVG)
        ↑ recibe resultados ya calculados
  Motor financiero  /src/core   ← funciones puras, sin DOM, sin storage
        ↑ recibe el estado
  Persistencia  /src/storage    ← localStorage + migraciones + respaldo
```

Regla que ordena todo lo demás: **el núcleo no sabe que existe una pantalla, y la pantalla no
sabe hacer cuentas.** Si un cálculo financiero está dentro de una función que también escribe
HTML, está en el lugar equivocado.

Meta de estructura (se llega ahí por fases, no de un salto):

```
/src/core       calculos puros: sueldoLibre, compromisos, simulador, liberacion
/src/storage    esquema, migraciones, respaldo, import/export, nube
/src/ui         pantallas, componentes, gráficos, diálogos propios, planilla Excel
/src/data       categorías, calendario estacional chileno
```

## Reglas técnicas no negociables

1. **La IA nunca calcula.** Flujo: datos → motor → resultados → IA solo redacta.
2. **Los compromisos son entidad de primera clase**, no un tipo de movimiento.
3. **Montos en enteros.** Pesos chilenos enteros, nunca float. Formatear es presentación.
4. **Fechas ISO** `AAAA-MM-DD`, comparadas en la zona horaria local del usuario. Nunca
   `new Date('2026-03-01')` a secas: eso se interpreta en UTC y corre el día.
5. **El núcleo se separa de la interfaz.** Funciones puras, testeables sin navegador.
6. **Almacenamiento versionado** con `schemaVersion` y migraciones explícitas.
7. **Las transferencias no son ingresos ni gastos.** Mueven plata entre cuentas del mismo
   usuario y dejan el patrimonio total igual.
8. **Gasto con tarjeta ≠ pago de tarjeta.** El gasto se contabiliza al comprar; el pago de la
   tarjeta es una transferencia. Contar los dos como gasto duplica el monto.
9. **Sin secretos en el frontend.** Ninguna API key ni token en el cliente ni en el repositorio.
10. **Esto es una app, no una página.** Ver la sección siguiente. Todo lo que delate al
    navegador se considera un error, no un detalle estético.

## La cáscara de app

Mi Bolsillo se instala en el teléfono y tiene que comportarse como cualquier otra app de ahí.
Lo que sigue no es decoración: cada punto tapa una filtración concreta del navegador.

| Regla | Qué tapa |
|---|---|
| **Nunca `alert`, `confirm` ni `prompt`.** Se usa `Dialogos` (`/src/ui/dialogos.js`). | Los diálogos del navegador salen rotulados con el dominio: *"jaimehuera04-lang.github.io dice:"*. |
| **El documento no hace scroll.** `html, body { overflow: hidden }` y un único contenedor `#contenido` que sí scrollea, dentro del marco `.app`. | El rebote elástico al llegar al final y el gesto de "deslizar para recargar" de Android. |
| **El botón atrás del teléfono cierra capas.** Cada hoja o diálogo empuja una entrada de historial; `popstate` cierra la de más arriba, después vuelve a Inicio, y recién entonces sale. | Que "atrás" te expulse de la app apenas tienes algo abierto. |
| **No se selecciona el texto de la interfaz** (`user-select: none`, `-webkit-touch-callout: none`), salvo en los campos. | El resaltado azul y el menú de "copiar / compartir" al dejar el dedo apretado. |
| **Hay pantalla de arranque**, con estilos críticos escritos dentro de `index.html`. | El parpadeo blanco de "página cargando" al abrir. |
| **Las hojas se deslizan** al entrar y al salir, y se cierran arrastrándolas hacia abajo. | Ventanas que aparecen y desaparecen de golpe. |
| **Las ventanas de `Dialogos` van en `z-index: 120`**, sobre la bienvenida (100) y los avisos en 130. | Una ventana por debajo de la bienvenida es invisible e intocable: la app queda esperando para siempre un toque imposible. Pasó de verdad. |
| **En el computador la app se dibuja dentro de un marco de teléfono**, no estirada a todo el ancho. | Que en pantalla grande parezca una sección de un sitio web. |
| **El teclado no tapa los campos**: `interactive-widget=resizes-content` más `scrollIntoView` al enfocar. | Efecto secundario del marco fijo; sin esto el marco fijo sería peor que el scroll de documento. |

Al tocar `index.html`, `estilos.css`, `app.js` o `dialogos.js` hay que subir `VERSION` en `sw.js`,
o el teléfono sigue mostrando la copia guardada anterior.

## Salidas de datos

Son dos, y no hay que confundirlas:

| | Qué es | Para qué | La app la vuelve a leer |
|---|---|---|---|
| **`.json`** (Ajustes → Descargar) | copia fiel del objeto guardado, con `schemaVersion` | respaldar y restaurar | **sí**, con Restaurar |
| **`.xlsx` completo** (Ajustes → Descargar en Excel) | siete hojas con gráficos: portada, movimientos, gastos por categoría, cuentas, metas, topes y resumen mensual | mirar, hacer cuentas aparte, mandársela a alguien | **no**, es de ida |
| **`.xlsx` del mes** (el 📊 del selector de mes) | el cierre de un mes: análisis con su aspecto a mejorar, categorías, movimientos y comparación | revisar cómo cerró el mes | **no**, es de ida |

`/src/ui/excel.js` escribe el `.xlsx` a mano, sin librerías: un `.xlsx` es un ZIP con XML
adentro, así que el archivo arma el ZIP byte a byte (método *store*, sin comprimir) y genera
el XML de cada hoja. Da montos con formato de pesos, fechas de verdad y porcentajes, no texto.
Bajar una librería de cientos de kilobytes para esto habría roto la regla de "sin librerías
ni compilación".

### Los gráficos dentro del .xlsx

Un gráfico son tres archivos que se apuntan entre sí: la hoja apunta a un *dibujo*, el dibujo
dice en qué celdas queda pegado, y adentro va el gráfico, que **no guarda los números sino que
apunta al rango de celdas**. Por eso, si editas la tabla en Excel, el gráfico se actualiza
solo. Hay dos tipos: `dona` (con el porcentaje sobre cada trozo, y el color de cada categoría
tomado de `categorias.js`, para que calce con la app) y `barras`.

El orden de los elementos dentro del XML de una hoja lo exige el formato y no se puede mover:
`dimension`, `sheetViews`, `sheetFormatPr`, `cols`, `sheetData`, `autoFilter`, `mergeCells`,
`drawing`. Si se altera, Excel dice que el archivo está dañado.

### El análisis del mes

Sale del 📊 que está en el selector de mes, junto al mes al que pertenece. Su hoja *Análisis*
trae cómo cerró el mes, la comparación con el anterior, el reparto 50/30/20 y un **aspecto a
mejorar**.

Ese aspecto **no se inventa**: es la primera alerta de `Datos.sugerir()`, el mismo motor
determinístico que alimenta los consejos de Inicio. Si el mes no dejó ninguna alerta, en vez de
decir "todo bien" se elige el grupo del reparto que más se alejó de su ideal y se dice con los
números del motor (`mejorarDesdeElReparto`). Siempre con una salida concreta, como manda
[VOZ.md](VOZ.md). Cuando el mes anterior no tiene nada anotado, la comparación muestra una raya
y no un 0%, que parecería un dato.

## La nube

`/src/storage/nube.js` habla con Supabase por `fetch` pelado, sin su SDK. Se guarda **el objeto
completo** en una fila por persona (`estados`), igual que el respaldo `.json`: así las
migraciones siguen sirviendo tal cual. Los pasos para encenderla están en
[SUPABASE.md](SUPABASE.md).

Cuatro decisiones que conviene no reabrir:

1. **El teléfono manda para lo inmediato.** Se guarda primero en `localStorage` y la pantalla
   responde; la subida va después, sin bloquear. Sin señal queda pendiente y sube sola.
2. **Nace apagada.** Sin conexión configurada no hay cuenta, ni contraseña, ni nada que
   sincronizar, y la app es exactamente la de antes. La conexión puede venir de dos lados y en
   este orden: lo que la persona pegó en *Ajustes → Conectar tu nube* (guardado en su teléfono),
   o `src/config-nube.js`. Lo primero manda sobre lo segundo. Antes de guardarla, la app la
   prueba de verdad contra Supabase y distingue "la llave no sirve" de "falta crear la tabla".
3. **Ante un choque, no elige sola.** Se guarda una marca del último momento en que los dos
   lados coincidieron. Si al abrir los dos cambiaron desde entonces, la app dice cuántos
   movimientos hay en cada lado y decide la persona.
4. **El service worker no toca lo que no es nuestro.** Solo atiende peticiones del propio
   origen. Cuando atendía todo, respondía las consultas a la nube con una copia guardada, la
   app creía que la nube estaba vacía y le pasaba por encima. Ese bug costó datos en las
   pruebas; la guarda está en `sw.js` y no hay que quitarla.

## Modelo de datos

Objeto raíz único en `localStorage`.

```js
{
  meta: {
    schemaVersion: 2,
    creado: '2026-08-20',
    ultimoRespaldo: '2026-08-24'
  },

  cuentas: [{
    id, nombre,
    tipo,            // 'cuenta_rut' | 'corriente' | 'vista' | 'ahorro' | 'efectivo'
                     // | 'credito' | 'billetera'   (MACH, Tenpo, BE Pay, Mercado Pago)
    saldoInicial,    // entero CLP; en tarjetas de crédito la deuda va negativa
    icono, activa, fechaCreacion
  }],

  movimientos: [{
    id,
    tipo,            // 'ingreso' | 'gasto' | 'transferencia'
    monto,           // entero CLP, siempre positivo
    fecha,           // 'AAAA-MM-DD'
    categoria, subcategoria,
    cuentaOrigen,    // gasto y transferencia
    cuentaDestino,   // ingreso y transferencia
    descripcion, nota, etiquetas: [],
    compromisoId     // si este movimiento pagó una cuota concreta
  }],

  compromisos: [{
    id, nombre,
    tipo,            // 'cuota' | 'fijo' | 'estacional'
    montoCuota,      // entero CLP
    fechaVencimiento,
    cuotaNumero, cuotasTotales,   // 3 de 12
    compraId,        // agrupa las 12 cuotas de una misma compra
    tarjeta,         // 'CMR' | 'Ripley' | ...
    categoria, cuenta,
    estado,          // 'pendiente' | 'pagado'
    interes          // entero CLP total, o 0 si fue sin interés
  }],

  ingresosPrevistos: [{ id, nombre, monto, frecuencia, diaDelMes, activo }],
  estacionales:      [{ id, nombre, mes, montoEstimado, recurrenciaAnual }],
  metas:             [{ id, nombre, montoObjetivo, montoActual, fechaObjetivo, aporteMensual, cuenta }],
  simulaciones:      [{ id, descripcion, monto, cuotas, fecha, resultado }],

  presupuestos: { comida: 130000 },   // secundario, no es el corazón de la app
  ajustes:      { correo, nombre, ingresoEsperado, iaActivada: false }
}
```

### Por qué el saldo no se guarda

Las cuentas guardan `saldoInicial`, no el saldo de hoy. El saldo actual se calcula sumando los
movimientos sobre ese punto de partida (`Calculos.saldoDeCuenta`).

Un saldo guardado se desincroniza apenas se borra o edita un movimiento viejo, y a partir de ahí
la app muestra un número que nadie puede explicar. Uno calculado no puede mentir: si el saldo está
mal, el error está en algún movimiento y se puede ir a buscar.

### Por qué una compra en cuotas se guarda así

Comprar zapatillas a $78.000 en 6 cuotas genera **un movimiento y seis compromisos**, todos con
el mismo `compraId`:

- 1 movimiento de tipo `gasto` con fecha de hoy, categoría ropa, cuenta = la tarjeta.
- 6 compromisos de tipo `cuota`, $13.000 cada uno, con `fechaVencimiento` en meses distintos
  y `cuotaNumero` 1 a 6.

Cuando el usuario paga la cuota 1, ese pago es una **transferencia** desde su cuenta hacia la
tarjeta, y el compromiso pasa a `pagado` con su `compromisoId` apuntando al movimiento. Así
nunca se cuenta dos veces el mismo peso, y el motor puede responder "cuánto debo en marzo"
mirando solo compromisos pendientes.

## Motor de compromisos

Debe poder responder todo esto **sin IA**, con funciones puras y desglosables:

- ¿Cuánto de mi ingreso de un mes determinado ya está comprometido?
- ¿Cuál es mi sueldo libre mes a mes en los próximos 12 meses?
- ¿Qué mes de los próximos 12 es el más apretado y por qué?
- Si agrego una compra de $X en N cuotas, ¿cómo cambia cada uno de esos 12 meses?
- ¿En qué fecha termino de pagar todo lo que debo hoy? (fecha de liberación)
- ¿Qué pasa si adelanto cuotas en un mes específico?

Fórmula base:

```
sueldo libre = ingresos previstos del mes
             − cuotas que vencen ese mes
             − compromisos fijos del mes
             − gastos estacionales previstos del mes
             − aporte a metas del mes
```

Todo resultado debe poder desglosarse línea por línea para que el usuario vea de dónde salió
cada peso. Un número sin desglose no cumple la regla 5 de [VOZ.md](VOZ.md).

## Persistencia y migraciones

- Una sola llave en `localStorage`: **`mi-bolsillo`**. La versión vive dentro del objeto, no en el
  nombre de la llave — poner "v1" en el nombre invita a crear otra llave en vez de migrar.
  `mi-bolsillo-v1` es la llave del esquema 1 y solo se lee; `mi-bolsillo:respaldo` guarda la copia
  previa a la última migración.
- Objeto raíz versionado con `meta.schemaVersion`.
- Cada salto de esquema es una función explícita `migrate_1_to_2(estado)`, aplicadas en cadena.
- **Antes de migrar, la app genera automáticamente una copia de seguridad exportable** con el
  esquema anterior intacto. Si la migración falla, se restaura esa copia y no se pierde nada.
- El import de un respaldo pasa por la misma cadena de migraciones que los datos locales.

## Privacidad e IA — decisión ya tomada

- **Por defecto todo es local.** La app funciona completa y sin internet, sin enviar un dato a
  ningún servidor. Esto es propuesta de valor, no detalle técnico: el usuario objetivo no le va
  a entregar sus datos bancarios a una app desconocida.
- **La IA es opcional**, con un interruptor visible **apagado de fábrica**.
- **Cuando esté activada, solo salen datos agregados y anonimizados**: montos por categoría,
  totales, saldos, fechas de compromisos. **Nunca** descripciones libres, notas, nombres de
  cuentas ni etiquetas escritas por el usuario.
- **La llamada pasa siempre por un backend propio** (función serverless mínima), nunca directo
  desde el navegador. Ese backend no existe hasta la Fase 6.
- Antes de la primera llamada, la app muestra exactamente qué se envía y pide consentimiento.

Consecuencia: **de la Fase 0 a la Fase 5 no se usa IA en absoluto.** Todo el valor del producto,
incluida la función estrella, se construye con lógica determinística.

## Distribución

PWA servida por GitHub Pages. `sw.js` cachea la app para que abra sin internet; su constante
`VERSION` debe subir en cada release o el celular sigue mostrando la copia vieja.
