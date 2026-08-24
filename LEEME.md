# 💚 Mi Bolsillo

App para controlar **ingresos, gastos y metas de ahorro**, con dashboard de gráficos y
una sección que te enseña técnicas de ahorro explicadas en simple.

Está pensada para usarse desde el celular y **se puede instalar como una app real**
(ícono en la pantalla de inicio, funciona sin internet).

## 🌐 App publicada

**https://jaimehuera04-lang.github.io/mi-bolsillo/**

Ese link es el que abres desde el celular para instalarla. Ver más abajo
"Cómo instalarla en el celular".

### Cómo subir cambios

Cada vez que edites algo y quieras verlo en el celular:

```bash
cd mi-bolsillo
git add -A
git commit -m "lo que cambiaste"
git push
```

En un par de minutos el link se actualiza solo.

⚠️ **Importante:** si cambiaste archivos, sube antes el número de versión en `sw.js`
(`const VERSION = 'mi-bolsillo-v1'` → `'v2'`). Si no, el celular sigue mostrando la
copia vieja que tenía guardada.

---

## 🚀 Cómo abrirla

### Opción A — desde VS Code (la más cómoda para ir editando)

1. Abre la carpeta `mi-bolsillo` en Visual Studio Code.
2. Instala la extensión **Live Server** (busca "Live Server", de Ritwick Dey).
3. Click derecho sobre `index.html` → **Open with Live Server**.
4. Se abre solo en el navegador. Cada vez que guardas un archivo, la página se recarga.

### Opción B — con Node (sin instalar nada extra)

```bash
node mi-bolsillo/herramientas/servidor.js
```

Luego abre `http://localhost:5173`.

### Opción C — doble click a `index.html`

Funciona para mirarla, pero **no** se puede instalar como app ni funciona sin internet
(los navegadores solo activan eso si la página viene de un servidor, aunque sea local).

---

## 📱 Cómo instalarla en el celular

**Ojo: esta app NO está en la App Store ni en Play Store, así que no hay nada que
"descargar".** Se instala desde el navegador, y queda igual que cualquier otra app.

### 🍎 iPhone / iPad

Tiene que ser con **Safari**. Desde Chrome de iPhone no aparece la opción.

1. Abre **Safari** y entra a `https://jaimehuera04-lang.github.io/mi-bolsillo/`
2. Toca el botón **Compartir** (el cuadrito con la flecha hacia arriba, abajo al centro)
3. Desliza hacia abajo en esa lista y toca **"Agregar a inicio"**
4. Toca **Agregar** arriba a la derecha

Listo: aparece el ícono verde en tu pantalla de inicio.

### 🤖 Android

1. Abre el link en **Chrome**
2. Menú ⋮ → **Instalar aplicación**

También aparece solo un aviso verde de "Instalar" dentro de la app.

En ambos casos queda con su ícono, se abre en pantalla completa (sin la barra del
navegador) y funciona sin internet.

---

## 🗂️ Qué hace cada archivo

```
mi-bolsillo/
├── index.html          Toda la estructura visual (las pantallas)
├── manifest.json       Datos de la app: nombre, ícono, colores
├── sw.js               Hace que funcione sin internet
├── src/
│   ├── datos.js        La puerta de entrada: lo único que la pantalla conoce
│   ├── data/           Listas fijas: categorías, tipos de cuenta, técnicas de ahorro
│   ├── core/           El motor. Funciones puras: calculan y no tocan nada más
│   │   ├── fechas.js       Días y meses en ISO, sin líos de zona horaria
│   │   ├── dinero.js       Pesos chilenos enteros y cómo se muestran
│   │   ├── calculos.js     Totales, categorías, saldos de cuentas, patrimonio
│   │   └── sugerencias.js  Mira tus números y decide qué vale la pena decir
│   ├── storage/        Guardar y leer en el dispositivo
│   │   ├── esquema.js      La forma exacta de los datos guardados
│   │   ├── migraciones.js  Cómo pasan de un esquema al siguiente sin perder nada
│   │   └── almacenamiento.js  localStorage, respaldos, importar y exportar
│   └── ui/             La pantalla
│       ├── estilos.css     Colores, tamaños, diseño
│       ├── graficos.js     Dona, barras y línea (SVG a mano, sin librerías)
│       └── app.js          Escucha los toques y decide qué se muestra
├── iconos/             Los íconos de la app
└── herramientas/
    ├── servidor.js            Servidor local para probar
    ├── probar-migracion.js    Revisa que una migración no pierda ni un peso
    └── generar-iconos.js      Vuelve a crear los íconos si cambias el color
```

