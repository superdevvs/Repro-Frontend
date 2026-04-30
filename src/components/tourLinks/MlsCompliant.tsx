import React, { useEffect, useMemo, useState } from "react";
import { API_BASE_URL } from "@/config/env";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin, BedDouble, Bath, Maximize, Download, X, ChevronLeft, ChevronRight,
  Link2, ExternalLink, Car, Tag,
} from "lucide-react";
import { NeoTour } from "./NeoTour";
import { trackPageView, trackMediaView, trackLinkClick, trackDownload } from '@/lib/tourTracking';
import { restrictedVideoProps, sanitizeTourEmbedHtml } from './videoControlRestrictions';

interface ShootData {
  id: number;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
}

interface PropertyDetails {
  beds?: number;
  bedrooms?: number;
  baths?: number;
  bathrooms?: number;
  sqft?: number;
  description?: string;
  garage_cars?: number;
  garage_sqft?: number;
  building?: Array<{ bedrooms?: number; baths?: number; fullBaths?: number; halfBaths?: number }>;
  areas?: Array<{ areaSquareFeet?: number; type?: string }>;
  garages?: Array<{ carCount?: number; areaSquareFeet?: number }>;
}

export function MlsCompliant() {
  const [photos, setPhotos] = useState<string[]>([]);
  const [videos, setVideos] = useState<string[]>([]);
  const [videoLink, setVideoLink] = useState<string | null>(null);
  const [shoot, setShoot] = useState<ShootData | null>(null);
  const [propertyDetails, setPropertyDetails] = useState<PropertyDetails | null>(null);
  const [showGarage, setShowGarage] = useState(false);
  const [floorplans, setFloorplans] = useState<string[]>([]);
  const [matterportUrl, setMatterportUrl] = useState<string | null>(null);
  const [iguideUrl, setIguideUrl] = useState<string | null>(null);
  const [embeds, setEmbeds] = useState<Array<{ id: string; title: string; branded: string; mls: string }>>([]);
  const [featuredEmbedId, setFeaturedEmbedId] = useState<string>('');
  const [tourSettings, setTourSettings] = useState({ autoplay: false });
  const [loading, setLoading] = useState(true);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [tourStyle, setTourStyle] = useState<string>('default');
  const [heroIndex, setHeroIndex] = useState(0);
  const [lockedMessage, setLockedMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const shootId = params.get('shootId');
        const address = params.get('address');
        const city = params.get('city');
        const state = params.get('state');
        const zip = params.get('zip');

        const hasAddressParams = Boolean(address && city && state);
        if (!shootId && !hasAddressParams) { setLoading(false); return; }

        const query = new URLSearchParams();
        if (hasAddressParams) {
          query.set('address', address as string);
          query.set('city', city as string);
          query.set('state', state as string);
          if (zip) query.set('zip', zip);
        }

        const endpoint = query.toString()
          ? `${API_BASE_URL}/api/public/shoots/mls?${query.toString()}`
          : `${API_BASE_URL}/api/public/shoots/${shootId}/mls`;

        const cacheBuster = new Date().getTime();
        const separator = endpoint.includes('?') ? '&' : '?';
        const res = await fetch(`${endpoint}${separator}t=${cacheBuster}`);
        const data = await res.json();

        if (data?.locked) {
          setLockedMessage(data.message || 'Payment required to unlock this tour.');
          if (data?.shoot) setShoot(data.shoot);
          return;
        }

        setPhotos(Array.isArray(data?.photos) ? data.photos : []);
        setVideos(Array.isArray(data?.videos) ? data.videos : []);
        if (data?.video_link || data?.tour_links?.video_link) setVideoLink(data.video_link || data.tour_links?.video_link);
        if (data?.shoot) setShoot(data.shoot);
        if (data?.property_details) setPropertyDetails(data.property_details);
        setShowGarage(Boolean(data?.show_garage));
        if (data?.matterport_url) setMatterportUrl(data.matterport_url);
        if (data?.iguide_tour_url || data?.iguide_url) setIguideUrl(data.iguide_tour_url || data.iguide_url);
        if (data?.floorplans || data?.iguide_floorplans) {
          const fps = data.floorplans || data.iguide_floorplans || [];
          setFloorplans(Array.isArray(fps) ? fps.map((f: any) => typeof f === 'string' ? f : f.url || f.path) : []);
        }
        const style = data?.tour_style || data?.tour_links?.tour_style || 'default';
        setTourStyle(style);

        const rawEmbeds = Array.isArray(data?.tour_links?.embeds) ? data.tour_links.embeds : [];
        const embedKey = shootId || [address, city, state, zip].filter(Boolean).join('-');
        setEmbeds(rawEmbeds.map((embed: any, index: number) => ({
          id: embed?.id || `embed-${embedKey}-${index}`,
          title: embed?.title || `Embed ${index + 1}`,
          branded: embed?.branded || embed?.branded_embed || embed?.url || '',
          mls: embed?.mls || embed?.mls_embed || '',
        })));
        setFeaturedEmbedId(data?.tour_links?.featured_embed_id || data?.tour_links?.featured_embed || '');
        setTourSettings({ autoplay: Boolean(data?.tour_links?.autoplay) });
        if (data?.shoot?.id) trackPageView(data.shoot.id, 'mls');
      } catch (err) {
        console.error('Error fetching tour data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Ken Burns slideshow
  useEffect(() => {
    if (photos.length <= 1) return;
    const timer = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % Math.min(photos.length, 10));
    }, 6000);
    return () => clearInterval(timer);
  }, [photos.length]);

  const fullAddress = [shoot?.address, shoot?.city, shoot?.state, shoot?.zip].filter(Boolean).join(', ');

  // Derived values
  const getBeds = () => {
    const pd = propertyDetails;
    return pd?.beds || pd?.bedrooms || pd?.building?.[0]?.bedrooms || null;
  };
  const getBaths = () => {
    const pd = propertyDetails;
    if (pd?.baths) return pd.baths;
    if (pd?.bathrooms) return pd.bathrooms;
    const b = pd?.building?.[0];
    if (!b) return null;
    const full = b.fullBaths ?? 0;
    const half = (b.halfBaths ?? 0) * 0.5;
    const total = full + half;
    return total || b.baths || null;
  };
  const getSqft = () => {
    if (propertyDetails?.sqft) return propertyDetails.sqft;
    const area = propertyDetails?.areas?.find(a => a.type?.includes('Living') || a.type?.includes('Finished') || a.type?.includes('Building'));
    return area?.areaSquareFeet || null;
  };
  const getGarageCars = () => {
    if (!showGarage) return null;
    if (propertyDetails?.garage_cars) return propertyDetails.garage_cars;
    const garages = propertyDetails?.garages;
    if (!garages?.length) return null;
    let total = 0;
    garages.forEach(g => { total += g.carCount || 0; });
    return total || garages.length;
  };

  const beds = getBeds();
  const baths = getBaths();
  const sqft = getSqft();
  const garageCars = getGarageCars();
  const hasStats = beds || baths || sqft || garageCars;

  const orderedEmbeds = useMemo(() => {
    if (!embeds.length) return [];
    const featured = embeds.find((e) => e.id === featuredEmbedId);
    if (!featured) return embeds;
    return [featured, ...embeds.filter((e) => e.id !== featuredEmbedId)];
  }, [embeds, featuredEmbedId]);

  const hasVideo = !!videoLink;

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
    if (shoot?.id) trackMediaView(shoot.id, 'mls', index, photos[index]);
  };
  const navigateLightbox = (direction: "prev" | "next") => {
    setLightboxIndex((prev) =>
      direction === "prev" ? (prev === 0 ? photos.length - 1 : prev - 1) : (prev === photos.length - 1 ? 0 : prev + 1)
    );
  };

  // Embed helpers
  const getEmbedUrl = (url: string): string | null => {
    if (!url) return null;
    const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    return url;
  };
  const appendAutoplayParam = (url: string) => {
    if (!tourSettings.autoplay || !url) return url;
    if (url.includes('autoplay=')) return url;
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}autoplay=1&mute=1`;
  };
  const applyAutoplayToEmbedHtml = (html: string) => {
    return sanitizeTourEmbedHtml(html, appendAutoplayParam);
  };
  const isEmbedHtml = (value: string) => value.includes('<') && value.includes('>');
  const getEmbedValue = (embed: { branded: string; mls: string }) => embed.mls || embed.branded || '';

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading property tour...</p>
        </div>
      </div>
    );
  }

  if (lockedMessage) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background px-6">
        <div className="max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-sm">
          <Badge className="mb-4">Tour Locked</Badge>
          <h1 className="text-2xl font-semibold tracking-tight">{shoot?.address || 'This tour is locked'}</h1>
          <p className="mt-3 text-sm text-muted-foreground">{lockedMessage}</p>
        </div>
      </div>
    );
  }

  if (tourStyle === 'neo') {
    return <NeoTour />;
  }

  return (
    <div className="fixed inset-0 overflow-auto bg-background text-foreground font-sans">
      {/* Hero — Ken Burns slideshow with padding */}
      <div className="p-2.5">
        <div className="rounded-2xl overflow-hidden relative" style={{ height: 'calc(100vh - 20px)', minHeight: '600px' }}>
          {photos.length > 0 ? (
            <AnimatePresence mode="sync">
              <motion.img
                key={heroIndex}
                src={photos[heroIndex % photos.length]}
                alt="Hero"
                className="absolute inset-0 w-full h-full object-cover"
                initial={{ opacity: 0, scale: 1.05 }}
                animate={{ opacity: 1, scale: 1.15 }}
                exit={{ opacity: 0 }}
                transition={{ opacity: { duration: 1.2 }, scale: { duration: 8, ease: 'linear' } }}
              />
            </AnimatePresence>
          ) : (
            <div className="absolute inset-0 bg-muted flex items-center justify-center">
              <span className="text-muted-foreground">No Image Available</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent z-[1]" />

          {/* Floating nav pill */}
          <nav className="absolute top-3 left-3 right-3 md:left-auto md:top-5 md:right-5 z-10 flex items-center gap-0.5 md:gap-1 bg-white/15 backdrop-blur-md rounded-full px-1.5 md:px-2 py-1 md:py-1.5 border border-white/20 overflow-x-auto no-scrollbar">
            {propertyDetails?.description && (
              <a href="#about" className="px-2.5 md:px-4 py-1 md:py-1.5 text-xs md:text-sm font-medium bg-white text-black rounded-full transition-colors whitespace-nowrap">About</a>
            )}
            {photos.length > 0 && (
              <a href="#photos" className="px-2.5 md:px-4 py-1 md:py-1.5 text-xs md:text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors whitespace-nowrap">Photos</a>
            )}
            {fullAddress && (
              <a href="#map" className="px-2.5 md:px-4 py-1 md:py-1.5 text-xs md:text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors whitespace-nowrap">Map</a>
            )}
            {hasVideo && (
              <a href="#video" className="px-2.5 md:px-4 py-1 md:py-1.5 text-xs md:text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors whitespace-nowrap">Videos</a>
            )}
            {(matterportUrl || iguideUrl) && (
              <a href="#tour" className="px-2.5 md:px-4 py-1 md:py-1.5 text-xs md:text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors whitespace-nowrap">3D Tour</a>
            )}
            {floorplans.length > 0 && (
              <a href="#floorplan" className="px-2.5 md:px-4 py-1 md:py-1.5 text-xs md:text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors whitespace-nowrap">Floor Plans</a>
            )}
          </nav>

          {/* Address on hero */}
          <div className="absolute bottom-4 md:bottom-10 left-0 right-0 px-4 md:px-12 z-[2]">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <h1 className="text-2xl md:text-5xl font-extrabold text-white tracking-tight">
                {shoot?.address || 'Property Tour'}
              </h1>
              <div className="flex items-center gap-1.5 md:gap-2 text-white/80 mt-1 md:mt-2">
                <MapPin className="w-3.5 h-3.5 md:w-4 md:h-4" />
                <span className="text-xs md:text-sm font-medium">{shoot?.city}{shoot?.state ? `, ${shoot.state}` : ''} {shoot?.zip}</span>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Stats Row — dividers */}
      {hasStats && (() => {
        const statItems: { icon: React.ReactNode; label: string; value: string }[] = [];
        if (beds != null) statItems.push({ icon: <BedDouble className="w-7 h-7 text-muted-foreground" />, label: 'Beds', value: String(beds) });
        if (baths != null) statItems.push({ icon: <Bath className="w-7 h-7 text-muted-foreground" />, label: 'Baths', value: String(baths) });
        if (garageCars != null) statItems.push({ icon: <Car className="w-7 h-7 text-muted-foreground" />, label: 'Garage', value: `${garageCars} Cars` });
        if (sqft != null) statItems.push({ icon: <Maximize className="w-7 h-7 text-muted-foreground" />, label: 'Square Feet', value: sqft.toLocaleString() });
        return (
          <section className="max-w-6xl mx-auto px-4 md:px-6 mt-6 md:mt-8">
            <div className="grid grid-cols-3 md:flex md:items-stretch border border-border/40 rounded-2xl bg-card overflow-hidden divide-x divide-border/40">
              {statItems.map((item, i) => (
                <div key={i} className={cn("flex flex-col items-center gap-1 md:gap-1.5 py-3 md:py-5 px-1 md:px-2 md:flex-1", i >= 3 && "border-t border-border/40 md:border-t-0")}>
                  <span className="[&>svg]:w-5 [&>svg]:h-5 md:[&>svg]:w-7 md:[&>svg]:h-7">{item.icon}</span>
                  <span className="text-[8px] md:text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{item.label}</span>
                  <span className="text-xs md:text-lg font-extrabold text-foreground">{item.value}</span>
                </div>
              ))}
            </div>
          </section>
        );
      })()}

      {/* About */}
      {propertyDetails?.description && (
        <section id="about" className="max-w-6xl mx-auto px-6 mt-10">
          <h2 className="text-3xl md:text-4xl font-extrabold text-foreground mb-4">About</h2>
          <p className="text-muted-foreground leading-relaxed whitespace-pre-line text-sm md:text-base">{propertyDetails.description}</p>
        </section>
      )}

      {/* Photo Gallery */}
      {photos.length > 0 && (
        <section id="photos" className="max-w-6xl mx-auto px-6 mt-10">
          <h2 className="text-2xl font-bold text-foreground mb-6">Gallery</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {photos.map((photo, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: Math.min(index * 0.03, 0.3), duration: 0.4 }}
                className={cn(
                  "relative group cursor-pointer overflow-hidden rounded-xl border border-border/30",
                  index === 0 && "col-span-2 row-span-2"
                )}
                onClick={() => openLightbox(index)}
              >
                <img src={photo} alt={`Photo ${index + 1}`} className="w-full h-full object-cover aspect-square group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Embeds */}
      {orderedEmbeds.length > 0 && (
        <section id="embeds" className="max-w-6xl mx-auto px-6 mt-10">
          <h2 className="text-2xl font-bold text-foreground mb-6">Virtual Tours</h2>
          <div className="grid gap-6">
            {orderedEmbeds.map((embed, index) => {
              const value = getEmbedValue(embed);
              if (!value) return null;
              return (
                <div key={embed.id} className="rounded-2xl border border-border/40 bg-card overflow-hidden shadow-sm">
                  <div className="flex items-center justify-between px-5 py-3 border-b border-border/40">
                    <div className="flex items-center gap-2">
                      <Link2 className="w-4 h-4 text-muted-foreground" />
                      <h3 className="font-semibold text-sm">{embed.title || `Embed ${index + 1}`}</h3>
                      {featuredEmbedId === embed.id && <Badge variant="outline" className="text-[10px]">Featured</Badge>}
                    </div>
                    {!isEmbedHtml(value) && (
                      <Button variant="ghost" size="sm" asChild>
                        <a href={value} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5" /></a>
                      </Button>
                    )}
                  </div>
                  <div className="p-4">
                    {isEmbedHtml(value) ? (
                      <div className="w-full [&_iframe]:w-full [&_iframe]:min-h-[360px] [&_iframe]:rounded-xl [&_iframe]:border [&_iframe]:border-border/40" dangerouslySetInnerHTML={{ __html: applyAutoplayToEmbedHtml(value) }} />
                    ) : (
                      <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-border/40">
                        <iframe src={appendAutoplayParam(value)} className="w-full h-full border-0" allow="fullscreen; clipboard-write; autoplay" allowFullScreen title={embed.title || `Embed ${index + 1}`} />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Video */}
      {hasVideo && (
        <section id="video" className="max-w-6xl mx-auto px-6 mt-10">
          <h2 className="text-2xl font-bold text-foreground mb-6">Video Tour</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {videoLink && (
              <div className="relative aspect-video rounded-2xl overflow-hidden border border-border/40 shadow-md col-span-full">
                {getEmbedUrl(videoLink)?.includes('youtube.com') || getEmbedUrl(videoLink)?.includes('vimeo.com') ? (
                  <iframe
                    src={`${getEmbedUrl(videoLink) || ''}${tourSettings.autoplay ? (getEmbedUrl(videoLink)?.includes('?') ? '&' : '?') + 'autoplay=1&mute=1' : ''}`}
                    className="w-full h-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope"
                    allowFullScreen
                    title="Video Tour"
                  />
                ) : (
                  <video src={videoLink} controls {...restrictedVideoProps} autoPlay={tourSettings.autoplay} muted={tourSettings.autoplay} className="w-full h-full object-cover" poster={photos[0]} />
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* 3D Tour */}
      {(matterportUrl || iguideUrl) && (
        <section id="tour" className="max-w-6xl mx-auto px-6 mt-10">
          <h2 className="text-2xl font-bold text-foreground mb-6">3D Tour</h2>
          <div className="relative aspect-video rounded-2xl overflow-hidden border border-border/40 shadow-lg">
            <iframe src={appendAutoplayParam(matterportUrl || iguideUrl || '')} className="w-full h-full border-0" allow="fullscreen; vr; autoplay" allowFullScreen title="3D Tour" />
          </div>
        </section>
      )}

      {/* Floor Plans */}
      {floorplans.length > 0 && (
        <section id="floorplan" className="max-w-6xl mx-auto px-6 mt-10 mb-12">
          <h2 className="text-2xl font-bold text-foreground mb-6">Floor Plans</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {floorplans.map((fp, index) => (
              <div key={index} className="rounded-2xl overflow-hidden bg-card border border-border/40 p-6 flex flex-col shadow-sm">
                <h3 className="font-semibold mb-3">Level {index + 1}</h3>
                <div className="flex-1 flex items-center justify-center min-h-[200px]">
                  <img src={fp} alt={`Floor Plan ${index + 1}`} className="max-w-full max-h-[300px] object-contain" />
                </div>
                <Button variant="outline" className="mt-4 rounded-full w-full" asChild>
                  <a href={fp} download target="_blank" rel="noopener noreferrer"><Download className="w-4 h-4 mr-2" />Download</a>
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Map */}
      {fullAddress && (
        <section id="map" className="max-w-6xl mx-auto px-6 mt-10">
          <h2 className="text-2xl font-bold text-foreground mb-6">Location</h2>
          <div className="rounded-2xl overflow-hidden border border-border/40 shadow-lg h-[350px]">
            <iframe
              className="w-full h-full border-0"
              src={`https://www.google.com/maps/embed/v1/place?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&q=${encodeURIComponent(fullAddress)}`}
              allowFullScreen
              loading="lazy"
              title="Property Location"
            />
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="py-6 px-6 mt-10 border-t border-border/40 bg-muted/20">
        <div className="max-w-6xl mx-auto flex flex-col items-center justify-center">
          <p className="text-muted-foreground text-xs">&copy; {new Date().getFullYear()} R/E Pro Photos. All Rights Reserved.</p>
        </div>
      </footer>

      {/* Lightbox */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-none shadow-none sm:rounded-none overflow-hidden">
          <div className="relative w-full h-full flex items-center justify-center min-h-[80vh]">
            <Button variant="ghost" size="icon" className="absolute top-4 right-4 z-50 rounded-full bg-white/10 hover:bg-white/20 text-white" onClick={() => setLightboxOpen(false)}>
              <X className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" className="absolute left-4 top-1/2 -translate-y-1/2 z-50 rounded-full bg-white/10 hover:bg-white/20 text-white h-12 w-12" onClick={() => navigateLightbox("prev")}>
              <ChevronLeft className="w-8 h-8" />
            </Button>
            <img src={photos[lightboxIndex]} alt={`Photo ${lightboxIndex + 1}`} className="max-w-full max-h-[90vh] object-contain" />
            <Button variant="ghost" size="icon" className="absolute right-4 top-1/2 -translate-y-1/2 z-50 rounded-full bg-white/10 hover:bg-white/20 text-white h-12 w-12" onClick={() => navigateLightbox("next")}>
              <ChevronRight className="w-8 h-8" />
            </Button>
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/50 rounded-full backdrop-blur-sm">
              <span className="text-white text-sm font-medium">{lightboxIndex + 1} / {photos.length}</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
