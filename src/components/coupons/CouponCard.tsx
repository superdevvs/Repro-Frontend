import React from 'react';
import axios from 'axios';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Edit, Infinity as InfinityIcon, Loader2, MoreVertical, Power, Trash } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { usePermission } from '@/hooks/usePermission';
import { toast } from '@/lib/sonner-toast';
import { cn } from '@/lib/utils';
import { apiClient } from '@/services/api';
import { CircularProgress } from './CircularProgress';
import { EditCouponDialog } from './EditCouponDialog';
import type { Coupon, CouponUpdatePayload } from './couponTypes';

interface CouponCardProps {
  coupon: Coupon;
}

interface ApiErrorResponse {
  message?: string;
  errors?: Record<string, string[]>;
}

const getApiErrorMessage = (error: unknown, fallback: string) => {
  if (!axios.isAxiosError<ApiErrorResponse>(error)) {
    return error instanceof Error ? error.message : fallback;
  }

  const validationMessage = Object.values(error.response?.data?.errors ?? {})[0]?.[0];
  return validationMessage || error.response?.data?.message || fallback;
};

export function CouponCard({ coupon }: CouponCardProps) {
  const queryClient = useQueryClient();
  const couponPermission = usePermission().forResource('coupons');
  const canUpdate = couponPermission.canUpdate();
  const canDelete = couponPermission.canDelete();
  const isActive = coupon.is_active !== false;
  const [editOpen, setEditOpen] = React.useState(false);
  const [toggleOpen, setToggleOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const refreshCoupons = () => queryClient.invalidateQueries({ queryKey: ['coupons'] });

  const updateMutation = useMutation({
    mutationFn: async (payload: CouponUpdatePayload) => {
      const response = await apiClient.patch<{ data: Coupon }>(`/coupons/${coupon.id}`, payload);
      return response.data.data;
    },
    onSuccess: async () => {
      await refreshCoupons();
      setEditOpen(false);
      toast.success('Discount updated successfully');
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Could not update this discount.'));
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post<{ data: Coupon }>(`/coupons/${coupon.id}/toggle`);
      return response.data.data;
    },
    onSuccess: async () => {
      await refreshCoupons();
      setToggleOpen(false);
      toast.success(`Discount ${isActive ? 'deactivated' : 'activated'} successfully`);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, `Could not ${isActive ? 'deactivate' : 'activate'} this discount.`));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiClient.delete(`/coupons/${coupon.id}`);
    },
    onSuccess: async () => {
      await refreshCoupons();
      setDeleteOpen(false);
      toast.success('Discount deleted successfully');
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Could not delete this discount.'));
    },
  });

  const formatValue = (type: Coupon['type'], amount: Coupon['amount']) => {
    const numericAmount = Number(amount);
    const displayAmount = Number.isFinite(numericAmount) ? numericAmount : 0;
    return type === 'percentage' ? `-${displayAmount}%` : `-$${displayAmount}`;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return Number.isNaN(date.getTime()) ? dateString : format(date, 'MMM d, yyyy');
  };

  return (
    <>
      <Card className="relative overflow-hidden">
        <div className="absolute right-4 top-4 flex items-center gap-2">
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-xs font-medium',
              isActive
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : 'bg-slate-500/10 text-slate-600 dark:text-slate-300',
            )}
          >
            {isActive ? 'Active' : 'Inactive'}
          </span>

          {(canUpdate || canDelete) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0" aria-label={`Actions for ${coupon.code}`}>
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canUpdate && (
                  <DropdownMenuItem
                    onSelect={(event) => {
                      event.preventDefault();
                      setEditOpen(true);
                    }}
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                )}
                {canUpdate && (
                  <DropdownMenuItem
                    onSelect={(event) => {
                      event.preventDefault();
                      setToggleOpen(true);
                    }}
                  >
                    <Power className="mr-2 h-4 w-4" />
                    {isActive ? 'Deactivate' : 'Activate'}
                  </DropdownMenuItem>
                )}
                {canDelete && (
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={(event) => {
                      event.preventDefault();
                      setDeleteOpen(true);
                    }}
                  >
                    <Trash className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <CardContent className="pt-6">
          <div className="mb-2 pr-32 text-2xl font-bold">{coupon.code}</div>
          <div className="mb-6 flex justify-center">
            <CircularProgress value={formatValue(coupon.type, coupon.amount)} color="#3B82F6" />
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
            <div>
              <div className="font-medium">Valid Thru</div>
              <div className="flex items-center gap-1">
                {coupon.valid_until ? formatDate(coupon.valid_until) : <InfinityIcon className="h-4 w-4" />}
              </div>
            </div>
            <div>
              <div className="font-medium">Uses</div>
              <div className="flex items-center gap-1">
                {coupon.current_uses ?? 0} / {coupon.max_uses ?? <InfinityIcon className="h-4 w-4" />}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <EditCouponDialog
        coupon={coupon}
        open={editOpen}
        isSaving={updateMutation.isPending}
        onOpenChange={setEditOpen}
        onSave={(payload) => updateMutation.mutateAsync(payload)}
      />

      <AlertDialog open={toggleOpen} onOpenChange={(open) => !toggleMutation.isPending && setToggleOpen(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isActive ? 'Deactivate' : 'Activate'} {coupon.code}?</AlertDialogTitle>
            <AlertDialogDescription>
              {isActive
                ? 'Customers will no longer be able to apply this discount until it is activated again.'
                : 'Customers will be able to apply this discount when its date and usage limits allow it.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={toggleMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void toggleMutation.mutateAsync().catch(() => undefined);
              }}
              disabled={toggleMutation.isPending}
            >
              {toggleMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isActive ? 'Deactivate discount' : 'Activate discount'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteOpen} onOpenChange={(open) => !deleteMutation.isPending && setDeleteOpen(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {coupon.code} permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the discount and cannot be undone. Existing orders that already used it will not be changed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                void deleteMutation.mutateAsync().catch(() => undefined);
              }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete discount
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
