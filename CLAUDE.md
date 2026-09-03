# Mi Bolsillo
App web / PWA de finanzas personales para Chile (CLP). HTML, CSS y JS puro, sin build. Publicada en https://jaimehuera04-lang.github.io/mi-bolsillo/

**La idea:** otras apps muestran lo que gastaste; esta muestra **lo que ya prometiste**. La cifra central
no es el saldo, es el **sueldo libre** del mes = ingreso previsto − cuotas − compromisos fijos −
estacionales − aportes a metas. Si una función no ayuda a entender o proteger ese número, no entra.

## Reglas no negociables
1. **La IA nunca calcula.** datos → motor determinístico → resultados → la IA solo redacta. Fases 0 a 5: sin IA.
2. **Los compromisos son entidad de primera clase**, no un tipo de movimiento. Una compra en cuotas
   genera un gasto y N compromisos futuros con fecha propia.
3. **Montos en enteros.** Pesos chilenos enteros, nunca float. Formatear es presentación, jamás cálculo.
4. **Fechas ISO** (`AAAA-MM-DD`), comparadas en la zona horaria local del usuario.
5. **Núcleo separado de la interfaz.** Los cálculos viven en `/src/core`: funciones puras, sin DOM ni storage.
6. **Almacenamiento versionado.** Raíz con `schemaVersion`; cada migración es `migrate_N_to_N+1` y antes
   de correrla la app genera un respaldo exportable.
7. **Las transferencias no son ingresos ni gastos.**
8. **Gasto con tarjeta ≠ pago de tarjeta.** Nunca contabilizar dos veces.
9. **Sin secretos en el frontend.** Ninguna API key ni token en el cliente ni en el repo. La
   llave `anon` de Supabase es la excepción y no rompe la regla: es pública por diseño y sola
   no sirve. Quien protege los datos son las reglas RLS de la tabla. La `service_role` **nunca**
   entra al repositorio. Ver [SUPABASE.md](SUPABASE.md).
10. **Esto es una app, no una página web.** Nada de `alert`/`confirm`/`prompt`, el documento no
    scrollea, y el botón atrás cierra capas antes de salir. Las ocho reglas de la cáscara están
    en [ARQUITECTURA.md](ARQUITECTURA.md#la-cáscara-de-app).
11. **Se escribe con tildes y eñes**, y las preguntas llevan `¿?`. Vale también para los
    comentarios del código. Nunca en nombres del programa (clases CSS, claves, ids). Regla 7 de
    [VOZ.md](VOZ.md).
12. **Los respaldos no salen del aparato.** Las fotos y archivos adjuntos viven en IndexedDB
    (`storage/adjuntos.js`); el estado guarda solo la ficha `{ id, nombre, tipo, tamano }`. No
    suben a la nube ni entran en el `.json`: una boleta lleva el local, la tarjeta y la hora.
    Y el lector de comprobantes (`core/lector.js`) **propone y nunca anota solo**, mostrando de
    qué línea sacó cada dato. Ver *Entradas de datos* en [ARQUITECTURA.md](ARQUITECTURA.md).
13. **La plata del negocio no es tu plata.** La pestaña Negocio lleva su propia contabilidad:
    una venta NO es un ingreso tuyo y una compra de mercadería NO es un gasto tuyo. No entran
    a `movimientos` y no mueven el sueldo libre. Lo único que cruza es el **retiro**, que crea
    un ingreso personal de categoría `negocio` y guarda su `movimientoId` para poder deshacer
    los dos juntos. Si se mezclaran, el sueldo libre quedaría inflado con plata que hay que
    devolverle al negocio para reponer. Ver [NEGOCIO.md](NEGOCIO.md).

14. **La app baja UNA librería, y solo una.** El lector de texto (OCR) que convierte el
    pantallazo del banco en movimientos vive en un CDN y se baja la primera vez, con
    permiso de la persona. Es una excepción consciente a "sin librerías": leer letras de una
    imagen no se improvisa. **El OCR solo entrega texto**; quien lo entiende sigue siendo
    `core/lector.js`, que es determinístico. La imagen nunca sale del aparato. Ver
    [OCR en ARQUITECTURA.md](ARQUITECTURA.md).

15. **La voz sale del teléfono, y hay que decirlo.** El dictado lo hace el propio teléfono con
    el servicio de siempre (Google en Android, Apple en iPhone), así que la voz viaja. Es la
    única parte de la app donde eso pasa, se **avisa antes** con todas sus letras y se pregunta
    una vez. No se guarda audio. Lo que llega es texto, y quien lo entiende es `core/voz.js`,
    que son reglas del idioma —"cinco lucas" son 5.000— y no un modelo. Regla 1 intacta.

## Los demás documentos
- [PRODUCTO.md](PRODUCTO.md) — idea central, las tres funciones, no-goals, contexto chileno.
- [VOZ.md](VOZ.md) — cómo le habla la app al usuario. Es spec, no sugerencia.
- [ARQUITECTURA.md](ARQUITECTURA.md) — capas, modelo de datos, motor de compromisos, privacidad e IA.
- [ROADMAP.md](ROADMAP.md) — las fases y su criterio verificable de término.
- [LEEME.md](LEEME.md) — cómo correrla, instalarla y publicarla.
- [SUPABASE.md](SUPABASE.md) — cómo encender la nube y cómo funciona la sincronización.
- [SUELDO-LIBRE.md](SUELDO-LIBRE.md) — la cifra central, las cuotas, la fecha de liberación y el Modo Marzo.
- [NEGOCIO.md](NEGOCIO.md) — la pestaña Negocio: la frontera con lo personal y cómo está armada.

## Protocolo
Antes de codear (máx. 10 líneas): qué cambio, qué archivos, por qué, qué impacto, cómo no rompo nada.
Después: cambios, archivos, qué probé, problemas, próximo paso. Un commit por tarea, una rama por fase. Si tocas archivos cacheados, sube `VERSION` en `sw.js`.
