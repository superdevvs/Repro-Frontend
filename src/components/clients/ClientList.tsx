import { usePaginationScrollReset } from '@/hooks/usePaginationScrollReset';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ClientTable } from '@/components/clients/ClientTable';
import { ClientCards } from '@/components/clients/ClientCards';
import { ClientPagination } from '@/components/clients/ClientPagination';
import { Client } from '@/types/clients';
import { useIsMobile } from '@/hooks/use-mobile';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GridIcon, ListIcon } from 'lucide-react';

interface ClientListProps {
  filteredClients: Client[];
  searchTerm: string;
  onClientSelect: (client: Client) => void;
  onEditClient: (client: Client, e: React.MouseEvent) => void;
  onBookShoot: (client: Client, e: React.MouseEvent) => void;
  onClientPortal: (client: Client, e: React.MouseEvent) => void;
  onDeleteClient: (client: Client, e: React.MouseEvent) => void;
}

export const ClientList: React.FC<ClientListProps> = ({
  filteredClients,
  searchTerm,
  onClientSelect,
  onEditClient,
  onBookShoot,
  onClientPortal,
  onDeleteClient
}) => {
  const isMobile = useIsMobile();
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>(isMobile ? 'grid' : 'table');

  // Set number of clients per page based on screen size and view mode
  const clientsPerPage = isMobile 
    ? 10 
    : viewMode === 'grid' 
      ? 12 
      : 10;
  
  const indexOfLastClient = currentPage * clientsPerPage;
  const indexOfFirstClient = indexOfLastClient - clientsPerPage;
  const currentClients = filteredClients.slice(indexOfFirstClient, indexOfLastClient);
  const totalPages = Math.ceil(filteredClients.length / clientsPerPage);

  const paginationListRef = usePaginationScrollReset(currentPage, { pageSize: clientsPerPage });
  return (
    <Card ref={paginationListRef} data-pagination-list className="glass-card">
      <CardHeader className="px-4 py-3 sm:p-6 flex flex-row items-center justify-between">
        <CardTitle className="text-xl">Client Directory</CardTitle>
        {!isMobile && (
          <Tabs 
            value={viewMode} 
            onValueChange={(value) => setViewMode(value as 'table' | 'grid')}
            className="w-auto"
          >
            <TabsList className="grid w-[180px] grid-cols-2">
              <TabsTrigger value="table" className="flex items-center gap-2">
                <ListIcon className="h-4 w-4" /> List View
              </TabsTrigger>
              <TabsTrigger value="grid" className="flex items-center gap-2">
                <GridIcon className="h-4 w-4" /> Grid View
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}
      </CardHeader>
      <CardContent className="p-0">
        {isMobile || viewMode === 'grid' ? (
          <ClientCards 
            clients={currentClients}
            onSelect={onClientSelect}
            onEdit={onEditClient}
            onBookShoot={onBookShoot}
            onClientPortal={onClientPortal}
            onDelete={onDeleteClient}
            currentPage={currentPage}
            totalPages={totalPages}
          />
        ) : (
          <>
            <ClientTable 
              clients={currentClients}
              onSelect={onClientSelect}
              onEdit={onEditClient}
              onBookShoot={onBookShoot}
              onClientPortal={onClientPortal}
              onDelete={onDeleteClient}
            />
            {filteredClients.length > clientsPerPage && (
              <ClientPagination
                currentPage={currentPage}
                totalPages={totalPages}
                setCurrentPage={setCurrentPage}
              />
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
