import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import {
  hasAdminAccess,
  sessionOptions,
  type SessionData,
} from "@/lib/auth/session";
import {
  sanitizeHermesMessages,
  type HermesChatMessage,
} from "@/lib/agent/chat-content";
import {
  buildMotosSystem,
  buildSpappSystem,
  type AgentChatPageContext,
} from "@/lib/agent/chat-system";

export const runtime = "nodejs";
export const maxDuration = 300;

const DEFAULT_HERMES_BASE_URL = "http://159.65.228.108/v1";

function hermesBaseUrl(): string {
  const raw = process.env.HERMES_BASE_URL?.trim();
  return (raw || DEFAULT_HERMES_BASE_URL).replace(/\/$/, "");
}

/** URL pública del panel (Hermes en la DGX debe alcanzarla). */
function spappPublicBase(request: NextRequest): string {
  const env = process.env.SPAPP_PUBLIC_URL?.trim().replace(/\/$/, "");
  if (env) return env;
  const host =
    request.headers.get("x-forwarded-host") || request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") || "http";
  return host ? `${proto}://${host}` : "http://localhost:3000";
}

function parsePageContext(raw: unknown): AgentChatPageContext | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const pathname = typeof o.pathname === "string" ? o.pathname.trim() : "";
  if (!pathname) return null;
  const search = typeof o.search === "string" ? o.search : "";
  return { pathname, search };
}

export async function POST(request: NextRequest) {
  const gate = NextResponse.json({ ok: false });
  const session = await getIronSession<SessionData>(
    request,
    gate,
    sessionOptions,
  );
  if (!hasAdminAccess(session)) {
    return NextResponse.json(
      { error: "No autorizado. Vuelve a iniciar sesión." },
      { status: 401 },
    );
  }

  let body: {
    messages?: unknown;
    scope?: unknown;
    pageContext?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const messages = sanitizeHermesMessages(body.messages);
  if (messages.length === 0) {
    return NextResponse.json({ error: "Faltan messages" }, { status: 400 });
  }

  const scope = body.scope === "motos" ? "motos" : "full";
  const pageContext = parsePageContext(body.pageContext);
  const base = spappPublicBase(request);
  const system =
    scope === "motos"
      ? buildMotosSystem(base, pageContext)
      : buildSpappSystem(base);

  const enriched: HermesChatMessage[] = [
    { role: "system", content: system },
    ...messages,
  ];

  const upstream = await fetch(`${hermesBaseUrl()}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "hermes-agent",
      messages: enriched,
      stream: true,
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => "");
    return NextResponse.json(
      { error: text || `Hermes respondió ${upstream.status}` },
      { status: upstream.status || 502 },
    );
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
