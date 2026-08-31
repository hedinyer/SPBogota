"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Bike, ClipboardList, FileText, Paperclip, Warehouse, X } from "lucide-react";
import {
  AgentCobranzaWork,
  AgentWhatsAppDraft,
} from "@/components/agente/agent-cobranza-work";
import { AgentInboxWork } from "@/components/agente/agent-inbox-work";
import { AgentClienteWork } from "@/components/agente/agent-cliente-work";
import { AgentMotosWork } from "@/components/agente/agent-motos-work";
import { AgentMarkdown } from "@/components/agente/agent-markdown";
import { AgentToolCalls } from "@/components/agente/agent-tool-calls";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
  toHermesMessages,
  type AgentAttachment,
} from "@/lib/agent/chat-content";
import {
  appendTextDelta,
  applyToolProgressToParts,
  completeRunningToolsInParts,
  parseToolProgress,
  textFromParts,
  toolsFromParts,
  type AssistantStreamPart,
} from "@/lib/agent/tool-progress";
import {
  loadAgentQueueCounts,
  type AgentQueueCounts,
} from "@/lib/actions/agent-work-actions";
import {
  AGENT_MAX_FILES,
  mimeOfAgentFile,
  prepareAgentAttachment,
  validateAgentFile,
} from "@/lib/utils/upload-agent-attachment-client";

type Role = "user" | "assistant";

type AgentUiPart =
  | { kind: "solicitudes" }
  | { kind: "morosos" }
  | { kind: "recoger" }
  | { kind: "motos" }
  | { kind: "cliente"; userId: number; displayName?: string }
  | { kind: "cobranza"; userId: number; displayName?: string }
  | { kind: "whatsapp-draft"; userId: number };

type ChatMessage = {
  id: string;
  role: Role;
  content: string;
  attachments?: AgentAttachment[];
  /** Ordered text/tool segments for ChatGPT-style rendering. */
  parts?: AssistantStreamPart[];
  ui?: AgentUiPart;
};

type PendingFile = { file: File; preview: string | null };

const ACCEPT =
  "image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain,text/csv,text/markdown,application/json,.md,.txt,.csv,.json,.pdf,.doc,.docx,.xls,.xlsx";

const STATIC_UI = new Set<AgentUiPart["kind"]>([
  "solicitudes",
  "morosos",
  "recoger",
  "motos",
  "cliente",
  "cobranza",
]);

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Parse one SSE block; Hermes uses default `data:` and `event: hermes.tool.progress`. */
function parseSseBlock(block: string): { event: string; data: string } | null {
  const lines = block.split("\n");
  let event = "message";
  const dataLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
  }
  if (dataLines.length === 0) return null;
  return { event, data: dataLines.join("\n") };
}

function previewFor(file: File): string | null {
  return mimeOfAgentFile(file).startsWith("image/")
    ? URL.createObjectURL(file)
    : null;
}

export type AgentChatProps = {
  mode?: "full" | "motos";
  pageContext?: { pathname: string; search: string };
  hideConClientes?: boolean;
  /** Panel flotante: denser chrome, fixed scroll viewport. */
  compact?: boolean;
};

