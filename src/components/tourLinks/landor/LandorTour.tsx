import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUpRight, Bath, BedDouble, CalendarDays, CarFront, Check, ChevronRight, House, Mail, MapPin, Maximize, Menu, Phone, Printer, Share2, X } from 'lucide-react';
import type { PublicTourData } from '../publicTourData';
import { formatTourPrice } from '../tourDisplayUtils';
import { trackLinkClick, trackShare } from '@/lib/tourTracking';
import { showMissingTourImage, preventTourImageDownloadGesture } from '../shared/publicTourImage';
import { LandorMedia } from './LandorMedia';
import { hasLandorMedia } from './landorMediaModel';
import './landor.css';

const titleCase = (value: unknown) => String(value ?? '').replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const hasValue = (value: unknown) => value !== null && value !== undefined && String(value).trim() !== '';

/** Landor's project-details presentation, driven entirely by the shared public tour model. */
export function LandorTour({ data }: { data: PublicTourData }) {
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
  const sections = [{ id: 'overview', label: 'Overview' }, ...(hasMedia ? [{ id: 'media', label: 'Gallery & tours' }] : []), { id: 'location', label: 'Location' }];

  useEffect(() => {
    const previous = document.title;
    document.title = `${address} | Property tour`;
    return () => { document.title = previous; clearTimeout(shareTimer.current); };
  }, [address]);

  const track = (type: string, url: string) => { if (analytics.shootId !== null) trackLinkClick(analytics.shootId, analytics.tourType, type, url); };
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

  if (data.locked || !shoot) return <main className="landor-tour landor-unavailable"><House size={42} /><h1>{data.locked ? 'This tour is locked' : 'Property tour unavailable'}</h1><p>{data.locked ? data.lockedMessage : 'Please check the property link and try again.'}</p></main>;

  return <div className="landor-tour" id="landor-top">
    <a className="landor-skip" href="#overview">Skip to property details</a>
    <div className="landor-banner">
      {hero && <img className="landor-banner-photo" src={hero} alt="" loading="eager" draggable={false} onError={showMissingTourImage} onContextMenu={preventTourImageDownloadGesture} />}
      <div className="landor-banner-shape" aria-hidden="true" />
      <header className="landor-header">
        <a href="#landor-top" className="landor-brand" aria-label="Back to property overview">
          {branding?.logo ? <img src={branding.logo} alt={shoot.client_company || 'Property agent logo'} className="landor-logo" /> : <House size={32} strokeWidth={1.8} />}
          <span>{branded && shoot.client_company || 'Property tour'}<small>{shoot.city || 'A closer look at home'}</small></span>
        </a>
        <nav className={`landor-nav${menuOpen ? ' is-open' : ''}`} id="landor-navigation" aria-label="Property sections">{sections.map((section) => <a key={section.id} href={`#${section.id}`} onClick={() => setMenuOpen(false)}>{section.label}</a>)}</nav>
        <div className="landor-header-actions">
          {branded && shoot.client_phone && <a className="landor-header-phone" href={`tel:${shoot.client_phone.replace(/[^+\d]/g, '')}`} onClick={() => track('phone', `tel:${shoot.client_phone}`)}><span><Phone size={18} /></span><div><small>Get in touch</small>{shoot.client_phone}</div></a>}
          {hasContact && <a className="landor-button landor-contact-button" href="#contact">Contact agent <i /></a>}
          <button type="button" className="landor-menu" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen} aria-controls="landor-navigation" onClick={() => setMenuOpen((value) => !value)}>{menuOpen ? <X /> : <Menu />}</button>
        </div>
      </header>
      <div className="landor-container landor-banner-content"><p>Property tour <ChevronRight size={15} /> {shoot.city || 'Explore the home'}</p><h1>Property details</h1></div>
      <div className="landor-banner-line" />
    </div>

    <main>
      <section className="landor-container landor-overview" id="overview">
        <div className="landor-property-heading"><span className="landor-location-label"><MapPin size={17} />{locality || 'Explore the property'}</span><h2>{address}</h2></div>
        <div className={`landor-property-feature${!hero ? ' without-photo' : ''}`}>
          {hero && <img className="landor-feature-photo" src={hero} alt={`${address} — property exterior`} draggable={false} onContextMenu={preventTourImageDownloadGesture} onError={showMissingTourImage} />}
          {facts.length > 0 && <dl className="landor-fact-card">{facts.map(({ icon: Icon, label, value }) => <div className="landor-fact" key={label}><span className="landor-fact-icon"><Icon size={29} strokeWidth={1.35} /></span><div><dt>{label}</dt><dd>{value}</dd></div></div>)}</dl>}
        </div>
        <div className="landor-description-heading"><h2>A closer look at home.</h2><div className="landor-share-actions"><button type="button" onClick={() => void share()} aria-label="Share property tour"><Share2 size={19} /></button><button type="button" onClick={() => window.print()} aria-label="Print property details"><Printer size={19} /></button><span role="status">{shareStatus}</span></div></div>
        {property.description && <p className="landor-description">{property.description}</p>}
        {details.length > 0 && <dl className="landor-detail-row">{details.map(([label, value]) => <div key={String(label)}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
        <div className="landor-findings">
          <div><span className="landor-eyebrow">EXPLORE THE PROPERTY</span><h2>See the spaces.<br />Picture the possibilities.</h2><p>Take a closer look at {address}{shoot.city ? ` in ${shoot.city}` : ''}.{hasMedia ? ' Explore the available property media and get to know the details.' : ' Get to know the property details and location.'}</p><ul>{facts.slice(0, 4).map(({ label, value }) => <li key={label}><Check size={17} /><span>{label === 'Year built' ? `Built in ${value}` : `${value} ${label === 'Interior area' ? 'of interior space' : label.toLowerCase()}`}</span></li>)}</ul>{hasMedia && <a className="landor-button" href="#media">Explore the gallery <ArrowUpRight size={18} /></a>}</div>
          {secondary && <img src={secondary} alt={`${address} — another view of the property`} loading="lazy" draggable={false} onContextMenu={preventTourImageDownloadGesture} onError={showMissingTourImage} />}
        </div>
      </section>

      <LandorMedia data={data} />

      <section className="landor-container landor-location" id="location"><div><span className="landor-eyebrow">THE LOCATION</span><h2>A place to call home.</h2><p><MapPin size={19} />{fullAddress}</p></div><a className="landor-button" href={mapUrl} target="_blank" rel="noreferrer" onClick={() => track('map', mapUrl)}>Open in Maps <ArrowUpRight size={18} /></a>{branding?.show_map && <iframe title={`Map of ${address}`} src={`https://maps.google.com/maps?q=${encodeURIComponent(fullAddress)}&output=embed`} loading="lazy" referrerPolicy="no-referrer" />}</section>

      {hasContact && <section className="landor-container landor-contact" id="contact">
        {secondary && <img className="landor-contact-photo" src={secondary} alt="" loading="lazy" />}
        <div className="landor-contact-intro"><span className="landor-eyebrow">YOUR NEXT CHAPTER</span><h2>Make your<br />next move.</h2><p>Interested in {address}? Get in touch to learn more about this property.</p></div>
        <div className="landor-contact-card"><h3>Let’s talk about this home.</h3><div className="landor-agent">{shoot.client_avatar && <img src={shoot.client_avatar} alt="" loading="lazy" onError={(event) => { event.currentTarget.style.display = 'none'; }} />}<div><strong>{shoot.client_name || 'Listing contact'}</strong>{shoot.client_company && <span>{shoot.client_company}</span>}</div></div>
          {shoot.client_phone && <a className="landor-button" href={`tel:${shoot.client_phone.replace(/[^+\d]/g, '')}`} onClick={() => track('phone', `tel:${shoot.client_phone}`)}><Phone size={18} />{shoot.client_phone}</a>}
          {shoot.client_email && <a className="landor-button" href={`mailto:${shoot.client_email}?subject=${encodeURIComponent(`Property inquiry: ${address}`)}`} onClick={() => track('email', `mailto:${shoot.client_email}`)}><Mail size={18} />Email contact <ArrowUpRight size={18} /></a>}
          {data.tourSettings.realtor_info && <p className="landor-agent-notes">{data.tourSettings.realtor_info}</p>}
        </div>
      </section>}
    </main>
    <footer className="landor-footer"><div className="landor-container"><div className="landor-footer-address"><House size={30} /><span>{address}<small>{locality}</small></span></div><a href="#landor-top">Back to top <ArrowDown size={17} /></a></div></footer>
  </div>;
}

export default LandorTour;
