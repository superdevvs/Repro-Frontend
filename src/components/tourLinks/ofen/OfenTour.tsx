import { useState, type ReactNode } from 'react';
import { ArrowUp, ArrowUpRight, Box, Film, House, Images, LayoutPanelLeft, Mail, MapPin, Menu, Printer, Share2, X } from 'lucide-react';
import { TourContactNumbers } from '../TourContactNumbers';
import { FloorplanSection } from '../FloorplanSection';
import { Public3dTourViewer } from '../Public3dTourViewer';
import type { PublicTourData, PublicTourPhotoRenditions } from '../publicTourData';
import { PublicTourLightbox } from '../shared/PublicTourLightbox';
import { TemplateTourVideo } from '../shared/TemplateTourVideo';
import { preventTourImageDownloadGesture, publicTourImageSource, showMissingTourImage } from '../shared/publicTourImage';
import { usePhotoViewer, useTemplateTourModel, type TemplateTourModel } from '../shared/useTemplateTourModel';
import './ofen.css';

const MOSAIC_TILES = 4;
const GRID_PREVIEW = 9;
const imageGuards = { draggable: false, onContextMenu: preventTourImageDownloadGesture, onDragStart: preventTourImageDownloadGesture, onError: showMissingTourImage };
type Open = ReturnType<typeof usePhotoViewer>['show'];

function SectionHeading({ label, title, children }: { label: string; title: string; children?: ReactNode }) {
  return (
    <div className="ofen-section-head">
      <div>
        <p className="ofen-pill"><span className="ofen-dot" aria-hidden="true" />{label}</p>
        <h2>{title}</h2>
      </div>
      {children}
    </div>
  );
}

function OfenHeader({ model }: { model: TemplateTourModel }) {
  const { branding, branded, shoot, sections, menuOpen, setMenuOpen, hasContact, address } = model;
  return (
    <header className="ofen-header">
      <div className="ofen-container ofen-header-row">
        <a href="#ofen-top" className="ofen-brand" aria-label="Back to the top of the property tour">
          {branding?.logo ? <img src={branding.logo} alt={shoot?.client_company || 'Agent logo'} /> : <><span className="ofen-brand-mark" aria-hidden="true"><House /></span><span>{(branded && shoot?.client_company) || address}</span></>}
        </a>
        <nav className={`ofen-nav${menuOpen ? ' is-open' : ''}`} id="ofen-navigation" aria-label="Property sections">
          {sections.map((section) => <a key={section.id} href={`#${section.id}`} onClick={() => setMenuOpen(false)}>{section.label}</a>)}
        </nav>
        <div className="ofen-header-actions">
          {hasContact && <a className="ofen-button ofen-button-primary ofen-header-cta" href="#contact">Contact agent</a>}
          <button type="button" className="ofen-icon-button ofen-menu" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen} aria-controls="ofen-navigation" onClick={() => setMenuOpen((value) => !value)}>
            {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        </div>
      </div>
    </header>
  );
}

function OfenMosaic({ model, renditions, onOpen }: { model: TemplateTourModel; renditions: PublicTourPhotoRenditions; onOpen: Open }) {
  const { media: { photos }, coverIndex, address } = model;
  if (!photos.length) return null;
  const order = [coverIndex, ...photos.map((_, index) => index).filter((index) => index !== coverIndex)].slice(0, MOSAIC_TILES);
  return (
    <div className="ofen-mosaic" id="gallery" data-count={order.length}>
      <div className="ofen-mosaic-grid">
        {order.map((index, position) => (
          <button key={`${photos[index]}-${index}`} type="button" className="ofen-tile" aria-label={`Open photo ${index + 1} of ${photos.length}`} onClick={(event) => onOpen(event, index)}>
            <img src={publicTourImageSource(photos[index], position === 0 ? 'web' : 'grid', renditions)} alt={position === 0 ? `${address} — main photo` : `${address} — photo ${index + 1}`} loading={position === 0 ? 'eager' : 'lazy'} fetchPriority={position === 0 ? 'high' : undefined} decoding="async" {...imageGuards} />
          </button>
        ))}
      </div>
      {photos.length > 1 && <button type="button" className="ofen-all-photos" onClick={(event) => onOpen(event, 0)}>
        <Images aria-hidden="true" /><span>All {photos.length} photos</span>
      </button>}
    </div>
  );
}

