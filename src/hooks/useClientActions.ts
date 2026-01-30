
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Client } from '@/types/clients';
import { useToast } from '@/hooks/use-toast';
import API_ROUTES from '@/lib/api';
import { ClientFormData } from '@/components/clients/ClientForm';

interface UseClientActionsProps {
  clientsData: Client[];
  setClientsData: (clients: Client[]) => void;
}

export const useClientActions = ({ clientsData, setClientsData }: UseClientActionsProps) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientDetailsOpen, setClientDetailsOpen] = useState(false);
  const [clientFormOpen, setClientFormOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showUploadOptions, setShowUploadOptions] = useState(false);
  
  const [clientFormData, setClientFormData] = useState<ClientFormData>({
    name: '',
    company: '',
    email: '',
    phone: '',
    address: '',
    status: 'active',
    avatar: '',
  });

  const handleClientSelect = (client: Client) => {
    setSelectedClient(client);
    setClientDetailsOpen(true);
  };

  const handleAddClient = () => {
    setIsEditing(false);
    setClientFormData({
      name: '',
      company: '',
      email: '',
      phone: '',
      address: '',
      status: 'active',
      avatar: '',
    });
    setShowUploadOptions(false);
    setClientFormOpen(true);
  };

  const handleEditClient = (client: Client, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsEditing(true);
    setClientFormData({
      name: client.name,
      company: client.company || '',
      email: client.email,
      phone: client.phone || '',
      address: client.address || '',
      status: client.status,
      avatar: client.avatar || '',
    });
    setSelectedClient(client);
    setShowUploadOptions(false);
    setClientFormOpen(true);
  };

  const handleClientFormSubmit = async () => {
    if (isEditing && selectedClient) {
      const updatedClients = clientsData.map(client => 
        client.id === selectedClient.id 
          ? { 
              ...client, 
              name: clientFormData.name,
              company: clientFormData.company,
              email: clientFormData.email,
              phone: clientFormData.phone,
              address: clientFormData.address,
              status: clientFormData.status,
              avatar: clientFormData.avatar
            } 
          : client
      );
      
      setClientsData(updatedClients);
      setSelectedClient({
        ...selectedClient,
        name: clientFormData.name,
        company: clientFormData.company,
        email: clientFormData.email,
        phone: clientFormData.phone,
        address: clientFormData.address,
        status: clientFormData.status,
        avatar: clientFormData.avatar
      });
      
      toast({
        title: "Client Updated",
        description: `${clientFormData.name}'s information has been updated successfully.`,
      });
    } else {
      try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        if (!token) throw new Error('Not authenticated');
        const body = new FormData();
        body.append('name', clientFormData.name || '');
        body.append('email', clientFormData.email || '');
        if (clientFormData.phone) body.append('phone_number', clientFormData.phone);
        if (clientFormData.company) body.append('company_name', clientFormData.company);
        body.append('role', 'client');
        // Optional bio/avatar not handled as file here

        const res = await fetch(API_ROUTES.clients.create, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
          body,
        });
        if (!res.ok) {
          const t = await res.text();
          throw new Error(t || 'Create client failed');
        }
        const json = await res.json();
        const u = json.user;
        const newClient: Client = {
          id: String(u.id),
          name: u.name,
          company: u.company_name || '',
          email: u.email,
          phone: u.phonenumber || '',
          address: '',
          status: 'active',
          shootsCount: 0,
          lastActivity: new Date().toISOString().split('T')[0],
          avatar: u.avatar || undefined,
        };
        setClientsData([newClient, ...clientsData]);
        toast({ title: 'Client Added', description: `${u.name} has been added successfully.` });
      } catch (e:any) {
        toast({ title: 'Create failed', description: e?.message || 'Could not add client', variant: 'destructive' });
        return;
      }
    }
    
    setClientFormOpen(false);
  };

  const handleDeleteClient = (client: Client, e: React.MouseEvent) => {
    e.stopPropagation();
    
    const updatedClients = clientsData.filter(c => c.id !== client.id);
    setClientsData(updatedClients);
    
    if (selectedClient && selectedClient.id === client.id) {
      setClientDetailsOpen(false);
    }
    
    toast({
      title: "Client Removed",
      description: `${client.name} has been removed from your client list.`,
    });
  };

  const handleBookShoot = (client: Client, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (clientDetailsOpen) {
      setClientDetailsOpen(false);
    }
    
    const params = new URLSearchParams();
    params.append('clientId', client.id);
    params.append('clientName', encodeURIComponent(client.name));
    if (client.company) {
      params.append('clientCompany', encodeURIComponent(client.company));
    }
    
    navigate(`/book-shoot?${params.toString()}`);
    
    toast({
      title: "Book Shoot",
      description: `Navigating to book a shoot for ${client.name}...`,
    });
  };

  const handleClientPortal = (client: Client, e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/client-portal?clientId=${client.id}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    toast({ title: 'Client Portal', description: `Opening portal for ${client.name} in a new tab...` });
  };

  return {
    selectedClient,
    setSelectedClient,
    clientDetailsOpen,
    setClientDetailsOpen,
    clientFormOpen,
    setClientFormOpen,
    isEditing,
    showUploadOptions,
    setShowUploadOptions,
    clientFormData,
    setClientFormData,
    handleClientSelect,
    handleAddClient,
    handleEditClient,
    handleClientFormSubmit,
    handleDeleteClient,
    handleBookShoot,
    handleClientPortal
  };
};

