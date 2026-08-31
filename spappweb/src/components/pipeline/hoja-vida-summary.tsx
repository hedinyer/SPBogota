import {
  ESTADO_CIVIL_LABELS,
  TIPO_IDENTIFICACION_LABELS,
  parseHojaVidaForm,
} from "@/lib/contracts/hoja-vida-schema";

/** Solo lectura: datos que el admin necesita al decidir el crédito. */
export function HojaVidaSummary({
  data,
}: {
  data: Record<string, unknown> | null | undefined;
}) {
  const form = parseHojaVidaForm(data ?? {});
  const hasAny = Object.values(data ?? {}).some((v) => {
    if (v == null || v === "") return false;
    if (Array.isArray(v)) return v.some((r) => {
      const row = r as { nombre?: string; celular?: string };
      return Boolean(row?.nombre || row?.celular);
    });
    return true;
  });

  if (!hasAny) {
    return (
      <p className="text-sm text-muted-foreground">
        Sin datos de hoja de vida todavía.
      </p>
    );
  }

  const tipo = form.tipo_identificacion;
  const tipoLabel =
    tipo && tipo in TIPO_IDENTIFICACION_LABELS
      ? TIPO_IDENTIFICACION_LABELS[tipo]
      : null;
  const estado = form.estado_civil;
  const estadoLabel =
    estado && estado in ESTADO_CIVIL_LABELS
      ? ESTADO_CIVIL_LABELS[estado]
      : null;

  const rows: [string, string][] = (
    [
      ["Nombre", form.nombre_completo],
      [
        "Identificación",
        tipoLabel && form.numero_identificacion
          ? `${tipoLabel} ${form.numero_identificacion}`
          : form.numero_identificacion,
      ],
      ["Fecha nacimiento", form.fecha_nacimiento],
      ["Celular", form.celular],
      ["Correo", form.correo],
      ["Dirección", form.direccion],
      ["Barrio", form.barrio],
      ["Estado civil", estadoLabel ?? ""],
      ["Empresa", form.nombre_empresa],
      ["Teléfono empresa", form.telefono_empresa],
      ["Dirección empresa", form.direccion_empresa],
      ["Oficio", form.habilidad],
      ["Cónyuge", form.nombre_conyuge],
      ["Celular cónyuge", form.celular_conyuge],
    ] as [string, string][]
  ).filter(([, val]) => Boolean(val?.trim()));

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium">Hoja de vida</p>
      <dl className="grid gap-3 sm:grid-cols-2">
        {rows.map(([key, val]) => (
          <div key={key}>
            <dt className="text-xs text-muted-foreground">{key}</dt>
            <dd className="mt-0.5 text-sm font-medium break-words">{val}</dd>
          </div>
        ))}
      </dl>
      {form.referencias.some((r) => r.nombre || r.celular) ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs text-muted-foreground">Referencias</p>
          <ul className="flex flex-col gap-1 text-sm">
            {form.referencias.map((r, i) =>
              r.nombre || r.celular ? (
                <li key={i}>
                  {i + 1}. {r.nombre || "—"} · {r.celular || "—"}
                </li>
              ) : null,
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
