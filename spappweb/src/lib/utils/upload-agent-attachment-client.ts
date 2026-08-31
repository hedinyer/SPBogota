import { createBrowserClient } from "@/lib/supabase/browser";
import { STORAGE_BUCKETS } from "@/lib/supabase/storage-buckets";
import { compressImageFile } from "@/lib/utils/compress-image-file";
import { getStoragePublicUrl } from "@/lib/utils/storage-urls";
import type { AgentAttachment } from "@/lib/agent/chat-content";

export const AGENT_MAX_FILE_BYTES = 10 * 1024 * 1024;
export const AGENT_MAX_FILES = 8;
const INLINE_MAX = 80_000;

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  pdf: "application/pdf",
  txt: "text/plain",
  md: "text/plain",
  csv: "text/csv",
  json: "application/json",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

function extOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
}

export function mimeOfAgentFile(file: File): string {
  const type = file.type.toLowerCase();
  if (type && type !== "application/octet-stream") return type;
  return MIME_BY_EXT[extOf(file.name)] ?? "";
}

function isInlineText(file: File, mime: string): boolean {
  if (file.size > INLINE_MAX) return false;
  const ext = extOf(file.name);
  return (
    mime.startsWith("text/") ||
    mime === "application/json" ||
    ext === "txt" ||
    ext === "md" ||
    ext === "csv" ||
    ext === "json"
  );
}

export function validateAgentFile(file: File): string | null {
  if (file.size === 0) return "El archivo está vacío.";
  if (file.size > AGENT_MAX_FILE_BYTES) {
    return `${file.name} supera 10 MB.`;
  }
  if (!mimeOfAgentFile(file)) {
    return `No se admite ${file.name}. Usa imagen, PDF, texto, Word o Excel.`;
  }
  return null;
}

function safeFileName(name: string): string {
  const ext = extOf(name).replace(/[^a-z0-9]/g, "").slice(0, 8);
  const base = (ext ? name.slice(0, name.length - ext.length - 1) : name)
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
  const stem = base || "archivo";
  return ext ? `${stem}.${ext}` : stem;
}

async function uploadBlob(
  fileName: string,
  body: Blob,
  contentType: string,
): Promise<string> {
  const path = `${Date.now()}-${safeFileName(fileName)}`;
  const supabase = createBrowserClient();
  const { error } = await supabase.storage
    .from(STORAGE_BUCKETS.agenteAdjuntos)
    .upload(path, body, { contentType, upsert: false });
  if (error) throw new Error(`No se pudo subir ${fileName}: ${error.message}`);
  const url = getStoragePublicUrl(STORAGE_BUCKETS.agenteAdjuntos, path);
  if (!url) throw new Error(`No se pudo obtener la URL de ${fileName}.`);
  return url;
}

export async function prepareAgentAttachment(
  file: File,
): Promise<AgentAttachment> {
  const error = validateAgentFile(file);
  if (error) throw new Error(error);

  const mime = mimeOfAgentFile(file);
  if (isInlineText(file, mime)) {
    return { name: file.name, mime, text: await file.text() };
  }

  if (mime.startsWith("image/") && mime !== "image/gif") {
    const compressed = await compressImageFile(file);
    const url = await uploadBlob(
      file.name.replace(/\.[^.]+$/, ".jpg"),
      compressed,
      "image/jpeg",
    );
    return { name: file.name, mime: "image/jpeg", url };
  }

  const url = await uploadBlob(file.name, file, mime);
  return { name: file.name, mime, url };
}
