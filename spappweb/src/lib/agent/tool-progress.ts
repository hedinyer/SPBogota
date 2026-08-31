export type ToolCallStatus = "running" | "completed";

export type AgentToolCall = {
  id: string;
  name: string;
  emoji?: string;
  label?: string;
  status: ToolCallStatus;
};

/** Interleaved assistant stream: text → tools → text → … (ChatGPT-style). */
export type AssistantStreamPart =
  | { kind: "text"; text: string }
  | { kind: "tools"; tools: AgentToolCall[] };

export type ToolProgressEvent = {
  tool?: string;
  name?: string;
  emoji?: string;
  label?: string;
  toolCallId?: string;
  status?: string;
};

export function parseToolProgress(data: string): ToolProgressEvent | null {
  try {
    const value = JSON.parse(data) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    return value as ToolProgressEvent;
  } catch {
    return null;
  }
}

export function applyToolProgress(
  tools: AgentToolCall[],
  event: ToolProgressEvent,
): AgentToolCall[] {
  const name = (event.tool || event.name || "").trim();
  if (!name || name.startsWith("_")) return tools;

  const status: ToolCallStatus =
    event.status === "completed" ? "completed" : "running";
  const id = event.toolCallId?.trim();

  if (id) {
    const idx = tools.findIndex((t) => t.id === id);
    if (idx >= 0) {
      const next = tools.slice();
      const prev = next[idx];
      next[idx] = {
        ...prev,
        name: name || prev.name,
        emoji: event.emoji || prev.emoji,
        label: event.label || prev.label,
        status,
      };
      return next;
    }
    return [
      ...tools,
      { id, name, emoji: event.emoji, label: event.label, status },
    ];
  }

  if (status === "completed") {
    for (let i = tools.length - 1; i >= 0; i--) {
      if (tools[i].name === name && tools[i].status === "running") {
        const next = tools.slice();
        next[i] = {
          ...next[i],
          status: "completed",
          label: event.label || next[i].label,
        };
        return next;
      }
    }
  }

  return [
    ...tools,
    {
      id: `${name}-${tools.length}`,
      name,
      emoji: event.emoji,
      label: event.label,
      status,
    },
  ];
}

export function completeRunningTools(tools: AgentToolCall[]): AgentToolCall[] {
  if (!tools.some((t) => t.status === "running")) return tools;
  return tools.map((t) =>
    t.status === "running" ? { ...t, status: "completed" } : t,
  );
}

export function textFromParts(parts: AssistantStreamPart[]): string {
  let out = "";
  for (const p of parts) {
    if (p.kind === "text") out += p.text;
  }
  return out;
}

export function toolsFromParts(parts: AssistantStreamPart[]): AgentToolCall[] {
  const out: AgentToolCall[] = [];
  for (const p of parts) {
    if (p.kind === "tools") out.push(...p.tools);
  }
  return out;
}

export function appendTextDelta(
  parts: AssistantStreamPart[],
  delta: string,
): AssistantStreamPart[] {
  if (!delta) return parts;
  const last = parts[parts.length - 1];
  if (last?.kind === "text") {
    const next = parts.slice();
    next[next.length - 1] = { kind: "text", text: last.text + delta };
    return next;
  }
  return [...parts, { kind: "text", text: delta }];
}

export function applyToolProgressToParts(
  parts: AssistantStreamPart[],
  event: ToolProgressEvent,
): AssistantStreamPart[] {
  const flat = toolsFromParts(parts);
  const updated = applyToolProgress(flat, event);
  if (updated === flat) return parts;

  const prevIds = new Set(flat.map((t) => t.id));
  const byId = new Map(updated.map((t) => [t.id, t]));
  const fresh = updated.filter((t) => !prevIds.has(t.id));

  const next = parts.map((p) => {
    if (p.kind !== "tools") return p;
    return {
      kind: "tools" as const,
      tools: p.tools.map((t) => byId.get(t.id) ?? t),
    };
  });

  if (fresh.length === 0) return next;

  const last = next[next.length - 1];
  if (last?.kind === "tools") {
    const withFresh = next.slice();
    withFresh[withFresh.length - 1] = {
      kind: "tools",
      tools: [...last.tools, ...fresh],
    };
    return withFresh;
  }
  return [...next, { kind: "tools", tools: fresh }];
}

export function completeRunningToolsInParts(
  parts: AssistantStreamPart[],
): AssistantStreamPart[] {
  if (!toolsFromParts(parts).some((t) => t.status === "running")) return parts;
  return parts.map((p) =>
    p.kind === "tools"
      ? { kind: "tools", tools: completeRunningTools(p.tools) }
      : p,
  );
}
