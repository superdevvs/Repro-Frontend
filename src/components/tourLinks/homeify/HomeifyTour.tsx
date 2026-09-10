import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ArrowDown, ArrowUpRight, Bath, BedDouble, CalendarDays, CarFront, Check, ChevronRight, House, Images, Layers3, Mail, MapPin, Maximize, Menu, Phone, Printer, Share2, X } from 'lucide-react';
import type { PublicTourData } from '../publicTourData';
import { formatTourPrice } from '../tourDisplayUtils';
import { trackLinkClick, trackShare } from '@/lib/tourTracking';
import { HomeifyGallery } from './HomeifyGallery';
import { HomeifyMedia } from './HomeifyMedia';
import { homeifyEmbedUrl } from './homeifyMediaUtils';
import './homeify.css';

const titleCase = (value: unknown) => String(value ?? '').replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const hasValue = (value: unknown) => value !== null && value !== undefined && String(value).trim() !== '';

/** Homeify is a presentation theme. All content comes from the same public tour payload. */
export function HomeifyTour({ data }: { data: PublicTourData }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [shareStatus, setShareStatus] = useState('');
  const shareTimer = useRef<ReturnType<typeof setTimeout>>();
  const { shoot, propertyDetails: property, stats, branding, analytics } = data;
  const address = shoot?.address || 'Property tour';
  const locality = [shoot?.city, shoot?.state, shoot?.zip].filter(Boolean).join(', ');
  const fullAddress = [shoot?.address, locality].filter(Boolean).join(', ');
  const hasContact = data.variant === 'branded' && Boolean(shoot?.client_name || shoot?.client_email || shoot?.client_phone || data.tourSettings.realtor_info);
  const has3d = Boolean(data.iguide.inlineUrl || data.matterportUrl || data.embeds.some((embed) => homeifyEmbedUrl(embed.value)));
  const hasVideo = [...data.videos, data.videoLink].some((value) => value && homeifyEmbedUrl(value));
  const hasPlans = data.floorplans.some((plan) => Boolean(plan.image || plan.preview_url || plan.previewImages?.length || plan.preview_images?.length || plan.web_url || plan.thumbnail_url));
  const price = formatTourPrice(property.price);
  const brandName = data.variant === 'branded' ? shoot?.client_company : '';
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;
  const sections = [
    { id: 'overview', label: 'Overview' },
    ...(data.heroSlides.length ? [{ id: 'photos', label: 'Photos' }] : []),
    ...(hasVideo ? [{ id: 'video', label: 'Video' }] : []),
    ...(has3d ? [{ id: 'tour', label: '3D tour' }] : []),
    ...(hasPlans ? [{ id: 'floorplan', label: 'Floor plans' }] : []),
    { id: 'location', label: 'Location' },
  ];
  const overview = [
    { label: 'Bedrooms', value: stats.beds, icon: BedDouble },
    { label: 'Bathrooms', value: stats.baths, icon: Bath },
    { label: 'Square feet', value: stats.sqft?.toLocaleString(), icon: Maximize },
    { label: 'Year built', value: property.year_built, icon: CalendarDays },
    ...(data.showGarage ? [{ label: 'Garage spaces', value: stats.garageCars, icon: CarFront }] : []),
  ].filter((item) => hasValue(item.value));
  const propertyRows = [
    ['Property type', titleCase(property.property_type)], ['Listing', titleCase(property.listing_type)],
    ['Status', titleCase(property.property_status)], ['Year built', property.year_built],
    ['Lot size', property.lot_size], ['MLS number', property.mls_id],
    ['Bedrooms', stats.beds], ['Bathrooms', stats.baths],
    ['Interior area', stats.sqft !== null ? `${stats.sqft.toLocaleString()} sq ft` : null],
    ...(data.showGarage ? [['Garage spaces', stats.garageCars]] : []),
  ].filter(([, value]) => hasValue(value));

  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${address} | Property tour`;
    return () => { document.title = previousTitle; clearTimeout(shareTimer.current); };
  }, [address]);

  const trackLink = (type: string, url: string) => {
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
  const style = (branding?.primary_color && /^#[0-9a-f]{6}$/i.test(branding.primary_color)
    ? { '--homeify-accent': branding.primary_color } : {}) as CSSProperties;

  if (data.locked || !shoot) return (
    <main className="homeify-tour homeify-unavailable">
      <House size={36} strokeWidth={1.3} />
      <h1>{data.locked ? 'This tour is locked' : 'Property tour unavailable'}</h1>
      <p>{data.locked ? data.lockedMessage : 'Please check the property link and try again.'}</p>
    </main>
  );

  return (
    <div className="homeify-tour" style={style}>
      <a className="homeify-skip" href="#overview">Skip to property details</a>
      <header className="homeify-header">
        <div className="homeify-container homeify-header-inner">
          <a href="#property" className="homeify-brand" aria-label="Back to property overview">
            {branding?.logo ? <img className="homeify-logo" src={branding.logo} alt={brandName || 'Property agent logo'} /> : <span className="homeify-brand-icon"><House size={28} strokeWidth={1.3} /></span>}
            <span>{brandName || 'Property tour'}<small>{locality || 'Discover your next home'}</small></span>
          </a>
          <nav className={`homeify-nav${menuOpen ? ' is-open' : ''}`} id="homeify-navigation" aria-label="Property sections">
            {sections.map((section) => <a key={section.id} href={`#${section.id}`} onClick={() => setMenuOpen(false)}>{section.label}</a>)}
          </nav>
          <div className="homeify-header-actions">
            {hasContact && <a className="homeify-button homeify-header-contact" href="#contact">Contact agent <ArrowUpRight size={16} /></a>}
            <button className="homeify-menu" type="button" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen} aria-controls="homeify-navigation" onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? <X /> : <Menu />}</button>
          </div>
        </div>
      </header>

      <main className="homeify-container" id="property">
        <div className="homeify-property-heading">
          <div>
            <div className="homeify-eyebrow"><House size={14} /> {shoot.city || 'Property'} <ChevronRight size={12} /> <span>Explore the home</span></div>
            <h1>{address}</h1>
            {locality && <p className="homeify-address"><MapPin size={17} strokeWidth={1.5} />{locality}</p>}
            <div className="homeify-tags">
              {property.listing_type && <span>{titleCase(property.listing_type)}</span>}
              {property.property_status && <span className="homeify-status"><i />{titleCase(property.property_status)}</span>}
              {property.mls_id && <span>MLS {property.mls_id}</span>}
            </div>
          </div>
          <div className="homeify-heading-right">
            {price && <div className="homeify-price">{price}</div>}
            <div className="homeify-share-actions">
              <button type="button" className="homeify-icon-button" onClick={() => void share()} aria-label="Share property tour"><Share2 size={18} /></button>
              <button type="button" className="homeify-icon-button" onClick={() => window.print()} aria-label="Print property details"><Printer size={18} /></button>
            </div>
            <span className="homeify-share-status" role="status">{shareStatus}</span>
          </div>
        </div>

        <HomeifyGallery photos={data.heroSlides} address={address} shootId={analytics.shootId ?? undefined} tourType={analytics.tourType} />

        <div className="homeify-content-grid">
          <div className="homeify-main-column">
            <section className="homeify-panel" id="overview">
              <div className="homeify-panel-heading"><h2>At a glance</h2><span className="homeify-subtle">{titleCase(property.property_type) || 'Property overview'}</span></div>
              {overview.length ? <div className="homeify-stats">{overview.map(({ icon: Icon, label, value }) => <div key={label} className="homeify-stat"><span className="homeify-stat-icon"><Icon size={22} strokeWidth={1.4} /></span><div><strong>{value}</strong><span>{label}</span></div></div>)}</div> : <p className="homeify-muted">Explore the property through the photography below.</p>}
            </section>

            {property.description && <section className="homeify-panel homeify-description"><div className="homeify-panel-heading"><h2>About this home</h2></div><p>{property.description}</p></section>}

            {propertyRows.length > 0 && <section className="homeify-panel"><div className="homeify-panel-heading"><h2>Property details</h2></div><dl className="homeify-details">{propertyRows.map(([label, value]) => <div key={String(label)}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>}

            <HomeifyMedia data={data} />

            <section className="homeify-panel homeify-location" id="location">
              <div className="homeify-panel-heading"><h2>A place to call home</h2><MapPin size={20} strokeWidth={1.4} /></div>
              <div className="homeify-location-content"><div><p className="homeify-location-address">{address}</p><p className="homeify-muted">{locality}</p></div><a className="homeify-button homeify-button-outline" href={mapUrl} target="_blank" rel="noreferrer" onClick={() => trackLink('map', mapUrl)}>Open in Maps <ArrowUpRight size={17} /></a></div>
              {branding?.show_map && <iframe title={`Map of ${address}`} src={`https://maps.google.com/maps?q=${encodeURIComponent(fullAddress)}&output=embed`} loading="lazy" className="homeify-map" referrerPolicy="no-referrer" />}
            </section>
          </div>

          <aside className="homeify-sidebar">
            {hasContact && <section className="homeify-panel homeify-contact" id="contact">
              <p className="homeify-kicker">YOUR NEXT CHAPTER STARTS HERE</p><h2>Make yourself at home.</h2><p className="homeify-muted">Get in touch for more information about this property.</p>
              <div className="homeify-agent">
                {shoot.client_avatar ? <img src={shoot.client_avatar} alt={shoot.client_name || 'Listing contact'} loading="lazy" onError={(event) => { event.currentTarget.style.display = 'none'; }} /> : <span className="homeify-avatar">{shoot.client_name?.split(' ').map((word) => word[0]).slice(0, 2).join('') || <House size={24} />}</span>}
                <div><strong>{shoot.client_name || 'Listing contact'}</strong><span>{shoot.client_company || 'Property contact'}</span></div>
              </div>
              {shoot.client_phone && <a className="homeify-button" href={`tel:${shoot.client_phone.replace(/[^+\d]/g, '')}`} onClick={() => trackLink('phone', `tel:${shoot.client_phone}`)}><Phone size={17} />{shoot.client_phone}</a>}
              {shoot.client_email && <a className="homeify-button homeify-button-outline" href={`mailto:${shoot.client_email}?subject=${encodeURIComponent(`Property inquiry: ${address}`)}`} onClick={() => trackLink('email', `mailto:${shoot.client_email}`)}><Mail size={17} />Email contact</a>}
              {data.tourSettings.realtor_info && <p className="homeify-agent-notes">{data.tourSettings.realtor_info}</p>}
            </section>}
            <section className="homeify-panel homeify-explore">
              <span className="homeify-kicker">TAKE A CLOSER LOOK</span><h2>Every detail. One place.</h2>
              <div className="homeify-explore-links">
                {data.heroSlides.length > 0 && <a href="#photos"><Images size={20} /><span>Property photography<small>{data.heroSlides.length} photos to explore</small></span><ArrowUpRight size={17} /></a>}
                {has3d && <a href="#tour"><Layers3 size={20} /><span>Walk through the home<small>Explore the interactive tour</small></span><ArrowUpRight size={17} /></a>}
                {hasPlans && <a href="#floorplan"><Maximize size={20} /><span>Find your flow<small>View the floor plans</small></span><ArrowUpRight size={17} /></a>}
                <a href="#location"><MapPin size={20} /><span>Discover the location<small>{shoot.city || 'Explore the neighborhood'}</small></span><ArrowUpRight size={17} /></a>
              </div>
            </section>
            <div className="homeify-sidebar-note"><Check size={15} /> All the available property media, together.</div>
          </aside>
        </div>
      </main>
      <footer className="homeify-footer"><div className="homeify-container"><House size={25} strokeWidth={1.3} /><span>{address}<small>{locality}</small></span><a href="#property">Back to top <ArrowDown size={16} className="homeify-up" /></a></div></footer>
    </div>
  );
}
