"use client";

import { useEffect, useRef, useState } from "react";
import { saveInstaladorCheckin } from "@/lib/actions/persianas-instalador-actions";
import { Button } from "@/components/ui/button";

type GpsFix = {
  lat: number;
  lng: number;
  accuracy_m: number;
  altitude_m: number | null;
  heading: number | null;
  speed_mps: number | null;
};

type NetworkFix = {
  lat: number;
  lng: number;
  accuracy_m: number;
};

const SESSION_KEY = "persianas-instalador-session";
const SAVE_EVERY_MS = 20_000;

function sessionId(): string {
  const existing = sessionStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  sessionStorage.setItem(SESSION_KEY, id);
  return id;
}

function gpsFrom(pos: GeolocationPosition): GpsFix {
  const { coords } = pos;
  return {
    lat: coords.latitude,
    lng: coords.longitude,
    accuracy_m: coords.accuracy,
    altitude_m: coords.altitude,
    heading: coords.heading,
    speed_mps: coords.speed,
  };
}

function networkFrom(pos: GeolocationPosition): NetworkFix {
  return {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    accuracy_m: pos.coords.accuracy,
  };
}

function fmt(n: number, digits = 6) {
  return n.toFixed(digits);
}

export function InstaladorCheckin() {
  const [status, setStatus] = useState<"idle" | "asking" | "live" | "denied" | "unsupported">("idle");
  const [gps, setGps] = useState<GpsFix | null>(null);
  const [network, setNetwork] = useState<NetworkFix | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const watchRef = useRef<number | null>(null);
  const lastSaveRef = useRef(0);
  const gpsRef = useRef<GpsFix | null>(null);
  const networkRef = useRef<NetworkFix | null>(null);
  const runningRef = useRef(true);
  const savedGpsRef = useRef(false);

  async function persist() {
    if (!runningRef.current) return;
    const g = gpsRef.current;
    const n = networkRef.current;
    if (!g && !n) return;
    const now = Date.now();
    const firstGps = Boolean(g) && !savedGpsRef.current;
    if (!firstGps && now - lastSaveRef.current < SAVE_EVERY_MS) return;
    lastSaveRef.current = now;
    if (g) savedGpsRef.current = true;
    const result = await saveInstaladorCheckin({
      session_id: sessionId(),
      gps: g,
      network: n,
    });
    if (result.ok) {
      setSavedAt(new Date().toLocaleTimeString("es-CO"));
      setError(null);
    } else {
      lastSaveRef.current = 0;
      setError(result.error);
    }
  }

  function onGps(pos: GeolocationPosition) {
    const next = gpsFrom(pos);
    gpsRef.current = next;
    setGps(next);
    setStatus("live");
    void persist();
  }

  function onNetwork(pos: GeolocationPosition) {
    const next = networkFrom(pos);
    networkRef.current = next;
    setNetwork(next);
    setStatus("live");
    void persist();
  }

  function onFail(err: GeolocationPositionError) {
    if (err.code === 1) {
      setStatus("denied");
      setError("Hay que permitir la ubicación en el navegador para el check-in.");
      return;
    }
    setError(err.message || "No se pudo leer la ubicación.");
  }

  function start() {
    if (!navigator.geolocation) {
      setStatus("unsupported");
      setError("Este navegador no soporta geolocalización.");
      return;
    }
    runningRef.current = true;
    setStatus("asking");
    setError(null);
    if (watchRef.current != null) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
    navigator.geolocation.getCurrentPosition(onNetwork, onFail, {
      enableHighAccuracy: false,
      timeout: 25000,
      maximumAge: 60_000,
    });
    watchRef.current = navigator.geolocation.watchPosition(onGps, onFail, {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 5_000,
    });
  }

  function stop() {
    runningRef.current = false;
    if (watchRef.current != null) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
    setStatus("idle");
  }

  useEffect(() => {
    start();
    const networkTick = window.setInterval(() => {
      if (!runningRef.current || !navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(onNetwork, () => {}, {
        enableHighAccuracy: false,
        timeout: 25000,
        maximumAge: 60_000,
      });
    }, 30_000);
    return () => {
      window.clearInterval(networkTick);
      if (watchRef.current != null) {
        navigator.geolocation.clearWatch(watchRef.current);
      }
    };
    // ponytail: start once on mount; watch/interval live until unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mapsHref = gps
    ? `https://www.google.com/maps?q=${gps.lat},${gps.lng}`
    : network
      ? `https://www.google.com/maps?q=${network.lat},${network.lng}`
      : null;

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <main className="mx-auto flex max-w-lg flex-col gap-5 px-4 py-8 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <header className="text-center">
          <h1 className="text-xl font-semibold tracking-tight">
            Check-in instalador de persianas
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Esta página pide permiso al navegador y guarda tu GPS (alta
            precisión) y la ubicación estimada por red (WiFi o datos) mientras
            la dejes abierta. Se actualiza sola cada ~20 segundos.
          </p>
        </header>

        {status === "asking" ? (
          <p className="rounded-lg border px-4 py-3 text-sm">
            Acepta el permiso de ubicación en el recuadro del navegador.
          </p>
        ) : null}

        {error ? (
          <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        {gps ? (
          <section className="rounded-lg border p-4 text-sm">
            <h2 className="font-medium">GPS</h2>
            <p className="mt-1 font-mono">
              {fmt(gps.lat)}, {fmt(gps.lng)}
            </p>
            <p className="text-muted-foreground">
              Precisión ±{Math.round(gps.accuracy_m)} m
              {gps.altitude_m != null
                ? ` · alt ${Math.round(gps.altitude_m)} m`
                : ""}
            </p>
          </section>
        ) : null}

        {network ? (
          <section className="rounded-lg border p-4 text-sm">
            <h2 className="font-medium">Red (WiFi / datos)</h2>
            <p className="mt-1 font-mono">
              {fmt(network.lat)}, {fmt(network.lng)}
            </p>
            <p className="text-muted-foreground">
              Precisión ±{Math.round(network.accuracy_m)} m
            </p>
          </section>
        ) : null}

        {savedAt ? (
          <p aria-live="polite" className="text-center text-sm text-muted-foreground">
            Último guardado: {savedAt}
          </p>
        ) : null}

        {mapsHref ? (
          <a
            href={mapsHref}
            target="_blank"
            rel="noreferrer"
            className="text-center text-sm font-medium underline underline-offset-4"
          >
            Ver en el mapa
          </a>
        ) : null}

        <div className="flex flex-col gap-2">
          {status === "live" ? (
            <Button type="button" variant="outline" className="min-h-11 w-full" onClick={stop}>
              Dejar de compartir
            </Button>
          ) : (
            <Button type="button" className="min-h-11 w-full" onClick={start}>
              Compartir mi ubicación
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}
