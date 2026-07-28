import { parseTarjetaPropiedadText, type ParsedTarjetaPropiedad } from "./tarjeta-parser";

export type ClientTarjetaOcrResult = ParsedTarjetaPropiedad & { rawText: string };

// ponytail: OCR en el browser evita timeouts de Vercel; reutiliza worker por sesión
let workerPromise: Promise<import("tesseract.js").Worker> | null = null;

async function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import("tesseract.js");
      return createWorker("spa");
    })();
  }
  return workerPromise;
}

export async function ocrTarjetaPropiedadFile(
  file: File,
): Promise<ClientTarjetaOcrResult> {
  const worker = await getWorker();
  const { data } = await worker.recognize(file);
  const rawText = data.text ?? "";
  return { ...parseTarjetaPropiedadText(rawText), rawText };
}
