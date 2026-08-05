import { cn } from '@/lib/utils';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MultiSelectChecklist } from '@/components/ui/multi-select-checklist';
import { editorCapabilityOptions } from './accountFormModel';
import type { AccountFormController } from './useAccountFormController';

export function AccountRoleSettings({ controller }: { controller: AccountFormController }) {
  const { form, isEditorRole, isClientRole, serviceGroupOptions } = controller;
  return (
    <>
            {isEditorRole && (
              <div className="space-y-4 rounded-lg border border-border/60 bg-muted/30 p-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold">Editing Capabilities</h3>
                  <p className="text-sm text-muted-foreground">
                    Choose which editing lanes this account can automatically receive.
                  </p>
                </div>
                <FormField
                  control={form.control}
                  name="editingCapabilities"
                  render={({ field }) => {
                    const valueArray: string[] = Array.isArray(field.value) ? field.value : []
                    const toggle = (capability: string) => {
                      if (valueArray.includes(capability)) {
                        field.onChange(valueArray.filter((value) => value !== capability))
                        return
                      }
                      field.onChange([...valueArray, capability])
                    }
                    return (
                      <FormItem>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {editorCapabilityOptions.map((option) => {
                            const active = valueArray.includes(option.id)
                            return (
                              <button
                                key={option.id}
                                type="button"
                                onClick={() => toggle(option.id)}
                                className={cn(
                                  "rounded-lg border px-4 py-3 text-left transition",
                                  active
                                    ? "border-primary/40 bg-primary/10 text-foreground shadow-sm"
                                    : "border-border/70 bg-background text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                                )}
                              >
                                <div className="text-sm font-medium">{option.label}</div>
                                <div className="mt-1 text-xs text-muted-foreground">
                                  {option.description}
                                </div>
                              </button>
                            )
                          })}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Select one or both. Mixed photo/video shoots route lanes based on these capabilities.
                        </p>
                        <FormMessage />
                      </FormItem>
                    )
                  }}
                />
              </div>
            )}
            {isClientRole && (
              <div className="space-y-4 rounded-lg border border-border/60 bg-muted/30 p-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold">Client Booking Defaults</h3>
                  <p className="text-sm text-muted-foreground">
                    Save extra recipients for shoot emails and a default discount for future bookings.
                  </p>
                </div>
                <FormField
                  control={form.control}
                  name="shootCcEmailsText"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Shoot Email CCs</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={"one@email.com\nteam@email.com"}
                          {...field}
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        Add one email per line. These recipients will be copied on shoot and payment emails.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-1 gap-2.5 sm:gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="clientDiscountType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Default Discount Type</FormLabel>
                        <FormControl>
                          <Select
                            value={field.value || 'none'}
                            onValueChange={(value) => {
                              const nextValue = value === 'none' ? undefined : value;
                              field.onChange(nextValue);
                              if (!nextValue) {
                                form.setValue('clientDiscountValue', '');
                              }
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="No discount" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No discount</SelectItem>
                              <SelectItem value="fixed">Dollar Amount</SelectItem>
                              <SelectItem value="percent">Percentage</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="clientDiscountValue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Default Discount Value {form.watch('clientDiscountType') === 'percent' ? '(%)' : '($)'}
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            max={form.watch('clientDiscountType') === 'percent' ? '100' : undefined}
                            placeholder={form.watch('clientDiscountType') === 'percent' ? '10' : '25'}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="serviceGroupIds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Service Groups</FormLabel>
                      <FormControl>
                        <MultiSelectChecklist
                          options={serviceGroupOptions}
                          value={field.value || []}
                          onChange={field.onChange}
                          placeholder="Leave empty to let this client see the full service catalog."
                          emptyMessage="No service groups available yet."
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        Choose which services this client can book by default.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}
    </>
  );
}
