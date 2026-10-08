# Contexto general del proyecto: Plataforma de turnos multi-negocio

## Qué es
Una plataforma tipo SaaS para que negocios de estética integral (centros de estética, peluquerías, salones de uñas, y potencialmente kinesiología, dentistas, etc.) puedan ofrecer a sus clientes:
- Ver sus servicios disponibles
- Agendar día y horario
- Pagar una seña online para confirmar el turno (vía Mercado Pago)

La plataforma **no es para un solo negocio**: la idea es que múltiples negocios la usen, cada uno con su propia configuración, servicios, profesionales y estética visual — sin que haya que programar una web nueva por cada cliente.

## Stack técnico actual
- Next.js 16 (App Router, Turbopack) + React 19 + Tailwind 4
- Supabase (base de datos y backend) — ya conectado al proyecto
- Mercado Pago para el cobro de señas (ver Paso 5)
- Resend para notificaciones por email (ver Paso 7)

Carpeta del proyecto en la compu de Paulina (Windows, OneDrive): `PROYECTOS DIGITALES PAULI\plataforma-turnos`. Sesiones futuras: para trabajar directo en el código hay que pedir acceso a esa carpeta (no a `.next`, que es la de compilación).

## Modelo de datos (estructura base)
La plataforma funciona con un modelo multi-tenant: cada negocio es un registro de datos, no una web aparte. Tablas principales:

- **Negocios**: nombre, rubro, logo, colores/identidad visual, si tiene una o varias sucursales, horario de atención (apertura/cierre, días que atiende), `email_notificaciones` (a dónde avisar de turnos nuevos, ver Paso 7)
- **Servicios**: por negocio, con nombre, descripción, precio y duración
- **Profesionales**: por negocio, con qué servicios hace cada uno
- **Sucursales**: opcional, solo si el negocio la usa
- **Reservas**: cliente, negocio, servicio (opcional, vacío si es un bloqueo manual), profesional (si aplica), sucursal (si aplica), día, horario de inicio y duración en minutos (una "foto" tomada al momento de reservar, no se recalcula del servicio después), estado (`pendiente_pago`/`confirmada`/`cancelada`), `id_pago_mercadopago` (id del pago real en Mercado Pago, se completa al verificar), si es un bloqueo manual — solo la lee el dueño del negocio (RLS)
- **Ausencias de profesionales**: negocio, profesional, día puntual en el que no puede trabajar, motivo opcional
- **Vista `turnos_ocupados`**: pública, expone solo negocio/profesional/fecha/hora/duración de reservas no canceladas (sin datos del cliente, incluye también los bloqueos manuales), para que el flujo de reserva anónimo pueda chequear disponibilidad (por superposición de rangos, no solo coincidencia exacta de horario) sin exponer información personal
- **`negocios_pagos`** (sumada en el Paso 5, Mercado Pago): `negocio_id` (PK/FK a `negocios`), `mercadopago_access_token`, `mercadopago_webhook_secret` (sumada en el Paso 8, ver ahí), `actualizado_en` — con RLS y sin lectura pública, solo el dueño puede leer/escribir su propia fila. Ver Paso 5 para el detalle de por qué está separada de `negocios`.

## Flujo de reserva del cliente
1. Landing con mensaje de bienvenida y presentación del negocio
2. Botón "Reservar ahora"
3. Selección de sucursal (**se salta este paso si el negocio tiene una sola**)
4. Selección de servicio (con descripción y precio)
5. Selección de profesional preferido (**se salta si el servicio lo hace un solo profesional**)
6. Selección de día y horario disponible
7. Carga de datos personales del cliente
8. Pago de la seña vía Mercado Pago: redirección a Checkout Pro y, al volver, verificación real del pago del lado del servidor antes de confirmar el turno (ver Paso 5, Tramo 1 y 2) — y, si se aprueba, aviso por email a la dueña (ver Paso 7)

Importante: es **un solo flujo/componente** que se adapta según los datos cargados de cada negocio (no un flujo distinto por rubro). Orden confirmado con Paulina: servicio antes que profesional (no al revés), porque es lo que permite la lógica de saltear el paso de profesional cuando solo hay uno vinculado al servicio, y porque encaja mejor con cómo la gente elige en la mayoría de los rubros (primero el tratamiento, no la persona).

Desde cualquier pantalla intermedia (sucursal, servicio, profesional, día, horario, datos) el cliente puede volver atrás con un botón "← Volver" — ver Paso 6 más abajo para el detalle de implementación.

**Duración variable por turno (desde el 17/09/2026):** al principio los turnos eran bloques fijos de 1h30, simplificación consciente para arrancar rápido pero que dejaba tiempo libre sin reservar en servicios cortos. Ahora la grilla de horarios de **inicio** posibles es cada 30 minutos (`INTERVALO_TURNO_MINUTOS` en `src/lib/horarios.js`), y cada turno ocupa el rango real que dura su servicio (por ejemplo, un servicio de 2 horas ocupa cuatro "casilleros" de 30 min, uno de 45 min redondea al próximo casillero de 30 disponible). La disponibilidad se calcula por superposición de rangos, no por coincidencia exacta de horario — helper `filtrarHorariosLibres` en `src/lib/horarios.js`. Hoy el intervalo de 30 min es una constante compartida por toda la plataforma; si algún negocio necesita otro valor, se puede pasar a ser un campo más de la tabla `negocios` (mismo patrón que `horario_apertura`/`horario_cierre`).

Los helpers de fechas/horarios (`generarProximosDias`, `generarHorariosInicio`, `filtrarHorariosLibres`, `horaFin`) viven en `src/lib/horarios.js`, compartidos entre el flujo de reserva del cliente y el panel (para que la dueña pueda bloquear un horario o cargar una ausencia usando la misma lógica que ven los clientes). La función `formatearFechaCorta` (formatea una fecha ISO a algo legible tipo "lun 18/09") vive en `src/lib/formatearFecha.js` (movida ahí en el Paso 4 al sumar el skin a medida de "by olivia", ver más abajo), compartida entre el skin genérico y cualquier skin a medida.

