import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { CalendarIcon, FileTextIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, parseISO } from "date-fns";
import { InvoiceData } from '@/utils/invoiceUtils';
import { useToast } from '@/hooks/use-toast';

interface InvoiceItem {
  id?: number | string;
  description?: string;
  quantity?: number;
  unit_amount?: number;
  total_amount?: number;
  type?: string;
  meta?: {
    extra_description?: string;
    service_name?: string;
    photographer_name?: string;
    source?: string;
  };
}

interface EditInvoiceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: InvoiceData | null;
  onInvoiceEdit: (updatedInvoice: InvoiceData) => void;
}

export function EditInvoiceDialog({ isOpen, onClose, invoice, onInvoiceEdit }: EditInvoiceDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const [client, setClient] = useState('');
  const [property, setProperty] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState<Date>(new Date());
  const [dueDate, setDueDate] = useState<Date>(new Date());
  const [items, setItems] = useState<InvoiceItem[]>([]);

  useEffect(() => {
    if (invoice) {
      setClient(invoice.client || '');
      setProperty(invoice.property || '');
      setAmount(invoice.amount?.toString() || '');
      setDate(invoice.date ? parseISO(invoice.date) : new Date());
      setDueDate(invoice.dueDate ? parseISO(invoice.dueDate) : new Date());
      setItems(invoice.items || []);
    }
  }, [invoice]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const handleEditInvoice = (e: React.FormEvent) => {
    e.preventDefault();

    if (!client || !amount) {
      toast({
        title: "Validation Error",
        description: "Please fill out all required fields",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    const formattedDate = format(date, 'yyyy-MM-dd');
    const formattedDueDate = format(dueDate, 'yyyy-MM-dd');

    const updatedInvoice: InvoiceData = {
      ...invoice!,
      client: client,
      property: property,
      date: formattedDate,
      dueDate: formattedDueDate,
      amount: parseFloat(amount),
      items: items,
    };

    setTimeout(() => {
      setLoading(false);
      onInvoiceEdit(updatedInvoice);
      toast({
        title: "Invoice Updated",
        description: `Invoice ${invoice?.number} has been updated successfully.`,
        variant: "default",
      });
      onClose();
    }, 1000);
  };

  if (!invoice) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md md:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Invoice</DialogTitle>
          <DialogDescription>
            Update invoice details below and save changes.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleEditInvoice} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="client">Client Name</Label>
            <Input
              id="client"
              placeholder="Enter client name"
              value={client}
              onChange={(e) => setClient(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="property">Property Address</Label>
            <Input
              id="property"
              placeholder="Enter property address"
              value={property}
              onChange={(e) => setProperty(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Invoice Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(date) => date && setDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Due Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dueDate ? format(dueDate, "PPP") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dueDate}
                    onSelect={(date) => date && setDueDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Invoice Items - Read-only display */}
          {items.length > 0 && (
            <div className="space-y-2">
              <Label>Services</Label>
              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left py-2 px-3 font-medium">Description</th>
                      <th className="text-right py-2 px-3 font-medium w-24">Rate</th>
                      <th className="text-center py-2 px-3 font-medium w-16">Qty</th>
                      <th className="text-right py-2 px-3 font-medium w-24">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => {
                      const description = item.description || item.meta?.service_name || 'Service';
                      const quantity = item.quantity ?? 1;
                      const unitAmount = item.unit_amount ?? 0;
                      const totalAmount = item.total_amount ?? unitAmount * quantity;
                      return (
                        <tr key={item.id || index} className="border-t border-border">
                          <td className="py-2 px-3">
                            <span className="font-medium">{description}</span>
                            {item.meta?.photographer_name && (
                              <span className="block text-xs text-muted-foreground">
                                Photographer: {item.meta.photographer_name}
                              </span>
                            )}
                          </td>
                          <td className="text-right py-2 px-3 text-muted-foreground">
                            {formatCurrency(unitAmount)}
                          </td>
                          <td className="text-center py-2 px-3 text-muted-foreground">{quantity}</td>
                          <td className="text-right py-2 px-3 font-medium">
                            {formatCurrency(totalAmount)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground">
                To add or remove services, use the View Invoice dialog.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="amount">Invoice Amount ($)</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          <DialogFooter className="pt-4">
            <Button variant="outline" type="button" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>Saving...</>
              ) : (
                <>
                  <FileTextIcon className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
