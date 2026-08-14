import {
  buscarUbicacionGpsEnVivo as buscarDsEnVivo,
  buscarUbicacionGps as buscarDs,
  enviarComandoMotor as comandoDs,
  etiquetaEstadoGps,
  enlaceMapaEmbebido,
  mensajeGpsNoDisponible as mensajeDs,
} from "@/lib/gps/dsTrackGps";
import {
  buscarUbicacionGpsIop,
  buscarUbicacionGpsIopEnVivo,
  enviarComandoMotorIop,
  mensajeGpsIopNoDisponible,
} from "@/lib/gps/iopGps";
import {
  buscarUbicacionGpsEnVivo as buscarStEnVivo,
  buscarUbicacionGps as buscarSt,
  enviarComandoMotor as comandoSt,
  mensajeGpsNoDisponible as mensajeSt,
} from "@/lib/gps/systemTrackGps";
import {
  etiquetaProveedorGps,
  preferirDispositivoGps,
  resolverProveedorGps,
  type AccionMotorGps,
  type ProveedorGps,
  type UbicacionGpsMoto,
} from "@/lib/gps/ubicacionGps";

export type { AccionMotorGps, ProveedorGps, UbicacionGpsMoto };
export {
  etiquetaEstadoGps,
  enlaceMapaEmbebido,
  etiquetaProveedorGps,
  resolverProveedorGps,
};

export type ResultadoBusquedaGps =
  | { ok: true; gps: UbicacionGpsMoto }
  | { ok: false; motivo: "sin_dispositivo" | "error_proveedor" };

export type ResultadoComandoMotor =
  | { ok: true; mensaje: string }
  | { ok: false; error: string };

function gpsMotoExplicito(gpsMoto?: string | null): boolean {
  return String(gpsMoto ?? "").trim().length > 0;
}

function elegirMejorBusqueda(
  resultados: ResultadoBusquedaGps[],
): ResultadoBusquedaGps {
  let mejor: UbicacionGpsMoto | null = null;
  let huboErrorProveedor = false;

  for (const r of resultados) {
    if (!r.ok) {
      if (r.motivo === "error_proveedor") huboErrorProveedor = true;
      continue;
    }
    mejor = mejor ? preferirDispositivoGps(mejor, r.gps) : r.gps;
  }

  if (mejor) return { ok: true, gps: mejor };
  if (huboErrorProveedor) return { ok: false, motivo: "error_proveedor" };
  return { ok: false, motivo: "sin_dispositivo" };
}

function buscarSegunProveedor(
  proveedor: ProveedorGps,
  placa: string,
): Promise<ResultadoBusquedaGps> {
  if (proveedor === "iopgps") return buscarUbicacionGpsIop(placa);
  if (proveedor === "dstrack") return buscarDs(placa);
  return buscarSt(placa);
}

function buscarEnVivoSegunProveedor(
  proveedor: ProveedorGps,
  placa: string,
  deviceId?: number,
  imei?: string,
): Promise<ResultadoBusquedaGps> {
  if (proveedor === "iopgps") {
    return buscarUbicacionGpsIopEnVivo(placa, deviceId, imei);
  }
  if (proveedor === "dstrack") return buscarDsEnVivo(placa, deviceId);
  return buscarStEnVivo(placa, deviceId);
}

function comandoSegunProveedor(
  proveedor: ProveedorGps,
  placa: string,
  accion: AccionMotorGps,
): Promise<ResultadoComandoMotor> {
  if (proveedor === "iopgps") return enviarComandoMotorIop(placa, accion);
  if (proveedor === "dstrack") return comandoDs(placa, accion);
  return comandoSt(placa, accion);
}

export async function buscarUbicacionGps(
  placa: string,
  gpsMoto?: string | null,
): Promise<ResultadoBusquedaGps> {
  if (gpsMotoExplicito(gpsMoto)) {
    return buscarSegunProveedor(resolverProveedorGps(gpsMoto), placa);
  }

  const [iop, ds, st] = await Promise.all([
    buscarUbicacionGpsIop(placa),
    buscarDs(placa),
    buscarSt(placa),
  ]);
  return elegirMejorBusqueda([iop, ds, st]);
}

export async function buscarUbicacionGpsEnVivo(
  placa: string,
  opciones?: {
    gpsMoto?: string | null;
    deviceId?: number;
    imei?: string;
  },
): Promise<ResultadoBusquedaGps> {
  if (gpsMotoExplicito(opciones?.gpsMoto)) {
    return buscarEnVivoSegunProveedor(
      resolverProveedorGps(opciones?.gpsMoto),
      placa,
      opciones?.deviceId,
      opciones?.imei,
    );
  }

  const [iop, ds, st] = await Promise.all([
    buscarUbicacionGpsIopEnVivo(placa, opciones?.deviceId, opciones?.imei),
    buscarDsEnVivo(placa, opciones?.deviceId),
    buscarStEnVivo(placa, opciones?.deviceId),
  ]);
  return elegirMejorBusqueda([iop, ds, st]);
}

export async function enviarComandoMotor(
  placa: string,
  accion: AccionMotorGps,
  gpsMoto?: string | null,
): Promise<ResultadoComandoMotor> {
  if (gpsMotoExplicito(gpsMoto)) {
    return comandoSegunProveedor(
      resolverProveedorGps(gpsMoto),
      placa,
      accion,
    );
  }

  const ubicacion = await buscarUbicacionGps(placa, gpsMoto);
  if (!ubicacion.ok) {
    return {
      ok: false,
      error: mensajeGpsNoDisponible(placa, ubicacion.motivo, gpsMoto),
    };
  }

  return comandoSegunProveedor(ubicacion.gps.proveedor, placa, accion);
}

export function mensajeGpsNoDisponible(
  placa: string,
  motivo: "sin_dispositivo" | "error_proveedor",
  gpsMoto?: string | null,
): string {
  if (!gpsMotoExplicito(gpsMoto)) {
    if (motivo === "error_proveedor") {
      return "No se pudo consultar IOP GPS, DS Track ni System Track. Intenta de nuevo.";
    }
    return `La placa ${placa.trim().toUpperCase()} no aparece en IOP GPS, DS Track ni System Track.`;
  }

  const proveedor = resolverProveedorGps(gpsMoto);
  if (proveedor === "iopgps") return mensajeGpsIopNoDisponible(placa, motivo);
  if (proveedor === "dstrack") return mensajeDs(placa, motivo);
  return mensajeSt(placa, motivo);
}

/** Valor para columna `gps_moto` según el dispositivo elegido. */
export function gpsMotoDesdeProveedor(proveedor: ProveedorGps): string {
  if (proveedor === "iopgps") return "iop gps";
  if (proveedor === "dstrack") return "ds track";
  return "system track";
}
