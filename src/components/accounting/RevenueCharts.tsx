import React, { useEffect, useMemo, useRef, useState } from 'react';
import Tesseract from 'tesseract.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AreaChart, BarChart, LineChart, DonutChart } from '@/components/charts';
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { InvoiceData } from '@/utils/invoiceUtils';
import { Eye, BarChart3, PieChart, LineChart as LineChartIcon, Search, UploadCloud, Plus, Edit, Receipt, Trash2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
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

interface RevenueChartsProps {
  invoices: InvoiceData[];
  timeFilter: 'day' | 'week' | 'month' | 'quarter' | 'year';
  onTimeFilterChange: (filter: 'day' | 'week' | 'month' | 'quarter' | 'year') => void;
  variant?: 'full' | 'compact';
  theme?: 'auto' | 'light' | 'dark';
  role?: string;
}

export function RevenueCharts({
  invoices,
  timeFilter,
  onTimeFilterChange,
  variant = 'full',
  theme = 'auto',
  role = '',
}: RevenueChartsProps) {
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

  const normalizeExpenseStatus = (value?: string) => {
    const normalized = (value || 'unreviewed').toLowerCase();
    if (normalized === 'approved' || normalized === 'reviewed') {
      return normalized as ExpenseItem['status'];
    }
    return 'unreviewed' as ExpenseItem['status'];
  };

  const getValidDate = (value?: string) => {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.valueOf()) ? null : parsed;
  };

  const formatExpenseDate = (value?: string) => {
    const parsed = getValidDate(value);
    return parsed ? format(parsed, 'MMM dd, yyyy') : (value || 'N/A');
  };

  const normalizeAmount = (value?: number | string) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const expenseItems = useMemo<ExpenseItem[]>(() => {
    return invoices.flatMap((invoice) => {
      const items = invoice.items || [];
      return items
        .filter((item: any) => String(item?.type || item?.meta?.type || '').toLowerCase() === 'expense')
        .map((item: any, index: number) => {
          const meta = item?.meta || {};
          const recordedAt =
            item?.recorded_at ||
            item?.recordedAt ||
            item?.created_at ||
            item?.createdAt ||
            invoice.issueDate ||
            invoice.date ||
            invoice.createdAt;

          return {
            id: String(item?.id || `${invoice.id}-${index}`),
            vendor: meta.vendor || item?.description || 'Expense',
            category: meta.category || 'General',
            sub: meta.sub || '',
            amount: normalizeAmount(item?.total_amount ?? item?.unit_amount),
            date: recordedAt || new Date().toISOString(),
            status: normalizeExpenseStatus(meta.status),
            reimb: Boolean(meta.reimb),
            notes: meta.notes || '',
            tags: Array.isArray(meta.tags) ? meta.tags : [],
            invoiceId: String(invoice.id || ''),
          } satisfies ExpenseItem;
        });
    });
  }, [invoices]);

  const STORAGE_KEY = 'repro_expenses';

  const [draftExpenses, setDraftExpenses] = useState<ExpenseItem[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Persist draft expenses to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draftExpenses));
    } catch (e) {
      console.error('Failed to save expenses to localStorage', e);
    }
  }, [draftExpenses]);
  const expensesState = useMemo(
    () => [...draftExpenses, ...expenseItems],
    [draftExpenses, expenseItems]
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
  }, [chartBuckets, invoices, expensesState]);

  const transactions = useMemo(() => {
    return [...expensesState]
      .sort((a, b) => {
        const aDate = getValidDate(a.date)?.valueOf() ?? 0;
        const bDate = getValidDate(b.date)?.valueOf() ?? 0;
        return bDate - aDate;
      })
      .slice(0, 4)
      .map((item) => ({
        id: item.id,
        vendor: item.vendor,
        desc: item.sub ? `${item.category} • ${item.sub}` : item.category,
        amount: item.amount,
        date: formatExpenseDate(item.date),
        status: item.status,
        badge: item.reimb ? 'Reimbursable' : '',
      }));
  }, [expensesState]);

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
      /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/,
      /(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/,
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
      !/^[\d\s\-\/\.\$]+$/.test(l) && // not just numbers/symbols
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
  const loadPdfJs = async () => {
    if ((window as any).pdfjsLib) {
      return (window as any).pdfjsLib;
    }
    
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = () => {
        const pdfjsLib = (window as any).pdfjsLib;
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
      const pdfjsLib = await loadPdfJs() as any;
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';
      
      console.log('PDF loaded, pages:', pdf.numPages);
      
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
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
      (window as any).__pendingReceiptPreview = previewData;
    }
    
    setShowNewExpenseForm(true);
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
        setDraftExpenses(prev => [...newItems, ...prev]);
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

  const saveNewExpense = () => {
    // Check if there's a pending receipt preview from OCR upload
    const pendingPreview = (window as any).__pendingReceiptPreview;
    
    const e = {
      id: String(Date.now()),
      vendor: newExpenseForm.vendor || "Untitled",
      category: newExpenseForm.category || "Misc",
      sub: newExpenseForm.sub || "",
      amount: Number(newExpenseForm.amount) || 0,
      date: newExpenseForm.date ? new Date(newExpenseForm.date).toISOString() : new Date().toISOString(),
      status: normalizeExpenseStatus(newExpenseForm.status),
      reimb: !!newExpenseForm.reimb,
      notes: newExpenseForm.notes,
      tags: newExpenseForm.tags ? newExpenseForm.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
      _uploadedPreview: pendingPreview || null,
    } as ExpenseItem;
    
    setDraftExpenses(prev => [e, ...prev]);
    setSelectedExpense(e);
    setShowNewExpenseForm(false);
    
    // Clear pending preview
    delete (window as any).__pendingReceiptPreview;
  };

  const deleteExpense = (id: string) => {
    setDraftExpenses(prev => prev.filter(e => e.id !== id));
    if (selectedExpense?.id === id) {
      setSelectedExpense(null);
    }
    setSelectedIds(prev => prev.filter(i => i !== id));
  };

  const deleteSelectedExpenses = () => {
    if (selectedIds.length === 0) return;
    setDraftExpenses(prev => prev.filter(e => !selectedIds.includes(e.id)));
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

  const saveEditedExpense = () => {
    const updated = {
      id: editExpenseForm.id,
      vendor: editExpenseForm.vendor || "Untitled",
      category: editExpenseForm.category || "Misc",
      sub: editExpenseForm.sub || "",
      amount: Number(editExpenseForm.amount) || 0,
      date: editExpenseForm.date ? new Date(editExpenseForm.date).toISOString() : new Date().toISOString(),
      status: normalizeExpenseStatus(editExpenseForm.status),
      reimb: !!editExpenseForm.reimb,
      notes: editExpenseForm.notes,
      tags: editExpenseForm.tags ? editExpenseForm.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
      _uploadedPreview: editExpenseForm._uploadedPreview,
    } as ExpenseItem;
    
    setDraftExpenses(prev => prev.map(e => e.id === updated.id ? updated : e));
    setSelectedExpense(updated);
    setShowEditExpenseForm(false);
  };

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
              {!hasExpenses ? (
                <div className="rounded-xl border border-dashed border-border/60 dark:border-white/10 bg-card/50 p-6 text-sm text-slate-500 dark:text-slate-400">
                  <div className="flex flex-col gap-4">
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
                  <div className="w-full lg:w-1/2 flex flex-col gap-4">
                    <div className="rounded-lg border border-border/60 dark:border-slate-700/40 p-0 overflow-hidden">
                      <div className="max-h-64 overflow-y-auto pr-3">
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
                        selectedExpense._uploadedPreview && "cursor-pointer hover:bg-muted/80 transition"
                      )}
                      onClick={() => {
                        if (selectedExpense._uploadedPreview) {
                          setPreviewImage(String(selectedExpense._uploadedPreview));
                        }
                      }}
                    >
                      {selectedExpense._uploadedPreview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={String(selectedExpense._uploadedPreview)} alt="uploaded" className="h-12 w-12 object-cover rounded-md" />
                      ) : (
                        <div className="h-12 w-12 rounded-md bg-primary/10 flex items-center justify-center">
                          <Receipt className="h-6 w-6 text-primary" />
                        </div>
                      )}
                      <div className="flex flex-col">
                        <span className="text-sm text-foreground font-medium">Receipt</span>
                        {selectedExpense._uploadedPreview && (
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
            {/* eslint-disable-next-line @next/next/no-img-element */}
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
