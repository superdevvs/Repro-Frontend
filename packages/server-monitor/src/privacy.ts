const sensitive =
  /^(authorization|cookie|set-cookie|password|secret|token|api[-_]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|signature|credential|email|phone|address|property[_-]?address|payload|body|prompt|messages|first[_-]?name|last[_-]?name|full[_-]?name|name|customer|client|contact|filename|headers)$/i;
export function redactText(input: string): string {
  const start = input.indexOf("{");
  if (start >= 0 && input.trimEnd().endsWith("}")) {
    try {
      const value = JSON.parse(input.slice(start));
      if (value && typeof value === "object")
        return (
          redactText(input.slice(0, start)) + JSON.stringify(redact(value))
        ).slice(0, 16384);
    } catch {
      /* Non-JSON log lines use the text scrubber. */
    }
  }
  return input
    .slice(0, 16384)
    .replace(/(\b(?:cookie|set-cookie)\s*[:=]\s*)[^\r\n]+/gi, "$1[REDACTED]")
    .replace(/\bSQL:\s*[^\r\n]+/gi, "SQL: [REDACTED]")
    .replace(/\b(?:[0-9a-f]{1,4}:){3,}[0-9a-f:]*\b/gi, "[IP]")
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9_+./=-]+/gi, "$1 [REDACTED]")
    .replace(/\b(?:sk[-_]|gh[opusr]_)[A-Za-z0-9_-]{12,}/g, "[REDACTED]")
    .replace(/([?&][\w.-]+)=([^\s"'&]+)/g, "$1=[REDACTED]")
    .replace(
      /(["']?(?:password|secret|token|access[_-]?token|refresh[_-]?token|client[_-]?secret|api[_-]?key|authorization|cookie|signature|email|phone|address|property[_-]?address|payload|body|prompt|customer|first[_-]?name|last[_-]?name|full[_-]?name)["']?\s*[:=]\s*)(?:"[^"\n]*"|'[^'\n]*'|[^\s,;]+)/gi,
      "$1[REDACTED]",
    )
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[EMAIL]")
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "[IP]")
    .replace(
      /(?:\/mnt\/16tb\/repro\/media-originals|\/var\/www\/backend\/storage\/app\/(?:public|private))\/[^\s"']+/g,
      "[MEDIA_PATH]",
    )
    .replace(/\b\d{3}[-. ]\d{3}[-. ]\d{4}\b/g, "[PHONE]");
}
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 8) return "[TRUNCATED]";
  if (typeof value === "string") return redactText(value);
  if (Array.isArray(value))
    return value.slice(0, 250).map((v) => redact(v, depth + 1));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 100)
        .map(([key, v]) => [
          key,
          sensitive.test(key.replace(/([a-z])([A-Z])/g, "$1_$2"))
            ? "[REDACTED]"
            : redact(v, depth + 1),
        ]),
    );
  return value;
}
export function safeLabel(value: string): string {
  return value.replace(/[^a-zA-Z0-9_:/.-]/g, "_").slice(0, 100);
}
