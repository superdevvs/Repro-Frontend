import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface PhoneInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  value?: string;
  onChange?: (value: string) => void;
}

/**
 * Format a phone number string to (XXX) XXX-XXXX format
 * Strips all non-numeric characters and formats as US phone number
 */
export function formatPhoneNumber(value: string): string {
  // Remove all non-numeric characters
  const digits = value.replace(/\D/g, "");
  
  // Limit to 10 digits (US phone number)
  const limited = digits.slice(0, 10);
  
  // Format based on length
  if (limited.length === 0) return "";
  if (limited.length <= 3) return `(${limited}`;
  if (limited.length <= 6) return `(${limited.slice(0, 3)}) ${limited.slice(3)}`;
  return `(${limited.slice(0, 3)}) ${limited.slice(3, 6)}-${limited.slice(6)}`;
}

/**
 * Extract raw digits from a formatted phone number
 */
export function unformatPhoneNumber(value: string): string {
  return value.replace(/\D/g, "").slice(0, 10);
}

/**
 * Validate if a phone number has exactly 10 digits
 */
export function isValidPhoneNumber(value: string): boolean {
  const digits = unformatPhoneNumber(value);
  return digits.length === 10;
}

const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ className, value = "", onChange, ...props }, ref) => {
    const [displayValue, setDisplayValue] = React.useState(() =>
      formatPhoneNumber(value)
    );

    // Sync display value when external value changes
    React.useEffect(() => {
      const formatted = formatPhoneNumber(value);
      if (formatted !== displayValue) {
        setDisplayValue(formatted);
      }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target.value;
      const formatted = formatPhoneNumber(input);
      setDisplayValue(formatted);
      
      // Pass the raw digits to the parent
      const rawDigits = unformatPhoneNumber(input);
      onChange?.(rawDigits);
    };

    return (
      <Input
        ref={ref}
        type="tel"
        inputMode="numeric"
        value={displayValue}
        onChange={handleChange}
        placeholder="(555) 123-4567"
        className={cn(className)}
        {...props}
      />
    );
  }
);

PhoneInput.displayName = "PhoneInput";

export { PhoneInput };
