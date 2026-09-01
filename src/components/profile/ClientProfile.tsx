
import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImageUpload } from "@/components/profile/ImageUpload";
import { useAuth } from "@/components/auth/AuthProvider";
import { toast } from "@/lib/sonner-toast";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Facebook, Linkedin, Loader2, Twitter } from "lucide-react";
import { useUserPreferences } from "@/contexts/UserPreferencesContext";
import { useSelfProfileSave } from "@/hooks/useSelfProfileSave";
import { EmailHealthBadge } from "@/components/accounts/EmailHealthBadge";
import { ClientEmailHealthNotice } from "@/components/email/ClientEmailHealthNotice";
import { EmailHealthInlineHint } from "@/components/email/EmailHealthInlineHint";
import { analyzeEmailInput, normalizeEmailHealth } from "@/utils/emailHealth";
import { useResendVerificationEmail } from "@/hooks/useResendVerificationEmail";
import { API_ROUTES } from "@/lib/api";

type PhotographerOption = {
  id: string;
  name: string;
};

export function ClientProfile() {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { isResendingVerification, resendVerification, resendFeedback } = useResendVerificationEmail();
  const [serverEmailHealth, setServerEmailHealth] = useState(normalizeEmailHealth(user?.email_health));
  const [emailWarningOverride, setEmailWarningOverride] = useState(false);
  const { preferences: displayPreferences, setTemperatureUnit, setTimeFormat } = useUserPreferences();
  const { saveProfile } = useSelfProfileSave();
  const metadata = (user?.metadata as Record<string, unknown> | undefined) ?? {};
  const savedPreferences = metadata.preferences && typeof metadata.preferences === 'object'
    ? metadata.preferences as Record<string, unknown>
    : {};
  const [photographers, setPhotographers] = useState<PhotographerOption[]>([]);
  const [isLoadingPhotographers, setIsLoadingPhotographers] = useState(true);
  const [photographersError, setPhotographersError] = useState('');
  
  const [formData, setFormData] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
    company: user?.company || "",
    avatar: user?.avatar || "",
    about: user?.about || "",
    facebookUrl: user?.facebookUrl || "",
    twitterUrl: user?.twitterUrl || "",
    linkedinUrl: user?.linkedinUrl || "",
    pinterestUrl: user?.pinterestUrl || "",
    preferredPhotographer: String(savedPreferences.preferredPhotographer || "any"),
    notificationEmail: typeof savedPreferences.notificationEmail === 'boolean'
      ? savedPreferences.notificationEmail
      : true,
    billingAddress: user?.address || "",
    billingCity: user?.city || "",
    billingState: user?.state || "",
    billingZip: user?.zipcode || "",
    currentPassword: "",
  });
  const localEmailHint = useMemo(
    () => (formData.email !== user?.email ? analyzeEmailInput(formData.email) : { level: 'none' as const }),
    [formData.email, user?.email],
  );

  useEffect(() => {
    setServerEmailHealth(normalizeEmailHealth(user?.email_health));
  }, [user?.email_health]);

  useEffect(() => {
    const abortController = new AbortController();

    const loadPhotographers = async () => {
      setIsLoadingPhotographers(true);
      setPhotographersError('');

      try {
        const response = await fetch(API_ROUTES.people.photographers, {
          headers: { Accept: 'application/json' },
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error('Unable to load photographers');
        }

        const payload = await response.json() as unknown;
        const records = Array.isArray(payload)
          ? payload
          : payload && typeof payload === 'object' && Array.isArray((payload as Record<string, unknown>).data)
            ? (payload as { data: unknown[] }).data
            : [];
        const seenIds = new Set<string>();
        const options = records.reduce<PhotographerOption[]>((result, record) => {
          if (!record || typeof record !== 'object') {
            return result;
          }

          const photographer = record as Record<string, unknown>;
          const id = photographer.id == null ? '' : String(photographer.id);
          const name = typeof photographer.name === 'string' ? photographer.name.trim() : '';
          if (!id || !name || seenIds.has(id)) {
            return result;
          }

          seenIds.add(id);
          result.push({ id, name });
          return result;
        }, []);

        setPhotographers(options);
      } catch (error) {
        if (!abortController.signal.aborted) {
          console.error('Failed to load preferred photographer options:', error);
          setPhotographers([]);
          setPhotographersError('Photographer options could not be loaded. Please try again later.');
        }
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoadingPhotographers(false);
        }
      }
    };

    loadPhotographers();
    return () => abortController.abort();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSwitchChange = (name: string, checked: boolean) => {
    setFormData(prev => ({ ...prev, [name]: checked }));
  };

  const handleAvatarChange = (url: string) => {
    setFormData(prev => ({ ...prev, avatar: url }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  useEffect(() => {
    if (formData.email === user?.email) {
      setEmailWarningOverride(false);
      setServerEmailHealth(normalizeEmailHealth(user?.email_health));
      return;
    }

    setEmailWarningOverride(false);
    setServerEmailHealth(undefined);
  }, [formData.email, user?.email, user?.email_health]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      if (formData.email !== user?.email && localEmailHint.requiresConfirmation && !emailWarningOverride) {
        toast.error(localEmailHint.message || "Please confirm this email address before saving.");
        setIsSubmitting(false);
        return;
      }

      const result = await saveProfile({
          name: formData.name,
          email: formData.email,
          email_warning_override: formData.email !== user?.email ? emailWarningOverride : undefined,
          current_password: formData.email !== user?.email ? formData.currentPassword : undefined,
          phone_number: formData.phone,
          company_name: formData.company,
          avatar: formData.avatar || null,
          about: formData.about,
          facebook_url: formData.facebookUrl,
          twitter_url: formData.twitterUrl,
          linkedin_url: formData.linkedinUrl,
          pinterest_url: formData.pinterestUrl,
          address: formData.billingAddress,
          city: formData.billingCity,
          state: formData.billingState,
          zip: formData.billingZip,
          preferences: {
            preferredPhotographer: formData.preferredPhotographer,
            notificationEmail: formData.notificationEmail,
          },
      });
      if (!result.reauthRequired) {
        setFormData((prev) => ({ ...prev, currentPassword: "" }));
        setEmailWarningOverride(false);
        setServerEmailHealth(normalizeEmailHealth(result.user?.email_health));
        toast.success(result.message);
      }
    } catch (error: unknown) {
      const errorRecord = error && typeof error === 'object' ? error as Record<string, unknown> : {};
      const errorPayload = errorRecord.payload && typeof errorRecord.payload === 'object'
        ? errorRecord.payload as Record<string, unknown>
        : {};
      const nextEmailHealth = normalizeEmailHealth(errorPayload.email_health);
      if (nextEmailHealth) {
        setServerEmailHealth(nextEmailHealth);
      }
      console.error('Error updating profile:', error);
      toast.error(error instanceof Error ? error.message : "Failed to update profile");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendVerification = async () => {
    await resendVerification();
  };

  const selectedPhotographerIsUnavailable = formData.preferredPhotographer !== 'any'
    && !photographers.some((photographer) => photographer.id === formData.preferredPhotographer);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Client Profile</h2>
          <p className="text-muted-foreground">
            Manage your account information and preferences
          </p>
        </div>
        {user?.email_health?.status ? (
          <EmailHealthBadge emailHealth={user.email_health} />
        ) : (
          <Badge variant="outline">Client account</Badge>
        )}
      </div>

      <Separator />

      <ClientEmailHealthNotice
        email={user?.email}
        emailHealth={normalizeEmailHealth(user?.email_health)}
        onManageEmail={() => {
          const emailField = document.getElementById('email');
          emailField?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          emailField?.focus();
        }}
        onResendVerification={handleResendVerification}
        resendPending={isResendingVerification}
        resendFeedback={resendFeedback}
      />

      <form onSubmit={handleSubmit} className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>Update your personal and contact information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col items-center sm:flex-row sm:items-start gap-6">
              <ImageUpload 
                onChange={handleAvatarChange}
                initialImage={formData.avatar}
              />
              <div className="space-y-4 flex-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="Your full name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="you@example.com"
                    />
                    <EmailHealthInlineHint
                      email={formData.email}
                      localHint={localEmailHint}
                      serverEmailHealth={serverEmailHealth}
                      warningOverride={emailWarningOverride}
                      onUseSuggestion={(nextEmail) => {
                        setFormData((prev) => ({ ...prev, email: nextEmail }));
                        setEmailWarningOverride(false);
                        setServerEmailHealth(undefined);
                      }}
                      onKeepAnyway={() => {
                        setEmailWarningOverride(true);
                      }}
                      className="mt-3"
                    />
                    <p className="text-xs text-muted-foreground">Changing your email requires your current password.</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder="(123) 456-7890"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company">Company Name</Label>
                    <Input
                      id="company"
                      name="company"
                      value={formData.company}
                      onChange={handleChange}
                      placeholder="Your company name"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="currentPassword">Current Password</Label>
                    <Input
                      id="currentPassword"
                      name="currentPassword"
                      type="password"
                      value={formData.currentPassword}
                      onChange={handleChange}
                      placeholder="Required only if you change your email"
                    />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>About & Social Media</CardTitle>
            <CardDescription>Add your bio and social links — these appear on your public portfolio page</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="about">About / Bio</Label>
              <Textarea
                id="about"
                name="about"
                value={formData.about}
                onChange={handleChange}
                placeholder="Tell visitors about yourself or your business..."
                rows={3}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="facebookUrl" className="flex items-center gap-2">
                  <Facebook className="h-4 w-4 text-[#1877F2]" />
                  Facebook
                </Label>
                <Input
                  id="facebookUrl"
                  name="facebookUrl"
                  value={formData.facebookUrl}
                  onChange={handleChange}
                  placeholder="https://facebook.com/yourpage"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="twitterUrl" className="flex items-center gap-2">
                  <Twitter className="h-4 w-4" />
                  X (Twitter)
                </Label>
                <Input
                  id="twitterUrl"
                  name="twitterUrl"
                  value={formData.twitterUrl}
                  onChange={handleChange}
                  placeholder="https://x.com/yourhandle"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="linkedinUrl" className="flex items-center gap-2">
                  <Linkedin className="h-4 w-4 text-[#0A66C2]" />
                  LinkedIn
                </Label>
                <Input
                  id="linkedinUrl"
                  name="linkedinUrl"
                  value={formData.linkedinUrl}
                  onChange={handleChange}
                  placeholder="https://linkedin.com/in/yourprofile"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pinterestUrl" className="flex items-center gap-2">
                  <svg className="h-4 w-4 text-[#E60023]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738.098.119.112.224.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/>
                  </svg>
                  Pinterest
                </Label>
                <Input
                  id="pinterestUrl"
                  name="pinterestUrl"
                  value={formData.pinterestUrl}
                  onChange={handleChange}
                  placeholder="https://pinterest.com/yourprofile"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Preferences</CardTitle>
            <CardDescription>Customize your experience on our platform</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="preferredPhotographer">Preferred Photographer</Label>
              <Select 
                value={formData.preferredPhotographer} 
                onValueChange={(value) => handleSelectChange("preferredPhotographer", value)}
                disabled={isLoadingPhotographers}
              >
                <SelectTrigger id="preferredPhotographer">
                  <SelectValue placeholder={isLoadingPhotographers ? 'Loading photographers...' : 'Select preferred photographer'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">No Preference</SelectItem>
                  {selectedPhotographerIsUnavailable && (
                    <SelectItem value={formData.preferredPhotographer}>
                      Previously selected photographer (unavailable)
                    </SelectItem>
                  )}
                  {photographers.map(photographer => (
                    <SelectItem key={photographer.id} value={photographer.id}>
                      {photographer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {photographersError && (
                <p className="text-sm text-destructive" role="status">{photographersError}</p>
              )}
              {!isLoadingPhotographers && !photographersError && photographers.length === 0 && (
                <p className="text-sm text-muted-foreground">No photographers are currently available.</p>
              )}
            </div>
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Notification Preferences</h4>
              <div className="grid grid-cols-1 gap-4">
                <div className="flex items-center justify-between border p-4 rounded-lg">
                  <div className="space-y-0.5">
                    <Label htmlFor="notificationEmail">Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">Email me when I receive a new internal dashboard message</p>
                  </div>
                  <Switch
                    id="notificationEmail"
                    checked={formData.notificationEmail}
                    onCheckedChange={(checked) => handleSwitchChange("notificationEmail", checked)}
                  />
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Display Preferences</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between border p-4 rounded-lg">
                  <div className="space-y-0.5">
                    <Label htmlFor="temperatureUnit">Temperature Unit</Label>
                    <p className="text-sm text-muted-foreground">
                        {displayPreferences.temperatureUnit === 'celsius' ? 'Celsius (°C)' : 'Fahrenheit (°F)'}
                      </p>
                  </div>
                  <Switch
                    id="temperatureUnit"
                    checked={displayPreferences.temperatureUnit === 'celsius'}
                    onCheckedChange={(checked) => setTemperatureUnit(checked ? 'celsius' : 'fahrenheit')}
                  />
                </div>
                <div className="flex items-center justify-between border p-4 rounded-lg">
                  <div className="space-y-0.5">
                    <Label htmlFor="timeFormat">24-Hour Time Format</Label>
                    <p className="text-sm text-muted-foreground">
                        {displayPreferences.timeFormat === '24h' ? '24-hour format (14:30)' : '12-hour format (2:30 PM)'}
                      </p>
                  </div>
                  <Switch
                    id="timeFormat"
                    checked={displayPreferences.timeFormat === '24h'}
                    onCheckedChange={(checked) => setTimeFormat(checked ? '24h' : '12h')}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Billing Address</CardTitle>
            <CardDescription>Your billing information for invoices</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label htmlFor="billingAddress">Street Address</Label>
                <Input
                  id="billingAddress"
                  name="billingAddress"
                  value={formData.billingAddress}
                  onChange={handleChange}
                  placeholder="123 Main St"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="billingCity">City</Label>
                  <Input
                    id="billingCity"
                    name="billingCity"
                    value={formData.billingCity}
                    onChange={handleChange}
                    placeholder="City"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="billingState">State</Label>
                  <Input
                    id="billingState"
                    name="billingState"
                    value={formData.billingState}
                    onChange={handleChange}
                    placeholder="State"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="billingZip">ZIP Code</Label>
                  <Input
                    id="billingZip"
                    name="billingZip"
                    value={formData.billingZip}
                    onChange={handleChange}
                    placeholder="ZIP"
                  />
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <div className="flex items-center space-x-2">
              <Badge variant="outline" className="text-muted-foreground">
                <div className="flex items-center gap-1">
                  <span>Assigned Rep: {user?.metadata?.accountRep || 'Not assigned'}</span>
                </div>
              </Badge>
            </div>
            <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isSubmitting ? "Updating..." : "Update My Info"}
                </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
