import {buildAccountingReport} from './accountingHomeHelpers';
import {HomeAmount,Module} from './AccountingHomeParts';
import {day,money,exportRowsAsCsv,useReducedMotion,workspaceTabs,type Props} from './accountingHomeHelpers';
import { registerInvoicesRefresh } from "@/realtime/realtimeRefreshBus";
import React, { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  ArrowUpRight,
  Camera,
  Check,
  ChevronRight,
  Download,
  FileText,
  Users,
  Wallet,
  Wrench,
  Pencil,
  Plus,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { apiClient, getImpersonatedUserId } from "@/services/api";
import { fetchAccountingHome, type AccountingHomeData, type HomeLedgerRow } from "@/services/accountingHomeService";
import { createAccountingExpense } from "@/services/accountingExpenseService";
import { mapInvoiceResponse } from "@/services/invoiceService";
import type { InvoiceData } from "@/types/invoice";
import "./accounting-home.css";
const Photographers = lazy(() =>
  import("./PhotographerInvoiceReviewWorkspace").then((m) => ({ default: m.PhotographerInvoiceReviewWorkspace })),
);
const Reps = lazy(() => import("./SalesRepInvoiceReviewWorkspace").then((m) => ({ default: m.SalesRepInvoiceReviewWorkspace })));
const Editors = lazy(() => import("./EditorEarningsWorkspace").then((m) => ({ default: m.EditorEarningsWorkspace })));
const Equipment = lazy(() => import("./PhotographerEquipmentWorkspace").then((m) => ({ default: m.PhotographerEquipmentWorkspace })));
export function AccountingHome({ start, end, invoices, onView, onFilterInvoices, canCreateExpense }: Props) {
  const { user, role } = useAuth(),
    { toast } = useToast(),
    reduced = useReducedMotion();
  const query = useQuery({
    queryKey: ["accounting-home", user?.id, role, getImpersonatedUserId(), start, end],
    queryFn: ({ signal }) => fetchAccountingHome(start, end, signal),
    staleTime: 30000,
  });
  const refetchHome = query.refetch;
  useEffect(
    () =>
      registerInvoicesRefresh(async () => {
        await refetchHome();
      }),
    [refetchHome],
  );
  const data = query.data;
  const [workspace, setWorkspace] = useState<(typeof workspaceTabs)[number]>("Client invoices"),
    [report, setReport] = useState("Cash movement"),
    [search, setSearch] = useState(""),
    [category, setCategory] = useState("all"),
    [chart, setChart] = useState("area"),
    [detail, setDetail] = useState<{ title: string; body: React.ReactNode } | null>(null),
    [expenseForm, setExpenseForm] = useState(false),
    [saving, setSaving] = useState(false),
    [saveError, setSaveError] = useState("");
  const records = useRef<HTMLDivElement>(null);
  const jump = (tab: (typeof workspaceTabs)[number], status?: string) => {
    setWorkspace(tab);
    setSearch("");
    setCategory("all");
    if (tab === "Client invoices") onFilterInvoices(status);
    requestAnimationFrame(() => records.current?.scrollIntoView({ behavior: reduced ? "instant" : "smooth", block: "start" }));
  };
  const openInvoice = async (id: number) => {
    try {
      const response = await apiClient.get("/admin/invoices/" + id);
      onView(mapInvoiceResponse(response.data.data ?? response.data));
    } catch (e) {
      toast({ title: "Unable to open invoice", description: e instanceof Error ? e.message : "Try again", variant: "destructive" });
    }
  };
  const detailLedger = (r: HomeLedgerRow) =>
    setDetail({
      title: r.name,
      body: (
        <>
          <dl className="home-detail">
            <dt>Amount</dt>
            <dd>{money(r.amount)}</dd>
            <dt>Payment date</dt>
            <dd>{day(r.date)}</dd>
            <dt>Category</dt>
            <dd>{r.category}</dd>
            <dt>Method</dt>
            <dd>{r.method}</dd>
            <dt>Reference</dt>
            <dd>{r.reference}</dd>
          </dl>
          {r.invoice_id && (
            <Button
              onClick={() => {
                setDetail(null);
                void openInvoice(r.invoice_id!);
              }}
            >
              View linked invoice
            </Button>
          )}
        </>
      ),
    });
  const reportRows=(d:AccountingHomeData)=>buildAccountingReport(d,report);
  if (query.isLoading)
    return (
      <div className="home-loading" role="status">
        Loading accounting overview…
      </div>
    );
  if (!data)
    return (
      <div role="alert" className="home-module p-5">
        The accounting overview could not load.{" "}
        <Button variant="outline" onClick={() => void query.refetch()}>
          Retry
        </Button>
      </div>
    );
  const delta = data.prior_received ? Math.round(((data.received - data.prior_received) / Math.abs(data.prior_received)) * 100) : null,
    approved = (data.recipients.photographer?.unpaid ?? 0) + (data.recipients.rep?.unpaid ?? 0),
    overdue = Object.entries(data.aging)
      .filter(([k]) => k !== "Current")
      .reduce((n, [, v]) => n + v, 0);
  const filteredLedger = data.ledger.filter(
    (r) =>
      (category === "all" || r.category === category) &&
      [r.name, r.reference, r.method].some((v) => v.toLowerCase().includes(search.toLowerCase())),
  );
  const filteredExpenses = data.expenses.filter((r) =>
    [r.name, r.category, r.status].some((v) => v.toLowerCase().includes(search.toLowerCase())),
  );
  const chartParts = (
    <>
      <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 6" vertical={false} />
      <XAxis
        dataKey="date"
        tickFormatter={day}
        tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
        axisLine={false}
        tickLine={false}
        minTickGap={35}
      />
      <YAxis
        width={44}
        tickFormatter={(v) => "$" + new Intl.NumberFormat("en-US", { notation: "compact" }).format(v)}
        tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
        axisLine={false}
        tickLine={false}
      />
      <Tooltip
        formatter={(v: number) => money(v)}
        labelFormatter={(v) => day(String(v))}
        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 10 }}
      />
    </>
  );
  return (
    <div className="accounting-home-v1">
      <section className="home-cash-hero">
        <div className="home-hero-top">
          <div>
            <p>
              Client cash received · {day(start)}–{day(end)}
            </p>
            <HomeAmount value={data.received} className="home-hero-number" />
            <small>
              {delta === null ? "No comparable data" : `${delta >= 0 ? "+" : ""}${delta}% vs previous matching period`} · net of refunds
            </small>
          </div>
          <div className="home-hero-context">
            <button onClick={() => jump("Client invoices")}>
              <Users />
              <span>
                Client accounts<b>{data.accounts} issued accounts</b>
              </span>
            </button>
            <button onClick={() => jump("Client invoices", "pending")}>
              <FileText />
              <span>
                Open invoices<b>{data.open_count} to collect</b>
              </span>
            </button>
            <button onClick={() => jump("Recipient payouts")}>
              <Wallet />
              <span>
                Payout handoff<b>{money(approved)} ready to pay</b>
              </span>
            </button>
          </div>
        </div>
        <div className="home-position-label">
          <span>Receipts & client balances</span>
          <span>{day(start)}–{day(end)} · balances as of {day(end)}</span>
        </div>
        <div className="home-collection-strip">
          <button className="collected" onClick={() => { jump("Cash movement & reports"); setCategory("client"); }}>
            <Check size={14} />
            Collected <HomeAmount value={data.collected} />
          </button>
          <button className="outstanding" onClick={() => jump("Client invoices", "pending")}>
            Outstanding <HomeAmount value={data.open} />
          </button>
          <button className="past-due" onClick={() => jump("Client invoices", "overdue")}>
            Past due <HomeAmount value={overdue} />
            <ArrowUpRight size={14} />
          </button>
        </div>
        <div className="home-cash-bottom">
          <button onClick={() => jump("Cash movement & reports")}>
            <small>Recipient cash paid</small>
            <HomeAmount value={data.paid} />
          </button>
          <button onClick={() => jump("Cash movement & reports")}>
            <small>Net recorded cash movement</small>
            <HomeAmount value={data.received - data.paid} />
          </button>
          <button onClick={() => jump("Editor earnings")}>
            <small>Editor earnings to pay</small>
            <HomeAmount value={data.recipients.editor?.unpaid ?? 0} />
          </button>
          <details>
            <summary>Cash & balance basis</summary>
            <p>{data.cash_basis_note}</p>
          </details>
        </div>
      </section>
      <div className="home-overview-grid">
        <Module
          title="Cash movement"
          context="Recorded payment dates"
          actions={
            <select aria-label="Chart type" value={chart} onChange={(e) => setChart(e.target.value)}>
              <option value="area">Area</option>
              <option value="line">Line</option>
              <option value="bar">Bar</option>
            </select>
          }
        >
          <div className="home-chart-legend">
            <span>Client receipts</span>
            <span>Recipient cash paid</span>
          </div>
          <div className="home-cash-chart">
            <ResponsiveContainer width="100%" height={210}>
              {chart === "bar" ? (
                <BarChart data={data.daily} onClick={() => jump("Cash movement & reports")}>
                  {chartParts}
                  <Bar
                    dataKey="received"
                    name="Client receipts"
                    fill="hsl(var(--primary))"
                    radius={[3, 3, 0, 0]}
                    isAnimationActive={!reduced}
                  />
                  <Bar dataKey="paid" name="Recipient cash paid" fill="#c79538" radius={[3, 3, 0, 0]} isAnimationActive={!reduced} />
                </BarChart>
              ) : chart === "line" ? (
                <LineChart data={data.daily} onClick={() => jump("Cash movement & reports")}>
                  {chartParts}
                  <Line
                    dataKey="received"
                    name="Client receipts"
                    stroke="hsl(var(--primary))"
                    dot={false}
                    strokeWidth={2}
                    isAnimationActive={!reduced}
                  />
                  <Line dataKey="paid" name="Recipient cash paid" stroke="#c79538" dot={false} isAnimationActive={!reduced} />
                </LineChart>
              ) : (
                <AreaChart data={data.daily} onClick={() => jump("Cash movement & reports")}>
                  {chartParts}
                  <defs>
                    <linearGradient id="homeReceipt" x1="0" y1="0" x2="0" y2="1">
                      <stop stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="1" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <Area
                    dataKey="received"
                    name="Client receipts"
                    stroke="hsl(var(--primary))"
                    fill="url(#homeReceipt)"
                    strokeWidth={2}
                    isAnimationActive={!reduced}
                  />
                  <Area dataKey="paid" name="Recipient cash paid" stroke="#c79538" fill="transparent" isAnimationActive={!reduced} />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>
          <div className="home-chart-totals">
            <span>
              Received <b>{money(data.received)}</b>
            </span>
            <span>
              Paid <b>{money(data.paid)}</b>
            </span>
            <span>
              Net <b>{money(data.received - data.paid)}</b>
            </span>
          </div>
        </Module>
        <Module title="Client collections" context={`Receipt dates / issue dates · balances as of ${day(end)}`}>
          <div className="home-small-metrics">
            <button onClick={() => { jump("Cash movement & reports"); setCategory("client"); }}>
              <small>Received in selected period</small>
              <b>{money(data.collected)}</b>
            </button>
            <button onClick={() => jump("Client invoices", "pending")}>
              <small>Issued in period · outstanding</small>
              <b>{money(data.open)}</b>
            </button>
            <button onClick={() => jump("Client invoices", "overdue")}>
              <small>Past due as of {day(end)}</small>
              <b>{money(overdue)}</b>
            </button>
          </div>
          <h3>Payment methods · selected dates</h3>
          {Object.entries(data.methods).map(([method, amount]) => (
            <button
              key={method}
              className="home-list-row"
              onClick={() => {
                jump("Cash movement & reports");
                setSearch(method);
              }}
            >
              <span>{method}</span>
              <b>{money(amount)}</b>
            </button>
          ))}
        </Module>
        <Module
          title="Expense Center"
          context="Expense dates · recorded costs"
          actions={
            canCreateExpense && (
              <Button size="sm" onClick={() => setExpenseForm(true)}>
                <Plus className="mr-1 h-3 w-3" />
                Add expense
              </Button>
            )
          }
        >
          <div className="home-small-metrics">
            <button onClick={() => jump("Expenses")}>
              <small>Recorded expenses</small>
              <b>{money(data.expenses.filter((r) => !r.reimbursable).reduce((n, r) => n + r.amount, 0))}</b>
            </button>
            <button onClick={() => jump("Expenses")}>
              <small>Missing receipts</small>
              <b>{data.expenses.filter((r) => !r.receipt).length}</b>
            </button>
          </div>
          <div className="home-scroll" tabIndex={0} aria-label="Expenses">
            {data.expenses.slice(0, 8).map((r) => (
              <button key={r.id} className="home-list-row" onClick={() => jump("Expenses")}>
                <span>
                  <b>{r.name}</b>
                  <small>
                    {r.category} · {r.receipt ? "Receipt attached" : "Receipt missing"}
                  </small>
                </span>
                <b>{money(r.amount)}</b>
                <ChevronRight size={14} />
              </button>
            ))}
            {!data.expenses.length && <p className="home-empty">No expenses in this period.</p>}
          </div>
          <button className="home-text-link" onClick={() => jump("Expenses")}>
            View all expenses <ChevronRight size={13} />
          </button>
        </Module>
        <Module title="Recent financial activity" context="Recorded receipts, refunds & payouts">
          <div className="home-scroll" tabIndex={0} aria-label="Recent financial activity">
            {data.ledger.slice(0, 8).map((r) => (
              <button key={r.id} className="home-list-row" onClick={() => detailLedger(r)}>
                <span>
                  <b>{r.name}</b>
                  <small>
                    {day(r.date)} · {r.method}
                  </small>
                </span>
                <b className={r.amount < 0 ? "home-negative" : ""}>{money(r.category === "client" ? r.amount : -r.amount)}</b>
                <ChevronRight size={13} />
              </button>
            ))}
            {!data.ledger.length && <p className="home-empty">No recorded payments in this period.</p>}
          </div>
          <button className="home-text-link" onClick={() => jump("Cash movement & reports")}>
            View all transactions <ChevronRight size={13} />
          </button>
        </Module>
      </div>
      <Module title="Needs attention" context="Collections, reviews & missing evidence" className="home-attention">
        <div className="home-attention-list">
          {data.attention.slice(0, 4).map((r) => (
            <button key={r.id} className="home-attention-item" onClick={() => void openInvoice(r.id)}>
              <span>
                <b>{r.name}</b>
                <small>{r.label}</small>
              </span>
              <b>{money(r.amount)}</b>
              <ChevronRight size={14} />
            </button>
          ))}
          {Object.entries(data.recipients)
            .filter(([, r]) => r.review)
            .map(([key, r]) => (
              <button
                key={key}
                className="home-attention-item"
                onClick={() => jump(key === "rep" ? "Sales rep payouts" : "Recipient payouts")}
              >
                <span>
                  <b>{key === "rep" ? "Sales rep" : "Photographer"} reviews</b>
                  <small>Review required before payment</small>
                </span>
                <b>{r.review}</b>
                <ChevronRight size={14} />
              </button>
            ))}
          {!data.attention.length && !Object.values(data.recipients).some((r) => r.review) && (
            <p className="home-empty">No overdue balances or payout reviews.</p>
          )}
        </div>
      </Module>
      <div className="home-recipient-strip">
        {[
          ["Photographers", Camera, "photographer", "Recipient payouts"],
          ["Sales reps", Users, "rep", "Sales rep payouts"],
          ["Editors", Pencil, "editor", "Editor earnings"],
        ].map(([name, Icon, key, tab]) => {
          const r = data.recipients[String(key)],
            I = Icon as typeof Camera;
          return (
            <section key={String(key)}>
              <button className="home-recipient-title" onClick={() => jump(tab as (typeof workspaceTabs)[number])}>
                <I size={15} />
                {String(name)}
                <ArrowUpRight size={13} />
              </button>
              <button className="home-recipient-amount" onClick={() => jump("Cash movement & reports")}>
                <small>Paid in selected period</small>
                <HomeAmount value={r.paid} />
              </button>
              <button className="home-recipient-amount home-recipient-unpaid" onClick={() => jump(tab as (typeof workspaceTabs)[number])}>
                <small>{key === "editor" ? "Earnings to pay" : "Ready to pay"}</small>
                <HomeAmount value={r.unpaid} />
                <small>{key === "editor" ? "Selected work dates · not paid" : "Selected earning period · approved, not paid"}</small>
              </button>
            </section>
          );
        })}
        <section>
          <button className="home-recipient-title" onClick={() => jump("Expenses")}>
            <Wallet size={15} />
            Expenses
            <ArrowUpRight size={13} />
          </button>
          <button className="home-recipient-amount" onClick={() => jump("Expenses")}>
            <small>Recorded in period</small>
            <HomeAmount value={data.expenses.filter((r) => !r.reimbursable).reduce((n, r) => n + r.amount, 0)} />
          </button>
          <small>Expense dates · payment not verified</small>
        </section>
        <section>
          <button className="home-recipient-title" onClick={() => jump("Equipment")}>
            <Wrench size={15} />
            Equipment
            <ArrowUpRight size={13} />
          </button>
          <button className="home-recipient-amount" onClick={() => jump("Equipment")}>
            <small>Expense-linked</small>
            <strong>{data.equipment.linked}</strong>
          </button>
          <button className="home-recipient-amount home-recipient-unpaid" onClick={() => jump("Equipment")}>
            <small>Awaiting verification</small>
            <strong>{data.equipment.pending}</strong>
            <small>Selected assignment dates · not a payment</small>
          </button>
        </section>
      </div>
      <div className="home-insights">
        <Module
          title="Service performance"
          context="Invoice issue dates · gross service lines"
          actions={
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                exportRowsAsCsv(
                  data.services.map((r) => ({ service: r.name, sales: r.sales, orders: r.orders, units: r.units, prior: r.prior })),
                  "service-sales",
                )
              }
            >
              <Download size={13} />
              <span className="ml-1">CSV</span>
            </Button>
          }
        >
          <div className="home-service-chart" aria-label="Sales by service">
            {data.services.slice(0, 7).map((r) => (
              <button
                key={r.name}
                onClick={() =>
                  setDetail({
                    title: r.name,
                    body: (
                      <>
                        <p>
                          {r.orders} invoices · {r.units} units · {money(r.sales)} gross service sales
                        </p>
                        <div className="home-scroll">
                          {r.invoice_ids.map((id) => (
                            <Button
                              key={id}
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setDetail(null);
                                void openInvoice(id);
                              }}
                            >
                              View invoice {id}
                            </Button>
                          ))}
                        </div>
                      </>
                    ),
                  })
                }
              >
                <b>{money(r.sales)}</b>
                <i style={{ height: Math.max(3, (r.sales / Math.max(1, ...data.services.map((s) => s.sales))) * 90) + "px" }} />
                <small>{r.name}</small>
              </button>
            ))}
          </div>
          <div className="home-scroll">
            {data.services.map((r) => (
              <button
                className="home-list-row"
                key={r.name}
                onClick={() =>
                  setDetail({
                    title: r.name,
                    body: (
                      <>
                        <p>
                          {money(r.sales)} gross service sales · {r.orders} invoices · {r.units} units
                        </p>
                        <p>
                          {r.prior
                            ? `${Math.round(((r.sales - r.prior) / r.prior) * 100)}% vs matching prior period`
                            : "No comparable data"}
                        </p>
                        {r.invoice_ids.map((id) => (
                          <Button
                            key={id}
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setDetail(null);
                              void openInvoice(id);
                            }}
                          >
                            Invoice {id}
                          </Button>
                        ))}
                      </>
                    ),
                  })
                }
              >
                <span>
                  <b>{r.name}</b>
                  <small>
                    {r.orders} orders · {r.prior ? `${Math.round(((r.sales - r.prior) / r.prior) * 100)}% vs prior` : "No comparable data"}
                  </small>
                </span>
                <b>{money(r.sales)}</b>
                {r.prior && r.sales < r.prior * 0.8 ? (
                  <span className="home-status amber">Needs attention</span>
                ) : (
                  <ChevronRight size={14} />
                )}
              </button>
            ))}
          </div>
          {!data.services.length && <p className="home-empty">No service sales in this period.</p>}
        </Module>
        <Module title="Listing Studio subscriptions" context="Selected billing periods · current plan status">
          <div className="home-small-metrics">
            <div>
              <small>Active plans</small>
              <b>{data.subscriptions.filter((r) => r.status === "active").length}</b>
            </div>
            <div>
              <small>Active monthly USD value</small>
              <b>
                {money(
                  data.subscriptions
                    .filter((r) => r.status === "active" && r.currency?.toLowerCase() === "usd" && r.interval === "month")
                    .reduce((n, r) => n + r.amount, 0),
                )}
              </b>
            </div>
            <div>
              <small>Needs attention</small>
              <b>{data.subscriptions.filter((r) => r.attention).length}</b>
            </div>
          </div>
          <div className="home-scroll">
            {data.subscriptions.map((r) => (
              <button
                key={r.id}
                className="home-list-row"
                onClick={() =>
                  setDetail({
                    title: r.name,
                    body: (
                      <dl className="home-detail">
                        <dt>Plan</dt>
                        <dd>{r.plan}</dd>
                        <dt>Billing</dt>
                        <dd>
                          {r.currency?.toUpperCase()} {r.amount} / {r.interval}
                        </dd>
                        <dt>Status</dt>
                        <dd>{r.status}</dd>
                        <dt>Period ends</dt>
                        <dd>{r.end ? day(r.end) : "—"}</dd>
                        <dt>Cash basis</dt>
                        <dd>Subscription billing value is excluded from client invoice cash totals.</dd>
                      </dl>
                    ),
                  })
                }
              >
                <span>
                  <b>{r.name}</b>
                  <small>
                    {r.plan} · {r.end ? "Ends " + day(r.end) : "No end date"}
                  </small>
                </span>
                <span className={`home-status ${r.attention ? "amber" : ""}`}>{r.status}</span>
                <ChevronRight size={14} />
              </button>
            ))}
            {!data.subscriptions.length && <p className="home-empty">No subscription billing periods overlap these dates.</p>}
          </div>
        </Module>
      </div>
      <div ref={records} className="home-workspaces">
        <header>
          <h2>Accounting records</h2>
          <small>{day(start)}–{day(end)} · registers and reports</small>
        </header>
        <div role="tablist" aria-label="Accounting records" className="home-record-tabs">
          {workspaceTabs.map((tab, index) => (
            <button
              type="button"
              role="tab"
              id={"home-tab-" + index}
              aria-controls="home-record-panel"
              aria-selected={workspace === tab}
              tabIndex={workspace === tab ? 0 : -1}
              key={tab}
              onClick={() => {
                setWorkspace(tab);
                setSearch("");
                setCategory("all");
              }}
              onKeyDown={(e) => {
                let next = index;
                if (e.key === "ArrowRight") next = (index + 1) % workspaceTabs.length;
                else if (e.key === "ArrowLeft") next = (index + workspaceTabs.length - 1) % workspaceTabs.length;
                else if (e.key === "Home") next = 0;
                else if (e.key === "End") next = workspaceTabs.length - 1;
                else return;
                e.preventDefault();
                setWorkspace(workspaceTabs[next]);
                document.getElementById("home-tab-" + next)?.focus();
              }}
            >
              {tab}
            </button>
          ))}
        </div>
        <div
          id="home-record-panel"
          role="tabpanel"
          aria-labelledby={"home-tab-" + workspaceTabs.indexOf(workspace)}
          className="home-record-panel"
        >
          <Suspense fallback={<p role="status">Loading records…</p>}>
            {workspace === "Client invoices" ? (
              invoices
            ) : workspace === "Recipient payouts" ? (
              <Photographers reportingRange={{ startDate: start, endDate: end }} />
            ) : workspace === "Sales rep payouts" ? (
              <Reps reportingRange={{ startDate: start, endDate: end }} />
            ) : workspace === "Editor earnings" ? (
              <Editors mode="admin" startDate={start} endDate={end} />
            ) : workspace === "Equipment" ? (
              <Equipment reportingRange={{ startDate: start, endDate: end }} />
            ) : workspace === "Expenses" ? (
              <>
                <div className="home-toolbar">
                  <label>
                    <Search size={14} />
                    <input
                      aria-label="Search expenses"
                      placeholder="Search expenses"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </label>
                  {canCreateExpense && (
                    <Button size="sm" onClick={() => setExpenseForm(true)}>
                      <Plus size={14} />
                      Add expense
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      exportRowsAsCsv(
                        filteredExpenses.map((r) => ({
                          vendor: r.name,
                          category: r.category,
                          amount: r.amount,
                          date: r.date,
                          status: r.status,
                          receipt: r.receipt ? "Attached" : "Missing",
                        })),
                        "operating-expenses",
                      )
                    }
                  >
                    Export CSV
                  </Button>
                </div>
                <div className="home-scroll home-register-scroll">
                  {filteredExpenses.map((r) => (
                    <button
                      key={r.id}
                      className="home-list-row"
                      onClick={() =>
                        setDetail({
                          title: r.name,
                          body: (
                            <>
                              <dl className="home-detail">
                                <dt>Recorded cost</dt>
                                <dd>{money(r.amount)}</dd>
                                <dt>Expense date</dt>
                                <dd>{day(r.date)}</dd>
                                <dt>Review</dt>
                                <dd>{r.status}</dd>
                                <dt>Receipt</dt>
                                <dd>{r.receipt ? "Attached" : "Missing"}</dd>
                                <dt>Link</dt>
                                <dd>{r.linked || "Standalone"}</dd>
                                <dt>Payment</dt>
                                <dd>No operating payment evidence stored.</dd>
                              </dl>
                              {r.receipt_url && (
                                <Button
                                  onClick={async () => {
                                    try {
                                      const response = await apiClient.get(r.receipt_url!, { responseType: "blob" });
                                      const url = URL.createObjectURL(response.data);
                                      window.open(url, "_blank", "noopener");
                                      setTimeout(() => URL.revokeObjectURL(url), 60000);
                                    } catch {
                                      toast({ title: "Receipt could not load", description: "Try opening it again.", variant: "destructive" });
                                    }
                                  }}
                                >
                                  View receipt
                                </Button>
                              )}
                            </>
                          ),
                        })
                      }
                    >
                      <span>
                        <b>{r.name}</b>
                        <small>
                          {r.category} · {day(r.date)}
                        </small>
                      </span>
                      <span className="home-status">{r.status}</span>
                      <b>{money(r.amount)}</b>
                      <ChevronRight size={14} />
                    </button>
                  ))}
                  {!filteredExpenses.length && <p className="home-empty">No matching expenses.</p>}
                </div>
              </>
            ) : (
              <>
                <div className="home-report-tabs">
                  {[
                    "Cash movement",
                    "Client aging",
                    "Recipient payouts",
                    "Operating costs",
                    "Reimbursements",
                    "Equipment expenses",
                    "Financial exceptions",
                  ].map((r) => (
                    <button aria-pressed={report === r} key={r} onClick={() => setReport(r)}>
                      {r}
                    </button>
                  ))}
                </div>
                <div className="home-toolbar">
                  <small>
                    {day(start)}–{day(end)} · {report === "Cash movement" ? "payment dates" : report === "Client aging" ? `invoice issue dates · balances as of ${day(end)}` : report === "Recipient payouts" ? `earning periods · unpaid as of ${day(end)}` : "expense dates"}
                  </small>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      exportRowsAsCsv(
                        report === "Cash movement"
                          ? filteredLedger.map((r) => ({ ...r, amount: r.category === "client" ? r.amount : -r.amount }))
                          : reportRows(data),
                        "accounting-report",
                      )
                    }
                  >
                    Export report CSV
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => window.print()}>
                    Print report
                  </Button>
                </div>
                {report === "Cash movement" ? (
                  <>
                    <div className="home-toolbar">
                      <label>
                        <Search size={14} />
                        <input
                          aria-label="Search transactions"
                          placeholder="Search name or reference"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                        />
                      </label>
                      <select aria-label="Transaction category" value={category} onChange={(e) => setCategory(e.target.value)}>
                        {["all", "client", "photographer", "rep", "editor"].map((r) => (
                          <option key={r} value={r}>
                            {r === "all" ? "All categories" : r}
                          </option>
                        ))}
                      </select>
                      <small>{filteredLedger.length} transactions · scroll for all</small>
                    </div>
                    <div className="home-scroll home-register-scroll">
                      {filteredLedger.map((r) => (
                        <button className="home-list-row" key={r.id} onClick={() => detailLedger(r)}>
                          <span>
                            <b>{r.name}</b>
                            <small>
                              {day(r.date)} · {r.method} · {r.reference}
                            </small>
                          </span>
                          <b>{money(r.category === "client" ? r.amount : -r.amount)}</b>
                          <ChevronRight size={14} />
                        </button>
                      ))}
                      {!filteredLedger.length && <p className="home-empty">No matching transactions.</p>}
                    </div>
                  </>
                ) : (
                  <div className="home-scroll home-register-scroll">
                    {reportRows(data).map((r, i) => (
                      <div key={i} className="home-report-row">
                        {Object.entries(r)
                          .filter(([key]) => !["receipt_url"].includes(key))
                          .map(([key, value]) => (
                            <span key={key}>
                              <small>{key.replaceAll("_", " ")}</small>
                              <b>{String(value ?? "—")}</b>
                            </span>
                          ))}
                      </div>
                    ))}
                    {!reportRows(data).length && <p className="home-empty">No matching report records.</p>}
                  </div>
                )}
              </>
            )}
          </Suspense>
        </div>
      </div>
      <Dialog open={Boolean(detail)} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{detail?.title}</DialogTitle>
            <DialogDescription>Accounting record details</DialogDescription>
          </DialogHeader>
          {detail?.body}
        </DialogContent>
      </Dialog>
      <Dialog open={expenseForm} onOpenChange={setExpenseForm}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New expense</DialogTitle>
            <DialogDescription>Record a cost and attach its receipt. This does not record a payment.</DialogDescription>
          </DialogHeader>
          <form
            className="home-expense-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget,
                fd = new FormData(form);
              setSaving(true);
              setSaveError("");
              try {
                await createAccountingExpense({
                  description: String(fd.get("description")),
                  vendor: String(fd.get("vendor")),
                  category: String(fd.get("category")),
                  amount: String(fd.get("amount")),
                  expense_date: String(fd.get("date")),
                  receipt: (fd.get("receipt") as File)?.size ? (fd.get("receipt") as File) : null,
                });
                setExpenseForm(false);
                await query.refetch();
              } catch (err) {
                setSaveError(err instanceof Error ? err.message : "Expense could not save");
              } finally {
                setSaving(false);
              }
            }}
          >
            <label>
              Description
              <input name="description" required maxLength={500} />
            </label>
            <label>
              Vendor
              <input name="vendor" />
            </label>
            <label>
              Category
              <input name="category" defaultValue="General" />
            </label>
            <div>
              <label>
                Amount (USD)
                <input name="amount" type="number" step=".01" min=".01" required />
              </label>
              <label>
                Expense date
                <input name="date" type="date" defaultValue={end} required />
              </label>
            </div>
            <label>
              Receipt
              <input name="receipt" type="file" accept="image/*,.pdf" />
            </label>
            {saveError && <p role="alert">{saveError}</p>}
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save expense"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