## Panel de administración (por negocio)
Cada negocio necesita poder, sin tocar código:
- Loguearse (Supabase Auth)
- Cargar y editar sus servicios y profesionales
- Configurar horarios de atención y monto/porcentaje de seña
- Ver la lista de reservas entrantes (tipo agenda), y poder cancelarlas
- Bloquear manualmente un horario (lo ocupó por otro medio) para que no se ofrezca online
- Cargar que un profesional no puede trabajar un día puntual (vacaciones, licencia, etc.)
- Configurar su identidad visual: logo, colores, texto de bienvenida
- Configurar su email para recibir avisos de turnos nuevos confirmados (ver Paso 7)
- Cargar y editar sucursales (CRUD completo, ver Paso 4)
- Conectar su cuenta de Mercado Pago (pegando su Access Token, ver Paso 5) y, opcionalmente, la clave del webhook (ver Paso 8)

## Notificaciones
- **Por email — completado y probado de punta a punta, ver Paso 7.**
- **Versión más avanzada (opcional/premium, a futuro)**: integración con WhatsApp Business API para:
  - Mensaje de agradecimiento al cliente al reservar
  - Recordatorio automático unas horas antes del turno
  - Aviso al dueño del negocio ante cada nueva reserva

## Identidad visual por negocio
Cada negocio debe poder tener su propia apariencia (logo, colores, textos) sin que esto implique programar una web nueva. El motor de reserva y el panel son los mismos para todos; lo que cambia es configuración. Además, desde el Paso 4, un negocio puntual puede tener una "piel a medida" (un componente de presentación propio, como `SkinPilotoByOlivia.js`) que reemplaza el diseño genérico sin tocar la lógica compartida — ver el detalle en el Paso 4 más abajo.

## Escalabilidad (modelo de negocio)
El objetivo es que agregar un negocio nuevo a la plataforma sea configuración, no desarrollo:
1. Alta del negocio en la tabla correspondiente
2. Carga de servicios y profesionales desde el panel
3. Ajuste de identidad visual (logo, colores)
4. Configuración de seña y horarios
5. Publicación con su propia URL/subdominio

El primer negocio (prototipo: salón de uñas) va a llevar más tiempo porque ahí se construye toda la base. Los siguientes clientes deberían ser mucho más rápidos de sumar. Salón de Uñas Test sirve doble función: es el negocio piloto sobre el que se construye y prueba la plataforma, y más adelante también va a servir como demo para mostrarle a clientes potenciales cómo funciona. Sumar un cliente real después es solo dar de alta su fila en `negocios` (con su slug, servicios, profesionales, colores, horario) — nada de código nuevo (salvo que ese cliente quiera una piel a medida propia, ver Paso 4).

## Cómo quiero trabajar en esta sesión
Vamos a ir por partes, de lo general a lo específico:
1. Primero, el modelo de datos en Supabase (tablas de negocios, servicios, profesionales, sucursales)
2. Después, el flujo de reserva único y adaptable
3. Después, el panel de administración por negocio
4. Después, identidad visual configurable
5. Por último, integración de Mercado Pago y luego notificaciones (email primero, WhatsApp después)

No quiero que se programe todo junto: prefiero avanzar en pasos chicos, revisar cada entrega, y recién pasar al siguiente paso cuando el anterior funcione bien.

## Estado actual del desarrollo

**Paso 1 (modelo de datos) — completado y verificado el 16/09/2026.** El esquema en `claude/schema-supabase.sql` está aplicado en Supabase, con RLS activado en todas las tablas. Se cargó un negocio de prueba ("Salón de Uñas Test", slug `unas-test`) con 2 profesionales, 2 servicios, y horario lunes a sábado de 9 a 18.

**Paso 2 (flujo de reserva) — completado y verificado el 16/09/2026**, en `src/app/[negocio]/page.js`. Probado de punta a punta en el navegador de Paulina contra `http://localhost:3000/unas-test`, incluyendo casos reales de guardado en Supabase:

- Landing del negocio, con salteo de sucursal cuando no tiene o tiene una sola.
- Selección de servicio (nombre, descripción, precio, duración) y de profesional, con salteo automático cuando el servicio tiene un solo profesional vinculado.
- Selección de día (próximos días, saltea los que el negocio no atiende, arranca desde mañana) y de horario, descontando los horarios ya ocupados de esa profesional puntual.
- Formulario de datos del cliente (nombre y teléfono obligatorios, email opcional) y guardado real de la reserva en Supabase con estado `pendiente_pago` y el monto de seña calculado según la configuración del negocio.
- Pantalla final de confirmación con el resumen completo y el monto de la seña.
- Verificado con una reserva real de prueba, y confirmado que al intentar reservar el mismo horario con la misma profesional de nuevo, ya no aparece disponible.

Dos bugs de Supabase/RLS encontrados y corregidos en el camino, buenos para recordar en negocios futuros con el mismo patrón multi-tenant:
1. El insert de la reserva encadenaba `.select().single()` para traer de vuelta la fila creada, pero como quien reserva es anónimo y la política de SELECT de `reservas` solo deja ver al dueño del negocio, el RETURNING quedaba bloqueado y el insert parecía fallar aunque la fila sí se guardara. Se sacó el `.select()` — no hace falta releer la fila, ya tenemos los datos en el estado local.
2. La consulta para saber qué horarios ya estaban ocupados corría contra la tabla `reservas` directamente, y por la misma política de RLS (solo el dueño puede leer) siempre devolvía vacío para un visitante anónimo. Se resolvió creando la vista pública `turnos_ocupados` (solo negocio/profesional/fecha/hora, sin datos personales) y consultando esa vista en vez de la tabla.

Pendiente dentro del flujo, no bloqueante: el paso de selección de sucursal existe en el código pero nunca se probó de punta a punta con un negocio que realmente tenga más de una sucursal cargada con datos reales de reservas — ver nota en paso 4 sobre el CRUD de sucursales.

**Paso 3 (panel de administración) — completado (para negocios de una sola sucursal) y verificado el 17/09/2026.**

Primer tramo: login con Supabase Auth (email/contraseña) contra el mismo usuario de prueba usado como `owner_id` de "Salón de Uñas Test", y lista de reservas del negocio logueado, ordenadas por fecha/hora, con botón de cerrar sesión. Simplificación actual: se asume un negocio por usuario dueño (no contempla todavía que un mismo owner tenga varios negocios).

Para que las próximas pantallas del panel no dupliquen esta lógica, se reorganizó el código en piezas reutilizables:
- `src/lib/useNegocioAutenticado.js`: hook compartido que maneja la sesión y busca el negocio del usuario logueado.
- `src/app/admin/AdminShell.js`: layout compartido (pantalla de login, encabezado, menú de navegación) que usan todas las pantallas del panel vía render prop — `children(negocio, actualizarNegocio)`, donde `actualizarNegocio` deja que una pantalla hija actualice el negocio en memoria sin recargar la página.
- `src/app/admin/page.js`: composición de `AdminShell` + `ListaReservas`.

