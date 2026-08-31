import {
  Banknote,
  Bike,
  Bot,
  ClipboardList,
  CreditCard,
  History,
  IdCard,
  LogOut,
  MapPin,
  Package,
  ShoppingCart,
  Store,
  Truck,
  Warehouse,
  UserSearch,
  Users,
  type LucideIcon,
} from "lucide-react";

export type AdminNavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Una línea: qué se hace en esa sección (tooltip / subtítulo móvil). */
  hint?: string;
};

export type AdminNavGroup = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  /** Sub-rutas del hub; vacío = link simple (Hoy, Agente IA, Clientes) */
  children: AdminNavLink[];
};

export const adminNavGroups: AdminNavGroup[] = [
  {
    id: "hoy",
    label: "Hoy",
    href: "/inbox",
    icon: ClipboardList,
    children: [],
  },
  {
    id: "agente",
    label: "Agente IA",
    href: "/agente",
    icon: Bot,
    children: [],
  },
  {
    id: "clientes",
    label: "Clientes",
    href: "/clientes",
    icon: UserSearch,
    children: [],
  },
  {
    id: "motos",
    label: "Motos",
    href: "/garaje",
    icon: Bike,
    children: [
      {
        href: "/garaje",
        label: "Garaje",
        icon: Warehouse,
        hint: "Patio, modelos y vendidas de aquí",
      },
      {
        href: "/venta-contado",
        label: "Venta de contado",
        icon: Banknote,
        hint: "Vender o cobrar en mostrador",
      },
      {
        href: "/vendidas",
        label: "Con clientes",
        icon: MapPin,
        hint: "Motos de crédito con el cliente",
      },
      {
        href: "/tarjetas-propiedad",
        label: "Licencias",
        icon: IdCard,
        hint: "Fotos de licencia por placa",
      },
    ],
  },
  {
    id: "tienda",
    label: "Tienda",
    href: "/venta",
    icon: ShoppingCart,
    children: [
      { href: "/venta", label: "Repuestos y accesorios", icon: ShoppingCart },
      { href: "/caja", label: "Caja", icon: Store },
      { href: "/inventario", label: "Stock", icon: Package },
      { href: "/envios", label: "Envíos", icon: Truck },
      { href: "/productos-credito", label: "Extras a crédito", icon: CreditCard },
      { href: "/historial-ventas", label: "Historial", icon: History },
    ],
  },
  {
    id: "equipo",
    label: "Equipo",
    href: "/visitadores",
    icon: Users,
    children: [],
  },
];

export function pathMatchesHref(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function findNavGroupByPathname(
  pathname: string,
): AdminNavGroup | undefined {
  return adminNavGroups.find((group) => {
    if (group.children.length === 0) {
      return pathMatchesHref(pathname, group.href);
    }
    return group.children.some((child) => pathMatchesHref(pathname, child.href));
  });
}

export function isGroupActive(pathname: string, group: AdminNavGroup): boolean {
  if (group.children.length === 0) {
    return pathMatchesHref(pathname, group.href);
  }
  return group.children.some((child) => pathMatchesHref(pathname, child.href));
}

export function isChildActive(pathname: string, href: string): boolean {
  return pathMatchesHref(pathname, href);
}

/** Nav para admin scoped (Olga): sin Equipo ni cartera post-entrega. */
export function navGroupsForAdminScope(hideEquipo: boolean): AdminNavGroup[] {
  if (!hideEquipo) return adminNavGroups;
  return adminNavGroups
    .filter((g) => g.id !== "equipo")
    .map((g) => {
      if (g.id !== "motos") return g;
      return {
        ...g,
        children: g.children.filter((c) => c.href !== "/vendidas"),
      };
    });
}

export { LogOut as AdminLogoutIcon };
