# 💚 Mi Bolsillo

App para controlar **ingresos, gastos y metas de ahorro**, con dashboard de gráficos y
una sección que te enseña técnicas de ahorro explicadas en simple.

Está pensada para usarse desde el celular y **se puede instalar como una app real**
(ícono en la pantalla de inicio, funciona sin internet).

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

Primero necesitas que la app esté en una dirección que el celular pueda abrir. Dos caminos:

**Rápido y gratis (recomendado para probar):** súbela a GitHub Pages, Netlify o Vercel.
Con arrastrar la carpeta `mi-bolsillo` a [netlify.com/drop](https://app.netlify.com/drop)
ya tienes un link funcionando en menos de un minuto.

**En tu red local:** corre el servidor de la Opción B y entra desde el celular a
`http://LA-IP-DE-TU-PC:5173` (los dos tienen que estar en el mismo WiFi).

Ya con el link abierto en el celular:

- **Android (Chrome):** menú ⋮ → *Instalar aplicación* / *Agregar a pantalla principal*.
  La app también te muestra sola un aviso verde de "Instalar".
- **iPhone (Safari):** botón Compartir → *Agregar a pantalla de inicio*.
  (En iPhone el aviso automático no aparece: es una limitación de Safari, no un error.)

Queda con su ícono, se abre en pantalla completa y funciona sin internet.

---

## 🗂️ Qué hace cada archivo

```
mi-bolsillo/
├── index.html          Toda la estructura visual (las 5 pantallas)
├── manifest.json       Datos de la app: nombre, ícono, colores
├── sw.js               Hace que funcione sin internet
├── css/
│   └── estilos.css     Colores, tamaños, diseño
├── js/
│   ├── datos.js        El "cerebro": guarda y calcula. No dibuja nada.
│   ├── graficos.js     Dibuja la dona, las barras y la línea (SVG a mano, sin librerías)
│   ├── consejos.js     Las técnicas de ahorro y los consejos automáticos
│   └── app.js          Une todo: escucha los toques y decide qué se muestra
├── iconos/             Los íconos de la app
└── herramientas/
    ├── servidor.js         Servidor local para probar
    └── generar-iconos.js   Vuelve a crear los íconos si cambias el color
```

**Si quieres tocar algo, empieza por aquí:**

| Quiero cambiar... | Abre este archivo | Busca |
|---|---|---|
| Los colores | `css/estilos.css` | el bloque `:root` de arriba |
| Las categorías (agregar/quitar) | `js/datos.js` | `CATEGORIAS_GASTO` |
| Los textos de las técnicas | `js/consejos.js` | `TECNICAS` |
| Los consejos automáticos | `js/consejos.js` | `function sugerir` |
| Los pasos del tutorial | `js/app.js` | `const PASOS` |

---

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

- Anotar ingresos y gastos con 15 categorías, nota y fecha
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
