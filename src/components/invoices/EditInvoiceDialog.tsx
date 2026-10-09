import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { InvoiceData } from "@/types/invoice";
import { apiClient } from "@/services/api";
import { mapInvoiceResponse } from "@/services/invoiceService";
export function EditInvoiceDialog({
  isOpen,
  onClose,
  invoice,
  onInvoiceEdit,
}: {
  isOpen: boolean;
  onClose: () => void;
  invoice: InvoiceData | null;
  onInvoiceEdit: (invoice: InvoiceData) => void;
}) {
  const [issue, setIssue] = useState(""),
    [due, setDue] = useState(""),
    [notes, setNotes] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (invoice) {
      setIssue(invoice.date?.slice(0, 10));
      setDue(invoice.dueDate?.slice(0, 10));
      setNotes(invoice.notes ?? "");
      setError("");
    }
  }, [invoice]);
  if (!invoice) return null;
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit draft {invoice.number}</DialogTitle>
          <DialogDescription>
            Update dates and notes. Saved service pricing remains unchanged; issued invoices require an adjustment.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              const r = await apiClient.patch("/admin/accounting-home/invoices/" + invoice.id, { issue_date: issue, due_date: due, notes });
              onInvoiceEdit(mapInvoiceResponse(r.data.data));
              onClose();
            } catch (err) {
              setError((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? "Draft could not save.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <p>
            {invoice.client} · {invoice.property}
          </p>
          <label className="block">
            Issue date
            <Input type="date" required value={issue} onChange={(e) => setIssue(e.target.value)} />
          </label>
          <label className="block">
            Due date
            <Input type="date" required min={issue} value={due} onChange={(e) => setDue(e.target.value)} />
          </label>
          <label className="block">
            Notes
            <Input maxLength={5000} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={busy}>{busy ? "Saving…" : "Save changes"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
