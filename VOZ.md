# VOZ — cómo le habla Mi Bolsillo al usuario

Esto se trata con el mismo rigor que el código. Ninguna funcionalidad está terminada si sus
textos no cumplen las seis reglas de abajo.

## El ejemplo que resume todo

Lo que hacen otras apps:

> ⚠️ Has superado tu presupuesto de Compras en un 34%.

Lo que debe hacer Mi Bolsillo:

> Compraste las zapatillas en 6 cuotas de $13.000. Tu sueldo libre de octubre baja de $184.000
> a $171.000 — sigue cómodo. La cuota final cae en marzo, que ya venía apretado. Si prefieres,
> puedes adelantar dos cuotas en diciembre y liberarlo.

Misma información. Una reta, la otra acompaña.

---

## 1. Habla en consecuencias, nunca en juicios

Describe qué pasa con la plata, no qué tipo de persona es el usuario.

| ❌ Nunca | ✅ Así |
|---|---|
| "Te estás excediendo." | "Esto te suma 6 meses de cuotas." |
| "Gasto innecesario." | "Tu sueldo libre de marzo baja a $40.000." |
| "Deberías controlarte." | "Con esto, marzo pasa a ser tu mes más apretado del año." |

## 2. Nunca cierra una puerta sin abrir otra

Toda advertencia va acompañada de **al menos una alternativa concreta**: esperar hasta el día 5,
pagar en 6 cuotas en vez de 12, adelantar una cuota en diciembre, o bajar $20.000 de otra parte.

❌ "Marzo te queda con $40.000 libres."
✅ "Marzo te queda con $40.000 libres. Si adelantas una cuota en diciembre, sube a $95.000."

## 3. Es chilena sin ser caricatura

Entiende "8 lucas" y sabe qué es el permiso de circulación, pero no habla con "cachai" en cada
frase. Suena a un amigo que sabe de plata, no a un comercial de banco.

❌ "¡Ya po, cachai que te quedaste sin lucas!"
❌ "Optimiza tu flujo de caja mensual con nuestra herramienta de presupuestación."
✅ "En marzo se te juntan la matrícula y el permiso de circulación. Son $280.000 el mismo mes."

## 4. El silencio es una función

Si no tiene algo útil que decir, no dice nada. Cero notificaciones de relleno. **Máximo una
alerta relevante por semana**, salvo emergencia real de liquidez.

❌ "¡No olvides registrar tus gastos de hoy!"
❌ "Llevas 3 días sin abrir la app."
✅ (nada)

## 5. Muestra de dónde salió cada número

Toda proyección se rotula como estimación, nunca como garantía, y se puede desglosar línea por línea.

❌ "Vas a tener $184.000 libres en septiembre."
✅ "Estimamos $184.000 libres en septiembre. Esto asume que tu sueldo se mantiene y que gastas
parecido a los últimos 3 meses. Ver el desglose."

## 6. Celebra lo que corresponde, sin inflar

Terminar de pagar una deuda o adelantar la fecha de liberación se reconoce. Registrar un gasto
no es un logro.

❌ "🎉 ¡Genial! Registraste un gasto. ¡Sigue así!"
✅ "Pagaste la última cuota del refrigerador. Tu fecha de liberación se adelantó de agosto a junio."

## 7. Se escribe bien

Tildes y eñes, siempre. Un "Cuanto necesitas juntar?" es una app a medio hacer, y se nota
antes que cualquier otra cosa. Las preguntas llevan sus dos signos: `¿…?`. Esto vale
igual para los comentarios del código, porque Jaime los lee.

❌ "Que tipo de cuenta es?" · "Durante (anos)" · "Tecnicas de ahorro"
✅ "¿Qué tipo de cuenta es?" · "Durante (años)" · "Técnicas de ahorro"

Cuidado con las que cambian de significado: *esta* cuenta / la memoria *está* llena;
*que* funciona / por *qué* funciona; una cifra *seria* / *sería* un número sin sentido.
Y nunca acentuar un nombre del programa: la clase CSS `pestanas-grafico` y la clave
`categoria` se quedan como están.

---

## Lista de chequeo antes de publicar cualquier texto

- [ ] ¿Describe una consecuencia, no un juicio?
- [ ] Si es una advertencia, ¿ofrece una salida concreta?
- [ ] ¿Suena a persona chilena que sabe de plata, no a banco ni a meme?
- [ ] ¿Vale la pena interrumpir al usuario con esto?
- [ ] Si es una proyección, ¿dice en qué se basa y que es una estimación?
- [ ] Si celebra, ¿celebra un logro real?
- [ ] ¿Tildes, eñes y signos `¿?` en su lugar?
