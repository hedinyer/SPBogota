-- Primer pago: flags desfasados si el trigger ignoraba visita o dos abonos
-- sincronizaban a la vez (lost-update). También re-sync al cambiar montos.

CREATE OR REPLACE FUNCTION public.sync_compra_pago_flags(p_compra_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_compra record;
  v_sum_inicial integer;
  v_sum_cuota integer;
  v_sum_visita integer;
  v_inicial_ok boolean;
  v_cuota_ok boolean;
  v_visita_ok boolean;
BEGIN
  -- ponytail: lock per compra; lost-update if two abonos sync without it
  PERFORM pg_advisory_xact_lock(872014, hashtext(p_compra_id::text));

  SELECT * INTO v_compra FROM public.user_moto_compra WHERE id = p_compra_id;
  IF NOT FOUND THEN RETURN; END IF;
  IF v_compra.estado NOT IN ('pendiente_pago', 'lista_retiro') THEN RETURN; END IF;

  SELECT COALESCE(SUM(monto), 0) INTO v_sum_inicial
  FROM public.pagos
  WHERE user_moto_compra_id = p_compra_id AND contexto_pago = 'inicial' AND estado = 'confirmado';

  SELECT COALESCE(SUM(monto), 0) INTO v_sum_cuota
  FROM public.pagos
  WHERE user_moto_compra_id = p_compra_id AND contexto_pago = 'cuota_adelantada' AND estado = 'confirmado';

  SELECT COALESCE(SUM(monto), 0) INTO v_sum_visita
  FROM public.pagos
  WHERE user_moto_compra_id = p_compra_id AND contexto_pago = 'visita' AND estado = 'confirmado';

  v_inicial_ok := v_sum_inicial >= v_compra.cuota_inicial_monto;
  v_cuota_ok := v_sum_cuota >= v_compra.monto_cuota_periodo;
  v_visita_ok := v_compra.monto_visita_monto <= 0 OR v_sum_visita >= v_compra.monto_visita_monto;

  UPDATE public.user_moto_compra
  SET
    pago_inicial_confirmado = v_inicial_ok,
    pago_cuota_confirmado = v_cuota_ok,
    pago_visita_confirmado = v_visita_ok,
    pago_inicial_confirmado_at = CASE
      WHEN v_inicial_ok AND NOT pago_inicial_confirmado THEN now()
      WHEN NOT v_inicial_ok THEN NULL
      ELSE pago_inicial_confirmado_at
    END,
    pago_cuota_confirmado_at = CASE
      WHEN v_cuota_ok AND NOT pago_cuota_confirmado THEN now()
      WHEN NOT v_cuota_ok THEN NULL
      ELSE pago_cuota_confirmado_at
    END,
    pago_visita_confirmado_at = CASE
      WHEN v_visita_ok AND NOT pago_visita_confirmado THEN now()
      WHEN NOT v_visita_ok THEN NULL
      ELSE pago_visita_confirmado_at
    END
  WHERE id = p_compra_id
    AND (
      pago_inicial_confirmado IS DISTINCT FROM v_inicial_ok
      OR pago_cuota_confirmado IS DISTINCT FROM v_cuota_ok
      OR pago_visita_confirmado IS DISTINCT FROM v_visita_ok
    );
END;
$fn$;

CREATE OR REPLACE FUNCTION public.trigger_sync_compra_pago_flags()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_compra_id uuid;
  v_contexto text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_compra_id := OLD.user_moto_compra_id;
    v_contexto := OLD.contexto_pago;
  ELSE
    v_compra_id := NEW.user_moto_compra_id;
    v_contexto := NEW.contexto_pago;
  END IF;

  IF v_contexto IN ('inicial', 'cuota_adelantada', 'visita') THEN
    PERFORM public.sync_compra_pago_flags(v_compra_id);
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.trigger_sync_flags_on_monto_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
BEGIN
  IF NEW.cuota_inicial_monto IS DISTINCT FROM OLD.cuota_inicial_monto
     OR NEW.monto_cuota_periodo IS DISTINCT FROM OLD.monto_cuota_periodo
     OR NEW.monto_visita_monto IS DISTINCT FROM OLD.monto_visita_monto THEN
    PERFORM public.sync_compra_pago_flags(NEW.id);
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_sync_flags_on_monto_change ON public.user_moto_compra;
CREATE TRIGGER trg_sync_flags_on_monto_change
AFTER UPDATE OF cuota_inicial_monto, monto_cuota_periodo, monto_visita_monto
ON public.user_moto_compra
FOR EACH ROW
EXECUTE FUNCTION public.trigger_sync_flags_on_monto_change();
