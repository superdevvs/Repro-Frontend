import React, { useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, BarChart, LineChart, DonutChart } from '@/components/charts';
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { InvoiceData } from '@/utils/invoiceUtils';
import { Eye, BarChart3, PieChart, LineChart as LineChartIcon, Search, UploadCloud, Plus, Edit } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RevenueChartsProps {
  invoices: InvoiceData[];
  timeFilter: 'day' | 'week' | 'month' | 'quarter' | 'year';
  onTimeFilterChange: (filter: 'day' | 'week' | 'month' | 'quarter' | 'year') => void;
  variant?: 'full' | 'compact';
  theme?: 'auto' | 'light' | 'dark';

}

export function RevenueCharts({
  invoices,
  timeFilter,
  onTimeFilterChange,
  variant = 'full',
  theme = 'auto',
}: RevenueChartsProps) {
  const [chartType, setChartType] = useState<'area' | 'bar' | 'line'>('area');

  // Demo monthly data generator (replace with real logic if available)
  const monthlyData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months.map((m) => {
      const revenue = Math.floor(Math.random() * 10000) + 1000;
      const expenses = Math.floor(Math.random() * revenue * 0.7);
      return { month: m, revenue, expenses, profit: revenue - expenses };
    });
  }, []); // static for the life of this component render

  // Expense breakdown data (static for demo)
  const expenseData = useMemo(() => ([
    { name: 'Equipment', value: 5400 },
    { name: 'Software', value: 3200 },
    { name: 'Marketing', value: 2100 },
    { name: 'Office', value: 1800 },
    { name: 'Travel', value: 1500 },
  ]), []);

  const totalExpenses = useMemo(() => expenseData.reduce((s, r) => s + r.value, 0), [expenseData]);

  // initial static data (moved to state so we can mutate it)
  const initialExpenses = [
    {
      id: 1,
      vendor: "Acme Supplies",
      category: "Equipment",
      sub: "Laptops",
      amount: 2100,
      date: "Nov 12, 2025",
      status: "unreviewed",
      reimb: true,
      notes: "Bought replacement charger",
      tags: ["project-alpha", "client-A"]
    },
    {
      id: 2,
      vendor: "Tech Store",
      category: "Equipment",
      sub: "Cameras",
      amount: 5400,
      date: "Nov 10, 2025",
      status: "reviewed",
      reimb: false,
      notes: "Purchased new camera body",
      tags: ["client-A"]
    },
    {
      id: 3,
      vendor: "Adobe Systems",
      category: "Software",
      sub: "Subscription",
      amount: 3200,
      date: "Nov 8, 2025",
      status: "approved",
      reimb: false,
      notes: "Monthly creative cloud subscription",
      tags: ["project-alpha"]
    },
    {
      id: 4,
      vendor: "Marketing Agency",
      category: "Marketing",
      sub: "Campaign",
      amount: 2100,
      date: "Nov 5, 2025",
      status: "reviewed",
      reimb: true,
      notes: "Social ads run",
      tags: ["agency"]
    },
    {
      id: 5,
      vendor: "Office Depot",
      category: "Office",
      sub: "Supplies",
      amount: 1800,
      date: "Nov 3, 2025",
      status: "unreviewed",
      reimb: false,
      notes: "Pens and paper",
      tags: []
    }
  ];

  // stateful expense list used across UI
  const [expensesState, setExpensesState] = useState(() => initialExpenses);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // popup & new-expense modal controls
  const [showPopup, setShowPopup] = useState(false);
  const [showNewExpenseForm, setShowNewExpenseForm] = useState(false);
  const [newExpenseForm, setNewExpenseForm] = useState({
    vendor: "",
    category: "",
    sub: "",
    amount: "",
    date: "",
    status: "unreviewed",
    reimb: false,
    notes: "",
    tags: ""
  });

  // selection states
  const [selectedExpense, setSelectedExpense] = useState<typeof initialExpenses[0] | null>(initialExpenses[0] || null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // placeholder transactions (same as before)
  const transactions = useMemo(() => ([
    { id: 1, vendor: "Acme Supplies", desc: "Equipment • Laptops", amount: 2100, date: "Nov 12, 2025", status: "unreviewed", badge: "Reimbursable" },
    { id: 2, vendor: "Tech Store", desc: "Equipment • Cameras", amount: 5400, date: "Nov 10, 2025", status: "reviewed", badge: "" },
    { id: 3, vendor: "Ads Partner", desc: "Marketing • Campaign", amount: 2100, date: "Nov 08, 2025", status: "reviewed", badge: "" },
    { id: 4, vendor: "OfficeMart", desc: "Office • Supplies", amount: 1800, date: "Nov 03, 2025", status: "unreviewed", badge: "" },
  ]), []);

  // file & csv refs
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const csvInputRef = useRef<HTMLInputElement | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // toggle select helper
  const toggleSelect = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // Derived: filtered list based on search/status/category
  const filteredExpenses = useMemo(() => {
    const q = search.trim().toLowerCase();
    return expensesState.filter((e) => {
      if (statusFilter !== "all" && e.status !== statusFilter) return false;
      if (categoryFilter !== "all" && e.category.toLowerCase() !== categoryFilter.toLowerCase()) return false;
      if (!q) return true;
      if (String(e.vendor).toLowerCase().includes(q)) return true;
      if (String(e.category).toLowerCase().includes(q)) return true;
      if (String(e.sub).toLowerCase().includes(q)) return true;
      if (String(e.notes || "").toLowerCase().includes(q)) return true;
      if (Array.isArray(e.tags) && e.tags.join(" ").toLowerCase().includes(q)) return true;
      return false;
    });
  }, [expensesState, search, statusFilter, categoryFilter]);

  // upload: chooses file input
  const handleUploadClick = () => fileInputRef.current?.click();

  const handleFileChange = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const files = ev.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    const reader = new FileReader();
    reader.onload = () => {
      const imgData = reader.result;
      // Demo: create a new expense representing uploaded receipt
      const created = {
        id: Date.now(),
        vendor: "Uploaded Receipt",
        category: "Uploaded",
        sub: file.name,
        amount: 0,
        date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        status: "unreviewed",
        reimb: false,
        notes: `Uploaded: ${file.name}`,
        tags: [],
        _uploadedPreview: imgData
      } as any;
      setExpensesState(prev => [created, ...prev]);
      setSelectedExpense(created);
      // reset file input so same file can be re-uploaded later
      ev.currentTarget.value = "";
    };
    if (file.type.startsWith("image/")) reader.readAsDataURL(file);
    else reader.readAsText(file);
  };

  // CSV import basic handler
  const handleImportClick = () => csvInputRef.current?.click();

  const handleCsvChange = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const f = ev.target.files?.[0];
    setImportError(null);
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      try {
        const newItems = parseSimpleCsv(text);
        setExpensesState(prev => [...newItems, ...prev]);
      } catch (err: any) {
        setImportError(err?.message || "Failed to parse CSV");
      }
    };
    reader.readAsText(f);
    ev.currentTarget.value = "";
  };

  function parseSimpleCsv(text: string) {
    // Expected header: vendor,category,sub,amount,date,status,reimb,notes,tags
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) throw new Error("CSV empty");
    const header = lines[0].split(",").map(h => h.trim().toLowerCase());
    if (!header.includes("vendor") || !header.includes("amount")) {
      throw new Error("CSV must include 'vendor' and 'amount' columns");
    }
    const rows = lines.slice(1);
    const parsed = rows.map((r, idx) => {
      const cols = r.split(",").map(c => c.trim());
      const obj: any = {};
      header.forEach((h, i) => { obj[h] = cols[i] ?? ""; });
      return {
        id: Date.now() + idx,
        vendor: obj.vendor || "Imported",
        category: obj.category || "Misc",
        sub: obj.sub || "",
        amount: Number(obj.amount) || 0,
        date: obj.date || new Date().toLocaleDateString(),
        status: (obj.status || "unreviewed").toLowerCase(),
        reimb: String(obj.reimb).toLowerCase() === "true",
        notes: obj.notes || "",
        tags: obj.tags ? String(obj.tags).split("|").map((t: string) => t.trim()).filter(Boolean) : []
      };
    });
    return parsed;
  }

  // New Expense form
  const openNewExpense = () => {
    setNewExpenseForm({
      vendor: "",
      category: "",
      sub: "",
      amount: "",
      date: new Date().toLocaleDateString(),
      status: "unreviewed",
      reimb: false,
      notes: "",
      tags: ""
    });
    setShowNewExpenseForm(true);
  };

  const saveNewExpense = () => {
    const e = {
      id: Date.now(),
      vendor: newExpenseForm.vendor || "Untitled",
      category: newExpenseForm.category || "Misc",
      sub: newExpenseForm.sub || "",
      amount: Number(newExpenseForm.amount) || 0,
      date: newExpenseForm.date || new Date().toLocaleDateString(),
      status: newExpenseForm.status,
      reimb: !!newExpenseForm.reimb,
      notes: newExpenseForm.notes,
      tags: newExpenseForm.tags ? newExpenseForm.tags.split(",").map(t => t.trim()).filter(Boolean) : []
    } as any;
    setExpensesState(prev => [e, ...prev]);
    setSelectedExpense(e);
    setShowNewExpenseForm(false);
  };

  return (
    <div className="space-y-6">
      {/* Revenue overview */}
      <Card className="overflow-hidden border">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-base font-medium text-foreground flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Revenue Overview
              </CardTitle>
              <CardDescription className="text-slate-600 dark:text-slate-400">Financial performance metrics</CardDescription>
            </div>

            <div className="flex flex-wrap gap-3 items-center">
              <ToggleGroup type="single" value={chartType} onValueChange={(value) => value && setChartType(value as any)}>
                <ToggleGroupItem value="area" aria-label="Area Chart"><LineChartIcon className="h-3.5 w-3.5" /></ToggleGroupItem>
                <ToggleGroupItem value="bar" aria-label="Bar Chart"><BarChart3 className="h-3.5 w-3.5" /></ToggleGroupItem>
                <ToggleGroupItem value="line" aria-label="Line Chart"><LineChartIcon className="h-3.5 w-3.5" /></ToggleGroupItem>
              </ToggleGroup>

              <ToggleGroup type="single" value={timeFilter} onValueChange={(value) => value && onTimeFilterChange(value as any)}>
                <ToggleGroupItem value="day" className="text-xs h-8">Day</ToggleGroupItem>
                <ToggleGroupItem value="week" className="text-xs h-8">Week</ToggleGroupItem>
                <ToggleGroupItem value="month" className="text-xs h-8">Month</ToggleGroupItem>
                <ToggleGroupItem value="quarter" className="text-xs h-8">Quarter</ToggleGroupItem>
                <ToggleGroupItem value="year" className="text-xs h-8">Year</ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-3 pb-6">
          <div className="h-[300px] min-h-[300px]">
            {chartType === 'area' && (
              <AreaChart
                data={monthlyData}
                index="month"
                categories={["revenue", "expenses", "profit"]}
                colors={["#3b82f6", "#ef4444", "#22c55e"]}
                valueFormatter={(value) => `$${value.toLocaleString()}`}
              />
            )}

            {chartType === 'bar' && (
              <BarChart
                data={monthlyData}
                index="month"
                categories={["revenue", "expenses", "profit"]}
                colors={["#3b82f6", "#ef4444", "#22c55e"]}
                valueFormatter={(value) => `$${value.toLocaleString()}`}
                stack={false}
              />
            )}

            {chartType === 'line' && (
              <LineChart
                data={monthlyData}
                index="month"
                categories={["revenue", "expenses", "profit"]}
                colors={["#3b82f6", "#ef4444", "#22c55e"]}
                valueFormatter={(value) => `$${value.toLocaleString()}`}
                connectNulls
                curveType="natural"
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Expense Center — shown only in full variant */}
      {variant === 'full' && (
        <div className="space-y-4">
          <Card className="overflow-hidden border bg-transparent">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <PieChart className="h-5 w-5 text-primary" />
                  <div>
                    <CardTitle className="text-base font-medium text-foreground">Expense Center</CardTitle>
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-2 pb-4">
              <div className="flex flex-col lg:flex-row gap-6">
                {/* Left: Donut + legend */}
                <div className="w-full lg:w-1/2">
                  <div className="flex flex-col items-center lg:items-start gap-6">
                    <div className="w-56 h-56 mx-auto flex items-center justify-center">
                      <DonutChart
                        data={expenseData}
                        category="value"
                        index="name"
                        valueFormatter={(v) => `$${v.toLocaleString()}`}
                        className="h-full w-full"
                        colors={["#8884d8", "#82ca9d", "#ffc658", "#ff8042", "#0088fe"]}
                      />
                    </div>

                    <div className="w-full flex items-center justify-between px-2">
                      <div>
                        <p className="text-sm text-slate-600 dark:text-slate-400">Total this month</p>
                        <p className="text-2xl sm:text-3xl font-bold text-black dark:text-white">
                          ${totalExpenses.toLocaleString()}
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-slate-600 dark:text-slate-400">Receipts</span>
                          <span className="text-lg font-medium text-black dark:text-white">{expensesState.length}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-sm text-slate-600 dark:text-slate-400">Unreviewed</span>
                          <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-red-600 text-white text-xs font-semibold">
                            {expensesState.filter(e => e.status === "unreviewed").length}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: totals, counters, transactions list */}
                <div className="w-full lg:w-1/2 flex flex-col gap-4">
                  <div className="rounded-lg border border-border/60 dark:border-slate-700/40 p-0 overflow-hidden">
                    <div className="max-h-64 overflow-y-auto pr-3">
                      {transactions.map(tx => (
                        <div key={tx.id} className="flex items-start gap-3 p-4 border-b last:border-b-0 bg-transparent">
                          <div className="flex-shrink-0">
                            <div className="h-9 w-9 rounded-md bg-primary/10 text-primary flex items-center justify-center text-sm font-medium">
                              ${String(Math.round(tx.amount / 1000))}k
                            </div>
                          </div>

                          <div className="flex-1">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="font-medium text-sm text-black dark:text-white">{tx.vendor}</p>
                                <p className="text-xs text-slate-600 dark:text-slate-400">{tx.desc}</p>
                              </div>

                              <div className="text-right">
                                <p className="font-semibold text-sm text-black dark:text-white">${tx.amount.toLocaleString()}</p>
                                <p className="text-xs text-slate-600 dark:text-slate-400">{tx.date}</p>
                              </div>
                            </div>

                            <div className="mt-2 flex items-center gap-2">
                              <span className={cn(
                                "text-xs font-medium px-2 py-0.5 rounded-full",
                                tx.status === "unreviewed" ? "bg-amber-800/70 text-amber-100" : "bg-sky-700/30 text-sky-200"
                              )}>
                                {tx.status}
                              </span>

                              {tx.badge && (
                                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-white/10 text-white">{tx.badge}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-2 flex gap-3">
                    <button
                      onClick={() => setShowPopup(true)}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-md border border-border/60 dark:border-slate-700/40 px-4 py-2 bg-transparent text-sm font-medium hover:bg-white/5 transition"
                    >
                      <Eye className="w-4 h-4 opacity-80" />
                      View All
                    </button>

                    <button
                      onClick={openNewExpense}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-md bg-primary text-white px-4 py-2 text-sm font-semibold hover:brightness-105 transition"
                    >
                      + New Expense
                    </button>
                  </div>
                </div>
              </div>

              {/* POPUP */}
              {showPopup && (
                <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xl flex items-center justify-center p-4">
                  <div className="bg-[#0d1626] w-full max-w-6xl rounded-2xl border border-white/10 shadow-2xl animate-popup relative overflow-visible">
                    {/* Close */}
                    <button
                      onClick={() => setShowPopup(false)}
                      className="absolute top-4 right-4 z-[10000] text-white/70 hover:text-white transition text-xl"
                      aria-label="Close"
                    >
                      ✕
                    </button>

                    {/* TOP BAR */}
                    <div className="flex flex-col gap-2 px-6 py-4 border-b border-white/10">
                      <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                          Expense Center
                        </h2>
                        {/* <div className="flex items-center gap-2">
                          <button className="text-white/60 hover:text-white p-2 rounded-md">
                            <svg className="w-5 h-5" stroke="currentColor" fill="none" viewBox="0 0 24 24">
                              <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
                            </svg>
                          </button>
                        </div> */}
                      </div>

                      {/* FILTER ROW (improved) */}
                      <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between overflow-visible">
                        <div className="flex gap-3 w-full md:w-auto items-center">
                          <div className="relative flex items-center bg-white/6 rounded-md px-3 py-2 w-full md:w-96">
                            <Search className="w-4 h-4 text-white/70 mr-2" />
                            <input
                              className="bg-transparent outline-none text-sm text-white placeholder:text-white/60 w-full"
                              placeholder="Search expenses (vendor, category, tag...)"
                              value={search}
                              onChange={(e) => setSearch(e.target.value)}
                              aria-label="Search expenses"
                            />
                            {search && (
                              <button
                                className="ml-2 text-white/50 hover:text-white p-1"
                                onClick={() => setSearch("")}
                                aria-label="Clear search"
                                title="Clear"
                              >
                                ✕
                              </button>
                            )}
                          </div>

                          {/* STATUS SELECT */}
                          <div className="relative z-50">
                            <select
                              value={statusFilter}
                              onChange={(e) => setStatusFilter(e.target.value)}
                              aria-label="Filter by status"
                              className={cn(
                                "appearance-none text-sm px-4 py-2 rounded-md outline-none min-w-[150px] pr-8 transition",

                                // light-mode
                                "bg-gray-100 text-gray-900 placeholder-gray-500",

                                // dark mode
                                "dark:bg-[#121b2c] dark:text-white dark:placeholder-white/40",

                                // border
                                "border border-gray-300 dark:border-white/10",

                                // force internal listbox color for some browsers
                                "[&>option]:bg-[#121b2c] [&>option]:text-white"
                              )}
                            >
                              <option value="all">All Status</option>
                              <option value="unreviewed">Unreviewed</option>
                              <option value="reviewed">Reviewed</option>
                              <option value="approved">Approved</option>
                            </select>

                            <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 dark:text-white/70">
                              ▾
                            </div>
                          </div>



                          {/* CATEGORY SELECT */}
                          <div className="relative z-50">
                            <select
                              value={categoryFilter}
                              onChange={(e) => setCategoryFilter(e.target.value)}
                              className={cn(
                                "appearance-none text-sm px-4 py-2 rounded-md outline-none min-w-[160px] pr-8 transition",

                                // light
                                "bg-gray-100 text-gray-900 border border-gray-300",

                                // dark
                                "dark:bg-[#121b2c] dark:text-white dark:border-white/10",

                                // force internal options theming (Chromium/Firefox only)
                                "[&>option]:bg-[#121b2c] [&>option]:text-white dark:[&>option]:bg-[#121b2c]"
                              )}
                              aria-label="Filter by category"
                            >
                              <option value="all">All Categories</option>
                              {[...new Set(expensesState.map(e => e.category))].map(cat => (
                                <option key={cat} value={cat.toLowerCase()}>{cat}</option>
                              ))}
                            </select>

                            <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 dark:text-white/70">
                              ▾
                            </div>
                          </div>

                        </div>

                        <div className="flex gap-2 items-center">
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*,.pdf"
                            className="hidden"
                            onChange={handleFileChange}
                          />
                          <input
                            ref={csvInputRef}
                            type="file"
                            accept=".csv,text/csv"
                            className="hidden"
                            onChange={handleCsvChange}
                          />

                          <button
                            onClick={handleUploadClick}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-white/10 bg-transparent text-white text-sm hover:bg-white/5 transition"
                            title="Upload receipt/image"
                          >
                            <UploadCloud className="w-4 h-4" /> Upload
                          </button>

                          <button
                            onClick={handleImportClick}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-white/10 bg-transparent text-white text-sm hover:bg-white/5 transition"
                            title="Import CSV"
                          >
                            Import
                          </button>

                          <button
                            onClick={openNewExpense}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-[#0b74ff] text-white text-sm font-semibold hover:brightness-105 transition"
                          >
                            <Plus className="w-4 h-4" /> New Expense
                          </button>
                        </div>
                      </div>

                      {importError && <p className="text-red-400 text-sm mt-2">{importError}</p>}
                    </div>

                    {/* BODY GRID */}
                    <div className="grid grid-cols-1 md:grid-cols-3 h-[75vh]">
                      {/* LEFT – LIST */}
                      <div className="border-r border-white/10 overflow-y-auto p-6">
                        <div className="flex items-center justify-between mb-4">
                          <p className="text-gray-400 text-sm">Expenses ({expensesState.length})</p>
                          <input
                            type="checkbox"
                            checked={selectedIds.length === expensesState.length && expensesState.length > 0}
                            onChange={() => {
                              if (selectedIds.length === expensesState.length) setSelectedIds([]);
                              else setSelectedIds(expensesState.map(e => e.id));
                            }}
                            className="accent-primary"
                            aria-label="Select all expenses"
                          />
                        </div>

                        {filteredExpenses.map(exp => (
                          <div
                            key={exp.id}
                            onClick={() => setSelectedExpense(exp)}
                            className={cn(
                              "rounded-xl border border-white/10 p-4 mb-4 cursor-pointer transition",
                              selectedExpense?.id === exp.id ? "bg-white/6" : "bg-transparent hover:bg-white/5"
                            )}
                          >
                            <div className="flex items-start gap-3">
                              <input
                                type="checkbox"
                                checked={selectedIds.includes(exp.id)}
                                onChange={(e) => { e.stopPropagation(); toggleSelect(exp.id); }}
                                className="mt-1 accent-primary"
                                aria-label={`Select expense ${exp.vendor}`}
                              />

                              <img src="/receipt.png" alt="receipt" className="h-10 w-10 rounded-md object-cover opacity-80" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="text-white font-medium truncate">{exp.vendor}</p>
                                    <p className="text-xs text-gray-400 truncate">{exp.category} • {exp.sub}</p>
                                  </div>

                                  <div className="text-right flex-shrink-0 ml-3">
                                    <p className="text-white font-semibold">${exp.amount.toLocaleString()}</p>
                                    <p className="text-xs text-gray-400">{exp.date}</p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 mt-3">
                                  <span className={`px-2 py-1 text-xs rounded-full ${exp.status === "unreviewed" ? "bg-amber-700/40 text-amber-200" :
                                    exp.status === "approved" ? "bg-green-700/40 text-green-200" :
                                      "bg-sky-700/40 text-sky-200"
                                    }`}>
                                    {exp.status}
                                  </span>

                                  {exp.reimb && (
                                    <span className="px-2 py-1 text-xs rounded-full bg-white/10 text-white">
                                      Reimbursable
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}

                        {filteredExpenses.length === 0 && <p className="text-gray-500 text-sm">No expenses found.</p>}
                      </div>

                      {/* RIGHT – DETAILS */}
                      <div className="md:col-span-2 p-8 overflow-y-auto">
                        <div className="flex items-start justify-between">
                          {selectedExpense ? (
                            <div>
                              <h2 className="text-xl font-semibold text-white">{selectedExpense.vendor}</h2>
                              <p className="text-gray-400 text-sm">{selectedExpense.date}</p>
                            </div>
                          ) : (
                            <p className="text-gray-400">Select an expense to view details.</p>
                          )}

                          {/* Edit icon */}
                          <button
                            onClick={() => alert('Edit action (hook up your edit modal)')}
                            className="text-white/60 hover:text-white p-2 rounded-md"
                            title="Edit expense"
                          >
                            <Edit className="w-5 h-5" />
                          </button>
                        </div>

                        {selectedExpense ? (
                          <>
                            <h3 className="text-white font-medium mt-6 mb-2">Receipt</h3>
                            <div className="bg-white/5 rounded-lg border border-white/10 p-3 flex items-center gap-3">
                              {selectedExpense._uploadedPreview ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={String(selectedExpense._uploadedPreview)} alt="uploaded" className="h-12 w-12 object-cover rounded-md opacity-80" />
                              ) : (
                                <img src="/receipt.png" className="h-12 w-12 object-cover rounded-md opacity-80" />
                              )}
                              <span className="text-sm text-gray-300">Receipt</span>
                            </div>

                            <div className="grid grid-cols-2 gap-8 mt-6">
                              <div>
                                <h3 className="text-white font-medium mb-1">Amount</h3>
                                <p className="text-3xl font-bold text-white">${selectedExpense.amount.toLocaleString()}</p>
                              </div>
                              <div>
                                <h3 className="text-white font-medium mb-1">Category</h3>
                                <p className="text-gray-200">{selectedExpense.category}</p>
                                <p className="text-gray-400 text-sm">{selectedExpense.sub}</p>
                              </div>
                            </div>

                            <h3 className="text-white font-medium mt-6 mb-1">Notes</h3>
                            <p className="text-gray-300 text-sm bg-white/5 p-3 rounded-xl border border-white/10">
                              {selectedExpense.notes}
                            </p>

                            <h3 className="text-white font-medium mt-6 mb-2">Tags</h3>
                            <div className="flex gap-2">
                              {selectedExpense.tags && selectedExpense.tags.length > 0 ? selectedExpense.tags.map((tag: string) => (
                                <span key={tag} className="px-3 py-1 text-xs rounded-full bg-white/10 text-white">
                                  {tag}
                                </span>
                              )) : <span className="text-gray-400 text-sm">No tags</span>}
                            </div>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Small New Expense Modal (triggered by New Expense) */}
          {showNewExpenseForm && (
            <div className="fixed inset-0 z-[10000] bg-black/50 flex items-center justify-center p-4">
              <div className="bg-[#0d1626] w-full max-w-xl rounded-xl p-6 border border-white/10">
                <h3 className="text-lg font-semibold text-white mb-4">New Expense</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input className="p-2 rounded bg-white/5 text-white text-sm" placeholder="Vendor" value={newExpenseForm.vendor} onChange={(e) => setNewExpenseForm(s => ({ ...s, vendor: e.target.value }))} />
                  <input className="p-2 rounded bg-white/5 text-white text-sm" placeholder="Category" value={newExpenseForm.category} onChange={(e) => setNewExpenseForm(s => ({ ...s, category: e.target.value }))} />
                  <input className="p-2 rounded bg-white/5 text-white text-sm" placeholder="Sub" value={newExpenseForm.sub} onChange={(e) => setNewExpenseForm(s => ({ ...s, sub: e.target.value }))} />
                  <input className="p-2 rounded bg-white/5 text-white text-sm" placeholder="Amount" value={newExpenseForm.amount} onChange={(e) => setNewExpenseForm(s => ({ ...s, amount: e.target.value }))} />
                  <input className="p-2 rounded bg-white/5 text-white text-sm" placeholder="Date" value={newExpenseForm.date} onChange={(e) => setNewExpenseForm(s => ({ ...s, date: e.target.value }))} />
                  <select className="p-2 rounded bg-white/5 text-white text-sm" value={newExpenseForm.status} onChange={(e) => setNewExpenseForm(s => ({ ...s, status: e.target.value }))}>
                    <option value="unreviewed">Unreviewed</option>
                    <option value="reviewed">Reviewed</option>
                    <option value="approved">Approved</option>
                  </select>
                  <textarea className="p-2 rounded bg-white/5 text-white text-sm md:col-span-2" placeholder="Notes" value={newExpenseForm.notes} onChange={(e) => setNewExpenseForm(s => ({ ...s, notes: e.target.value }))} />
                  <input className="p-2 rounded bg-white/5 text-white text-sm md:col-span-2" placeholder="Tags (comma separated)" value={newExpenseForm.tags} onChange={(e) => setNewExpenseForm(s => ({ ...s, tags: e.target.value }))} />
                </div>

                <div className="mt-4 flex justify-end gap-2">
                  <button className="px-3 py-2 bg-transparent border border-white/10 rounded text-white" onClick={() => setShowNewExpenseForm(false)}>Cancel</button>
                  <button className="px-3 py-2 bg-[#0b74ff] rounded text-white font-semibold" onClick={saveNewExpense}>Save</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
