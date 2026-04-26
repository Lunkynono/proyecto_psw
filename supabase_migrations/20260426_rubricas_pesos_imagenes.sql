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
