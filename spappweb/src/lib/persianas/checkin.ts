import { z } from "zod";

const lat = z.number().gte(-90).lte(90);
const lng = z.number().gte(-180).lte(180);
const meters = z.number().finite().nullable();

const gpsSchema = z.object({
  lat,
  lng,
  accuracy_m: z.number().finite(),
  altitude_m: meters,
  heading: meters,
  speed_mps: meters,
});

const networkSchema = z.object({
  lat,
  lng,
  accuracy_m: z.number().finite(),
});

export const checkinSchema = z
  .object({
    session_id: z.string().uuid(),
    gps: gpsSchema.nullable(),
    network: networkSchema.nullable(),
  })
  .refine((v) => v.gps != null || v.network != null, {
    message: "Falta GPS o ubicación de red.",
  });

export type CheckinInput = z.infer<typeof checkinSchema>;

export function parseCheckin(input: unknown): CheckinInput {
  return checkinSchema.parse(input);
}
