ALTER TABLE public.participante
ADD COLUMN IF NOT EXISTS rol text;

UPDATE public.participante
SET rol = 'Sin asignar'
WHERE rol IS NULL OR btrim(rol) = '';

ALTER TABLE public.participante
ALTER COLUMN rol SET NOT NULL;
