import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type React from 'react';
import Tesseract from 'tesseract.js';
import {
  endOfDay,
  endOfMonth,
  endOfQuarter,
  endOfWeek,
  endOfYear,
  format,
  getQuarter,
  isWithinInterval,
  startOfDay,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear,
  subDays,
  subMonths,
  subQuarters,
  subWeeks,
  subYears,
} from 'date-fns';

import {
  createAccountingExpense,
  deleteAccountingExpense,
  listAccountingExpenses,
  updateAccountingExpense,
  type AccountingExpense,
} from '@/services/accountingExpenseService';
import type { InvoiceData } from '@/utils/invoiceUtils';
import type { RevenueTimeFilter } from './revenueChartsTypes';

interface RevenueChartsControllerArgs {
  invoices: InvoiceData[];
  timeFilter: RevenueTimeFilter;
  role: string;
}

interface PdfTextItem {
  str?: string;
}

interface PdfPage {
  getTextContent: () => Promise<{ items: PdfTextItem[] }>;
}

interface PdfDocument {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfPage>;
}

interface PdfJsLibrary {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (source: { data: ArrayBuffer }) => { promise: Promise<PdfDocument> };
}

declare global {
  interface Window {
    pdfjsLib?: PdfJsLibrary;
    __pendingReceiptPreview?: string;
    __pendingReceiptFile?: File;
  }
}

