-- ============================================================
-- Esquema: Plataforma de turnos multi-negocio
-- Aprobado en revisión: paso 1 (modelo de datos) del plan de trabajo
-- Incluye migración de horario de atención y vista pública de
-- turnos_ocupados (16/09/2026), migración de bloqueo manual de
-- horarios (17/09/2026), tabla de ausencias de profesionales
-- (17/09/2026), migración de duración variable por turno
-- (17/09/2026, migraciones pendientes de correr — ver
-- migracion_ausencias_profesionales.sql y
-- migracion_duracion_variable.sql) y columna "modo_demo" en negocios
-- (26/09/2026, ver migración al final de este archivo, pendiente de
-- correr en Supabase).
--
-- Actualizado el 08/10/2026 para reflejar TODO lo que ya está aplicado en
-- Supabase (antes faltaba): columna "categoria" en servicios (Paso 4),
-- "email_notificaciones" en negocios (Paso 7) y la tabla "negocios_pagos"
-- con "mercadopago_webhook_secret" (Pasos 5 y 8). Al final del archivo
-- quedan las migraciones explícitas, por si hay que recrear la base.
-- ============================================================

create extension if not exists pgcrypto;

-- ============================================================
-- NEGOCIOS
-- ============================================================
create table public.negocios (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  nombre text not null,
  rubro text,
  logo_url text,
  color_primario text,
  color_secundario text,
  texto_bienvenida text,
  tiene_sucursales boolean not null default false,
  porcentaje_o_monto_sena numeric,
  tipo_sena text check (tipo_sena in ('porcentaje', 'monto_fijo')),
  slug text not null unique,
  horario_apertura time not null default '09:00',
  horario_cierre time not null default '18:00',
  -- Días que atiende: 0=domingo, 1=lunes, ..., 6=sábado (mismo criterio que Date.getDay() en JS)
  dias_atencion integer[] not null default '{1,2,3,4,5,6}',
  -- Si es true, el flujo de reserva de ESTE negocio no llama a Mercado Pago
  -- de verdad: simula la seña aprobada al toque (ver src/lib/confirmarPago.js,
  -- confirmarReservaDemo). Pensado para el piloto de portfolio, para que
  -- cualquiera pueda recorrer el flujo completo sin necesitar una cuenta de
  -- prueba de Mercado Pago. Sumado 26/09/2026.
  modo_demo boolean not null default false,
  -- A dónde avisarle a la dueña de cada turno nuevo confirmado (Resend,
  -- ver src/lib/confirmarPago.js, avisarNuevoTurno). Sumado 25/09/2026.
  email_notificaciones text,
  creado_en timestamptz not null default now()
);

create index idx_negocios_owner_id on public.negocios(owner_id);

-- ============================================================
-- NEGOCIOS_PAGOS (credenciales de Mercado Pago, separadas de "negocios")
-- ============================================================
-- "negocios" tiene lectura pública, así que los datos sensibles de cobro
-- viven acá, SIN política de lectura pública: solo el dueño lee/escribe su
-- fila, y el servidor la lee con la Service Role Key (src/lib/supabaseAdmin.js).
create table public.negocios_pagos (
  negocio_id uuid primary key references public.negocios(id) on delete cascade,
  mercadopago_access_token text,
  -- Clave secreta para validar la firma x-signature del webhook (Paso 8)
  mercadopago_webhook_secret text,
  actualizado_en timestamptz not null default now()
);

-- ============================================================
-- SUCURSALES
-- ============================================================
create table public.sucursales (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios(id) on delete cascade,
  nombre text not null,
  direccion text
);

create index idx_sucursales_negocio_id on public.sucursales(negocio_id);

-- ============================================================
-- PROFESIONALES
-- ============================================================
create table public.profesionales (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios(id) on delete cascade,
  nombre text not null,
  sucursal_id uuid references public.sucursales(id) on delete set null
);

