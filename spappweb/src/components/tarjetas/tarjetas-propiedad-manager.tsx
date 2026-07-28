"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, ScanLine, Trash2 } from "lucide-react";
import {
  createTarjetaPropiedad,
  deleteTarjetaPropiedad,
} from "@/lib/actions/tarjeta-propiedad-actions";
import { ocrTarjetaPropiedadFile } from "@/lib/tarjetas/tarjeta-ocr-client";
import type { ParsedTarjetaPropiedad } from "@/lib/tarjetas/tarjeta-parser";
import type { TarjetaPropiedadRow } from "@/lib/pipeline/types";
import { STORAGE_BUCKETS } from "@/lib/supabase/storage-buckets";
import { uploadImageFromBrowser } from "@/lib/utils/upload-image-client";
import { ImageFileField } from "@/components/ui/image-file-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type FormState = ParsedTarjetaPropiedad;

const EMPTY_FORM: FormState = {
  numero_licencia: null,
  placa: null,
  marca: null,
  linea: null,
  modelo: null,
  cilindrada: null,
  color: null,
  servicio: null,
  clase_vehiculo: null,
  tipo_carroceria: null,
  combustible: null,
  capacidad: null,
  numero_motor: null,
  motor_reg: null,
  vin: null,
  numero_serie: null,
  serie_reg: null,
  numero_chasis: null,
  chasis_reg: null,
  propietario: null,
  identificacion_tipo: null,
  identificacion_numero: null,
};

const FORM_FIELDS: { key: keyof FormState; label: string }[] = [
  { key: "numero_licencia", label: "No. licencia" },
  { key: "placa", label: "Placa" },
  { key: "marca", label: "Marca" },
  { key: "linea", label: "Línea" },
  { key: "modelo", label: "Modelo" },
  { key: "cilindrada", label: "Cilindrada" },
  { key: "color", label: "Color" },
  { key: "servicio", label: "Servicio" },
  { key: "clase_vehiculo", label: "Clase vehículo" },
  { key: "tipo_carroceria", label: "Tipo carrocería" },
  { key: "combustible", label: "Combustible" },
  { key: "capacidad", label: "Capacidad" },
  { key: "numero_motor", label: "Núm. motor" },
  { key: "motor_reg", label: "Motor REG" },
  { key: "vin", label: "VIN" },
  { key: "numero_serie", label: "Núm. serie" },
  { key: "serie_reg", label: "Serie REG" },
  { key: "numero_chasis", label: "Núm. chasis" },
  { key: "chasis_reg", label: "Chasis REG" },
  { key: "propietario", label: "Propietario" },
  { key: "identificacion_tipo", label: "Tipo ID" },
  { key: "identificacion_numero", label: "Número ID" },
];

function val(v: string | null | undefined): string {
  return v ?? "";
}

function mergeParsed(
  a: ParsedTarjetaPropiedad,
  b: ParsedTarjetaPropiedad,
): ParsedTarjetaPropiedad {
  const out = { ...a };
  for (const key of Object.keys(b) as (keyof ParsedTarjetaPropiedad)[]) {
    if (!out[key] && b[key]) out[key] = b[key];
  }
  return out;
}

