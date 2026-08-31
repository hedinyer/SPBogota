import { NextRequest, NextResponse } from "next/server";

import { getAgentApiKey, isAgentAuthorized } from "@/lib/agent/auth";
import { runAsAgent } from "@/lib/agent/agent-context";
import { parseAgentToolScope } from "@/lib/agent/motos-tools";
import { dispatchAgentTool, getAgentToolCatalog } from "@/lib/agent/registry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Guard opcional: si `AGENT_API_KEY` está configurada, se exige el Bearer token;
 * si no, la API queda abierta (modo fácil, sin keys).
 */
function guard(request: NextRequest): NextResponse | null {
  const key = getAgentApiKey();
  if (!key) return null;
  if (!isAgentAuthorized(request.headers.get("authorization"))) {
    return NextResponse.json(
      { error: "No autorizado. Usa Authorization: Bearer <AGENT_API_KEY>." },
      { status: 401 },
    );
  }
  return null;
}

/** Catálogo de herramientas (function-calling schemas para el agente). */
export async function GET(request: NextRequest) {
  const denied = guard(request);
  if (denied) return denied;

  try {
    const scope = parseAgentToolScope(
      request.nextUrl.searchParams.get("scope"),
    );
    const tools = getAgentToolCatalog(scope);
    return NextResponse.json({
      ok: true,
      scope,
      count: tools.length,
      tools,
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error:
          e instanceof Error ? e.message : "No se pudo generar el catálogo.",
      },
      { status: 500 },
    );
  }
}

/** Ejecuta una herramienta: body `{ tool: string, args?: object, scope?: "motos"|"full" }`. */
export async function POST(request: NextRequest) {
  const denied = guard(request);
  if (denied) return denied;

  let body: { tool?: string; args?: unknown; scope?: unknown };
  try {
    body = (await request.json()) as {
      tool?: string;
      args?: unknown;
      scope?: unknown;
    };
  } catch {
    return NextResponse.json(
      { ok: false, error: "Body JSON inválido." },
      { status: 400 },
    );
  }

  const toolName = body.tool?.trim();
  if (!toolName) {
    return NextResponse.json(
      { ok: false, error: "Falta el campo 'tool'." },
      { status: 400 },
    );
  }

  const scope = parseAgentToolScope(
    body.scope ?? request.nextUrl.searchParams.get("scope"),
  );

  const result = await runAsAgent(() =>
    dispatchAgentTool(toolName, body.args, scope),
  );
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