create index idx_profesionales_negocio_id on public.profesionales(negocio_id);
create index idx_profesionales_sucursal_id on public.profesionales(sucursal_id);

-- ============================================================
-- SERVICIOS
-- ============================================================
create table public.servicios (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios(id) on delete cascade,
  nombre text not null,
  descripcion text,
  precio numeric not null,
  duracion_minutos integer not null,
  -- Texto libre opcional (Manos / Pies / Faciales...). Si algún servicio la
  -- tiene, el flujo de reserva muestra pestañas para filtrar. Sumado 20/09/2026.
  categoria text
);

create index idx_servicios_negocio_id on public.servicios(negocio_id);

-- ============================================================
-- SERVICIOS_PROFESIONALES (muchos a muchos)
-- ============================================================
create table public.servicios_profesionales (
  servicio_id uuid not null references public.servicios(id) on delete cascade,
  profesional_id uuid not null references public.profesionales(id) on delete cascade,
  primary key (servicio_id, profesional_id)
);

create index idx_servicios_profesionales_profesional_id on public.servicios_profesionales(profesional_id);

-- ============================================================
-- AUSENCIAS DE PROFESIONALES
-- ============================================================
-- Un profesional no puede trabajar un día puntual (vacaciones, licencia,
-- etc.). El flujo de reserva del cliente consulta esta tabla al elegir
-- profesional para no ofrecer esos días.
create table public.ausencias_profesionales (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios(id) on delete cascade,
  profesional_id uuid not null references public.profesionales(id) on delete cascade,
  fecha date not null,
  motivo text,
  creado_en timestamptz not null default now(),
  unique (profesional_id, fecha)
);

create index idx_ausencias_negocio_id on public.ausencias_profesionales(negocio_id);
create index idx_ausencias_profesional_id on public.ausencias_profesionales(profesional_id);
create index idx_ausencias_fecha on public.ausencias_profesionales(fecha);

-- ============================================================
-- RESERVAS
-- ============================================================
-- "servicio_id" puede quedar vacío: además de las reservas reales de
-- clientes (que siempre tienen un servicio), la dueña puede crear desde el
-- panel un "bloqueo manual" para marcar un horario como ocupado (por
-- ejemplo, lo reservó por WhatsApp) sin que corresponda a un servicio
-- puntual. "bloqueo_manual" distingue esas filas de las reservas reales.
-- "duracion_minutos" se guarda en el momento de la reserva (una "foto" de
-- la duración del servicio, o la que elija la dueña para un bloqueo
-- manual), no se recalcula desde "servicios" cada vez: así, si más
-- adelante se edita la duración de un servicio, no se reinterpretan
-- reservas viejas. Los turnos ya no son bloques fijos: la grilla de
-- horarios de inicio es cada 30 minutos (INTERVALO_TURNO_MINUTOS en
-- src/lib/horarios.js) y cada reserva ocupa el rango real que dura su
-- servicio.
create table public.reservas (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios(id) on delete cascade,
  sucursal_id uuid references public.sucursales(id) on delete set null,
  servicio_id uuid references public.servicios(id),
  profesional_id uuid references public.profesionales(id),
  nombre_cliente text not null,
  telefono_cliente text,
  email_cliente text,
  fecha date not null,
  hora time not null,
  duracion_minutos integer not null check (duracion_minutos > 0),
  estado text not null default 'pendiente_pago'
    check (estado in ('pendiente_pago', 'confirmada', 'cancelada')),
  monto_sena numeric,
  id_pago_mercadopago text,
  bloqueo_manual boolean not null default false,
  -- Cuándo se le mandó al cliente el mail de recordatorio del día anterior
  -- (vacío = todavía no). Lo marca api/cron/recordatorios para no mandarlo
  -- dos veces. Sumado 08/10/2026.
  recordatorio_enviado_en timestamptz,
  creado_en timestamptz not null default now()
);

