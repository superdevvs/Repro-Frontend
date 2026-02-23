import React, { useCallback, useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, Plus, Trash2 } from "lucide-react";
import { jsPDF } from "jspdf";
import { format } from "date-fns";
import { Logo } from "@/components/layout/Logo";
import { useToast } from '@/hooks/use-toast';
import { usePermission } from '@/hooks/usePermission';
import { addInvoiceMiscItem, removeInvoiceMiscItem } from '@/services/invoiceService';
import { formatPaymentMethod } from '@/utils/paymentUtils';

const COMPANY_NAME = 'REPRO Photos';
const COMPANY_PHONE = '(202) 868-1663';
const COMPANY_EMAIL = 'contact@reprophotos.com';
const COMPANY_ADDRESS = import.meta.env.VITE_COMPANY_ADDRESS?.trim() || '';
const COMPANY_ADDRESS_LINES = COMPANY_ADDRESS
  ? COMPANY_ADDRESS.split('|').map((line) => line.trim()).filter(Boolean)
  : [];

interface InvoiceItem {
  id?: number | string;
  description?: string;
  quantity?: number;
  unit_amount?: number;
  total_amount?: number;
  type?: string;
  shoot_id?: number | string;
  meta?: {
    extra_description?: string;
    service_name?: string;
    photographer_name?: string;
    source?: string;
  };
}

interface InvoiceViewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: {
    id?: string | number;
    invoice_number?: string;
    number?: string;
    client?: string | { name?: string; email?: string; [key: string]: any };
    client_id?: number;
    photographer?: string | { name?: string; [key: string]: any };
    shoot?: {
      client?: {
        name?: string;
        email?: string;
        [key: string]: any;
      };
      photographer?: {
        name?: string;
        [key: string]: any;
      };
      location?: {
        address?: string;
        city?: string;
        state?: string;
        zip?: string;
        fullAddress?: string;
        full?: string;
      };
      address?: string;
      city?: string;
      state?: string;
      zip?: string;
    };
    shoots?: Array<{
      id?: number | string;
      photographer?: {
        name?: string;
        [key: string]: any;
      };
      location?: {
        address?: string;
        city?: string;
        state?: string;
        zip?: string;
        fullAddress?: string;
        full?: string;
      };
      address?: string;
      city?: string;
      state?: string;
      zip?: string;
    }>;
    property?: string;
    issue_date?: string;
    date?: string;
    due_date?: string;
    dueDate?: string;
    status?: string;
    subtotal?: number;
    tax?: number;
    total?: number;
    amount?: number;
    items?: InvoiceItem[];
    services?: string[];
    paymentMethod?: string;
    payment_method?: string;
    paymentDetails?: Record<string, any> | null;
    payment_details?: Record<string, any> | null;
    paidAt?: string | null;
    paid_at?: string | null;
  };
}

