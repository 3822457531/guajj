import crypto from "crypto";
import { cookies } from "next/headers";

export const GUEST_COOKIE = "cg_guest";
export const REF_COOKIE = "cg_ref";
const SESSION_MAX_AGE = 60 * 60 * 24 * 365;

function secret() {
  return process.env.AUTH_SECRET || "change-this-local-secret-before-production";
}

function sign(payload: string) {
  return crypto.createHmac("sha256", secret()).update(payload).digest("hex");
}

function pack(payload: unknown) {
  const raw = JSON.stringify(payload);
  return Buffer.from(raw, "utf8").toString("base64url");
}

function unpack<T>(token: string): T | null {
  try {
    return JSON.parse(Buffer.from(token, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

function readSignedCookie<T extends { exp: number }>(value: string | undefined): T | null {
  if (!value) return null;
  const [payload, sig] = value.split(".");
  if (!payload || !sig) return null;
  if (sign(payload) !== sig) return null;
  const data = unpack<T>(payload);
  if (!data || typeof data.exp !== "number" || data.exp < Date.now()) return null;
  return data;
}

export function createGuestSessionToken(guestUserId: string) {
  const payload = pack({ guestUserId, exp: Date.now() + 1000 * SESSION_MAX_AGE });
  return `${payload}.${sign(payload)}`;
}

export function readGuestSessionToken(value: string | undefined) {
  return readSignedCookie<{ guestUserId: string; exp: number }>(value);
}

export async function getGuestSessionPayload() {
  const store = await cookies();
  return readGuestSessionToken(store.get(GUEST_COOKIE)?.value);
}

export function readGuestUserIdFromCookieHeader(cookieHeader: string): string | null {
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${GUEST_COOKIE}=([^;]+)`));
  if (!match) return null;
  return readGuestSessionToken(decodeURIComponent(match[1]))?.guestUserId ?? null;
}

export function guestSessionCookieOptions() {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    maxAge: SESSION_MAX_AGE,
    path: "/"
  };
}

export function refCookieOptions() {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24 * 30,
    path: "/"
  };
}
