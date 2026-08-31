import { getAgentToolCatalog } from "@/lib/agent/registry";
import type { AgentToolScope } from "@/lib/agent/motos-tools";

export type AgentChatPageContext = {
  pathname: string;
  search: string;
};

function formatCatalog(scope: AgentToolScope = "full"): {
  count: number;
  catalog: string;
} {
  const tools = getAgentToolCatalog(scope);
  const byCat = new Map<string, string[]>();
  for (const t of tools) {
    const list = byCat.get(t.category) ?? [];
    list.push(`- ${t.name}: ${t.description}`);
    byCat.set(t.category, list);
  }
  return {
    count: tools.length,
    catalog: [...byCat.entries()]
      .map(([cat, lines]) => `### ${cat}\n${lines.join("\n")}`)
      .join("\n\n"),
  };
}

function toolsHttpBlock(base: string, scope: AgentToolScope = "full"): string {
  const scopeQ = scope === "motos" ? "?scope=motos" : "";
  const scopeBody =
    scope === "motos"
      ? ` body JSON: {"tool":"<name>","args":{...},"scope":"motos"}`
      : ` body JSON: {"tool":"<name>","args":{...}}`;
  return `Base URL del panel: ${base}
- GET ${base}/api/agent/tools${scopeQ} → { ok, tools: [{ name, category, description, parameters }] }
- POST ${base}/api/agent/tools${scopeBody} → { ok, result } o { ok:false, error }

Sin Authorization (salvo que el usuario diga lo contrario). Montos en COP enteros. Zona America/Bogota.`;
}

/** Hermes no acepta tools por request; usa web/terminal hacia /api/agent/tools. */
export function buildSpappSystem(base: string): string {
  const { count, catalog } = formatCatalog("full");
  return `Eres el asistente del panel SPapp (admin). Para leer o mutar datos del negocio NO inventes: ejecuta las tools HTTP del panel con tu terminal, web o browser.

${toolsHttpBlock(base, "full")}

Catálogo (${count} tools):

${catalog}

Adjuntos: las imágenes llegan como image_url (visión nativa). PDFs y otros archivos son URLs públicas — descárgalos con web/terminal y léelos. No inventes su contenido.

Flujo: si dudás del schema, GET el catálogo; luego POST la tool. Confirma mutaciones destructivas (delete, cerrar caja, reject) con el usuario antes si el pedido es ambiguo.`;
}

function pageHint(page?: AgentChatPageContext | null): string {
  if (!page?.pathname) {
    return "El usuario está en el área Motos. Pregunta qué necesita si no queda claro.";
  }
  const path = page.pathname;
  const qs = new URLSearchParams(page.search.replace(/^\?/, ""));
  const tab = qs.get("tab");
  const vista = qs.get("vista");

  if (path.startsWith("/garaje")) {
    if (tab === "modelos") {
      return "Usuario en Garaje → Modelos. Prioriza list_bikes / save_bike / get por modelo vía list_bikes.";
    }
    if (vista === "vendidas") {
      return "Usuario en Garaje → Vendidas del patio. Prioriza list_garaje_vendidas.";
    }
    if (path.startsWith("/garaje/nueva")) {
      return "Usuario registrando moto nueva. Prioriza save_garaje_moto (foto de placa si es manual).";
    }
    return "Usuario en Garaje (patio). Prioriza list_garaje_motos / get_garaje_moto / save_garaje_moto.";
  }
  if (path.startsWith("/venta-contado")) {
    return "Usuario en Venta de contado. Prioriza list_ventas_contado / get_venta_contado / save_venta_moto / update_venta_moto / add_abono_venta_moto.";
  }
  if (path.startsWith("/vendidas")) {
    return "Usuario en Con clientes (crédito entregado). Prioriza list_vendidas / get_vendida / update_vendida_estado_fisico. NO confundir con ventas de contado ni con vendidas del garaje.";
  }
  if (path.startsWith("/tarjetas-propiedad")) {
    return "Usuario en Licencias. Prioriza list_tarjetas_propiedad / get_tarjeta_propiedad / create_tarjeta_propiedad / update_tarjeta_propiedad.";
  }
  return `Usuario en ${path}${page.search || ""}. Área Motos.`;
}

export function buildMotosSystem(
  base: string,
  pageContext?: AgentChatPageContext | null,
): string {
  const { count, catalog } = formatCatalog("motos");
  const where = pageHint(pageContext);
  const loc =
    pageContext?.pathname != null
      ? `${pageContext.pathname}${pageContext.search || ""}`
      : "(área Motos)";

  return `Eres el asistente del área Motos del panel SPapp (admin). Enfócate en: Garaje (patio, modelos, vendidas del patio), Venta de contado, Con clientes (crédito entregado) y Licencias.

REGLAS DURAS:
- Solo consulta y edición. NUNCA elimines registros (no uses delete_*).
- Usa SIEMPRE scope=motos en GET/POST de tools (si omites scope, el panel puede rechazar tools fuera de Motos).
- Para leer o mutar datos NO inventes: ejecuta las tools HTTP del panel.

${toolsHttpBlock(base, "motos")}

Contexto de página: el usuario está en ${loc}.
${where}

Mapa UI → tools (solo estas; sin delete):
- Garaje patio → list_garaje_motos · get_garaje_moto · save_garaje_moto · liberar_garaje_moto_venta · devolver_garaje_moto_cliente · list_garaje_parqueaderos · save_garaje_parqueadero
- Garaje vendidas (del patio) → list_garaje_vendidas
- Modelos (catálogo) → list_bikes · save_bike
- Venta de contado → list_ventas_contado · get_venta_contado · save_venta_moto · add_abono_venta_moto · update_venta_moto · set_placa_venta_moto
- Con clientes (crédito en calle) → list_vendidas · get_vendida · update_vendida_estado_fisico · search_clients
- Licencias → list_tarjetas_propiedad · get_tarjeta_propiedad · create_tarjeta_propiedad · update_tarjeta_propiedad

Flujo típico: list/get → confirma con el usuario si editas → save/update. Para "¿cuántas X hay?" usa list_* con filtros.

No mezcles: Contado (ventas_moto) ≠ Con clientes (crédito entregado) ≠ Vendidas del garaje (garaje_motos vendida).

Catálogo Motos (${count} tools):

${catalog}

Adjuntos: imágenes como image_url (visión). PDFs/otros son URLs públicas. Útiles para foto de placa o frente/reverso de licencia.

Flujo: si dudás del schema, GET el catálogo con ?scope=motos; luego POST con "scope":"motos".`;
}
