import React, { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { CameraIcon, UploadIcon, X } from 'lucide-react';
import { AccountForm, AccountFormValues } from '@/components/accounts/AccountForm';

export type ClientFormData = {
  name: string;
  company: string;
  email: string;
  phone: string;
  address: string;
  status: 'active' | 'inactive';
  avatar: string;
  // optional fields that might map from AccountForm
  city?: string;
  state?: string;
  zipcode?: string;
  licenseNumber?: string;
  companyNotes?: string;
};

interface ClientFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: ClientFormData;
  setFormData: React.Dispatch<React.SetStateAction<ClientFormData>>;
  isEditing: boolean;
  showUploadOptions: boolean;
  setShowUploadOptions: (show: boolean) => void;
  onSubmit: () => void;
}

export const ClientForm: React.FC<ClientFormProps> = ({
  open,
  onOpenChange,
  formData,
  setFormData,
  isEditing,
  showUploadOptions,
  setShowUploadOptions,
  onSubmit
}) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // AccountForm modal state
  const [accountFormOpen, setAccountFormOpen] = useState(false);
  const [accountInitial, setAccountInitial] = useState<AccountFormValues | undefined>(undefined);

  useEffect(() => {
    // whenever ClientForm opens, prepare AccountForm initial data (but don't auto-open)
    if (open) {
      setAccountInitial(mapClientToAccount(formData, isEditing));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, formData, isEditing]);

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleStatusChange = (value: 'active' | 'inactive') => {
    setFormData(prev => ({
      ...prev,
      status: value
    }));
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast({
          title: 'Invalid file type',
          description: 'Please upload an image file (JPEG, PNG, etc.)',
          variant: 'destructive',
        });
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: 'File too large',
          description: 'Please upload an image smaller than 5MB',
          variant: 'destructive',
        });
        return;
      }

      const url = URL.createObjectURL(file);
      setFormData(prev => ({
        ...prev,
        avatar: url
      }));
      setShowUploadOptions(false);

      toast({
        title: 'File uploaded',
        description: `${file.name} has been uploaded successfully.`,
      });
    }
  };

  const handleExternalUpload = (source: 'google-drive' | 'dropbox') => {
    let serviceName = source === 'google-drive' ? 'Google Drive' : 'Dropbox';

    toast({
      title: `Connecting to ${serviceName}`,
      description: `Opening ${serviceName} file picker...`,
    });

    setTimeout(() => {
      const placeholderUrl = source === 'google-drive'
        ? 'https://ui.shadcn.com/avatars/02.png'
        : 'https://ui.shadcn.com/avatars/03.png';

      setFormData(prev => ({
        ...prev,
        avatar: placeholderUrl
      }));
      setShowUploadOptions(false);

      toast({
        title: 'File uploaded',
        description: `Image from ${serviceName} has been uploaded successfully.`,
      });
    }, 1200);
  };

  // Map ClientFormData -> AccountFormValues
  function mapClientToAccount(client: ClientFormData, isEditingFlag: boolean): AccountFormValues {
    const trimmedName = client.name?.trim() || "";
    const [firstName = "", ...rest] = trimmedName.split(" ");
    const lastName = rest.join(" ").trim();
    return {
      firstName,
      lastName,
      email: client.email || '',
      role: 'client',
      phone: client.phone || '',
      address: client.address || '',
      city: client.city || '',
      state: client.state || '',
      zipcode: client.zipcode || '',
      company: client.company || '',
      licenseNumber: client.licenseNumber || '',
      avatar: client.avatar || '',
      companyNotes: client.companyNotes || '',
      isActive: client.status === 'active'
    };
  }

  // Map AccountFormValues -> ClientFormData (merge into current formData)
  function applyAccountValuesToClient(account: AccountFormValues) {
    const combinedName = `${account.firstName || ""} ${account.lastName || ""}`.trim();
    setFormData(prev => ({
      ...prev,
      name: combinedName || prev.name,
      email: account.email,
      phone: account.phone || prev.phone,
      address: account.address || prev.address,
      city: account.city || prev.city,
      state: account.state || prev.state,
      zipcode: account.zipcode || prev.zipcode,
      company: account.company || prev.company,
      licenseNumber: account.licenseNumber || prev.licenseNumber,
      companyNotes: account.companyNotes || prev.companyNotes,
      avatar: account.avatar || prev.avatar,
      status: account.isActive ? 'active' : 'inactive'
    }));
  }

  // When user clicks primary action, open AccountForm (instead of directly calling onSubmit)
  const handlePrimaryClick = () => {
    // prepare initial account data from current client form fields (keeps in sync)
    setAccountInitial(mapClientToAccount(formData, isEditing));
    setAccountFormOpen(true);
  };

  // Called when AccountForm is submitted
  const handleAccountFormSubmit = (values: AccountFormValues) => {
    // Map account values back into client form data
    applyAccountValuesToClient(values);

    // Close account modal and ClientForm (optionally)
    setAccountFormOpen(false);
    // Call the original onSubmit (so the parent action continues)
    onSubmit();

    // close the client dialog
    onOpenChange(false);
  };


  const mappedInitialUser = accountInitial
    ? {
        id: accountInitial.email ? `temp-${accountInitial.email}` : 'temp-id',
        name: `${accountInitial.firstName || ''} ${accountInitial.lastName || ''}`.trim(),
        email: accountInitial.email || '',
        role: accountInitial.role || 'client',
        phone: accountInitial.phone || '',
        address: accountInitial.address || '',
        city: accountInitial.city || '',
        state: accountInitial.state || '',
        zipcode: accountInitial.zipcode || '',
        company: accountInitial.company || '',
        avatar: accountInitial.avatar || '',
        companyNotes: accountInitial.companyNotes || '',
        // if your User type has other fields, add safe defaults here
      }
    : undefined;
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Edit Client' : 'Add Client'}</DialogTitle>
            <DialogDescription>
              {isEditing ? 'Update client information' : 'Add a new client to your directory'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="flex justify-center mb-4">
              <div className="relative">
                <Avatar
                  className="h-24 w-24 cursor-pointer border-2 border-border"
                  onClick={() => setShowUploadOptions(true)}
                >
                  {formData.avatar ? (
                    <AvatarImage src={formData.avatar} alt="Profile" />
                  ) : (
                    <AvatarFallback className="bg-secondary">
                      <CameraIcon className="h-8 w-8 text-muted-foreground" />
                    </AvatarFallback>
                  )}
                </Avatar>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="absolute bottom-0 right-0 h-8 w-8 p-0 rounded-full"
                  onClick={() => setShowUploadOptions(true)}
                >
                  <UploadIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {showUploadOptions && (
              <div className="bg-card border rounded-md p-3 relative">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute top-1 right-1 h-6 w-6 p-0 rounded-full"
                  onClick={() => setShowUploadOptions(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
                <div className="space-y-2 mt-2">
                  <div className="flex items-center">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <UploadIcon className="mr-2 h-4 w-4" />
                      Upload from device
                    </Button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept="image/*"
                      onChange={handleFileUpload}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => handleExternalUpload('google-drive')}
                  >
                    <img
                      src="https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Google_Drive_icon_%282020%29.svg/2295px-Google_Drive_icon_%282020%29.svg.png"
                      alt="Google Drive"
                      className="mr-2 h-4 w-4"
                    />
                    Upload from Google Drive
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => handleExternalUpload('dropbox')}
                  >
                    <img
                      src="https://upload.wikimedia.org/wikipedia/commons/thumb/7/78/Dropbox_Icon.svg/1200px-Dropbox_Icon.svg.png"
                      alt="Dropbox"
                      className="mr-2 h-4 w-4"
                    />
                    Upload from Dropbox
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-4 mt-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="name" className="text-sm font-medium">Full Name</label>
                  <Input id="name" name="name" value={formData.name} onChange={handleFormChange} placeholder="Enter client name" />
                </div>

                <div className="space-y-2">
                  <label htmlFor="company" className="text-sm font-medium">Company</label>
                  <Input id="company" name="company" value={formData.company} onChange={handleFormChange} placeholder="Enter company name" />
                </div>

                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium">Email</label>
                  <Input id="email" name="email" type="email" value={formData.email} onChange={handleFormChange} placeholder="Enter email address" />
                </div>

                <div className="space-y-2">
                  <label htmlFor="phone" className="text-sm font-medium">Phone</label>
                  <Input id="phone" name="phone" value={formData.phone} onChange={handleFormChange} placeholder="Enter phone number" />
                </div>

                <div className="space-y-2">
                  <label htmlFor="address" className="text-sm font-medium">Address</label>
                  <Input id="address" name="address" value={formData.address} onChange={handleFormChange} placeholder="Enter address" />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium">Status</label>
                  <div className="flex gap-2">
                    <Button type="button" variant={formData.status === 'active' ? 'default' : 'outline'} onClick={() => handleStatusChange('active')}>Active</Button>
                    <Button type="button" variant={formData.status === 'inactive' ? 'default' : 'outline'} onClick={() => handleStatusChange('inactive')}>Inactive</Button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>

            {/* Primary action now opens AccountForm modal */}
            <Button onClick={handlePrimaryClick}>
              {isEditing ? 'Edit Client' : 'Add Client'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AccountForm modal */}
      <AccountForm
        open={accountFormOpen}
        onOpenChange={(openFlag) => {
          setAccountFormOpen(openFlag);
        }}
        initialData={mappedInitialUser as any}
        onSubmit={handleAccountFormSubmit}
      />
    </>
  );
};

export default ClientForm;
