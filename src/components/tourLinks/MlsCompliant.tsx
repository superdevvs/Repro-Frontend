import React, { useEffect, useMemo, useRef, useState } from "react";
import { API_BASE_URL } from "@/config/env";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { motion, useScroll, useTransform } from "framer-motion";
import { MapPin, BedDouble, Bath, Maximize, ChevronDown, Share2, Heart, X, ChevronLeft, ChevronRight, Video, Layers, FileText, ExternalLink, Link2, Users } from "lucide-react";
import { NeoTour } from "./NeoTour";

interface ShootData {
  id: number;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
}

interface PropertyDetails {
  beds?: number;
  baths?: number;
  sqft?: number;
  building?: Array<{ bedrooms?: number; baths?: number }>;
  areas?: Array<{ areaSquareFeet?: number; type?: string }>;
}

// Nav items will be built dynamically based on available data

export function MlsCompliant() {
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
  const [activeSection, setActiveSection] = useState("photos");
  const [liked, setLiked] = useState(false);
  const [tourStyle, setTourStyle] = useState<string>('default');

  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll();
  const heroOpacity = useTransform(scrollY, [0, 500], [1, 0]);
  const heroScale = useTransform(scrollY, [0, 500], [1, 1.1]);
  const textY = useTransform(scrollY, [0, 300], [0, 100]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const shootId = params.get('shootId');
        if (!shootId) { setLoading(false); return; }
        
        // Add cache-busting parameter to ensure fresh data
        const cacheBuster = new Date().getTime();
        const res = await fetch(`${API_BASE_URL}/api/public/shoots/${shootId}/mls?t=${cacheBuster}`);
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
        // Check for tour style - check both locations
        const style = data?.tour_style || data?.tour_links?.tour_style || 'default';
        setTourStyle(style);
        console.log('Tour style detected:', style, 'from data:', { tour_style: data?.tour_style, tour_links: data?.tour_links });

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

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
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

  // Build nav items dynamically based on available data
  const hasVideo = videos.length > 0 || !!videoLink;
  const navItems = [
    ...(photos.length > 0 ? [{ id: "photos", label: "Photos" }] : []),
    ...(hasVideo ? [{ id: "video", label: "Video" }] : []),
    ...((matterportUrl || iguideUrl) ? [{ id: "tour", label: "3D Tour" }] : []),
    ...(orderedEmbeds.length > 0 ? [{ id: "embeds", label: "Embeds" }] : []),
    ...(floorplans.length > 0 ? [{ id: "floorplan", label: "Floor Plan" }] : []),
    ...(shoot?.address ? [{ id: "map", label: "Map" }] : []),
  ];

  // Helper to convert YouTube/Vimeo URLs to embed URLs
  const getEmbedUrl = (url: string): string | null => {
    if (!url) return null;
    // YouTube
    const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
    // Vimeo
    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    // Direct video URL - return as-is
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

  // Render Neo theme if tour style is 'neo'
  if (tourStyle === 'neo') {
    return <NeoTour />;
  }

  return (
    <div className="fixed inset-0 overflow-auto bg-background text-foreground font-sans transition-colors duration-300">
      {/* Floating Navigation */}
      <motion.nav 
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/40 shadow-sm"
      >
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-center">
          <div className="hidden md:flex items-center gap-1 bg-muted/50 rounded-full p-1 border border-border/50">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => scrollToSection(item.id)}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium transition-all duration-300",
                  activeSection === item.id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
              onClick={() => setLiked(!liked)}
            >
              <Heart className={cn("w-5 h-5 transition-colors", liked && "fill-red-500 text-red-500")} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
              onClick={() => navigator.share?.({ url: shareUrl }).catch(() => {})}
            >
              <Share2 className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </motion.nav>

      {/* Hero Section - WITH ADDRESS */}
      <section ref={heroRef} className="relative h-screen overflow-hidden">
        <motion.div 
          style={{ opacity: heroOpacity, scale: heroScale }}
          className="absolute inset-0"
        >
          {photos.length > 0 ? (
            <img
              src={photos[0]}
              alt="Hero Property"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-muted flex items-center justify-center">
              <span className="text-muted-foreground">No Image Available</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        </motion.div>

        <motion.div 
          style={{ y: textY }}
          className={cn("absolute inset-0 flex flex-col justify-end pb-24 px-6", heroAlignment)}
        >
          <div className={cn("max-w-7xl mx-auto w-full", heroContentAlign)}>
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.8 }}
              className={cn("flex items-center gap-2 text-primary mb-4", tourSettings.header_position === 'right' && 'justify-end')}
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
              className="text-5xl md:text-7xl font-bold tracking-tight mb-6 text-foreground drop-shadow-2xl"
            >
              {shoot?.address || 'Property Tour'}
            </motion.h1>

            {showVersionBadge && (
              <div className={cn("mb-4 inline-flex", tourSettings.header_position === 'right' && 'justify-end')}>
                <Badge variant="outline" className="uppercase tracking-widest text-xs">
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
                <div className="flex items-center gap-2 text-foreground/90 bg-background/30 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 dark:border-white/10 border-black/5 shadow-sm">
                  <BedDouble className="w-5 h-5" />
                  <span className="text-lg font-medium">{beds} Beds</span>
                </div>
              )}
              {baths && (
                <div className="flex items-center gap-2 text-foreground/90 bg-background/30 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 dark:border-white/10 border-black/5 shadow-sm">
                  <Bath className="w-5 h-5" />
                  <span className="text-lg font-medium">{baths} Baths</span>
                </div>
              )}
              {sqft && (
                <div className="flex items-center gap-2 text-foreground/90 bg-background/30 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 dark:border-white/10 border-black/5 shadow-sm">
                  <Maximize className="w-5 h-5" />
                  <span className="text-lg font-medium">{sqft.toLocaleString()} Sq Ft</span>
                </div>
              )}
            </motion.div>
          </div>
        </motion.div>

        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <ChevronDown className="w-8 h-8 text-foreground/60" />
        </motion.div>
      </section>

      {/* Photo Gallery Section - Only show if photos exist */}
      {photos.length > 0 && (
        <section id="photos" className="py-24 px-6 bg-background">
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-16"
            >
              <h2 className="text-4xl md:text-5xl font-bold text-foreground">
                Gallery
              </h2>
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
                    "relative group cursor-pointer overflow-hidden rounded-2xl border border-border/40 shadow-sm",
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
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <span className="text-sm font-medium text-white">View Full</span>
                    <Maximize className="w-4 h-4 text-white" />
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {tourSettings.realtor_info && (
        <section id="realtor" className="py-20 px-6 bg-muted/10">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="rounded-3xl border border-border/40 bg-background/80 p-8 shadow-lg"
            >
              <div className="flex items-center gap-2 text-primary text-sm font-semibold uppercase tracking-widest mb-4">
                <Users className="h-4 w-4" />
                Realtor Info
              </div>
              <pre className="whitespace-pre-wrap font-sans text-sm text-muted-foreground">{tourSettings.realtor_info}</pre>
            </motion.div>
          </div>
        </section>
      )}

      {/* Embed Section */}
      {orderedEmbeds.length > 0 && (
        <section id="embeds" className="py-24 px-6 bg-muted/20">
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-16"
            >
              <h2 className="text-4xl md:text-5xl font-bold text-foreground flex items-center justify-center gap-3">
                <Link2 className="h-6 w-6 text-primary" />
                Embeds
              </h2>
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
                    className="rounded-3xl border border-border/40 bg-background shadow-lg overflow-hidden"
                  >
                    <div className="flex items-center justify-between px-6 py-4 border-b border-border/40">
                      <div>
                        <h3 className="text-lg font-semibold">{embed.title || `Embed ${index + 1}`}</h3>
                        {featuredEmbedId === embed.id && (
                          <Badge variant="outline" className="text-[10px] mt-1">Featured</Badge>
                        )}
                      </div>
                      {!isEmbedHtml(value) && (
                        <Button variant="outline" size="sm" asChild>
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
                          className="w-full [&_iframe]:w-full [&_iframe]:min-h-[360px] [&_iframe]:rounded-2xl [&_iframe]:border [&_iframe]:border-border/40"
                          dangerouslySetInnerHTML={{ __html: applyAutoplayToEmbedHtml(value) }}
                        />
                      ) : (
                        <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-border/40">
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

      {/* Video Section - Only show if videos or videoLink exist */}
      {hasVideo && (
        <section id="video" className="py-24 px-6 bg-muted/30">
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-16"
            >
              <h2 className="text-4xl md:text-5xl font-bold text-foreground">
                Video Tour
              </h2>
            </motion.div>

            <div className="grid md:grid-cols-2 gap-8">
              {/* Embedded Video Link (YouTube/Vimeo) */}
              {videoLink && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6 }}
                  className="relative aspect-video rounded-3xl overflow-hidden group border border-border/40 shadow-xl col-span-full"
                >
                  {getEmbedUrl(videoLink)?.includes('youtube.com') || getEmbedUrl(videoLink)?.includes('vimeo.com') ? (
                    <iframe
                      src={`${getEmbedUrl(videoLink) || ''}${tourSettings.autoplay ? (getEmbedUrl(videoLink)?.includes('?') ? '&' : '?') + 'autoplay=1&mute=1' : ''}`}
                      className="w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      title="Video Tour"
                    />
                  ) : (
                    <video
                      src={videoLink}
                      controls
                      autoPlay={tourSettings.autoplay}
                      muted={tourSettings.autoplay}
                      className="w-full h-full object-cover"
                      poster={photos[0]}
                    />
                  )}
                </motion.div>
              )}
              {/* Direct video files */}
              {videos.map((video, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6 }}
                  className="relative aspect-video rounded-3xl overflow-hidden group border border-border/40 shadow-xl"
                >
                  <video
                    src={video}
                    controls
                    autoPlay={tourSettings.autoplay}
                    muted={tourSettings.autoplay}
                    className="w-full h-full object-cover"
                    poster={photos[0]}
                  />
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 3D Tour Section - Only show if matterport or iguide exists */}
      {(matterportUrl || iguideUrl) && (
        <section id="tour" className="py-24 px-6 bg-background">
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-16"
            >
              <h2 className="text-4xl md:text-5xl font-bold text-foreground">
                3D Tour
              </h2>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="relative aspect-video rounded-3xl overflow-hidden border border-border/40 shadow-2xl"
            >
              <iframe
                src={appendAutoplayParam(matterportUrl || iguideUrl || '')}
                className="w-full h-full border-0"
                allow="fullscreen; vr; autoplay"
                allowFullScreen
                title="3D Tour"
              />
            </motion.div>
          </div>
        </section>
      )}

      {/* Floor Plan Section - Only show if floorplans exist */}
      {floorplans.length > 0 && (
        <section id="floorplan" className="py-24 px-6 bg-muted/30">
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-16"
            >
              <h2 className="text-4xl md:text-5xl font-bold text-foreground">
                Floor Plans
              </h2>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="grid md:grid-cols-2 gap-8"
            >
              {floorplans.map((fp, index) => (
                <div
                  key={index}
                  className="relative aspect-[4/3] rounded-3xl overflow-hidden bg-background border border-border/40 p-8 flex flex-col shadow-lg hover:shadow-xl transition-shadow"
                >
                  <h3 className="text-xl font-semibold mb-4 text-foreground">Level {index + 1}</h3>
                  <div className="flex-1 flex items-center justify-center">
                    <img src={fp} alt={`Floor Plan ${index + 1}`} className="max-w-full max-h-full object-contain" />
                  </div>
                </div>
              ))}
            </motion.div>
          </div>
        </section>
      )}

      {/* Map Section */}
      {shoot?.address && (
        <section id="map" className="py-24 px-6 bg-background">
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-16"
            >
              <span className="text-primary text-sm font-semibold tracking-widest uppercase">Location</span>
              <h2 className="text-4xl md:text-5xl font-bold mt-4 text-foreground">
                Property Location
              </h2>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="relative aspect-[16/9] md:aspect-[21/9] rounded-3xl overflow-hidden border border-border/40 shadow-2xl"
            >
              <iframe
                src={`https://maps.google.com/maps?q=${encodeURIComponent(`${shoot.address}, ${shoot.city}, ${shoot.state} ${shoot.zip}`)}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                className="w-full h-full border-0"
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Property Location"
              />
            </motion.div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-border/40 bg-muted/20">
        <div className="max-w-7xl mx-auto flex flex-col items-center justify-center gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground hover:text-foreground" onClick={() => navigator.share?.({ url: shareUrl }).catch(() => {})}>
              <Share2 className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full text-muted-foreground hover:text-foreground"
              onClick={() => setLiked(!liked)}
            >
              <Heart className={cn("w-5 h-5 transition-colors", liked && "fill-red-500 text-red-500")} />
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">
            © {new Date().getFullYear()} All rights reserved.
          </p>
        </div>
      </footer>

      {/* Lightbox */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-none shadow-none sm:rounded-none overflow-hidden">
          <div className="relative w-full h-full flex items-center justify-center min-h-[80vh]">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 z-50 rounded-full bg-white/10 hover:bg-white/20 text-white"
              onClick={() => setLightboxOpen(false)}
            >
              <X className="w-5 h-5" />
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-4 top-1/2 -translate-y-1/2 z-50 rounded-full bg-white/10 hover:bg-white/20 text-white h-12 w-12"
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
              className="absolute right-4 top-1/2 -translate-y-1/2 z-50 rounded-full bg-white/10 hover:bg-white/20 text-white h-12 w-12"
              onClick={() => navigateLightbox("next")}
            >
              <ChevronRight className="w-8 h-8" />
            </Button>

            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 bg-black/50 rounded-full backdrop-blur-sm">
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
