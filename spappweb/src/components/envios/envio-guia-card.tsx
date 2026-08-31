"use client";

import { useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import {
  ENVIO_ESTADO_LABEL,
  type EnvioEstado,
} from "@/lib/envios/envio-codigo";
import { formatCop } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

export type EnvioGuiaData = {
  codigo: string;
  productoNombre: string;
  precio: number;
  direccion: string;
  estado: EnvioEstado;
  ubicacion: string;
  seguimientoLink: string;
  createdAt?: string;
};

function fechaCorta(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeZone: "America/Bogota",
  }).format(d);
}

export function EnvioGuiaCard({
  envio,
  className,
}: {
  envio: EnvioGuiaData;
  className?: string;
}) {
  const barcodeRef = useRef<SVGSVGElement>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!barcodeRef.current) return;
    try {
      JsBarcode(barcodeRef.current, envio.codigo, {
        format: "CODE128",
        displayValue: true,
        fontSize: 14,
        height: 64,
        margin: 0,
        background: "#ffffff",
        lineColor: "#0a0a0a",
        textMargin: 4,
      });
    } catch {
      // código inválido para Code128 — raro con SPB-*
    }
  }, [envio.codigo]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const QRCode = (await import("qrcode")).default;
      const url = await QRCode.toDataURL(envio.seguimientoLink, {
        width: 160,
        margin: 1,
        errorCorrectionLevel: "M",
        color: { dark: "#0a0a0a", light: "#ffffff" },
      });
      if (!cancelled) setQrUrl(url);
    })().catch(() => {
      if (!cancelled) setQrUrl(null);
    });
    return () => {
      cancelled = true;
    };
  }, [envio.seguimientoLink]);

  return (
    <article
      className={cn(
        "w-[540px] bg-white text-[#0a0a0a] shadow-sm outline outline-1 outline-black/10",
        className,
      )}
      style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
    >
      <div className="flex items-center justify-between gap-4 border-b border-[#e5e5e5] px-6 py-4">
        <img
          src="/solucionespinillalogo.jpeg"
          alt="Soluciones Pinilla"
          className="h-12 w-auto max-w-[160px] object-contain"
          crossOrigin="anonymous"
        />
        <div className="text-center">
          <p className="text-[10px] font-semibold tracking-[0.2em] text-[#737373] uppercase">
            Guía de seguimiento
          </p>
          <p className="text-sm font-bold tracking-wide">{envio.codigo}</p>
        </div>
        <img
          src="/beralogo.jpg"
          alt="Bera"
          className="h-12 w-auto max-w-[140px] object-contain"
          crossOrigin="anonymous"
        />
      </div>

      <div className="flex items-stretch gap-4 border-b border-[#e5e5e5] px-6 py-4">
        <div className="flex min-w-0 flex-1 flex-col items-center justify-center">
          <svg ref={barcodeRef} className="max-w-full" role="img" aria-label={`Código de barras ${envio.codigo}`} />
        </div>
        <div className="flex w-[100px] shrink-0 flex-col items-center justify-center gap-1">
          {qrUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrUrl} alt="" className="size-[88px]" width={88} height={88} />
          ) : (
            <div className="size-[88px] bg-[#f5f5f5]" aria-hidden />
          )}
          <span className="text-[9px] text-[#737373]">Escanear</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3 px-6 py-5 text-sm">
        <div className="col-span-2">
          <p className="text-[10px] font-semibold tracking-wide text-[#737373] uppercase">
            Producto
          </p>
          <p className="text-base font-semibold leading-snug">
            {envio.productoNombre}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold tracking-wide text-[#737373] uppercase">
            Precio
          </p>
          <p className="font-semibold tabular-nums">{formatCop(envio.precio)}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold tracking-wide text-[#737373] uppercase">
            Estado
          </p>
          <p className="font-semibold">{ENVIO_ESTADO_LABEL[envio.estado]}</p>
        </div>
        <div className="col-span-2">
          <p className="text-[10px] font-semibold tracking-wide text-[#737373] uppercase">
            Dirección de envío
          </p>
          <p className="leading-snug whitespace-pre-wrap">{envio.direccion}</p>
        </div>
        <div className="col-span-2">
          <p className="text-[10px] font-semibold tracking-wide text-[#737373] uppercase">
            Ubicación actual
          </p>
          <p className="font-medium leading-snug">
            {envio.ubicacion.trim() || "Sin actualizar"}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold tracking-wide text-[#737373] uppercase">
            Creado
          </p>
          <p>{fechaCorta(envio.createdAt)}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold tracking-wide text-[#737373] uppercase">
            Seguimiento
          </p>
          <p className="truncate text-xs text-[#525252]">
            {envio.seguimientoLink.replace(/^https?:\/\//, "")}
          </p>
        </div>
      </div>

      <div className="border-t border-[#e5e5e5] bg-[#fafafa] px-6 py-3 text-center text-[10px] text-[#737373]">
        Soluciones Pinilla · Bogotá · Conserva este código para consultar tu
        pedido
      </div>
    </article>
  );
}