/** Ofen's single-listing page as a one-page tour, driven only by the shoot's published data. */
export function OfenTour({ data }: { data: PublicTourData }) {
  const model = useTemplateTourModel(data);
  const { shoot, address, locality, fullAddress, property, facts, details, media, branding, hasContact, track, mailto } = model;
  const viewer = usePhotoViewer(data, media.photos);
  const [allPhotos, setAllPhotos] = useState(false);

  if (data.locked || !shoot) {
    return (
      <main className="ofen-tour ofen-unavailable">
        <span className="ofen-tile-icon" aria-hidden="true"><House /></span>
        <h1>{data.locked ? 'This tour is locked' : 'Property tour unavailable'}</h1>
        <p>{data.locked ? data.lockedMessage : 'Please check the property link and try again.'}</p>
      </main>
    );
  }

  const renditions = data.photoRenditions;
  const mlsNumber = property.mls_id ? String(property.mls_id) : '';
  const quickLinks = [
    ...(media.videos.length ? [{ id: 'video', label: 'Video', note: media.videos.length === 1 ? 'Property film' : `${media.videos.length} films`, icon: Film }] : []),
    ...(model.hasTour ? [{ id: 'tour', label: '3D tour', note: model.providerNames.join(' · '), icon: Box }] : []),
    ...(model.hasPlans ? [{ id: 'floorplans', label: 'Floor plans', note: media.floorplans.length ? `${media.floorplans.length} ${media.floorplans.length === 1 ? 'plan' : 'plans'}` : 'Interactive plan', icon: LayoutPanelLeft }] : []),
    ...(media.photos.length > MOSAIC_TILES ? [{ id: 'photos', label: 'Photos', note: `${media.photos.length} photographs`, icon: Images }] : []),
  ];
  const keyFacts: [string, ReactNode][] = [...facts.map(({ label, value }) => [label, value] as [string, ReactNode]), ...details.map(([label, value]) => [String(label), value] as [string, ReactNode])];
  const showAside = hasContact || quickLinks.length > 0;
  const hasStory = Boolean(property.description) || keyFacts.length > 0;

  return (
    <div className="ofen-tour" id="ofen-top">
      <a className="ofen-skip" href="#overview">Skip to property details</a>
      <OfenHeader model={model} />
      <main className="ofen-main">
        <div className="ofen-container ofen-intro">
          <div className="ofen-topbar">
            <p className="ofen-back"><MapPin aria-hidden="true" />{locality || 'Property tour'}</p>
            <div className="ofen-topbar-actions">
              <button type="button" className="ofen-button ofen-button-card" onClick={() => void model.share()}><Share2 aria-hidden="true" />Share</button>
              <button type="button" className="ofen-button ofen-button-card" onClick={() => window.print()}><Printer aria-hidden="true" />Print</button>
              <span role="status" className="ofen-status">{model.shareStatus}</span>
            </div>
          </div>
          <OfenMosaic model={model} renditions={renditions} onOpen={viewer.show} />
          <div className="ofen-title">
            <div>
              <h1>{address}</h1>
              <p className="ofen-meta">
                {locality && <span>{locality}</span>}
                {model.status.map((label, index) => <span key={label} className="ofen-chip"><span className={`ofen-dot${index === 0 ? ' is-leaf' : ''}`} aria-hidden="true" />{label}</span>)}
                {mlsNumber && <><i aria-hidden="true" /><span className="ofen-tabular">MLS #{mlsNumber}</span></>}
              </p>
            </div>
            {model.price && <div className="ofen-price"><p className="ofen-tabular">{model.price}</p>{model.pricePerSqft && <p>{model.pricePerSqft}</p>}</div>}
          </div>
        </div>

        {(hasStory || showAside) && <section className={`ofen-container ofen-detail${showAside && hasStory ? '' : ' is-single'}`} id={model.hasAbout ? 'overview' : undefined} aria-label="About this home">
          {hasStory && <div className="ofen-detail-main">
            <h2 className="ofen-subheading">About this home</h2>
            {property.description && <p className="ofen-lede">{property.description}</p>}
            {keyFacts.length > 0 && <dl className="ofen-facts">
              {keyFacts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd className="ofen-tabular">{value}</dd></div>)}
            </dl>}
          </div>}
          {showAside && <aside className="ofen-aside">
            {hasContact && <div className="ofen-card ofen-agent" id="contact">
              <p className="ofen-overline">Listing agent</p>
              <div className="ofen-agent-row">
                {shoot.client_avatar && <img src={shoot.client_avatar} alt="" loading="lazy" onError={(event) => { event.currentTarget.style.display = 'none'; }} />}
                <div><h3>{shoot.client_name || 'Listing contact'}</h3>{shoot.client_company && <p>{shoot.client_company}</p>}</div>
              </div>
              {data.tourSettings.realtor_info && <p className="ofen-agent-note">{data.tourSettings.realtor_info}</p>}
              <div className="ofen-agent-actions">
                {mailto && <a className="ofen-button ofen-button-primary ofen-button-lg" href={mailto} onClick={() => track('email', `mailto:${shoot.client_email}`)}><Mail aria-hidden="true" />Email contact</a>}
                <TourContactNumbers source={shoot} className="ofen-phones" onPhoneClick={(phone) => track('phone', `tel:${phone}`)} />
              </div>
            </div>}
            {quickLinks.length > 0 && <div className="ofen-card ofen-jump">
              <p className="ofen-overline">In this tour</p>
              <ul>{quickLinks.map(({ id, label, note, icon: Icon }) => (
                <li key={id}><a href={`#${id}`}><span className="ofen-tile-icon" aria-hidden="true"><Icon /></span><span><strong>{label}</strong>{note && <small>{note}</small>}</span><ArrowUpRight aria-hidden="true" className="ofen-jump-arrow" /></a></li>
              ))}</ul>
            </div>}
          </aside>}
        </section>}

        {media.videos.length > 0 && <section className="ofen-container" id="video" aria-label="Property video">
          <SectionHeading label="Video" title="Walk through it before you visit." />
          <div className="ofen-frames">
            {media.videos.map((video, index) => <TemplateTourVideo key={video} className="ofen-frame" url={video} title={`Property video ${index + 1}`} poster={data.videoPosterUrl || model.cover} autoplay={index === 0 && data.tourSettings.autoplay} />)}
          </div>
        </section>}

        {model.hasTour && <section className="ofen-container" id="tour" aria-label="3D tour">
          <SectionHeading label="3D tour" title="Step inside, room by room." />
          {media.hasProviders && <Public3dTourViewer className="ofen-viewer" sectionId="ofen-3d" heading="Interactive walkthrough" iguideInlineUrl={data.iguide.inlineUrl} iguideOpenUrl={data.iguide.openUrl} matterportUrl={data.matterportUrl} zillowUrl={data.zillowUrl} autoplay={data.tourSettings.autoplay} />}
          {media.embeds.map((embed) => (
            <div className="ofen-embed" key={embed.id}>
              <div className="ofen-embed-head"><h3>{embed.title}</h3><a className="ofen-link" href={embed.url} target="_blank" rel="noopener noreferrer" onClick={() => track('embed', embed.url)}>Open tour <ArrowUpRight aria-hidden="true" /></a></div>
              <TemplateTourVideo className="ofen-frame" url={embed.url} title={embed.title} autoplay={data.tourSettings.autoplay} />
            </div>
          ))}
        </section>}

        {model.hasPlans && <section className="ofen-container ofen-plans" id="floorplans" aria-label="Floor plans">
          <SectionHeading label="Floor plans" title="See how the rooms connect." />
          <FloorplanSection floorplans={media.floorplans} zillowUrl={media.zillowFloorplan} />
        </section>}

        {media.photos.length > MOSAIC_TILES && <section className="ofen-container" id="photos" aria-label="All photos">
          <SectionHeading label="Photos" title="Every room, in the light it gets." />
          <ul className="ofen-photo-grid">
            {(allPhotos ? media.photos : media.photos.slice(0, GRID_PREVIEW)).map((photo, index) => (
              <li key={`${photo}-${index}`}><button type="button" className="ofen-tile" aria-label={`Open photo ${index + 1} of ${media.photos.length}`} onClick={(event) => viewer.show(event, index)}>
                <img src={publicTourImageSource(photo, 'grid', renditions)} alt={`${address} — photo ${index + 1}`} loading="lazy" decoding="async" {...imageGuards} />
              </button></li>
            ))}
          </ul>
          {media.photos.length > GRID_PREVIEW && <div className="ofen-more"><button type="button" className="ofen-button ofen-button-outline" aria-expanded={allPhotos} onClick={() => setAllPhotos((value) => !value)}>{allPhotos ? 'Show fewer photos' : `Show all ${media.photos.length} photos`}</button></div>}
        </section>}

        <section className="ofen-container" id="location" aria-label="Location">
          <SectionHeading label="The area" title={shoot.city ? `Where it stands in ${shoot.city}.` : 'Where it stands.'} />
          <div className={`ofen-location${branding?.show_map ? ' has-map' : ''}`}>
            {branding?.show_map && <div className="ofen-card ofen-map"><iframe title={`Map of ${address}`} src={`https://maps.google.com/maps?q=${encodeURIComponent(fullAddress)}&output=embed`} loading="lazy" referrerPolicy="no-referrer" /></div>}
            <div className="ofen-card ofen-place">
              <span className="ofen-tile-icon" aria-hidden="true"><MapPin /></span>
              <div><h3>{address}</h3>{locality && <p>{locality}</p>}</div>
              <a className="ofen-link" href={model.mapUrl} target="_blank" rel="noreferrer" onClick={() => track('map', model.mapUrl)}>Open in Maps <ArrowUpRight aria-hidden="true" /></a>
            </div>
          </div>
        </section>

        {hasContact && <section className="ofen-container ofen-book" aria-label="Arrange a viewing">
          <div className="ofen-slab">
            <p className="ofen-pill ofen-pill-inverse"><span className="ofen-dot" aria-hidden="true" />Viewings</p>
            <h2>Want to see it in person?</h2>
            <p>{shoot.client_name ? `${shoot.client_name} can` : 'The listing agent can'} arrange a private viewing of {address}.</p>
            <div className="ofen-slab-actions">
              {mailto && <a className="ofen-button ofen-button-inverse ofen-button-lg" href={mailto} onClick={() => track('email', `mailto:${shoot.client_email}`)}>Email the agent</a>}
              <a className="ofen-button ofen-button-ghost-inverse ofen-button-lg" href="#contact">Agent details</a>
            </div>
          </div>
          {model.secondary && <img src={publicTourImageSource(model.secondary, 'web', renditions)} alt="" loading="lazy" {...imageGuards} />}
        </section>}
      </main>
      <footer className="ofen-footer">
        <div className="ofen-container">
          <div className="ofen-footer-grid">
            <div>
              <p className="ofen-footer-tagline">{address}</p>
              {locality && <p className="ofen-footer-locality">{locality}</p>}
            </div>
            <nav aria-label="Tour sections in footer"><ul>{model.sections.map((section) => <li key={section.id}><a href={`#${section.id}`}>{section.label}</a></li>)}</ul></nav>
          </div>
          <div className="ofen-footer-bar">
            <p>{(model.branded && shoot.client_company) || 'Property tour'}</p>
            <a href="#ofen-top">Back to top <ArrowUp aria-hidden="true" /></a>
          </div>
        </div>
      </footer>
      <PublicTourLightbox photos={media.photos} address={address} index={viewer.index} open={viewer.open} onOpenChange={viewer.setOpen} onIndexChange={viewer.setIndex} triggerRef={viewer.opener} theme="ofen" />
    </div>
  );
}

export default OfenTour;
