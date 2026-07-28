export interface ParsedTarjetaPropiedad {
  numero_licencia: string | null;
  placa: string | null;
  marca: string | null;
  linea: string | null;
  modelo: string | null;
  cilindrada: string | null;
  color: string | null;
  servicio: string | null;
  clase_vehiculo: string | null;
  tipo_carroceria: string | null;
  combustible: string | null;
  capacidad: string | null;
  numero_motor: string | null;
  motor_reg: string | null;
  vin: string | null;
  numero_serie: string | null;
  serie_reg: string | null;
  numero_chasis: string | null;
  chasis_reg: string | null;
  propietario: string | null;
  identificacion_tipo: string | null;
  identificacion_numero: string | null;
}

function normalizeOcrText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\r/g, "\n")
    .replace(/[|]/g, "I")
    .replace(/[ \t]+/g, " ");
}

/** Labels known on Colombian Licencia de Tránsito; longest first for greedy match. */
const FIELD_LABELS: { key: keyof ParsedTarjetaPropiedad; patterns: string[] }[] =
  [
    {
      key: "numero_licencia",
      patterns: ["no\\.?\\s*licencia\\s*de\\s*transito", "licencia\\s*de\\s*transito\\s*no\\.?"],
    },
    { key: "placa", patterns: ["placa"] },
    { key: "marca", patterns: ["marca"] },
    { key: "linea", patterns: ["linea"] },
    { key: "modelo", patterns: ["modelo"] },
    {
      key: "cilindrada",
      patterns: ["cilindrada\\s*cc", "cilindrada"],
    },
    { key: "color", patterns: ["color"] },
    { key: "servicio", patterns: ["servicio"] },
    {
      key: "clase_vehiculo",
      patterns: ["clase\\s*de\\s*vehiculo", "clase\\s*vehiculo"],
    },
    {
      key: "tipo_carroceria",
      patterns: ["tipo\\s*carroceria", "tipo\\s*de\\s*carroceria"],
    },
    { key: "combustible", patterns: ["combustible"] },
    {
      key: "capacidad",
      patterns: ["capacidad\\s*kg/?psj", "capacidad"],
    },
    {
      key: "numero_motor",
      patterns: ["numero\\s*de\\s*motor", "nro\\.?\\s*motor", "no\\.?\\s*motor"],
    },
    { key: "vin", patterns: ["vin"] },
    {
      key: "numero_serie",
      patterns: ["numero\\s*de\\s*serie", "nro\\.?\\s*serie", "no\\.?\\s*serie"],
    },
    {
      key: "numero_chasis",
      patterns: ["numero\\s*de\\s*chasis", "nro\\.?\\s*chasis", "no\\.?\\s*chasis"],
    },
    {
      key: "propietario",
      patterns: [
        "propietario\\s*:?\\s*apellido\\(s\\)\\s*y\\s*nombre\\(s\\)",
        "propietario",
      ],
    },
    {
      key: "identificacion_numero",
      patterns: ["identificacion", "nit", "cc\\b", "c\\.c\\."],
    },
  ];

const STOP_LABELS = FIELD_LABELS.flatMap((f) => f.patterns).join("|");

