
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ImageUpload } from "@/components/profile/ImageUpload";
import { useAuth } from "@/components/auth/AuthProvider";
import { toast } from "@/lib/sonner-toast";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MapPin, Calendar, ExternalLink, FileText, Camera, Loader2 } from "lucide-react";
import { useNavigate } from 'react-router-dom';
import { useUserPreferences } from "@/contexts/UserPreferencesContext";
import { useSelfProfileSave } from "@/hooks/useSelfProfileSave";
import { API_BASE_URL } from "@/config/env";

export function PhotographerProfile() {
  const { user, setUser } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [taxDialogOpen, setTaxDialogOpen] = useState(false);
  const [selectedTaxDocument, setSelectedTaxDocument] = useState<File | null>(null);
  const [taxNotes, setTaxNotes] = useState("");
  const [isTaxSubmitting, setIsTaxSubmitting] = useState(false);
  const navigate = useNavigate();
  const { preferences: displayPreferences, setTemperatureUnit, setTimeFormat } = useUserPreferences();
  const { saveProfile } = useSelfProfileSave();
  const userMetadata = (user?.metadata as Record<string, unknown> | undefined) ?? {};
  const savedPreferences = ((user?.metadata as Record<string, any> | undefined)?.preferences ?? {}) as Record<string, any>;
  
  const [formData, setFormData] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
    address: user?.address || "",
    city: user?.city || "",
    state: user?.state || "",
    zip: user?.zipcode || "",
    avatar: user?.avatar || "",
    portfolioWebsite: String(savedPreferences.portfolioWebsite || ""),
    weeklyInvoice: savedPreferences.weeklyInvoice ?? true,
    taxInfoSubmitted: Boolean(userMetadata.tax_document_submitted_at || userMetadata.tax_document_url),
    taxDocumentName: String(userMetadata.tax_document_name ?? ""),
    taxSubmittedAt: String(userMetadata.tax_document_submitted_at ?? ""),
    travelRange: userMetadata.travel_range ?? 25,
    travelRangeUnit: String(userMetadata.travel_range_unit ?? "miles"),
    currentPassword: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSwitchChange = (name: string, checked: boolean) => {
    setFormData(prev => ({ ...prev, [name]: checked }));
  };

  const handleAvatarChange = async (url: string) => {
    setFormData(prev => ({ ...prev, avatar: url }));

    // Don't save blob URLs to the backend
    if (url.startsWith('blob:')) return;

    try {
      const result = await saveProfile({ avatar: url || null });
      if (!result.reauthRequired) {
        toast.success(url ? "Avatar saved" : "Avatar removed");
      }
    } catch (error) {
      console.error('Error saving avatar:', error);
      toast.error("Could not save avatar. Please try again.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const result = await saveProfile({
          name: formData.name,
          email: formData.email,
          current_password: formData.email !== user?.email ? formData.currentPassword : undefined,
          phone_number: formData.phone,
          avatar: formData.avatar || null,
          address: formData.address,
          city: formData.city,
          state: formData.state,
          zip: formData.zip,
          travel_range: formData.travelRange !== "" ? Number(formData.travelRange) : null,
          travel_range_unit: formData.travelRangeUnit || 'miles',
          preferences: {
            portfolioWebsite: formData.portfolioWebsite || null,
            weeklyInvoice: formData.weeklyInvoice,
          },
      });
      if (!result.reauthRequired) {
        setFormData((prev) => ({ ...prev, currentPassword: "" }));
        toast.success(result.message);
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error(error instanceof Error ? error.message : "Failed to update profile");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTaxDocumentSubmit = async () => {
    if (!selectedTaxDocument) {
      toast.error("Please choose a tax document to upload.");
      return;
    }

    setIsTaxSubmitting(true);

    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      if (!token) {
        throw new Error("Not authenticated");
      }

      const payload = new FormData();
      payload.append('document', selectedTaxDocument);
      if (taxNotes.trim()) {
        payload.append('notes', taxNotes.trim());
      }

      const response = await fetch(`${API_BASE_URL}/api/profile/tax-document`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        body: payload,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to submit tax document');
      }

      if (data.user && user) {
        setUser({ ...user, ...data.user });
      }

      const submittedAt = data.user?.metadata?.tax_document_submitted_at || new Date().toISOString();
      const documentName = data.user?.metadata?.tax_document_name || selectedTaxDocument.name;

      setFormData((prev) => ({
        ...prev,
        taxInfoSubmitted: true,
        taxDocumentName: documentName,
        taxSubmittedAt: submittedAt,
      }));

      setSelectedTaxDocument(null);
      setTaxNotes('');
      setTaxDialogOpen(false);
      toast.success("Tax document submitted successfully.");
    } catch (error) {
      console.error('Error submitting tax document:', error);
      toast.error(error instanceof Error ? error.message : "Failed to submit tax document");
    } finally {
      setIsTaxSubmitting(false);
    }
  };

  const mockStats = {
    completedShoots: 42,
    averageRating: 4.8,
    responseTime: "1.2 hours"
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Photographer Profile</h2>
          <p className="text-muted-foreground">
            Manage your account information and photographer settings
          </p>
        </div>
        <Badge className="bg-green-600 hover:bg-green-700">Active Photographer</Badge>
      </div>

      <Separator />
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <form onSubmit={handleSubmit} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
                <CardDescription>Update your profile details</CardDescription>
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
                        <p className="text-xs text-muted-foreground">Changing your email requires your current password.</p>
                      </div>
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
                        <Label htmlFor="portfolioWebsite">Portfolio Website</Label>
                        <div className="flex">
                          <Input
                            id="portfolioWebsite"
                            name="portfolioWebsite"
                            value={formData.portfolioWebsite}
                            onChange={handleChange}
                            placeholder="https://your-portfolio.com"
                            className="rounded-r-none"
                          />
                          <Button 
                            variant="outline" 
                            type="button" 
                            className="rounded-l-none"
                            disabled={!formData.portfolioWebsite}
                            onClick={() => window.open(formData.portfolioWebsite, '_blank')}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </div>
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
                <CardTitle>Location</CardTitle>
                <CardDescription>Your address is used for shoot assignments in your area</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="address">Street Address</Label>
                    <Input
                      id="address"
                      name="address"
                      value={formData.address}
                      onChange={handleChange}
                      placeholder="123 Main St"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        name="city"
                        value={formData.city}
                        onChange={handleChange}
                        placeholder="City"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="state">State</Label>
                      <Input
                        id="state"
                        name="state"
                        value={formData.state}
                        onChange={handleChange}
                        placeholder="State"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="zip">ZIP Code</Label>
                      <Input
                        id="zip"
                        name="zip"
                        value={formData.zip}
                        onChange={handleChange}
                        placeholder="ZIP"
                      />
                    </div>
                  </div>
                  <div className="space-y-3 mt-6">
                    <div className="flex items-center justify-between">
                      <Label>Travel Range</Label>
                      <div className="flex items-center gap-1 bg-muted rounded-md p-0.5">
                        <button
                          type="button"
                          className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
                            formData.travelRangeUnit === 'miles'
                              ? 'bg-primary text-primary-foreground shadow-sm'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                          onClick={() => setFormData(prev => ({ ...prev, travelRangeUnit: 'miles' }))}
                        >
                          Miles
                        </button>
                        <button
                          type="button"
                          className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
                            formData.travelRangeUnit === 'km'
                              ? 'bg-primary text-primary-foreground shadow-sm'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                          onClick={() => setFormData(prev => ({ ...prev, travelRangeUnit: 'km' }))}
                        >
                          Km
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">How far you're willing to travel from your address for shoots</p>
                    <div className="pt-2 pb-1">
                      <Slider
                        min={1}
                        max={100}
                        step={1}
                        value={[Number(formData.travelRange) || 25]}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, travelRange: value[0] }))}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>1 {formData.travelRangeUnit}</span>
                      <span className="text-sm font-semibold text-foreground">{Number(formData.travelRange) || 25} {formData.travelRangeUnit}</span>
                      <span>100 {formData.travelRangeUnit}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Business Settings</CardTitle>
                <CardDescription>Manage your business preferences</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between border p-4 rounded-lg">
                    <div className="space-y-0.5">
                      <Label htmlFor="weeklyInvoice">Weekly Invoice</Label>
                      <p className="text-sm text-muted-foreground">Receive weekly payment summaries</p>
                    </div>
                    <Switch
                      id="weeklyInvoice"
                      checked={formData.weeklyInvoice}
                      onCheckedChange={(checked) => handleSwitchChange("weeklyInvoice", checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between border p-4 rounded-lg">
                    <div className="space-y-0.5">
                      <Label htmlFor="taxInfo">Tax Information</Label>
                      <p className="text-sm text-muted-foreground">W9 or equivalent tax documentation</p>
                      {formData.taxDocumentName && (
                        <p className="text-xs text-muted-foreground">
                          {formData.taxDocumentName}
                          {formData.taxSubmittedAt ? ` • Submitted ${new Date(formData.taxSubmittedAt).toLocaleDateString()}` : ''}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {formData.taxInfoSubmitted ? 'Submitted' : 'Required'}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant={formData.taxInfoSubmitted ? "outline" : "default"}
                        onClick={() => setTaxDialogOpen(true)}
                      >
                        {formData.taxInfoSubmitted ? 'Update' : 'Submit'}
                      </Button>
                    </div>
                  </div>
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
              </CardContent>
              <CardFooter className="flex justify-between">
                <div className="flex items-center">
                  <Button variant="outline" onClick={() => navigate('/availability')}>
                    <Calendar className="mr-2 h-4 w-4" />
                    Manage Availability
                  </Button>
                </div>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isSubmitting ? "Saving..." : "Save Changes"}
                </Button>
              </CardFooter>
            </Card>
          </form>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Performance Stats</CardTitle>
              <CardDescription>Your activity on the platform</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Completed Shoots</span>
                  <span className="font-medium">{mockStats.completedShoots}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Average Rating</span>
                  <span className="font-medium">{mockStats.averageRating}/5.0</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Response Time</span>
                  <span className="font-medium">{mockStats.responseTime}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Links</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/photographer-history')}>
                  <Camera className="mr-2 h-4 w-4" />
                  My Shoot History
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/availability')}>
                  <Calendar className="mr-2 h-4 w-4" />
                  Manage Availability
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/invoices')}>
                  <FileText className="mr-2 h-4 w-4" />
                  View Invoices
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={taxDialogOpen} onOpenChange={setTaxDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{formData.taxInfoSubmitted ? 'Update Tax Document' : 'Submit Tax Document'}</DialogTitle>
            <DialogDescription>
              Upload your W9 or equivalent tax documentation so the team can verify your payout setup.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tax-document-file">Document</Label>
              <Input
                id="tax-document-file"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                onChange={(event) => setSelectedTaxDocument(event.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground">
                Accepted: PDF, JPG, PNG, DOC, DOCX up to 10 MB.
              </p>
              {selectedTaxDocument && (
                <p className="text-sm text-foreground">{selectedTaxDocument.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="tax-document-notes">Notes (Optional)</Label>
              <Textarea
                id="tax-document-notes"
                value={taxNotes}
                onChange={(event) => setTaxNotes(event.target.value)}
                placeholder="Add any context for admin or accounting..."
                className="min-h-[100px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setTaxDialogOpen(false);
                setSelectedTaxDocument(null);
                setTaxNotes('');
              }}
              disabled={isTaxSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleTaxDocumentSubmit}
              disabled={isTaxSubmitting || !selectedTaxDocument}
            >
              {isTaxSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {formData.taxInfoSubmitted ? 'Update Document' : 'Submit Document'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