export function TarjetasPropiedadManager({
  tarjetas,
}: {
  tarjetas: TarjetaPropiedadRow[];
}) {
  const router = useRouter();
  const [frente, setFrente] = useState<File | null>(null);
  const [reverso, setReverso] = useState<File | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [rawOcr, setRawOcr] = useState<string | null>(null);
  const [ocrPending, startOcr] = useTransition();
  const [savePending, startSave] = useTransition();
  const ocrKeyRef = useRef<string | null>(null);

  const hasOcrResult = useMemo(
    () => Object.values(form).some((v) => v != null && String(v).length > 0),
    [form],
  );

  function setField(key: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [key]: value.trim() ? value : null }));
  }

  function runOcr(frenteFile?: File | null, reversoFile?: File | null) {
    const f = frenteFile ?? frente;
    const r = reversoFile ?? reverso;
    if (!f && !r) {
      toast.error("Sube al menos el frente de la tarjeta.");
      return;
    }
    const key = [
      f ? `${f.name}:${f.size}:${f.lastModified}` : "-",
      r ? `${r.name}:${r.size}:${r.lastModified}` : "-",
    ].join("|");
    ocrKeyRef.current = key;
    startOcr(async () => {
      try {
        let fields: ParsedTarjetaPropiedad = EMPTY_FORM;
        const rawParts: string[] = [];
        if (f) {
          const front = await ocrTarjetaPropiedadFile(f);
          if (ocrKeyRef.current !== key) return;
          const { rawText, ...frontFields } = front;
          fields = frontFields;
          rawParts.push(`--- FRENTE ---\n${rawText}`);
        }
        if (r) {
          const back = await ocrTarjetaPropiedadFile(r);
          if (ocrKeyRef.current !== key) return;
          const { rawText, ...backFields } = back;
          fields = mergeParsed(fields, backFields);
          rawParts.push(`--- REVERSO ---\n${rawText}`);
        }
        setForm(fields);
        setRawOcr(rawParts.join("\n\n"));
        const filled = Object.values(fields).filter(Boolean).length;
        if (filled < 4) {
          toast.warning("OCR incompleto. Revisa y completa los datos.");
        } else {
          toast.success("Tarjeta analizada. Revisa los datos.");
        }
      } catch (e) {
        if (ocrKeyRef.current !== key) return;
        toast.error(e instanceof Error ? e.message : "Error al analizar.");
      }
    });
  }

  function handleFrenteChange(next: File | null) {
    setFrente(next);
    if (!next) {
      if (!reverso) {
        setForm(EMPTY_FORM);
        setRawOcr(null);
        ocrKeyRef.current = null;
      }
      return;
    }
    runOcr(next, reverso);
  }

  function handleReversoChange(next: File | null) {
    setReverso(next);
    if (!next) return;
    runOcr(frente, next);
  }

  function resetForm() {
    setFrente(null);
    setReverso(null);
    setForm(EMPTY_FORM);
    setRawOcr(null);
    ocrKeyRef.current = null;
  }

  function save() {
    if (!frente) {
      toast.error("Sube la foto del frente.");
      return;
    }
    if (!reverso) {
      toast.error("Sube la foto del reverso.");
      return;
    }
    if (!form.placa?.trim()) {
      toast.error("La placa es obligatoria.");
      return;
    }

    startSave(async () => {
      try {
        const [imagenUrl, imagenReversoUrl] = await Promise.all([
          uploadImageFromBrowser(
            STORAGE_BUCKETS.garajeImagenes,
            "tarjetas/frente",
            frente,
          ),
          uploadImageFromBrowser(
            STORAGE_BUCKETS.garajeImagenes,
            "tarjetas/reverso",
            reverso,
          ),
        ]);
        await createTarjetaPropiedad({
          ...form,
          imagen_url: imagenUrl,
          imagen_reverso_url: imagenReversoUrl,
          raw_ocr_text: rawOcr,
        });
        toast.success("Tarjeta guardada.");
        resetForm();
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "No se pudo guardar.");
      }
    });
  }

  function remove(id: string) {
    startSave(async () => {
      try {
        await deleteTarjetaPropiedad(id);
        toast.success("Tarjeta eliminada.");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "No se pudo eliminar.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4 rounded-lg border p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Escanear tarjeta</h2>
            <p className="text-sm text-muted-foreground">
              Sube frente y reverso de la Licencia de Tránsito. El OCR rellena
              el formulario; revisa antes de guardar.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={(!frente && !reverso) || ocrPending || savePending}
              onClick={() => runOcr()}
            >
              {ocrPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ScanLine className="size-4" />
              )}
              Reanalizar
            </Button>
            <Button
              type="button"
              disabled={!frente || !reverso || ocrPending || savePending}
              onClick={save}
            >
              {savePending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              Guardar
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <ImageFileField
            label="Frente (anverso)"
            file={frente}
            onFileChange={handleFrenteChange}
            enableCamera
            disabled={ocrPending || savePending}
            fileInputId="tp-frente-file"
            cameraInputId="tp-frente-camera"
          />
          <ImageFileField
            label="Reverso"
            file={reverso}
            onFileChange={handleReversoChange}
            enableCamera
            disabled={ocrPending || savePending}
            fileInputId="tp-reverso-file"
            cameraInputId="tp-reverso-camera"
          />
        </div>

        {(hasOcrResult || ocrPending) && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FORM_FIELDS.map(({ key, label }) => (
              <div key={key} className="flex flex-col gap-1.5">
                <Label htmlFor={`tp-${key}`}>{label}</Label>
                <Input
                  id={`tp-${key}`}
                  value={val(form[key])}
                  onChange={(e) => setField(key, e.target.value)}
                  disabled={ocrPending || savePending}
                  className={key === "placa" ? "uppercase" : undefined}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">Registradas</h2>
        {tarjetas.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Sin tarjetas</EmptyTitle>
              <EmptyDescription>
                Escanea la primera Licencia de Tránsito para archivarla aquí.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Fotos</TableHead>
                  <TableHead>Placa</TableHead>
                  <TableHead>Marca</TableHead>
                  <TableHead>Modelo</TableHead>
                  <TableHead>Propietario</TableHead>
                  <TableHead>Licencia</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {tarjetas.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <div className="flex gap-1">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={t.imagen_url}
                          alt={`${t.placa ?? "tarjeta"} frente`}
                          className="size-12 rounded object-cover"
                        />
                        {t.imagen_reverso_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={t.imagen_reverso_url}
                            alt={`${t.placa ?? "tarjeta"} reverso`}
                            className="size-12 rounded object-cover"
                          />
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {t.placa ?? "—"}
                    </TableCell>
                    <TableCell>{t.marca ?? "—"}</TableCell>
                    <TableCell>{t.modelo ?? "—"}</TableCell>
                    <TableCell className="max-w-[14rem] truncate">
                      {t.propietario ?? "—"}
                    </TableCell>
                    <TableCell>{t.numero_licencia ?? "—"}</TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={savePending}
                            aria-label="Eliminar"
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Eliminar tarjeta</AlertDialogTitle>
                            <AlertDialogDescription>
                              Se borrará el registro de{" "}
                              {t.placa ?? "esta tarjeta"}. Las imágenes en
                              storage no se eliminan.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => remove(t.id)}>
                              Eliminar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
