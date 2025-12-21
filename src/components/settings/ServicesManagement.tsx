
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { CategorySelect } from './CategorySelect';
import { useServiceCategories } from '@/hooks/useServiceCategories';
import { useServices } from '@/hooks/useServices';
import { useToast } from '@/hooks/use-toast';
import axios from 'axios';
import { API_BASE_URL } from '@/config/env';
import { 
  PlusIcon, 
  EditIcon, 
  Trash2Icon,
  Search
} from 'lucide-react';

export function ServicesManagement() {
  const { toast } = useToast();
  const { data: categories, isLoading: categoriesLoading } = useServiceCategories();
  const { data: services, isLoading: servicesLoading, refetch: refetchServices } = useServices();
  const [activeTab, setActiveTab] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentService, setCurrentService] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    category_id: '',
    price: '',
    description: '',
    delivery_time: '',
  });

  // Filter services based on active tab and search term
  const filteredServices = services?.filter(service => {
    const matchesCategory = activeTab === 'all' || service.category_id === activeTab;
    const matchesSearch = service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         service.description?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'price' ? value.replace(/[^0-9.]/g, '') : value
    }));
  };

  const handleSubmit = async () => {
    try {
      // Find the category name based on the selected category_id
      const selectedCategory = categories?.find(cat => cat.id === formData.category_id);
      if (!selectedCategory) {
        toast({
          title: "Error",
          description: "Please select a valid category",
          variant: "destructive",
        });
        return;
      }

      const serviceData = {
        name: formData.name,
        category_id: formData.category_id,
        category: selectedCategory.name, // Add the category name
        price: parseFloat(formData.price),
        description: formData.description || `Professional ${formData.name} service for real estate marketing.`,
        delivery_time: formData.delivery_time ? parseInt(formData.delivery_time) : undefined,
      };

      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('No auth token found');
      }

      if (isEditing && currentService) {
        await axios.put(
          `${API_BASE_URL}/api/admin/services/${currentService.id}`,
          {
            name: serviceData.name,
            description: serviceData.description,
            price: serviceData.price,
            delivery_time: formData.delivery_time ? Number(formData.delivery_time) : undefined,
            category_id: serviceData.category_id,
          },
          {
            headers: {
              Accept: 'application/json',
              Authorization: `Bearer ${token}`,
            },
          },
        );
        toast({
          title: 'Service Updated',
          description: `${serviceData.name} has been updated successfully.`,
        });
      } else {
        await axios.post(
          `${API_BASE_URL}/api/admin/services`,
          {
            name: serviceData.name,
            description: serviceData.description,
            price: serviceData.price,
            delivery_time: formData.delivery_time ? Number(formData.delivery_time) : undefined,
            category_id: serviceData.category_id,
          },
          {
            headers: {
              Accept: 'application/json',
              Authorization: `Bearer ${token}`,
            },
          },
        );
        toast({
          title: 'Service Added',
          description: `${serviceData.name} has been added successfully.`,
        });
      }

      setDialogOpen(false);
      refetchServices();
    } catch (error) {
      console.error('Error saving service:', error);
      toast({
        title: "Error",
        description: "There was an error saving the service. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('No auth token found');
      }

      await axios.delete(`${API_BASE_URL}/api/admin/services/${serviceId}`, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      toast({
        title: "Service Deleted",
        description: "The service has been removed successfully.",
        variant: "default",
      });

      refetchServices();
    } catch (error) {
      console.error('Error deleting service:', error);
      toast({
        title: "Error",
        description: "There was an error deleting the service. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleAddService = () => {
    setIsEditing(false);
    setCurrentService(null);
    setFormData({
      name: '',
      category_id: categories?.[0]?.id || '',
      price: '',
      description: ''
    });
    setDialogOpen(true);
  };

  const handleEditService = (service: any) => {
    setIsEditing(true);
    setCurrentService(service);
    setFormData({
      name: service.name,
      category_id: service.category_id,
      price: service.price.toString(),
      description: service.description || ''
    });
    setDialogOpen(true);
  };

  if (categoriesLoading || servicesLoading) {
    return <div>Loading...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between">
          <CardTitle>Services Management</CardTitle>
          <Button onClick={handleAddService} size="sm" className="gap-1">
            <PlusIcon className="h-4 w-4" />
            Add Service
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <Tabs 
              defaultValue="all" 
              value={activeTab} 
              onValueChange={setActiveTab}
              className="w-full"
            >
              <TabsList className="flex flex-wrap">
                <TabsTrigger value="all">All</TabsTrigger>
                {categories?.map((category) => (
                  <TabsTrigger 
                    key={category.id} 
                    value={category.id}
                    className="capitalize"
                  >
                    {category.name}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search services..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 w-full"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredServices?.map(service => (
              <Card key={service.id} className="overflow-hidden border border-border hover:shadow-md transition-shadow">
                <CardContent className="p-0">
                  <div className="p-4 border-b border-border">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium">{service.name}</h3>
                        <Badge variant="outline" className="mt-1 capitalize">
                          {service.service_categories?.name}
                        </Badge>
                      </div>
                      <span className="font-bold text-lg">${service.price}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                      {service.description}
                    </p>
                  </div>
                  <div className="flex divide-x divide-border">
                    <Button 
                      variant="ghost" 
                      className="flex-1 rounded-none h-10" 
                      onClick={() => handleEditService(service)}
                    >
                      <EditIcon className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <Button 
                      variant="ghost" 
                      className="flex-1 rounded-none h-10 text-destructive hover:text-destructive" 
                      onClick={() => handleDeleteService(service.id)}
                    >
                      <Trash2Icon className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {filteredServices?.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center py-8 text-center">
                <p className="text-muted-foreground">No services found.</p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
      
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Edit Service' : 'Add New Service'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Service Name</Label>
              <Input
                id="name"
                name="name"
                placeholder="Enter service name"
                value={formData.name}
                onChange={handleInputChange}
              />
            </div>
            
            <CategorySelect 
              value={formData.category_id}
              onChange={(value) => setFormData(prev => ({ ...prev, category_id: value }))}
            />
            
            <div className="grid gap-2">
              <Label htmlFor="price">Price ($)</Label>
              <Input
                id="price"
                name="price"
                placeholder="Enter price"
                value={formData.price}
                onChange={handleInputChange}
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                name="description"
                placeholder="Enter service description"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={formData.description}
                onChange={handleInputChange}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>
              {isEditing ? 'Update Service' : 'Add Service'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
