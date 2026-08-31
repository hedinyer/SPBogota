"use client";

import { useState } from "react";
import { Check, ChevronDown, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import type { AgentToolCall } from "@/lib/agent/tool-progress";

function preview(label: string | undefined): string {
  if (!label) return "";
  return label.replace(/^`+|`+$/g, "").trim();
}

function ToolGlyph({
  tool,
  running,
}: {
  tool: AgentToolCall;
  running: boolean;
}) {
  return (
    <span
      className={cn(
        "relative flex size-7 shrink-0 items-center justify-center rounded-md text-sm transition-colors duration-200 [&_svg]:size-3.5",
        running ? "bg-primary/10 text-foreground" : "bg-muted text-muted-foreground",
      )}
      aria-hidden
    >
      {tool.emoji ? (
        <span className="leading-none">{tool.emoji}</span>
      ) : (
        <Wrench />
      )}
      <span className="absolute -right-0.5 -bottom-0.5 flex size-3.5 items-center justify-center rounded-full bg-card ring-1 ring-foreground/10">
        {running ? (
          <Spinner className="size-2.5" />
        ) : (
          <Check className="size-2.5 text-foreground" />
        )}
      </span>
    </span>
  );
}

function AgentToolCallItem({ tool }: { tool: AgentToolCall }) {
  const running = tool.status === "running";
  const label = preview(tool.label);
  const [open, setOpen] = useState(false);
  const expanded = Boolean(label) && (running || open);
  const canToggle = Boolean(label) && !running;
  const headerClass = cn(
    "flex min-h-10 w-full items-center gap-2.5 px-2.5 py-1.5 text-left",
    canToggle &&
      "cursor-pointer outline-none transition-colors duration-150 hover:bg-muted/50 active:scale-[0.96] focus-visible:ring-2 focus-visible:ring-ring/50",
  );

  const bits = (
    <>
      <ToolGlyph tool={tool} running={running} />
      <span className="min-w-0 flex-1 truncate font-mono text-xs font-medium tracking-tight">
        {tool.name}
      </span>
      <Badge variant={running ? "secondary" : "outline"}>
        {running ? "En curso" : "Listo"}
      </Badge>
      {canToggle ? (
        <ChevronDown
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground transition-transform duration-200",
            expanded && "rotate-180",
          )}
        />
      ) : null}
    </>
  );

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10",
        "shadow-[0_1px_2px_oklch(0_0_0/0.05)]",
        "animate-in fade-in-0 slide-in-from-bottom-1 duration-200 fill-mode-both motion-reduce:animate-none",
      )}
    >
      {canToggle ? (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setOpen((v) => !v)}
          className={headerClass}
        >
          {bits}
        </button>
      ) : (
        <div className={headerClass}>{bits}</div>
      )}
      {expanded ? (
        <pre className="max-h-40 overflow-auto border-t border-border bg-muted/40 px-2.5 py-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
          {label}
        </pre>
      ) : null}
    </div>
  );
}

export function AgentToolCalls({ tools }: { tools: AgentToolCall[] }) {
  if (tools.length === 0) return null;
  return (
    <ol
      className="mt-1 flex max-w-[65ch] flex-col gap-1.5"
      aria-label="Herramientas usadas"
    >
      {tools.map((tool) => (
        <li key={tool.id}>
          <AgentToolCallItem tool={tool} />
        </li>
      ))}
    </ol>
  );
}
