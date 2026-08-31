export type AgentAttachment = {
  name: string;
  mime: string;
  url?: string;
  text?: string;
};

export type HermesContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type HermesChatMessage = {
  role: string;
  content: string | HermesContentPart[];
};

function isHttpsUrl(url: string): boolean {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

function isImageMime(mime: string): boolean {
  return mime.startsWith("image/");
}

/** Arma el `content` que Hermes espera: string, o text + image_url. */
export function toHermesUserContent(
  text: string,
  attachments: AgentAttachment[] = [],
): string | HermesContentPart[] {
  const typed = text.trim();
  const blocks: string[] = typed ? [typed] : [];

  for (const a of attachments) {
    if (a.text) {
      blocks.push(`--- ${a.name} ---\n${a.text}`);
    } else if (a.url) {
      blocks.push(`Adjunto: ${a.name} (${a.mime})\n${a.url}`);
    }
  }

  const body = blocks.join("\n\n");

  const images = attachments.filter((a) => isImageMime(a.mime) && a.url);
  if (images.length === 0) return body;

  return [
    { type: "text", text: body },
    ...images.map((img) => ({
      type: "image_url" as const,
      image_url: { url: img.url as string },
    })),
  ];
}

export function toHermesMessages(
  messages: { role: string; content: string; attachments?: AgentAttachment[] }[],
): HermesChatMessage[] {
  return messages.map((m) => ({
    role: m.role,
    content:
      m.role === "user"
        ? toHermesUserContent(m.content, m.attachments)
        : m.content,
  }));
}

/** Trust boundary: solo user/assistant, text e image_url https. */
export function sanitizeHermesMessages(raw: unknown): HermesChatMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: HermesChatMessage[] = [];

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const role = "role" in item ? item.role : null;
    if (role !== "user" && role !== "assistant") continue;
    const content = "content" in item ? item.content : null;

    if (typeof content === "string") {
      if (content.length > 0) out.push({ role, content });
      continue;
    }
    if (!Array.isArray(content)) continue;

    const parts: HermesContentPart[] = [];
    for (const part of content) {
      if (!part || typeof part !== "object" || !("type" in part)) continue;
      if (part.type === "text" && "text" in part && typeof part.text === "string") {
        parts.push({ type: "text", text: part.text });
      } else if (part.type === "image_url") {
        const url =
          "image_url" in part &&
          part.image_url &&
          typeof part.image_url === "object" &&
          "url" in part.image_url &&
          typeof part.image_url.url === "string"
            ? part.image_url.url
            : null;
        if (url && isHttpsUrl(url)) {
          parts.push({ type: "image_url", image_url: { url } });
        }
      }
    }
    if (parts.length === 0) continue;
    out.push({
      role,
      content:
        parts.length === 1 && parts[0].type === "text" ? parts[0].text : parts,
    });
  }

  return out;
}
