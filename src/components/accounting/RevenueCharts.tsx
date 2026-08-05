import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AreaChart, BarChart, LineChart, DonutChart } from '@/components/charts';
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Eye, BarChart3, PieChart, LineChart as LineChartIcon, Search, UploadCloud, Plus, Edit, Receipt, Trash2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { openAccountingExpenseReceipt } from '@/services/accountingExpenseService';
import type { RevenueChartsProps } from './revenueChartsTypes';
import { useRevenueChartsController } from './useRevenueChartsController';

export function RevenueCharts({
  invoices,
  timeFilter,
  onTimeFilterChange,
  variant = 'full',
  role = '',
}: RevenueChartsProps) {
  const {
    isSuperAdmin,
    chartType,
    setChartType,
    timeFilterLabel,
    backendExpenses,
    expensesState,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    categoryFilter,
    setCategoryFilter,
    showPopup,
    setShowPopup,
    showNewExpenseForm,
    setShowNewExpenseForm,
    newExpenseForm,
    setNewExpenseForm,
    selectedExpense,
    setSelectedExpense,
    selectedIds,
    setSelectedIds,
    previewImage,
    setPreviewImage,
    ocrProcessing,
    ocrProgress,
    showEditExpenseForm,
    setShowEditExpenseForm,
    editExpenseForm,
    setEditExpenseForm,
    expenseData,
    totalExpenses,
    hasExpenses,
    monthlyData,
    transactions,
    fileInputRef,
    csvInputRef,
    importError,
    toggleSelect,
    filteredExpenses,
    handleUploadClick,
    handleFileChange,
    handleImportClick,
    handleCsvChange,
    openNewExpense,
    saveNewExpense,
    deleteExpense,
    deleteSelectedExpenses,
    openEditExpense,
    saveEditedExpense,
    formatExpenseDate,
  } = useRevenueChartsController({ invoices, timeFilter, role });

  return (
    <>
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
      {/* Revenue overview */}
      <Card className="overflow-hidden border mb-3">
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
              <ToggleGroup
                type="single"
                value={chartType}
                onValueChange={(value) => {
                  if (value === 'area' || value === 'bar' || value === 'line') setChartType(value);
                }}
              >
                <ToggleGroupItem value="area" aria-label="Area Chart"><LineChartIcon className="h-3.5 w-3.5" /></ToggleGroupItem>
                <ToggleGroupItem value="bar" aria-label="Bar Chart"><BarChart3 className="h-3.5 w-3.5" /></ToggleGroupItem>
                <ToggleGroupItem value="line" aria-label="Line Chart"><LineChartIcon className="h-3.5 w-3.5" /></ToggleGroupItem>
              </ToggleGroup>

              <ToggleGroup
                type="single"
                value={timeFilter}
                onValueChange={(value) => {
                  if (value === 'day' || value === 'week' || value === 'month' || value === 'quarter' || value === 'year') {
                    onTimeFilterChange(value);
                  }
                }}
              >
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
          <Card className="flex min-h-[28rem] flex-col overflow-hidden border bg-transparent lg:min-h-[max(28rem,calc(100vh-38rem))]">
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

            <CardContent className="flex flex-1 flex-col pt-2 pb-4 min-h-0">
              {!hasExpenses ? (
                <div className="flex flex-1 rounded-xl border border-dashed border-border/60 dark:border-white/10 bg-card/50 p-6 text-sm text-slate-500 dark:text-slate-400">
                  <div className="flex min-h-full flex-1 flex-col items-center justify-center gap-4 text-center">
                    <p>No expenses recorded for {timeFilterLabel.toLowerCase()}. Upload a receipt or add a new expense to get started.</p>
                    <div className="flex flex-wrap gap-3">
                      <Button variant="outline" onClick={handleUploadClick}>
                        Upload receipt
                      </Button>
                      <Button onClick={openNewExpense}>New Expense</Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-1 flex-col lg:flex-row gap-6 min-h-0">
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
                          <p className="text-sm text-slate-600 dark:text-slate-400">Total ({timeFilterLabel})</p>
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
                  <div className="w-full lg:w-1/2 flex min-h-0 flex-col gap-4">
                    <div className="min-h-0 flex-1 rounded-lg border border-border/60 dark:border-slate-700/40 p-0 overflow-hidden">
                      <div className="h-full overflow-y-auto">
                        {transactions.map(tx => (
                          <div
                            key={tx.id}
                            className="flex items-start gap-3 p-4 border-b last:border-b-0 bg-transparent cursor-pointer hover:bg-muted/50 transition"
                            onClick={() => {
                              const found = expensesState.find(e => e.id === tx.id);
                              if (found) {
                                setSelectedExpense(found);
                                setShowPopup(true);
                              }
                            }}
                          >
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

                              {!isSuperAdmin && (
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
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Bottom action buttons */}
                    <div className="mt-auto pt-4 flex gap-3">
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
              )}
            </CardContent>
          </Card>
        </div>
      )}
      {showPopup && (
        <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-6xl rounded-2xl border border-border shadow-2xl animate-popup relative overflow-visible">
            {/* Close */}
            <button
              onClick={() => setShowPopup(false)}
              className="absolute top-4 right-4 z-[10000] text-muted-foreground hover:text-foreground transition text-xl"
              aria-label="Close"
            >
              ✕
            </button>

            {/* TOP BAR */}
            <div className="flex flex-col gap-2 px-6 py-4 border-b border-border">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  Expense Center
                </h2>
              </div>

              {/* FILTER ROW (improved) */}
              <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between overflow-visible">
                <div className="flex gap-3 w-full md:w-auto items-center">
                  <div className="relative flex items-center bg-muted rounded-md px-3 py-2 w-full md:w-96">
                    <Search className="w-4 h-4 text-muted-foreground mr-2" />
                    <input
                      className="bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground w-full"
                      placeholder="Search expenses (vendor, category, tag...)"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      aria-label="Search expenses"
                    />
                    {search && (
                      <button
                        className="ml-2 text-muted-foreground hover:text-foreground p-1"
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
                  <button
                    onClick={handleUploadClick}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-transparent text-foreground text-sm hover:bg-muted transition"
                    title="Upload receipt/image"
                  >
                    <UploadCloud className="w-4 h-4" /> Upload
                  </button>

                  <button
                    onClick={handleImportClick}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-transparent text-foreground text-sm hover:bg-muted transition"
                    title="Import CSV"
                  >
                    Import
                  </button>

                  <button
                    onClick={openNewExpense}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:brightness-105 transition"
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
              <div className="border-r border-border overflow-y-auto p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <p className="text-muted-foreground text-sm">Expenses ({expensesState.length})</p>
                    {selectedIds.length > 0 && (
                      <button
                        onClick={deleteSelectedExpenses}
                        className="text-xs text-red-500 hover:text-red-400 flex items-center gap-1"
                        title="Delete selected"
                      >
                        <Trash2 className="w-3 h-3" /> Delete ({selectedIds.length})
                      </button>
                    )}
                  </div>
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
                      "rounded-xl border border-border p-4 mb-4 cursor-pointer transition",
                      selectedExpense?.id === exp.id ? "bg-muted" : "bg-transparent hover:bg-muted/50"
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

                      <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center">
                        <Receipt className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-foreground font-medium truncate">{exp.vendor}</p>
                            <p className="text-xs text-muted-foreground truncate">{exp.category} • {exp.sub}</p>
                          </div>

                          <div className="text-right flex-shrink-0 ml-3">
                            <p className="text-foreground font-semibold">${exp.amount.toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">{formatExpenseDate(exp.date)}</p>
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
                            <span className="px-2 py-1 text-xs rounded-full bg-muted text-foreground">
                              Reimbursable
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {filteredExpenses.length === 0 && (
                  <p className="text-muted-foreground text-sm">No expenses found.</p>
                )}
              </div>

              {/* RIGHT – DETAILS */}
              <div className="md:col-span-2 p-8 overflow-y-auto">
                <div className="flex items-start justify-between">
                  {selectedExpense ? (
                    <div>
                      <h2 className="text-xl font-semibold text-foreground">{selectedExpense.vendor}</h2>
                      <p className="text-muted-foreground text-sm">{formatExpenseDate(selectedExpense.date)}</p>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">Select an expense to view details.</p>
                  )}

                  {/* Action icons */}
                  {selectedExpense && !selectedExpense.invoiceId && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditExpense(selectedExpense)}
                        className="text-muted-foreground hover:text-foreground p-2 rounded-md"
                        title="Edit expense"
                      >
                        <Edit className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => deleteExpense(selectedExpense.id)}
                        className="text-muted-foreground hover:text-red-500 p-2 rounded-md"
                        title="Delete expense"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                </div>

                {selectedExpense ? (
                  <>
                    <h3 className="text-foreground font-medium mt-6 mb-2">Receipt</h3>
                    <div 
                      className={cn(
                        "bg-muted rounded-lg border border-border p-3 flex items-center gap-3",
                        (selectedExpense._uploadedPreview || selectedExpense.receiptUrl) && "cursor-pointer hover:bg-muted/80 transition"
                      )}
                      onClick={async () => {
                        if (selectedExpense._uploadedPreview) {
                          setPreviewImage(String(selectedExpense._uploadedPreview));
                          return;
                        }
                        if (selectedExpense.receiptUrl) {
                          const source = backendExpenses.find((expense) => String(expense.id) === selectedExpense.id);
                          if (source) await openAccountingExpenseReceipt(source);
                        }
                      }}
                    >
                      {selectedExpense._uploadedPreview ? (
                        <img src={String(selectedExpense._uploadedPreview)} alt="uploaded" className="h-12 w-12 object-cover rounded-md" />
                      ) : (
                        <div className="h-12 w-12 rounded-md bg-primary/10 flex items-center justify-center">
                          <Receipt className="h-6 w-6 text-primary" />
                        </div>
                      )}
                      <div className="flex flex-col">
                        <span className="text-sm text-foreground font-medium">Receipt</span>
                        {(selectedExpense._uploadedPreview || selectedExpense.receiptUrl) && (
                          <span className="text-xs text-muted-foreground">Click to preview</span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-8 mt-6">
                      <div>
                        <h3 className="text-foreground font-medium mb-1">Amount</h3>
                        <p className="text-3xl font-bold text-foreground">${selectedExpense.amount.toLocaleString()}</p>
                      </div>
                      <div>
                        <h3 className="text-foreground font-medium mb-1">Category</h3>
                        <p className="text-foreground">{selectedExpense.category}</p>
                        <p className="text-muted-foreground text-sm">{selectedExpense.sub}</p>
                      </div>
                    </div>

                    <h3 className="text-foreground font-medium mt-6 mb-1">Notes</h3>
                    <p className="text-muted-foreground text-sm bg-muted p-3 rounded-xl border border-border">
                      {selectedExpense.notes}
                    </p>

                    <h3 className="text-foreground font-medium mt-6 mb-2">Tags</h3>
                    <div className="flex gap-2">
                      {selectedExpense.tags && selectedExpense.tags.length > 0 ? selectedExpense.tags.map((tag: string) => (
                        <span key={tag} className="px-3 py-1 text-xs rounded-full bg-muted text-foreground">
                          {tag}
                        </span>
                      )) : <span className="text-muted-foreground text-sm">No tags</span>}
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Small New Expense Modal (triggered by New Expense) */}
      {showNewExpenseForm && (
        <div className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl rounded-2xl border border-border bg-card text-foreground shadow-2xl">
            <div className="px-6 py-5 border-b border-border">
              <h3 className="text-lg font-semibold">New Expense</h3>
              <p className="text-sm text-muted-foreground">Log an expense for accounting and reimbursement.</p>
            </div>

            <div className="p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Vendor</Label>
                  <Input
                    placeholder="Acme Supplies"
                    value={newExpenseForm.vendor}
                    onChange={(e) => setNewExpenseForm(s => ({ ...s, vendor: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Input
                    placeholder="Equipment"
                    value={newExpenseForm.category}
                    onChange={(e) => setNewExpenseForm(s => ({ ...s, category: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Sub-category</Label>
                  <Input
                    placeholder="Lenses"
                    value={newExpenseForm.sub}
                    onChange={(e) => setNewExpenseForm(s => ({ ...s, sub: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Amount</Label>
                  <Input
                    placeholder="0.00"
                    inputMode="decimal"
                    value={newExpenseForm.amount}
                    onChange={(e) => setNewExpenseForm(s => ({ ...s, amount: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={newExpenseForm.date}
                    onChange={(e) => setNewExpenseForm(s => ({ ...s, date: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <select
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                    value={newExpenseForm.status}
                    onChange={(e) => setNewExpenseForm(s => ({ ...s, status: e.target.value }))}
                  >
                    <option value="unreviewed">Unreviewed</option>
                    <option value="reviewed">Reviewed</option>
                    <option value="approved">Approved</option>
                  </select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Notes</Label>
                  <Textarea
                    className="min-h-[96px]"
                    placeholder="Add any context or vendor details"
                    value={newExpenseForm.notes}
                    onChange={(e) => setNewExpenseForm(s => ({ ...s, notes: e.target.value }))}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Tags</Label>
                  <Input
                    placeholder="property, client, reimbursement"
                    value={newExpenseForm.tags}
                    onChange={(e) => setNewExpenseForm(s => ({ ...s, tags: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowNewExpenseForm(false)}>
                Cancel
              </Button>
              <Button onClick={saveNewExpense}>Save</Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Expense Modal */}
      {showEditExpenseForm && (
        <div className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl rounded-2xl border border-border bg-card text-foreground shadow-2xl">
            <div className="px-6 py-5 border-b border-border">
              <h3 className="text-lg font-semibold">Edit Expense</h3>
              <p className="text-sm text-muted-foreground">Update expense details.</p>
            </div>

            <div className="p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Vendor</Label>
                  <Input
                    placeholder="Acme Supplies"
                    value={editExpenseForm.vendor}
                    onChange={(e) => setEditExpenseForm(s => ({ ...s, vendor: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Input
                    placeholder="Equipment"
                    value={editExpenseForm.category}
                    onChange={(e) => setEditExpenseForm(s => ({ ...s, category: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Subcategory</Label>
                  <Input
                    placeholder="Camera gear"
                    value={editExpenseForm.sub}
                    onChange={(e) => setEditExpenseForm(s => ({ ...s, sub: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Amount</Label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={editExpenseForm.amount}
                    onChange={(e) => setEditExpenseForm(s => ({ ...s, amount: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={editExpenseForm.date}
                    onChange={(e) => setEditExpenseForm(s => ({ ...s, date: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <select
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                    value={editExpenseForm.status}
                    onChange={(e) => setEditExpenseForm(s => ({ ...s, status: e.target.value }))}
                  >
                    <option value="unreviewed">Unreviewed</option>
                    <option value="reviewed">Reviewed</option>
                    <option value="approved">Approved</option>
                  </select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Notes</Label>
                  <Textarea
                    className="min-h-[96px]"
                    placeholder="Add any context or vendor details"
                    value={editExpenseForm.notes}
                    onChange={(e) => setEditExpenseForm(s => ({ ...s, notes: e.target.value }))}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Tags</Label>
                  <Input
                    placeholder="property, client, reimbursement"
                    value={editExpenseForm.tags}
                    onChange={(e) => setEditExpenseForm(s => ({ ...s, tags: e.target.value }))}
                  />
                </div>
                <div className="space-y-2 md:col-span-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="edit-reimb"
                    checked={editExpenseForm.reimb}
                    onChange={(e) => setEditExpenseForm(s => ({ ...s, reimb: e.target.checked }))}
                    className="accent-primary"
                  />
                  <Label htmlFor="edit-reimb" className="cursor-pointer">Reimbursable</Label>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowEditExpenseForm(false)}>
                Cancel
              </Button>
              <Button onClick={saveEditedExpense}>Save Changes</Button>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-[10001] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full">
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute -top-10 right-0 text-white/70 hover:text-white transition text-xl p-2"
              aria-label="Close preview"
            >
              ✕
            </button>
            <img 
              src={previewImage} 
              alt="Receipt preview" 
              className="w-full h-auto max-h-[85vh] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

      {/* OCR Processing Overlay */}
      {ocrProcessing && (
        <div className="fixed inset-0 z-[10002] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
            <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Scanning Receipt</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Extracting vendor, amount, and date...
            </p>
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-300 ease-out"
                style={{ width: `${ocrProgress}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">{ocrProgress}% complete</p>
          </div>
        </div>
      )}
    </>
  );
}
