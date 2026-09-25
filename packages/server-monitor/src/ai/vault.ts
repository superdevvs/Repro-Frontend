import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "node:crypto";
import type { Store } from "../store.js";
export class Vault {
  private key: Buffer;
  constructor(
    private store: Store,
    secret: string,
  ) {
    this.key = Buffer.from(
      hkdfSync("sha256", secret, "repro-monitor", "credentials-v1", 32),
    );
  }
  put(owner: string, provider: string, secret: string) {
    const iv = randomBytes(12),
      cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const aad = `${owner}:${provider}`;
    cipher.setAAD(Buffer.from(aad));
    const data = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
    this.store.set(`credential:${aad}`, {
      iv: iv.toString("base64"),
      data: data.toString("base64"),
      tag: cipher.getAuthTag().toString("base64"),
    });
  }
  get(owner: string, provider: string): string | null {
    const aad = `${owner}:${provider}`,
      v = this.store.get<{ iv: string; data: string; tag: string } | null>(
        `credential:${aad}`,
        null,
      );
    if (!v) return null;
    const decipher = createDecipheriv(
      "aes-256-gcm",
      this.key,
      Buffer.from(v.iv, "base64"),
    );
    decipher.setAAD(Buffer.from(aad));
    decipher.setAuthTag(Buffer.from(v.tag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(v.data, "base64")),
      decipher.final(),
    ]).toString("utf8");
  }
  remove(owner: string, provider: string) {
    this.store.db
      .prepare("DELETE FROM kv WHERE key=?")
      .run(`credential:${owner}:${provider}`);
  }
}
