"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Check, Copy, MessageCircle } from "lucide-react";
import {
  listCobranzaAcciones,
  loadClienteWork,
  logCobranzaAccion,
} from "@/lib/actions/agent-work-actions";
import {
  markMotoRecogida,
  resolveMoroso,
} from "@/lib/actions/admin-actions";
import {
  COBRANZA_ACCION_LABELS,
  buildWhatsAppDraftPrompt,
  type CobranzaAccionRow,
} from "@/lib/agent/cobranza";
import { getMoraDisplay } from "@/lib/pipeline/mora-utils";
import { formatDate } from "@/lib/utils/format";
import { MoraSummaryBanner } from "@/components/pipeline/mora-summary-banner";
import { TrackingPanel } from "@/components/pipeline/tracking-panel";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: "avisar", label: "Avisar" },
  { id: "gps", label: "Seguimiento GPS" },
  { id: "recoger", label: "Recoger moto" },
] as const;

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

function waMeUrl(celular: string | null | undefined): string | null {
  const d = (celular ?? "").replace(/\D/g, "");
  if (d.length === 10 && d.startsWith("3")) return `https://wa.me/57${d}`;
  if (d.length >= 10) return `https://wa.me/${d}`;
  return null;
}

function strField(hoja: Record<string, unknown> | null | undefined, key: string): string | null {
  const value = hoja?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

type AgentCobranzaWorkProps = {
  userId: number;
  displayName?: string;
  onWorkDone?: () => void;
  onRedactarWhatsApp: (prompt: string, userId: number) => void;
};

export function AgentCobranzaWork({
  userId,
  displayName,
  onWorkDone,
  onRedactarWhatsApp,
}: AgentCobranzaWorkProps) {
  const [payload, setPayload] = useState<Awaited<
    ReturnType<typeof loadClienteWork>
  >>(null);
  const [bitacora, setBitacora] = useState<CobranzaAccionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmRecoger, setConfirmRecoger] = useState(false);
  const [pending, startTransition] = useTransition();

  const reload = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [next, acciones] = await Promise.all([
        loadClienteWork(userId),
        listCobranzaAcciones(userId),
      ]);
      if (!next) {
        setError("No se encontró ese cliente.");
        setPayload(null);
        return;
      }
      setPayload(next);
      setBitacora(acciones);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "No se pudo cargar la ficha. Vuelve a intentarlo.",
      );
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    function onLog(event: Event) {
      const id = (event as CustomEvent<{ userId?: number }>).detail?.userId;
      if (id !== userId) return;
      void listCobranzaAcciones(userId).then(setBitacora);
    }
    window.addEventListener("cobranza-log", onLog);
    return () => window.removeEventListener("cobranza-log", onLog);
  }, [userId]);

  const pipeline = payload?.pipeline;
  const title = pipeline?.displayName || displayName || `Cliente ${userId}`;
  const mora = pipeline ? getMoraDisplay(pipeline) : null;
  const whatsappHecho = bitacora?.some((a) => a.accion === "whatsapp") ?? false;
  const gpsOn = pipeline?.tracking?.seguimiento === true;
  const currentStep = mora?.paraRecoger
    ? 2
    : whatsappHecho
      ? 1
      : 0;
  const hoja = pipeline?.contract?.hoja_vida_data ?? null;
  const celular = strField(hoja, "celular");
  const wa = waMeUrl(celular);

  function redactar() {
    if (!pipeline || !mora) return;
    onRedactarWhatsApp(
      buildWhatsAppDraftPrompt({
        nombre: pipeline.displayName,
        cedula:
          strField(hoja, "numero_identificacion") || pipeline.user.user || null,
        placa: pipeline.compra?.placa ?? null,
        dias: mora.dias,
        monto: mora.monto,
        etapa: mora.paraRecoger ? "recoger" : "mora",
      }),
      userId,
    );
  }

  function runAccion(fn: () => Promise<unknown>, accion: CobranzaAccionRow["accion"]) {
    startTransition(async () => {
      try {
        await fn();
        const logged = await logCobranzaAccion({ userId, accion });
        if (!logged.ok) throw new Error(logged.error);
        await reload();
        onWorkDone?.();
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "No se pudo completar la acción.",
        );
      }
    });
  }

  return (
    <Card className="w-full max-w-2xl ring-foreground/10">
      <CardHeader>
        <CardTitle className="text-balance">{title}</CardTitle>
        <p className="text-sm text-muted-foreground">
          Cobra con WhatsApp, sigue el GPS y recoger la moto es el último paso.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        {loading && !pipeline ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner />
            Cargando ficha de cobranza…
          </p>
        ) : null}

        {pipeline && mora ? (
          <>
            <MoraSummaryBanner pipeline={pipeline} />

            <ol className="grid gap-2 sm:grid-cols-3">
              {STEPS.map((step, i) => {
                const done =
                  i < currentStep ||
                  (step.id === "gps" && gpsOn) ||
                  (step.id === "avisar" && whatsappHecho);
                const current = i === currentStep;
                return (
                  <li
                    key={step.id}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-sm",
                      current
                        ? "border-foreground bg-muted/40"
                        : "border-border",
                    )}
                  >
                    <p className="font-medium">{step.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {done && !current
                        ? "Hecho"
                        : current
                          ? "Tu turno"
                          : "Después"}
                    </p>
                  </li>
                );
              })}
            </ol>

            <div className="flex flex-col gap-2">
              <Button
                type="button"
                size="lg"
                className="min-h-11 w-full"
                disabled={pending}
                onClick={redactar}
              >
                <MessageCircle aria-hidden data-icon="inline-start" />
                Redactar WhatsApp
              </Button>
              {wa ? (
                <a
                  href={wa}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border px-4 text-sm font-medium underline-offset-2 hover:underline"
                >
                  Abrir WhatsApp con {firstName(title)}
                </a>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Sin celular en la hoja de vida. Copia el mensaje y pégalo a
                  mano.
                </p>
              )}
            </div>

            {pipeline.tracking ? (
              <TrackingPanel
                tracking={pipeline.tracking}
                userId={userId}
                moroso={pipeline.moroso}
                recoger={pipeline.recoger}
                atraso={pipeline.atraso}
                onSeguimientoChange={(on) => {
                  void logCobranzaAccion({
                    userId,
                    accion: on ? "gps_on" : "gps_off",
                  }).then(() => {
                    void listCobranzaAcciones(userId).then(setBitacora);
                  });
                }}
              />
            ) : (
              <p className="rounded-lg border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">
                Este cliente aún no tiene GPS en la app. Cuando instale la app,
                el seguimiento aparece aquí.
              </p>
            )}

            {mora.enMoraBandeja && pipeline.moroso?.estado === "activo" ? (
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="min-h-11"
                disabled={pending}
                onClick={() =>
                  runAccion(
                    () =>
                      resolveMoroso({
                        morosoId: pipeline.moroso!.id,
                        userId,
                      }),
                    "regularizado",
                  )
                }
              >
                Regularizar
              </Button>
            ) : null}

            {mora.paraRecoger &&
            pipeline.recoger &&
            pipeline.recoger.estado !== "recogida" ? (
              <Button
                type="button"
                variant="destructive"
                size="lg"
                className="min-h-11"
                disabled={pending}
                onClick={() => setConfirmRecoger(true)}
              >
                Marcar moto recogida
              </Button>
            ) : null}

            <section aria-labelledby={`bitacora-${userId}`}>
              <h3
                id={`bitacora-${userId}`}
                className="mb-2 text-sm font-medium"
              >
                Bitácora
              </h3>
              {bitacora && bitacora.length > 0 ? (
                <ol className="flex flex-col gap-2">
                  {bitacora.map((row) => (
                    <li
                      key={row.id}
                      className="rounded-md border border-border px-3 py-2 text-sm"
                    >
                      <p className="font-medium">
                        {COBRANZA_ACCION_LABELS[row.accion]}
                      </p>
                      <p className="text-xs tabular-nums text-muted-foreground">
                        {formatDate(row.createdAt)}
                      </p>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Todavía no hay acciones. Redacta un WhatsApp o activa el GPS
                  para empezar.
                </p>
              )}
            </section>
          </>
        ) : null}
      </CardContent>

      <AlertDialog
        open={confirmRecoger}
        onOpenChange={(open) => {
          if (!open && !pending) setConfirmRecoger(false);
        }}
      >
        <AlertDialogContent className="bg-background">
          <AlertDialogHeader>
            <AlertDialogTitle>Marcar moto recogida</AlertDialogTitle>
            <AlertDialogDescription>
              Confirmas que ya recogiste la moto de {title}. Esta acción no se
              puede deshacer desde aquí.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending || !pipeline?.recoger}
              onClick={(e) => {
                e.preventDefault();
                if (!pipeline?.recoger) return;
                const recogerId = pipeline.recoger.id;
                startTransition(async () => {
                  try {
                    await markMotoRecogida({ recogerId, userId });
                    const logged = await logCobranzaAccion({
                      userId,
                      accion: "recogida",
                    });
                    if (!logged.ok) throw new Error(logged.error);
                    setConfirmRecoger(false);
                    await reload();
                    onWorkDone?.();
                  } catch (err) {
                    setError(
                      err instanceof Error
                        ? err.message
                        : "No se pudo marcar la moto como recogida.",
                    );
                  }
                });
              }}
            >
              {pending ? "Marcando…" : "Marcar moto recogida"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

type AgentWhatsAppDraftProps = {
  userId: number;
  text: string;
  streaming: boolean;
};

export function AgentWhatsAppDraft({
  userId,
  text,
  streaming,
}: AgentWhatsAppDraftProps) {
  const [status, setStatus] = useState<string>("");
  const [pending, startTransition] = useTransition();

  if (!text && streaming) return null;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(text);
      setStatus("Mensaje copiado");
    } catch {
      setStatus("No se pudo copiar. Selecciona el texto a mano.");
    }
  }

  function marcarEnviado() {
    startTransition(async () => {
      const result = await logCobranzaAccion({
        userId,
        accion: "whatsapp",
        texto: text,
      });
      if (result.ok) {
        setStatus("Marcado como enviado");
        window.dispatchEvent(
          new CustomEvent("cobranza-log", { detail: { userId } }),
        );
      } else {
        setStatus(result.error || "No se pudo registrar el envío.");
      }
    });
  }

  return (
    <div className="mt-3 flex flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="min-h-11"
          disabled={!text}
          aria-label="Copiar mensaje para WhatsApp"
          onClick={() => void copiar()}
        >
          <Copy aria-hidden data-icon="inline-start" />
          Copiar mensaje
        </Button>
        <Button
          type="button"
          size="lg"
          className="min-h-11"
          disabled={!text || pending}
          onClick={marcarEnviado}
        >
          {pending ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <Check aria-hidden data-icon="inline-start" />
          )}
          Marcar como enviado
        </Button>
      </div>
      <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
        {status}
      </p>
    </div>
  );
}
