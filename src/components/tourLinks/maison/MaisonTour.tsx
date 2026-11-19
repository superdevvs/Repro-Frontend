import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, ArrowUpRight, Expand, House, Menu, Play, Printer, Share2, X } from 'lucide-react';
import { TourContactNumbers } from '../TourContactNumbers';
import { FloorplanSection } from '../FloorplanSection';
import { Public3dTourViewer } from '../Public3dTourViewer';
import type { PublicTourData, PublicTourPhotoRenditions } from '../publicTourData';
import { PublicTourLightbox } from '../shared/PublicTourLightbox';
import { TemplateTourVideo } from '../shared/TemplateTourVideo';
import { preventTourImageDownloadGesture, publicTourImageSource, showMissingTourImage } from '../shared/publicTourImage';
import { usePhotoViewer, useTemplateTourModel, type TemplateTourModel } from '../shared/useTemplateTourModel';
import './maison.css';

const MOSAIC_THUMBS = 6;
const GRID_PREVIEW = 9;
const pad = (value: number) => String(value).padStart(2, '0');
const imageGuards = { draggable: false, onContextMenu: preventTourImageDownloadGesture, onDragStart: preventTourImageDownloadGesture, onError: showMissingTourImage };

function Heading({ title, italic, children }: { title: string; italic: string; children?: ReactNode }) {
  return (
    <div className="maison-heading">
      <h2>{title}<br /><span className="maison-display-italic">{italic}</span></h2>
      {children && <div className="maison-heading-aside">{children}</div>}
    </div>
  );
}

function MaisonHeader({ model, scrolled }: { model: TemplateTourModel; scrolled: boolean }) {
  const { branding, branded, shoot, sections, menuOpen, setMenuOpen, hasContact, address } = model;
  const wordmark = (branded && shoot?.client_company) || address;
  return (
    <header className={`maison-nav${scrolled || menuOpen ? ' is-scrolled' : ''}`}>
      <div className="maison-container maison-nav-row">
        <a href="#maison-top" className="maison-wordmark" aria-label="Back to the top of the property tour">
          {branding?.logo ? <img src={branding.logo} alt={shoot?.client_company || 'Agent logo'} /> : <span>{wordmark}</span>}
          <small>Property tour</small>
        </a>
        <nav className={`maison-links${menuOpen ? ' is-open' : ''}`} id="maison-navigation" aria-label="Property sections">
          {sections.map((section) => <a key={section.id} href={`#${section.id}`} onClick={() => setMenuOpen(false)}>{section.label}</a>)}
        </nav>
        <div className="maison-nav-actions">
          {hasContact && <a className="maison-btn maison-btn-primary maison-btn-sm" href="#contact">Contact agent</a>}
          <button type="button" className="maison-menu" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen} aria-controls="maison-navigation" onClick={() => setMenuOpen((value) => !value)}>
            {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        </div>
      </div>
    </header>
  );
}

function MaisonMosaic({ model, renditions, onOpen }: { model: TemplateTourModel; renditions: PublicTourPhotoRenditions; onOpen: ReturnType<typeof usePhotoViewer>['show'] }) {
  const { media: { photos }, cover, coverIndex, address } = model;
  if (!photos.length) return null;
  const thumbs = photos.map((photo, index) => ({ photo, index })).filter(({ index }) => index !== coverIndex).slice(0, MOSAIC_THUMBS);
  const remaining = photos.length - 1 - thumbs.length;
  return (
    <div className={`maison-container maison-mosaic${thumbs.length ? '' : ' is-single'}`} id="gallery">
      <button type="button" className="maison-mosaic-main" aria-label={`Open photo ${coverIndex + 1} of ${photos.length}`} onClick={(event) => onOpen(event, coverIndex)}>
        <img src={publicTourImageSource(cover, 'web', renditions)} alt={`${address} — main photo`} loading="eager" fetchPriority="high" decoding="async" {...imageGuards} />
        <span className="maison-chip maison-chip-dark">{pad(coverIndex + 1)} / {pad(photos.length)}</span>
        {photos.length > 1 && <span className="maison-chip maison-chip-light"><Expand aria-hidden="true" />View all</span>}
      </button>
      {thumbs.length > 0 && <div className="maison-mosaic-thumbs">
        {thumbs.map(({ photo, index }, position) => (
          <button key={`${photo}-${index}`} type="button" aria-label={`Open photo ${index + 1} of ${photos.length}`} onClick={(event) => onOpen(event, index)}>
            <img src={publicTourImageSource(photo, 'grid', renditions)} alt={`${address} — photo ${index + 1}`} loading="lazy" decoding="async" {...imageGuards} />
            {position === thumbs.length - 1 && remaining > 0 && <span className="maison-mosaic-more">+{remaining} more</span>}
          </button>
        ))}
      </div>}
    </div>
  );
}

