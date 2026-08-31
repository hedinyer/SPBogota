"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  Copy,
  Download,
  ImageIcon,
  MessageCircle,
  Plus,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import {
  createEnvio,
  listEnvios,
  updateEnvio,
  type EnvioRow,
} from "@/lib/actions/envio-actions";
import {
  ENVIOS_ESTADOS,
  ENVIO_ESTADO_LABEL,
  type EnvioEstado,
} from "@/lib/envios/envio-codigo";
import { formatCop, formatDate } from "@/lib/utils/format";
import { seguimientoUrl } from "@/lib/utils/site-url";
import {
  captureElementAsPng,
  copyImageBlobToClipboard,
  downloadImageBlob,
} from "@/lib/utils/capture-element-image";
import { EnvioGuiaCard } from "@/components/envios/envio-guia-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

function estadoBadgeVariant(
  estado: EnvioEstado,
): "default" | "secondary" | "outline" | "destructive" {
  if (estado === "entregado") return "default";
  if (estado === "cancelado") return "destructive";
  if (estado === "en_camino" || estado === "en_destino") return "secondary";
  return "outline";
}

function parsePrecio(raw: string): number | null {
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;
  return Number.parseInt(digits, 10);
}

export function EnviosManager({ initial }: { initial: EnvioRow[] }) {
  const [envios, setEnvios] = useState(initial);
  const [selectedId, setSelectedId] = useState<string | null>(
    initial[0]?.id ?? null,
  );
  const [pending, startTransition] = useTransition();
  const [capturing, setCapturing] = useState(false);

  const [productoNombre, setProductoNombre] = useState("");
  const [precioRaw, setPrecioRaw] = useState("");
  const [direccion, setDireccion] = useState("");
  const [ubicacionNueva, setUbicacionNueva] = useState("Bodega Bogotá");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const selected = envios.find((e) => e.id === selectedId) ?? null;
  const [editEstado, setEditEstado] = useState<EnvioEstado>("preparando");
  const [editUbicacion, setEditUbicacion] = useState("");
  const [editDireccion, setEditDireccion] = useState("");

  const guiaRef = useRef<HTMLDivElement>(null);
  const productoRef = useRef<HTMLInputElement>(null);
  const precioRef = useRef<HTMLInputElement>(null);
  const direccionRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!selected) return;
    setEditEstado(selected.estado);
    setEditUbicacion(selected.ubicacion);
    setEditDireccion(selected.direccion);
  }, [selected]);

  function validateCreate(): boolean {
    const errors: Record<string, string> = {};
    if (!productoNombre.trim()) errors.productoNombre = "Nombre obligatorio";
    const precio = parsePrecio(precioRaw);
    if (precio === null) errors.precio = "Precio obligatorio";
    if (direccion.trim().length < 3) errors.direccion = "Dirección obligatoria";
    setFieldErrors(errors);
    if (errors.productoNombre) productoRef.current?.focus();
    else if (errors.precio) precioRef.current?.focus();
    else if (errors.direccion) direccionRef.current?.focus();
    return Object.keys(errors).length === 0;
  }

  function onCreate() {
    if (!validateCreate()) return;
    const precio = parsePrecio(precioRaw)!;
    startTransition(async () => {
      const res = await createEnvio({
        productoNombre: productoNombre.trim(),
        precio,
        direccion: direccion.trim(),
        ubicacion: ubicacionNueva.trim() || "Bodega Bogotá",
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setEnvios((prev) => [res.envio, ...prev]);
      setSelectedId(res.envio.id);
      setProductoNombre("");
      setPrecioRaw("");
      setDireccion("");
      setUbicacionNueva("Bodega Bogotá");
      setFieldErrors({});
      toast.success(`Envío ${res.envio.codigo} creado.`);
    });
  }

  function onUpdate() {
    if (!selected) return;
    if (editDireccion.trim().length < 3) {
      toast.error("Dirección obligatoria");
      return;
    }
    startTransition(async () => {
      const res = await updateEnvio({
        id: selected.id,
        estado: editEstado,
        ubicacion: editUbicacion.trim(),
        direccion: editDireccion.trim(),
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setEnvios((prev) =>
        prev.map((e) => (e.id === res.envio.id ? res.envio : e)),
      );
      toast.success("Envío actualizado.");
    });
  }

  function refresh() {
    startTransition(async () => {
      try {
        const rows = await listEnvios();
        setEnvios(rows);
        if (selectedId && !rows.some((r) => r.id === selectedId)) {
          setSelectedId(rows[0]?.id ?? null);
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "No se pudo recargar.");
      }
    });
  }

  function copyLink() {
    if (!selected) return;
    const link = seguimientoUrl(selected.codigo);
    navigator.clipboard
      .writeText(link)
      .then(() => toast.success("Link copiado."))
      .catch(() => toast.error("No se pudo copiar."));
  }

  function openWhatsApp() {
    if (!selected) return;
    const link = seguimientoUrl(selected.codigo);
    const mensaje = `Hola, tu pedido *${selected.productoNombre}* va en camino.\nCódigo: ${selected.codigo}\nEstado: ${ENVIO_ESTADO_LABEL[selected.estado]}\nSigue tu envío aquí: ${link}`;
    window.open(
      `https://wa.me/?text=${encodeURIComponent(mensaje)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  async function exportGuia(mode: "copy" | "download") {
    const root = guiaRef.current;
    if (!root || !selected) return;
    setCapturing(true);
    try {
      const blob = await captureElementAsPng(root);
      if (mode === "copy") {
        try {
          await copyImageBlobToClipboard(blob);
          toast.success("Guía copiada al portapapeles.");
          return;
        } catch {
          // fallback download
        }
      }
      downloadImageBlob(blob, `guia-${selected.codigo}.png`);
      toast.success("Guía descargada.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo generar la guía.");
    } finally {
      setCapturing(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle>Nuevo envío</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={pending}
            aria-label="Recargar lista"
          >
            <RefreshCw className="size-4" aria-hidden />
            Recargar
          </Button>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="envio-producto">Nombre del producto</Label>
            <Input
              ref={productoRef}
              id="envio-producto"
              value={productoNombre}
              onChange={(e) => setProductoNombre(e.target.value)}
              aria-invalid={Boolean(fieldErrors.productoNombre)}
              aria-describedby={
                fieldErrors.productoNombre ? "envio-producto-err" : undefined
              }
              placeholder="Casco Bera Integral"
              autoComplete="off"
            />
            {fieldErrors.productoNombre ? (
              <p id="envio-producto-err" className="text-sm text-destructive" role="alert">
                {fieldErrors.productoNombre}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="envio-precio">Precio (COP)</Label>
            <Input
              ref={precioRef}
              id="envio-precio"
              inputMode="numeric"
              value={precioRaw}
              onChange={(e) => setPrecioRaw(e.target.value)}
              aria-invalid={Boolean(fieldErrors.precio)}
              aria-describedby={fieldErrors.precio ? "envio-precio-err" : undefined}
              placeholder="250000"
              autoComplete="off"
            />
            {fieldErrors.precio ? (
              <p id="envio-precio-err" className="text-sm text-destructive" role="alert">
                {fieldErrors.precio}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="envio-ubicacion-nueva">Ubicación inicial</Label>
            <Input
              id="envio-ubicacion-nueva"
              value={ubicacionNueva}
              onChange={(e) => setUbicacionNueva(e.target.value)}
              placeholder="Bodega Bogotá"
              autoComplete="off"
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="envio-direccion">Dirección de envío</Label>
            <Textarea
              ref={direccionRef}
              id="envio-direccion"
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              aria-invalid={Boolean(fieldErrors.direccion)}
              aria-describedby={
                fieldErrors.direccion ? "envio-direccion-err" : undefined
              }
              placeholder="Calle 100 #15-20, Bogotá"
              rows={2}
            />
            {fieldErrors.direccion ? (
              <p id="envio-direccion-err" className="text-sm text-destructive" role="alert">
                {fieldErrors.direccion}
              </p>
            ) : null}
          </div>
          <div className="sm:col-span-2">
            <Button type="button" onClick={onCreate} disabled={pending}>
              <Plus className="size-4" aria-hidden />
              Crear envío
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Envíos recientes</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {envios.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aún no hay envíos. Crea el primero arriba.
              </p>
            ) : (
              <ul className="flex flex-col gap-2" role="list">
                {envios.map((e) => (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(e.id)}
                      className={`flex w-full flex-col gap-1 rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        selectedId === e.id
                          ? "border-primary bg-muted/60"
                          : "border-border hover:bg-muted/40"
                      }`}
                      aria-current={selectedId === e.id ? "true" : undefined}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-sm font-semibold">
                          {e.codigo}
                        </span>
                        <Badge variant={estadoBadgeVariant(e.estado)}>
                          {ENVIO_ESTADO_LABEL[e.estado]}
                        </Badge>
                      </div>
                      <span className="truncate text-sm">{e.productoNombre}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatCop(e.precio)} · {formatDate(e.createdAt)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {selected ? (
          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="font-mono">{selected.codigo}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Actualiza estado y ubicación, o comparte el seguimiento.
                </p>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="envio-estado">Estado del pedido</Label>
                  <Select
                    value={editEstado}
                    onValueChange={(v) => setEditEstado(v as EnvioEstado)}
                  >
                    <SelectTrigger id="envio-estado" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ENVIOS_ESTADOS.map((s) => (
                        <SelectItem key={s} value={s}>
                          {ENVIO_ESTADO_LABEL[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="envio-ubicacion">Dónde va el pedido</Label>
                  <Input
                    id="envio-ubicacion"
                    value={editUbicacion}
                    onChange={(e) => setEditUbicacion(e.target.value)}
                    placeholder="En ruta a Soacha"
                    autoComplete="off"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="envio-dir-edit">Dirección de envío</Label>
                  <Textarea
                    id="envio-dir-edit"
                    value={editDireccion}
                    onChange={(e) => setEditDireccion(e.target.value)}
                    rows={2}
                  />
                </div>
                <Button type="button" onClick={onUpdate} disabled={pending}>
                  Actualizar estado
                </Button>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={copyLink}
                    aria-label="Copiar link de seguimiento"
                  >
                    <Copy className="size-4" aria-hidden />
                    Copiar link
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={openWhatsApp}
                    aria-label="Compartir por WhatsApp"
                  >
                    <MessageCircle className="size-4" aria-hidden />
                    WhatsApp
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => exportGuia("copy")}
                    disabled={capturing}
                    aria-label="Copiar imagen de la guía"
                  >
                    <ImageIcon className="size-4" aria-hidden />
                    Copiar guía
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => exportGuia("download")}
                    disabled={capturing}
                    aria-label="Descargar imagen de la guía"
                  >
                    <Download className="size-4" aria-hidden />
                    Descargar guía
                  </Button>
                </div>
                <p className="text-xs break-all text-muted-foreground">
                  {seguimientoUrl(selected.codigo)}
                </p>
              </CardContent>
            </Card>

            <div className="overflow-x-auto rounded-lg border border-border bg-muted/30 p-3">
              <div ref={guiaRef} className="inline-block">
                <EnvioGuiaCard
                  envio={{
                    codigo: selected.codigo,
                    productoNombre: selected.productoNombre,
                    precio: selected.precio,
                    direccion: editDireccion || selected.direccion,
                    estado: editEstado,
                    ubicacion: editUbicacion,
                    seguimientoLink: seguimientoUrl(selected.codigo),
                    createdAt: selected.createdAt,
                  }}
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
