# Encender la nube

Mi Bolsillo puede guardar tus datos fuera del teléfono, para que no se pierdan si lo pierdes
y para que el celular y el computador vean lo mismo. Eso se hace con **Supabase**, que es una
base de datos en internet con un plan gratuito de sobra para esto.

**Mientras no hagas nada de lo que sigue, la app funciona igual que siempre**: guarda solo en
el teléfono y ni siquiera menciona la nube. No hay apuro.

Son diez minutos y hay que hacerlo una sola vez.

---

## 1. Crear el proyecto

1. Anda a [supabase.com](https://supabase.com) y crea una cuenta (sirve entrar con GitHub).
2. Toca **New project**.
3. Ponle el nombre que quieras, por ejemplo `mi-bolsillo`.
4. Te va a pedir una **contraseña de base de datos**. Guárdala en tu gestor de contraseñas.
   No es la que vas a usar en la app, pero perderla es una lata.
5. En **Region**, elige la más cercana: *South America (São Paulo)*.
6. **Create new project** y espera un par de minutos a que termine de armarse.

---

## 2. Crear la tabla donde viven tus datos

En el menú de la izquierda entra a **SQL Editor** → **New query**, pega esto tal cual y
toca **Run**:

```sql
-- La tabla: una fila por persona, con todos sus datos adentro.
create table public.estados (
  usuario_id      uuid primary key references auth.users on delete cascade,
  datos           jsonb not null,
  version_esquema int not null default 2,
  actualizado     timestamptz not null default now()
);

-- Esto es lo importante: sin estas reglas, cualquiera con la llave
-- pública podría leer las filas de los demás.
alter table public.estados enable row level security;

create policy "cada quien lee lo suyo"
  on public.estados for select
  using (auth.uid() = usuario_id);

create policy "cada quien crea lo suyo"
  on public.estados for insert
  with check (auth.uid() = usuario_id);

create policy "cada quien actualiza lo suyo"
  on public.estados for update
  using (auth.uid() = usuario_id)
  with check (auth.uid() = usuario_id);
```

Tiene que decir **Success. No rows returned**. Eso está bien: no devolvió filas porque recién
la creaste.

> **Por qué importan esas tres reglas.** La llave que va en el código es pública: cualquiera
> que mire el sitio la puede ver. Lo que impide que un desconocido lea tus gastos son estas
> reglas, que le dicen a la base de datos "muéstrale a cada persona solamente su propia fila".
> Si te saltas este paso, tus datos quedan abiertos. **No te lo saltes.**

---

## 3. Copiar los dos datos que necesita la app

En el menú de la izquierda: **Project Settings** (el engranaje) → **API**.

De esa pantalla necesitas dos cosas:

| En Supabase dice | Se ve así | Va en |
|---|---|---|
| **Project URL** | `https://algolargo.supabase.co` | `url` |
| **anon** `public` | una cadena larguísima que parte con `eyJ...` | `llavePublica` |

> ⚠️ **Nunca uses la llave que dice `service_role`.** Esa se salta las reglas de arriba y, en un
> sitio público, le entrega tus datos a cualquiera. La que va es la que dice **anon**.

### Pégalas en la app, desde el celular

No hay que tocar código ni publicar nada. Abre Mi Bolsillo, anda a
**Ajustes → Conectar tu nube**, pega los dos datos y toca **Probar y conectar**.

Antes de guardar nada, la app revisa dos cosas y te dice cuál falló:

- que la dirección responda y acepte la llave;
- que la tabla exista. Si te saltaste el paso 2, te lo dice con esas palabras.

Cuando ambas pasan, la conexión queda guardada en ese teléfono y la app se recarga sola,
ya con cuenta y contraseña.

### O déjalas fijas en el repositorio (opcional)

Si prefieres que la app venga conectada de fábrica para cualquiera que la abra, pega los dos
valores en `src/config-nube.js` y sube el cambio con
`git add -A && git commit -m "encender la nube" && git push`. Lo que pegues en Ajustes manda
por sobre este archivo.

---

## 4. Usarla

La primera vez que abras la app con esto configurado, la pantalla de bienvenida va a pedirte
correo **y contraseña**:

- **¿Primera vez? Crea tu cuenta** → elige una contraseña de al menos 6 caracteres.
- Supabase te va a mandar un correo para confirmar la dirección. Ábrelo y vuelve a entrar.
- En el otro dispositivo, entra con el mismo correo y contraseña, y tus datos aparecen.

En **Ajustes → Tu cuenta en la nube** ves cómo va: *al día*, *por subir* o *no subió*, más los
botones para forzar una subida, traer lo de la nube, o cerrar sesión.

### Si quieres saltarte la confirmación por correo

Es más cómodo pero menos seguro (un error de tipeo en el correo y no puedes recuperar la
cuenta). Si aun así lo prefieres: **Authentication → Providers → Email** y apaga
*Confirm email*.

---

## Cómo funciona por dentro (para cuando lo olvides)

- El teléfono sigue mandando para lo inmediato. Anotas un gasto, se guarda al tiro en el
  teléfono, y la pantalla responde sin esperar a internet.
- Unos segundos después sube una copia. Si no hay señal queda pendiente y sube sola cuando
  vuelva.
- Se guarda **todo el objeto de una vez**, igual que el respaldo `.json`. No hay una tabla por
  movimiento. Para una persona con unos miles de movimientos esto anda de sobra, y mantiene
  las migraciones funcionando sin escribir nada nuevo.
- Al abrir, la app compara marcas de tiempo. Si los dos lados cambiaron desde la última vez que
  estuvieron de acuerdo, **no elige sola**: te muestra cuántos movimientos hay en cada lado y
  eliges tú.

## Probar sin tocar tu proyecto

Hay un Supabase de mentira para probar en tu computador, sin internet y sin ensuciar tus datos:

```bash
node herramientas/nube-de-prueba.js
```

Después, en *Ajustes → Conectar tu nube*, pon la dirección `http://localhost:5174` y cualquier
cosa como llave. Como queda guardado solo en el navegador, no ensucia el repositorio.

Para probar el caso de alguien que se saltó el paso del SQL:

```bash
SIN_TABLA=1 node herramientas/nube-de-prueba.js
```

## Lo que esto NO es

- **No es cifrado de punta a punta.** Los datos viajan protegidos por HTTPS y se guardan en tu
  proyecto, pero quien administre ese proyecto —o sea, tú— puede leerlos entrando a Supabase.
- **No reemplaza el respaldo.** Si borras tu cuenta de Supabase o el proyecto, se van. Sigue
  descargando el `.json` de vez en cuando desde Ajustes.