function emptyParsed(): ParsedTarjetaPropiedad {
  return {
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
}

function cleanValue(raw: string): string {
  return raw
    .replace(/\bREG\b\.?\s*[NR]?\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractAfterLabel(
  text: string,
  labelPatterns: string[],
): string | null {
  for (const label of labelPatterns) {
    const re = new RegExp(
      `(?:^|\\n|\\s)(?:${label})\\s*[:.]?\\s*([^\\n]+)`,
      "i",
    );
    const m = text.match(re);
    if (m?.[1]) {
      const value = cleanValue(m[1]);
      // Stop if value looks like the next label
      const nextLabel = new RegExp(`^(?:${STOP_LABELS})\\b`, "i");
      if (value && !nextLabel.test(value)) return value;
    }
  }
  return null;
}

function extractIdentificacion(text: string): {
  tipo: string | null;
  numero: string | null;
} {
  const nit = text.match(/\bNIT\s*[:.]?\s*(\d[\d.\s-]*)/i);
  if (nit?.[1]) {
    return {
      tipo: "NIT",
      numero: nit[1].replace(/[^\d]/g, "") || null,
    };
  }
  const cc = text.match(
    /\b(?:C\.?\s*C\.?|CC|CEDULA)\s*[:.]?\s*(\d[\d.\s-]*)/i,
  );
  if (cc?.[1]) {
    return {
      tipo: "CC",
      numero: cc[1].replace(/[^\d]/g, "") || null,
    };
  }
  const ident = text.match(
    /IDENTIFICACION\s*[:.]?\s*(NIT|CC|C\.?\s*C\.?)?\s*(\d[\d.\s-]*)/i,
  );
  if (ident?.[2]) {
    const tipoRaw = (ident[1] ?? "").toUpperCase().replace(/\./g, "").replace(/\s/g, "");
    return {
      tipo: tipoRaw === "CC" || tipoRaw === "C C" ? "CC" : tipoRaw || "NIT",
      numero: ident[2].replace(/[^\d]/g, "") || null,
    };
  }
  return { tipo: null, numero: null };
}

function extractLicenciaNo(text: string): string | null {
  const m =
    text.match(
      /(?:LICENCIA\s*DE\s*TRANSITO\s*)?(?:No\.?|#)\s*(\d{8,15})/i,
    ) ?? text.match(/\b(10\d{9})\b/);
  return m?.[1] ?? null;
}

function extractRegFlag(
  text: string,
  fieldLabel: string,
): string | null {
  const re = new RegExp(
    `${fieldLabel}[\\s\\S]{0,80}?\\bREG\\b\\.?\\s*([NR])\\b`,
    "i",
  );
  const m = text.match(re);
  return m?.[1]?.toUpperCase() ?? null;
}

export function parseTarjetaPropiedadText(
  rawText: string,
): ParsedTarjetaPropiedad {
  const text = normalizeOcrText(rawText);
  const out = emptyParsed();

  for (const field of FIELD_LABELS) {
    if (field.key === "identificacion_numero") continue;
    if (field.key === "numero_licencia") continue;
    const value = extractAfterLabel(text, field.patterns);
    if (value) out[field.key] = value;
  }

  out.numero_licencia = extractLicenciaNo(text);

  // Placa: prefer compact alphanumeric Colombian plate
  if (out.placa) {
    const plate = out.placa.toUpperCase().replace(/[^A-Z0-9]/g, "");
    const plateMatch = plate.match(/[A-Z]{3}\d{2}[A-Z0-9]|[A-Z]{3}\d{3}/);
    out.placa = plateMatch?.[0] ?? (plate.length >= 5 ? plate.slice(0, 8) : out.placa);
  } else {
    const loose = text.match(/\b([A-Z]{3}\s?\d{2}[A-Z0-9])\b/i);
    if (loose?.[1]) out.placa = loose[1].replace(/\s/g, "").toUpperCase();
  }

  if (out.vin) {
    const vin = out.vin.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, "");
    if (vin.length >= 11) out.vin = vin.slice(0, 17);
  }

  // Serie/chasis often equal VIN on motos
  if (out.numero_serie) {
    out.numero_serie = out.numero_serie.toUpperCase().replace(/\s+/g, " ").trim();
  }
  if (out.numero_chasis) {
    out.numero_chasis = out.numero_chasis.toUpperCase().replace(/\s+/g, " ").trim();
  }
  if (out.numero_motor) {
    out.numero_motor = out.numero_motor.toUpperCase().replace(/\s+/g, " ").trim();
  }

  out.motor_reg = extractRegFlag(text, "NUMERO\\s*DE\\s*MOTOR");
  out.serie_reg = extractRegFlag(text, "NUMERO\\s*DE\\s*SERIE");
  out.chasis_reg = extractRegFlag(text, "NUMERO\\s*DE\\s*CHASIS");

  const ident = extractIdentificacion(text);
  out.identificacion_tipo = ident.tipo;
  out.identificacion_numero = ident.numero;

  if (out.propietario) {
    out.propietario = out.propietario
      .replace(/\bIDENTIFICACION\b.*$/i, "")
      .trim();
  }

  return out;
}
