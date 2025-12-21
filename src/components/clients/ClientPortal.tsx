import React, { useEffect, useState } from "react";
import { API_BASE_URL } from "@/config/env";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Loader2, 
  MapPin, 
  Camera, 
  Mail, 
  Building2, 
  Home, 
  Crown, 
  Plane, 
  Box, 
  Video, 
  Aperture, 
  Zap, 
  Monitor,
  Check,
  Phone,
  Globe,
  Award,
  Trophy,
  Star,
  Clock,
  Rocket,
  ScrollText
} from "lucide-react";

type PortfolioItem = {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  category: "luxury" | "commercial" | "residential" | "drone";
  photos?: number | string;
  badge?: string;
};

export function ClientPortal() {
  const [loading, setLoading] = useState(true);
  const [clientName, setClientName] = useState<string>("");
  const [clientInfo, setClientInfo] = useState<{ email?: string; company_name?: string; avatar?: string } | null>(null);
  const [shoots, setShoots] = useState<PortfolioItem[]>([]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const clientId = params.get('clientId');
    
    if (!clientId) {
      setLoading(false);
      return;
    }

    const fetchClientData = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/public/clients/${clientId}/profile`, {
          headers: { Accept: 'application/json' },
        });
        
        if (!res.ok) throw new Error('Failed to fetch data');
        
        const data = await res.json();
        const c = data.client || {};
        
        if (c.name) setClientName(c.name);
        setClientInfo({ 
          email: c.email, 
          company_name: c.company_name, 
          avatar: c.avatar 
        });

        const items: PortfolioItem[] = (data.shoots || []).map((s: any) => ({
          id: String(s.id),
          title: s.address || 'Untitled Property',
          subtitle: [s.city, s.state].filter(Boolean).join(', ') || 'Location pending',
          image: s.preview_image || 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=600&h=400&fit=crop&q=80',
          category: 'residential',
          photos: s.files_count || 0,
          badge: s.status || 'Completed',
        }));
        
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
    <div className="min-h-screen bg-background text-foreground font-sans transition-colors duration-300">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xl">
            <Camera className="h-6 w-6 text-primary" />
            <span>Repro Photos</span>
          </div>
          <div className="flex items-center gap-6">
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
              <button onClick={() => scrollToSection('shoots')} className="hover:text-primary transition-colors">Projects</button>
              <button onClick={() => scrollToSection('about')} className="hover:text-primary transition-colors">About</button>
              <button onClick={() => scrollToSection('services')} className="hover:text-primary transition-colors">Services</button>
              <button onClick={() => scrollToSection('equipment')} className="hover:text-primary transition-colors">Equipment</button>
              <button onClick={() => scrollToSection('contact')} className="hover:text-primary transition-colors">Contact</button>
            </nav>
            {clientInfo && (
              <div className="flex items-center gap-3 border-l pl-6 ml-2">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium leading-none">{clientName}</p>
                  {clientInfo.company_name && (
                    <p className="text-xs text-muted-foreground">{clientInfo.company_name}</p>
                  )}
                </div>
                <Avatar>
                  <AvatarImage src={clientInfo.avatar} alt={clientName} />
                  <AvatarFallback>{clientName.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-12 md:py-24 bg-muted/30 relative overflow-hidden">
        {/* Background Decoration */}
        <div className="absolute inset-0 pointer-events-none opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary via-transparent to-transparent" />
        
        <div className="container px-4 md:px-6 text-center relative z-10">
          <Badge variant="secondary" className="mb-4 px-4 py-1 text-sm">Professional Real Estate Photography</Badge>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tighter mb-6">
            Welcome, <span className="text-primary">{clientName}</span>
          </h1>
          <p className="max-w-[800px] mx-auto text-muted-foreground text-lg md:text-xl mb-8">
            Your dedicated space for accessing property media, managing shoots, and viewing your complete project history.
          </p>
          
          {/* Highlights */}
          <div className="flex flex-wrap justify-center gap-4 mb-10">
            {[
              { label: "500+ Properties Shot" },
              { label: "8+ Years Experience" },
              { label: "24hr Delivery" }
            ].map((badge, i) => (
              <Badge key={i} variant="outline" className="bg-background px-4 py-1.5 text-sm">
                {badge.label}
              </Badge>
            ))}
          </div>

          <div className="flex justify-center gap-4">
            <Button size="lg" onClick={() => scrollToSection('shoots')}>
              View Projects
            </Button>
            <Button size="lg" variant="outline" onClick={() => scrollToSection('contact')}>
              Book New Shoot
            </Button>
          </div>
        </div>
      </section>

      {/* Shoots Grid */}
      <section id="shoots" className="container px-4 md:px-6 py-20">
        <div className="flex flex-col md:flex-row items-center justify-between mb-12 gap-4">
          <div className="text-center md:text-left">
            <h2 className="text-3xl font-bold tracking-tight mb-2">Your Projects</h2>
            <p className="text-muted-foreground">Access and download media from your recent shoots</p>
          </div>
          <Badge variant="outline" className="text-sm h-8 px-3">
            {shoots.length} {shoots.length === 1 ? 'Project' : 'Projects'}
          </Badge>
        </div>

        {shoots.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {shoots.map((shoot) => (
              <Card key={shoot.id} className="overflow-hidden group hover:shadow-xl transition-all duration-300 border-muted bg-card">
                <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                  <img
                    src={shoot.image}
                    alt={shoot.title}
                    className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  {shoot.badge && (
                    <Badge className="absolute top-3 right-3 bg-background/90 backdrop-blur-sm text-foreground shadow-sm">
                      {shoot.badge}
                    </Badge>
                  )}
                </div>
                <CardHeader className="p-5 pb-2">
                  <CardTitle className="line-clamp-1 text-lg">{shoot.title}</CardTitle>
                  <CardDescription className="flex items-center gap-1 line-clamp-1">
                    <MapPin className="h-3 w-3" />
                    {shoot.subtitle}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-5 pt-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Camera className="h-4 w-4" />
                    <span>{shoot.photos} Photos</span>
                  </div>
                </CardContent>
                <Separator />
                <CardFooter className="p-4 bg-muted/10 flex gap-2">
                  <Button className="w-full" variant="default" size="sm">
                    View Gallery
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 border-2 border-dashed rounded-xl bg-muted/10">
            <div className="mx-auto h-12 w-12 text-muted-foreground mb-4">
              <Camera className="h-12 w-12 opacity-20" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No shoots found</h3>
            <p className="text-muted-foreground max-w-sm mx-auto mb-6">
              It looks like you don't have any completed shoots yet. Once your shoots are ready, they will appear here.
            </p>
          </div>
        )}
      </section>

      <Separator />

      {/* About / Experience Section */}
      <section id="about" className="container px-4 md:px-6 py-20">
        <div className="grid lg:grid-cols-2 gap-16 items-start">
          <div className="space-y-8">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">About Us</h2>
              <p className="text-muted-foreground text-lg leading-relaxed">
                Passionate about capturing the essence of properties through innovative visual storytelling. 
                With over 8 years of experience in real estate photography, we help agencies and homeowners showcase 
                properties through cinematic visuals, drone perspectives, and 3D tours.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-6">
              {[
                { icon: Home, num: "500+", label: "Properties Shot" },
                { icon: Star, num: "98%", label: "Client Satisfaction" },
                { icon: Clock, num: "24h", label: "Turnaround Time" },
                { icon: Building2, num: "150+", label: "Agencies Served" },
              ].map((s, i) => (
                <Card key={i} className="border-muted/60 bg-muted/10">
                  <CardContent className="p-6 text-center">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-3">
                      <s.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="text-2xl font-bold mb-1">{s.num}</div>
                    <div className="text-sm text-muted-foreground">{s.label}</div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="space-y-6 pt-4">
              <h3 className="text-xl font-semibold flex items-center gap-2">
                <Award className="h-5 w-5 text-primary" />
                Certifications
              </h3>
              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  "FAA Part 107 Certified Pilot",
                  "Matterport 3D Specialist",
                  "PFRE Certified Professional",
                  "Zillow Certified Photographer"
                ].map((cert, i) => (
                  <div key={i} className="flex items-center gap-3 bg-background border rounded-lg p-3 shadow-sm">
                    <ScrollText className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">{cert}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Timeline / Journey */}
          <div className="bg-muted/20 rounded-2xl p-8 border">
            <h3 className="text-2xl font-bold mb-8 flex items-center gap-3">
              <Rocket className="h-6 w-6 text-primary" />
              Professional Journey
            </h3>
            <div className="space-y-8 relative pl-2">
              {/* Vertical Line */}
              <div className="absolute left-[19px] top-2 bottom-2 w-0.5 bg-border" />
              
              {[
                { year: "2016", title: "Started Photography Career", desc: "Specializing in residential real estate" },
                { year: "2018", title: "FAA Drone Certification", desc: "Licensed commercial drone operations" },
                { year: "2020", title: "3D Virtual Tours", desc: "Adopted Matterport technology" },
                { year: "2024", title: "500+ Properties Milestone", desc: "Serving top luxury agencies" },
              ].map((item, i) => (
                <div key={i} className="relative flex gap-6 items-start">
                  <div className="w-10 h-10 rounded-full bg-background border-2 border-primary flex items-center justify-center shrink-0 z-10 shadow-sm">
                    <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                  </div>
                  <div className="pt-1">
                    <span className="text-sm font-bold text-primary mb-1 block">{item.year}</span>
                    <h4 className="text-lg font-semibold mb-1">{item.title}</h4>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <Separator />

      {/* Services Section */}
      <section id="services" className="container px-4 md:px-6 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Our Services</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Comprehensive photography and videography services tailored for real estate professionals.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              icon: Home,
              title: "Residential Photography",
              bullets: ["Interior & Exterior Shots", "HDR Photography", "Twilight Photography", "Detail & Lifestyle Shots"]
            },
            {
              icon: Building2,
              title: "Commercial Properties",
              bullets: ["Office Buildings", "Retail Spaces", "Industrial Properties", "Architectural Photography"]
            },
            {
              icon: Crown,
              title: "Luxury Estates",
              bullets: ["High-End Residential", "Luxury Amenities", "Lifestyle Photography", "Premium Editing"]
            },
            {
              icon: Plane,
              title: "Drone Photography",
              bullets: ["Aerial Property Views", "Neighborhood Context", "4K Video Footage", "FAA Certified Pilot"]
            },
            {
              icon: Box,
              title: "3D Virtual Tours",
              bullets: ["Matterport Technology", "Interactive Floor Plans", "Virtual Reality Ready", "Dollhouse View"]
            },
            {
              icon: Video,
              title: "Video Production",
              bullets: ["Property Walk-throughs", "Cinematic Tours", "Agent Testimonials", "Social Media Content"]
            }
          ].map((service, idx) => (
            <Card key={idx} className="hover:shadow-lg transition-shadow border-muted/60">
              <CardHeader>
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <service.icon className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>{service.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {service.bullets.map((bullet, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      {bullet}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Equipment Section */}
      <section id="equipment" className="bg-muted/30 py-20">
        <div className="container px-4 md:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Professional Equipment</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              State-of-the-art photography and videography equipment for exceptional results.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: Camera,
                title: "Cameras",
                items: ["Canon EOS R5", "Sony A7R IV", "Nikon D850", "DJI Mavic 3 Pro"]
              },
              {
                icon: Aperture,
                title: "Lenses",
                items: ["Canon 16-35mm", "Sigma 14-24mm", "Canon 24-70mm", "Tilt-Shift"]
              },
              {
                icon: Zap,
                title: "Lighting",
                items: ["Profoto B10X Plus", "Godox AD600 Pro", "LED Light Panels", "Reflectors"]
              },
              {
                icon: Monitor,
                title: "Software",
                items: ["Adobe Lightroom", "Adobe Photoshop", "Final Cut Pro", "Matterport"]
              }
            ].map((item, idx) => (
              <Card key={idx} className="border-none shadow-sm bg-background">
                <CardHeader>
                  <div className="w-10 h-10 bg-primary/5 rounded-full flex items-center justify-center mb-2">
                    <item.icon className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{item.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {item.items.map((gear, i) => (
                      <li key={i} className="text-sm text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-md">
                        {gear}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="container px-4 md:px-6 py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-start">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to book your next shoot?</h2>
            <p className="text-muted-foreground text-lg mb-8">
              Schedule your next photography session directly through the portal or get in touch with us for custom requirements.
            </p>
            
            <div className="space-y-8 mb-10">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                  <Phone className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Phone Support</p>
                  <p className="text-muted-foreground">(555) 123-4567</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                  <Mail className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Email</p>
                  <p className="text-muted-foreground">bookings@reprophotos.com</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                  <Globe className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Service Area</p>
                  <p className="text-muted-foreground">Los Angeles & Surrounding Areas</p>
                </div>
              </div>
            </div>

            {/* Booking Process */}
            <Card className="border-muted/60 bg-muted/10">
              <CardHeader>
                <CardTitle>How it Works</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  "Initial consultation & quote",
                  "Schedule photo shoot",
                  "Professional photography session",
                  "Delivery within 24 hours"
                ].map((step, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                      {i + 1}
                    </div>
                    <span className="text-sm font-medium">{step}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card className="border-muted shadow-lg">
            <CardHeader>
              <CardTitle>Quick Inquiry</CardTitle>
              <CardDescription>Send us a message and we'll get back to you within 2 hours.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Name</label>
                  <input className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" placeholder="Your name" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Phone</label>
                  <input className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" placeholder="(555) 000-0000" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Message</label>
                <textarea className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" placeholder="Tell us about your property..." />
              </div>
              <Button className="w-full text-base py-5">Send Message & Get Quote</Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}

export default ClientPortal;
