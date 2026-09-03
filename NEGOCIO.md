# NEGOCIO — la pestaña de quien además vende algo

Mi Bolsillo es una app de finanzas **personales**. Esta pestaña es otra cosa: un
administrador de negocio chico —inventario, ventas, clientes, catálogo— metido dentro de la
misma app.

Nace **apagada**. Quien solo lleva sus finanzas no ve absolutamente ningún cambio: la pestaña
no existe hasta que se enciende en *Ajustes → ¿Vendes algo?*.

---

## La frontera, que es lo único que no se toca

> **La plata del negocio no es tu plata.**

Una venta no es un ingreso tuyo. Una compra de mercadería no es un gasto tuyo. No entran a
`movimientos`, no aparecen en Inicio y no mueven tu sueldo libre.

Lo único que cruza es el **retiro**: el día que te pagas a ti mismo. Eso crea un ingreso
personal de categoría `negocio` en la cuenta que elijas, y recién ahí esa plata cuenta.

**Por qué.** Si se mezclaran, tu sueldo libre quedaría inflado con plata que en realidad hay
que devolverle al negocio para reponer la mercadería. Es el error que quiebra almacenes: se
ve caja, se gasta, y llega el proveedor.

El retiro guarda el `id` del movimiento personal que creó (`retiro.movimientoId`). Sin ese
id, borrar un retiro dejaría un ingreso huérfano inflando el mes. `borrarRetiro()` se lleva
los dos.

---

## Las quince funciones, y cómo está hecha cada una

Las doce de la lista básica de Treinta, más las tres que allá van marcadas "con IA".

| Función | Dónde vive | Cómo |
|---|---|---|
| Registro de ventas | `datos-negocio.js` → `registrarVenta` | Pantalla *Vender*: se toca el producto, se cobra. Descuenta stock en el mismo acto. |
| Registro de gastos | `registrarCompra` | Con líneas, además repone la bodega y actualiza el costo. |
| Comprobantes | `ui/reportes.js` → `comprobante` | Papelito en pantalla, texto listo para WhatsApp, compartir o guardar. |
| Registro de inventario | `core/negocio.js` → `existencias` | El stock **no se guarda**: se calcula sumando el libro de movimientos. |
| Catálogo virtual | `ui/catalogo.js` | Un `.html` solo, con las fotos adentro, botón de WhatsApp por producto. |
| Cotizaciones ilimitadas | `guardarCotizacion` | No tocan bodega ni caja hasta que se aceptan; ahí se vuelven venta. |
| Creación de clientes | `agregarFicha('clientes')` | |
| Creación de proveedores | `agregarFicha('proveedores')` | |
| Empleados ilimitados | `agregarFicha('empleados')` | Fichas, no cuentas con clave. Ver *lo que falta*. |
| Descargar reportes | `ui/reportes.js` | Cinco planillas `.xlsx` de verdad, con gráficos. |
| Acceso a estadísticas | `ui/reportes.js` | Barras de seis meses, dona de lo más vendido, márgenes. |
| Variantes en productos | `agregarVariante` | Talla, color, sabor: cada una con su precio y su stock. |
| Uso desde el computador | ya estaba | La app corre en el navegador dentro de un marco de teléfono. |
| ✨ Sitio web "con IA" | `ui/catalogo.js` | Una plantilla con tus datos. Un catálogo no necesita un modelo: lo que lo hace útil son tus fotos y tu número. |
| ✨ Mejora de fotos "con IA" | `ui/fotos.js` | Recorte cuadrado, achique a 900 px y estirado del histograma, en canvas. Una foto de 4000×3000 y 279 KB queda de 900×900 y 23 KB. |
| ✨ Lectura de facturas "con IA" | `core/lector.js` | El lector determinístico que ya existía, apuntado al formulario de gastos. |

### Sobre las tres con ✨

Se hicieron **sin IA a propósito**, y no como consuelo. Un modelo necesita un servidor, una
API key y plata todos los meses; además obligaría a que tus facturas y tus fotos salieran del
teléfono. Lo que otras apps cobran como magia, acá son tres cosas concretas que el navegador
sabe hacer solo.

El hueco está listo: `negocio.ajustes.iaActivada` nace en `false` y es donde se enchufaría un
modelo en la Fase 6, para **redactar** descripciones de producto. Nunca para calcular
(Regla 1).

---

## Decisiones que no conviene reabrir

**El stock se calcula, no se guarda.** Cada entrada y cada salida queda anotada en
`negocio.stock` con su motivo. El número de hoy siempre se puede explicar hacia atrás, y no
hay forma de que quede descuadrado por un guardado a medias. Un conteo a mano guarda la
**diferencia**, no el número final.

**Cada venta queda fotografiada.** La línea guarda el nombre, el precio y el costo del
momento. Si mañana subes el precio, el total de un mes cerrado no cambia solo.

**Vender sin stock está permitido.** La app avisa, pero no bloquea: en el mesón a veces hay
que vender igual y cuadrar la bodega después. Bloquearlo obliga a mentirle a la app con un
cliente esperando.

**Anular no borra.** La mercadería vuelve, la venta queda marcada. Borrarla dejaría un hueco
en los folios que después nadie sabe explicar.

**Un producto ya vendido se archiva, no se borra.** Borrar un cliente **suelta** sus ventas,
no las borra: una venta sin nombre sigue siendo una venta.

**El folio sube al crear el documento, nunca al abrir el formulario.** Si subiera al abrirlo,
cada arrepentimiento dejaría un hueco en la numeración.

**Vendido y caja son números distintos.** Lo fiado se vendió pero no entró. Confundirlos es
creer que te fue bien un mes que te dejó sin plata para reponer.

---

## Cómo está armado

```
src/core/negocio.js      funciones puras: entra el negocio, sale un número
src/datos-negocio.js     la puerta: valida, llama y guarda. Acá vive el puente.
src/ui/negocio.js        las pantallas
src/ui/negocio.css       sus estilos, aparte para poder sacarlos enteros
src/ui/fotos.js          dejar presentable una foto de producto
src/ui/catalogo.js       armar el .html del catálogo
src/ui/reportes.js       estadísticas, planillas y comprobantes
```

`app.js` no sabe nada del negocio salvo cuatro cosas que le presta por `window.App`: abrir y
cerrar hojas, el mensajito, el mes en pantalla y el cambio de pestaña. Cuanto más chica sea
esa ventana, menos posibilidades hay de que un cambio en `app.js` rompa el negocio sin avisar.

**Cuatro hojas y no dieciséis.** La lista, el formulario, vender y el comprobante se rellenan
por dentro según lo que toques. Así el botón "atrás" cierra siempre una sola cosa y cada
texto vive en un solo lugar.

### Probarlo

```bash
node herramientas/probar-negocio.js        # 50 pruebas del motor
node herramientas/probar-datos-negocio.js  # 58 pruebas de la puerta y del puente
```

---

## Lo que falta

- **Empleados con acceso propio.** Hoy son fichas: sirven para saber quién vendió, no para
  que cada uno entre con su clave. Eso necesita la nube encendida y reglas RLS por negocio.
- **Varios negocios en la misma app.** El esquema guarda uno.
- **OCR de una foto de factura.** Del papel escaneado se saca el texto; de una **foto** solo
  la fecha del EXIF y el QR donde el teléfono sepa leerlo. Es la misma deuda que tiene
  Movimientos, y la salida es la misma: el OCR del propio teléfono, con *Pegar texto*.
- **IVA y documentos tributarios.** La app no emite boletas ni factura al SII. Los
  comprobantes dicen que no son documento tributario.