export function useRevenueChartsController({
  invoices,
  timeFilter,
  role,
}: RevenueChartsControllerArgs) {
  const isSuperAdmin = role === 'superadmin';
  const [chartType, setChartType] = useState<'area' | 'bar' | 'line'>('area');
  type ExpenseItem = {
    id: string;
    vendor: string;
    category: string;
    sub?: string;
    amount: number;
    date: string;
    status: 'unreviewed' | 'reviewed' | 'approved';
    reimb: boolean;
    notes?: string;
    tags?: string[];
    invoiceId?: string;
    relatedType?: string | null;
    relatedId?: number | null;
    receiptUrl?: string | null;
    _uploadedPreview?: string | null;
  };

  const timeFilterLabel = useMemo(() => {
    switch (timeFilter) {
      case 'day':
        return 'Last 30 days';
      case 'week':
        return 'Last 12 weeks';
      case 'quarter':
        return 'Last 8 quarters';
      case 'year':
        return 'Last 5 years';
      default:
        return 'Last 12 months';
    }
  }, [timeFilter]);

  const normalizeExpenseStatus = useCallback((value?: string) => {
    const normalized = (value || 'unreviewed').toLowerCase();
    if (normalized === 'approved' || normalized === 'reviewed') {
      return normalized as ExpenseItem['status'];
    }
    return 'unreviewed' as ExpenseItem['status'];
  }, []);

  const getValidDate = useCallback((value?: string) => {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.valueOf()) ? null : parsed;
  }, []);

  const formatExpenseDate = useCallback((value?: string) => {
    const parsed = getValidDate(value);
    return parsed ? format(parsed, 'MMM dd, yyyy') : (value || 'N/A');
  }, [getValidDate]);

  const normalizeAmount = useCallback((value?: number | string) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }, []);

  const [backendExpenses, setBackendExpenses] = useState<AccountingExpense[]>([]);
  const [expensesLoading, setExpensesLoading] = useState(false);

  const loadExpenses = useCallback(async () => {
    if (!isSuperAdmin && role !== 'admin') {
      setBackendExpenses([]);
      return;
    }

    setExpensesLoading(true);
    try {
      setBackendExpenses(await listAccountingExpenses());
    } catch (error) {
      console.error('Failed to load accounting expenses', error);
      setBackendExpenses([]);
    } finally {
      setExpensesLoading(false);
    }
  }, [isSuperAdmin, role]);

  useEffect(() => {
    void loadExpenses();
  }, [loadExpenses]);

  const expensesState = useMemo<ExpenseItem[]>(() =>
    backendExpenses.map((expense) => ({
      id: String(expense.id),
      vendor: expense.vendor || expense.description || 'Expense',
      category: expense.category || 'General',
      sub: expense.description || '',
      amount: normalizeAmount(expense.amount),
      date: expense.expense_date || new Date().toISOString(),
      status: normalizeExpenseStatus(expense.status),
      reimb: Boolean(expense.reimbursable),
      notes: expense.notes || '',
      tags: Array.isArray(expense.tags) ? expense.tags : [],
      relatedType: expense.related_type || null,
      relatedId: expense.related_id || null,
      receiptUrl: expense.receipt_url || null,
    })),
    [backendExpenses, normalizeAmount, normalizeExpenseStatus]
  );

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // popup & new-expense modal controls
  const [showPopup, setShowPopup] = useState(false);
  const [showNewExpenseForm, setShowNewExpenseForm] = useState(false);
  const [newExpenseForm, setNewExpenseForm] = useState({
    vendor: '',
    category: '',
    sub: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    status: 'unreviewed',
    reimb: false,
    notes: '',
    tags: ''
  });

  // selection states
  const [selectedExpense, setSelectedExpense] = useState<ExpenseItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [ocrProcessing, setOcrProcessing] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  
  // Edit expense modal
  const [showEditExpenseForm, setShowEditExpenseForm] = useState(false);
  const [editExpenseForm, setEditExpenseForm] = useState({
    id: '',
    vendor: '',
    category: '',
    sub: '',
    amount: '',
    date: '',
    status: 'unreviewed',
    reimb: false,
    notes: '',
    tags: '',
    _uploadedPreview: null as string | null,
  });

  useEffect(() => {
    if (expensesState.length === 0) {
      setSelectedExpense(null);
      return;
    }

    setSelectedExpense((current) => {
      if (!current) return expensesState[0];
      return expensesState.find((item) => item.id === current.id) ?? expensesState[0];
    });

    setSelectedIds((current) =>
      current.filter((id) => expensesState.some((item) => item.id === id))
    );
  }, [expensesState]);

  const expenseData = useMemo(() => {
    const grouped = expensesState.reduce<Record<string, number>>((acc, item) => {
      const key = item.category || 'General';
      acc[key] = (acc[key] || 0) + item.amount;
      return acc;
    }, {});

    return Object.entries(grouped).map(([name, value]) => ({ name, value }));
  }, [expensesState]);

  const totalExpenses = useMemo(
    () => expensesState.reduce((sum, item) => sum + item.amount, 0),
    [expensesState]
  );
  const hasExpenses = expensesState.length > 0;

  const chartBuckets = useMemo(() => {
    const now = new Date();
    if (timeFilter === 'day') {
      return Array.from({ length: 14 }, (_, idx) => {
        const date = subDays(now, 13 - idx);
        return {
          label: format(date, 'MMM dd'),
          start: startOfDay(date),
          end: endOfDay(date),
        };
      });
    }

    if (timeFilter === 'week') {
      return Array.from({ length: 12 }, (_, idx) => {
        const date = subWeeks(now, 11 - idx);
        return {
          label: format(startOfWeek(date), 'MMM dd'),
          start: startOfWeek(date),
          end: endOfWeek(date),
        };
      });
    }

    if (timeFilter === 'quarter') {
      return Array.from({ length: 8 }, (_, idx) => {
        const date = subQuarters(now, 7 - idx);
        return {
          label: `Q${getQuarter(date)} ${format(date, 'yy')}`,
          start: startOfQuarter(date),
          end: endOfQuarter(date),
        };
      });
    }

    if (timeFilter === 'year') {
      return Array.from({ length: 5 }, (_, idx) => {
        const date = subYears(now, 4 - idx);
        return {
          label: format(date, 'yyyy'),
          start: startOfYear(date),
          end: endOfYear(date),
        };
      });
    }

    return Array.from({ length: 12 }, (_, idx) => {
      const date = subMonths(now, 11 - idx);
      return {
        label: format(date, 'MMM'),
        start: startOfMonth(date),
        end: endOfMonth(date),
      };
    });
  }, [timeFilter]);

  const monthlyData = useMemo(() => {
    return chartBuckets.map(({ label, start, end }) => {
      const revenue = invoices.reduce((sum, invoice) => {
        const date = getValidDate(invoice.issueDate || invoice.createdAt || invoice.date);
        if (!date) return sum;
        if (!isWithinInterval(date, { start, end })) return sum;
        return sum + normalizeAmount(invoice.amount);
      }, 0);

      const expenses = expensesState.reduce((sum, item) => {
        const date = getValidDate(item.date);
        if (!date) return sum;
        if (!isWithinInterval(date, { start, end })) return sum;
        return sum + item.amount;
      }, 0);

      return {
        month: label,
        revenue,
        expenses,
        profit: revenue - expenses,
      };
    });
  }, [chartBuckets, expensesState, getValidDate, invoices, normalizeAmount]);

  const transactions = useMemo(() => {
    return [...expensesState]
      .sort((a, b) => {
        const aDate = getValidDate(a.date)?.valueOf() ?? 0;
        const bDate = getValidDate(b.date)?.valueOf() ?? 0;
        return bDate - aDate;
      })
      .map((item) => ({
        id: item.id,
        vendor: item.vendor,
        desc: item.sub ? `${item.category} • ${item.sub}` : item.category,
        amount: item.amount,
        date: formatExpenseDate(item.date),
        status: item.status,
        badge: item.reimb ? 'Reimbursable' : '',
      }));
  }, [expensesState, formatExpenseDate, getValidDate]);

  // file & csv refs
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const csvInputRef = useRef<HTMLInputElement | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // toggle select helper
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
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

  // OCR helper: extract vendor, amount, date from receipt text
  const parseReceiptText = (text: string) => {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    
    // Normalize text for better matching (collapse multiple spaces)
    const normalizedText = text.replace(/\s+/g, ' ');
    
    // Extract amount - look for currency patterns (ordered by priority)
    const amountPatterns = [
      // "Total Due: $185.50" or "Total Due $185.50"
      /total\s*due[:\s]*\$?\s*([\d,]+\.?\d*)/i,
      // "Grand Total: $XX" or "Total: $XX"
      /(?:grand\s*)?total[:\s]*\$?\s*([\d,]+\.?\d*)/i,
      // "Amount Due: $XX"
      /amount\s*(?:due)?[:\s]*\$?\s*([\d,]+\.?\d*)/i,
      // "Balance: $XX" or "Balance Due: $XX"
      /balance\s*(?:due)?[:\s]*\$?\s*([\d,]+\.?\d*)/i,
      // "Subtotal: $XX"
      /subtotal[:\s]*\$?\s*([\d,]+\.?\d*)/i,
      // Direct $ amounts like "$185.50"
      /\$\s*([\d,]+\.\d{2})/,
      // Currency codes
      /(?:USD|INR|EUR|GBP)\s*([\d,]+\.?\d*)/i,
    ];
    
    let amount = 0;
    // Try patterns on normalized text first
    for (const pattern of amountPatterns) {
      const match = normalizedText.match(pattern);
      if (match) {
        const parsed = parseFloat(match[1].replace(/,/g, ''));
        if (!isNaN(parsed) && parsed > 0) {
          amount = parsed;
          break;
        }
      }
    }
    
    // If still no amount, find the largest dollar amount in the text
    if (amount === 0) {
      const allAmounts = normalizedText.match(/\$\s*([\d,]+\.\d{2})/g) || [];
      const amounts = allAmounts.map(a => parseFloat(a.replace(/[$,\s]/g, ''))).filter(a => !isNaN(a));
      if (amounts.length > 0) {
        amount = Math.max(...amounts);
      }
    }
    
    // Extract date - look for common date formats
    const datePatterns = [
      /(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/,
      /(\d{4}[/-]\d{1,2}[/-]\d{1,2})/,
      /((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4})/i,
      /(\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{4})/i,
    ];
    let extractedDate = new Date().toISOString().split('T')[0];
    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        try {
          const parsed = new Date(match[1]);
          if (!isNaN(parsed.getTime())) {
            extractedDate = parsed.toISOString().split('T')[0];
            break;
          }
        } catch { /* ignore */ }
      }
    }
    
    // Extract vendor - usually first few meaningful lines
    let vendor = 'Unknown Vendor';
    const vendorCandidates = lines.slice(0, 5).filter(l => 
      l.length > 2 && 
      l.length < 50 && 
      !/^[\d\s/.$-]+$/.test(l) && // not just numbers/symbols
      !/receipt|invoice|order|date|time|total|subtotal|tax/i.test(l)
    );
    if (vendorCandidates.length > 0) {
      vendor = vendorCandidates[0];
    }
    
    // Try to detect category from common keywords
    let category = 'General';
    const categoryMap: Record<string, string[]> = {
      'Food & Dining': ['restaurant', 'cafe', 'coffee', 'food', 'dining', 'pizza', 'burger', 'sushi'],
      'Travel': ['hotel', 'flight', 'airline', 'uber', 'lyft', 'taxi', 'parking', 'gas', 'fuel'],
      'Office Supplies': ['office', 'staples', 'paper', 'supplies', 'amazon'],
      'Equipment': ['electronics', 'camera', 'lens', 'computer', 'hardware'],
      'Software': ['software', 'subscription', 'adobe', 'microsoft', 'google'],
    };
    const textLower = text.toLowerCase();
    for (const [cat, keywords] of Object.entries(categoryMap)) {
      if (keywords.some(kw => textLower.includes(kw))) {
        category = cat;
        break;
      }
    }
    
    return { vendor, amount, date: extractedDate, category };
  };

  // Load PDF.js dynamically from CDN
  const loadPdfJs = async (): Promise<PdfJsLibrary> => {
    if (window.pdfjsLib) {
      return window.pdfjsLib;
    }
    
    return new Promise<PdfJsLibrary>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = () => {
        const pdfjsLib = window.pdfjsLib;
        if (!pdfjsLib) {
          reject(new Error('PDF.js failed to initialize'));
          return;
        }
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve(pdfjsLib);
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  };

  // Extract text from PDF
  const extractPdfText = async (file: File): Promise<string> => {
    try {
      const pdfjsLib = await loadPdfJs();
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';
      
      console.log('PDF loaded, pages:', pdf.numPages);
      
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item) => typeof item.str === 'string' ? item.str : '')
          .join(' ');
        fullText += pageText + '\n';
      }
      
      console.log('Full extracted text:', fullText);
      return fullText;
    } catch (err) {
      console.error('PDF extraction error:', err);
      throw err;
    }
  };

  const handleFileChange = async (ev: React.ChangeEvent<HTMLInputElement>) => {
    const files = ev.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    ev.currentTarget.value = ""; // Reset input early
    
    setOcrProcessing(true);
    setOcrProgress(0);
    
    let extractedText = '';
    let previewData: string | null = null;
    
    try {
      // Handle PDF files
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        setOcrProgress(20);
        try {
          extractedText = await extractPdfText(file);
          console.log('PDF extracted text:', extractedText.slice(0, 200));
        } catch (pdfErr) {
          console.error('PDF extraction error:', pdfErr);
        }
        setOcrProgress(80);
      } 
      // Handle image files with OCR
      else if (file.type.startsWith("image/")) {
        // Read as data URL for preview
        const imgData = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        previewData = imgData;
        
        try {
          const result = await Tesseract.recognize(imgData, 'eng', {
            logger: (m) => {
              if (m.status === 'recognizing text') {
                setOcrProgress(Math.round(m.progress * 100));
              }
            }
          });
          extractedText = result.data.text;
          console.log('OCR extracted text:', extractedText.slice(0, 200));
        } catch (ocrErr) {
          console.error('OCR error:', ocrErr);
        }
      }
      
      setOcrProgress(100);
      
    } catch (err) {
      console.error('File processing failed:', err);
    } finally {
      setOcrProcessing(false);
      setOcrProgress(0);
    }
    
    // Always open the modal for user to confirm/edit details
    const extracted = extractedText.trim() ? parseReceiptText(extractedText) : null;
    
    setNewExpenseForm({
      vendor: extracted?.vendor || '',
      category: extracted?.category || '',
      sub: file.name,
      amount: extracted?.amount && extracted.amount > 0 ? String(extracted.amount) : '',
      date: extracted?.date || new Date().toISOString().split('T')[0],
      status: 'unreviewed',
      reimb: false,
      notes: extractedText.trim() 
        ? `Extracted from: ${file.name}\n\nRaw text:\n${extractedText.slice(0, 500)}${extractedText.length > 500 ? '...' : ''}`
        : `Uploaded: ${file.name}`,
      tags: ''
    });
    
    // Store preview if available
    if (previewData) {
      window.__pendingReceiptPreview = previewData;
    }
    window.__pendingReceiptFile = file;
    
    setShowNewExpenseForm(true);
  };

  // CSV import basic handler
  const handleImportClick = () => csvInputRef.current?.click();

  const handleCsvChange = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const f = ev.target.files?.[0];
    setImportError(null);
    if (!f) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const text = String(reader.result || "");
      try {
        const newItems = parseSimpleCsv(text);
        await Promise.all(newItems.map((item) => createAccountingExpense({
          vendor: item.vendor,
          category: item.category,
          description: item.sub || item.category,
          amount: item.amount,
          expense_date: item.date ? new Date(item.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          status: item.status,
          reimbursable: item.reimb,
          notes: item.notes,
          tags: item.tags,
        })));
        await loadExpenses();
      } catch (error: unknown) {
        setImportError(error instanceof Error ? error.message : "Failed to parse CSV");
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
      const obj: Record<string, string> = {};
      header.forEach((h, i) => { obj[h] = cols[i] ?? ""; });
      return {
        id: String(Date.now() + idx),
        vendor: obj.vendor || "Imported",
        category: obj.category || "Misc",
        sub: obj.sub || "",
        amount: Number(obj.amount) || 0,
        date: obj.date || new Date().toISOString(),
        status: normalizeExpenseStatus(obj.status),
        reimb: String(obj.reimb).toLowerCase() === "true",
        notes: obj.notes || "",
        tags: obj.tags ? String(obj.tags).split("|").map((t: string) => t.trim()).filter(Boolean) : []
      } satisfies ExpenseItem;
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
      date: new Date().toISOString().split('T')[0],
      status: "unreviewed",
      reimb: false,
      notes: "",
      tags: ""
    });
    setShowNewExpenseForm(true);
  };

  const saveNewExpense = async () => {
    // Check if there's a pending receipt preview from OCR upload
    const pendingPreview = window.__pendingReceiptPreview;
    const pendingFile = window.__pendingReceiptFile;

    const created = await createAccountingExpense({
      vendor: newExpenseForm.vendor || "Untitled",
      category: newExpenseForm.category || "Misc",
      description: newExpenseForm.sub || newExpenseForm.category || "Expense",
      amount: Number(newExpenseForm.amount) || 0,
      expense_date: newExpenseForm.date || new Date().toISOString().split('T')[0],
      status: normalizeExpenseStatus(newExpenseForm.status),
      reimbursable: !!newExpenseForm.reimb,
      notes: newExpenseForm.notes,
      tags: newExpenseForm.tags ? newExpenseForm.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
      receipt: pendingFile || null,
    });

    await loadExpenses();
    setSelectedExpense({
      id: String(created.id),
      vendor: created.vendor || created.description,
      category: created.category,
      sub: created.description,
      amount: created.amount,
      date: created.expense_date,
      status: normalizeExpenseStatus(created.status),
      reimb: created.reimbursable,
      notes: created.notes || "",
      tags: created.tags || [],
      receiptUrl: created.receipt_url || null,
      _uploadedPreview: pendingPreview || null,
    });
    setShowNewExpenseForm(false);

    delete window.__pendingReceiptPreview;
    delete window.__pendingReceiptFile;
  };

  const deleteExpense = async (id: string) => {
    const current = expensesState.find((expense) => expense.id === id);
    if (current?.relatedType === 'photographer_equipment') {
      const confirmed = window.confirm('This expense is linked to equipment. Deleting it will unlink the equipment expense but keep the equipment record.');
      if (!confirmed) return;
    }
    await deleteAccountingExpense(Number(id));
    await loadExpenses();
    if (selectedExpense?.id === id) {
      setSelectedExpense(null);
    }
    setSelectedIds(prev => prev.filter(i => i !== id));
  };

  const deleteSelectedExpenses = async () => {
    if (selectedIds.length === 0) return;
    await Promise.all(selectedIds.map((id) => deleteAccountingExpense(Number(id))));
    await loadExpenses();
    if (selectedExpense && selectedIds.includes(selectedExpense.id)) {
      setSelectedExpense(null);
    }
    setSelectedIds([]);
  };

  const openEditExpense = (expense: ExpenseItem) => {
    setEditExpenseForm({
      id: expense.id,
      vendor: expense.vendor,
      category: expense.category,
      sub: expense.sub || '',
      amount: String(expense.amount),
      date: expense.date ? new Date(expense.date).toISOString().split('T')[0] : '',
      status: expense.status,
      reimb: expense.reimb,
      notes: expense.notes || '',
      tags: Array.isArray(expense.tags) ? expense.tags.join(', ') : '',
      _uploadedPreview: expense._uploadedPreview || null,
    });
    setShowEditExpenseForm(true);
  };

  const saveEditedExpense = async () => {
    const current = expensesState.find((expense) => expense.id === editExpenseForm.id);
    if (current?.relatedType === 'photographer_equipment') {
      const confirmed = window.confirm('This expense is linked to equipment. Saving will sync amount, date, and vendor back to the equipment record.');
      if (!confirmed) return;
    }

    const updated = await updateAccountingExpense(Number(editExpenseForm.id), {
      vendor: editExpenseForm.vendor || "Untitled",
      category: editExpenseForm.category || "Misc",
      description: editExpenseForm.sub || editExpenseForm.category || "Expense",
      amount: Number(editExpenseForm.amount) || 0,
      expense_date: editExpenseForm.date || new Date().toISOString().split('T')[0],
      status: normalizeExpenseStatus(editExpenseForm.status),
      reimbursable: !!editExpenseForm.reimb,
      notes: editExpenseForm.notes,
      tags: editExpenseForm.tags ? editExpenseForm.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
    });

    await loadExpenses();
    setSelectedExpense({
      id: String(updated.id),
      vendor: updated.vendor || updated.description,
      category: updated.category,
      sub: updated.description,
      amount: updated.amount,
      date: updated.expense_date,
      status: normalizeExpenseStatus(updated.status),
      reimb: updated.reimbursable,
      notes: updated.notes || "",
      tags: updated.tags || [],
      relatedType: updated.related_type || null,
      relatedId: updated.related_id || null,
      receiptUrl: updated.receipt_url || null,
    });
    setShowEditExpenseForm(false);
  };

  return {
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
  };
}
