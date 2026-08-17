import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { InvoiceShootRef } from '@/types/invoice';

interface InvoiceAdjustmentEditorProps {
  amount: string;
  billsClient: boolean;
  chargeType: string;
  description: string;
  isEditing: boolean;
  isSaving: boolean;
  linkedShoots: InvoiceShootRef[];
  quantity: string;
  shootId: string;
  onAmountChange: (value: string) => void;
  onBillsClientChange: (value: boolean) => void;
  onCancel: () => void;
  onChargeTypeChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onPrefillVirtualStaging: () => void;
  onQuantityChange: (value: string) => void;
  onSave: () => void;
  onShootIdChange: (value: string) => void;
}

export function InvoiceAdjustmentEditor({
  amount,
  billsClient,
  chargeType,
  description,
  isEditing,
  isSaving,
  linkedShoots,
  quantity,
  shootId,
  onAmountChange,
  onBillsClientChange,
  onCancel,
  onChargeTypeChange,
  onDescriptionChange,
  onPrefillVirtualStaging,
  onQuantityChange,
  onSave,
  onShootIdChange,
}: InvoiceAdjustmentEditorProps) {
  return (
    <div className="rounded-md border border-dashed border-border bg-muted/20 px-5 py-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">
            {isEditing ? 'Edit adjustment' : 'Add invoice adjustment'}
          </p>
          <p className="text-xs text-muted-foreground">
            Misc extras and charges. Mark "Bill client" to add it to the amount the client owes.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={chargeType === 'misc' ? 'secondary' : 'outline'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => onChargeTypeChange('misc')}
            disabled={isSaving}
          >
            Misc item
          </Button>
          <Button
            type="button"
            variant={chargeType === 'virtual_staging' ? 'secondary' : 'outline'}
            size="sm"
            className="h-7 text-xs"
            onClick={onPrefillVirtualStaging}
            disabled={isSaving}
          >
            Virtual staging charge
          </Button>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-[2fr,1fr,1fr,auto]">
        <div className="space-y-1">
          <Label htmlFor="misc-description" className="text-xs">Description</Label>
          <Input
            id="misc-description"
            value={description}
            onChange={(event) => onDescriptionChange(event.target.value)}
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
            value={amount}
            onChange={(event) => onAmountChange(event.target.value)}
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
            value={quantity}
            onChange={(event) => onQuantityChange(event.target.value)}
          />
        </div>
        <div className="flex items-end gap-2">
          <Button
            type="button"
            variant="secondary"
            className="gap-2"
            onClick={onSave}
            disabled={isSaving}
          >
            <Plus className="h-4 w-4" />
            {isSaving ? 'Saving...' : (isEditing ? 'Update' : 'Add')}
          </Button>
          {isEditing && (
            <Button
              type="button"
              variant="ghost"
              onClick={onCancel}
              disabled={isSaving}
            >
              Cancel
            </Button>
          )}
        </div>
      </div>
      {linkedShoots.length > 1 && (
        <div className="max-w-xl space-y-1">
          <Label htmlFor="misc-shoot" className="text-xs">Shoot order</Label>
          <select
            id="misc-shoot"
            value={shootId}
            onChange={(event) => onShootIdChange(event.target.value)}
            disabled={isSaving}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="">Choose a shoot</option>
            {linkedShoots.map((shoot) => {
              const address = [
                shoot.address,
                shoot.city,
                [shoot.state, shoot.zip].filter(Boolean).join(' '),
              ].filter(Boolean).join(', ');

              return (
                <option key={String(shoot.id)} value={String(shoot.id)}>
                  {address || `Shoot #${shoot.id}`}
                </option>
              );
            })}
          </select>
          <p className="text-[11px] text-muted-foreground">
            Billable adjustments must be assigned to one specific shoot order.
          </p>
        </div>
      )}
      <div className="flex items-center gap-2">
        <Checkbox
          id="misc-bills-client"
          checked={billsClient}
          onCheckedChange={(checked) => onBillsClientChange(checked === true)}
          disabled={isSaving}
        />
        <Label htmlFor="misc-bills-client" className="text-xs font-normal cursor-pointer">
          Bill client / include in payable amount
          <span className="block text-[11px] text-muted-foreground">
            Off = appears on the invoice/PDF only and does not change what the client owes.
          </span>
        </Label>
      </div>
    </div>
  );
}
