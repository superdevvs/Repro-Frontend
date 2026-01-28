import React, { useEffect, useMemo, useRef, useState } from "react";
import { API_BASE_URL } from "@/config/env";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { motion, useScroll, useTransform, useMotionValueEvent } from "framer-motion";
import {
  MapPin, BedDouble, Bath, Maximize, ChevronDown, Share2, Heart, X, 
  ChevronLeft, ChevronRight, Video, Layers, FileText, Mail, Phone, 
  User, Thermometer, Wind, Sun, Cloud, CloudRain, Snowflake, Droplets, Link2, ExternalLink, Users
} from "lucide-react";

interface ShootData {
  id: number;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  client_name?: string;
  client_company?: string;
  client_email?: string;
  client_phone?: string;
}

interface PropertyDetails {
  beds?: number;
  baths?: number;
  sqft?: number;
  year_built?: number;
  price?: string;
  description?: string;
  building?: Array<{ bedrooms?: number; baths?: number }>;
  areas?: Array<{ areaSquareFeet?: number; type?: string }>;
}

interface WeatherInfo {
  temperature?: number | string;
  description?: string;
  icon?: string;
  windSpeed?: number | string;
  humidity?: number | string;
}

type SectionId = 'header' | 'gallery' | 'details' | 'embeds' | 'video' | 'contact';

