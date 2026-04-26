-- Ejecutar en el SQL Editor de Supabase antes de usar rubricas, pesos por opcion e imagenes.

alter table public.evento
  add column if not exists imagen_url text;

alter table public.criterio_opcion
  add column if not exists peso numeric default 0,
  add column if not exists aspecto text,
  add column if not exists nivel text,
  add column if not exists descriptor text;

alter table public.criterio
  drop constraint if exists criterio_tipo_check;

alter table public.criterio
  add constraint criterio_tipo_check
  check (tipo in ('numerico', 'radio', 'checklist', 'comentario', 'rubrica'));

-- Imagen por competición
alter table public.competicion
  add column if not exists imagen_url text;

-- Horas de apertura/cierre para encuestas programadas
alter table public.encuesta
  add column if not exists hora_apertura timestamptz,
  add column if not exists hora_cierre timestamptz,
  add column if not exists hora_reapertura timestamptz;

-- Añadir estado 'programada' al check de encuesta.estado
alter table public.encuesta
  drop constraint if exists encuesta_estado_check;

alter table public.encuesta
  add constraint encuesta_estado_check
  check (estado in ('borrador', 'abierta', 'programada', 'cerrada'));

alter table public.encuesta
  drop constraint if exists encuesta_horario_orden_check,
  drop constraint if exists encuesta_programada_apertura_check;

alter table public.encuesta
  add constraint encuesta_horario_orden_check
    check (hora_cierre is null or hora_apertura is null or hora_cierre > hora_apertura),
  add constraint encuesta_programada_apertura_check
    check (estado <> 'programada' or hora_apertura is not null);

create or replace function public.procesar_encuestas_programadas()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.encuesta
  set estado = 'abierta',
      hora_apertura = now()
  where estado = 'programada'
    and hora_apertura is not null
    and hora_apertura <= now();

  update public.encuesta
  set estado = 'cerrada',
      hora_cierre = now()
  where estado in ('abierta', 'programada')
    and hora_cierre is not null
    and hora_cierre <= now();
end;
$$;

grant execute on function public.procesar_encuestas_programadas() to authenticated, anon;

insert into storage.buckets (id, name, public)
values ('eventos', 'eventos', true)
on conflict (id) do update set public = true;

drop policy if exists "Ver imagenes de eventos" on storage.objects;
create policy "Ver imagenes de eventos"
  on storage.objects for select
  using (bucket_id = 'eventos');

drop policy if exists "Subir imagenes de eventos autenticado" on storage.objects;
create policy "Subir imagenes de eventos autenticado"
  on storage.objects for insert
  with check (bucket_id = 'eventos' and auth.uid() is not null);

drop policy if exists "Actualizar imagenes de eventos autenticado" on storage.objects;
create policy "Actualizar imagenes de eventos autenticado"
  on storage.objects for update
  using (bucket_id = 'eventos' and auth.uid() is not null);
