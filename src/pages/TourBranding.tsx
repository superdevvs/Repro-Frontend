import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageTransition } from '@/components/layout/PageTransition';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/auth/AuthProvider';
import { BrandingImageUpload } from '@/components/profile/BrandingImageUpload';
import { Plus, Edit, Trash2, Building2 } from 'lucide-react';
import { API_BASE_URL } from '@/config/env';
import axios from 'axios';

interface TourBranding {
  id: string;
  company_name: string;
  logo?: string;
  primary_color?: string;
  secondary_color?: string;
  font_family?: string;
  custom_domain?: string;
  created_at?: string;
  updated_at?: string;
}

export default function TourBranding() {
  const { toast } = useToast();
  const { role } = useAuth();
  const [brandings, setBrandings] = useState<TourBranding[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBranding, setEditingBranding] = useState<TourBranding | null>(null);
  const [formData, setFormData] = useState({
    company_name: '',
    logo: '',
    primary_color: '#1a56db',
    secondary_color: '#7e3af2',
    font_family: 'Inter',
    custom_domain: '',
  });

  const isAdmin = role === 'admin' || role === 'superadmin';

  useEffect(() => {
    if (!isAdmin) return;
    fetchBrandings();
  }, [isAdmin]);

  const fetchBrandings = async () => {
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/api/tour-branding`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setBrandings(response.data.data || response.data || []);
    } catch (error: any) {
      console.error('Error fetching brandings:', error);
      toast({
        title: 'Error',
        description: 'Failed to load branding information',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (branding?: TourBranding) => {
    if (branding) {
      setEditingBranding(branding);
      setFormData({
        company_name: branding.company_name || '',
        logo: branding.logo || '',
        primary_color: branding.primary_color || '#1a56db',
        secondary_color: branding.secondary_color || '#7e3af2',
        font_family: branding.font_family || 'Inter',
        custom_domain: branding.custom_domain || '',
      });
    } else {
      setEditingBranding(null);
      setFormData({
        company_name: '',
        logo: '',
        primary_color: '#1a56db',
        secondary_color: '#7e3af2',
        font_family: 'Inter',
        custom_domain: '',
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingBranding(null);
    setFormData({
      company_name: '',
      logo: '',
      primary_color: '#1a56db',
      secondary_color: '#7e3af2',
      font_family: 'Inter',
      custom_domain: '',
    });
  };

  const handleSubmit = async () => {
    if (!formData.company_name.trim()) {
      toast({
        title: 'Error',
        description: 'Company name is required',
        variant: 'destructive',
      });
      return;
    }

    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      if (editingBranding) {
        await axios.put(
          `${API_BASE_URL}/api/tour-branding/${editingBranding.id}`,
          formData,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }
        );
        toast({
          title: 'Success',
          description: 'Branding updated successfully',
        });
      } else {
        await axios.post(`${API_BASE_URL}/api/tour-branding`, formData, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        toast({
          title: 'Success',
          description: 'Branding created successfully',
        });
      }
      handleCloseDialog();
      fetchBrandings();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to save branding',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this branding?')) return;

    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      await axios.delete(`${API_BASE_URL}/api/tour-branding/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      toast({
        title: 'Success',
        description: 'Branding deleted successfully',
      });
      fetchBrandings();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to delete branding',
        variant: 'destructive',
      });
    }
  };

  if (!isAdmin) {
    return (
      <DashboardLayout>
        <PageTransition>
          <div className="p-6">
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-muted-foreground">You don't have permission to access this page.</p>
              </CardContent>
            </Card>
          </div>
        </PageTransition>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <PageTransition>
        <div className="space-y-6 p-6">
          <PageHeader
            badge="Settings"
            title="Tour Branding Info"
            description="Manage tour branding information for clients"
            action={
              <Button onClick={() => handleOpenDialog()} className="gap-2">
                <Plus className="h-4 w-4" />
                Create Branding
              </Button>
            }
          />

          {loading ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Loading...</p>
            </div>
          ) : brandings.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground mb-4">No branding information found</p>
                <Button onClick={() => handleOpenDialog()}>Create First Branding</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {brandings.map((branding) => (
                <Card key={branding.id} className="overflow-hidden">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{branding.company_name}</CardTitle>
                        {branding.custom_domain && (
                          <CardDescription className="mt-1">
                            {branding.custom_domain}
                          </CardDescription>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenDialog(branding)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(branding.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {branding.logo && (
                      <div className="mb-4">
                        <img
                          src={branding.logo}
                          alt={`${branding.company_name} logo`}
                          className="h-16 w-auto object-contain"
                        />
                      </div>
                    )}
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-6 h-6 rounded border"
                          style={{ backgroundColor: branding.primary_color }}
                        />
                        <span className="text-muted-foreground">Primary: {branding.primary_color}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-6 h-6 rounded border"
                          style={{ backgroundColor: branding.secondary_color }}
                        />
                        <span className="text-muted-foreground">Secondary: {branding.secondary_color}</span>
                      </div>
                      {branding.font_family && (
                        <div className="text-muted-foreground">
                          Font: {branding.font_family}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingBranding ? 'Edit Branding' : 'Create Branding'}
                </DialogTitle>
                <DialogDescription>
                  {editingBranding
                    ? 'Update tour branding information'
                    : 'Create new tour branding information'}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="company_name">Company Name *</Label>
                  <Input
                    id="company_name"
                    value={formData.company_name}
                    onChange={(e) =>
                      setFormData({ ...formData, company_name: e.target.value })
                    }
                    placeholder="Enter company name"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Logo</Label>
                  <BrandingImageUpload
                    initialImage={formData.logo}
                    onChange={(url) => setFormData({ ...formData, logo: url })}
                    className="h-32 w-full"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="primary_color">Primary Color</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        id="primary_color"
                        value={formData.primary_color}
                        onChange={(e) =>
                          setFormData({ ...formData, primary_color: e.target.value })
                        }
                        className="w-16 h-10 p-1"
                      />
                      <Input
                        type="text"
                        value={formData.primary_color}
                        onChange={(e) =>
                          setFormData({ ...formData, primary_color: e.target.value })
                        }
                        placeholder="#1a56db"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="secondary_color">Secondary Color</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        id="secondary_color"
                        value={formData.secondary_color}
                        onChange={(e) =>
                          setFormData({ ...formData, secondary_color: e.target.value })
                        }
                        className="w-16 h-10 p-1"
                      />
                      <Input
                        type="text"
                        value={formData.secondary_color}
                        onChange={(e) =>
                          setFormData({ ...formData, secondary_color: e.target.value })
                        }
                        placeholder="#7e3af2"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="font_family">Font Family</Label>
                  <Input
                    id="font_family"
                    value={formData.font_family}
                    onChange={(e) =>
                      setFormData({ ...formData, font_family: e.target.value })
                    }
                    placeholder="Inter"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="custom_domain">Custom Domain</Label>
                  <Input
                    id="custom_domain"
                    value={formData.custom_domain}
                    onChange={(e) =>
                      setFormData({ ...formData, custom_domain: e.target.value })
                    }
                    placeholder="example.com"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={handleCloseDialog}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit}>
                  {editingBranding ? 'Update' : 'Create'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </PageTransition>
    </DashboardLayout>
  );
}


