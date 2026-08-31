"use client";

import { useCallback, useEffect, useState } from "react";
import {
  loadClienteWork,
  type ClienteWorkPayload,
} from "@/lib/actions/agent-work-actions";
import { ClientPipelineView } from "@/components/pipeline/client-pipeline-view";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type AgentClienteWorkProps = {
  userId: number;
  displayName?: string;
  onWorkDone?: () => void;
};

export function AgentClienteWork({
  userId,
  displayName,
  onWorkDone,
}: AgentClienteWorkProps) {
  const [data, setData] = useState<ClienteWorkPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const next = await loadClienteWork(userId);
      if (!next) {
        setError("No se encontró ese cliente.");
        setData(null);
        return;
      }
      setData(next);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "No se pudo cargar el cliente. Vuelve a intentarlo.",
      );
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const title =
    data?.pipeline.displayName || displayName || `Cliente ${userId}`;

  return (
    <Card className="w-full max-w-2xl ring-foreground/10">
      <CardHeader>
        <CardTitle className="text-balance">{title}</CardTitle>
        <p className="text-sm text-muted-foreground">
          Completa solo el paso marcado como tu turno.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        {loading && !data ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner />
            Cargando pasos…
          </p>
        ) : null}
        {data ? (
          <ClientPipelineView
            pipeline={data.pipeline}
            visitadores={data.visitadores}
            bikes={data.bikes}
            productosCredito={data.productosCredito}
            compact
            onStepDone={() => {
              void reload();
              onWorkDone?.();
            }}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
