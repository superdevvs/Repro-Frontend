
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/auth/AuthProvider';
import { CircularProgress } from './CircularProgress';
import { MoreVertical, Edit, Power, Trash } from 'lucide-react';
import { Infinity } from 'lucide-react';
import { format } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type Coupon = {
  id: number;
  code: string;
  type: 'percentage' | 'fixed';
  amount: number;
  max_uses?: number | null;
  current_uses?: number | null;
  is_active?: boolean | null;
  valid_until?: string | null;
};

interface CouponCardProps {
  coupon: Coupon;
}

export function CouponCard({ coupon }: CouponCardProps) {
  const { role } = useAuth();
  const isSuperAdmin = role === 'superadmin';

  const formatValue = (type: string, amount: number) => {
    if (type === 'percentage') {
      return `-${amount}%`;
    }
    return `-$${amount}`;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    try {
      return format(new Date(dateString), 'MMM d, yyyy');
    } catch (error) {
      console.error('Error formatting date:', error);
      return dateString;
    }
  };

  return (
    <Card className="relative overflow-hidden">
      <div className="absolute top-4 right-4">
        {isSuperAdmin && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Power className="mr-2 h-4 w-4" />
                {coupon.is_active ? 'Deactivate' : 'Activate'}
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive">
                <Trash className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <CardContent className="pt-6">
        <div className="text-2xl font-bold mb-2">{coupon.code}</div>
        <div className="flex justify-center mb-6">
          <CircularProgress 
            value={formatValue(coupon.type, coupon.amount)} 
            color="#3B82F6"
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
          <div>
            <div className="font-medium">Valid Thru</div>
            <div className="flex items-center gap-1">
              {coupon.valid_until ? (
                formatDate(coupon.valid_until)
              ) : (
                <Infinity className="h-4 w-4" />
              )}
            </div>
          </div>
          <div>
            <div className="font-medium">Uses</div>
            <div className="flex items-center gap-1">
              {coupon.current_uses ?? 0} / {coupon.max_uses ?? <Infinity className="h-4 w-4" />}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
