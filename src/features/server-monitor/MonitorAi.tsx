import { MonitorEvidence } from "./MonitorEvidence";
import React, { useCallback, useEffect, useState } from "react";
import type {
  MonitorClient,
  ProviderConnection,
  ProviderId,
  ChatMessage,
  MonitorSettings,
  Budget,
  Principal,
} from "@repro/monitor-contracts";
import { Button } from "@/components/ui/button";
import { Bot, Send } from "lucide-react";
import { timeLabel } from "./format";
export function MonitorAi({
  client,
  delta,
}: {
  client: MonitorClient;
  delta: { sessionId: string; delta: string } | null;
}) {
  const [connections, setConnections] = useState<ProviderConnection[]>([]),
    [provider, setProvider] = useState<ProviderId>("codex"),
    [messages, setMessages] = useState<ChatMessage[]>([]),
    [sessionList, setSessionList] = useState<{ id: string; lastAt: string }[]>(
      [],
    ),
    [before, setBefore] = useState<string | undefined>(undefined),
    [question, setQuestion] = useState(""),
    [error, setError] = useState(""),
    [stream, setStream] = useState(""),
    [busy, setBusy] = useState(false),
    [apiKey, setApiKey] = useState(""),
    [model, setModel] = useState(""),
    [inputPrice, setInputPrice] = useState(""),
    [outputPrice, setOutputPrice] = useState(""),
    [principal, setPrincipal] = useState<Principal | null>(null),
    [settings, setSettings] = useState<MonitorSettings | null>(null),
    [budget, setBudget] = useState<Budget | null>(null),
    [automaticStatus, setAutomaticStatus] = useState<{
      ok: boolean;
      error?: string;
    } | null>(null),
    [session, setSession] = useState("operations"),
    [pairing, setPairing] = useState("");
  const loadConnections = useCallback(async () => {
    try {
      setConnections(
        await client.request<ProviderConnection[]>("/ai/connections"),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connections unavailable");
    }
  }, [client]);
  useEffect(() => {
    void loadConnections();
    void client
      .request<Principal>("/session")
      .then(setPrincipal)
      .catch(() => {});
  }, [client, loadConnections]);
  useEffect(() => {
    let closed = false;
    const update = async () => {
      try {
        const [all, data, sessions] = await Promise.all([
          client.request<ChatMessage[]>(
            `/ai/messages?session=${encodeURIComponent(session)}${before ? `&before=${before}` : ""}`,
          ),
          client.request<{
            settings: MonitorSettings;
            budget: Budget;
            automaticAiStatus: { ok: boolean; error?: string } | null;
          }>("/settings"),
          client.request<{ id: string; lastAt: string }[]>("/ai/sessions"),
        ]);
        if (!closed) {
          setMessages(all);
          setSessionList(sessions);
          setSettings(data.settings);
          setBudget(data.budget);
          setAutomaticStatus(data.automaticAiStatus);
          const own = all.filter((m) => m.sessionId === session);
          const pending = own.some((m) => m.status === "pending");
          setBusy(pending);
          if (!pending) setStream("");
        }
      } catch (e) {
        if (!closed)
          setError(e instanceof Error ? e.message : "AI status unavailable");
      }
    };
    void update();
    const timer = setInterval(() => void update(), 2000);
    return () => {
      closed = true;
      clearInterval(timer);
    };
  }, [client, session, before]);
  useEffect(() => {
    if (delta?.sessionId === session) setStream((s) => s + delta.delta);
  }, [delta, session]);
  const connection = connections.find((c) => c.id === provider);
  useEffect(
    () => setModel(connection?.selectedModel ?? ""),
    [connection?.selectedModel, provider],
  );
  async function run(action: () => Promise<unknown>) {
    try {
      setError("");
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    }
  }
  const send = () =>
    run(async () => {
      setBusy(true);
      setStream("");
      await client.request("/ai/chat", {
        method: "POST",
        body: { provider, question, sessionId: session },
      });
      setQuestion("");
    });
  const connect = () =>
    run(async () => {
      await client.request("/ai/connect", {
        method: "POST",
        body: { provider, apiKey },
      });
      setApiKey("");
      await loadConnections();
    });
  const saveModel = () =>
    run(async () => {
      const price =
        provider === "openai" || provider === "grok"
          ? {
              inputPerMillion: Number(inputPrice),
              outputPerMillion: Number(outputPrice),
              verifiedAt: new Date().toISOString(),
            }
          : undefined;
      await client.request("/ai/model", {
        method: "POST",
        body: { provider, model: model || null, price },
      });
      await loadConnections();
    });
  const sessions = [
    ...new Set(["operations", ...sessionList.map((s) => s.id)]),
  ];
  const own = messages
    .filter((m) => m.sessionId === session)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return (
    <div className="rm-ai-layout">
      <article className="rm-panel rm-chat">
        <div className="rm-panel-heading">
          <h2>
            <Bot size={18} /> AI adviser
          </h2>
          <span>Read only</span>
        </div>
        <div className="rm-toolbar">
          <select
            aria-label="AI provider"
            value={provider}
            onChange={(e) => setProvider(e.target.value as ProviderId)}
          >
            {connections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <select
            aria-label="Conversation"
            value={session}
            onChange={(e) => {
              setSession(e.target.value);
              setBefore(undefined);
            }}
          >
            {sessions.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        {error && (
          <p className="rm-banner" role="alert">
            {error}
          </p>
        )}
        <div className="rm-actions">
          <Button
            variant="ghost"
            disabled={messages.length < 100}
            onClick={() => setBefore(messages[0]?.id)}
          >
            Earlier messages
          </Button>
          {before && (
            <Button variant="ghost" onClick={() => setBefore(undefined)}>
              Latest messages
            </Button>
          )}
        </div>
        <div className="rm-messages">
          {!own.length && (
            <div className="rm-empty">
              <Bot size={32} />
              <h2>Ask about this server</h2>
              <p>
                “What is causing the queue delay?”
                <br />
                “Which disk is under pressure?”
                <br />
                “Summarize failures since the last deployment.”
              </p>
            </div>
          )}
          {own.map((m) => (
            <div className={`rm-message ${m.role}`} key={m.id}>
              <span>
                {m.role === "user" ? "You" : m.provider} ·{" "}
                {timeLabel(m.createdAt)}
              </span>
              <p>
                {m.status === "pending"
                  ? stream || "Analyzing current evidence…"
                  : m.content}
              </p>
              {m.role === "assistant" && m.status === "complete" && (
                <MonitorEvidence client={client} at={m.createdAt} />
              )}
              {m.status === "failed" && (
                <small>Analysis unavailable; monitoring continues.</small>
              )}
            </div>
          ))}
        </div>
        <form
          className="rm-compose"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <textarea
            aria-label="Ask AI adviser"
            placeholder="Ask about current metrics, incidents or schedules…"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            maxLength={2000}
            rows={3}
          />
          <Button
            disabled={busy || !question.trim() || !connection?.connected}
            type="submit"
          >
            <Send size={16} />
            {busy ? "Analyzing…" : "Ask adviser"}
          </Button>
        </form>
        <p className="rm-note">
          Recommendations include evidence and uncertainty. Commands are never
          executed.
        </p>
      </article>
      <aside>
        <article className="rm-panel">
          <h2>Connection</h2>
          <p className="rm-note">
            {connection?.status ?? "Checking connections…"}
          </p>
          {(provider === "openai" || provider === "grok") &&
            !connection?.connected && (
              <>
                <label>
                  API key
                  <input
                    type="password"
                    autoComplete="off"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Stored encrypted on this server"
                  />
                </label>
                <Button onClick={() => void connect()} disabled={!apiKey}>
                  Connect
                </Button>
              </>
            )}
          <label>
            Model
            <select value={model} onChange={(e) => setModel(e.target.value)}>
              <option value="">Provider default</option>
              {connection?.models.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
          {(provider === "openai" || provider === "grok") && (
            <>
              <p className="rm-note">
                Enter the provider’s current standard price per million tokens.
                Unverified pricing blocks paid analysis.
              </p>
              <label>
                Input price (USD)
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={inputPrice}
                  onChange={(e) => setInputPrice(e.target.value)}
                />
              </label>
              <label>
                Output price (USD)
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={outputPrice}
                  onChange={(e) => setOutputPrice(e.target.value)}
                />
              </label>
            </>
          )}
          <div className="rm-actions">
            <Button variant="outline" onClick={() => void saveModel()}>
              Save selection
            </Button>
            <Button
              variant="ghost"
              onClick={() =>
                void run(async () => {
                  await client.request("/ai/disconnect", {
                    method: "POST",
                    body: { provider },
                  });
                  await loadConnections();
                })
              }
            >
              Disconnect
            </Button>
          </div>
          {connection?.quota && (
            <details>
              <summary>Account limits</summary>
              <pre className="rm-pre">
                {JSON.stringify(connection.quota, null, 2)}
              </pre>
            </details>
          )}
        </article>
        <article className="rm-panel">
          <h2>Paid API budget</h2>
          <strong className="rm-budget">
            ${(budget?.spentUsd ?? 0).toFixed(2)}{" "}
            <small>/ ${budget?.limitUsd ?? 100}</small>
          </strong>
          <p className="rm-note">
            Reported ${(budget?.reportedUsd ?? 0).toFixed(2)} · Estimated $
            {(budget?.estimatedUsd ?? 0).toFixed(2)}
            <br />
            Reserved ${(budget?.reservedUsd ?? 0).toFixed(2)} · {budget?.month}
            <br />
            Automatic ${(budget?.automaticUsd ?? 0).toFixed(2)} · Manual $
            {(budget?.manualUsd ?? 0).toFixed(2)}
            <br />
            Codex account limits are separate.
          </p>
        </article>
        <article className="rm-panel">
          <h2>Automatic analysis</h2>
          <label>
            <input
              type="checkbox"
              disabled={!principal?.aiOwner}
              checked={settings?.automaticAi ?? false}
              onChange={(e) =>
                void run(async () => {
                  const next = { ...settings!, automaticAi: e.target.checked };
                  await client.request("/settings", {
                    method: "PUT",
                    body: next,
                  });
                  setSettings(next);
                })
              }
            />{" "}
            Incidents and daily summary
          </label>
          <p className="rm-note">
            {settings?.dailySummaryTime ?? "09:00"} ·{" "}
            {settings?.timezone ?? "America/New_York"}
            <br />
            Default: {settings?.defaultProvider ?? "codex"}
            <br />
            No automatic provider switching.
          </p>
          {automaticStatus && !automaticStatus.ok && (
            <p className="rm-banner">{automaticStatus.error}</p>
          )}
          {!principal?.aiOwner && (
            <p className="rm-note">
              Desktop operator pairing is required to use the personal CLI
              connection and configure automatic analysis.
            </p>
          )}
        </article>
        <article className="rm-panel">
          <h2>Desktop account pairing</h2>
          {principal?.kind === "operator" ? (
            <>
              <label>
                Dashboard pairing ticket
                <input
                  type="password"
                  autoComplete="off"
                  value={pairing}
                  onChange={(e) => setPairing(e.target.value)}
                />
              </label>
              <Button
                variant="outline"
                onClick={() =>
                  void run(async () => {
                    await client.request("/operator/link", {
                      method: "POST",
                      body: { ticket: pairing },
                    });
                    setPairing("");
                  })
                }
              >
                Link my superadmin account
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              onClick={() =>
                void run(async () => {
                  const r = await client.request<{ ticket: string }>(
                    "/pairing",
                  );
                  await navigator.clipboard.writeText(r.ticket);
                })
              }
            >
              Copy 60-second pairing ticket
            </Button>
          )}
        </article>
      </aside>
    </div>
  );
}
