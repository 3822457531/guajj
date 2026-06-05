import crypto from "crypto";
import { cookies } from "next/headers";

const SOCIAL_COOKIE = "cg_social_user";

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

export function createOAuthStateToken(returnPath: string, oauthType: string) {
  const payload = pack({ returnPath, oauthType, exp: Date.now() + 1000 * 60 * 10 });
  return `${payload}.${sign(payload)}`;
}

export function readOAuthStateToken(value: string | undefined) {
  return readSignedCookie<{ returnPath: string; oauthType: string; exp: number }>(value);
}

export function createSocialUserSessionToken(socialUserId: string) {
  const payload = pack({ socialUserId, exp: Date.now() + 1000 * 60 * 60 * 24 * 30 });
  return `${payload}.${sign(payload)}`;
}

export function readSocialUserSessionToken(value: string | undefined) {
  return readSignedCookie<{ socialUserId: string; exp: number }>(value);
}

export async function getSocialUserSessionPayload() {
  const store = await cookies();
  return readSocialUserSessionToken(store.get(SOCIAL_COOKIE)?.value);
}

