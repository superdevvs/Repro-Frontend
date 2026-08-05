import type { FormEventHandler } from 'react';
import { ExternalLink } from 'lucide-react';

import { BrandingImageUpload } from '@/components/profile/BrandingImageUpload';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

const HERO_IMAGES = [
  { id: '', label: 'None (Gradient)' },
  { id: 'header-1', label: 'Harbor Beach' },
  { id: 'header-2', label: 'Coastal Aerial' },
  { id: 'header-3', label: 'Residential Aerial' },
  { id: 'header-4', label: 'Suburban Homes' },
  { id: 'header-5', label: 'Luxury Hillside' },
  { id: 'header-6', label: 'Colorful Townhouses' },
  { id: 'header-7', label: 'Modern Office' },
  { id: 'header-8', label: 'Highland Houses' },
  { id: 'header-9', label: 'City Skyline' },
  { id: 'header-10', label: 'Family Home' },
  { id: 'header-11', label: 'Real Estate Agent' },
  { id: 'header-12', label: 'Modern Architecture' },
  { id: 'header-13', label: 'Neighborhood' },
] as const;

interface SettingsBrandingTabProps {
  portfolioUserId?: string | number;
  onSubmit: FormEventHandler<HTMLFormElement>;
  brandLogo: string;
  onLogoChange: (url: string) => void;
  brandBanner: string;
  onBannerChange: (url: string) => void;
  brandAbout: string;
  onBrandAboutChange: (value: string) => void;
  heroHeadline: string;
  onHeroHeadlineChange: (value: string) => void;
  heroSubtitle: string;
  onHeroSubtitleChange: (value: string) => void;
  heroImage: string;
  onHeroImageChange: (value: string) => void;
  facebookUrl: string;
  onFacebookUrlChange: (value: string) => void;
  linkedinUrl: string;
  onLinkedinUrlChange: (value: string) => void;
  instagramUrl: string;
  onInstagramUrlChange: (value: string) => void;
  showMap: boolean;
  onShowMapChange: (value: boolean) => void;
}

