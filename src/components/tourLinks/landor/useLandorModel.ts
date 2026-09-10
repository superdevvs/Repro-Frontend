import { useEffect, useMemo, useRef, useState } from 'react';
import { Bath, BedDouble, CalendarDays, CarFront, Maximize } from 'lucide-react';
import type { PublicTourData } from '../publicTourData';
import { formatTourPrice } from '../tourDisplayUtils';
import { trackLinkClick, trackShare } from '@/lib/tourTracking';
import { resolvePublicTourPalette, type PublicTourPalette } from './landorPalettes';
import { hasLandorMedia } from './landorMediaModel';

const titleCase = (value: unknown) => String(value ?? '').replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const hasValue = (value: unknown) => value !== null && value !== undefined && String(value).trim() !== '';

/** Shared presentation model for every Landor layout variant. */
export function useLandorModel(data: PublicTourData, paletteProp?: PublicTourPalette) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [shareStatus, setShareStatus] = useState('');
  const shareTimer = useRef<ReturnType<typeof setTimeout>>();
  const { shoot, propertyDetails: property, stats, analytics } = data;
  const branded = data.variant === 'branded';
  const branding = branded ? data.branding : null;
  const address = shoot?.address || 'Property tour';
  const locality = [shoot?.city, shoot?.state, shoot?.zip].filter(Boolean).join(', ');
  const fullAddress = [shoot?.address, locality].filter(Boolean).join(', ');
  const hasContact = branded && Boolean(shoot?.client_name || shoot?.client_email || shoot?.client_phone || data.tourSettings.realtor_info);
  const hero = data.heroSlides[0];
  const secondary = data.heroSlides[1] || hero;
  const hasMedia = hasLandorMedia(data);
  const price = formatTourPrice(property.price);
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;
  const palette = useMemo(() => {
    const preview = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('palette') : null;
    return resolvePublicTourPalette(paletteProp ?? data.tourPalette, preview);
  }, [paletteProp, data.tourPalette]);

  const facts = [
    { label: 'Bedrooms', value: stats.beds, icon: BedDouble },
    { label: 'Bathrooms', value: stats.baths, icon: Bath },
    { label: 'Interior area', value: stats.sqft !== null ? `${stats.sqft.toLocaleString('en-US')} sq ft` : null, icon: Maximize },
    { label: 'Year built', value: property.year_built, icon: CalendarDays },
    ...(data.showGarage ? [{ label: 'Garage spaces', value: stats.garageCars, icon: CarFront }] : []),
  ].filter((item) => hasValue(item.value));

  const details = [
    ['Property type', titleCase(property.property_type)], ['Listing', titleCase(property.listing_type)],
    ['Status', titleCase(property.property_status)], ['MLS number', property.mls_id],
    ['Lot size', typeof property.lot_size === 'number' ? property.lot_size.toLocaleString('en-US') : property.lot_size],
    ['Price', price],
  ].filter(([, value]) => hasValue(value));

  const sections = [
    { id: 'overview', label: 'Overview' },
    ...(hasMedia ? [{ id: 'media', label: 'Gallery & tours' }] : []),
    { id: 'location', label: 'Location' },
    ...(hasContact ? [{ id: 'contact', label: 'Contact' }] : []),
  ];

  useEffect(() => {
    const previous = document.title;
    document.title = `${address} | Property tour`;
    return () => { document.title = previous; clearTimeout(shareTimer.current); };
  }, [address]);

  const track = (type: string, url: string) => {
    if (analytics.shootId !== null) trackLinkClick(analytics.shootId, analytics.tourType, type, url);
  };

  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: address, url: window.location.href });
      else { await navigator.clipboard.writeText(window.location.href); setShareStatus('Link copied'); }
      if (analytics.shootId !== null) trackShare(analytics.shootId, analytics.tourType);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setShareStatus('Copy the link from your address bar');
    }
    clearTimeout(shareTimer.current);
    shareTimer.current = setTimeout(() => setShareStatus(''), 4000);
  };

  return {
    menuOpen, setMenuOpen, shareStatus, share, track,
    shoot, property, stats, branding, branded, analytics,
    address, locality, fullAddress, hasContact, hero, secondary, hasMedia, price, mapUrl, palette,
    facts, details, sections, titleCase, hasValue, locked: data.locked, lockedMessage: data.lockedMessage,
  };
}
