import { Building2, Phone } from 'lucide-react';
import { brandedTourOfficePhone, telHref } from '@/utils/officePhone';
import { cn } from '@/lib/utils';
import { formatTourPhoneNumber } from './tourDisplayUtils';
import './tourContactNumbers.css';

type Props = {
  source?: { client_phone?: string; office_phone?: string; show_office_phone_on_tour?: boolean } | null;
  className?: string;
  onPhoneClick?: (phone: string) => void;
};

/** One shared contact row for every branded tour layout, including legacy tours. */
export function TourContactNumbers({ source, className, onPhoneClick }: Props) {
  const phone = source?.client_phone?.trim() || '';
  const office = brandedTourOfficePhone(source);
  if (!phone && !office) return null;
  const href = (value: string) => /^[+\d\s().-]+$/.test(value) ? telHref(value) : `tel:${value}`;
  return (
    <div className={cn('tour-contact-numbers', className)} role="group" aria-label="Contact phone numbers">
      {phone && <a href={href(phone)} title="Phone" onClick={() => onPhoneClick?.(phone)}>
        <Phone aria-hidden="true" />{formatTourPhoneNumber(phone)}
      </a>}
      {phone && office && <i className="tour-contact-numbers-separator" aria-hidden="true">|</i>}
      {office && <a href={href(office)} title="Office phone" aria-label={`Office ${formatTourPhoneNumber(office)}`} onClick={() => onPhoneClick?.(office)}>
        <Building2 aria-hidden="true" />{formatTourPhoneNumber(office)}
      </a>}
    </div>
  );
}
