import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/services/api";
import { mapInvoiceResponse } from "@/services/invoiceService";
import type { InvoiceData } from "@/types/invoice";
import { downloadInvoicePdf } from "@/utils/invoiceDownloads";
import { SendInvoiceDialog } from "./SendInvoiceDialog";
import { Logo } from "@/components/layout/Logo";
import { BRAND_NAME, BRAND_EMAIL, BRAND_PHONE, BRAND_ADDRESS_LINES } from "@/config/brand";
import { resolveInvoicePricingDisplay } from "@/utils/invoicePricingSummary";
import "./invoice-composer.css";
type Line = { description: string; quantity: number; price: number };
type Client = { id: number; name: string; email: string };
type Shoot = {
  id: number;
  address: string;
  date: string;
  existing_invoice: string | null;
  lines: Line[];
};
const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
const today = () => new Date().toLocaleDateString("en-CA");
const invoiceDate = (value: string) => {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime())
    ? "Not available"
    : new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(date);
};
export function CreateInvoiceDialog({
  isOpen,
  onClose,
  onInvoiceCreate,
}: {
  isOpen: boolean;
  onClose: () => void;
  onInvoiceCreate: (invoice: InvoiceData) => void;
}) {
  const [clientSearch, setClientSearch] = useState(""),
    [shootSearch, setShootSearch] = useState(""),
    [clients, setClients] = useState<Client[]>([]),
    [shoots, setShoots] = useState<Shoot[]>([]),
    [client, setClient] = useState<Client | null>(null),
    [shoot, setShoot] = useState<Shoot | null>(null),
    [address, setAddress] = useState(""),
    [lines, setLines] = useState<Line[]>([{ description: "Photography", quantity: 1, price: 0 }]),
    [issue, setIssue] = useState(today),
    [due, setDue] = useState(today),
    [discount, setDiscount] = useState(0),
    [tax, setTax] = useState(0),
    [notes, setNotes] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState<InvoiceData | null>(null),
    [send, setSend] = useState(false),
    [loading, setLoading] = useState(false);
  const operation = useRef(crypto.randomUUID());
  useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      setLoading(true);
      apiClient
        .get("/admin/accounting-home/invoice-options", {
          params: {
            q: client ? shootSearch : clientSearch,
            ...(client ? { client_id: client.id } : {}),
          },
          signal: controller.signal,
        })
        .then((r) => (client ? setShoots(r.data.data) : setClients(r.data.data)))
        .catch((e) => {
          if (!controller.signal.aborted) setError(e.response?.data?.message ?? "Search could not load. Try again.");
        })
        .finally(() => setLoading(false));
    }, 200);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [isOpen, client, clientSearch, shootSearch]);
  const subtotal = lines.reduce((n, l) => n + Math.round(Number(l.price) * 100) * Number(l.quantity), 0),
    discountCents = Math.round(discount * 100),
    taxCents = Math.round(((subtotal - discountCents) * tax) / 100),
    total = (subtotal - discountCents + taxCents) / 100;
  const previewPricing = resolveInvoicePricingDisplay(
    saved ?? {
      subtotal: (subtotal - discountCents) / 100,
      subtotalBeforeDiscount: subtotal / 100,
      discountAmount: discountCents / 100,
      tax: taxCents / 100,
      total,
    },
  );
  const previewLines = saved?.items?.length
    ? saved.items.map((item) => ({
        description: item.description || String(item.meta?.service_name || "Service"),
        quantity: item.quantity ?? 1,
        price: item.unit_amount ?? 0,
        amount: item.total_amount ?? (item.unit_amount ?? 0) * (item.quantity ?? 1),
      }))
    : lines.map((line) => ({
        ...line,
        amount: (Math.round(line.price * 100) * line.quantity) / 100,
      }));
  const previewIssue = saved?.issueDate ?? saved?.date ?? issue;
  const previewDue = saved?.dueDate ?? due;
  const change = (i: number, key: keyof Line, value: string | number) =>
    setLines((rows) => rows.map((row, index) => (index === i ? { ...row, [key]: value } : row)));
  const reset = () => {
    setSaved(null);
    setClient(null);
    setShoot(null);
    setClientSearch("");
    setShootSearch("");
    setAddress("");
    setLines([{ description: "Photography", quantity: 1, price: 0 }]);
    setDiscount(0);
    setTax(0);
    setNotes("");
    setError("");
    operation.current = crypto.randomUUID();
  };
  return (
    <>
      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          if (!open && !busy) onClose();
        }}
      >
        <DialogContent className="invoice-composer-dialog">
          <DialogHeader>
            <DialogTitle>{saved ? "Invoice saved" : "Create invoice"}</DialogTitle>
            <DialogDescription>
              {saved
                ? "Saved to accounting. Download the invoice or send it to the registered client."
                : "Choose a client and an unbilled shoot, or enter a manual property invoice. USD."}
            </DialogDescription>
          </DialogHeader>
          <div className="invoice-composer-columns">
            <form
              id="invoice-composer"
              className="invoice-composer-form"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!client || !address || discountCents > subtotal || total <= 0) {
                  setError("Select a client, enter an address and check line amounts and discount.");
                  return;
                }
                setBusy(true);
                setError("");
                try {
                  const result = await apiClient.post("/admin/accounting-home/invoices", {
                    operation_key: operation.current,
                    client_id: client.id,
                    shoot_id: shoot?.id ?? null,
                    address,
                    issue_date: issue,
                    due_date: due,
                    lines,
                    discount,
                    tax_rate: tax,
                    notes,
                  });
                  const invoice = mapInvoiceResponse(result.data.data);
                  setSaved(invoice);
                  onInvoiceCreate(invoice);
                } catch (err) {
                  setError(
                    (err as { response?: { data?: { message?: string } } }).response?.data?.message ??
                      "Invoice could not save. Check the fields and retry.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              <fieldset disabled={busy || Boolean(saved)}>
                <label>
                  Search clients
                  <Input
                    aria-label="Search clients"
                    placeholder="Client name or email"
                    value={clientSearch}
                    onChange={(e) => {
                      if (shoot) {
                        setAddress("");
                        setLines([{ description: "Photography", quantity: 1, price: 0 }]);
                      }
                      setClientSearch(e.target.value);
                      setClient(null);
                      setShoot(null);
                      setShootSearch("");
                    }}
                  />
                </label>
                {client ? (
                  <div className="composer-selected">
                    <b>{client.name}</b>
                    <small>{client.email}</small>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (shoot) {
                          setAddress("");
                          setLines([
                            {
                              description: "Photography",
                              quantity: 1,
                              price: 0,
                            },
                          ]);
                        }
                        setClient(null);
                        setShoot(null);
                      }}
                    >
                      Change client
                    </Button>
                  </div>
                ) : (
                  <div className="composer-search-results" aria-label="Client search results">
                    {clients.map((c) => (
                      <button
                        type="button"
                        key={c.id}
                        onClick={() => {
                          setClient(c);
                          setShoot(null);
                          setError("");
                        }}
                      >
                        <b>{c.name}</b>
                        <small>{c.email}</small>
                      </button>
                    ))}
                    {loading ? <p role="status">Searching…</p> : !clients.length && <p>No matching clients.</p>}
                  </div>
                )}
                {client && (
                  <>
                    <label>
                      Search shoots
                      <Input
                        aria-label="Search shoots"
                        placeholder="Property address"
                        value={shootSearch}
                        onChange={(e) => setShootSearch(e.target.value)}
                      />
                    </label>
                    <div className="composer-search-results" aria-label="Shoot search results">
                      {shoots.map((s) => (
                        <button
                          type="button"
                          key={s.id}
                          disabled={Boolean(s.existing_invoice)}
                          aria-pressed={shoot?.id === s.id}
                          onClick={() => {
                            setShoot(s);
                            setAddress(s.address);
                            setLines(
                              s.lines.length
                                ? s.lines
                                : [
                                    {
                                      description: "Service",
                                      quantity: 1,
                                      price: 0,
                                    },
                                  ],
                            );
                            setError("");
                          }}
                        >
                          <b>{s.address}</b>
                          <small>
                            {s.date} ·{" "}
                            {s.existing_invoice
                              ? "Already invoiced: " + s.existing_invoice
                              : "Unbilled · " + s.lines.length + " service lines"}
                          </small>
                        </button>
                      ))}
                      {loading ? (
                        <p role="status">Searching…</p>
                      ) : (
                        !shoots.length && <p>No matching unbilled shoots. Enter a manual property below.</p>
                      )}
                    </div>
                    {shoot && (
                      <Button type="button" size="sm" variant="outline" onClick={() => setShoot(null)}>
                        Use manual invoice instead
                      </Button>
                    )}
                  </>
                )}
                <label>
                  Property address
                  <Input required value={address} onChange={(e) => setAddress(e.target.value)} maxLength={2000} />
                </label>
                <div className="composer-date-fields">
                  <label>
                    Issue date
                    <Input type="date" required value={issue} onChange={(e) => setIssue(e.target.value)} />
                  </label>
                  <label>
                    Due date
                    <Input type="date" required min={issue} value={due} onChange={(e) => setDue(e.target.value)} />
                  </label>
                </div>
                <div className="composer-lines">
                  {lines.map((l, i) => (
                    <div key={i}>
                      <label>
                        Service / description
                        <Input required maxLength={500} value={l.description} onChange={(e) => change(i, "description", e.target.value)} />
                      </label>
                      <div>
                        <label>
                          Qty
                          <Input
                            type="number"
                            required
                            min="1"
                            max="10000"
                            step="1"
                            value={l.quantity}
                            onChange={(e) => change(i, "quantity", Number(e.target.value))}
                          />
                        </label>
                        <label>
                          Unit price (USD)
                          <Input
                            type="number"
                            required
                            min="0"
                            max="1000000"
                            step=".01"
                            value={l.price}
                            onChange={(e) => change(i, "price", Number(e.target.value))}
                          />
                        </label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          aria-label={"Remove line " + (i + 1)}
                          disabled={lines.length === 1}
                          onClick={() => setLines((rows) => rows.filter((_, index) => index !== i))}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={lines.length >= 50}
                  onClick={() => setLines((rows) => [...rows, { description: "", quantity: 1, price: 0 }])}
                >
                  Add line
                </Button>
                <div className="composer-date-fields">
                  <label>
                    Discount (USD)
                    <Input type="number" min="0" step=".01" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} />
                  </label>
                  <label>
                    Tax (%)
                    <Input type="number" min="0" max="100" step=".01" value={tax} onChange={(e) => setTax(Number(e.target.value))} />
                  </label>
                </div>
                <label>
                  Notes
                  <Input maxLength={5000} value={notes} onChange={(e) => setNotes(e.target.value)} />
                </label>
              </fieldset>
            </form>
            <section className="composer-preview" aria-label="Invoice preview">
              <header className="composer-invoice-header">
                <div className="composer-invoice-brand">
                  <Logo variant="dark" className="composer-invoice-logo" />
                  <div>
                    <b>{BRAND_NAME}</b>
                    <small>Phone: {BRAND_PHONE}</small>
                    <small>Email: {BRAND_EMAIL}</small>
                  </div>
                </div>
                <div className="composer-invoice-reference">
                  <h2>INVOICE</h2>
                  <b>{saved ? `#${saved.number.replace(/^#/, "")}` : "Draft preview"}</b>
                  <span>{invoiceDate(previewIssue)}</span>
                  <small>{saved?.property || address || "Property address"}</small>
                </div>
              </header>
              <div className="composer-invoice-to">
                <div>
                  <h3>Invoice To</h3>
                  <b>{saved?.client || client?.name || "Select client"}</b>
                  <small>{saved?.clientProfile?.email || client?.email}</small>
                </div>
                <div className="composer-invoice-due">
                  <span>Due {invoiceDate(previewDue)}</span>
                  <small>{saved?.status || "Draft"}</small>
                </div>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Service(s)</th>
                    <th>Rate</th>
                    <th>Quantity</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {previewLines.map((l, i) => (
                    <tr key={i}>
                      <td>{l.description}</td>
                      <td>{money(l.price)}</td>
                      <td>{l.quantity}</td>
                      <td>{money(l.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <dl>
                {previewPricing.rows.map((row) => (
                  <div key={row.key}>
                    <dt>{row.label}</dt>
                    <dd>{money(row.amount)}</dd>
                  </div>
                ))}
                <div className="composer-invoice-total">
                  <dt>Total Due:</dt>
                  <dd>{money(previewPricing.total)}</dd>
                </div>
              </dl>
              {(saved?.notes || notes) && (
                <div className="composer-invoice-notes">
                  <h3>Notes</h3>
                  <p>{saved?.notes || notes}</p>
                </div>
              )}
              <footer className="composer-document-footer">
                {BRAND_ADDRESS_LINES.map((line) => (
                  <small key={line}>{line}</small>
                ))}
                <small>
                  {saved ? `Saved ${saved.status} · no payment recorded` : "Draft preview · invoice number assigned when saved"}
                </small>
              </footer>
            </section>
          </div>
          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
          <footer className="composer-footer">
            <Button variant="outline" onClick={onClose} disabled={busy}>
              Close
            </Button>
            {saved ? (
              <>
                <Button variant="outline" onClick={() => void downloadInvoicePdf(saved)}>
                  Download PDF
                </Button>
                <Button onClick={() => setSend(true)}>Send invoice</Button>
                <Button variant="outline" onClick={reset}>
                  New invoice
                </Button>
              </>
            ) : (
              <Button type="submit" form="invoice-composer" disabled={busy || !client}>
                {busy ? "Saving…" : "Create invoice"}
              </Button>
            )}
          </footer>
        </DialogContent>
      </Dialog>
      {saved && (
        <SendInvoiceDialog
          invoice={saved}
          isOpen={send}
          onClose={() => setSend(false)}
          onSent={() => {
            const issued = { ...saved, status: "sent" as const };
            setSaved(issued);
            onInvoiceCreate(issued);
          }}
        />
      )}
    </>
  );
}