Segundo tramo — **CRUD de servicios y profesionales**, en `src/app/admin/servicios/GestionServicios.js` (ruta `/admin/servicios`):
- Alta, edición y baja de servicios (nombre, descripción, precio, duración).
- Alta y baja de profesionales.
- Checkboxes para vincular/desvincular qué profesionales atienden cada servicio (tabla `servicios_profesionales`).
- Al intentar borrar un servicio o profesional con reservas asociadas, se detecta el error de clave foránea (código `23503`) y se avisa en vez de romperse.

Tercer tramo — **edición de horario y seña del negocio**, en `src/app/admin/configuracion/ConfiguracionNegocio.js` (ruta `/admin/configuracion`): editar horario de apertura/cierre, tildar los días que atiende, y elegir tipo de seña (porcentaje o monto fijo) y su valor. Guarda contra la tabla `negocios` y actualiza el negocio en memoria vía `actualizarNegocio` (sin recargar la página).

Cuarto tramo — **bloqueo manual de horarios y cancelación de reservas**, en `src/app/admin/ListaReservas.js` (`/admin`):
- Cada reserva tiene un botón "Cancelar" (pasa su `estado` a `cancelada`), que libera el horario para que vuelva a ofrecerse online.
- Sección "Bloquear un horario": la dueña elige profesional, día, duración y horario (calculados con los mismos helpers que usa el flujo de reserva del cliente) y un motivo opcional, para marcar ese horario como ocupado sin que corresponda a una reserva real. Se guarda como una fila más en `reservas`, con `servicio_id` vacío y `bloqueo_manual = true`, y `estado = 'confirmada'` (no requiere seña). Migración aplicada: `servicio_id` pasó a ser opcional en `reservas` y se sumó la columna `bloqueo_manual`.

Quinto tramo — **ausencias de profesionales**, en `src/app/admin/ausencias/GestionAusencias.js` (ruta `/admin/ausencias`, tabla `ausencias_profesionales`):
- La dueña carga, por profesional, un día puntual en el que no puede trabajar (con motivo opcional) y puede eliminar ausencias cargadas.
- El flujo de reserva del cliente (`src/app/[negocio]/page.js`) consulta esta tabla al elegir profesional (o al saltear ese paso porque el servicio tiene una sola persona vinculada) y saca de la lista de días disponibles los que esa persona tiene cargados como ausencia.
- Nota: se restructuró `irAElegirDia` en el flujo del cliente para que sea asíncrona (antes era síncrona) y reciba el profesional elegido como parámetro, en vez de depender del estado `elecciones.profesional` (que todavía no estaba actualizado en el momento en que se llamaba, por ser un `setState` asíncrono de React) — quedó como el único lugar que arma la lista de días, evitando la duplicación que había antes entre el flujo normal y el de "salteo de profesional".

Sexto tramo — **turnos de duración variable, completado y verificado el 17/09/2026**: a pedido de Paulina, se reemplazaron los bloques fijos de 1h30 por una grilla de horarios de inicio cada 30 minutos, donde cada turno ocupa el rango real que dura su servicio (ver sección "Flujo de reserva del cliente" más arriba para el detalle). Tocó:
- `src/lib/horarios.js`: `generarBloquesHorario` pasó a ser `generarHorariosInicio` (recibe la duración y descarta horarios que no dejan lugar antes del cierre), se sumaron `filtrarHorariosLibres` (superposición de rangos) y `horaFin` (calcula la hora de fin para mostrarla).
- `src/app/[negocio]/page.js`: `elegirDia` usa la duración del servicio elegido; el insert de la reserva guarda `duracion_minutos`.
- `src/app/admin/ListaReservas.js`: la sección "Bloquear un horario" ahora pide también la duración del bloqueo; la lista de reservas muestra el rango horario completo (de/a) en vez de solo la hora de inicio.
- Verificado con un servicio corto y uno largo (2hs) en el mismo día/profesional, confirmando que los rangos no se superponen.

Nota técnica (reutilizable para las próximas pantallas del panel): la regla de ESLint `react-hooks/set-state-in-effect` no deja llamar a una función que actualiza estado de forma síncrona al invocarla desde un `useEffect`, salvo que esa función esté definida **dentro** del propio efecto. Patrón que lo resuelve: la función de carga se define adentro del `useEffect`, y para "recargar" datos desde otros lugares (después de un alta/baja) se usa un estado contador (`recargar`) que se suma a las dependencias del efecto.

**Lo que falta del panel, y quedó afuera de este paso a propósito:**
- Edición de `nombre`, `slug` y `rubro` del negocio desde el panel (hoy solo por SQL) — probablemente encaje junto con identidad visual, ya que `ConfiguracionNegocio.js` ya existe y es el lugar natural para sumarlo.

**Paso 4 (identidad visual + sucursales) — completado el 21/09/2026, con el diseño a medida del piloto llevado a código real el 25/09/2026.**

Antes de tocar `ConfiguracionNegocio.js`, se armó un mockup interactivo y clickeable de referencia para un negocio ficticio de uñas ("by olivia nails studio"), en un Claude Artifact de tipo "Design" (no es código de la plataforma, es una maqueta visual): https://claude.ai/artifact/QJFFphLQN4oZqUgxL9EHVR

Cubre las 6 pantallas del flujo completo enlazadas entre sí como prototipo navegable (bienvenida → elegir servicio → elegir profesional → día y horario → confirmar y pagar seña → turno confirmado), con textos, precios y fotos de ejemplo cargados por Paulina, y revisado para que se vea bien en celular (viewport mobile, sin anchos fijos rotos, nav simplificada).

Decisiones de identidad visual que quedaron definidas ahí:
- Paleta de 4 colores (de más oscuro a más claro): Burgundy `#890620`, Berry Crush `#B6465F`, Rosy Taupe `#DA9F93`, Almond Silk `#EBD4CB`, con degradado diagonal de esos 4 tonos como fondo de portada, y una franja del mismo degradado (con una capa oscura superpuesta para contraste de texto) en el encabezado de cada pantalla del flujo.
- Tipografías (Google Fonts): Italiana para el logotipo/títulos, Bebas Neue para el subtítulo de marca (contraste con el nombre principal), Cormorant Garamond itálica para frases destacadas, Jost para texto general y botones.

