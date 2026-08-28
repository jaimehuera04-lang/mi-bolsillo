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

## Fase 2 — Compromisos
Compromisos fijos recurrentes, compras en cuotas que generan compromisos futuros, gastos
estacionales chilenos, y el cálculo del **sueldo libre** mes a mes a 12 meses.

**Terminada cuando:** la app me dice correctamente mi sueldo libre de cualquiera de los próximos
12 meses y me deja ver el desglose completo de ese número.

## Fase 3 — ¿Y SI LO PAGO EN CUOTAS? + FECHA DE LIBERACIÓN
La función estrella, determinística, sin IA. Ingreso monto y cuotas y veo el impacto mes a mes,
el mes más apretado, y al menos una alternativa concreta.

**Terminada cuando:** puedo simular una compra en cuotas, ver mis 12 meses antes y después, y la
app me ofrece una alternativa que efectivamente mejora el mes apretado.

## Fase 4 — Modo Marzo y alertas anticipadas
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
> configurado la app sigue siendo local. Ver [SUPABASE.md](SUPABASE.md). Queda pendiente de
> esta fase: voz y OCR.

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
