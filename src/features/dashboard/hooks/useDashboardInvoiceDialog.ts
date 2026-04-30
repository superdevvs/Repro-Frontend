import { useCallback, useState } from "react";

import { API_BASE_URL } from "@/config/env";
import type { useToast } from "@/hooks/use-toast";
import type { DashboardShootSummary } from "@/types/dashboard";
import { getAuthToken } from "@/utils/authToken";

type ToastFn = ReturnType<typeof useToast>["toast"];

interface UseDashboardInvoiceDialogParams {
  accessToken?: string | null;
  toast: ToastFn;
}

export const useDashboardInvoiceDialog = ({
  accessToken,
  toast,
}: UseDashboardInvoiceDialogParams) => {
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);

  const handleViewInvoice = useCallback(
    async (shoot: DashboardShootSummary) => {
      setInvoiceLoading(true);
      try {
        const token = getAuthToken(accessToken);
        const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/invoice`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        });

        if (!res.ok) {
          throw new Error("Failed to fetch invoice");
        }

        const data = await res.json();
        const invoiceData = data.data || data;
        if (invoiceData) {
          setSelectedInvoice(invoiceData);
          setInvoiceDialogOpen(true);
        } else {
          toast({
            title: "Invoice not found",
            description: "Unable to load invoice for this shoot.",
            variant: "destructive",
          });
        }
      } catch (error: any) {
        console.error("Error fetching invoice:", error);
        toast({
          title: "Error loading invoice",
          description: error.message || "Unable to load invoice. Please try again.",
          variant: "destructive",
        });
      } finally {
        setInvoiceLoading(false);
      }
    },
    [accessToken, toast],
  );

  const closeInvoiceDialog = useCallback(() => {
    setInvoiceDialogOpen(false);
    setSelectedInvoice(null);
  }, []);

  return {
    invoiceDialogOpen,
    selectedInvoice,
    invoiceLoading,
    handleViewInvoice,
    closeInvoiceDialog,
  };
};
