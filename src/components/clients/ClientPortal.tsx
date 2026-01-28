import React, { useEffect, useState } from "react";
import { API_BASE_URL } from "@/config/env";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  Loader2,
  MapPin,
  Camera,
  Mail,
  Building2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from "lucide-react";

type PortfolioItem = {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  category: "luxury" | "commercial" | "residential" | "drone";
  photos?: number | string;
  badge?: string;
  gallery?: string[];
  iguideUrl?: string;
};

const extractUrls = (arr: any[] | undefined | null): string[] => {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((item) => {
      if (typeof item === 'string') return item;
      // Prefer size-specific watermarked URLs for previews
      if (item?.thumb_url) return item.thumb_url;
      if (item?.medium_url) return item.medium_url;
      if (item?.thumbnail_url) return item.thumbnail_url;
      if (item?.signed_url) return item.signed_url;
      // Avoid full-size fallbacks - only use if no preview available
      if (item?.web_path) return item.web_path;
      if (item?.thumbnail_path) return item.thumbnail_path;
      return null;
    })
    .filter((x): x is string => Boolean(x));
};

const collectUrlsDeep = (input: any, depth = 3): string[] => {
  if (!input || depth < 0) return [];
  const urls: string[] = [];
  if (Array.isArray(input)) {
    urls.push(...extractUrls(input));
    input.forEach((item) => urls.push(...collectUrlsDeep(item, depth - 1)));
  } else if (typeof input === 'object') {
    Object.values(input).forEach((val) => {
      if (typeof val === 'string') {
        urls.push(val);
      } else {
        urls.push(...collectUrlsDeep(val, depth - 1));
      }
    });
  }
  return urls.filter(Boolean);
};

