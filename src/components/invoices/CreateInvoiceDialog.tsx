import { ServicePickerField } from '@/components/booking/ServicePickerField';
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { CalendarIcon, FileTextIcon, Plus, Minus } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { InvoiceData } from '@/utils/invoiceUtils';
import { useToast } from '@/hooks/use-toast';

interface CreateInvoiceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onInvoiceCreate: (invoice: InvoiceData) => void;
}

export function CreateInvoiceDialog({ isOpen, onClose, onInvoiceCreate }: CreateInvoiceDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  const [client, setClient] = useState('');
  const [property, setProperty] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState<Date>(new Date());
  const [dueDate, setDueDate] = useState<Date>(new Date(Date.now() + 15 * 24 * 60 * 60 * 1000));
  const [services, setServices] = useState<string[]>(['Photography']);
  
  const handleAddService = () => {
    setServices([...services, '']);
  };
  
  const handleRemoveService = (index: number) => {
    setServices(services.filter((_, i) => i !== index));
  };
  
  const handleServiceChange = (index: number, value: string) => {
    const updatedServices = [...services];
    updatedServices[index] = value;
    setServices(updatedServices);
  };

  const handleCreateInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!client || !property || !amount || !services.length || services.some(service => !service)) {
      toast({
        title: "Validation Error",
        description: "Please fill out all required fields",
        variant: "destructive",
      });
      return;
    }
    
    setLoading(true);
    
    const randomNum = Math.floor(Math.random() * 900) + 100;
    const invoiceId = `INV-${randomNum}`;
    
    const formattedDate = format(date, 'yyyy-MM-dd');
    const formattedDueDate = format(dueDate, 'yyyy-MM-dd');
    
    const newInvoice: InvoiceData = {
      id: invoiceId,
      number: invoiceId,
      client: client,
      property: property,
      date: formattedDate,
      dueDate: formattedDueDate,
      amount: parseFloat(amount),
      status: 'pending' as const,
      services: services.filter(service => service !== ''),
      paymentMethod: 'Pending'
    };
    
    setTimeout(() => {
      setLoading(false);
      onInvoiceCreate(newInvoice);
      toast({
        title: "Invoice Created",
        description: `Invoice ${invoiceId} has been created successfully.`,
        variant: "default",
      });
      
      setClient('');
      setProperty('');
      setAmount('');
      setDate(new Date());
      setDueDate(new Date(Date.now() + 15 * 24 * 60 * 60 * 1000));
      setServices(['Photography']);
      
      onClose();
    }, 1000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md md:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create New Invoice</DialogTitle>
          <DialogDescription>
            Fill out the form below to create a new invoice
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleCreateInvoice} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="client">Client Name</Label>
            <Input 
              id="client" 
              placeholder="Enter client name" 
              value={client}
              onChange={(e) => setClient(e.target.value)}
              required 
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="property">Property Address</Label>
            <Input 
              id="property" 
              placeholder="Enter property address" 
              value={property}
              onChange={(e) => setProperty(e.target.value)}
              required 
            />
          </div>
          
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Invoice Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(date) => date && setDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dueDate ? format(dueDate, "PPP") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dueDate}
                    onSelect={(date) => date && setDueDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label>Services</Label>
            {services.map((service, index) => (
              <div key={index} className="flex items-center space-x-2">
                <ServicePickerField label="Choose invoice service" value={service}
                  onValueChange={value => handleServiceChange(index, value)} hidePrices
                  options={['Photography', 'Videography', 'Drone', 'Virtual Staging', 'Floorplans', '3D Tour'].map(name => ({ id: name, name, category: name }))} />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleRemoveService(index)}
                  disabled={services.length <= 1}
                >
                  <Minus className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={handleAddService}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Service
            </Button>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="amount">Invoice Amount ($)</Label>
            <Input 
              id="amount" 
              type="number" 
              step="0.01"
              min="0"
              placeholder="0.00" 
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required 
            />
          </div>
          
          <DialogFooter className="pt-4">
            <Button variant="outline" type="button" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>Processing...</>
              ) : (
                <>
                  <FileTextIcon className="h-4 w-4 mr-2" />
                  Create Invoice
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