export function SettingsBrandingTab({
  portfolioUserId,
  onSubmit,
  brandLogo,
  onLogoChange,
  brandBanner,
  onBannerChange,
  brandAbout,
  onBrandAboutChange,
  heroHeadline,
  onHeroHeadlineChange,
  heroSubtitle,
  onHeroSubtitleChange,
  heroImage,
  onHeroImageChange,
  facebookUrl,
  onFacebookUrlChange,
  linkedinUrl,
  onLinkedinUrlChange,
  instagramUrl,
  onInstagramUrlChange,
  showMap,
  onShowMapChange,
}: SettingsBrandingTabProps) {
  return (
    <TabsContent value="branding" className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Branding</CardTitle>
              <CardDescription>Upload your company logo and branding images</CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (portfolioUserId) {
                  window.open(`/client-portal?clientId=${portfolioUserId}`, '_blank');
                }
              }}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              View Portfolio
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Company Logo</h3>
                <p className="text-sm text-muted-foreground">
                  This logo will appear on your invoices and client communications.
                </p>
                <BrandingImageUpload
                  onChange={onLogoChange}
                  initialImage={brandLogo}
                  aspectRatio="1/1"
                  maxWidth={200}
                  helperText="Recommended size: 200x200px (square)"
                />
              </div>
              <div className="space-y-4">
                <h3 className="text-lg font-medium">About Image</h3>
                <p className="text-sm text-muted-foreground">
                  This image appears in the About section of your portfolio.
                </p>
                <BrandingImageUpload
                  onChange={onBannerChange}
                  initialImage={brandBanner}
                  aspectRatio="4/3"
                  maxWidth={300}
                  helperText="Recommended size: 600x450px (4:3)"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="brand-colors" className="text-sm font-medium">Brand Colors</label>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {[
                    ['Primary', '#0070f3'],
                    ['Secondary', '#f5f5f5'],
                    ['Accent', '#ff4500'],
                    ['Text', '#333333'],
                  ].map(([label, color]) => (
                    <div key={label} className="space-y-1">
                      <span className="text-xs text-muted-foreground">{label}</span>
                      <Input type="color" defaultValue={color} className="h-10 p-1" />
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label htmlFor="tagline" className="text-sm font-medium">Company Tagline</label>
                <Input id="tagline" placeholder="Your business tagline" />
              </div>
              <div className="space-y-2">
                <label htmlFor="brand-about" className="text-sm font-medium">Portfolio About</label>
                <Textarea
                  id="brand-about"
                  placeholder="Short description to show in the client portfolio About section"
                  value={brandAbout}
                  onChange={(event) => onBrandAboutChange(event.target.value)}
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  This text appears in the client-facing portfolio About section.
                </p>
              </div>

              <div className="mt-2 border-t pt-4">
                <h3 className="mb-3 text-lg font-medium">Portfolio Hero Section</h3>
                <p className="mb-3 text-sm text-muted-foreground">
                  Customize the headline, subtitle, and background image on your portfolio page.
                </p>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label htmlFor="hero_headline" className="text-sm font-medium">Hero Headline</label>
                    <Input
                      id="hero_headline"
                      value={heroHeadline}
                      onChange={(event) => onHeroHeadlineChange(event.target.value)}
                      placeholder="Your Real Estate Portfolio"
                    />
                    <p className="text-xs text-muted-foreground">
                      This headline is shown to visitors on your portfolio page. Use{' '}
                      <code className="rounded bg-muted px-1">{'{name}'}</code> to insert the visitor&apos;s name.
                    </p>
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="hero_subtitle" className="text-sm font-medium">Hero Subtitle</label>
                    <Textarea
                      id="hero_subtitle"
                      value={heroSubtitle}
                      onChange={(event) => onHeroSubtitleChange(event.target.value)}
                      placeholder="Explore our latest property listings with high-resolution photography and virtual tours."
                      rows={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Hero Background Image</label>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                      {HERO_IMAGES.map((image) => (
                        <button
                          key={image.id}
                          type="button"
                          onClick={() => onHeroImageChange(image.id)}
                          className={`relative overflow-hidden rounded-lg border-2 transition-all ${
                            heroImage === image.id
                              ? 'border-primary ring-2 ring-primary/30'
                              : 'border-border hover:border-muted-foreground/50'
                          }`}
                        >
                          {image.id ? (
                            <img
                              src={`/images/portfolio-headers/${image.id}.jpg`}
                              alt={image.label}
                              className="aspect-[16/9] w-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex aspect-[16/9] w-full items-center justify-center bg-gradient-to-br from-background via-muted/30 to-primary/5">
                              <span className="text-xs text-muted-foreground">Default</span>
                            </div>
                          )}
                          <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1 py-1 text-center text-[10px] text-white">
                            {image.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-2 border-t pt-4">
                <h3 className="mb-3 text-lg font-medium">Social Links</h3>
                <div className="space-y-3">
                  {[
                    ['facebook_url', 'Facebook URL', facebookUrl, onFacebookUrlChange, 'https://facebook.com/yourpage'],
                    ['linkedin_url', 'LinkedIn URL', linkedinUrl, onLinkedinUrlChange, 'https://linkedin.com/in/yourprofile'],
                    ['instagram_url', 'Instagram URL', instagramUrl, onInstagramUrlChange, 'https://instagram.com/yourhandle'],
                  ].map(([id, label, value, onChange, placeholder]) => (
                    <div key={id as string} className="space-y-1">
                      <label htmlFor={id as string} className="text-sm font-medium">{label as string}</label>
                      <Input
                        id={id as string}
                        value={value as string}
                        onChange={(event) => (onChange as (next: string) => void)(event.target.value)}
                        placeholder={placeholder as string}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Show Map in Contact</p>
                    <p className="text-xs text-muted-foreground">
                      Toggle the map embed in the client portfolio contact section.
                    </p>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={showMap}
                      onChange={(event) => onShowMapChange(event.target.checked)}
                    />
                    <div className="h-6 w-11 rounded-full bg-muted-foreground after:absolute after:start-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white rtl:peer-checked:after:-translate-x-full" />
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit">Save Branding</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </TabsContent>
  );
}