export function NeoTour() {
  const [photos, setPhotos] = useState<string[]>([]);
  const [videos, setVideos] = useState<string[]>([]);
  const [videoLink, setVideoLink] = useState<string | null>(null);
  const [shoot, setShoot] = useState<ShootData | null>(null);
  const [propertyDetails, setPropertyDetails] = useState<PropertyDetails | null>(null);
  const [floorplans, setFloorplans] = useState<string[]>([]);
  const [matterportUrl, setMatterportUrl] = useState<string | null>(null);
  const [iguideUrl, setIguideUrl] = useState<string | null>(null);
  const [embeds, setEmbeds] = useState<Array<{ id: string; title: string; branded: string; mls: string }>>([]);
  const [featuredEmbedId, setFeaturedEmbedId] = useState<string>('');
  const [tourSettings, setTourSettings] = useState({
    header_position: 'center',
    tour_version: 'standard',
    realtor_info: '',
    autoplay: false,
  });
  const [loading, setLoading] = useState(true);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [activeSection, setActiveSection] = useState<SectionId>('header');
  const [liked, setLiked] = useState(false);
  const [weather, setWeather] = useState<WeatherInfo | null>(null);

  const headerRef = useRef<HTMLDivElement>(null);
  const galleryRef = useRef<HTMLDivElement>(null);
  const detailsRef = useRef<HTMLDivElement>(null);
  const embedsRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLDivElement>(null);
  const contactRef = useRef<HTMLDivElement>(null);
  
  const { scrollY } = useScroll();
  const [scrollProgress, setScrollProgress] = useState(0);

  // Track scroll position to update active section and overlay cards
  useMotionValueEvent(scrollY, "change", (latest) => {
    setScrollProgress(latest);
    
    const windowHeight = window.innerHeight;
    const sections = [
      { id: 'header' as SectionId, ref: headerRef },
      { id: 'gallery' as SectionId, ref: galleryRef },
      { id: 'details' as SectionId, ref: detailsRef },
      { id: 'embeds' as SectionId, ref: embedsRef },
      { id: 'video' as SectionId, ref: videoRef },
      { id: 'contact' as SectionId, ref: contactRef },
    ];

    for (let i = sections.length - 1; i >= 0; i--) {
      const section = sections[i];
      if (section.ref.current) {
        const rect = section.ref.current.getBoundingClientRect();
        if (rect.top <= windowHeight * 0.3) {
          setActiveSection(section.id);
          break;
        }
      }
    }
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const shootId = params.get('shootId');
        if (!shootId) { setLoading(false); return; }
        
        // Determine which endpoint to use based on current route
        const path = window.location.pathname;
        let endpoint = 'g-mls';
        if (path.includes('/branded')) {
          endpoint = 'branded';
        } else if (path.includes('/mls')) {
          endpoint = 'mls';
        }
        
        // Add cache-busting parameter to ensure fresh data
        const cacheBuster = new Date().getTime();
        const res = await fetch(`${API_BASE_URL}/api/public/shoots/${shootId}/${endpoint}?t=${cacheBuster}`);
        const data = await res.json();
        
        setPhotos(Array.isArray(data?.photos) ? data.photos : []);
        setVideos(Array.isArray(data?.videos) ? data.videos : []);
        if (data?.video_link || data?.tour_links?.video_link) setVideoLink(data.video_link || data.tour_links?.video_link);
        if (data?.shoot) setShoot(data.shoot);
        if (data?.property_details) setPropertyDetails(data.property_details);
        if (data?.matterport_url) setMatterportUrl(data.matterport_url);
        if (data?.iguide_tour_url || data?.iguide_url) setIguideUrl(data.iguide_tour_url || data.iguide_url);
        if (data?.floorplans || data?.iguide_floorplans) {
          const fps = data.floorplans || data.iguide_floorplans || [];
          setFloorplans(Array.isArray(fps) ? fps.map((f: any) => typeof f === 'string' ? f : f.url || f.path) : []);
        }

        const rawEmbeds = Array.isArray(data?.tour_links?.embeds) ? data.tour_links.embeds : [];
        const normalizedEmbeds = rawEmbeds.map((embed: any, index: number) => ({
          id: embed?.id || `embed-${shootId}-${index}`,
          title: embed?.title || `Embed ${index + 1}`,
          branded: embed?.branded || embed?.branded_embed || embed?.url || '',
          mls: embed?.mls || embed?.mls_embed || '',
        }));
        setEmbeds(normalizedEmbeds);
        setFeaturedEmbedId(data?.tour_links?.featured_embed_id || data?.tour_links?.featured_embed || '');
        setTourSettings({
          header_position: data?.tour_links?.header_position || 'center',
          tour_version: data?.tour_links?.tour_version || 'standard',
          realtor_info: data?.tour_links?.realtor_info || '',
          autoplay: Boolean(data?.tour_links?.autoplay),
        });
        
        // Fetch weather if available
        if (data?.weather) {
          setWeather(data.weather);
        }
      } catch (err) {
        console.error('Error fetching tour data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const getBeds = () => propertyDetails?.beds || propertyDetails?.building?.[0]?.bedrooms || null;
  const getBaths = () => propertyDetails?.baths || propertyDetails?.building?.[0]?.baths || null;
  const getSqft = () => {
    if (propertyDetails?.sqft) return propertyDetails.sqft;
    const area = propertyDetails?.areas?.find(a => a.type?.includes('Finished') || a.type?.includes('Building'));
    return area?.areaSquareFeet || null;
  };

  const scrollToSection = (id: SectionId) => {
    setActiveSection(id);
    const refs: Record<SectionId, React.RefObject<HTMLDivElement>> = {
      header: headerRef,
      gallery: galleryRef,
      details: detailsRef,
      embeds: embedsRef,
      video: videoRef,
      contact: contactRef,
    };
    refs[id].current?.scrollIntoView({ behavior: "smooth" });
  };

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const navigateLightbox = (direction: "prev" | "next") => {
    if (direction === "prev") {
      setLightboxIndex((prev) => (prev === 0 ? photos.length - 1 : prev - 1));
    } else {
      setLightboxIndex((prev) => (prev === photos.length - 1 ? 0 : prev + 1));
    }
  };

  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const beds = getBeds();
  const baths = getBaths();
  const sqft = getSqft();
  const orderedEmbeds = useMemo(() => {
    if (!embeds.length) return [];
    const featured = embeds.find((embed) => embed.id === featuredEmbedId);
    if (!featured) return embeds;
    return [featured, ...embeds.filter((embed) => embed.id !== featuredEmbedId)];
  }, [embeds, featuredEmbedId]);
  const heroAlignment = tourSettings.header_position === 'left'
    ? 'items-start text-left'
    : tourSettings.header_position === 'right'
      ? 'items-end text-right'
      : 'items-center text-center';
  const heroContentAlign = tourSettings.header_position === 'left'
    ? 'items-start'
    : tourSettings.header_position === 'right'
      ? 'items-end'
      : 'items-center';
  const showVersionBadge = tourSettings.tour_version && tourSettings.tour_version !== 'standard';

  // Helper to convert YouTube/Vimeo URLs to embed URLs
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
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}autoplay=1&mute=1`;
  };

  const applyAutoplayToEmbedHtml = (html: string) => {
    if (!tourSettings.autoplay) return html;
    return html.replace(/src=["']([^"']+)["']/gi, (match, src) => {
      if (src.includes('autoplay=')) return match;
      const updated = appendAutoplayParam(src);
      return match.replace(src, updated);
    });
  };

  const isEmbedHtml = (value: string) => value.includes('<') && value.includes('>');
  const getEmbedValue = (embed: { branded: string; mls: string }) => embed.branded || embed.mls || '';

  const renderWeatherIcon = (icon?: string) => {
    switch (icon) {
      case 'sunny':
        return <Sun className="w-4 h-4" />;
      case 'rainy':
        return <CloudRain className="w-4 h-4" />;
      case 'snowy':
        return <Snowflake className="w-4 h-4" />;
      default:
        return <Cloud className="w-4 h-4" />;
    }
  };

  // Get overlay card content based on active section
  const getOverlayContent = () => {
    switch (activeSection) {
      case 'header':
        return weather ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-blue-400">
              {renderWeatherIcon(weather.icon)}
              <span className="text-sm font-medium">
                {weather.temperature ? `${weather.temperature}°` : 'N/A'}
              </span>
            </div>
            {weather.windSpeed && (
              <div className="flex items-center gap-2 text-blue-300 text-xs">
                <Wind className="w-3 h-3" />
                <span>{weather.windSpeed} km/h</span>
              </div>
            )}
            {weather.humidity && (
              <div className="flex items-center gap-2 text-blue-300 text-xs">
                <Droplets className="w-3 h-3" />
                <span>{weather.humidity}%</span>
              </div>
            )}
          </div>
        ) : null;
      case 'gallery':
        return (
          <div className="space-y-1">
            <div className="text-xs text-blue-300 uppercase tracking-wider">Gallery</div>
            <div className="text-sm font-medium text-blue-400">{photos.length} Photos</div>
          </div>
        );
      case 'details':
        return (
          <div className="space-y-1">
            <div className="text-xs text-blue-300 uppercase tracking-wider">Property Details</div>
            <div className="flex items-center gap-3 text-sm text-blue-400">
              {beds && <span>{beds} Beds</span>}
              {baths && <span>{baths} Baths</span>}
              {sqft && <span>{sqft.toLocaleString()} Sq Ft</span>}
            </div>
          </div>
        );
      case 'video':
        return (
          <div className="space-y-1">
            <div className="text-xs text-blue-300 uppercase tracking-wider">Video Tour</div>
            <div className="text-sm font-medium text-blue-400">Available</div>
          </div>
        );
      case 'embeds':
        return (
          <div className="space-y-1">
            <div className="text-xs text-blue-300 uppercase tracking-wider">Embeds</div>
            <div className="text-sm font-medium text-blue-400">{orderedEmbeds.length} items</div>
          </div>
        );
      case 'contact':
        return (
          <div className="space-y-1">
            <div className="text-xs text-blue-300 uppercase tracking-wider">Contact</div>
            <div className="text-sm font-medium text-blue-400">{shoot?.client_name || 'Agent'}</div>
          </div>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-950">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading property tour...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 overflow-auto bg-slate-950 text-slate-100 font-sans">
      {/* Floating Navigation */}
      <motion.nav 
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className="fixed top-0 left-0 right-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-blue-500/20"
      >
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-center">
          <div className="hidden md:flex items-center gap-1 bg-slate-900/50 rounded-full p-1 border border-blue-500/30">
            {[
              { id: 'header' as SectionId, label: 'Header' },
              { id: 'gallery' as SectionId, label: 'Gallery' },
              { id: 'details' as SectionId, label: 'Details' },
              ...(orderedEmbeds.length > 0 ? [{ id: 'embeds' as SectionId, label: 'Embeds' }] : []),
              ...(videos.length > 0 || videoLink ? [{ id: 'video' as SectionId, label: 'Video' }] : []),
              { id: 'contact' as SectionId, label: 'Contact' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => scrollToSection(item.id)}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium transition-all duration-300",
                  activeSection === item.id
                    ? "bg-blue-500 text-white shadow-lg shadow-blue-500/50"
                    : "text-slate-400 hover:text-blue-400 hover:bg-slate-800/50"
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full text-slate-400 hover:text-blue-400 hover:bg-slate-800/50"
              onClick={() => setLiked(!liked)}
            >
              <Heart className={cn("w-5 h-5 transition-colors", liked && "fill-blue-500 text-blue-500")} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full text-slate-400 hover:text-blue-400 hover:bg-slate-800/50"
              onClick={() => navigator.share?.({ url: shareUrl }).catch(() => {})}
            >
              <Share2 className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </motion.nav>

      {/* Adaptive Overlay Card */}
      {getOverlayContent() && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          key={activeSection}
          className="fixed top-24 right-6 z-40 bg-slate-900/90 backdrop-blur-xl border border-blue-500/30 rounded-lg p-4 shadow-xl shadow-blue-500/10"
        >
          {getOverlayContent()}
        </motion.div>
      )}

      {/* 3D Tour Section - Show first if available */}
      {(matterportUrl || iguideUrl) && (
        <section className="relative h-screen overflow-hidden border-b border-blue-500/20">
          <div className="absolute inset-0">
            <iframe
              src={appendAutoplayParam(matterportUrl || iguideUrl || '')}
              className="w-full h-full border-0"
              allow="fullscreen; vr; autoplay"
              allowFullScreen
              title="3D Tour"
            />
          </div>
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10">
            <motion.div
              animate={{ y: [0, 10, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <ChevronDown className="w-8 h-8 text-blue-400" />
            </motion.div>
          </div>
        </section>
      )}

      {/* Embed Section */}
      {orderedEmbeds.length > 0 && (
        <section ref={embedsRef} id="embeds" className="py-24 px-6 bg-slate-950 border-b border-blue-500/20">
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-16"
            >
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-2 flex items-center justify-center gap-3">
                <Link2 className="w-6 h-6 text-blue-400" />
                Embeds
              </h2>
              <div className="w-24 h-1 bg-blue-500 mx-auto" />
            </motion.div>

            <div className="grid gap-8">
              {orderedEmbeds.map((embed, index) => {
                const value = getEmbedValue(embed);
                if (!value) return null;
                return (
                  <motion.div
                    key={embed.id}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: index * 0.05 }}
                    className="rounded-3xl border border-blue-500/20 bg-slate-900/60 shadow-2xl overflow-hidden"
                  >
                    <div className="flex items-center justify-between px-6 py-4 border-b border-blue-500/20">
                      <div>
                        <h3 className="text-lg font-semibold text-white">{embed.title || `Embed ${index + 1}`}</h3>
                        {featuredEmbedId === embed.id && (
                          <span className="text-[10px] text-blue-300 uppercase tracking-wider">Featured</span>
                        )}
                      </div>
                      {!isEmbedHtml(value) && (
                        <Button variant="outline" size="sm" className="border-blue-500/40 text-blue-300" asChild>
                          <a href={value} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Open
                          </a>
                        </Button>
                      )}
                    </div>
                    <div className="p-6">
                      {isEmbedHtml(value) ? (
                        <div
                          className="w-full [&_iframe]:w-full [&_iframe]:min-h-[360px] [&_iframe]:rounded-2xl [&_iframe]:border [&_iframe]:border-blue-500/20"
                          dangerouslySetInnerHTML={{ __html: applyAutoplayToEmbedHtml(value) }}
                        />
                      ) : (
                        <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-blue-500/20">
                          <iframe
                            src={appendAutoplayParam(value)}
                            className="w-full h-full border-0"
                            allow="fullscreen; clipboard-write; autoplay"
                            allowFullScreen
                            title={embed.title || `Embed ${index + 1}`}
                          />
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Main Header Section */}
      <section ref={headerRef} id="header" className="relative min-h-screen overflow-hidden border-b border-blue-500/20">
        <div className="absolute inset-0">
          {photos.length > 0 ? (
            <img
              src={photos[0]}
              alt="Hero Property"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-slate-900 flex items-center justify-center">
              <span className="text-slate-500">No Image Available</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />
        </div>

        <div className={cn("absolute inset-0 flex flex-col justify-end pb-24 px-6", heroAlignment)}>
          <div className={cn("max-w-7xl mx-auto w-full", heroContentAlign)}>
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.8 }}
              className={cn("flex items-center gap-2 text-blue-400 mb-4", tourSettings.header_position === 'right' && 'justify-end')}
            >
              <MapPin className="w-5 h-5" />
              <span className="text-lg font-medium">
                {shoot?.city}, {shoot?.state} {shoot?.zip}
              </span>
            </motion.div>
            
            <motion.h1
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.8 }}
              className="text-5xl md:text-7xl font-bold tracking-tight mb-6 text-white drop-shadow-2xl"
            >
              {shoot?.address || 'Property Tour'}
            </motion.h1>

            {showVersionBadge && (
              <div className={cn("mb-4 inline-flex", tourSettings.header_position === 'right' && 'justify-end')}>
                <Badge variant="outline" className="uppercase tracking-widest text-xs border-blue-400/50 text-blue-200">
                  {tourSettings.tour_version}
                </Badge>
              </div>
            )}

            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.8 }}
              className={cn("flex flex-wrap items-center gap-6 mb-8", tourSettings.header_position === 'right' && 'justify-end')}
            >
              {beds && (
                <div className="flex items-center gap-2 text-white bg-slate-900/50 backdrop-blur-md px-4 py-2 rounded-full border border-blue-500/30 shadow-lg">
                  <BedDouble className="w-5 h-5 text-blue-400" />
                  <span className="text-lg font-medium">{beds} Beds</span>
                </div>
              )}
              {baths && (
                <div className="flex items-center gap-2 text-white bg-slate-900/50 backdrop-blur-md px-4 py-2 rounded-full border border-blue-500/30 shadow-lg">
                  <Bath className="w-5 h-5 text-blue-400" />
                  <span className="text-lg font-medium">{baths} Baths</span>
                </div>
              )}
              {sqft && (
                <div className="flex items-center gap-2 text-white bg-slate-900/50 backdrop-blur-md px-4 py-2 rounded-full border border-blue-500/30 shadow-lg">
                  <Maximize className="w-5 h-5 text-blue-400" />
                  <span className="text-lg font-medium">{sqft.toLocaleString()} Sq Ft</span>
                </div>
              )}
            </motion.div>
          </div>
        </div>

        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <ChevronDown className="w-8 h-8 text-blue-400" />
        </motion.div>
      </section>

      {/* Image Gallery Section */}
      {photos.length > 0 && (
        <section ref={galleryRef} id="gallery" className="py-24 px-6 bg-slate-950 border-b border-blue-500/20">
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-16"
            >
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-2">
                Gallery
              </h2>
              <div className="w-24 h-1 bg-blue-500 mx-auto" />
            </motion.div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {photos.map((photo, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.05, duration: 0.5 }}
                  className={cn(
                    "relative group cursor-pointer overflow-hidden rounded-2xl border border-blue-500/20 shadow-lg hover:shadow-blue-500/20 transition-all",
                    index === 0 && "col-span-2 row-span-2",
                    index === 5 && "col-span-2"
                  )}
                  onClick={() => openLightbox(index)}
                >
                  <img
                    src={photo}
                    alt={`Property photo ${index + 1}`}
                    className="w-full h-full object-cover aspect-square group-hover:scale-110 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <span className="text-sm font-medium text-white">View Full</span>
                    <Maximize className="w-4 h-4 text-blue-400" />
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Property Details Section */}
      <section ref={detailsRef} id="details" className="py-24 px-6 bg-slate-900 border-b border-blue-500/20">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-2">
              Property Details
            </h2>
            <div className="w-24 h-1 bg-blue-500 mx-auto" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="grid md:grid-cols-3 gap-6"
          >
            {beds && (
              <div className="bg-slate-800/50 border border-blue-500/20 rounded-xl p-6 text-center">
                <BedDouble className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                <div className="text-3xl font-bold text-white mb-1">{beds}</div>
                <div className="text-sm text-slate-400 uppercase tracking-wider">Bedrooms</div>
              </div>
            )}
            {baths && (
              <div className="bg-slate-800/50 border border-blue-500/20 rounded-xl p-6 text-center">
                <Bath className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                <div className="text-3xl font-bold text-white mb-1">{baths}</div>
                <div className="text-sm text-slate-400 uppercase tracking-wider">Bathrooms</div>
              </div>
            )}
            {sqft && (
              <div className="bg-slate-800/50 border border-blue-500/20 rounded-xl p-6 text-center">
                <Maximize className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                <div className="text-3xl font-bold text-white mb-1">{sqft.toLocaleString()}</div>
                <div className="text-sm text-slate-400 uppercase tracking-wider">Square Feet</div>
              </div>
            )}
          </motion.div>

          {propertyDetails?.description && (
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mt-12 bg-slate-800/50 border border-blue-500/20 rounded-xl p-8"
            >
              <p className="text-slate-300 leading-relaxed">{propertyDetails.description}</p>
            </motion.div>
          )}
        </div>
      </section>

      {/* Video Section */}
      {(videos.length > 0 || videoLink) && (
        <section ref={videoRef} id="video" className="py-24 px-6 bg-slate-950 border-b border-blue-500/20">
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-16"
            >
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-2">
                Video Tour
              </h2>
              <div className="w-24 h-1 bg-blue-500 mx-auto" />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="relative aspect-video rounded-3xl overflow-hidden border border-blue-500/20 shadow-2xl"
            >
              {videoLink && getEmbedUrl(videoLink) ? (
                <iframe
                  src={`${getEmbedUrl(videoLink) || ''}${tourSettings.autoplay ? (getEmbedUrl(videoLink)?.includes('?') ? '&' : '?') + 'autoplay=1&mute=1' : ''}`}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title="Video Tour"
                />
              ) : videos.length > 0 ? (
                <video
                  src={videos[0]}
                  controls
                  autoPlay={tourSettings.autoplay}
                  muted={tourSettings.autoplay}
                  className="w-full h-full object-cover"
                  poster={photos[0]}
                />
              ) : null}
            </motion.div>
          </div>
        </section>
      )}

      {/* Contact Details Section */}
      <section ref={contactRef} id="contact" className="py-24 px-6 bg-slate-900">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-2">
              Contact Details
            </h2>
            <div className="w-24 h-1 bg-blue-500 mx-auto" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="bg-slate-800/50 border border-blue-500/20 rounded-3xl p-8 md:p-12 shadow-xl"
          >
            <div className="flex flex-col md:flex-row items-center gap-8 mb-10">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-3xl font-bold text-white shadow-lg">
                <User className="w-12 h-12" />
              </div>
              <div className="text-center md:text-left">
                <h3 className="text-2xl font-bold mb-1 text-white">{shoot?.client_name || 'Listing Agent'}</h3>
                <p className="text-slate-400 mb-4">{shoot?.client_company}</p>
                {tourSettings.realtor_info && (
                  <div className="mt-4 rounded-2xl border border-blue-500/20 bg-slate-900/60 px-4 py-3 text-sm text-slate-300">
                    <div className="flex items-center gap-2 text-blue-200 font-medium mb-1">
                      <Users className="h-4 w-4" />
                      Realtor(s)
                    </div>
                    <pre className="whitespace-pre-wrap font-sans text-sm text-slate-300">{tourSettings.realtor_info}</pre>
                  </div>
                )}
                <div className="flex flex-wrap justify-center md:justify-start gap-4">
                  {shoot?.client_phone && (
                    <Button variant="link" className="text-blue-400 hover:text-blue-300 p-0 h-auto">
                      <Phone className="w-4 h-4 mr-2" />
                      {shoot.client_phone}
                    </Button>
                  )}
                  {shoot?.client_email && (
                    <Button variant="link" className="text-blue-400 hover:text-blue-300 p-0 h-auto">
                      <Mail className="w-4 h-4 mr-2" />
                      {shoot.client_email}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-blue-500/20 bg-slate-950">
        <div className="max-w-7xl mx-auto flex flex-col items-center justify-center gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="rounded-full text-slate-400 hover:text-blue-400" onClick={() => navigator.share?.({ url: shareUrl }).catch(() => {})}>
              <Share2 className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full text-slate-400 hover:text-blue-400"
              onClick={() => setLiked(!liked)}
            >
              <Heart className={cn("w-5 h-5 transition-colors", liked && "fill-blue-500 text-blue-500")} />
            </Button>
          </div>
          <p className="text-slate-500 text-xs">
            © {new Date().getFullYear()} All rights reserved.
          </p>
        </div>
      </footer>

      {/* Lightbox */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-slate-950 border-none shadow-none sm:rounded-none overflow-hidden">
          <div className="relative w-full h-full flex items-center justify-center min-h-[80vh]">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 z-50 rounded-full bg-slate-800/50 hover:bg-slate-700/50 text-white"
              onClick={() => setLightboxOpen(false)}
            >
              <X className="w-5 h-5" />
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-4 top-1/2 -translate-y-1/2 z-50 rounded-full bg-slate-800/50 hover:bg-slate-700/50 text-white h-12 w-12"
              onClick={() => navigateLightbox("prev")}
            >
              <ChevronLeft className="w-8 h-8" />
            </Button>

            <img
              src={photos[lightboxIndex]}
              alt={`Property photo ${lightboxIndex + 1}`}
              className="max-w-full max-h-[90vh] object-contain"
            />

            <Button
              variant="ghost"
              size="icon"
              className="absolute right-4 top-1/2 -translate-y-1/2 z-50 rounded-full bg-slate-800/50 hover:bg-slate-700/50 text-white h-12 w-12"
              onClick={() => navigateLightbox("next")}
            >
              <ChevronRight className="w-8 h-8" />
            </Button>

            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 bg-slate-900/80 rounded-full backdrop-blur-sm border border-blue-500/30">
              <span className="text-white text-sm font-medium">
                {lightboxIndex + 1} / {photos.length}
              </span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
