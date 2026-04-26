-- Función para abrir/cerrar encuestas programadas automáticamente.
-- El frontend la llama cada 30 s (polling). Para que funcione sin navegador,
-- activa pg_cron en Supabase (Database → Extensions) y ejecuta el schedule de abajo.

create or replace function public.procesar_encuestas_programadas()
returns void language plpgsql security definer as $$
begin
  -- Abrir encuestas cuya hora de apertura ya llegó
  update public.encuesta
  set estado = 'abierta',
      hora_apertura = now()
  where estado = 'programada'
    and hora_apertura is not null
    and hora_apertura <= now();

  -- Cerrar encuestas cuya hora de cierre ya llegó
  update public.encuesta
  set estado = 'cerrada',
      hora_cierre = now()
  where estado in ('abierta', 'programada')
    and hora_cierre is not null
    and hora_cierre <= now();
end;
$$;

-- Permitir que el frontend autenticado (y anon) llame a la función
grant execute on function public.procesar_encuestas_programadas() to authenticated, anon;

alter table public.encuesta
  add column if not exists hora_reapertura timestamptz;

alter table public.encuesta
  drop constraint if exists encuesta_horario_orden_check,
  drop constraint if exists encuesta_programada_apertura_check;

alter table public.encuesta
  add constraint encuesta_horario_orden_check
    check (hora_cierre is null or hora_apertura is null or hora_cierre > hora_apertura),
  add constraint encuesta_programada_apertura_check
    check (estado <> 'programada' or hora_apertura is not null);

-- (Opcional) Programar ejecución automática cada minuto con pg_cron:
-- 1. Activa la extensión pg_cron: Database → Extensions → pg_cron
-- 2. Luego ejecuta en el SQL Editor:
--    select cron.schedule('procesar-encuestas', '* * * * *', 'select public.procesar_encuestas_programadas()');

-- Programacion automatica real cada minuto.
-- Si falla, activa pg_cron en Supabase (Database > Extensions > pg_cron) y vuelve a ejecutar este bloque.
create extension if not exists pg_cron with schema extensions;

do $$
begin
  if not exists (
    select 1
    from cron.job
    where jobname = 'procesar-encuestas-programadas'
  ) then
    perform cron.schedule(
      'procesar-encuestas-programadas',
      '* * * * *',
      'select public.procesar_encuestas_programadas();'
    );
  end if;
end;
$$;
