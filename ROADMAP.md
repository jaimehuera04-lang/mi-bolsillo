# ROADMAP

Cada fase termina con un criterio verificable. **No se empieza una fase sin cerrar la anterior.**
Una rama por fase, un commit por tarea.

## Fase 0 — Auditoría
Leer el proyecto completo, destilar la documentación y proponer el esquema y el plan de migración.

**Terminada cuando:** se entregó la auditoría y Jaime la aprobó.

## Fase 1 — Fundación
Modelo de datos nuevo, cuentas múltiples (Cuenta RUT, corriente, vista, ahorro, efectivo,
crédito, billetera digital), movimientos con tipo ingreso / gasto / transferencia, categorías, y
migración de los datos existentes.

**Terminada cuando:** instalo la versión nueva sobre la anterior, todos mis datos antiguos
aparecen intactos, y una transferencia entre dos cuentas deja el patrimonio total sin cambios.

## Fase 2 — Compromisos  ✅ **Terminada el 2026-09-03.**
Compromisos fijos recurrentes, compras en cuotas que generan compromisos futuros, gastos
estacionales chilenos, y el cálculo del **sueldo libre** mes a mes a 12 meses.

**Terminada cuando:** la app me dice correctamente mi sueldo libre de cualquiera de los próximos
12 meses y me deja ver el desglose completo de ese número.

## Fase 3 — ¿Y SI LO PAGO EN CUOTAS? + FECHA DE LIBERACIÓN  ✅ **Terminada el 2026-09-03.**
La función estrella, determinística, sin IA. Ingreso monto y cuotas y veo el impacto mes a mes,
el mes más apretado, y al menos una alternativa concreta.

**Terminada cuando:** puedo simular una compra en cuotas, ver mis 12 meses antes y después, y la
app me ofrece una alternativa que efectivamente mejora el mes apretado.

## Fase 4 — Modo Marzo y alertas anticipadas  ✅ **Terminada el 2026-09-03.**
Calendario de estacionales chilenos, advertencia anticipada de meses críticos, ajuste de aportes
para llegar preparado.

**Terminada cuando:** en octubre la app ya me está avisando cómo viene marzo y qué puedo hacer
desde ahora.

## Fase 5 — Metas, patrimonio y salud financiera
Metas de ahorro integradas al sueldo libre, patrimonio (activos − pasivos), fondo de emergencia,
resumen mensual, detector de fugas.

**Terminada cuando:** cada recomendación responde qué detecté, por qué importa, qué puedo hacer
y qué impacto tendría.

## Fase 6 — Asistente e IA
Backend seguro (función serverless) y capa conversacional **sobre** el motor de compromisos.
Recién aquí aparece la IA, y solo interpreta resultados ya calculados.

## Fase 7 — Escalamiento
Cuentas de usuario, nube, sincronización, voz, OCR.

> **Adelantado el 2026-08-28, a pedido de Jaime.** Las cuentas de usuario y la sincronización
> con Supabase ya están hechas, fuera de orden. Nacen apagadas: sin `src/config-nube.js`
> configurado la app sigue siendo local. Ver [SUPABASE.md](SUPABASE.md).
>
> **Adelantado el 2026-09-01, a pedido de Jaime.** Se pueden adjuntar fotos y archivos a un
> movimiento, y de los archivos con texto (PDF, CSV, correos del banco) se llena el formulario
> solo. Una cartola completa abre una pantalla de revisión donde se confirma línea por línea.
> Todo determinístico y sin salir del teléfono: ver *Entradas de datos* en
> [ARQUITECTURA.md](ARQUITECTURA.md). Se prueba con `node herramientas/probar-lector.js`.
>
> **La voz se hizo el 2026-09-03** y el **OCR el 2026-09-02**, así que esta fase quedó
> cerrada. Lo que sigue diciendo el párrafo de abajo quedó viejo y se conserva solo
> como historia de por qué en su momento se descartaron.
>
> ~~Queda pendiente de esta fase: voz, y el OCR de verdad.~~ Hoy de una foto se saca la fecha
> del EXIF y el QR donde el teléfono sepa leerlo, pero el monto lo escribe la persona. Leer los
> números de una foto necesita OCR, y OCR necesita o una librería pesada en el teléfono o el
> backend de la Fase 6. Ninguna de las dos entra todavía.

> Las Fases 2, 3 y 4 se construyeron juntas el 2026-09-03, después del negocio y fuera de
> orden, porque nunca se habían hecho: los cajones estaban vacíos desde el esquema 2 y la
> app no calculaba el sueldo libre, que es su razón de existir. Ver
> [SUELDO-LIBRE.md](SUELDO-LIBRE.md).

## Fase 8 — Negocio

**Fuera del orden, a pedido de Jaime el 2026-09-02.** Una pestaña Negocio con las quince
funciones de la lista que trajo: inventario con variantes, ventas con comprobante, gastos,
cotizaciones, clientes, proveedores, equipo, catálogo, estadísticas y reportes en Excel.

Es un módulo del tamaño de una segunda app, así que se decidió antes de escribir nada:
**vive dentro de Mi Bolsillo pero con su propia contabilidad**, nace apagado, y lo único que
cruza a las finanzas personales es el retiro. Las tres funciones que otras apps venden "con
IA" se hicieron sin IA: catálogo, mejora de fotos y lectura de facturas las hace el propio
teléfono. Ver [NEGOCIO.md](NEGOCIO.md).

**Terminada cuando:** puedo vender algo desde el teléfono, la mercadería sale de la bodega
sola, me llevo el comprobante por WhatsApp, y esa venta **no** aparece en mis movimientos
personales hasta que me pago a mí mismo.

---

## Definición de "terminado"

Ninguna funcionalidad está lista hasta que:

- [ ] funciona en móvil y escritorio
- [ ] los datos persisten al cerrar y reabrir
- [ ] tiene estado vacío y manejo de error
- [ ] las acciones destructivas piden confirmación
- [ ] no genera duplicados
- [ ] no rompió nada anterior
- [ ] si tocó el esquema, la migración fue probada con datos reales
- [ ] los textos que ve el usuario cumplen las seis reglas de [VOZ.md](VOZ.md)