La regla que ordena todo: **el motor no sabe que existe una pantalla, y la pantalla no sabe hacer
cuentas.** Los detalles están en [ARQUITECTURA.md](ARQUITECTURA.md).

**Si quieres tocar algo, empieza por aquí:**

| Quiero cambiar... | Abre este archivo | Busca |
|---|---|---|
| Los colores | `src/ui/estilos.css` | el bloque `:root` de arriba |
| Las categorías (agregar/quitar) | `src/data/categorias.js` | `GASTO` |
| Los tipos de cuenta | `src/data/categorias.js` | `TIPOS_CUENTA` |
| Los textos de las técnicas | `src/data/tecnicas.js` | `TECNICAS` |
| Los consejos automáticos | `src/core/sugerencias.js` | `function sugerir` |
| Los pasos del tutorial | `src/ui/app.js` | `const PASOS` |

⚠️ Si agregas un archivo nuevo dentro de `src/`, acuérdate de sumarlo **en dos lugares**: la lista de
`<script>` al final de `index.html` y la lista `ARCHIVOS` de `sw.js`. Si no, funciona en el computador
pero no en el celular sin internet.

---

## 🔑 El registro

La primera vez que se abre la app aparece una pantalla que pide **solo el correo
electrónico**. Al entrar, ya no vuelve a aparecer ni se muestran las instrucciones.

**Importante: esto no es una cuenta de verdad.** No hay servidor ni contraseña. El
correo se guarda en el mismo teléfono, junto al resto de los datos, y sirve para:

- saludarte por tu nombre (lo saca de la primera parte del correo)
- identificar de quién es una copia de seguridad

Lo que **no** hace: no sincroniza entre dispositivos, no recupera tus datos si cambias
de celular, y no envía nada a internet.

Se puede cambiar después en **Ajustes → Tu correo**. Si borras todos los datos, la
pantalla de registro vuelve a aparecer.

Si más adelante quieres un registro real (con contraseña, respaldo en la nube y poder
entrar desde varios dispositivos), eso necesita un servidor — se puede hacer, pero es
otro proyecto encima de este.

## 💾 Dónde se guardan los datos

En el **almacenamiento del propio navegador o celular** (`localStorage`). Eso significa:

- ✅ Nadie más ve tus datos. No hay servidor, ni cuenta, ni clave.
- ✅ Funciona sin internet.
- ⚠️ Si borras los datos del navegador o cambias de teléfono, **se pierden**.

Por eso está el botón **Ajustes → Descargar copia**: guarda un archivo `.json` que
después puedes restaurar con **Restaurar**. Hazlo de vez en cuando.

---

## 🔧 Después de cambiar archivos

El `sw.js` guarda una copia de la app en el celular. Si haces cambios y no los ves:

1. Abre `sw.js`.
2. Sube el número: `const VERSION = 'mi-bolsillo-v1';` → `'mi-bolsillo-v2'`.
3. Recarga.

Mientras desarrollas en el computador, con `Ctrl + Shift + R` basta.

---

## 📦 Convertirla en APK (para más adelante)

Hoy ya se instala como app. Si además quieres un archivo `.apk` o subirla a Play Store,
el camino más corto sobre lo que ya está hecho es **Capacitor**:

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "Mi Bolsillo" com.mibolsillo.app --web-dir=.
npx cap add android
npx cap open android
```

Eso abre Android Studio con el proyecto listo para generar el APK. No hay que reescribir
nada del código: Capacitor envuelve estos mismos archivos.

Otra alternativa, todavía más simple, es [PWABuilder](https://www.pwabuilder.com):
le pegas el link de tu app publicada y te genera el paquete de Play Store.

---

## ✅ Lo que ya funciona

- Registro con correo la primera vez (y sin instrucciones después)
- Anotar ingresos y gastos con 15 categorías, nota y fecha
- Cuentas múltiples: Cuenta RUT, corriente, vista, ahorro, efectivo, billetera digital y tarjeta de crédito
- Mover plata entre tus cuentas sin que cuente como gasto ni como ingreso
- Patrimonio: lo que tienes menos lo que debes, con el detalle por cuenta
- Navegar entre meses
- Dashboard: saldo, tasa de ahorro, dona por categoría, barras mes a mes, línea del saldo diario
- Regla 50/30/20 comparada con tu reparto real
- Topes por categoría (método de los sobres) con alerta al pasarse
- Metas de ahorro con progreso y cuánto guardar al mes para llegar a tiempo
- 12 técnicas de ahorro explicadas + calculadora de interés compuesto
- Consejos automáticos según tus números reales
- Tutorial de bienvenida
- Copia de seguridad y restauración
- Modo oscuro automático
- Funciona sin internet
