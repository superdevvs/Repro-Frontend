import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Loader2 } from 'lucide-react';
import type { VerticalVariant } from '@/services/higgsFieldService';

interface VerticalVariantSelectorProps {
  label: string;
  originalImageUrl: string;
  variants: VerticalVariant[];
  selectedVariantId: number | null;
  onSelect: (variantId: number) => void;
}

export function VerticalVariantSelector({
  label,
  originalImageUrl,
  variants,
  selectedVariantId,
  onSelect,
}: VerticalVariantSelectorProps) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{label}</h4>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3">
        {/* Original for reference */}
        <div className="space-y-1.5">
          <div className="relative aspect-[9/16] rounded-lg overflow-hidden border-2 border-slate-200 dark:border-slate-700">
            <img
              src={originalImageUrl}
              alt="Original"
              className="w-full h-full object-cover opacity-60"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <Badge variant="secondary" className="text-[10px]">
                Original
              </Badge>
            </div>
          </div>
          <p className="text-[10px] text-center text-slate-400">Reference</p>
        </div>

        {/* Variants */}
        {variants.map((variant) => {
          const isSelected = selectedVariantId === variant.id;
          const isPending = variant.status === 'pending';
          const isFailed = variant.status === 'failed';

          return (
            <div key={variant.id} className="space-y-1.5">
              <div
                onClick={() => {
                  if (variant.status === 'completed' && variant.image_url) {
                    onSelect(variant.id);
                  }
                }}
                className={`relative aspect-[9/16] rounded-lg overflow-hidden transition-all ${
                  variant.status === 'completed'
                    ? 'cursor-pointer hover:ring-2 hover:ring-blue-300'
                    : 'cursor-not-allowed'
                } ${isSelected ? 'ring-3 ring-blue-500 ring-offset-2' : 'border-2 border-slate-200 dark:border-slate-700'}`}
              >
                {isPending && (
                  <div className="w-full h-full bg-slate-100 dark:bg-slate-800 flex flex-col items-center justify-center gap-2">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                    <span className="text-xs text-slate-400">Generating...</span>
                  </div>
                )}

                {isFailed && (
                  <div className="w-full h-full bg-red-50 dark:bg-red-950/30 flex items-center justify-center">
                    <span className="text-xs text-red-400">Failed</span>
                  </div>
                )}

                {variant.status === 'completed' && variant.image_url && (
                  <>
                    <img
                      src={variant.image_url}
                      alt={`Variant ${variant.variant_index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                        <Check className="h-4 w-4 text-white" />
                      </div>
                    )}
                  </>
                )}
              </div>
              <p className="text-[10px] text-center text-slate-400">
                Variant {variant.variant_index + 1}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
