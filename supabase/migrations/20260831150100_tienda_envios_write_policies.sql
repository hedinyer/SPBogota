-- Escritura de tienda_envios (admin via anon key del proyecto)

CREATE POLICY tienda_envios_insert_anon
  ON public.tienda_envios
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY tienda_envios_update_anon
  ON public.tienda_envios
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY tienda_envios_delete_anon
  ON public.tienda_envios
  FOR DELETE
  TO anon, authenticated
  USING (true);
