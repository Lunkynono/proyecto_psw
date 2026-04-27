CREATE TABLE IF NOT EXISTS public.encuesta_equipo (
  encuesta_id bigint NOT NULL REFERENCES public.encuesta(id) ON DELETE CASCADE,
  equipo_id bigint NOT NULL REFERENCES public.equipo(id) ON DELETE CASCADE,
  PRIMARY KEY (encuesta_id, equipo_id)
);

ALTER TABLE public.encuesta_equipo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ver equipos encuesta anon" ON public.encuesta_equipo;
CREATE POLICY "Ver equipos encuesta anon"
  ON public.encuesta_equipo FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Gestionar equipos encuesta" ON public.encuesta_equipo;
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

GRANT SELECT, INSERT, DELETE ON public.encuesta_equipo TO authenticated;
GRANT SELECT ON public.encuesta_equipo TO anon;

INSERT INTO public.encuesta_equipo (encuesta_id, equipo_id)
SELECT enc.id, eq.id
FROM public.encuesta enc
JOIN public.equipo eq ON eq.competicion_id = enc.competicion_id
ON CONFLICT DO NOTHING;

INSERT INTO public.encuesta_juez (encuesta_id, persona_id)
SELECT enc.id, cj.persona_id
FROM public.encuesta enc
JOIN public.competicion_juez cj ON cj.competicion_id = enc.competicion_id
ON CONFLICT DO NOTHING;

ALTER TABLE public.encuesta_juez ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ver jueces encuesta" ON public.encuesta_juez;
CREATE POLICY "Ver jueces encuesta"
  ON public.encuesta_juez FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Gestionar jueces encuesta" ON public.encuesta_juez;
CREATE POLICY "Gestionar jueces encuesta"
  ON public.encuesta_juez FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.encuesta enc
      JOIN public.competicion c ON c.id = enc.competicion_id
      JOIN public.evento e ON e.id = c.evento_id
      WHERE enc.id = encuesta_juez.encuesta_id
        AND e.organizador_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.encuesta enc
      JOIN public.competicion c ON c.id = enc.competicion_id
      JOIN public.evento e ON e.id = c.evento_id
      JOIN public.competicion_juez cj
        ON cj.competicion_id = enc.competicion_id
       AND cj.persona_id = encuesta_juez.persona_id
      WHERE enc.id = encuesta_juez.encuesta_id
        AND e.organizador_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, DELETE ON public.encuesta_juez TO authenticated;
