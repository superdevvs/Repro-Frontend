import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export function PaymentStatusFilter({ value, onChange }: { value?: string; onChange: (value: 'all' | 'paid' | 'unpaid') => void }) {
  return (
    <div className="space-y-2">
      <span className="text-sm font-medium text-muted-foreground">Payment</span>
      <Select value={value || 'all'} onValueChange={onChange}>
        <SelectTrigger aria-label="Payment"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All payments</SelectItem>
          <SelectItem value="paid">Paid</SelectItem>
          <SelectItem value="unpaid">Unpaid / balance due</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