create index idx_reservas_negocio_id on public.reservas(negocio_id);
create index idx_reservas_sucursal_id on public.reservas(sucursal_id);
create index idx_reservas_servicio_id on public.reservas(servicio_id);
create index idx_reservas_profesional_id on public.reservas(profesional_id);
create index idx_reservas_fecha on public.reservas(fecha);

-- ============================================================
-- VISTA PÚBLICA: turnos_ocupados
-- ============================================================
-- "reservas" solo la puede leer el dueño del negocio (ver política más abajo),
-- porque tiene datos personales del cliente. Pero el flujo de reserva (que
-- corre sin login) necesita poder chequear qué horarios ya están ocupados
-- para no ofrecerlos de nuevo. Esta vista expone solo lo mínimo necesario
-- (negocio, profesional, fecha, hora, duración) sin nombre/teléfono/email,
-- y es pública. Como la vista la crea el dueño de la tabla, la consulta que
-- hace por dentro no queda sujeta a las políticas de RLS de "reservas". Los
-- bloqueos manuales también aparecen acá (mismo negocio/profesional/fecha/
-- hora/duración), así que el flujo de reserva del cliente los respeta
-- igual que a una reserva real. La duración se usa para calcular
-- superposición de rangos (no solo coincidencia exacta de horario), ya que
-- los turnos pueden durar distinto según el servicio.
create view public.turnos_ocupados as
select negocio_id, profesional_id, fecha, hora, duracion_minutos
from public.reservas
where estado <> 'cancelada';

grant select on public.turnos_ocupados to anon, authenticated;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.negocios enable row level security;
alter table public.negocios_pagos enable row level security;
alter table public.sucursales enable row level security;
alter table public.profesionales enable row level security;
alter table public.servicios enable row level security;
alter table public.servicios_profesionales enable row level security;
alter table public.ausencias_profesionales enable row level security;
alter table public.reservas enable row level security;

-- ---- NEGOCIOS ----
-- Lectura pública: la necesita el flujo de reserva y la landing, sin login
create policy "negocios_select_publico"
  on public.negocios for select
  using (true);

-- Solo el dueño autenticado puede crear/editar/borrar su propio negocio
create policy "negocios_insert_propio"
  on public.negocios for insert
  with check (auth.uid() = owner_id);

create policy "negocios_update_propio"
  on public.negocios for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "negocios_delete_propio"
  on public.negocios for delete
  using (auth.uid() = owner_id);

-- ---- NEGOCIOS_PAGOS ----
-- Sin política de lectura pública a propósito (datos sensibles).
-- (El nombre exacto de la política en Supabase puede ser otro; lo que
-- importa es la regla: solo el dueño del negocio.)
create policy "negocios_pagos_admin_propio"
  on public.negocios_pagos for all
  using (
    exists (
      select 1 from public.negocios n
      where n.id = negocios_pagos.negocio_id and n.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.negocios n
      where n.id = negocios_pagos.negocio_id and n.owner_id = auth.uid()
    )
  );

-- ---- SUCURSALES ----
create policy "sucursales_select_publico"
  on public.sucursales for select
  using (true);

create policy "sucursales_admin_propio"
  on public.sucursales for all
  using (
    exists (
      select 1 from public.negocios n
      where n.id = sucursales.negocio_id and n.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.negocios n
      where n.id = sucursales.negocio_id and n.owner_id = auth.uid()
    )
  );

-- ---- PROFESIONALES ----
create policy "profesionales_select_publico"
  on public.profesionales for select
  using (true);

create policy "profesionales_admin_propio"
  on public.profesionales for all
  using (
    exists (
      select 1 from public.negocios n
      where n.id = profesionales.negocio_id and n.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.negocios n
      where n.id = profesionales.negocio_id and n.owner_id = auth.uid()
    )
  );

-- ---- SERVICIOS ----
create policy "servicios_select_publico"
  on public.servicios for select
  using (true);

create policy "servicios_admin_propio"
  on public.servicios for all
  using (
    exists (
      select 1 from public.negocios n
      where n.id = servicios.negocio_id and n.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.negocios n
      where n.id = servicios.negocio_id and n.owner_id = auth.uid()
    )
  );

