import { notFound } from "next/navigation";
import { getEnvioByCodigo } from "@/lib/actions/envio-actions";
import {
  ENVIO_ESTADO_LABEL,
  esCodigoEnvioValido,
  normalizarCodigoEnvio,
} from "@/lib/envios/envio-codigo";
import { formatCop, formatDate } from "@/lib/utils/format";
import { Badge } from "@/components/ui/badge";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ codigo: string }>;
}) {
  const { codigo } = await params;
  return {
    title: `Seguimiento ${normalizarCodigoEnvio(codigo)}`,
  };
}

export default async function SeguimientoPage({
  params,
}: {
  params: Promise<{ codigo: string }>;
}) {
  const { codigo: raw } = await params;
  const codigo = normalizarCodigoEnvio(raw);
  if (!esCodigoEnvioValido(codigo)) notFound();

  const envio = await getEnvioByCodigo(codigo);
  if (!envio) {
    return (
      <div className="rounded-2xl border-2 border-border bg-background p-6 text-center">
        <h1 className="text-xl font-bold text-foreground">
          Envío no encontrado
        </h1>
        <p className="mt-2 text-base leading-relaxed text-muted-foreground">
          No hay un pedido con el código {codigo}. Revisa el enlace o pide uno
          nuevo a tu asesor.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-sm text-muted-foreground">Seguimiento de envío</p>
        <h1 className="font-mono text-2xl font-bold tracking-tight">
          {envio.codigo}
        </h1>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Estado</span>
        <Badge variant="secondary">{ENVIO_ESTADO_LABEL[envio.estado]}</Badge>
      </div>

      <dl className="grid gap-4 rounded-2xl border border-border bg-card p-4 text-sm">
        <div>
          <dt className="text-muted-foreground">Producto</dt>
          <dd className="text-base font-semibold">{envio.productoNombre}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Precio</dt>
          <dd className="font-semibold tabular-nums">
            {formatCop(envio.precio)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Dirección de envío</dt>
          <dd className="leading-relaxed whitespace-pre-wrap">
            {envio.direccion}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Ubicación actual</dt>
          <dd className="font-medium">
            {envio.ubicacion.trim() || "Sin actualizar"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Actualizado</dt>
          <dd>{formatDate(envio.updatedAt)}</dd>
        </div>
      </dl>

      <p className="text-center text-xs text-muted-foreground">
        Soluciones Pinilla · Bogotá
      </p>
    </div>
  );
}