**Decisión importante de Paulina (20/09/2026), clave para cómo seguir con diseño de acá en adelante:** le gusta la idea de escalabilidad de fondo (base de datos, flujo de reserva y panel de admin compartidos entre negocios), pero por ahora **no** quiere que el "vestido" visual de cada negocio dependa solo de los campos genéricos de color/logo/texto — prefiere diseñar la parte visual de cada negocio de forma única y pensada a medida (como se hizo con "by olivia" en el mockup), reutilizando toda la lógica de reservas/pagos/admin ya construida. Para sesiones futuras: cuando se retome diseño visual "en serio" para un negocio puntual, el camino preferido es programar una piel a medida para ese negocio, no ampliar el motor genérico de colores como único mecanismo. Los campos genéricos (color primario/secundario/logo/texto) se mantienen igual — siguen siendo la base mínima que cualquier negocio nuevo tiene disponible sin trabajo de diseño — pero no se asume que ahí termina la personalización visual.

**Llevado a código real:**
- **Identidad básica configurable**: sección "Identidad visual" en `ConfiguracionNegocio.js` (texto de bienvenida, color primario, color secundario, logo con vista previa), consumida en `src/app/[negocio]/page.js`. Verificado el 20/09/2026 contra Salón de Uñas Test.
- **Pantalla de "turno confirmado"**, ahora en el flujo real (antes era solo texto plano): encabezado con degradado usando los colores configurados del negocio, tarjeta resumen (servicio, sucursal, profesional, día/horario formateado, seña), aviso de pago pendiente, botón "Volver al inicio" que reinicia el flujo sin recargar la página. Verificado el 20/09/2026. (Rediseñada de nuevo en el Paso 5, Tramo 2, para mostrar el resultado real del pago.)
- **Categorías de servicios**: columna `categoria` (texto libre, opcional) sumada a `servicios` vía migración SQL manual corrida por Paulina en Supabase. Se puede cargar/editar por servicio desde `GestionServicios.js`. En el flujo de reserva del cliente, si hay servicios con categoría cargada aparecen pestañas para filtrar (Manos/Pies/Combos, o lo que cada negocio use); si no se usan categorías, se ve exactamente igual que antes. Verificado el 20/09/2026.
- **CRUD de sucursales**: pantalla nueva `src/app/admin/sucursales/GestionSucursales.js` (ruta `/admin/sucursales`, sumada al menú de `AdminShell.js`), con alta, edición y baja de sucursales (nombre y dirección opcional). No hizo falta ninguna migración: la tabla `sucursales` y sus políticas RLS ya existían desde el paso 1. El flujo de reserva del cliente ya decide solo si pedir sucursal (mira `sucursales.length` cargado, no el flag `tiene_sucursales` de `negocios`, que quedó sin usar en esa lógica) — en cuanto un negocio tenga 2+ sucursales cargadas desde el panel, el paso de elegir sucursal aparece automáticamente.
- **Vincular profesionales a sucursales**: en `GestionServicios.js`, junto a cada profesional, un selector de sucursal ("Todas las sucursales" o una puntual) que guarda al tocarlo, solo visible si el negocio tiene sucursales cargadas. En `src/app/[negocio]/page.js` (`elegirServicio`), la lista de profesionales a ofrecer se filtra por la sucursal elegida (sin sucursal asignada = "trabaja en todas", para no romper datos viejos).
- **Filtrado de servicios por sucursal**: a raíz de una pregunta de Paulina (qué pasa si un servicio directamente no existe en una sucursal, ej. "Depilación" solo en Chacras) — un servicio se oculta para la sucursal elegida si tiene profesionales vinculados pero ninguno trabaja ahí (si no tiene ningún profesional cargado todavía, se sigue mostrando en todas). Se decidió explícitamente **no separar en una web por sucursal**: la misma página/flujo sigue sirviendo a todas las sucursales de un negocio, la diferencia es puramente de datos (profesional ↔ servicio, profesional ↔ sucursal) — preserva la idea central de un solo motor compartido.
- Todavía no probado de punta a punta con un negocio real que use más de una sucursal con datos reales de reservas (Salón de Uñas Test tiene 2 sucursales cargadas para pruebas de diseño, ver más abajo, pero el flujo completo de reserva contra 2 sucursales no se probó todavía).

**Diseño a medida del piloto ("piel a medida"), llevado a código real el 25/09/2026** — a pedido explícito de Paulina ("llevemos el diseño by olivia al código real del piloto"), como parte de preparar el piloto para publicarlo como portfolio (ver `claude/camino-a-lanzamiento.md`). El diseño completo del mockup ya no es solo una maqueta: es el diseño real que ve un cliente al reservar en Salón de Uñas Test, con la reserva guardándose de verdad en Supabase, igual que con el diseño genérico.

Arquitectura elegida, siguiendo la decisión de Paulina de arriba (piel a medida por negocio, no ampliar el motor genérico):
- `src/lib/formatearFecha.js` (nuevo): la función `formatearFechaCorta` se movió acá desde `page.js`, sin cambiar su comportamiento, para que tanto el skin genérico como cualquier skin a medida la puedan usar sin duplicar código ni generar un import circular entre archivos.
- `src/app/[negocio]/SkinPilotoByOlivia.js` (nuevo, ~600 líneas): componente de presentación puro, sin lógica propia — recibe todo el estado y las funciones (elecciones, handlers de navegación, datos cargados de Supabase, etc.) como props desde `page.js`, que sigue siendo la única fuente de verdad de la lógica de reservas/pago/mail. Implementa las 9 pantallas del flujo real (landing, sucursal, servicio, profesional, día, horario, datos, verificando, confirmación) con el diseño completo de "by olivia": tipografías Italiana/Bebas Neue/Cormorant Garamond/Jost (cargadas por `<link>` a Google Fonts, igual que en el mockup), paleta de 4 colores con degradados, encabezado de paso con "← Volver" y contador ("Paso X de Y") + puntos de progreso calculados dinámicamente según qué pasos se van a preguntar de verdad (sucursal/profesional solo si corresponde saltearlos), tarjetas para sucursal/servicio/profesional, pestañas de categoría, chips de día y grilla de horarios, formulario de datos, y pantalla de confirmación con el resultado real del pago (aprobado/pendiente/rechazado, con botón de reintentar si corresponde). Todos los estilos quedan encapsulados bajo la clase `piel-by-olivia` / prefijo `bo-` para no interferir con el resto de la plataforma.
- `src/app/[negocio]/page.js`: ningún cambio en la lógica (hooks, handlers, cálculos) — se agregó solo un desvío justo antes del `return` final: si `slug === "unas-test"` se renderiza `<SkinPilotoByOlivia />` con todo lo necesario pasado como props, en vez del markup genérico de Tailwind. Cualquier otro negocio (incluidos los que se den de alta a futuro) sigue viendo el diseño genérico por defecto sin ningún cambio de comportamiento. El día que haya más negocios con diseño a medida, este `if` por slug puede evolucionar a un campo de configuración del negocio (por ejemplo `plantilla_visual`) en vez de estar hardcodeado.
- **Verificado en el navegador el 25/09/2026** contra `http://localhost:3000/unas-test`: landing con el degradado de 4 colores y la tipografía Italiana correctos, selección de sucursal (2 sucursales reales cargadas: "By Olivia centro" y "By Olivia Chacras"), selección de servicio con pestañas de categoría (Manos/Pies/Faciales) mostrando precios y duraciones reales, salteo automático del paso de profesional cuando el servicio solo tiene una persona vinculada (mostró "Paso 3 de 5" con el subtítulo "Manicura semipermanente con Martina"), y selección de día con los chips mostrando fechas reales generadas por `generarProximosDias`. Sin errores en la consola del navegador en ningún paso probado. El resto del flujo (horario, datos, pago, confirmación) reutiliza exactamente la misma lógica ya verificada en los Pasos 2, 5 y 7 — no se volvió a probar el pago real en esta sesión porque no cambió nada de esa lógica, solo la presentación.

