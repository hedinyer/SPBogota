-- Guías de seguimiento de envíos de tienda (manuales)

CREATE TABLE IF NOT EXISTS public.tienda_envios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL,
  producto_nombre text NOT NULL,
  precio integer NOT NULL CHECK (precio >= 0),
  direccion text NOT NULL,
  estado text NOT NULL DEFAULT 'preparando'
    CHECK (estado IN ('preparando', 'en_camino', 'en_destino', 'entregado', 'cancelado')),
  ubicacion text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tienda_envios_codigo_unique UNIQUE (codigo)
);

CREATE INDEX IF NOT EXISTS idx_tienda_envios_created
  ON public.tienda_envios (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tienda_envios_codigo
  ON public.tienda_envios (codigo);

COMMENT ON TABLE public.tienda_envios IS
  'Guías de seguimiento de envíos de tienda (manuales).';

ALTER TABLE public.tienda_envios ENABLE ROW LEVEL SECURITY;

CREATE POLICY tienda_envios_select_public
  ON public.tienda_envios
  FOR SELECT
  TO anon, authenticated
  USING (true);

GRANT SELECT ON public.tienda_envios TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.tienda_envios TO anon, authenticated;
