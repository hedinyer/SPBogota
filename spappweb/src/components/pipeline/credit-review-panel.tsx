"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { toast } from "sonner";
import type { UserDocumentRow } from "@/lib/pipeline/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HojaVidaSummary } from "@/components/pipeline/hoja-vida-summary";

interface CreditReviewPanelProps {
  document: UserDocumentRow;
  userId: number;
  contractId?: string | null;
  clienteCelular?: string | null;
  contractSigned?: boolean;
  /** Nombre para alts de fotos. */
  clienteNombre?: string | null;
  /** Datos de hoja de vida del contrato (si ya existen). */
  hojaVidaData?: Record<string, unknown> | null;
  /** Si se pasa, se llama en vez de recargar la página. */
  onDone?: () => void;
}

type CreditApiResult =
  | { ok: true; contractId?: string }
  | { ok: false; error: string };

async function postCredit(body: Record<string, unknown>): Promise<CreditApiResult> {
  try {
    const res = await fetch("/api/admin/credit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as CreditApiResult;
    if (data.ok) return data;
    return {
      ok: false,
      error: data.error ?? "No se pudo procesar la solicitud.",
    };
  } catch {
    return { ok: false, error: "No se pudo contactar al servidor." };
  }
}

export function CreditReviewPanel({
  document,
  userId,
  contractId,
  clienteCelular,
  contractSigned,
  clienteNombre,
  hojaVidaData,
  onDone,
}: CreditReviewPanelProps) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [betado, setBetado] = useState(false);
  const [pending, startTransition] = useTransition();

  function finish() {
    if (onDone) onDone();
    else window.location.reload(); // ponytail: reload evita crash RSC post-action en Vercel
  }

  function onApprove() {
    startTransition(async () => {
      const result = await postCredit({
        action: "approve",
        documentId: Number(document.id),
        userId: Number(userId),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Crédito aprobado. Asigna moto y placa.");
      finish();
    });
  }

  function onReject() {
    startTransition(async () => {
      const result = await postCredit({
        action: "reject",
        documentId: Number(document.id),
        userId: Number(userId),
        motivo,
        betado,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Solicitud rechazada.");
      setRejectOpen(false);
      finish();
    });
  }

  if (document.estado_solicitud !== "pendiente") {
    return (
      <ReadonlyCredit
        document={document}
        contractId={contractId}
        clienteCelular={clienteCelular}
        contractSigned={contractSigned}
        clienteNombre={clienteNombre}
        hojaVidaData={hojaVidaData}
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-balance">Revisar solicitud de crédito</CardTitle>
        <p className="text-sm text-muted-foreground">
          Lee la hoja de vida y verifica las fotos antes de decidir.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <HojaVidaSummary data={hojaVidaData} />
        <PhotoGrid document={document} clienteNombre={clienteNombre} />
        <div className="flex flex-wrap gap-3">
          <Button
            size="lg"
            className="min-h-11 bg-primary text-primary-foreground hover:bg-primary/80"
            disabled={pending}
            onClick={onApprove}
          >
            Aprobar crédito
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="min-h-11"
            disabled={pending}
            onClick={() => setRejectOpen(true)}
          >
            Rechazar
          </Button>
        </div>
      </CardContent>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="bg-background">
          <DialogHeader>
            <DialogTitle>Rechazar solicitud</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="motivo">Motivo (visible para el cliente)</Label>
              <Textarea
                id="motivo"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ej: Documento ilegible"
                rows={3}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="betado"
                checked={betado}
                onCheckedChange={(v) => setBetado(v === true)}
              />
              <Label htmlFor="betado" className="font-normal">
                Bloquear reintentos (betado)
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={pending || motivo.trim().length < 3}
              onClick={onReject}
            >
              Confirmar rechazo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function ReadonlyCredit({
  document,
  clienteNombre,
  hojaVidaData,
}: {
  document: UserDocumentRow;
  contractId?: string | null;
  clienteCelular?: string | null;
  contractSigned?: boolean;
  clienteNombre?: string | null;
  hojaVidaData?: Record<string, unknown> | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Solicitud de crédito</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm">
          Estado:{" "}
          <span className="font-medium capitalize">
            {document.estado_solicitud}
          </span>
        </p>
        {document.motivo_rechazo && (
          <p className="text-sm text-muted-foreground">
            Motivo: {document.motivo_rechazo}
          </p>
        )}
        <HojaVidaSummary data={hojaVidaData} />
        <PhotoGrid document={document} clienteNombre={clienteNombre} />
      </CardContent>
    </Card>
  );
}

function PhotoGrid({
  document,
  clienteNombre,
}: {
  document: UserDocumentRow;
  clienteNombre?: string | null;
}) {
  const who = clienteNombre?.trim() || "el cliente";
  const photos = [
    {
      label: "Cédula frente",
      url: document.document_front_url,
      alt: `Cédula frente de ${who}`,
    },
    {
      label: "Cédula reverso",
      url: document.document_back_url,
      alt: `Cédula reverso de ${who}`,
    },
    {
      label: "Selfie",
      url: document.selfie_url,
      alt: `Selfie de ${who}`,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {photos.map(({ label, url, alt }) => (
        <div key={label} className="flex flex-col gap-2">
          <p className="text-sm font-medium text-foreground">{label}</p>
          {url ? (
            <a href={url} target="_blank" rel="noopener noreferrer">
              <div className="relative aspect-[4/3] overflow-hidden rounded-lg border border-border bg-muted/50">
                <Image
                  src={url}
                  alt={alt}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
            </a>
          ) : (
            <div className="flex aspect-[4/3] items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
              Sin foto
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