**Todavía no llevado al código real:** nada pendiente de este paso — el diseño a medida quedó completo para el piloto. Si en el futuro se suma un negocio real con diseño propio, el patrón a seguir es el mismo: un componente de skin nuevo + el desvío por slug (o por configuración) en `page.js`.

**Paso 5 (integración de Mercado Pago) — completado (para el modo de prueba/localhost) el 22/09/2026, pendiente solo la vuelta automática cuando haya dominio real.**

Decisión clave de arquitectura, a pedido de Paulina: cada negocio va a cobrar la seña directo en **su propia** cuenta de Mercado Pago, no en la de Paulina — la plataforma es un facilitador (modelo "marketplace" de Mercado Pago), la plata nunca pasa por una cuenta central. Sin costo extra por usar la API: Mercado Pago cobra su comisión normal por transacción a quien recibe la plata (el negocio), hoy aproximadamente 6,29% + IVA con tarjeta de crédito y 3,25% + IVA con débito (acreditación inmediata; puede variar según impuestos provinciales — conviene confirmar en el panel de cada uno). Si en el futuro Paulina quiere cobrarle a cada negocio un % por usar la plataforma, Mercado Pago tiene un mecanismo para eso (`marketplace_fee`), pero es una decisión de negocio para más adelante, no bloquea nada.

Camino elegido para el modo de conexión: por ahora, **conexión manual** (el dueño del negocio pega su propio Access Token de Mercado Pago en el panel) en vez de OAuth completo ("Conectar con Mercado Pago" con un click) — más simple para empezar y validar que todo el flujo de cobro funciona; la conexión por OAuth queda anotada como mejora futura para cuando haya que sumar clientes reales sin pedirles que busquen su Access Token a mano — no requiere tocar la lógica de cobro (que ya lee el token desde `negocios_pagos`, sea cual sea el método por el que llegó ahí).

**Decisión de seguridad importante:** el Access Token de Mercado Pago NO se guarda en la tabla `negocios` — esa tabla tiene una política de lectura pública (`negocios_select_publico`, la necesita el flujo de reserva anónimo para leer colores/logo/horario) y guardar ahí un dato sensible lo dejaría expuesto a cualquiera que consulte la API de Supabase. Se creó una tabla nueva, **`negocios_pagos`** (`negocio_id` PK/FK a `negocios`, `mercadopago_access_token`, `actualizado_en`), con RLS habilitado y **sin política de lectura pública** — solo el dueño del negocio puede leer/escribir su propia fila (misma política `admin_propio` que ya se usa en sucursales/servicios/profesionales). El servidor necesita leer esta tabla para cobrarle a un cliente anónimo que todavía no tiene sesión — para eso hace falta la **Service Role Key** de Supabase (ignora RLS), que se agregó como variable en `.env.local` (`SUPABASE_SERVICE_ROLE_KEY`) que Paulina completó ella misma desde el dashboard de Supabase — nunca se comparte esa clave por chat. Migración de `negocios_pagos` corrida por Paulina y funcionando.

**Tramo 1 — crear preferencia de pago y redirigir al checkout — completado y verificado el 21/09/2026:**
- Sección "Mercado Pago" en `ConfiguracionNegocio.js` (dentro de `/admin/configuracion`) para pegar/actualizar el Access Token — una vez guardado, no se vuelve a mostrar el valor en pantalla (solo un check de "conectado"), para no reexponerlo innecesariamente.
- Paquete `mercadopago` (SDK oficial de Node.js, v3.6.1) instalado — nota técnica: por lentitud del entorno (carpeta sincronizada con OneDrive) el `npm install` completo no terminó de sincronizar `package-lock.json`; el paquete está funcional en `node_modules` y declarado a mano en `package.json`, pero conviene correr un `npm install` limpio antes de cualquier despliegue o `npm ci` futuro, cuando haya tiempo/mejor conexión.
- `src/lib/supabaseAdmin.js` (nuevo): cliente de Supabase server-only usando la Service Role Key — nunca se importa desde un componente `"use client"`.
- `src/app/api/crear-preferencia/route.js` (nuevo): ruta de API que, dado un `negocioId`/`reservaId`/`monto`, lee el Access Token del negocio desde `negocios_pagos` (con `supabaseAdmin`, saltando RLS) y crea una preferencia de pago en Mercado Pago (SDK `MercadoPagoConfig` + `Preference`), con `external_reference` = id de la reserva y `back_urls` de éxito/fallo/pendiente apuntando de vuelta a `/{slug}?pago=...&reserva=...`. Devuelve la URL de checkout (`sandbox_init_point` en modo prueba, `init_point` en producción).
- `src/app/[negocio]/page.js` (`confirmarReserva`): genera el `id` de la reserva en el cliente (`crypto.randomUUID()`) antes de insertarla, llama a `/api/crear-preferencia`, y redirige (`window.location.href`) a la URL de checkout que devuelve.
- Verificado por Paulina: al confirmar una reserva de prueba, la redirige correctamente a Mercado Pago con el servicio y monto correctos.

