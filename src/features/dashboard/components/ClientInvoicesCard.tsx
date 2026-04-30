import React from "react";
import { CreditCard, FileDown, FileText } from "lucide-react";

import { Card } from "@/components/dashboard/v2/SharedComponents";
import { Button } from "@/components/ui/button";
import { currencyFormatter } from "@/utils/dashboardDerivedUtils";

import type { ClientInvoicesCardProps } from "../types";

export const ClientInvoicesCard: React.FC<ClientInvoicesCardProps> = ({ summary, onViewAll, onPay }) => (
  <Card className="flex flex-col gap-3 sm:gap-4">
    <div>
      <h2 className="text-base sm:text-lg font-bold text-foreground">Invoices & payments</h2>
      <p className="text-xs sm:text-sm text-muted-foreground">Stay current on outstanding balances.</p>
    </div>
    <div className="space-y-2 sm:space-y-3">
      {[
        { label: "Due now", data: summary.dueNow, icon: <CreditCard size={12} className="sm:w-3.5 sm:h-3.5" /> },
        { label: "Upcoming", data: summary.upcoming, icon: <FileText size={12} className="sm:w-3.5 sm:h-3.5" /> },
        { label: "Paid", data: summary.paid, icon: <FileDown size={12} className="sm:w-3.5 sm:h-3.5" /> },
      ].map((item) => (
        <div key={item.label} className="flex items-center justify-between rounded-xl sm:rounded-2xl border border-border/70 px-2.5 sm:px-3 py-2">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-foreground">
            {item.icon}
            {item.label}
          </div>
          <div className="text-right">
            <p className="text-base sm:text-lg font-semibold">{currencyFormatter.format(item.data.amount)}</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground">{item.data.count} items</p>
          </div>
        </div>
      ))}
    </div>
    <div className="grid gap-2">
      <Button size="sm" className="text-xs sm:text-sm" onClick={onViewAll}>
        View all invoices
      </Button>
      <Button size="sm" variant="outline" className="text-xs sm:text-sm" onClick={onPay}>
        Make a payment
      </Button>
    </div>
  </Card>
);
