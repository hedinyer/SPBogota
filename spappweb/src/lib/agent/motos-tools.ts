/**
 * Tools permitidas en scope "motos": consultar y editar.
 * Eliminar (delete_*) queda fuera a propósito.
 */
export const MOTOS_TOOL_NAMES = [
  // búsqueda de cliente (Con clientes)
  "search_clients",

  // catálogo modelos
  "list_bikes",
  "save_bike",

  // garaje
  "list_garaje_parqueaderos",
  "save_garaje_parqueadero",
  "list_garaje_motos",
  "get_garaje_moto",
  "list_garaje_vendidas",
  "save_garaje_moto",
  "liberar_garaje_moto_venta",
  "devolver_garaje_moto_cliente",

  // venta de contado
  "list_ventas_contado",
  "get_venta_contado",
  "save_venta_moto",
  "add_abono_venta_moto",
  "update_venta_moto",
  "set_placa_venta_moto",

  // con clientes (crédito entregado)
  "list_vendidas",
  "get_vendida",
  "update_vendida_estado_fisico",

  // licencias
  "list_tarjetas_propiedad",
  "get_tarjeta_propiedad",
  "create_tarjeta_propiedad",
  "update_tarjeta_propiedad",
] as const;

export type MotosToolName = (typeof MOTOS_TOOL_NAMES)[number];

export type AgentToolScope = "full" | "motos";

const MOTOS_SET = new Set<string>(MOTOS_TOOL_NAMES);

export function isMotosTool(name: string): boolean {
  return MOTOS_SET.has(name);
}

export function parseAgentToolScope(raw: unknown): AgentToolScope {
  return raw === "motos" ? "motos" : "full";
}