**Tramo 2 — verificar el pago al volver del checkout — completado y verificado el 22/09/2026:**
- `src/app/api/verificar-pago/route.js`: recibe `reservaId` y `paymentId` y delega toda la lógica real a `confirmarPagoDeReserva` (ver Paso 8, se extrajo a `src/lib/confirmarPago.js` para compartirla con el webhook).
- `src/app/[negocio]/page.js`: nuevo `useEffect` que, al cargar la página, lee `?pago=...&reserva=...` (y `payment_id`/`collection_id`) de la URL; si están presentes, muestra una pantalla "verificando" y llama a `/api/verificar-pago`. La pantalla de "confirmación" se reescribió para mostrar el resultado real devuelto por esa verificación (aprobado / pendiente / rechazado / sin pago), en vez de depender del estado local del flujo (que no sobrevive la ida y vuelta a Mercado Pago). Si el pago fue rechazado, aparece un botón "Reintentar pago" (`reintentarPago`) que vuelve a llamar a `/api/crear-preferencia` con los mismos datos de la reserva, sin tener que cargar todo el flujo de nuevo. `volverAlInicio` ahora también limpia los parámetros de la URL (`history.replaceState`).
- **Verificado el 22/09/2026** con una prueba real (cuenta de comprador de prueba de Mercado Pago + tarjeta de prueba con titular `APRO`): el pago se aprobó correctamente del lado de Mercado Pago. Como se explica abajo, en `localhost` Mercado Pago no redirige automáticamente de vuelta, así que la verificación se probó llamando a la lógica del servidor directamente (una ruta de diagnóstico temporal, creada y borrada en la misma sesión) en vez de por la pantalla — confirmó que encuentra el pago real, lo valida contra `external_reference`, y actualiza la reserva a `confirmada` con todos los datos correctos. El "volver a la web" real (por `back_url`) queda para probarse cuando el sitio tenga un dominio público.

**Limitación conocida de probar en `localhost` (no es un bug):** la documentación oficial de Mercado Pago dice explícitamente que no hay que usar `localhost` ni una IP local como `back_url` — por eso, al pagar desde `localhost`, Mercado Pago no ofrece un botón para volver al sitio (solo "ver comprobante"), y tampoco funciona `auto_return` (que además requiere HTTPS). Esto se soluciona solo apenas el sitio tenga un dominio público real: ahí `back_urls` va a apuntar a ese dominio (ya sale de `window.location.origin`, no hace falta tocar código) y Mercado Pago va a poder redirigir de vuelta con o sin `auto_return`. Esta misma limitación (necesitar un dominio público real) es la que también bloquea probar el webhook del Paso 8. Alternativa para probar cualquiera de las dos antes de publicar, si se quiere: un túnel temporal tipo ngrok que le da a `localhost` una URL pública por un rato — quedó ofrecida, no armada todavía.

**Todavía no hecho de este paso:**
- Conexión OAuth ("Conectar con Mercado Pago" con un click) para futuros clientes reales, en vez de pegar el token a mano — mejora futura, no bloquea nada de lo ya construido.
- No se decidió todavía si un pago rechazado debería, después de un tiempo sin reintento, liberar el horario automáticamente (hoy queda `pendiente_pago` indefinidamente hasta que el cliente reintente o la dueña cancele a mano desde el panel).

**Paso 6 (botón "volver atrás" en el flujo de reserva) — completado y verificado el 22/09/2026.**

En `src/app/[negocio]/page.js`: se sumó un historial de pantallas (`historialPantallas`, un array simple) y un helper `irAPantalla(pantalla)` que reemplazó todos los `setPantallaActual(...)` de avance en el flujo — cada vez que se avanza, la pantalla actual queda anotada en el historial antes de cambiar. `volverAtras()` saca la última pantalla del historial y vuelve a ella. Como el historial registra el camino realmente recorrido (no una secuencia fija de pasos), respeta solo los pasos que el cliente vio de verdad: si se saltearon sucursal o profesional (por tener una sola opción), "volver atrás" no los muestra tampoco, va directo al paso anterior real. Se agregó un botón "← Volver" al principio de cada una de las 6 pantallas intermedias (sucursal, servicio, profesional, día, horario, datos) — no en landing (no hay adónde volver) ni en verificando/confirmación (esas ya tienen su propio botón "Volver al inicio" y no tiene sentido volver atrás en medio de la verificación de un pago). No hizo falta ninguna migración ni tocar el panel de administración.

**Paso 7 (notificaciones por email a la dueña) — completado y verificado de punta a punta el 25/09/2026.**

Se eligió **Resend** como servicio de envío (mencionado como opción desde el plan original, junto con SendGrid). Decisión de producto (elegida por Paulina): el email se manda **recién cuando se confirma el pago de la seña**, no apenas se genera la reserva — así la dueña solo recibe avisos de turnos reales, sin ruido de reservas que alguien empezó y no llegó a pagar.

**Llevado a código y configurado por Paulina:**
- Migración `alter table public.negocios add column email_notificaciones text;` — corrida por Paulina en Supabase.
- Nueva sección "Notificaciones" en `ConfiguracionNegocio.js` (dentro del mismo formulario de "Guardar cambios" que identidad visual/horario/seña): un input de email para que la dueña indique a dónde le llegan los avisos. Paulina cargó su propio email ahí.
- Paquete `resend` instalado (v6.28.1). Nota técnica: acá también `npm install` chocó con el mismo problema de archivos bloqueados en `node_modules` visto con `mercadopago` (ver más abajo) — se resolvió empaquetando el paquete y sus dependencias (`postal-mime`, `standardwebhooks`, `@stablelib/base64`, `fast-sha256`) con `npm pack` uno por uno y extrayéndolos a mano en `node_modules`, sin pasar por el proceso de `npm install` completo que falla. Package.json actualizado a mano igual que con `mercadopago`.
- `RESEND_API_KEY` en `.env.local`, completada por Paulina con su propia clave de Resend (cuenta creada por ella) — nunca se compartió por chat.
- La lógica de mandar el aviso (`avisarNuevoTurno`) vive en `src/lib/confirmarPago.js` (ver Paso 8) y se dispara al confirmar el pago por primera vez (`nuevoEstado === "confirmada" && reserva.estado !== "confirmada"`, o sea que no se reenvía si se refresca la pantalla ya confirmada): manda un email con servicio, sucursal, profesional, día/horario, seña pagada, nombre y teléfono del cliente. Si el negocio no cargó `email_notificaciones`, o si `RESEND_API_KEY` no está configurada, no manda nada (sin romper la confirmación del pago). Cualquier error al mandar el email se loguea pero nunca hace fallar la respuesta al cliente — el email es un aviso, no una condición para confirmar el turno.

