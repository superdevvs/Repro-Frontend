import { ArrowDown, ArrowUpRight, House, Mail, MapPin, Phone } from 'lucide-react';
import type { PublicTourData } from '../publicTourData';
import { showMissingTourImage, preventTourImageDownloadGesture } from '../shared/publicTourImage';
import type { useLandorModel } from './useLandorModel';

type Model = ReturnType<typeof useLandorModel>;

export function LandorUnavailable({ locked, lockedMessage }: { locked: boolean; lockedMessage: string }) {
  return (
    <main className="landor-tour landor-unavailable">
      <House size={42} />
      <h1>{locked ? 'This tour is locked' : 'Property tour unavailable'}</h1>
      <p>{locked ? lockedMessage : 'Please check the property link and try again.'}</p>
    </main>
  );
}

export function LandorHeader({ model, themeClass }: { model: Model; themeClass?: string }) {
  const { branding, shoot, branded, sections, menuOpen, setMenuOpen, hasContact } = model;
  if (!shoot) return null;
  return (
    <header className={`landor-header ${themeClass || ''}`}>
      <a href="#landor-top" className="landor-brand" aria-label="Back to property overview">
        {branding?.logo
          ? <img src={branding.logo} alt={shoot.client_company || 'Property agent logo'} className="landor-logo" />
          : <House size={32} strokeWidth={1.8} />}
        <span>{(branded && shoot.client_company) || 'Property tour'}<small>{shoot.city || 'A closer look at home'}</small></span>
      </a>
      <nav className={`landor-nav${menuOpen ? ' is-open' : ''}`} id="landor-navigation" aria-label="Property sections">
        {sections.map((section) => (
          <a key={section.id} href={`#${section.id}`} onClick={() => setMenuOpen(false)}>{section.label}</a>
        ))}
      </nav>
      <div className="landor-header-actions">
        {branded && shoot.client_phone && (
          <a className="landor-header-phone" href={`tel:${shoot.client_phone.replace(/[^+\d]/g, '')}`} onClick={() => model.track('phone', `tel:${shoot.client_phone}`)}>
            <span><Phone size={18} /></span>
            <div><small>Get in touch</small>{shoot.client_phone}</div>
          </a>
        )}
        {hasContact && <a className="landor-button landor-contact-button" href="#contact">Contact agent <i /></a>}
        <button type="button" className="landor-menu" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen} aria-controls="landor-navigation" onClick={() => setMenuOpen((value) => !value)}>
          {menuOpen ? 'Close' : 'Menu'}
        </button>
      </div>
    </header>
  );
}

export function LandorLocationSection({ model, branding }: { model: Model; branding: PublicTourData['branding'] }) {
  const { address, fullAddress, mapUrl, track } = model;
  return (
    <section className="landor-container landor-location" id="location">
      <div>
        <span className="landor-eyebrow">THE LOCATION</span>
        <h2>A place to call home.</h2>
        <p><MapPin size={19} />{fullAddress}</p>
      </div>
      <a className="landor-button" href={mapUrl} target="_blank" rel="noreferrer" onClick={() => track('map', mapUrl)}>Open in Maps <ArrowUpRight size={18} /></a>
      {branding?.show_map && (
        <iframe title={`Map of ${address}`} src={`https://maps.google.com/maps?q=${encodeURIComponent(fullAddress)}&output=embed`} loading="lazy" referrerPolicy="no-referrer" />
      )}
    </section>
  );
}

