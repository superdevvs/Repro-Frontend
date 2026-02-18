import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { X, Link2, Settings, Trash2, Users, Plus, Circle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { API_BASE_URL } from '@/config/env';

interface LinkedAccount {
  id: string;
  accountId: string;
  accountName: string;
  accountEmail: string;
  mainAccountId: string;
  mainAccountName: string;
  mainAccountEmail: string;
  sharedDetails: {
    shoots: boolean;
    invoices: boolean;
    clients: boolean;
    availability: boolean;
    settings: boolean;
    profile: boolean;
    documents: boolean;
  };
  linkedAt: string;
  status: 'active' | 'inactive' | 'suspended';
  notes?: string;
}

interface Account {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface BatchLinkResponse {
  created: {
    id: string;
    accountId: string;
    accountName: string;
    accountEmail: string;
    mainAccountId: string;
    mainAccountName: string;
    mainAccountEmail: string;
    sharedDetails: LinkedAccount['sharedDetails'];
    linkedAt: string;
    status: 'active' | 'inactive' | 'suspended';
  }[];
  skipped: string[];
  failed: string[];
  message: string;
  summary: {
    created: number;
    skipped: number;
    failed: number;
  };
}

// ... existing interfaces

export function AccountLinkingManager() {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccount[]>([]);
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<LinkedAccount | null>(null);
  const [selectedMainAccount, setSelectedMainAccount] = useState<string>('');
  const [selectedClientAccounts, setSelectedClientAccounts] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sharedDetails, setSharedDetails] = useState({
    shoots: true,
    invoices: true,
    clients: false,
    availability: false,
    settings: false,
    profile: true,
    documents: true,
  });

  const fetchAccounts = useCallback(async () => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) throw new Error('Not authenticated');

      const res = await fetch(`${API_BASE_URL}/api/admin/users`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error('Failed to fetch accounts');
      const data = await res.json();
      setAccounts(data.users || []);
    } catch (error: unknown) {
      console.error('Failed to fetch accounts:', error);
      toast({
        title: "Error",
        description: "Failed to load accounts. Please try again.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const fetchLinkedAccounts = useCallback(async () => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) throw new Error('Not authenticated');

      const res = await fetch(`${API_BASE_URL}/api/admin/account-links`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error('Failed to fetch linked accounts');
      const data = await res.json();
      setLinkedAccounts(data.links || []);
    } catch (error: unknown) {
      console.error('Failed to fetch linked accounts:', error);
      // Don't show error toast on initial load if endpoint doesn't exist yet
    }
  }, [toast]);

  useEffect(() => {
    fetchAccounts();
    fetchLinkedAccounts();
  }, [fetchAccounts, fetchLinkedAccounts]);

  const handleLinkAccounts = async () => {
    if (!selectedMainAccount || selectedClientAccounts.length === 0) {
      toast({
        title: "Missing Information",
        description: "Please select a main account and at least one client account.",
        variant: "destructive",
      });
      return;
    }

    if (selectedClientAccounts.includes(selectedMainAccount)) {
      toast({
        title: "Invalid Selection",
        description: "Main account cannot be included in client accounts.",
        variant: "destructive",
      });
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      if (!token) throw new Error('Not authenticated');

      const mainAccount = accounts.find(a => a.id === selectedMainAccount);
      const clientAccounts = selectedClientAccounts.map(id => accounts.find(a => a.id === id)).filter(Boolean);

      const res = await fetch(`${API_BASE_URL}/api/admin/account-links/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          mainAccountId: selectedMainAccount,
          clientAccountIds: selectedClientAccounts,
          sharedDetails,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to link accounts');
      }

      const responseData = await res.json();

      // Add new links to the state
      const newLinks = responseData.created.map((link) => ({
        id: link.id,
        accountId: link.accountId,
        accountName: link.accountName,
        accountEmail: link.accountEmail,
        mainAccountId: link.mainAccountId,
        mainAccountName: link.mainAccountName,
        sharedDetails: link.sharedDetails,
        linkedAt: link.linkedAt,
      }));

      setLinkedAccounts([...linkedAccounts, ...newLinks]);
      setIsLinkDialogOpen(false);
      setSelectedMainAccount('');
      setSelectedClientAccounts([]);
      setSharedDetails({
        shoots: true,
        invoices: true,
        clients: false,
        availability: false,
        settings: false,
        profile: true,
        documents: true,
      });

      // Show detailed success message
      let message = responseData.message;
      if (responseData.summary.created > 0) {
        const createdNames = responseData.created.map((link) => link.accountName).join(', ');
        message += ` Successfully linked: ${createdNames}`;
      }
      if (responseData.summary.skipped > 0) {
        message += ` ${responseData.summary.skipped} accounts were already linked.`;
      }
      if (responseData.summary.failed > 0) {
        message += ` ${responseData.summary.failed} accounts failed to link.`;
      }

      toast({
        title: "Account Linking Complete",
        description: message,
      });

    } catch (error: unknown) {
      console.error('Failed to link accounts:', error);
      toast({
        title: "Error",
        description: (error instanceof Error ? error.message : "Failed to link accounts. Please try again."),
        variant: "destructive",
      });
    }
  };

  const handleEditLink = (link: LinkedAccount) => {
    setEditingLink(link);
    setSharedDetails(link.sharedDetails);
    setIsEditDialogOpen(true);
  };

  const handleUpdateSharedDetails = async (linkId: string, updatedDetails: LinkedAccount['sharedDetails']) => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) throw new Error('Not authenticated');

      const res = await fetch(`${API_BASE_URL}/api/admin/account-links/${linkId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ sharedDetails: updatedDetails }),
      });

      if (!res.ok) throw new Error('Failed to update shared details');

      setLinkedAccounts(linkedAccounts.map(link =>
        link.id === linkId ? { ...link, sharedDetails: updatedDetails } : link
      ));

      toast({
        title: "Shared Details Updated",
        description: "The shared details have been updated successfully.",
      });
    } catch (error: unknown) {
      console.error('Failed to update link:', error);
      toast({
        title: "Error",
        description: (error instanceof Error ? error.message : "Failed to update shared details. Please try again."),
        variant: "destructive",
      });
    }
  };

  const handleUnlinkAccount = async (linkId: string) => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) throw new Error('Not authenticated');

      const res = await fetch(`${API_BASE_URL}/api/admin/account-links/${linkId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error('Failed to unlink account');

      const link = linkedAccounts.find(l => l.id === linkId);
      setLinkedAccounts(linkedAccounts.filter(l => l.id !== linkId));

      toast({
        title: "Account Unlinked",
        description: `The account link has been removed successfully.`,
      });
    } catch (error: unknown) {
      console.error('Failed to unlink account:', error);
      toast({
        title: "Error",
        description: (error instanceof Error ? error.message : "Failed to unlink account. Please try again."),
        variant: "destructive",
      });
    }
  };

  const clientAccounts = accounts.filter(a => a.role === 'client');
  const mainAccounts = accounts.filter(a => ['admin', 'superadmin', 'client'].includes(a.role));
  const availableClientAccounts = clientAccounts
    .filter((account) => account.id !== selectedMainAccount)
    .filter((account) => !linkedAccounts.some((link) => link.accountId === account.id))
    .filter((account) =>
      searchTerm === '' ||
      account.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      account.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <CardTitle>Account Linking</CardTitle>
              <CardDescription>
                Link multiple client accounts to a main account and manage shared details efficiently
              </CardDescription>
            </div>
            {linkedAccounts.length > 0 && (
              <Button onClick={() => setIsLinkDialogOpen(true)} className="w-full sm:w-auto">
                <Users className="mr-2 h-4 w-4" />
                Link Multiple Accounts
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          {linkedAccounts.length === 0 ? (
            <div className="text-center py-8 sm:py-12">
              <Users className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-semibold">No Linked Accounts</h3>
              <p className="mb-4 text-muted-foreground sm:mb-5">
                Start by linking multiple client accounts to a main account. This allows you to manage and share data across connected accounts seamlessly.
              </p>
              <Button
                onClick={() => setIsLinkDialogOpen(true)}
                className="w-full sm:w-auto"
              >
                <Users className="mr-2 h-4 w-4" />
                Link Multiple Accounts
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 p-4 bg-green-50 rounded-lg border border-green-200 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500 rounded-full">
                    <Link2 className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-green-800">
                      {linkedAccounts.length} Active Link{linkedAccounts.length !== 1 ? 's' : ''}
                    </p>
                    <p className="text-sm text-green-600">
                      Accounts are successfully linked and sharing data
                    </p>
                  </div>
                </div>
                <Button 
                  onClick={() => setIsLinkDialogOpen(true)}
                  variant="outline"
                  className="w-full sm:w-auto border-green-300 text-green-700 hover:bg-green-50"
                >
                  <Users className="mr-2 h-4 w-4" />
                  Link More
                </Button>
              </div>
              
              <ScrollArea className="h-[60vh] min-h-[420px] rounded-lg border sm:h-[600px]">
                <div className="p-4 space-y-6">
                  {(() => {
                    // Group linked accounts by main account
                    const groupedLinks = linkedAccounts.reduce((groups, link) => {
                      const mainAccountId = link.mainAccountId;
                      if (!groups[mainAccountId]) {
                        groups[mainAccountId] = {
                          mainAccount: {
                            id: link.mainAccountId,
                            name: link.mainAccountName,
                            email: link.mainAccountEmail
                          },
                          linkedAccounts: []
                        };
                      }
                      groups[mainAccountId].linkedAccounts.push(link);
                      return groups;
                    }, {} as Record<string, {
                      mainAccount: { id: string; name: string; email: string };
                      linkedAccounts: typeof linkedAccounts;
                    }>);

                    return Object.values(groupedLinks).map((group, groupIndex) => (
                      <Card key={group.mainAccount.id} className="overflow-hidden border-border shadow-sm hover:shadow-md transition-shadow duration-200">
                        <CardHeader className="bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-blue-950/50 dark:to-indigo-950/50 border-b border-border py-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 bg-blue-500 rounded-full flex items-center justify-center">
                                <span className="text-sm font-bold text-white">
                                  {group.mainAccount.name?.charAt(0)?.toUpperCase() || 'U'}
                                </span>
                              </div>
                              <div>
                                <CardTitle className="text-lg font-semibold text-blue-900 dark:text-blue-100 leading-tight">
                                  {group.mainAccount.name || 'Unknown Account'}
                                </CardTitle>
                                <CardDescription className="text-blue-600 dark:text-blue-400 text-xs mt-0.5 leading-relaxed">
                                  {group.mainAccount.email}
                                </CardDescription>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 self-start sm:self-auto">
                              <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 text-xs px-2 py-1">
                                <Users className="w-3 h-3 mr-1" />
                                {group.linkedAccounts.length}
                              </Badge>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedMainAccount(group.mainAccount.id);
                                  setIsLinkDialogOpen(true);
                                }}
                                className="border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-950/50 h-7 px-2 text-xs"
                              >
                                <Plus className="w-3 h-3 mr-1" />
                                Add
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="p-4">
                          <div className="space-y-3">
                            {group.linkedAccounts.map((link) => (
                              <div key={link.id} className="flex flex-col gap-3 p-3 bg-muted/30 rounded-lg border hover:bg-muted/50 transition-all duration-200 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center">
                                    <span className="text-xs font-bold text-green-700 dark:text-green-300">
                                      {link.accountName?.charAt(0)?.toUpperCase() || 'C'}
                                    </span>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-foreground text-sm leading-tight">
                                      {link.accountName || 'Unknown Client'}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                      {link.accountEmail}
                                    </p>
                                  </div>
                                </div>
                                
                                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
                                  <div className="flex flex-wrap gap-1 max-w-full sm:max-w-[180px]">
                                    {Object.entries(link.sharedDetails || {}).filter(([_, enabled]) => enabled).map(([detail]) => (
                                      <Badge key={detail} variant="outline" className="text-xs bg-background px-1.5 py-0.5">
                                        {detail.charAt(0).toUpperCase() + detail.slice(1)}
                                      </Badge>
                                    ))}
                                  </div>
                                  
                                  <div className="flex items-center gap-2 sm:justify-end">
                                    <Badge 
                                      variant={link.status === 'active' ? 'default' : 'secondary'}
                                      className={link.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200 text-xs px-1.5 py-0.5' : 'text-xs px-1.5 py-0.5'}
                                    >
                                      <Circle className={`w-1.5 h-1.5 mr-1 ${link.status === 'active' ? 'fill-current' : ''}`} />
                                      {link.status || 'active'}
                                    </Badge>
                                    
                                    <div className="flex gap-1">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleEditLink(link)}
                                        className="h-7 w-7 p-0 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                                      >
                                        <Settings className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleUnlinkAccount(link.id)}
                                        className="h-7 w-7 p-0 hover:bg-red-100 dark:hover:bg-red-900/30"
                                      >
                                        <Trash2 className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                            
                            {group.linkedAccounts.length === 0 && (
                              <div className="text-center py-8 text-muted-foreground bg-muted/20 rounded-lg border border-dashed border-muted-foreground/30">
                                <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
                                <p className="text-sm font-medium mb-1">No client accounts linked yet</p>
                                <p className="text-xs mb-3">Start by adding client accounts to this main account</p>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedMainAccount(group.mainAccount.id);
                                    setIsLinkDialogOpen(true);
                                  }}
                                  className="text-xs"
                                >
                                  <Plus className="w-3 h-3 mr-1" />
                                  Link First Client
                                </Button>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ));
                  })()}
                  
                  {linkedAccounts.length === 0 && (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 bg-muted/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Link2 className="w-8 h-8 text-muted-foreground opacity-50" />
                      </div>
                      <h3 className="text-lg font-semibold mb-2 text-foreground">No Account Links Yet</h3>
                      <p className="text-muted-foreground mb-4 max-w-md mx-auto text-sm">
                        Start by linking client accounts to main accounts to enable data sharing and streamlined management.
                      </p>
                      <Button onClick={() => setIsLinkDialogOpen(true)} size="sm" className="px-4">
                        <Plus className="w-4 h-4 mr-2" />
                        Create First Link
                      </Button>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}

      {/* Link Accounts Dialog */}
      <Dialog
        open={isLinkDialogOpen}
        onOpenChange={(open) => {
          setIsLinkDialogOpen(open);
          if (!open) {
            setSearchTerm('');
          }
        }}
      >
        <DialogContent className="flex h-[calc(100dvh-0.75rem)] w-[calc(100vw-0.75rem)] max-w-[1100px] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:h-auto sm:max-h-[85vh] sm:w-full sm:gap-4 sm:rounded-xl sm:p-6">
          <DialogHeader className="space-y-1 border-b px-4 py-3 pr-12 text-left sm:border-0 sm:px-0 sm:py-0 sm:pr-0">
            <DialogTitle className="text-left">Link Multiple Client Accounts</DialogTitle>
            <DialogDescription className="text-left sm:max-w-[80ch]">
              Select multiple client accounts to link to a main account and configure shared details
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto px-4 py-4 sm:h-[calc(85vh-170px)] sm:grid-cols-[minmax(0,1fr)_24rem] sm:gap-6 sm:overflow-hidden sm:px-0 sm:py-0">
            {/* Left Panel - Account Selection */}
            <div className="flex min-h-0 flex-col gap-4 sm:overflow-hidden">
              <div className="space-y-2">
                <Label>Main Account</Label>
                <Select value={selectedMainAccount} onValueChange={setSelectedMainAccount}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Select main account to link to" />
                  </SelectTrigger>
                  <SelectContent>
                    {mainAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        <div className="flex flex-col">
                          <span className="font-medium">{account.name}</span>
                          <span className="text-sm text-muted-foreground">{account.email}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex min-h-0 flex-1 flex-col space-y-2 sm:overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label className="text-[15px] sm:text-sm">Client Accounts to Link ({selectedClientAccounts.length} selected)</Label>
                  {selectedClientAccounts.length > 0 && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setSelectedClientAccounts([])}
                      className="h-7 px-2 text-xs text-primary"
                    >
                      Clear All
                    </Button>
                  )}
                </div>
                
                <Input
                  placeholder="Search client accounts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-10"
                />
                
                <div className="min-h-[140px] max-h-[30dvh] rounded-lg border p-2.5 overflow-y-auto sm:min-h-[220px] sm:max-h-none sm:flex-1 sm:p-3">
                  {availableClientAccounts.length === 0 ? (
                    <div className="text-center py-8 sm:py-10">
                      <Users className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                      <p className="text-sm font-medium text-muted-foreground mb-1">
                        {searchTerm ? 'No accounts found' : 'No available client accounts'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {searchTerm ? 'Try a different search term' : 'All client accounts are already linked or none exist'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {availableClientAccounts.map((account) => (
                          <div 
                            key={account.id} 
                            className={`flex items-start space-x-3 rounded-lg border p-2.5 transition-all cursor-pointer hover:bg-accent sm:items-center sm:p-3 ${
                              selectedClientAccounts.includes(account.id) 
                                ? 'bg-accent border-accent-foreground' 
                                : 'bg-background border-border'
                            }`}
                            onClick={() => {
                              setSelectedClientAccounts((previous) =>
                                previous.includes(account.id)
                                  ? previous.filter((id) => id !== account.id)
                                  : [...previous, account.id]
                              );
                            }}
                          >
                            <Checkbox
                              id={account.id}
                              checked={selectedClientAccounts.includes(account.id)}
                              className="w-4 h-4"
                            />
                            <div className="flex-1">
                              <Label
                                htmlFor={account.id}
                                className="text-sm font-medium cursor-pointer flex-1"
                              >
                                {account.name}
                              </Label>
                              <p className="text-xs text-muted-foreground">{account.email}</p>
                            </div>
                            {selectedClientAccounts.includes(account.id) && (
                              <Badge variant="default" className="text-[11px] sm:text-xs">
                                Selected
                              </Badge>
                            )}
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Panel - Shared Details */}
            <div className="flex min-h-0 flex-col space-y-3 sm:space-y-4 sm:overflow-hidden">
              <div className="flex min-h-0 flex-1 flex-col space-y-3 sm:overflow-hidden">
                <Label className="text-[15px] sm:text-sm">Shared Details (Applied to all selected accounts)</Label>
                <div className="min-h-[170px] max-h-[34dvh] rounded-lg border bg-card p-2.5 overflow-y-auto sm:min-h-[220px] sm:max-h-none sm:flex-1 sm:p-4">
                  <div className="space-y-2.5 sm:space-y-3">
                    <div className="flex items-center space-x-3 rounded-lg border bg-accent/50 p-2.5 sm:p-3">
                      <Checkbox
                        id="share-shoots"
                        checked={sharedDetails.shoots}
                        onCheckedChange={(checked) =>
                          setSharedDetails({ ...sharedDetails, shoots: !!checked })
                        }
                      />
                      <div className="flex-1">
                        <Label htmlFor="share-shoots" className="text-sm font-medium cursor-pointer">
                          📸 Shoots
                        </Label>
                        <p className="text-xs text-muted-foreground">Photo sessions</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3 rounded-lg border bg-accent/50 p-2.5 sm:p-3">
                      <Checkbox
                        id="share-invoices"
                        checked={sharedDetails.invoices}
                        onCheckedChange={(checked) =>
                          setSharedDetails({ ...sharedDetails, invoices: !!checked })
                        }
                      />
                      <div className="flex-1">
                        <Label htmlFor="share-invoices" className="text-sm font-medium cursor-pointer">
                          💰 Invoices
                        </Label>
                        <p className="text-xs text-muted-foreground">Billing info</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3 rounded-lg border bg-accent/50 p-2.5 sm:p-3">
                      <Checkbox
                        id="share-clients"
                        checked={sharedDetails.clients}
                        onCheckedChange={(checked) =>
                          setSharedDetails({ ...sharedDetails, clients: !!checked })
                        }
                      />
                      <div className="flex-1">
                        <Label htmlFor="share-clients" className="text-sm font-medium cursor-pointer">
                          👥 Clients
                        </Label>
                        <p className="text-xs text-muted-foreground">Client data</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3 rounded-lg border bg-accent/50 p-2.5 sm:p-3">
                      <Checkbox
                        id="share-availability"
                        checked={sharedDetails.availability}
                        onCheckedChange={(checked) =>
                          setSharedDetails({ ...sharedDetails, availability: !!checked })
                        }
                      />
                      <div className="flex-1">
                        <Label htmlFor="share-availability" className="text-sm font-medium cursor-pointer">
                          📅 Availability
                        </Label>
                        <p className="text-xs text-muted-foreground">Schedule info</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3 rounded-lg border bg-accent/50 p-2.5 sm:p-3">
                      <Checkbox
                        id="share-settings"
                        checked={sharedDetails.settings}
                        onCheckedChange={(checked) =>
                          setSharedDetails({ ...sharedDetails, settings: !!checked })
                        }
                      />
                      <div className="flex-1">
                        <Label htmlFor="share-settings" className="text-sm font-medium cursor-pointer">
                          ⚙️ Settings
                        </Label>
                        <p className="text-xs text-muted-foreground">Account settings</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3 rounded-lg border bg-accent/50 p-2.5 sm:p-3">
                      <Checkbox
                        id="share-profile"
                        checked={sharedDetails.profile}
                        onCheckedChange={(checked) =>
                          setSharedDetails({ ...sharedDetails, profile: !!checked })
                        }
                      />
                      <div className="flex-1">
                        <Label htmlFor="share-profile" className="text-sm font-medium cursor-pointer">
                          👤 Profile
                        </Label>
                        <p className="text-xs text-muted-foreground">Profile info</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3 rounded-lg border bg-accent/50 p-2.5 sm:p-3">
                      <Checkbox
                        id="share-documents"
                        checked={sharedDetails.documents}
                        onCheckedChange={(checked) =>
                          setSharedDetails({ ...sharedDetails, documents: !!checked })
                        }
                      />
                      <div className="flex-1">
                        <Label htmlFor="share-documents" className="text-sm font-medium cursor-pointer">
                          📁 Documents
                        </Label>
                        <p className="text-xs text-muted-foreground">Files & documents</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {selectedClientAccounts.length > 0 && (
                <div className="rounded-lg border bg-accent p-3">
                  <p className="text-sm font-medium text-accent-foreground">
                    📋 {selectedClientAccounts.length} account{selectedClientAccounts.length !== 1 ? 's' : ''} selected
                  </p>
                </div>
              )}
            </div>
          </div>
          
          <DialogFooter className="flex-col gap-2 border-t bg-background px-4 py-3 shadow-[0_-1px_0_0_hsl(var(--border))] sm:flex-row sm:justify-end sm:gap-0 sm:space-x-2 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:shadow-none [padding-bottom:calc(0.75rem+env(safe-area-inset-bottom))] sm:[padding-bottom:0]">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => {
                setIsLinkDialogOpen(false);
                setSearchTerm('');
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleLinkAccounts}
              disabled={selectedClientAccounts.length === 0}
              className="w-full sm:w-auto"
            >
              <Users className="mr-2 h-4 w-4" />
              Link {selectedClientAccounts.length} Account{selectedClientAccounts.length !== 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Shared Details Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Shared Details</DialogTitle>
            <DialogDescription>
              Update what data is shared between linked accounts
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            <div className="space-y-3">
              <Label className="text-sm font-medium">Shared Data Types</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="edit-shoots"
                    checked={sharedDetails.shoots}
                    onCheckedChange={(checked) => 
                      setSharedDetails(prev => ({ ...prev, shoots: checked as boolean }))
                    }
                  />
                  <Label htmlFor="edit-shoots" className="text-sm">Shoots</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="edit-invoices"
                    checked={sharedDetails.invoices}
                    onCheckedChange={(checked) => 
                      setSharedDetails(prev => ({ ...prev, invoices: checked as boolean }))
                    }
                  />
                  <Label htmlFor="edit-invoices" className="text-sm">Invoices</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="edit-clients"
                    checked={sharedDetails.clients}
                    onCheckedChange={(checked) => 
                      setSharedDetails(prev => ({ ...prev, clients: checked as boolean }))
                    }
                  />
                  <Label htmlFor="edit-clients" className="text-sm">Clients</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="edit-availability"
                    checked={sharedDetails.availability}
                    onCheckedChange={(checked) => 
                      setSharedDetails(prev => ({ ...prev, availability: checked as boolean }))
                    }
                  />
                  <Label htmlFor="edit-availability" className="text-sm">Availability</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="edit-settings"
                    checked={sharedDetails.settings}
                    onCheckedChange={(checked) => 
                      setSharedDetails(prev => ({ ...prev, settings: checked as boolean }))
                    }
                  />
                  <Label htmlFor="edit-settings" className="text-sm">Settings</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="edit-profile"
                    checked={sharedDetails.profile}
                    onCheckedChange={(checked) => 
                      setSharedDetails(prev => ({ ...prev, profile: checked as boolean }))
                    }
                  />
                  <Label htmlFor="edit-profile" className="text-sm">Profile</Label>
                </div>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (editingLink) {
                  handleUpdateSharedDetails(editingLink.id, sharedDetails);
                  setIsEditDialogOpen(false);
                }
              }}
            >
              Update Shared Details
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
          </CardContent>
        </Card>
    </div>
  );
}