**Verificado el 25/09/2026:** Paulina completó una reserva de prueba pagando con su cuenta de comprador de prueba de Mercado Pago (en incógnito), pero por la misma limitación de `localhost` explicada en el Paso 5, Mercado Pago no la redirigió de vuelta al sitio, así que la reserva quedó `pendiente_pago` y el email no se disparó todavía. Se repitió la técnica del Paso 5 (ruta de diagnóstico temporal, creada y borrada en la misma sesión) para forzar del lado del servidor la misma verificación que hubiera disparado la vuelta del checkout: encontró el pago real (`approved`) en Mercado Pago, confirmó la reserva, y mandó el email — **Paulina confirmó que le llegó correctamente**, con todos los datos del turno. Con esto, Paso 7 queda confirmado funcionando de punta a punta; en producción (con dominio real) va a pasar solo, sin necesitar ningún truco de diagnóstico.

**Importante sobre el modo de prueba de Resend (sin dominio propio verificado):** el remitente usado es `onboarding@resend.dev`, el de pruebas que da Resend por defecto. Resend solo deja mandar con ese remitente a la **misma dirección de email con la que te registraste** en tu cuenta de Resend — a cualquier otra dirección da error 403. Por eso Paulina cargó en "Notificaciones" del panel el mismo email con el que se registró en Resend. Para mandar a cualquier destinatario (necesario para negocios reales en el futuro) hay que verificar un dominio propio en Resend (agregar registros DNS) — queda pendiente para cuando haya un dominio de la plataforma.

**Todavía no hecho de este paso:**
- Verificar un dominio propio en Resend — recién tiene sentido cuando haya un dominio real de la plataforma (mismo momento en que se resuelve la vuelta automática de Mercado Pago, ver Paso 5).
- No se armó ningún email de aviso al cliente (solo a la dueña) — quedó fuera de este paso, se puede sumar después si hace falta.

**Paso 8 (webhook server-to-server de Mercado Pago) — programado el 25/09/2026, pendiente de configurar y probar cuando haya un dominio público.**

Hasta ahora, la única manera de confirmar un pago era que el cliente volviera del checkout de Mercado Pago a la web (`back_url`) y ahí se llamara a `/api/verificar-pago`. Eso tiene un punto débil: si el cliente cierra la pestaña, se corta la conexión, o Mercado Pago no llega a redirigir, la reserva puede quedar `pendiente_pago` para siempre aunque el pago sí se haya acreditado. Los webhooks son una notificación que manda el propio Mercado Pago directo al servidor apenas cambia el estado de un pago, sin depender del navegador del cliente — una confirmación más robusta, pensada como respaldo de la vuelta por `back_url`, no como reemplazo (las dos rutas conviven).

**Refactor previo:** para que la vuelta del checkout y el webhook confirmen los pagos exactamente de la misma manera (incluido el envío del email de aviso), toda la lógica de "verificar un pago real en Mercado Pago y confirmar la reserva" se extrajo de `api/verificar-pago/route.js` a una función compartida, `confirmarPagoDeReserva`, en `src/lib/confirmarPago.js` (junto con `avisarNuevoTurno`, movida ahí también). `api/verificar-pago/route.js` ahora es solo un wrapper fino que llama a esa función. Este mismo `confirmarPagoDeReserva` es el que usa también el skin a medida "by olivia" del Paso 4 — nunca se tocó, solo se le pasa la misma información desde una presentación distinta.

**Llevado a código:**
- Migración pendiente de correr por Paulina: `alter table public.negocios_pagos add column mercadopago_webhook_secret text;` — la clave secreta para validar que una notificación realmente viene de Mercado Pago (ver más abajo), una por negocio (cada uno tiene su propia aplicación/cuenta de Mercado Pago).
- `src/app/api/webhooks/mercadopago/route.js` (nuevo): recibe la notificación `POST` de Mercado Pago. La URL a cargar en el panel de Mercado Pago de cada negocio (**Tus integraciones → la app de ese negocio → Webhooks → Configurar notificaciones**, evento "Pagos") es `https://<dominio>/api/webhooks/mercadopago?negocioId=<id del negocio>` — el parámetro `negocioId` es propio de la plataforma (no de Mercado Pago), necesario porque una sola ruta atiende a todos los negocios. Al llegar una notificación de tipo `payment`: valida la firma (`x-signature`, ver abajo), busca el pago real en la API de Mercado Pago con el token del negocio para obtener su `external_reference` (= id de la reserva), y llama a `confirmarPagoDeReserva` con esos datos — la misma función que usa la vuelta del checkout. Siempre responde `200` aunque algo interno falle (menos si la firma es inválida, ahí responde `401`), para no hacer que Mercado Pago reintente sin sentido ni desactive la URL por marcarla como rota.
- Validación de firma: Mercado Pago manda un header `x-signature` (formato `ts=...,v1=...`) y `x-request-id`. Se arma un "manifest" con el formato exacto que exige Mercado Pago (`id:{payment_id};request-id:{x-request-id};ts:{ts};`, con el id en minúsculas, omitiendo cualquier parte ausente) y se calcula `HMAC-SHA256(manifest, clave_secreta_del_negocio)`, comparando el resultado con `v1` (con `crypto.timingSafeEqual`, para evitar ataques de timing). Si el negocio todavía no cargó su clave secreta, la notificación se procesa igual pero sin verificar la firma (se loguea como advertencia), para no perderla mientras se termina de configurar.
- Nueva sub-sección "Webhook (aviso automático de pagos)" en `ConfiguracionNegocio.js`, dentro de la sección "Mercado Pago": muestra la URL exacta a pegar en el panel de Mercado Pago (armada con `negocio.id` y el dominio actual) y un campo para pegar la clave secreta que Mercado Pago genera al configurar esa URL. Mismo patrón de seguridad que el Access Token: una vez guardada, no se vuelve a mostrar en pantalla.

