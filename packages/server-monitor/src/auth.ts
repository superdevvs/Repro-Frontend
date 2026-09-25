import { createHmac, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import type { Principal } from "@repro/monitor-contracts";
import type { Config } from "./config.js";
import { jsonFetch } from "./history.js";
export function equalSecret(a: string, b: string) {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && x.length >= 32 && timingSafeEqual(x, y);
}
export function claims(
  ticket: string,
  key: string,
  now = Date.now() / 1000,
): { sub: string; exp: number } {
  const parts = ticket.split(".");
  if (parts.length !== 2 || ticket.length > 2048)
    throw new Error("Invalid ticket");
  const expected = createHmac("sha256", key)
    .update(parts[0])
    .digest("base64url");
  if (!equalSecret(parts[1], expected)) throw new Error("Invalid ticket");
  const c = JSON.parse(Buffer.from(parts[0], "base64url").toString());
  if (
    c.v !== 1 ||
    c.aud !== "repro-monitor" ||
    typeof c.sub !== "string" ||
    !Number.isInteger(c.exp) ||
    !Number.isInteger(c.iat) ||
    c.exp <= now ||
    c.iat > now + 5 ||
    c.exp - c.iat > 60
  )
    throw new Error("Expired or invalid ticket");
  return c;
}
export class Auth {
  private key: string;
  private operatorToken: string;
  constructor(private cfg: Config) {
    this.key = readFileSync(cfg.signingKeyFile, "utf8").trim();
    this.operatorToken = readFileSync(cfg.operatorTokenFile, "utf8").trim();
    if (this.key.length < 64 || this.operatorToken.length < 64)
      throw new Error("Monitor authentication requires strong keys");
  }
  async authorize(
    token: string,
    operator: boolean,
    origin?: string,
  ): Promise<Principal> {
    if (operator) {
      if (origin || !equalSecret(token, this.operatorToken))
        throw new Error("Operator connection denied");
      return { id: "operator", kind: "operator", aiOwner: true };
    }
    if (origin && !this.cfg.origins.includes(origin))
      throw new Error("Origin denied");
    const c = claims(token, this.key);
    const r = await jsonFetch<{ id: string; expiresAt: number }>(
      this.cfg.authorizationUrl,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      },
    );
    if (r.id !== c.sub || r.expiresAt <= Date.now() / 1000)
      throw new Error("Access revoked");
    return {
      id: c.sub,
      kind: "superadmin",
      aiOwner: c.sub === this.cfg.aiOwnerUserId,
    };
  }
}
