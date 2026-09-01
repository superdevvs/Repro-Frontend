import axios from 'axios';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format, startOfDay } from 'date-fns';
import { CalendarIcon, Loader2 } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from '@/lib/sonner-toast';
import { cn } from '@/lib/utils';
import { apiClient } from '@/services/api';
import type { Coupon } from './couponTypes';

const formSchema = z.object({
  code: z.string().trim().min(3, 'Code must be at least 3 characters').max(50, 'Code cannot exceed 50 characters'),
  type: z.enum(['percentage', 'fixed']),
  amount: z.string()
    .trim()
    .min(1, 'Enter a discount amount')
    .refine((value) => Number.isFinite(Number(value)) && Number(value) >= 0, {
      message: 'Discount amount must be zero or greater',
    }),
  max_uses: z.string()
    .trim()
    .refine(
      (value) => value === '' || (/^\d+$/.test(value) && Number(value) >= 1),
      'Uses limit must be a whole number greater than zero',
    ),
  valid_until: z.date().optional(),
}).superRefine((values, context) => {
  if (values.type === 'percentage' && Number(values.amount) > 100) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['amount'],
      message: 'Percentage discounts cannot exceed 100%',
    });
  }
});

type FormData = z.infer<typeof formSchema>;

interface CreateCouponDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ApiErrorResponse {
  message?: string;
  errors?: Record<string, string[]>;
}

const getApiErrorMessage = (error: unknown) => {
  if (!axios.isAxiosError<ApiErrorResponse>(error)) {
    return error instanceof Error ? error.message : 'Unknown error';
  }

  const validationMessage = Object.values(error.response?.data?.errors ?? {}).flat().find(Boolean);
  return validationMessage || error.response?.data?.message || 'Unknown error';
};

export function CreateCouponDialog({ open, onOpenChange }: CreateCouponDialogProps) {
  const queryClient = useQueryClient();
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      code: '',
      type: 'percentage',
      amount: '',
      max_uses: '',
      valid_until: undefined,
    },
  });

  const createCouponMutation = useMutation({
    mutationFn: async (values: FormData) => {
      const couponData = {
        code: values.code.trim().toUpperCase(),
        type: values.type,
        amount: Number(values.amount),
        max_uses: values.max_uses === '' ? null : Number(values.max_uses),
        valid_until: values.valid_until ? format(values.valid_until, 'yyyy-MM-dd') : null,
        is_active: true,
      };

      const response = await apiClient.post<{ data: Coupon }>('/coupons', couponData);
      return response.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['coupons'] });
      toast.success('Discount created successfully');
      form.reset();
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      toast.error(`Failed to create discount: ${getApiErrorMessage(error)}`);
    },
  });

  const handleOpenChange = (nextOpen: boolean) => {
    if (createCouponMutation.isPending) return;
    if (!nextOpen) form.reset();
    onOpenChange(nextOpen);
  };

  const onSubmit = (values: FormData) => {
    createCouponMutation.mutate(values);
  };

  const isPending = createCouponMutation.isPending;
  const today = startOfDay(new Date());

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create Discount</DialogTitle>
          <DialogDescription>
            Add a new discount code
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Discount code</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="SUMMER2024"
                      className="text-center text-lg uppercase"
                      autoCapitalize="characters"
                      autoComplete="off"
                      maxLength={50}
                      disabled={isPending}
                      onChange={(event) => field.onChange(event.target.value.toUpperCase())}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={isPending}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="percentage">Percentage (%)</SelectItem>
                        <SelectItem value="fixed">Fixed Amount ($)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        max={form.watch('type') === 'percentage' ? '100' : undefined}
                        step="0.01"
                        inputMode="decimal"
                        {...field}
                        className="text-right"
                        disabled={isPending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="valid_until"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valid through</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            type="button"
                            variant="outline"
                            disabled={isPending}
                            className={cn(
                              'w-full pl-3 text-left font-normal',
                              !field.value && 'text-muted-foreground',
                            )}
                          >
                            {field.value ? format(field.value, 'PPP') : <span>No expiry</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => date < today}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="max_uses"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Uses limit</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        inputMode="numeric"
                        {...field}
                        placeholder="Unlimited"
                        disabled={isPending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isPending ? 'Creating Discount…' : 'Create Discount'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