-- ---- SERVICIOS_PROFESIONALES ----
create policy "servicios_profesionales_select_publico"
  on public.servicios_profesionales for select
  using (true);

create policy "servicios_profesionales_admin_propio"
  on public.servicios_profesionales for all
  using (
    exists (
      select 1 from public.servicios s
      join public.negocios n on n.id = s.negocio_id
      where s.id = servicios_profesionales.servicio_id and n.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.servicios s
      join public.negocios n on n.id = s.negocio_id
      where s.id = servicios_profesionales.servicio_id and n.owner_id = auth.uid()
    )
  );

-- ---- AUSENCIAS_PROFESIONALES ----
-- Lectura pública: la necesita el flujo de reserva (sin login) para saber
-- qué días saltear para cada profesional.
create policy "ausencias_select_publico"
  on public.ausencias_profesionales for select
  using (true);

create policy "ausencias_admin_propio"
  on public.ausencias_profesionales for all
  using (
    exists (
      select 1 from public.negocios n
      where n.id = ausencias_profesionales.negocio_id and n.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.negocios n
      where n.id = ausencias_profesionales.negocio_id and n.owner_id = auth.uid()
    )
  );

-- ---- RESERVAS ----
-- Cualquier visitante (incluso anónimo) puede crear una reserva; también es
-- la política que usa la dueña autenticada para crear un bloqueo manual.
create policy "reservas_insert_publico"
  on public.reservas for insert
  with check (true);

-- Solo el dueño del negocio puede ver/editar/borrar sus reservas
create policy "reservas_select_propio"
  on public.reservas for select
  using (
    exists (
      select 1 from public.negocios n
      where n.id = reservas.negocio_id and n.owner_id = auth.uid()
    )
  );

create policy "reservas_update_propio"
  on public.reservas for update
  using (
    exists (
      select 1 from public.negocios n
      where n.id = reservas.negocio_id and n.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.negocios n
      where n.id = reservas.negocio_id and n.owner_id = auth.uid()
    )
  );

create policy "reservas_delete_propio"
  on public.reservas for delete
  using (
    exists (
      select 1 from public.negocios n
      where n.id = reservas.negocio_id and n.owner_id = auth.uid()
    )
  );

-- ============================================================
-- MIGRACIÓN: modo_demo en negocios (26/09/2026)
-- ============================================================
-- Correr esto en el SQL Editor de Supabase (el esquema de arriba ya
-- refleja el resultado final, pero como la tabla "negocios" ya existe con
-- datos reales, hace falta la migración explícita en vez de recrearla).
alter table public.negocios
  add column if not exists modo_demo boolean not null default false;

-- Activa el modo demo en el piloto público (Salón de Uñas Test), para que
-- cualquiera pueda recorrer el flujo completo sin necesitar una cuenta de
-- prueba de Mercado Pago.
update public.negocios
  set modo_demo = true
  where slug = 'unas-test';

-- ============================================================
-- MIGRACIONES YA CORRIDAS (registradas acá el 08/10/2026)
-- ============================================================
-- Todas ya están aplicadas en Supabase. Quedan anotadas solo como registro
-- (son idempotentes, correrlas de nuevo no rompe nada).
alter table public.servicios
  add column if not exists categoria text;                         -- Paso 4

alter table public.negocios
  add column if not exists email_notificaciones text;              -- Paso 7

alter table public.negocios_pagos
  add column if not exists mercadopago_webhook_secret text;        -- Paso 8

-- ============================================================
-- MIGRACIÓN: recordatorio del día anterior (08/10/2026)
-- ============================================================
-- Correr en el SQL Editor de Supabase ANTES de que la tarea diaria de
-- recordatorios (api/cron/recordatorios) corra por primera vez.
alter table public.reservas
  add column if not exists recordatorio_enviado_en timestamptz;
