import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import {
  hasAdminAccess,
  sessionOptions,
  type SessionData,
} from "@/lib/auth/session";
import {
  hasVisitadorAccess,
  visitadorSessionOptions,
  type VisitadorSessionData,
} from "@/lib/auth/visitador-session";

const adminProtectedPrefixes = [
  "/inbox",
  "/agente",
  "/clientes",
  "/crear-cliente",
  "/visitadores",
  "/catalogo",
  "/motos-vendidas",
  "/productos-credito",
  "/inventario",
  "/caja",
  "/venta",
  "/venta-contado",
  "/garaje",
  "/vendidas",
  "/tarjetas-propiedad",
  "/historial-ventas",
  "/solicitudes",
];

const visitadorProtectedPrefixes = [
  "/visitador/mis-visitas",
  "/visitador/visitas",
];

function isCabeceraDelLlanoHost(request: NextRequest): boolean {
  const host = (request.headers.get("host") ?? "").split(":")[0].toLowerCase();
  return (
    host === "cabeceradelllano.vercel.app" || host.startsWith("cabeceradelllano-")
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Proyecto público cabeceradelllano: solo cotizador, no el panel de Bogotá.
  if (isCabeceraDelLlanoHost(request)) {
    if (
      pathname.startsWith("/_next") ||
      pathname === "/favicon.ico" ||
      pathname === "/robots.txt" ||
      pathname === "/cotizador-persianas" ||
      pathname === "/persianas-instalador"
    ) {
      return NextResponse.next();
    }
    const url = request.nextUrl.clone();
    url.pathname = "/cotizador-persianas";
    url.search = "";
    return NextResponse.redirect(url);
  }

  const response = NextResponse.next();

  const needsAdminSession =
    pathname === "/" ||
    pathname === "/login" ||
    adminProtectedPrefixes.some((p) => pathname.startsWith(p));
  const needsVisitadorSession =
    pathname === "/visitador/login" ||
    visitadorProtectedPrefixes.some((p) => pathname.startsWith(p));

  const adminSession = needsAdminSession
    ? await getIronSession<SessionData>(request, response, sessionOptions)
    : null;
  const visitadorSession = needsVisitadorSession
    ? await getIronSession<VisitadorSessionData>(
        request,
        response,
        visitadorSessionOptions,
      )
    : null;

  const isAdminLoggedIn = adminSession ? hasAdminAccess(adminSession) : false;
  const isVisitadorLoggedIn = visitadorSession
    ? hasVisitadorAccess(visitadorSession)
    : false;

  const isAdminProtected = adminProtectedPrefixes.some((p) =>
    pathname.startsWith(p),
  );
  const isVisitadorProtected = visitadorProtectedPrefixes.some((p) =>
    pathname.startsWith(p),
  );

  if (pathname === "/login" && isAdminLoggedIn) {
    return NextResponse.redirect(new URL("/inbox", request.url));
  }

  if (pathname === "/visitador/login" && isVisitadorLoggedIn) {
    return NextResponse.redirect(
      new URL("/visitador/mis-visitas", request.url),
    );
  }

  if (pathname === "/hojadevida/login") {
    return NextResponse.redirect(new URL("/hojadevida", request.url));
  }

  if (pathname === "/motos-vendidas") {
    return NextResponse.redirect(
      new URL("/garaje?vista=vendidas", request.url),
    );
  }

  if (pathname === "/catalogo") {
    return NextResponse.redirect(new URL("/garaje?tab=modelos", request.url));
  }

  if (pathname === "/") {
    return NextResponse.redirect(
      new URL(isAdminLoggedIn ? "/inbox" : "/login", request.url),
    );
  }

  if (isAdminProtected && !isAdminLoggedIn) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isVisitadorProtected && !isVisitadorLoggedIn) {
    return NextResponse.redirect(new URL("/visitador/login", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