export function LandorContactSection({ model, data, photo }: { model: Model; data: PublicTourData; photo?: string }) {
  const { shoot, address, track, hasContact } = model;
  if (!hasContact || !shoot) return null;
  return (
    <section className="landor-container landor-contact" id="contact">
      {photo && <img className="landor-contact-photo" src={photo} alt="" loading="lazy" draggable={false} onError={showMissingTourImage} onContextMenu={preventTourImageDownloadGesture} />}
      <div className="landor-contact-intro">
        <span className="landor-eyebrow">YOUR NEXT CHAPTER</span>
        <h2>Make your<br />next move.</h2>
        <p>Interested in {address}? Get in touch to learn more about this property.</p>
      </div>
      <div className="landor-contact-card">
        <h3>Let&apos;s talk about this home.</h3>
        <div className="landor-agent">
          {shoot.client_avatar && <img src={shoot.client_avatar} alt="" loading="lazy" onError={(event) => { event.currentTarget.style.display = 'none'; }} />}
          <div>
            <strong>{shoot.client_name || 'Listing contact'}</strong>
            {shoot.client_company && <span>{shoot.client_company}</span>}
          </div>
        </div>
        {shoot.client_phone && (
          <a className="landor-button" href={`tel:${shoot.client_phone.replace(/[^+\d]/g, '')}`} onClick={() => track('phone', `tel:${shoot.client_phone}`)}>
            <Phone size={18} />{shoot.client_phone}
          </a>
        )}
        {shoot.client_email && (
          <a className="landor-button" href={`mailto:${shoot.client_email}?subject=${encodeURIComponent(`Property inquiry: ${address}`)}`} onClick={() => track('email', `mailto:${shoot.client_email}`)}>
            <Mail size={18} />Email contact <ArrowUpRight size={18} />
          </a>
        )}
        {data.tourSettings.realtor_info && <p className="landor-agent-notes">{data.tourSettings.realtor_info}</p>}
      </div>
    </section>
  );
}

export function LandorFooter({ model }: { model: Model }) {
  const { address, locality } = model;
  return (
    <footer className="landor-footer">
      <div className="landor-container">
        <div className="landor-footer-address">
          <House size={30} />
          <span>{address}<small>{locality}</small></span>
        </div>
        <a href="#landor-top">Back to top <ArrowDown size={17} /></a>
      </div>
    </footer>
  );
}

export function LandorOverviewFacts({ model }: { model: Model }) {
  const { facts, address, property, details, share, shareStatus, hasMedia, secondary } = model;
  return (
    <section className="landor-container landor-overview" id="overview">
      <div className="landor-property-heading">
        <span className="landor-location-label"><MapPin size={17} />{model.locality || 'Explore the property'}</span>
        <h2>{address}</h2>
        {model.price && <p className="landor-theme-price">{model.price}</p>}
      </div>
      {facts.length > 0 && (
        <dl className="landor-theme-fact-grid">
          {facts.map(({ icon: Icon, label, value }) => (
            <div className="landor-fact" key={label}>
              <span className="landor-fact-icon"><Icon size={29} strokeWidth={1.35} /></span>
              <div><dt>{label}</dt><dd>{value}</dd></div>
            </div>
          ))}
        </dl>
      )}
      <div className="landor-description-heading">
        <h2>A closer look at home.</h2>
        <div className="landor-share-actions">
          <button type="button" onClick={() => void share()} aria-label="Share property tour">Share</button>
          <button type="button" onClick={() => window.print()} aria-label="Print property details">Print</button>
          <span role="status">{shareStatus}</span>
        </div>
      </div>
      {property.description && <p className="landor-description">{property.description}</p>}
      {details.length > 0 && (
        <dl className="landor-detail-row">
          {details.map(([label, value]) => <div key={String(label)}><dt>{label}</dt><dd>{value}</dd></div>)}
        </dl>
      )}
      {hasMedia && (
        <div className="landor-findings landor-theme-findings">
          <div>
            <span className="landor-eyebrow">EXPLORE THE PROPERTY</span>
            <h2>See the spaces.<br />Picture the possibilities.</h2>
            <p>Take a closer look at {address}{model.shoot?.city ? ` in ${model.shoot.city}` : ''}.</p>
            <a className="landor-button" href="#media">Explore the gallery <ArrowUpRight size={18} /></a>
          </div>
          {secondary && (
            <img src={secondary} alt={`${address} — another view of the property`} loading="lazy" draggable={false} onContextMenu={preventTourImageDownloadGesture} onError={showMissingTourImage} />
          )}
        </div>
      )}
    </section>
  );
}
