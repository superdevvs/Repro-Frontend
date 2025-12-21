
import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Check, X } from "lucide-react";

interface BookShootInvoiceProps {
  packagePrice: number;
  photographerRate: number;
  state: string;
  applyCoupon: (coupon: string) => { valid: boolean; discount: number };
  couponCode: string;
  setCouponCode: (code: string) => void;
  discount: number;
}

export const BookShootInvoice = ({
  packagePrice,
  photographerRate,
  state,
  applyCoupon,
  couponCode,
  setCouponCode,
  discount
}: BookShootInvoiceProps) => {
  const [couponError, setCouponError] = React.useState<string | null>(null);
  const [couponSuccess, setCouponSuccess] = React.useState<boolean>(false);
  
  const subtotal = packagePrice; // Only package price, photographer fee is internal
  const taxRate = state === 'MD' ? 6 : state === 'VA' ? 5.3 : state === 'DC' ? 6 : 0;
  const taxAmount = ((subtotal - discount) * taxRate) / 100;
  const total = subtotal - discount + taxAmount;
  
  const handleApplyCoupon = () => {
    if (!couponCode.trim()) {
      setCouponError("Please enter a coupon code");
      setCouponSuccess(false);
      return;
    }
    
    const result = applyCoupon(couponCode);
    if (result.valid) {
      setCouponError(null);
      setCouponSuccess(true);
    } else {
      setCouponError("Invalid coupon code");
      setCouponSuccess(false);
    }
  };
  
  return (
    <Card className="bg-background/60 backdrop-blur-sm">
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold mb-4">Invoice Summary</h3>
        
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Package</span>
            <span>${packagePrice.toFixed(2)}</span>
          </div>
          
          {discount > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Discount</span>
              <span>-${discount.toFixed(2)}</span>
            </div>
          )}
          
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tax ({taxRate}%)</span>
            <span>${taxAmount.toFixed(2)}</span>
          </div>
          
          <Separator className="my-2" />
          
          <div className="flex justify-between font-semibold">
            <span>Total</span>
            <span>${total.toFixed(2)}</span>
          </div>
        </div>
        
        <div className="mt-6">
          <Label htmlFor="coupon">Coupon Code</Label>
          <div className="flex mt-1.5">
            <Input
              id="coupon"
              placeholder="Enter coupon code"
              value={couponCode}
              onChange={(e) => {
                setCouponCode(e.target.value);
                setCouponError(null);
                setCouponSuccess(false);
              }}
              className="rounded-r-none"
            />
            <Button
              onClick={handleApplyCoupon}
              className="rounded-l-none"
              variant={couponSuccess ? "outline" : "default"}
            >
              {couponSuccess ? (
                <>
                  <Check className="h-4 w-4 mr-1" />
                  Applied
                </>
              ) : (
                "Apply"
              )}
            </Button>
          </div>
          
          {couponError && (
            <p className="text-xs text-red-500 mt-1.5 flex items-center">
              <X className="h-3 w-3 mr-1" />
              {couponError}
            </p>
          )}
          
          {couponSuccess && (
            <p className="text-xs text-green-600 mt-1.5 flex items-center">
              <Check className="h-3 w-3 mr-1" />
              Coupon applied successfully
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