export function InvoiceViewDialog({ isOpen, onClose, invoice }: InvoiceViewDialogProps) {
  const { toast } = useToast();
  const { can } = usePermission();
  const canEditInvoice = can('invoices', 'update');
  const [currentInvoice, setCurrentInvoice] = useState(invoice);
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);
  const [isSavingMisc, setIsSavingMisc] = useState(false);
  const [miscDescription, setMiscDescription] = useState('');
  const [miscAmount, setMiscAmount] = useState('');
  const [miscQuantity, setMiscQuantity] = useState('1');

  useEffect(() => {
    setCurrentInvoice(invoice);
  }, [invoice]);

  const invoiceData = currentInvoice;
  const invoiceNumberRaw = invoiceData.invoice_number || invoiceData.number || invoiceData.id;
  const invoiceNumber = invoiceNumberRaw ? String(invoiceNumberRaw).trim() : '';
  const displayInvoiceNumber = invoiceNumber
    ? (invoiceNumber.startsWith('#') ? invoiceNumber : `#${invoiceNumber}`)
    : '';
  const issueDate = invoiceData.issue_date || invoiceData.date;
  
  // Handle client name - can be string or object
  const getClientName = () => {
    if (typeof invoiceData.client === 'string') {
      return invoiceData.client;
    }
    if (invoiceData.client && typeof invoiceData.client === 'object' && 'name' in invoiceData.client) {
      return invoiceData.client.name || 'N/A';
    }
    if (invoiceData.shoot?.client?.name) {
      return invoiceData.shoot.client.name;
    }
    return 'N/A';
  };
  const clientName = getClientName();
  const clientEmail = invoiceData.shoot?.client?.email
    || (typeof invoiceData.client === 'object' ? invoiceData.client?.email : undefined);
  
  // Handle property/shoot address
  const getPropertyAddress = () => {
    if (invoiceData.property && invoiceData.property !== 'N/A') {
      return invoiceData.property;
    }
    if (invoiceData.shoot?.location) {
      const loc = invoiceData.shoot.location;
      const locFull = loc.fullAddress || loc.full;
      if (locFull) {
        return locFull;
      }
      const parts = [
        loc.address,
        loc.city,
        [loc.state, loc.zip].filter(Boolean).join(' ')
      ].filter(Boolean);
      return parts.length > 0 ? parts.join(', ') : 'N/A';
    }
    // Fallback to shoot direct address fields
    if (invoiceData.shoot) {
      const parts = [
        invoiceData.shoot.address,
        invoiceData.shoot.city,
        [invoiceData.shoot.state, invoiceData.shoot.zip].filter(Boolean).join(' ')
      ].filter(Boolean);
      if (parts.length > 0) {
        return parts.join(', ');
      }
    }
    return 'N/A';
  };
  const propertyAddress = getPropertyAddress();
  
  const subtotal = invoiceData.subtotal ?? 0;
  const tax = invoiceData.tax ?? 0;
  const total = invoiceData.total ?? invoiceData.amount ?? 0;
  const status = invoiceData.status || 'pending';
  const isPaid = status === 'paid' || status === 'Paid';
  const paymentDetails = invoiceData.paymentDetails ?? invoiceData.payment_details ?? null;
  const paidAt = invoiceData.paidAt || invoiceData.paid_at || null;
  const paymentMethodValue = invoiceData.paymentMethod || invoiceData.payment_method;
  const paymentMethodLabel = formatPaymentMethod(paymentMethodValue, paymentDetails);

  const items: InvoiceItem[] = invoiceData.items || [];
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), 'MM/dd/yyyy');
    } catch {
      return dateString;
    }
  };

  const formatDateTime = (dateString?: string | null) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), 'MM/dd/yyyy h:mm a');
    } catch {
      return dateString;
    }
  };

  const resolvePhotographerName = (item?: InvoiceItem) => {
    const itemShootId = item?.shoot_id ? String(item.shoot_id) : null;
    const relatedShoot = itemShootId && Array.isArray(invoiceData.shoots)
      ? invoiceData.shoots.find((shoot) => String(shoot?.id) === itemShootId)
      : null;
    const fromInvoice = typeof invoiceData.photographer === 'string'
      ? invoiceData.photographer
      : invoiceData.photographer?.name;
    return item?.meta?.photographer_name
      || relatedShoot?.photographer?.name
      || invoiceData.shoot?.photographer?.name
      || fromInvoice
      || '';
  };

  const isAdminMiscItem = (item?: InvoiceItem) =>
    item?.type === 'expense' && item?.meta?.source === 'admin_misc';

  const handleAddMiscItem = async () => {
    if (!canEditInvoice) return;
    if (!invoiceData.id) {
      toast({
        title: 'Missing invoice id',
        description: 'This invoice cannot be updated yet.',
        variant: 'destructive',
      });
      return;
    }

    const amountValue = Number(miscAmount);
    const quantityValue = miscQuantity ? Number(miscQuantity) : 1;

    if (!miscDescription.trim() || !Number.isFinite(amountValue)) {
      toast({
        title: 'Missing info',
        description: 'Enter a description and amount for the misc item.',
        variant: 'destructive',
      });
      return;
    }

    setIsSavingMisc(true);
    try {
      const updated = await addInvoiceMiscItem(invoiceData.id, {
        description: miscDescription.trim(),
        amount: amountValue,
        quantity: Number.isFinite(quantityValue) && quantityValue > 0 ? quantityValue : 1,
      });
      setCurrentInvoice(updated);
      setMiscDescription('');
      setMiscAmount('');
      setMiscQuantity('1');
      toast({
        title: 'Misc item added',
        description: 'The invoice has been updated with the misc item.',
      });
    } catch (error) {
      toast({
        title: 'Failed to add misc item',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingMisc(false);
    }
  };

  const handleRemoveMiscItem = async (itemId?: number | string) => {
    if (!canEditInvoice || !invoiceData.id || !itemId) return;
    setIsSavingMisc(true);
    try {
      const updated = await removeInvoiceMiscItem(invoiceData.id, itemId);
      setCurrentInvoice(updated);
      toast({
        title: 'Misc item removed',
        description: 'The invoice has been updated.',
      });
    } catch (error) {
      toast({
        title: 'Failed to remove misc item',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingMisc(false);
    }
  };

  const loadLogoPngForPdf = useCallback(async () => {
    const response = await fetch('/REPRO-HQ.svg');
    if (!response.ok) {
      throw new Error('Failed to fetch logo SVG');
    }

    let svgText = await response.text();

    // Ensure the "PRO" text renders solid black on white PDFs.
    // In this SVG, those paths use `fill-rule:nonzero` without an explicit fill, which can
    // end up too light depending on the renderer.
    svgText = svgText.replace(
      /style="fill-rule:nonzero;"/g,
      'style="fill:#000;fill-rule:nonzero;"'
    );
    const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`;

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Failed to load SVG image'));
      image.src = svgDataUrl;
    });

    const width = img.naturalWidth || 144;
    const height = img.naturalHeight || 48;

    // Render at higher pixel density so the logo doesn't look washed out when downscaled.
    const pixelRatio = 4;
    const canvas = document.createElement('canvas');
    canvas.width = width * pixelRatio;
    canvas.height = height * pixelRatio;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas not supported');
    }

    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, width, height);

    return {
      dataUrl: canvas.toDataURL('image/png'),
      width,
      height,
    };
  }, []);

  const handleDownloadPDF = useCallback(async () => {
    if (isPdfGenerating) return;
    setIsPdfGenerating(true);

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      const contentWidth = pageWidth - (2 * margin);
      
      let yPos = margin;

      // ===== HEADER SECTION =====
      const headerTop = margin;
      const headerRightX = pageWidth - margin;
      const logoBoxWidth = 72;
      const logoBoxHeight = 23;

      // Logo
      try {
        const logo = await loadLogoPngForPdf();
        const scale = Math.min(logoBoxWidth / logo.width, logoBoxHeight / logo.height);
        const renderW = logo.width * scale;
        const renderH = logo.height * scale;
        doc.addImage(logo.dataUrl, 'PNG', margin, headerTop, renderW, renderH);
      } catch {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('REPRO Photos', margin, headerTop + 10);
      }

      // INVOICE title on right
      doc.setTextColor(30, 64, 175); // Blue color
      doc.setFontSize(28);
      doc.setFont('helvetica', 'bold');
      doc.text('INVOICE', headerRightX, headerTop + 10, { align: 'right' });
      
      // Date under INVOICE
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`Issued: ${formatDateTime(issueDate)}`, headerRightX, headerTop + 18, { align: 'right' });

      yPos = headerTop + 30;

      // ===== LIGHT BLUE BACKGROUND SECTION =====
      const blueBoxHeight = 45;
      doc.setFillColor(235, 242, 250); // Light blue background
      doc.rect(margin, yPos, contentWidth, blueBoxHeight, 'F');

      // Invoice To (left side)
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('INVOICE TO', margin + 8, yPos + 10);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(clientName.toUpperCase(), margin + 8, yPos + 18);
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      
      // Client email
      if (clientEmail) {
        doc.text(clientEmail, margin + 8, yPos + 25);
      }

      yPos += blueBoxHeight + 10;

      // ===== DATE & INVOICE NUMBER ROW =====
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(formatDate(issueDate), margin, yPos);
      
      doc.setFont('helvetica', 'bold');
      doc.text(displayInvoiceNumber || invoiceNumber, headerRightX, yPos, { align: 'right' });
      
      yPos += 7;

      // Property address below date row
      if (propertyAddress && propertyAddress !== 'N/A') {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80, 80, 80);
        const addressLines = doc.splitTextToSize(propertyAddress, contentWidth);
        doc.text(addressLines, margin, yPos);
        yPos += addressLines.length * 5 + 5;
        doc.setTextColor(0, 0, 0);
      } else {
        yPos += 5;
      }

      // ===== TABLE SECTION =====
      // Table Header
      const colNo = margin;
      const colDesc = margin + 15;
      const colPrice = margin + 95;
      const colQty = margin + 130;
      const colTotal = pageWidth - margin;

      doc.setFillColor(245, 247, 250);
      doc.rect(margin, yPos - 5, contentWidth, 10, 'F');
      
      doc.setTextColor(60, 60, 60);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('NO', colNo, yPos);
      doc.text('ITEM DESCRIPTION', colDesc, yPos);
      doc.text('PRICE', colPrice, yPos);
      doc.text('QUANTITY', colQty, yPos);
      doc.text('TOTAL', colTotal, yPos, { align: 'right' });
      
      yPos += 8;

      // Table items
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');

      items.forEach((item, index) => {
        const description = item.description || item.meta?.service_name || 'Service';
        const photographerName = resolvePhotographerName(item);
        const descLines = doc.splitTextToSize(description, 70);
        if (photographerName) {
          descLines.push(`Photographer: ${photographerName}`);
        }
        const unitAmount = item.unit_amount ?? 0;
        const quantity = item.quantity ?? 1;
        const totalAmount = item.total_amount ?? unitAmount * quantity;
        const itemHeight = Math.max(descLines.length * 5, 8);
        
        // Row number
        doc.text(`${index + 1}.`, colNo, yPos);
        
        // Description
        doc.text(descLines, colDesc, yPos);
        
        // Price
        doc.text(formatCurrency(unitAmount), colPrice, yPos);
        
        // Quantity
        doc.text(String(quantity), colQty + 10, yPos);
        
        // Total
        doc.text(formatCurrency(totalAmount), colTotal, yPos, { align: 'right' });
        
        yPos += itemHeight;
        
        if (yPos > pageHeight - 80) {
          doc.addPage();
          yPos = margin + 10;
        }
      });

      // Table bottom line
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.3);
      doc.line(margin, yPos + 2, pageWidth - margin, yPos + 2);
      yPos += 12;

      // ===== SUMMARY SECTION =====
      const summaryLabelX = colQty;
      const summaryValueX = colTotal;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text('SUBTOTAL:', summaryLabelX, yPos);
      doc.text(formatCurrency(subtotal), summaryValueX, yPos, { align: 'right' });
      yPos += 7;

      if (tax > 0) {
        doc.text('TAX:', summaryLabelX, yPos);
        doc.text(formatCurrency(tax), summaryValueX, yPos, { align: 'right' });
        yPos += 7;
      }

      // Prior Payment if paid
      if (isPaid && total > 0) {
        doc.setTextColor(0, 128, 0);
        doc.text('PRIOR PAYMENT:', summaryLabelX, yPos);
        doc.text(`-${formatCurrency(total)}`, summaryValueX, yPos, { align: 'right' });
        doc.setTextColor(0, 0, 0);
        yPos += 7;
      }

      if (isPaid && paymentMethodLabel !== 'N/A') {
        doc.setTextColor(60, 60, 60);
        doc.setFont('helvetica', 'normal');
        doc.text('PAYMENT METHOD:', summaryLabelX, yPos);
        doc.setTextColor(0, 0, 0);
        doc.text(paymentMethodLabel, summaryValueX, yPos, { align: 'right' });
        yPos += 7;
      }

      if (isPaid && paidAt) {
        doc.setTextColor(60, 60, 60);
        doc.setFont('helvetica', 'normal');
        doc.text('PAID ON:', summaryLabelX, yPos);
        doc.setTextColor(0, 0, 0);
        doc.text(formatDateTime(paidAt), summaryValueX, yPos, { align: 'right' });
        yPos += 7;
      }

      // Grand Total line
      doc.setDrawColor(180, 180, 180);
      doc.line(summaryLabelX - 5, yPos - 2, summaryValueX, yPos - 2);
      
      doc.setFont('helvetica', 'bold');
      doc.text('GRAND TOTAL:', summaryLabelX, yPos + 5);
      const grandTotal = total;
      doc.text(formatCurrency(grandTotal), summaryValueX, yPos + 5, { align: 'right' });

      // ===== TOTAL DUE/PAYMENT (Large, left side) =====
      yPos += 5;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(isPaid ? 'TOTAL PAYMENT' : 'TOTAL DUE', margin, yPos);
      
      doc.setFontSize(24);
      if (isPaid) {
        doc.setTextColor(0, 128, 0);
        doc.text(formatCurrency(total), margin, yPos + 12);
      } else {
        doc.setTextColor(30, 64, 175);
        doc.text(formatCurrency(total), margin, yPos + 12);
      }
      doc.setTextColor(0, 0, 0);

      // ===== FOOTER =====
      const footerY = pageHeight - 30;
      doc.setDrawColor(220, 220, 220);
      doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);
      
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text(COMPANY_NAME, margin, footerY);
      doc.setFont('helvetica', 'normal');
      let footerLineY = footerY + 5;
      if (COMPANY_ADDRESS_LINES.length > 0) {
        COMPANY_ADDRESS_LINES.forEach((line) => {
          doc.text(line, margin, footerLineY);
          footerLineY += 4;
        });
      }
      if (COMPANY_PHONE) {
        doc.text(`Phone: ${COMPANY_PHONE}`, margin, footerLineY);
        footerLineY += 4;
      }
      if (COMPANY_EMAIL) {
        doc.text(`Email: ${COMPANY_EMAIL}`, margin, footerLineY);
      }

      // Save PDF
      const invoiceFileNumber = (displayInvoiceNumber || invoiceNumber || 'invoice').replace('#', '');
      doc.save(`${invoiceFileNumber.replace(/\s+/g, '-')}.pdf`);
    } finally {
      setIsPdfGenerating(false);
    }
  }, [clientName, formatDate, formatDateTime, invoiceNumber, invoiceData, isPaid, issueDate, isPdfGenerating, items, loadLogoPngForPdf, propertyAddress, subtotal, tax, total, displayInvoiceNumber, resolvePhotographerName, paymentMethodLabel, paidAt]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl font-bold">Invoice</DialogTitle>
            <Button
              onClick={handleDownloadPDF}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
              disabled={isPdfGenerating}
            >
              <Download className="h-4 w-4" />
              {isPdfGenerating ? 'Generating…' : 'Download as PDF'}
            </Button>
          </div>
        </DialogHeader>
        
        <div className="p-6 space-y-8 bg-background">
          {/* Company Logo and Header */}
          <div className="flex items-start justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="shrink-0 pt-0.5">
                <Logo className="h-9 w-auto" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-lg leading-tight">{COMPANY_NAME}</p>
                <div className="text-sm text-muted-foreground leading-relaxed">
                  <p>Phone: {COMPANY_PHONE}</p>
                  <p>Email: {COMPANY_EMAIL}</p>
                </div>
              </div>
            </div>
            <div className="text-right space-y-1">
              <div className="text-xs font-semibold text-muted-foreground tracking-widest">INVOICE</div>
              <div>
                <span className="text-sm font-bold">{displayInvoiceNumber}</span>
              </div>
              <div>
                <span className="text-sm">{formatDate(issueDate)}</span>
              </div>
              {propertyAddress && propertyAddress !== 'N/A' && (
                <p className="text-xs text-muted-foreground mt-1">{propertyAddress}</p>
              )}
            </div>
          </div>

          {/* Invoice To Section */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-2">Invoice To</h3>
            <div className="space-y-1">
              <p className="font-medium text-base">{clientName}</p>
              {clientEmail && (
                <p className="text-sm text-muted-foreground">{clientEmail}</p>
              )}
            </div>
          </div>

          {canEditInvoice && (
            <div className="rounded-md border border-dashed border-border bg-muted/20 px-5 py-4 space-y-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Add misc items</p>
                <p className="text-xs text-muted-foreground">Admin-only extras that will appear on the PDF.</p>
              </div>
              <div className="grid gap-3 md:grid-cols-[2fr,1fr,1fr,auto]">
                <div className="space-y-1">
                  <Label htmlFor="misc-description" className="text-xs">Description</Label>
                  <Input
                    id="misc-description"
                    value={miscDescription}
                    onChange={(event) => setMiscDescription(event.target.value)}
                    placeholder="Ex: Rush delivery"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="misc-amount" className="text-xs">Amount</Label>
                  <Input
                    id="misc-amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={miscAmount}
                    onChange={(event) => setMiscAmount(event.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="misc-quantity" className="text-xs">Qty</Label>
                  <Input
                    id="misc-quantity"
                    type="number"
                    min="1"
                    step="1"
                    value={miscQuantity}
                    onChange={(event) => setMiscQuantity(event.target.value)}
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="secondary"
                    className="gap-2"
                    onClick={handleAddMiscItem}
                    disabled={isSavingMisc}
                  >
                    <Plus className="h-4 w-4" />
                    {isSavingMisc ? 'Saving...' : 'Add'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Invoice Items Table */}
          <div className="border-t border-b border-border">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-4 text-xs font-bold text-foreground uppercase tracking-wider">SERVICE(S)</th>
                  <th className="text-right py-4 text-xs font-bold text-foreground uppercase tracking-wider w-28">RATE</th>
                  <th className="text-center py-4 text-xs font-bold text-foreground uppercase tracking-wider w-20">QUANTITY</th>
                  <th className="text-right py-4 text-xs font-bold text-foreground uppercase tracking-wider w-28">TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {items.length > 0 ? (
                  items.map((item, index) => {
                    const description = item.description || item.meta?.service_name || 'Service';
                    const quantity = item.quantity ?? 1;
                    const unitAmount = item.unit_amount ?? 0;
                    const totalAmount = item.total_amount ?? unitAmount * quantity;
                    const photographerName = resolvePhotographerName(item);
                    const isAdminMisc = isAdminMiscItem(item);
                    return (
                    <tr key={item.id || index} className="border-b border-border last:border-b-0">
                      <td className="py-4">
                        <p className="text-sm font-medium text-foreground">{description}</p>
                        {photographerName && (
                          <p className="text-xs text-muted-foreground">Photographer: {photographerName}</p>
                        )}
                        {isAdminMisc && (
                          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Misc item</p>
                        )}
                        {isAdminMisc && canEditInvoice && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="mt-2 h-7 px-2 text-xs text-destructive"
                            onClick={() => handleRemoveMiscItem(item.id)}
                            disabled={isSavingMisc}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1" />
                            Remove
                          </Button>
                        )}
                      </td>
                      <td className="text-right py-4 text-sm text-muted-foreground">{formatCurrency(unitAmount)}</td>
                      <td className="text-center py-4 text-sm text-muted-foreground">{quantity}</td>
                      <td className="text-right py-4 text-sm font-medium text-foreground">{formatCurrency(totalAmount)}</td>
                    </tr>
                  )})
                ) : (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-sm text-muted-foreground">
                      No items found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Summary Section */}
          <div className="flex justify-end">
            <div className="w-80 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal:</span>
                <span className="font-medium text-foreground">{formatCurrency(subtotal)}</span>
              </div>
              {tax > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax:</span>
                  <span className="font-medium text-foreground">{formatCurrency(tax)}</span>
                </div>
              )}
              {isPaid && total > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-green-600 dark:text-green-400">Prior Payment:</span>
                  <span className="font-medium text-green-600 dark:text-green-400">-{formatCurrency(total)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold pt-2 border-t-2 border-border mt-2">
                <span className="text-foreground">{isPaid ? 'Total Payment:' : 'Total Due:'}</span>
                <span className={isPaid ? 'text-green-600 dark:text-green-400' : 'text-foreground'}>{formatCurrency(total)}</span>
              </div>
            </div>
          </div>

          {/* Payment Info if Paid */}
          {isPaid && (paymentMethodLabel !== 'N/A' || paidAt) && (
            <div className="pt-4 border-t space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Payment Method</p>
              {paymentMethodLabel !== 'N/A' && (
                <p className="text-sm">{paymentMethodLabel}</p>
              )}
              {paidAt && (
                <p className="text-xs text-muted-foreground">Paid on {formatDate(paidAt)}</p>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