**Por qué no se pudo probar todavía:** los webhooks los tiene que poder alcanzar el servidor de Mercado Pago desde internet — no llegan a `localhost`, ni siquiera abriendo la web en el navegador (a diferencia de la vuelta por `back_url`, que sí depende del navegador del cliente y por eso se pudo simular con una ruta de diagnóstico temporal). Queda armado y documentado, pero la prueba real de punta a punta —incluida la validación de firma— recién se puede hacer cuando el sitio tenga un dominio público (o, antes, con un túnel tipo ngrok si se quiere adelantar la prueba).

**Todavía no hecho de este paso:**
- Que Paulina corra la migración de `mercadopago_webhook_secret`.
- Configurar la URL del webhook y pegar la clave secreta, tanto para el momento en que haya dominio real como, opcionalmente, antes con un túnel de prueba.
- Probar de punta a punta: que un pago real dispare la notificación, que la firma valide correctamente, y que la reserva se confirme (y mande el email) sin que el cliente haya vuelto a la web.

## Próximo bloque de trabajo (08/10/2026) — preparar el primer cliente

Desde el 08/10/2026 el trabajo sigue en Claude Code (antes Claude Cowork). Se comparó la landing del servicio ("Agenda Estudio", `C:\Users\pauli\agenda-estudio\sena-estudio.html`: $120.000 único + $25.000/mes, diseño a medida siempre incluido) con el código, y faltan funciones que la landing promete: mail con comprobante al cliente, recordatorio automático 24 h antes, dominio propio por cliente, botón "agregar al calendario" y, opcional, usuarios por profesional. El detalle y el orden están en la Parte 3 de `claude/camino-a-lanzamiento.md`. `schema-supabase.sql` se actualizó para incluir `categoria`, `email_notificaciones` y `negocios_pagos`.

## Notas técnicas generales para sesiones futuras
- El entorno remoto donde corre el asistente no puede levantar el `next dev` de este proyecto (limitación de SO/binarios nativos) — las pruebas en navegador las tiene que hacer Paulina en su propia compu. Cada vez que cierra la terminal o reinicia la compu, hay que volver a correr `npm run dev` desde la carpeta del proyecto antes de poder abrir `localhost:3000`.
- La carpeta del proyecto está sincronizada con OneDrive, y algunos días el acceso a los archivos desde el entorno remoto es mucho más lento de lo normal (ESLint o npm install pueden tardar varios minutos en vez de segundos) — no es un problema del código, conviene tenerlo en cuenta y no asumir que algo se rompió solo porque un comando tarda.
- **Si después de reiniciar `npm run dev` páginas que antes andaban empiezan a tirar 404 (incluso rutas estáticas como `/admin/configuracion`)**, es la caché de compilación de Next.js (carpeta `.next`) corrupta o desincronizada por OneDrive, no un bug de código — se soluciona cortando el servidor, borrando la carpeta `.next` (pedir permiso de borrado sobre esa carpeta específica, que es una de las `connectedFolders`) y volviendo a correr `npm run dev` (la primera compilación después va a tardar más de lo normal). Pasó una vez, el 22/09/2026, después de reiniciar el servidor para cargar el nuevo `RESEND_API_KEY`.
- La terminal/shell donde el asistente corre comandos en la compu de Paulina (para editar archivos, instalar paquetes, etc.) no tiene salida a internet general (no llega a Supabase ni a Mercado Pago vía `fetch`) — solo el navegador y el propio servidor `next dev` de Paulina tienen salida real. Para diagnósticos que necesiten llamar a APIs externas (como se hizo para verificar el Tramo 2 de Mercado Pago y el Paso 7 de emails), conviene crear una ruta de API temporal dentro del proyecto (que sí corre con la salida a internet del servidor) y visitarla desde un navegador, en vez de intentar pegarle a esas APIs desde la terminal. El registro de npm sí es alcanzable desde esa terminal (`npm install`/`npm pack` funcionan), aunque instalar paquetes nuevos a veces choca con archivos bloqueados dentro de `node_modules` (ver nota siguiente).
- **`npm install` de paquetes nuevos falla seguido con `EACCES ... rename`** dentro de `node_modules`, aparentemente porque el servidor `next dev` de Paulina (corriendo en Windows, fuera de este entorno) mantiene abiertos archivos que npm necesita mover al reorganizar el árbol de dependencias — pedir permiso de borrado (`device_request_delete_permission`) no alcanza a resolverlo solo. Workaround que funcionó dos veces (con `mercadopago` y con `resend`): usar `npm pack <paquete>` (que solo descarga un `.tgz`, sin tocar nada más de `node_modules`) y extraerlo a mano con `tar` dentro de `node_modules/<paquete>`, repitiendo para cada dependencia que declare el paquete en su propio `package.json` (revisando a mano, ya que resolver la recursión completa a ciegas puede tener bugs) hasta que `require(...)` funcione sin errores de módulo faltante. Después, agregar la línea a `package.json` a mano. Queda pendiente correr un `npm install` limpio (con la carpeta del proyecto cerrada del todo, sin `next dev` corriendo) antes de cualquier despliegue o `npm ci`, para que `package-lock.json` quede sincronizado de verdad.
- **Escribir archivos nuevos o grandes directamente en la carpeta del negocio**: cuando hace falta crear un archivo nuevo con contenido extenso (por ejemplo un componente de skin a medida completo), conviene escribirlo con un heredoc (`cat > archivo << 'EOF' ... EOF`) directo en la terminal de la compu de Paulina, con el delimitador entre comillas simples para que la shell no interprete signos `$` ni backticks del contenido (importante si el archivo tiene template literals de JavaScript). Se verificó dos veces en el Paso 4 (con `formatearFecha.js` y `SkinPilotoByOlivia.js`, este último de ~600 líneas) que esto funciona sin truncarse ni corromperse. Antes de escribirlo en la compu de Paulina, conviene redactarlo y chequear su sintaxis en el entorno del asistente (por ejemplo con `esbuild --loader:.js=jsx`, ya que `node -c` no siempre detecta errores de JSX) para no gastar intentos en la compu real.

---

## Nota aparte (proyecto separado, no parte de este desarrollo)
También voy a necesitar más adelante una landing page personal tipo portfolio, para presentar mi servicio de creación de estas plataformas a negocios de estética. Es un proyecto de una sola vez, con estilo editorial/lujo (tipografía serif, paleta dorado/crema/marrón, fotos grandes). No es parte de este desarrollo — lo menciono para que quede registrado, pero lo vamos a abordar en otra sesión.
