import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/services/api";
import type { InvoiceData } from "@/types/invoice";
export function SendInvoiceDialog({
  invoice,
  isOpen,
  onClose,
  onSent,
}: {
  invoice: InvoiceData;
  isOpen: boolean;
  onClose: () => void;
  onSent: () => void;
}) {
  const [subject, setSubject] = useState(""),
    [message, setMessage] = useState(""),
    [email, setEmail] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const operation = useRef(crypto.randomUUID());
  useEffect(() => {
    if (!isOpen) return;
    setSubject("Invoice " + invoice.number + " from Repro");
    setMessage("Please find your invoice details below. Please contact us if you have any questions about payment.");
    setError("");
    operation.current = crypto.randomUUID();
    apiClient
      .get("/admin/invoices/" + invoice.id)
      .then((r) => setEmail((r.data.data ?? r.data).client?.email ?? ""))
      .catch(() => setError("Unable to load the registered client email."));
  }, [isOpen, invoice.id, invoice.number]);
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send invoice {invoice.number}</DialogTitle>
          <DialogDescription>
            The invoice will be emailed to the client’s registered address. Sending does not record a payment.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              await apiClient.post("/admin/accounting-home/invoices/" + invoice.id + "/send", {
                operation_key: operation.current,
                subject,
                message,
              });
              onSent();
              onClose();
            } catch (err) {
              setError(
                (err as { response?: { data?: { message?: string } } }).response?.data?.message ??
                  "Delivery could not be confirmed. Check message history before retrying.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <p>
            To: <b>{email || "Loading client…"}</b>
          </p>
          <label className="block">
            Subject
            <Input required maxLength={200} value={subject} onChange={(e) => setSubject(e.target.value)} />
          </label>
          <label className="block">
            Message
            <textarea
              className="min-h-28 w-full rounded border bg-background p-3"
              required
              maxLength={5000}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </label>
          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button disabled={busy || !email}>{busy ? "Sending…" : "Send email"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