export function ClientPortal() {
  const [loading, setLoading] = useState(true);
  const [clientName, setClientName] = useState<string>("");
  const [clientInfo, setClientInfo] = useState<{
    email?: string;
    company_name?: string;
    avatar?: string;
    banner_image?: string;
    address?: string;
    logo?: string;
    about?: string;
  } | null>(null);
  const [shoots, setShoots] = useState<PortfolioItem[]>([]);
  const [activeGallery, setActiveGallery] = useState<string[]>([]);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryTitle, setGalleryTitle] = useState("");
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [activeTourUrl, setActiveTourUrl] = useState<string | null>(null);
  const clientId = React.useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('clientId');
  }, []);
  const storageKey = React.useCallback(
    (key: string) => `client-${clientId || 'default'}-${key}`,
    [clientId]
  );
  const [showMap, setShowMap] = useState<boolean>(() => {
    const params = new URLSearchParams(window.location.search);
    const cid = params.get('clientId') || 'default';
    const stored = typeof window !== 'undefined' ? localStorage.getItem(`client-${cid}-showMap`) : null;
    return stored ? stored === 'true' : false;
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const clientId = params.get('clientId');
    
    if (!clientId) {
      setLoading(false);
      return;
    }

    const fetchClientData = async () => {
      try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        const headers: HeadersInit = { Accept: 'application/json' };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        
        const res = await fetch(`${API_BASE_URL}/api/public/clients/${clientId}/profile`, {
          headers,
        });
        
        if (!res.ok) throw new Error('Failed to fetch data');
        
        const data = await res.json();
        const c = data.client || {};
        
        if (c.name) setClientName(c.name);
        setClientInfo({
          email: c.email,
          company_name: c.company_name,
          avatar: c.avatar,
          banner_image: c.banner_image || c.cover_image,
          address: c.address || c.location,
          logo: c.logo || c.avatar,
          about: c.about,
        });

        const items: PortfolioItem[] = (data.shoots || []).map((s: any) => {
          // Backend now returns gallery array with all image URLs
          const gallery: string[] = Array.isArray(s.gallery) ? s.gallery.filter(Boolean) : [];
          
          // Fallback extraction if gallery is empty
          if (!gallery.length) {
            const fallbackUrls = [
              ...extractUrls(s.media_files),
              ...extractUrls(s.images),
              ...extractUrls(s.files),
              ...collectUrlsDeep(s.media_files),
              ...collectUrlsDeep(s.images),
              ...collectUrlsDeep(s.files),
            ].filter(Boolean);
            gallery.push(...Array.from(new Set(fallbackUrls)));
          }

          const primaryImage = s.preview_image || gallery[0] || '';

          const iguideUrl =
            s.iguide_tour_url ||
            s.tour_links?.iguide_branded ||
            s.tour_links?.iguide_mls ||
            s.tour_links?.iGuide ||
            '';

          return {
            id: String(s.id),
            title: s.address || 'Untitled Property',
            subtitle: [s.city, s.state].filter(Boolean).join(', ') || 'Location pending',
            image: primaryImage || 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=600&h=400&fit=crop&q=80',
            category: 'residential',
            photos: s.files_count || gallery.length || 0,
            badge: s.status || 'Completed',
            gallery: gallery.length ? gallery : (primaryImage ? [primaryImage] : []),
            iguideUrl: iguideUrl || undefined,
          };
        });
        
        setShoots(items);
      } catch (error) {
        console.error("Error fetching client portal data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchClientData();
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const openGallery = (shoot: PortfolioItem) => {
    // Gallery is already populated from the initial client profile API response
    const gallery = shoot.gallery && shoot.gallery.length > 0 ? shoot.gallery : [shoot.image];
    const filteredGallery = gallery.filter(Boolean);
    setActiveGallery(filteredGallery);
    setGalleryTitle(shoot.title);
    setGalleryIndex(0);
    setActiveTourUrl(shoot.iguideUrl || null);
    setGalleryOpen(true);
  };

  const handleNextImage = () => {
    setGalleryIndex((prev) => (activeGallery.length ? (prev + 1) % activeGallery.length : prev));
  };

  const handlePrevImage = () => {
    setGalleryIndex((prev) =>
      activeGallery.length ? (prev - 1 + activeGallery.length) % activeGallery.length : prev
    );
  };

  const storedBrandLogo = typeof window !== 'undefined' ? localStorage.getItem(storageKey('brandLogo')) : '';
  const storedBanner = typeof window !== 'undefined' ? localStorage.getItem(storageKey('brandBanner')) : '';
  const storedAvatar = typeof window !== 'undefined' ? localStorage.getItem(storageKey('avatar')) : '';
  const customAbout = typeof window !== 'undefined' ? localStorage.getItem(storageKey('brandAbout')) || '' : '';

  const logoImage = storedBrandLogo || clientInfo?.logo || '';
  const bannerImage = storedBanner || clientInfo?.banner_image || '';
  const hasBanner = Boolean(bannerImage);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!clientName && !loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-4 text-center">
        <h1 className="text-2xl font-bold mb-2">Client Not Found</h1>
        <p className="text-muted-foreground mb-4">Unable to load profile data. The link may be invalid or expired.</p>
        <Button variant="outline" onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-background text-foreground font-sans transition-colors duration-300 overflow-y-scroll overflow-x-hidden">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
            <div className="flex items-center gap-3 font-bold text-xl">
              {logoImage ? (
                <Avatar className="h-10 w-10">
                  <AvatarImage src={logoImage} alt={clientName} />
                  <AvatarFallback>{clientName.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
              ) : null}
              <span>{clientName}</span>
            </div>
          <div className="flex items-center gap-6">
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
              <button onClick={() => scrollToSection('listings')} className="hover:text-primary transition-colors">Listings</button>
              <button onClick={() => scrollToSection('about')} className="hover:text-primary transition-colors">About</button>
              <button onClick={() => scrollToSection('contact')} className="hover:text-primary transition-colors">Contact</button>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-12 md:py-20 bg-gradient-to-br from-background via-muted/30 to-primary/5 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-primary/30 via-transparent to-transparent" />
        <div className="container px-4 md:px-6 relative z-10">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <h1 className="text-4xl md:text-5xl font-bold leading-tight">
              Welcome, <span className="text-primary">{clientName}</span>
            </h1>
            <p className="text-muted-foreground text-lg leading-relaxed max-w-3xl mx-auto">
              Browse every listing in one elegant view. Preview media instantly and dive into full galleries without leaving the page.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button size="lg" onClick={() => scrollToSection('listings')}>
                View Listings
              </Button>
              <Button size="lg" variant="outline" onClick={() => scrollToSection('about')}>
                About
              </Button>
            </div>
            <div className="grid sm:grid-cols-3 gap-3 pt-4">
              <div className="rounded-2xl border bg-card p-4 shadow-sm">
                <p className="text-xs uppercase text-muted-foreground tracking-[0.2em] mb-1">Listings</p>
                <p className="text-2xl font-semibold">{shoots.length || 0}</p>
              </div>
              <div className="rounded-2xl border bg-card p-4 shadow-sm">
                <p className="text-xs uppercase text-muted-foreground tracking-[0.2em] mb-1">Latest</p>
                <p className="text-base text-muted-foreground line-clamp-2">
                  {shoots[0]?.title || "Ready for your next shoot"}
                </p>
              </div>
              <div className="rounded-2xl border bg-card p-4 shadow-sm">
                <p className="text-xs uppercase text-muted-foreground tracking-[0.2em] mb-1">Contact</p>
                <p className="text-base text-muted-foreground line-clamp-2">
                  {clientInfo?.email || "Email not set"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Shoots Grid */}
      <section id="listings" className="container px-4 md:px-6 py-20">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-10 gap-4">
          <div className="space-y-2">
            <Badge variant="secondary" className="uppercase tracking-wide">Portfolio</Badge>
            <div>
              <h2 className="text-3xl font-bold tracking-tight">Our Listings</h2>
              <p className="text-muted-foreground">High-resolution previews with quick gallery access.</p>
            </div>
          </div>
          <Badge variant="outline" className="text-sm h-9 px-4 rounded-full">
            {shoots.length} {shoots.length === 1 ? 'Listing' : 'Listings'}
          </Badge>
        </div>

        {shoots.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
            {shoots.map((shoot) => (
              <div
                key={shoot.id}
                className="group rounded-3xl overflow-hidden border bg-card shadow-sm hover:shadow-2xl transition-all duration-300"
              >
                <div className="relative aspect-[4/3] overflow-hidden">
                  <img
                    src={shoot.image}
                    alt={shoot.title}
                    className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent pointer-events-none" />
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white">
                    <div>
                      <p className="text-sm opacity-80">Preview</p>
                      <p className="text-lg font-semibold line-clamp-1">{shoot.title}</p>
                    </div>
                    <Badge variant="secondary" className="bg-white/20 text-white backdrop-blur">
                      {shoot.photos} Photos
                    </Badge>
                  </div>
                </div>
                <div className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-lg font-semibold line-clamp-1">{shoot.title}</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-2 line-clamp-2">
                        <MapPin className="h-4 w-4" />
                        {shoot.subtitle}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                    <Badge variant="outline" className="rounded-full">{shoot.category}</Badge>
                    <Badge variant="outline" className="rounded-full">Media Ready</Badge>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button className="w-full" size="sm" onClick={() => openGallery(shoot)}>
                      View Gallery
                    </Button>
                    {shoot.iguideUrl && (
                      <Button
                        className="w-full"
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(shoot.iguideUrl, '_blank', 'noopener,noreferrer')}
                      >
                        <ExternalLink className="h-3.5 w-3.5 mr-1" />
                        iGUIDE Tour
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 border-2 border-dashed rounded-xl bg-muted/10">
            <div className="mx-auto h-12 w-12 text-muted-foreground mb-4">
              <Camera className="h-12 w-12 opacity-20" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No listings found</h3>
            <p className="text-muted-foreground max-w-sm mx-auto mb-6">
              It looks like you don't have any completed listings yet. Once your listings are ready, they will appear here.
            </p>
          </div>
        )}
      </section>

      <Separator />

      {/* About / Experience Section */}
      <section id="about" className="container px-4 md:px-6 py-20">
        <div className={`grid gap-12 items-center ${hasBanner ? 'lg:grid-cols-2' : 'lg:grid-cols-1'}`}>
          {hasBanner && (
            <div className="relative overflow-hidden rounded-2xl shadow-lg">
              <div className="aspect-[4/3] bg-muted">
                <img
                  src={bannerImage}
                  alt={`${clientName} banner`}
                  className="object-cover w-full h-full"
                />
              </div>
            </div>
          )}
          <div className="space-y-6">
            <h2 className="text-3xl md:text-4xl font-bold">About</h2>
            <p className="text-muted-foreground text-lg leading-relaxed">
              {customAbout ||
                clientInfo?.about ||
                (clientInfo?.company_name
                  ? `${clientInfo.company_name} showcases their active listings here—curated photography, video, and media in one place for quick sharing.`
                  : "Explore the listings curated for you with high-quality visuals and easy access to every asset you need.")}
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Each property page is ready for marketing, offers, or client handoffs. Use this portal as a single, streamlined reference for every listing we capture together.
            </p>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="container px-4 md:px-6 py-20">
        <div className="space-y-6 rounded-3xl border shadow-sm bg-card/80 backdrop-blur p-6 md:p-8">
          <div className="grid lg:grid-cols-3 gap-6 items-start">
            <div className="lg:col-span-1 space-y-2">
              <h2 className="text-3xl md:text-4xl font-bold">Contact</h2>
              <p className="text-muted-foreground text-lg">
                Quick reference for getting in touch and visiting on-site.
              </p>
            </div>

            <div className={`lg:col-span-${showMap && clientInfo?.address ? '1' : '2'} grid sm:grid-cols-2 lg:grid-cols-1 gap-4`}>
              <div className="flex items-center gap-3 rounded-2xl border p-4 bg-background/60">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <MapPin className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Address</p>
                  <p className="text-base font-medium whitespace-pre-line">
                    {clientInfo?.address || "Address available on request"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-2xl border p-4 bg-background/60">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Company</p>
                  <p className="text-base font-medium">{clientInfo?.company_name || clientName}</p>
                </div>
              </div>

              {clientInfo?.email && (
                <div className="flex items-center gap-3 rounded-2xl border p-4 bg-background/60">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Mail className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="text-base font-medium">{clientInfo.email}</p>
                  </div>
                </div>
              )}
            </div>

            {showMap && clientInfo?.address && (
              <div className="lg:col-span-1 rounded-2xl overflow-hidden border shadow-sm bg-muted">
                <div className="aspect-[4/3]">
                  <iframe
                    title="Client address map"
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    loading="lazy"
                    allowFullScreen
                    src={`https://www.google.com/maps?q=${encodeURIComponent(clientInfo.address)}&output=embed`}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <Dialog open={galleryOpen} onOpenChange={setGalleryOpen}>
        <DialogContent className="!max-w-[95vw] !w-[95vw] !h-[90vh] !p-0 !gap-0 overflow-hidden block">
          <DialogHeader className="px-6 py-4 border-b">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg">{galleryTitle || 'Gallery Preview'}</DialogTitle>
              <div className="flex items-center gap-3">
                {activeTourUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7"
                    onClick={() => window.open(activeTourUrl, '_blank', 'noopener,noreferrer')}
                  >
                    <ExternalLink className="h-3.5 w-3.5 mr-1" />
                    iGUIDE Tour
                  </Button>
                )}
                {activeGallery.length > 1 && (
                  <span className="text-sm text-muted-foreground">
                    {galleryIndex + 1} / {activeGallery.length}
                  </span>
                )}
              </div>
            </div>
            <DialogDescription className="sr-only">
              Browse through property photos
            </DialogDescription>
          </DialogHeader>
          {activeGallery.length > 0 ? (
            <div className="flex flex-col">
              {/* Main Image */}
              <div 
                style={{ 
                  position: 'relative',
                  width: '100%',
                  height: 'calc(90vh - 140px)',
                  backgroundColor: '#171717',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {activeGallery[galleryIndex] ? (
                  <img
                    key={`main-${galleryIndex}`}
                    src={activeGallery[galleryIndex]}
                    alt={`${galleryTitle} preview ${galleryIndex + 1}`}
                    style={{
                      maxWidth: '100%',
                      maxHeight: '100%',
                      objectFit: 'contain',
                      display: 'block'
                    }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=600&h=400&fit=crop&q=80';
                    }}
                  />
                ) : (
                  <div style={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>
                    <Camera className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Image not available</p>
                  </div>
                )}
                {activeGallery.length > 1 && (
                  <>
                    <button
                      onClick={handlePrevImage}
                      className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-black rounded-full p-3 shadow-lg transition-all"
                      aria-label="Previous image"
                    >
                      <ChevronLeft className="h-6 w-6" />
                    </button>
                    <button
                      onClick={handleNextImage}
                      className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-black rounded-full p-3 shadow-lg transition-all"
                      aria-label="Next image"
                    >
                      <ChevronRight className="h-6 w-6" />
                    </button>
                  </>
                )}
              </div>
              {/* Thumbnails */}
              {activeGallery.length > 1 && (
                <div className="bg-muted/50 p-4 border-t">
                  <div className="flex gap-2 overflow-x-auto">
                    {activeGallery.map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => setGalleryIndex(idx)}
                        className={`h-14 w-20 flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all ${
                          idx === galleryIndex 
                            ? 'border-primary ring-2 ring-inset ring-primary/50' 
                            : 'border-transparent hover:border-muted-foreground/50'
                        }`}
                      >
                        <img 
                          src={img} 
                          alt={`thumb-${idx}`} 
                          className="object-cover w-full h-full"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              No images available for this listing yet.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ClientPortal;
