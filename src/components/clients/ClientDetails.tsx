import React, { useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { 
  MailIcon, 
  PhoneIcon, 
  HomeIcon, 
  BuildingIcon 
} from 'lucide-react';
import { Client } from '@/types/clients';
import { AccountForm, AccountFormValues } from '@/components/accounts/AccountForm'; // <-- import AccountForm & types

interface ClientDetailsProps {
  client: Client | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (client: Client) => void;
  onBookShoot: (client: Client, e: React.MouseEvent) => void;
}

export const ClientDetails: React.FC<ClientDetailsProps> = ({
  client,
  open,
  onOpenChange,
  onEdit,
  onBookShoot
}) => {
  const { role } = useAuth();
  const [accountFormOpen, setAccountFormOpen] = useState(false);
  const [accountFormInitial, setAccountFormInitial] = useState<AccountFormValues | undefined>(undefined);

  if (!client) return null;

  const openAccountForm = () => {
    // convert Client -> AccountFormValues shape (map whatever fields you need)
    const [firstName = '', ...rest] = (client.name || '').trim().split(' ');
    const lastName = rest.join(' ').trim();
    setAccountFormInitial({
      firstName,
      lastName,
      email: client.email || '',
      role: 'client', // default; you can derive if you store role on Client
      phone: client.phone || '',
      address: client.address || '',
      city: client.city || '',
      state: client.state || '',
      zipcode: client.zipcode || client.zip || '',
      company: client.company || '',
      licenseNumber: client.licenseNumber || '',
      avatar: client.avatar || '',
      companyNotes: client.companyNotes || '',
      isActive: client.status === 'active'
    });
    setAccountFormOpen(true);
  };

  const handleAccountFormSubmit = (values: AccountFormValues) => {
    // Map AccountFormValues back to Client shape (keep/merge fields you want)
    const combinedName = `${values.firstName || ''} ${values.lastName || ''}`.trim();
    const updatedClient: Client = {
      ...client,
      name: combinedName || client.name,
      email: values.email,
      phone: values.phone || client.phone,
      address: values.address || client.address,
      city: values.city || client.city,
      state: values.state || client.state,
      zipcode: values.zipcode || client.zipcode || client.zip || '',
      company: values.company || client.company,
      avatar: values.avatar || client.avatar,
      licenseNumber: values.licenseNumber || (client as any).licenseNumber,
      companyNotes: values.companyNotes || (client as any).companyNotes,
      // keep other fields that exist on Client
      // map isActive -> status string
      status: values.isActive ? 'active' : 'inactive'
    };

    // call parent handler
    onEdit(updatedClient);

    // close modal
    setAccountFormOpen(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Client Details</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            <div className="flex flex-col md:flex-row gap-6">
              <div className="md:w-1/3">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex flex-col items-center text-center">
                      {client.avatar ? (
                        <Avatar className="h-24 w-24 mb-4">
                          <AvatarImage src={client.avatar} alt={client.name} />
                          <AvatarFallback>
                            {client.name.split(' ').map((n: string) => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                      ) : (
                        <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center text-primary text-2xl font-bold mb-4">
                          {client.name.split(' ').map((n: string) => n[0]).join('')}
                        </div>
                      )}
                      <h2 className="text-xl font-bold">{client.name}</h2>
                      <p className="text-muted-foreground">{client.company}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="md:w-2/3 space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Contact Information</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 pt-0">
                    <div className="space-y-4">
                      <div className="flex items-start gap-3">
                        <MailIcon className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div>
                          <h3 className="font-medium">Email</h3>
                          <p className="text-muted-foreground">{client.email}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <PhoneIcon className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div>
                          <h3 className="font-medium">Phone</h3>
                          <p className="text-muted-foreground">{client.phone}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <HomeIcon className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div>
                          <h3 className="font-medium">Address</h3>
                          <p className="text-muted-foreground">{client.address}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <BuildingIcon className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div>
                          <h3 className="font-medium">Company</h3>
                          <p className="text-muted-foreground">{client.company}</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Client Stats</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 pt-0">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-secondary/20 rounded-md p-3">
                        <p className="text-sm text-muted-foreground">Total Shoots</p>
                        <p className="text-2xl font-bold">{client.shootsCount}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              {['admin', 'superadmin', 'editing_manager'].includes(role) && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => {
                      openAccountForm();
                    }}
                  >
                    Edit Client
                  </Button>

                  <Button onClick={(e) => onBookShoot(client, e as unknown as React.MouseEvent)}>
                    Book Shoot
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* AccountForm modal */}
      <AccountForm
        open={accountFormOpen}
        onOpenChange={(open) => setAccountFormOpen(open)}
        initialData={(accountFormInitial as any) || undefined}
        onSubmit={handleAccountFormSubmit}
      />
    </>
  );
};
