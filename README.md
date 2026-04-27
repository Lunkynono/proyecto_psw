# Votify

Plataforma web de votaciones para hackathons, ferias de innovación y competiciones.

---

## Tabla de contenidos

1. [Descripción del proyecto](#1-descripción-del-proyecto)
2. [Stack tecnológico](#2-stack-tecnológico)
3. [Estructura de carpetas](#3-estructura-de-carpetas)
4. [Requisitos previos](#4-requisitos-previos)
5. [Instalación paso a paso](#5-instalación-paso-a-paso)
6. [Variables de entorno](#6-variables-de-entorno)
7. [Configuración de Supabase — Tablas SQL](#7-configuración-de-supabase--tablas-sql)
8. [Ejecutar en desarrollo](#8-ejecutar-en-desarrollo)
9. [Roles y flujos de navegación](#9-roles-y-flujos-de-navegación)
10. [Decisiones de diseño importantes](#10-decisiones-de-diseño-importantes)
11. [Notas para desarrolladores](#11-notas-para-desarrolladores)
12. [Contribución](#12-contribución)

---

## 1. Descripción del proyecto

**Votify** es una plataforma web orientada a la gestión de eventos competitivos como hackathons, ferias de innovación y cualquier tipo de competición que requiera evaluación estructurada.

El sistema contempla tres perfiles de usuario con flujos completamente diferenciados:

- **Administrador:** crea y gestiona eventos con múltiples competiciones, define los equipos participantes, asigna jueces expertos, configura criterios de evaluación ponderados (numéricos, radio, checklist, comentario libre) y abre encuestas de votación que pueden dirigirse al jurado, al público general o a ambos.
- **Juez:** accede a las encuestas que le han sido asignadas y evalúa cada proyecto del equipo participante según los criterios definidos por el administrador.
- **Público (voto popular):** entra mediante un código de sala sin necesidad de crear una cuenta, se identifica con nombre y correo electrónico y emite su voto. El sistema detecta duplicados mediante un hash SHA-256 del correo y el identificador de la encuesta, garantizando anonimato sin exponer datos personales.

---

## 2. Stack tecnológico

| Tecnología | Versión / Uso |
|---|---|
| **React** | v19 — biblioteca principal de UI |
| **Vite** | Bundler y servidor de desarrollo |
| **Tailwind CSS** | Utilidades CSS para el diseño |
| **Supabase** | Backend completo: PostgreSQL, Auth y Row Level Security (RLS) |
| **Zustand** | Estado global de autenticación |
| **React Router** | v7 — enrutamiento declarativo del lado del cliente |
| **React Hook Form** | Gestión de formularios con validación |
| **React Hot Toast** | Notificaciones tipo toast |
| **Lucide React** | Biblioteca de iconos SVG |
| **date-fns** | Utilidades para formateo y manipulación de fechas |

---

## 3. Estructura de carpetas

```
votify-app/
├── public/                  # Archivos estáticos servidos tal cual
├── src/
│   ├── pages/
│   │   ├── admin/           # Vistas exclusivas del administrador
│   │   ├── juez/            # Vistas exclusivas del juez
│   │   ├── publico/         # Flujo de voto popular sin cuenta
│   │   ├── auth/            # Pantallas de login y registro
│   │   └── Acceso.jsx       # Selector de rol (landing inicial)
│   ├── components/
│   │   ├── layout/          # Componentes estructurales de la app
│   │   └── ui/              # Componentes de interfaz reutilizables
│   ├── lib/
│   │   └── supabase.js      # Inicialización del cliente de Supabase
│   ├── store/
│   │   └── authStore.js     # Store de Zustand para autenticación
│   └── utils/
│       └── hash.js          # Función SHA-256 para el voter_hash
├── .env                     # Variables de entorno (no subir a git)
├── index.html
├── vite.config.js
├── tailwind.config.js
└── package.json
```

### Detalle de cada carpeta relevante

#### `src/pages/admin/`

Contiene todas las vistas que solo puede ver y usar un administrador autenticado:

- **Dashboard de eventos:** listado de todos los eventos creados por el usuario.
- **Nuevo evento / Editar evento:** formularios para crear y modificar eventos (nombre, lugar, descripción) y las competiciones que pertenecen a ese evento.
- **Gestión de competición:** vista central donde el admin gestiona equipos participantes, criterios de evaluación, encuestas y asignación de jueces.
- **Crear encuesta:** formulario para crear una nueva encuesta dentro de una competición, configurando tipo de votante y estado.
- **Resultados:** vista de resultados en tiempo real de una encuesta cerrada o abierta.

#### `src/pages/juez/`

Vistas accesibles para usuarios autenticados que no son organizadores de ningún evento:

- **Dashboard del juez:** listado de todas las encuestas asignadas al juez.
- **Pantalla de evaluación:** formulario de votación por proyecto, con todos los criterios definidos por el administrador, con sus tipos y pesos.

#### `src/pages/publico/`

Flujo completo de voto popular sin necesidad de cuenta:

- **EntrarSala:** formulario para ingresar el código de sala de la encuesta.
- **Identificación:** el votante introduce su nombre y correo electrónico para generar el `voter_hash`.
- **Votación:** pantalla de votación para cada equipo.
- **Resultados:** vista pública de resultados de la sala.

#### `src/pages/auth/`

Pantallas de autenticación compartidas para administradores y jueces:

- **Login:** inicio de sesión con email y contraseña via Supabase Auth.
- **Registro:** creación de cuenta nueva. El trigger de Supabase crea la fila correspondiente en `persona` de manera automática.

#### `src/pages/Acceso.jsx`

Pantalla de entrada a la aplicación. Permite al visitante elegir entre acceder como administrador/juez (redirige a `/login`) o como público (redirige al flujo de sala pública).

#### `src/components/layout/`

- **Layout:** componente envolvente que aplica la estructura visual común (cabecera, contenido, pie).
- **Navbar:** barra de navegación con el menú contextual según el rol detectado.
- **ProtectedRoute:** componente que verifica si el usuario tiene sesión activa antes de renderizar la ruta protegida; si no, redirige a `/login`.

#### `src/components/ui/`

Biblioteca interna de componentes visuales reutilizables:

- **Badge:** etiqueta de estado con variantes de color.
- **Button:** botón estilizado con variantes (primario, secundario, peligro) y estado de carga.
- **Input:** campo de texto con soporte para etiqueta, mensaje de error y estado deshabilitado.
- **Modal:** diálogo modal con overlay, título, contenido y acciones.
- **Spinner:** indicador de carga animado.

#### `src/lib/supabase.js`

Crea y exporta la instancia única del cliente de Supabase usando las variables de entorno `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. Toda la comunicación con la base de datos y la autenticación pasa por esta instancia.

#### `src/store/authStore.js`

Store de Zustand que mantiene el estado global de autenticación:

- `user`: objeto de usuario de Supabase Auth (o `null`).
- `persona`: fila de la tabla `persona` con nombre y correo.
- `loading`: booleano que indica si la sesión todavía se está inicializando. Es crítico para evitar redirecciones prematuras al recargar la página.
- Acciones: `setUser`, `setPersona`, `setLoading`, `signOut`.

#### `src/utils/hash.js`

Exporta la función `generateVoterHash(email, encuestaId)` que calcula el hash SHA-256 de la concatenación del correo del votante y el ID de la encuesta. Este hash se almacena en la tabla `voto` como `voter_hash` para detectar votos duplicados sin guardar ningún dato personal identificable en la base de datos.

---

## 4. Requisitos previos

Antes de instalar el proyecto asegúrate de tener disponible lo siguiente:

- **Node.js 18 o superior.** Puedes comprobarlo con `node -v`. Descárgalo en [nodejs.org](https://nodejs.org).
- **npm** (incluido con Node.js) **o yarn.**
- **Cuenta en Supabase** (el plan gratuito es suficiente). Regístrate en [supabase.com](https://supabase.com).
- Un editor de código como **Visual Studio Code** (recomendado).

---

## 5. Instalación paso a paso

### 1. Clonar el repositorio

```bash
git clone <url-del-repositorio>
cd votify-app
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

Crea el archivo `.env` en la raíz de `votify-app/` (ver sección siguiente).

### 4. Configurar Supabase

Ejecuta el SQL de la sección 7 en el editor SQL de tu proyecto de Supabase.

### 5. Arrancar el servidor de desarrollo

```bash
npm run dev
```

Abre [http://localhost:5173](http://localhost:5173) en tu navegador.

---

## 6. Variables de entorno

Crea un archivo llamado `.env` en la raíz del proyecto `votify-app/` con el siguiente contenido:

```env
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

> **Importante:** el archivo `.env` nunca debe subirse al repositorio. Asegurate de que `.env` está incluido en el `.gitignore`.

### Dónde encontrar estos valores

1. Accede a [supabase.com](https://supabase.com) e inicia sesión.
2. Selecciona tu proyecto.
3. En el menú lateral izquierdo, haz clic en **Settings** (icono de engranaje).
4. Dentro de Settings, selecciona la sección **API**.
5. Encontrarás:
   - **Project URL** → corresponde a `VITE_SUPABASE_URL`.
   - **Project API keys > anon / public** → corresponde a `VITE_SUPABASE_ANON_KEY`.

La clave `anon` es segura para usarse en el frontend porque las políticas RLS de la base de datos controlan qué puede hacer cada usuario con esa clave.

---

## 7. Configuración de Supabase — Tablas SQL

Abre el **SQL Editor** de tu proyecto en Supabase y ejecuta los siguientes bloques en orden. Cada bloque crea una tabla, activa las políticas de seguridad a nivel de fila (RLS) y define los permisos correspondientes.

### Tabla `persona`

Se crea automáticamente para cada usuario nuevo mediante un trigger de Supabase Auth.

```sql
CREATE TABLE public.persona (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre text,
  correo text UNIQUE
);

ALTER TABLE public.persona ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver perfiles"
  ON public.persona FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Editar perfil propio"
  ON public.persona FOR UPDATE
  USING (auth.uid() = id);
```

### Trigger para crear `persona` al registrarse

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.persona (id, nombre, correo)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### Tabla `evento`

```sql
CREATE TABLE public.evento (
  id bigserial PRIMARY KEY,
  organizador_id uuid NOT NULL REFERENCES public.persona(id),
  nombre text NOT NULL,
  lugar text,
  descripcion text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.evento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver propios eventos"
  ON public.evento FOR SELECT
  USING (organizador_id = auth.uid());

CREATE POLICY "Insertar evento"
  ON public.evento FOR INSERT
  WITH CHECK (organizador_id = auth.uid());

CREATE POLICY "Editar evento"
  ON public.evento FOR UPDATE
  USING (organizador_id = auth.uid());

CREATE POLICY "Eliminar evento"
  ON public.evento FOR DELETE
  USING (organizador_id = auth.uid());
```

### Tabla `competicion`

```sql
CREATE TABLE public.competicion (
  id bigserial PRIMARY KEY,
  evento_id bigint NOT NULL REFERENCES public.evento(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  descripcion text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.competicion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver competiciones"
  ON public.competicion FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.evento e
      WHERE e.id = competicion.evento_id
        AND e.organizador_id = auth.uid()
    )
  );

CREATE POLICY "Gestionar competiciones"
  ON public.competicion FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.evento e
      WHERE e.id = competicion.evento_id
        AND e.organizador_id = auth.uid()
    )
  );
```

### Tabla `competicion_juez`

Tabla de relación que aísla los jueces por competición (no por evento).

```sql
CREATE TABLE public.competicion_juez (
  competicion_id bigint NOT NULL REFERENCES public.competicion(id) ON DELETE CASCADE,
  persona_id uuid NOT NULL REFERENCES public.persona(id) ON DELETE CASCADE,
  PRIMARY KEY (competicion_id, persona_id)
);

ALTER TABLE public.competicion_juez ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver jueces competicion"
  ON public.competicion_juez FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Gestionar jueces competicion"
  ON public.competicion_juez FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.competicion c
      JOIN public.evento e ON e.id = c.evento_id
      WHERE c.id = competicion_juez.competicion_id
        AND e.organizador_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, DELETE ON public.competicion_juez TO authenticated;
```

### Tabla `equipo`

```sql
CREATE TABLE public.equipo (
  id bigserial PRIMARY KEY,
  competicion_id bigint NOT NULL REFERENCES public.competicion(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  created_at timestamptz DEFAULT now()
);
```

### Tabla `proyecto`

```sql
CREATE TABLE public.proyecto (
  id bigserial PRIMARY KEY,
  equipo_id bigint NOT NULL REFERENCES public.equipo(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  descripcion text
);
```

### Tabla `participante`

```sql
CREATE TABLE public.participante (
  id bigserial PRIMARY KEY,
  equipo_id bigint NOT NULL REFERENCES public.equipo(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  correo text,
  rol text NOT NULL
);
```

### Tabla `criterio`

Define los criterios de evaluación de cada competición. Soporta cuatro tipos:

| Tipo | Descripción |
|---|---|
| `numerico` | El juez introduce un valor dentro de un rango (`rango_min` / `rango_max`). |
| `radio` | El juez elige una opción de una lista (una sola selección). |
| `checklist` | El juez puede seleccionar varias opciones (limitado por `max_selecciones`). |
| `comentario` | El juez escribe un texto libre sin valor numérico. |

```sql
CREATE TABLE public.criterio (
  id bigserial PRIMARY KEY,
  competicion_id bigint NOT NULL REFERENCES public.competicion(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  descripcion text,
  tipo text NOT NULL CHECK (tipo IN ('numerico','radio','checklist','comentario')),
  peso numeric DEFAULT 1.0,
  rango_min numeric,
  rango_max numeric,
  max_selecciones integer,
  orden integer DEFAULT 0
);
```

### Tabla `criterio_opcion`

Opciones disponibles para criterios de tipo `radio` o `checklist`.

```sql
CREATE TABLE public.criterio_opcion (
  id bigserial PRIMARY KEY,
  criterio_id bigint NOT NULL REFERENCES public.criterio(id) ON DELETE CASCADE,
  texto text NOT NULL,
  orden integer DEFAULT 0
);
```

### Tabla `encuesta`

Una encuesta agrupa los votos de una competición en una sesión con estado controlado.

```sql
CREATE TABLE public.encuesta (
  id bigserial PRIMARY KEY,
  competicion_id bigint NOT NULL REFERENCES public.competicion(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  estado text DEFAULT 'borrador' CHECK (estado IN ('borrador','abierta','cerrada')),
  tipo_votante text DEFAULT 'juez' CHECK (tipo_votante IN ('juez','publico','ambos')),
  codigo_sala text UNIQUE,
  created_at timestamptz DEFAULT now()
);
```

| Campo | Descripción |
|---|---|
| `estado` | `borrador` (en preparación), `abierta` (votación activa), `cerrada` (votación finalizada). |
| `tipo_votante` | Define quién puede votar: solo jueces, solo público, o ambos. |
| `codigo_sala` | Código alfanumérico único que el público usa para acceder a la encuesta sin cuenta. |

### Tabla `encuesta_juez`

Asigna jueces específicos a encuestas específicas dentro de una competición.

```sql
CREATE TABLE public.encuesta_juez (
  encuesta_id bigint NOT NULL REFERENCES public.encuesta(id) ON DELETE CASCADE,
  persona_id uuid NOT NULL REFERENCES public.persona(id) ON DELETE CASCADE,
  PRIMARY KEY (encuesta_id, persona_id)
);
```

### Tabla `encuesta_equipo`

Asigna qué equipos participan en cada encuesta. Al crear una encuesta se incluyen todos los equipos de la competición por defecto, y el administrador puede ajustar la selección desde el detalle de la encuesta.

```sql
CREATE TABLE public.encuesta_equipo (
  encuesta_id bigint NOT NULL REFERENCES public.encuesta(id) ON DELETE CASCADE,
  equipo_id bigint NOT NULL REFERENCES public.equipo(id) ON DELETE CASCADE,
  PRIMARY KEY (encuesta_id, equipo_id)
);

ALTER TABLE public.encuesta_equipo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver equipos encuesta anon"
  ON public.encuesta_equipo FOR SELECT
  USING (true);

CREATE POLICY "Gestionar equipos encuesta"
  ON public.encuesta_equipo FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.encuesta enc
      JOIN public.competicion c ON c.id = enc.competicion_id
      JOIN public.evento e ON e.id = c.evento_id
      WHERE enc.id = encuesta_equipo.encuesta_id
        AND e.organizador_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.encuesta enc
      JOIN public.competicion c ON c.id = enc.competicion_id
      JOIN public.evento e ON e.id = c.evento_id
      JOIN public.equipo eq ON eq.id = encuesta_equipo.equipo_id
      WHERE enc.id = encuesta_equipo.encuesta_id
        AND eq.competicion_id = enc.competicion_id
        AND e.organizador_id = auth.uid()
    )
  );
```

### Tabla `voto`

Registra cada voto emitido. La combinación `(encuesta_id, voter_hash, equipo_id)` es única para evitar votos duplicados.

```sql
CREATE TABLE public.voto (
  id bigserial PRIMARY KEY,
  encuesta_id bigint NOT NULL REFERENCES public.encuesta(id),
  equipo_id bigint NOT NULL REFERENCES public.equipo(id),
  voter_hash text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(encuesta_id, voter_hash, equipo_id)
);
```

### Tabla `voto_opcion`

Almacena la respuesta concreta a cada criterio dentro de un voto.

```sql
CREATE TABLE public.voto_opcion (
  id bigserial PRIMARY KEY,
  voto_id bigint NOT NULL REFERENCES public.voto(id) ON DELETE CASCADE,
  criterio_id bigint NOT NULL REFERENCES public.criterio(id),
  valor_numerico numeric,
  valor_texto text,
  opcion_ids jsonb
);
```

| Campo | Uso |
|---|---|
| `valor_numerico` | Para criterios de tipo `numerico`. |
| `valor_texto` | Para criterios de tipo `comentario`. |
| `opcion_ids` | Array JSON con los IDs de `criterio_opcion` seleccionados (para `radio` y `checklist`). |

---

## 8. Ejecutar en desarrollo

Con las variables de entorno configuradas y las tablas de Supabase creadas, ejecuta:

```bash
npm run dev
```

El servidor de Vite arrancará y la aplicación estará disponible en:

```
http://localhost:5173
```

Cualquier cambio en los archivos fuente se reflejará en el navegador de forma instantánea gracias al HMR (Hot Module Replacement) de Vite.

### Otros comandos disponibles

| Comando | Descripción |
|---|---|
| `npm run build` | Genera la versión de producción en `dist/`. |
| `npm run preview` | Sirve localmente el build de producción para verificarlo antes de desplegar. |
| `npm run lint` | Ejecuta ESLint para detectar problemas de calidad de código. |

---

## 9. Roles y flujos de navegación

### Detección automática de rol

Votify no usa un campo de rol explícito en la base de datos. El rol se determina dinámicamente al iniciar sesión:

- Si el usuario autenticado tiene al menos una fila en la tabla `evento` donde `organizador_id = auth.uid()`, se le considera **administrador** y se redirige a `/admin`.
- Si no tiene ningún evento propio, se le considera **juez** y se redirige a `/juez`.

Este enfoque permite que un mismo usuario pueda ser administrador en sus propios eventos y juez en los de otra persona.

---

### Administrador

```
/login  →  /admin
```

| Ruta | Vista |
|---|---|
| `/login` | Inicio de sesión / registro. Tras autenticarse, el sistema detecta el rol y redirige. |
| `/admin` | Dashboard con el listado de eventos del administrador. |
| `/admin/eventos/nuevo` | Formulario para crear un nuevo evento. |
| `/admin/eventos/:id/editar` | Formulario para editar el evento (nombre, lugar, descripción) y gestionar las competiciones que contiene. |
| `/admin/competiciones/:id` | Vista principal de la competición: gestión de equipos, criterios de evaluación, encuestas y jurado asignado. |
| `/admin/competiciones/:id/encuesta/nueva` | Formulario para crear una nueva encuesta dentro de la competición. |
| `/admin/encuestas/:id/resultados` | Visualización de resultados de la encuesta, con puntuaciones ponderadas por criterio y equipo. |

**Flujo típico del administrador:**

1. Registrarse o iniciar sesión en `/login`.
2. Crear un evento en `/admin/eventos/nuevo`.
3. Editar el evento para añadir competiciones en `/admin/eventos/:id/editar`.
4. Entrar a la gestión de la competición en `/admin/competiciones/:id`:
   - Añadir equipos y sus proyectos.
   - Definir criterios de evaluación con sus pesos.
   - Asignar jueces (buscando por correo electrónico).
   - Crear una encuesta.
5. Abrir la encuesta para que los jueces y/o el público puedan votar.
6. Ver los resultados en tiempo real o una vez cerrada la encuesta.

---

### Juez

```
/login  →  /juez
```

| Ruta | Vista |
|---|---|
| `/login` | Inicio de sesión. Si no tiene eventos propios, redirige a `/juez`. |
| `/juez` | Dashboard con el listado de encuestas asignadas al juez. |
| `/juez/encuesta/:encuestaId/proyecto/:proyectoId` | Formulario de evaluación de un proyecto específico, con todos los criterios configurados por el administrador. |

**Flujo típico del juez:**

1. Iniciar sesión en `/login` con las credenciales proporcionadas por el administrador del evento.
2. Ver en `/juez` la lista de encuestas pendientes de evaluación.
3. Para cada encuesta, evaluar uno a uno los proyectos de los equipos participantes.
4. Una vez evaluados todos los proyectos, la participación del juez en esa encuesta queda completada.

---

### Público (voto popular)

El flujo público no requiere cuenta de usuario. El votante se identifica con nombre y correo para generar un hash anónimo.

```
/  →  /sala/:codigo  →  /sala/:codigo/votar  →  /sala/:codigo/resultados
```

| Ruta | Vista |
|---|---|
| `/` | **EntrarSala:** formulario donde el visitante introduce el código de sala. |
| `/sala/:codigo` | **Identificación:** el visitante introduce su nombre y correo. Se genera el `voter_hash`. |
| `/sala/:codigo/votar` | **Votación:** el visitante vota por los equipos de la competición según los criterios disponibles para el público. |
| `/sala/:codigo/resultados` | **Resultados:** vista de los resultados públicos de la sala tras votar. |

**Flujo típico del voto popular:**

1. El administrador crea una encuesta con `tipo_votante` = `publico` o `ambos` y comparte el `codigo_sala` con los asistentes (por pantalla, QR, etc.).
2. El visitante accede a la URL raíz `/` e introduce el código de sala.
3. Introduce su nombre y correo. El sistema genera el `voter_hash` localmente (nunca se envía el correo al servidor).
4. Evalúa o puntúa los equipos según los criterios configurados.
5. Ve los resultados actualizados de la sala.

---

## 10. Decisiones de diseño importantes

### `voter_hash`: anonimato sin perder control de duplicados

Para el voto popular se necesita evitar que una misma persona vote dos veces, pero almacenar el correo electrónico en la tabla `voto` representaría un problema de privacidad. La solución adoptada es calcular el hash SHA-256 de la concatenación del correo del votante y el ID de la encuesta:

```
voter_hash = SHA-256(email + encuestaId)
```

Este hash se calcula en el navegador del usuario antes de enviar el voto. La base de datos solo recibe el hash, no el correo. El campo `UNIQUE(encuesta_id, voter_hash, equipo_id)` en la tabla `voto` garantiza que el mismo hash no pueda votar dos veces en la misma encuesta y equipo.

---

### `competicion_juez`: jueces aislados por competición, no por evento

Un evento puede contener múltiples competiciones con temáticas distintas (por ejemplo, una feria de ciencias puede tener "Categoría Junior" y "Categoría Senior"). Cada competición puede requerir un panel de jueces diferente.

La tabla `competicion_juez` permite asignar jueces a competiciones concretas, no al evento en su totalidad. Esto proporciona granularidad máxima al administrador.

---

### Detección dinámica de rol (admin vs. juez)

No existe un campo `role` en la tabla `persona`. El sistema detecta el rol en tiempo de ejecución consultando si el usuario tiene filas en `evento` como organizador:

```
¿Usuario tiene eventos propios? → Administrador → /admin
¿Usuario no tiene eventos propios? → Juez → /juez
```

Esto es deliberado: un usuario puede ser administrador de sus eventos y simultáneamente ser invitado como juez en los eventos de otros organizadores. La restricción de que un organizador no puede ser juez de su propia competición se valida en el frontend al asignar jueces.

---

### Trigger automático de `persona`

Al registrarse en Supabase Auth, el trigger `on_auth_user_created` inserta automáticamente una fila en la tabla `persona` con el `id` del usuario, su nombre (tomado de los metadatos del registro) y su correo electrónico. Esto elimina la necesidad de que el frontend realice una segunda inserción manual tras el registro.

---

### `loading` en `authStore`

Al recargar la página, Supabase necesita unos instantes para restaurar la sesión del usuario desde el almacenamiento local. Si la aplicación intenta leer el estado de autenticación antes de que esto ocurra, detectará `user = null` y redirigirá erróneamente al usuario a `/login`.

El flag `loading` en el store de Zustand bloquea el renderizado de las rutas protegidas y del selector de rol hasta que la sesión esté completamente inicializada. Solo cuando `loading` pasa a `false` se evalúa si hay sesión activa.

---

## 11. Notas para desarrolladores

### Usuario con cuenta pero sin fila en `persona`

Si existe un usuario en `auth.users` que no tiene la fila correspondiente en `persona` (por ejemplo, usuarios creados antes de instalar el trigger), se puede reparar ejecutando:

```sql
INSERT INTO persona (id, nombre, correo)
SELECT
  id,
  split_part(email, '@', 1),
  email
FROM auth.users
WHERE id NOT IN (SELECT id FROM persona)
ON CONFLICT (id) DO NOTHING;
```

---

### Restricción: el organizador no puede ser juez de su propia competición

Esta validación se realiza en el frontend al momento de asignar jueces a una competición. Antes de insertar en `competicion_juez`, se verifica que el `persona_id` del candidato a juez no coincida con el `organizador_id` del evento al que pertenece la competición.

No existe una restricción de base de datos (`CHECK`) para esto porque implicaría una subquery en la constraint, lo cual no está soportado de forma nativa en PostgreSQL. La validación en el frontend es suficiente dado que las RLS policies ya garantizan que solo el organizador puede modificar `competicion_juez`.

---

### RLS: cada administrador solo ve sus propios datos

Las políticas de Row Level Security garantizan aislamiento total entre organizadores:

- Un administrador solo puede leer y modificar los eventos donde `organizador_id = auth.uid()`.
- Las competiciones, equipos, criterios, encuestas y votos heredan esta restricción a través de los `EXISTS` en las políticas, siguiendo la cadena de relaciones hasta llegar a `evento.organizador_id`.
- Los jueces pueden leer la información necesaria para evaluar (competiciones, equipos, criterios) gracias a políticas `FOR SELECT` más permisivas, pero no pueden modificar nada.

---

### Despliegue en producción

El proyecto incluye un archivo `vercel.json` configurado para despliegues en [Vercel](https://vercel.com), que gestiona el enrutamiento SPA (todas las rutas sirven `index.html`). Para desplegar:

1. Conecta el repositorio a Vercel.
2. Configura las variables de entorno `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en el panel de Vercel (Settings > Environment Variables).
3. Despliega. Vercel detectará automáticamente que es un proyecto Vite y ejecutará `npm run build`.

---

*Proyecto desarrollado como parte de una asignatura de Proceso de Software.*

---

## 12. Contribución

Para contribuir al proyecto y subir cambios al repositorio en GitHub, sigue estos pasos:

### Configuración inicial de Git y autenticación

1. **Clona el repositorio** (si no lo tienes localmente):
   ```bash
   git clone https://github.com/Lunkynono/proyecto_psw.git
   cd proyecto_psw
   ```

2. **Crea un Personal Access Token (PAT) en GitHub**:
   - Ve a [https://github.com/settings/tokens](https://github.com/settings/tokens).
   - Crea un nuevo token **clásico** con el scope `repo` (acceso completo a repositorios privados).
   - Copia el token (empieza con `ghp_`).

3. **Configura Git para almacenar credenciales**:
   ```bash
   git config --global credential.helper store
   ```

### Subir cambios

1. **Haz tus cambios** en el código.

2. **Añade los archivos modificados**:
   ```bash
   git add .
   ```

3. **Crea un commit** con un mensaje descriptivo:
   ```bash
   git commit -m "Descripción de los cambios realizados"
   ```

4. **Sube los cambios al repositorio**:
   ```bash
   git push origin main
   ```
   - Si es la primera vez, Git te pedirá tu nombre de usuario de GitHub y el PAT como contraseña. Ingresa tu username y el token.

### Notas importantes

- El repositorio es privado, por lo que necesitas un PAT con permisos adecuados.
- Nunca subas el archivo `.env` ni tokens al repositorio (están en `.gitignore`).
- Si encuentras conflictos al hacer push, haz `git pull origin main` primero para sincronizar.
- Para seguridad, revoca tokens antiguos en GitHub settings después de usarlos.