export function AgentChat({
  mode = "full",
  pageContext,
  hideConClientes = false,
  compact = false,
}: AgentChatProps = {}) {
  const isMotos = mode === "motos";
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState<AgentQueueCounts | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingRef = useRef<PendingFile[]>([]);
  pendingRef.current = pending;

  // Keep panel height fixed: scroll the log, don't grow the shell.
  useEffect(() => {
    const el = logRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, streaming]);

  useEffect(() => {
    return () => {
      for (const p of pendingRef.current) {
        if (p.preview) URL.revokeObjectURL(p.preview);
      }
    };
  }, []);

  useEffect(() => {
    if (isMotos) return;
    let cancelled = false;
    void (async () => {
      try {
        const next = await loadAgentQueueCounts();
        if (!cancelled) setCounts(next);
      } catch {
        if (!cancelled) setCounts(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isMotos]);

  function refreshCounts() {
    void loadAgentQueueCounts()
      .then(setCounts)
      .catch(() => setCounts(null));
  }

  function pushWork(
    userText: string,
    ui: Extract<
      AgentUiPart,
      { kind: "solicitudes" | "morosos" | "recoger" | "motos" }
    >,
  ) {
    setError(null);
    refreshCounts();
    setMessages((prev) => [
      ...prev,
      { id: newId(), role: "user", content: userText },
      { id: newId(), role: "assistant", content: "", ui },
    ]);
  }

  function openCliente(userId: number, displayName: string) {
    setMessages((prev) => [
      ...prev,
      {
        id: newId(),
        role: "user",
        content: `Revisar a ${displayName}`,
      },
      {
        id: newId(),
        role: "assistant",
        content: "",
        ui: { kind: "cliente", userId, displayName },
      },
    ]);
  }

  function openCobranza(
    userId: number,
    displayName: string,
    from: "morosos" | "recoger" = "morosos",
  ) {
    setMessages((prev) => [
      ...prev,
      {
        id: newId(),
        role: "user",
        content:
          from === "recoger"
            ? `Recoger moto de ${displayName}`
            : `Cobrar a ${displayName}`,
      },
      {
        id: newId(),
        role: "assistant",
        content: "",
        ui: { kind: "cobranza", userId, displayName },
      },
    ]);
  }

  function addFiles(list: FileList | File[]) {
    const incoming = Array.from(list);
    if (incoming.length === 0) return;
    setError(null);
    setPending((prev) => {
      const next = [...prev];
      for (const file of incoming) {
        if (next.length >= AGENT_MAX_FILES) {
          setError(`Máximo ${AGENT_MAX_FILES} archivos por mensaje.`);
          break;
        }
        const invalid = validateAgentFile(file);
        if (invalid) {
          setError(invalid);
          continue;
        }
        next.push({ file, preview: previewFor(file) });
      }
      return next;
    });
  }

  function removePending(index: number) {
    setPending((prev) => {
      const target = prev[index];
      if (target?.preview) URL.revokeObjectURL(target.preview);
      return prev.filter((_, i) => i !== index);
    });
  }

  async function send(opts?: { text?: string; ui?: AgentUiPart }) {
    const fromComposer = opts?.text == null;
    const text = (fromComposer ? input : opts.text)?.trim() ?? "";
    const files = fromComposer ? pending : [];
    if ((!text && files.length === 0) || streaming || uploading) return;

    setError(null);
    setUploading(true);
    let attachments: AgentAttachment[] = [];
    try {
      attachments = await Promise.all(
        files.map((p) => prepareAgentAttachment(p.file)),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron subir los archivos");
      setUploading(false);
      return;
    }
    setUploading(false);

    if (fromComposer) {
      for (const p of pending) {
        if (p.preview) URL.revokeObjectURL(p.preview);
      }
      setPending([]);
      setInput("");
    }

    const userMsg: ChatMessage = {
      id: newId(),
      role: "user",
      content: text,
      attachments: attachments.length ? attachments : undefined,
    };
    const assistantId = newId();
    const nextMessages = [...messages, userMsg];
    setMessages([
      ...nextMessages,
      {
        id: assistantId,
        role: "assistant",
        content: "",
        parts: [],
        ui: opts?.ui,
      },
    ]);
    setStreaming(true);

    try {
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: toHermesMessages(
            nextMessages
              .filter((m) => !m.ui || !STATIC_UI.has(m.ui.kind))
              .map((m) => ({
                role: m.role,
                content: m.content,
                attachments: m.attachments,
              })),
          ),
          ...(isMotos
            ? {
                scope: "motos" as const,
                pageContext: pageContext ?? undefined,
              }
            : {}),
        }),
      });

      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error || `Error ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("Sin cuerpo de respuesta");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const sseParts = buffer.split("\n\n");
        buffer = sseParts.pop() ?? "";

        for (const part of sseParts) {
          const parsed = parseSseBlock(part.trim());
          if (!parsed || parsed.data === "[DONE]") continue;

          if (parsed.event === "hermes.tool.progress") {
            const prog = parseToolProgress(parsed.data);
            if (prog) {
              setMessages((prev) =>
                prev.map((m) => {
                  if (m.id !== assistantId) return m;
                  const nextParts = applyToolProgressToParts(
                    m.parts ?? [],
                    prog,
                  );
                  return {
                    ...m,
                    parts: nextParts,
                    content: textFromParts(nextParts),
                  };
                }),
              );
            }
            continue;
          }

          try {
            const chunk = JSON.parse(parsed.data) as {
              choices?: { delta?: { content?: string | null } }[];
            };
            const delta = chunk.choices?.[0]?.delta?.content;
            if (typeof delta === "string" && delta) {
              setMessages((prev) =>
                prev.map((m) => {
                  if (m.id !== assistantId) return m;
                  const nextParts = appendTextDelta(m.parts ?? [], delta);
                  return {
                    ...m,
                    parts: nextParts,
                    content: textFromParts(nextParts),
                  };
                }),
              );
            }
          } catch {
            // ignore non-JSON keepalives
          }
        }
      }

      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== assistantId || !m.parts?.length) return m;
          const nextParts = completeRunningToolsInParts(m.parts);
          return {
            ...m,
            parts: nextParts,
            content: textFromParts(nextParts),
          };
        }),
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falló el chat";
      setError(msg);
      setMessages((prev) =>
        prev.filter(
          (m) =>
            m.id !== assistantId ||
            m.content.length > 0 ||
            toolsFromParts(m.parts ?? []).length > 0 ||
            Boolean(m.ui),
        ),
      );
    } finally {
      setStreaming(false);
    }
  }

  const last = messages[messages.length - 1];
  const lastTools =
    last?.role === "assistant" ? toolsFromParts(last.parts ?? []) : [];
  const thinking =
    streaming &&
    last?.role === "assistant" &&
    !last.content &&
    lastTools.length === 0 &&
    (!last.ui || last.ui.kind === "whatsapp-draft");
  const busy = streaming || uploading;
  const canSend = !busy && (input.trim().length > 0 || pending.length > 0);

  const mensajeId = compact ? "agente-mensaje-flotante" : "agente-mensaje";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
      <div
        ref={logRef}
        role="log"
        aria-label="Conversación"
        aria-live="polite"
        aria-atomic="false"
        aria-busy={busy}
        className={
          compact
            ? "flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain rounded-lg border border-border bg-background p-2"
            : "flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain rounded-lg border border-border bg-background p-3 sm:p-4"
        }
      >
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {isMotos
              ? "Pregunta por el patio, una venta de contado, motos con clientes o licencias."
              : "Empieza por una tarea o escribe una pregunta. También puedes adjuntar una imagen o un PDF."}
          </p>
        ) : (
          messages.map((m) =>
            m.role === "user" ? (
              <div
                key={m.id}
                className="ml-auto flex max-w-[85%] flex-col items-end gap-2"
              >
                {m.attachments && m.attachments.length > 0 ? (
                  <AttachmentChips attachments={m.attachments} />
                ) : null}
                {m.content ? (
                  <div className="whitespace-pre-wrap rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">
                    {m.content}
                  </div>
                ) : null}
              </div>
            ) : (
              <div
                key={m.id}
                className="mr-auto flex w-full min-w-0 flex-col gap-2 text-foreground"
              >
                {m.ui?.kind === "solicitudes" ? (
                  <AgentInboxWork queue="solicitudes" onOpen={openCliente} />
                ) : null}
                {m.ui?.kind === "motos" && !compact ? (
                  <AgentMotosWork
                    hideConClientes={hideConClientes}
                    onPreset={(text) => {
                      void send({ text });
                    }}
                  />
                ) : null}
                {m.ui?.kind === "morosos" || m.ui?.kind === "recoger" ? (
                  <AgentInboxWork
                    queue={m.ui.kind}
                    onOpen={(userId, displayName) =>
                      openCobranza(
                        userId,
                        displayName,
                        m.ui?.kind === "recoger" ? "recoger" : "morosos",
                      )
                    }
                  />
                ) : null}
                {m.ui?.kind === "cliente" ? (
                  <AgentClienteWork
                    userId={m.ui.userId}
                    displayName={m.ui.displayName}
                    onWorkDone={refreshCounts}
                  />
                ) : null}
                {m.ui?.kind === "cobranza" ? (
                  <AgentCobranzaWork
                    userId={m.ui.userId}
                    displayName={m.ui.displayName}
                    onWorkDone={refreshCounts}
                    onRedactarWhatsApp={(prompt, userId) => {
                      void send({
                        text: prompt,
                        ui: { kind: "whatsapp-draft", userId },
                      });
                    }}
                  />
                ) : null}
                {m.parts?.length
                  ? m.parts.map((part, i) =>
                      part.kind === "text" ? (
                        part.text ? (
                          <AgentMarkdown key={`${m.id}-t-${i}`}>
                            {part.text}
                          </AgentMarkdown>
                        ) : null
                      ) : (
                        <AgentToolCalls
                          key={`${m.id}-tools-${i}`}
                          tools={part.tools}
                        />
                      ),
                    )
                  : m.content ? (
                      <AgentMarkdown>{m.content}</AgentMarkdown>
                    ) : null}
                {m.ui?.kind === "whatsapp-draft" ? (
                  <AgentWhatsAppDraft
                    userId={m.ui.userId}
                    text={m.content}
                    streaming={streaming && last?.id === m.id}
                  />
                ) : null}
              </div>
            ),
          )
        )}
        {thinking ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner />
            {last?.ui?.kind === "whatsapp-draft"
              ? "Redactando WhatsApp…"
              : "Pensando…"}
          </p>
        ) : null}
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      {!(compact && isMotos) ? (
      <div className="flex shrink-0 flex-wrap gap-2">
        {!isMotos ? (
          <>
            <Button
              type="button"
              variant="outline"
              size={compact ? "default" : "lg"}
              className="min-h-11"
              disabled={busy}
              onClick={() => pushWork("Motos", { kind: "motos" })}
            >
              <Warehouse
                aria-hidden
                data-icon="inline-start"
                strokeWidth={1.75}
              />
              Motos
            </Button>
            <Button
              type="button"
              variant="outline"
              size={compact ? "default" : "lg"}
              className="min-h-11"
              disabled={busy}
              onClick={() =>
                pushWork("Revisar solicitudes", { kind: "solicitudes" })
              }
            >
              <ClipboardList
                aria-hidden
                data-icon="inline-start"
                strokeWidth={1.75}
              />
              Revisar solicitudes
              {counts != null && counts.solicitudes > 0 ? (
                <span className="ms-1 tabular-nums text-muted-foreground">
                  ({counts.solicitudes})
                </span>
              ) : null}
            </Button>
            <Button
              type="button"
              variant="outline"
              size={compact ? "default" : "lg"}
              className="min-h-11"
              disabled={busy}
              onClick={() =>
                pushWork("Clientes en mora", { kind: "morosos" })
              }
            >
              <AlertTriangle
                aria-hidden
                data-icon="inline-start"
                strokeWidth={1.75}
              />
              Clientes en mora
              {counts != null && counts.morosos > 0 ? (
                <span className="ms-1 tabular-nums text-muted-foreground">
                  ({counts.morosos})
                </span>
              ) : null}
            </Button>
            <Button
              type="button"
              variant="outline"
              size={compact ? "default" : "lg"}
              className="min-h-11"
              disabled={busy}
              onClick={() =>
                pushWork("Motos para recoger", { kind: "recoger" })
              }
            >
              <Bike aria-hidden data-icon="inline-start" strokeWidth={1.75} />
              Motos para recoger
              {counts != null && counts.recoger > 0 ? (
                <span className="ms-1 tabular-nums text-muted-foreground">
                  ({counts.recoger})
                </span>
              ) : null}
            </Button>
          </>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="min-h-11"
            disabled={busy}
            onClick={() => pushWork("Motos", { kind: "motos" })}
          >
            <Warehouse aria-hidden data-icon="inline-start" strokeWidth={1.75} />
            Trabajos Motos
          </Button>
        )}
      </div>
      ) : null}

      <form
        className="flex shrink-0 flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        onDragOver={(e) => {
          e.preventDefault();
        }}
        onDrop={(e) => {
          e.preventDefault();
          if (!busy) addFiles(e.dataTransfer.files);
        }}
      >
        <label htmlFor={mensajeId} className="text-sm font-medium">
          Mensaje
        </label>
        {pending.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {pending.map((p, i) => (
              <li
                key={`${p.file.name}-${i}`}
                className="flex items-center gap-2 rounded-md border border-border bg-muted/40 py-1 pr-1 pl-2 text-xs"
              >
                {p.preview ? (
                  // ponytail: blob: no entra en next/image
                  <img
                    src={p.preview}
                    alt=""
                    className="size-8 rounded object-cover"
                  />
                ) : (
                  <FileText
                    aria-hidden
                    className="size-4 text-muted-foreground"
                  />
                )}
                <span className="max-w-[10rem] truncate">{p.file.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Quitar ${p.file.name}`}
                  disabled={busy}
                  onClick={() => removePending(i)}
                >
                  <X aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
        <Textarea
          id={mensajeId}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={busy}
          rows={compact ? 2 : 3}
          placeholder="¿Qué necesitas? Puedes pegar o adjuntar archivos."
          onPaste={(e) => {
            if (e.clipboardData.files.length > 0) {
              e.preventDefault();
              addFiles(e.clipboardData.files);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <div className="flex items-center justify-between gap-2">
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT}
            multiple
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            aria-label="Adjuntar archivos"
            onClick={() => fileRef.current?.click()}
          >
            <Paperclip aria-hidden data-icon="inline-start" />
            Adjuntar
          </Button>
          <Button type="submit" disabled={!canSend}>
            {busy ? (
              <>
                <Spinner data-icon="inline-start" />
                {uploading ? "Subiendo…" : "Pensando…"}
              </>
            ) : (
              "Enviar"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

function AttachmentChips({ attachments }: { attachments: AgentAttachment[] }) {
  return (
    <ul className="flex flex-wrap justify-end gap-2">
      {attachments.map((a) => (
        <li key={`${a.name}-${a.url ?? "inline"}`}>
          {a.url && a.mime.startsWith("image/") ? (
            <a href={a.url} target="_blank" rel="noreferrer">
              <img
                src={a.url}
                alt={a.name}
                className="h-20 w-20 rounded-md object-cover"
              />
            </a>
          ) : a.url ? (
            <a
              href={a.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
            >
              <FileText aria-hidden className="size-3.5" />
              {a.name}
            </a>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs">
              <FileText aria-hidden className="size-3.5" />
              {a.name}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