function MaisonAddress({ address, mapUrl, track }: { address: string; mapUrl: string; track: TemplateTourModel['track'] }) {
  return <>
    <p className="maison-location-address">{address}</p>
    <a className="maison-btn-ghost" href={mapUrl} target="_blank" rel="noreferrer" onClick={() => track('map', mapUrl)}>Open in Maps <ArrowRight aria-hidden="true" /></a>
  </>;
}

/** Maison's property-detail page as a one-page tour, driven only by the shoot's published data. */
export function MaisonTour({ data }: { data: PublicTourData }) {
  const model = useTemplateTourModel(data);
  const { shoot, address, locality, fullAddress, property, facts, details, media, branded, branding, hasContact, track, mailto } = model;
  const viewer = usePhotoViewer(data, media.photos);
  const [scrolled, setScrolled] = useState(false);
  const [allPhotos, setAllPhotos] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = root.current;
    if (!element) return undefined;
    const onScroll = () => setScrolled(element.scrollTop > 24);
    element.addEventListener('scroll', onScroll, { passive: true });
    return () => element.removeEventListener('scroll', onScroll);
  }, [shoot]);

  if (data.locked || !shoot) {
    return (
      <main className="maison-tour maison-unavailable">
        <House aria-hidden="true" />
        <h1>{data.locked ? 'This tour is locked' : 'Property tour unavailable'}</h1>
        <p>{data.locked ? data.lockedMessage : 'Please check the property link and try again.'}</p>
      </main>
    );
  }

  const renditions = data.photoRenditions;
  const extraPhotos = media.photos.length > MOSAIC_THUMBS + 1;
  const firstName = shoot.client_name?.split(' ')[0] || '';
  const tourTile = model.secondary || model.cover;
  const showAside = hasContact || model.hasTour;
  const hasStory = Boolean(property.description) || details.length > 0;

  return (
    <div className="maison-tour" id="maison-top" ref={root}>
      <a className="maison-skip" href="#overview">Skip to property details</a>
      <MaisonHeader model={model} scrolled={scrolled} />
      <main className="maison-main">
        <section className="maison-container maison-title" aria-labelledby="maison-address">
          <p className="maison-crumbs maison-num">{['Property tour', property.mls_id ? `MLS ${property.mls_id}` : ''].filter(Boolean).join(' · ')}</p>
          <div className="maison-title-row">
            <div>
              {model.status.length > 0 && <p className="maison-tags">{model.status.map((label, index) => <span key={label} className={`maison-tag${index === 0 ? ' maison-tag-accent' : ''}`}>{label}</span>)}</p>}
              <h1 id="maison-address">{address}</h1>
              {locality && <p className="maison-display-italic maison-locality">{locality}</p>}
            </div>
            {model.price && <div className="maison-price"><p className="maison-num">{model.price}</p>{model.pricePerSqft && <p className="maison-num">{model.pricePerSqft}</p>}</div>}
          </div>
        </section>

        <MaisonMosaic model={model} renditions={renditions} onOpen={viewer.show} />

        <div className="maison-container"><div className="maison-actions">
          <div>
            <button type="button" onClick={() => void model.share()}><Share2 aria-hidden="true" />Share</button>
            <i aria-hidden="true" />
            <button type="button" onClick={() => window.print()}><Printer aria-hidden="true" />Print</button>
            <span role="status">{model.shareStatus}</span>
          </div>
          {media.photos.length > 0 && <p className="maison-num">{media.photos.length} {media.photos.length === 1 ? 'photograph' : 'photographs'}{media.floorplans.length ? ` · ${media.floorplans.length} ${media.floorplans.length === 1 ? 'floor plan' : 'floor plans'}` : ''}</p>}
        </div></div>

        {facts.length > 0 && <div className="maison-container"><dl className="maison-facts" aria-label="Key facts">
          {facts.map(({ label, value }) => <div key={label}><dt>{label}</dt><dd className="maison-num">{value}</dd></div>)}
        </dl></div>}

        {(hasStory || showAside) && <section className={`maison-container maison-body${showAside && hasStory ? '' : ' is-single'}`} id={model.hasAbout ? 'overview' : undefined} aria-label="About the property">
          {hasStory && <div className="maison-story">
            <Heading title="A closer look," italic="inside and out." />
            {property.description && <p className="maison-prose maison-drop-cap">{property.description}</p>}
            {details.length > 0 && <>
              <p className="maison-eyebrow"><span>Particulars</span></p>
              <dl className="maison-spec">{details.map(([label, value]) => <div key={String(label)}><dt>{label}</dt><dd className="maison-num">{value}</dd></div>)}</dl>
            </>}
          </div>}
          {showAside && <aside className="maison-aside"><div>
            {hasContact && <div className="maison-agent" id="contact">
              <div className="maison-agent-head">
                {shoot.client_avatar && <img src={shoot.client_avatar} alt="" loading="lazy" onError={(event) => { event.currentTarget.style.display = 'none'; }} />}
                <div>
                  <p className="maison-label">Listed by</p>
                  <p className="maison-agent-name">{shoot.client_name || 'Listing contact'}</p>
                  {shoot.client_company && <p className="maison-display-italic">{shoot.client_company}</p>}
                </div>
              </div>
              <div className="maison-agent-actions">
                <TourContactNumbers source={shoot} className="maison-phones" onPhoneClick={(phone) => track('phone', `tel:${phone}`)} />
                {mailto && <a className="maison-btn maison-btn-secondary" href={mailto} onClick={() => track('email', `mailto:${shoot.client_email}`)}>Email contact{firstName ? ` · ${firstName}` : ''}</a>}
              </div>
              {data.tourSettings.realtor_info && <p className="maison-agent-note">{data.tourSettings.realtor_info}</p>}
            </div>}
            {model.hasTour && <a className="maison-tour-tile" href="#tour">
              {tourTile && <img src={publicTourImageSource(tourTile, 'grid', renditions)} alt="" loading="lazy" {...imageGuards} />}
              <span><span className="maison-play"><Play aria-hidden="true" /></span><span className="maison-label">Take the virtual tour</span><span className="maison-num">{model.providerNames.join(' · ')}</span></span>
            </a>}
          </div></aside>}
        </section>}

        {extraPhotos && <section className="maison-container maison-section" aria-labelledby="maison-photos-heading">
          <div className="maison-heading"><h2 id="maison-photos-heading">Every room,<br /><span className="maison-display-italic">photographed.</span></h2></div>
          <div className="maison-grid">
            {(allPhotos ? media.photos : media.photos.slice(0, GRID_PREVIEW)).map((photo, index) => (
              <button key={`${photo}-${index}`} type="button" aria-label={`Open photo ${index + 1} of ${media.photos.length}`} onClick={(event) => viewer.show(event, index)}>
                <img src={publicTourImageSource(photo, 'grid', renditions)} alt={`${address} — photo ${index + 1}`} loading="lazy" decoding="async" {...imageGuards} />
              </button>
            ))}
          </div>
          {media.photos.length > GRID_PREVIEW && <div className="maison-more"><button type="button" className="maison-btn maison-btn-secondary" aria-expanded={allPhotos} onClick={() => setAllPhotos((value) => !value)}>{allPhotos ? 'Show fewer photos' : `Show all ${media.photos.length} photos`}</button></div>}
        </section>}

        {media.videos.length > 0 && <section className="maison-band" id="video" aria-label="Property video">
          <div className="maison-container">
            <Heading title="Walk through it" italic="on film." />
            <div className="maison-films">
              {media.videos.map((video, index) => <TemplateTourVideo key={video} className="maison-frame" url={video} title={`Property video ${index + 1}`} poster={data.videoPosterUrl || model.cover} autoplay={index === 0 && data.tourSettings.autoplay} />)}
            </div>
          </div>
        </section>}

        {model.hasTour && <section className="maison-container maison-section" id="tour" aria-label="Virtual tour">
          {media.hasProviders && <Public3dTourViewer sectionId="maison-3d" heading="Step inside, room by room." iguideInlineUrl={data.iguide.inlineUrl} iguideOpenUrl={data.iguide.openUrl} matterportUrl={data.matterportUrl} zillowUrl={data.zillowUrl} autoplay={data.tourSettings.autoplay} />}
          {media.embeds.map((embed) => (
            <div className="maison-embed" key={embed.id}>
              <div className="maison-embed-head"><h3>{embed.title}</h3><a className="maison-btn-ghost" href={embed.url} target="_blank" rel="noopener noreferrer" onClick={() => track('embed', embed.url)}>Open tour <ArrowUpRight aria-hidden="true" /></a></div>
              <TemplateTourVideo className="maison-frame" url={embed.url} title={embed.title} autoplay={data.tourSettings.autoplay} />
            </div>
          ))}
        </section>}

        {model.hasPlans && <section className="maison-container maison-section maison-plans" id="floorplans" aria-label="Floor plans">
          <Heading title="How it all" italic="fits together." />
          <FloorplanSection floorplans={media.floorplans} zillowUrl={media.zillowFloorplan} />
        </section>}

        <section className="maison-band" id="location" aria-labelledby="maison-location-heading">
          <div className={`maison-container maison-location${branding?.show_map ? '' : ' is-compact'}`}>
            <div>
              <p className="maison-eyebrow"><span>Location</span></p>
              <h2 id="maison-location-heading">{shoot.city ? <>Life in<br /><span className="maison-display-italic">{shoot.city}.</span></> : <>Where you<br /><span className="maison-display-italic">will find it.</span></>}</h2>
              {branding?.show_map && <MaisonAddress address={fullAddress} mapUrl={model.mapUrl} track={track} />}
            </div>
            {!branding?.show_map && <div><MaisonAddress address={fullAddress} mapUrl={model.mapUrl} track={track} /></div>}
            {branding?.show_map && <iframe className="maison-map" title={`Map of ${address}`} src={`https://maps.google.com/maps?q=${encodeURIComponent(fullAddress)}&output=embed`} loading="lazy" referrerPolicy="no-referrer" />}
          </div>
        </section>

        {hasContact && model.cover && <section className="maison-container maison-closing" aria-label="Arrange a viewing">
          <img src={publicTourImageSource(model.secondary || model.cover, 'web', renditions)} alt="" loading="lazy" {...imageGuards} />
          <div>
            <h2>See it<br /><span className="maison-display-italic">in person.</span></h2>
            <p>Talk to {shoot.client_name || 'the listing agent'} about a private viewing of {address}.</p>
            <a className="maison-btn maison-btn-light" href="#contact">Contact the agent</a>
          </div>
        </section>}
      </main>
      <footer className="maison-footer">
        <div className="maison-container">
          <div className="maison-footer-brand">
            <p className="maison-footer-mark">{address}</p>
            {locality && <p className="maison-display-italic">{locality}</p>}
          </div>
          <div className="maison-footer-meta">
            <p className="maison-num">{(branded && shoot.client_company) || 'Property tour'}</p>
            <a className="maison-btn-ghost" href="#maison-top">Back to top <ArrowRight aria-hidden="true" /></a>
          </div>
        </div>
      </footer>
      <PublicTourLightbox photos={media.photos} address={address} index={viewer.index} open={viewer.open} onOpenChange={viewer.setOpen} onIndexChange={viewer.setIndex} triggerRef={viewer.opener} theme="maison" />
    </div>
  );
}

export default MaisonTour;
