import { usePaginationScrollReset } from '@/hooks/usePaginationScrollReset';

import React, { useState } from 'react';
import { UserIcon, ChevronRightIcon, MapPinIcon, PhoneIcon, MailIcon, Building2Icon, GlobeIcon, Camera } from 'lucide-react';
import { Client } from '@/types/clients';
import { motion, AnimatePresence } from 'framer-motion';
import { PaginationDots } from '@/components/ui/pagination';
import { ClientCard, ClientCardHeader, ClientCardContent, ClientCardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useIsMobile } from '@/hooks/use-mobile';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

interface ClientCardsProps {
  clients: Client[];
  onSelect: (client: Client) => void;
  onEdit: (client: Client, e: React.MouseEvent) => void;
  onBookShoot: (client: Client, e: React.MouseEvent) => void;
  onClientPortal: (client: Client, e: React.MouseEvent) => void;
  onDelete: (client: Client, e: React.MouseEvent) => void;
  currentPage?: number;
  totalPages?: number;
}

export const ClientCards: React.FC<ClientCardsProps> = ({
  clients,
  onSelect,
  onEdit,
  onBookShoot,
  onClientPortal,
  onDelete,
  currentPage: externalCurrentPage,
  totalPages: externalTotalPages,
}) => {
  const [internalCurrentPage, setInternalCurrentPage] = useState(1);
  const isMobile = useIsMobile();
  
  // Use external pagination values if provided, otherwise use internal state
  const currentPage = externalCurrentPage || internalCurrentPage;
  const cardsPerPage = isMobile ? 5 : 10;
  const totalPages = externalTotalPages || Math.ceil(clients.length / cardsPerPage);
  
  // If external pagination is not used, apply internal pagination
  const currentClients = externalCurrentPage ? clients : clients.slice(
    (internalCurrentPage - 1) * cardsPerPage, 
    internalCurrentPage * cardsPerPage
  );
  
  const handlePageChange = (page: number) => {
    if (!externalCurrentPage) {
      setInternalCurrentPage(page);
    }
  };

  const getStatusColor = (status: string) => {
    switch(status.toLowerCase()) {
      case 'active': return 'bg-green-500/20 text-green-600 dark:text-green-400';
      case 'inactive': return 'bg-gray-300/30 text-gray-600 dark:text-gray-400';
      default: return 'bg-blue-500/20 text-blue-600 dark:text-blue-400';
    }
  };

  const getRandomLogoColor = (clientId: string) => {
    // Simple hash function to get consistent colors for the same client
    const hash = clientId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const colors = [
      'from-blue-400 to-blue-600',
      'from-purple-400 to-purple-600',
      'from-green-400 to-green-600',
      'from-yellow-400 to-yellow-600',
      'from-red-400 to-red-600',
      'from-indigo-400 to-indigo-600',
      'from-pink-400 to-pink-600',
      'from-teal-400 to-teal-600',
    ];
    return colors[hash % colors.length];
  };

  const paginationListRef = usePaginationScrollReset(currentPage, { pageSize: cardsPerPage });
  return (
    <div ref={paginationListRef} data-pagination-list className="p-4 space-y-4 client-cards-container">
      {clients.length > 0 ? (
        <>
          <AnimatePresence mode="wait">
            <motion.div 
              key={currentPage}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
            >
              {currentClients.map((client, index) => (
                <motion.div
                  key={client.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  onClick={() => onSelect(client)}
                  className="cursor-pointer"
                >
                  <ClientCard className="overflow-hidden border hover:border-primary/30 transition-all hover:shadow-md">
                    <ClientCardHeader className="relative p-4 flex items-center space-x-4">
                      <div className={`w-12 h-12 rounded-md flex items-center justify-center bg-gradient-to-br ${getRandomLogoColor(client.id)} text-white`}>
                        {client.avatar ? (
                          <img src={client.avatar} alt={client.name} className="w-10 h-10 object-cover rounded-md" />
                        ) : (
                          <span className="text-lg font-bold">
                            {client.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-lg truncate">{client.name}</h3>
                        {client.company && (
                          <p className="text-sm text-muted-foreground truncate">
                            {client.company}
                          </p>
                        )}
                      </div>
                      
                      <Badge className={`${getStatusColor(client.status)} ml-2`}>
                        {client.status}
                      </Badge>
                    </ClientCardHeader>
                    
                    <ClientCardContent className="pt-0 pb-3 px-4 space-y-4">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Camera className="h-4 w-4" />
                            <span>Shoots</span>
                          </div>
                          <p className="font-medium pl-6">{client.shootsCount || 0}</p>
                        </div>
                        
                        {/* <div className="space-y-2">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <GlobeIcon className="h-4 w-4" />
                            <span>Last Activity</span>
                          </div>
                          <p className="font-medium pl-6">
                            {client.lastActivity ? new Date(client.lastActivity).toLocaleDateString() : 'N/A'}
                          </p>
                        </div> */}
                      </div>
                      
                      <div className="flex justify-between items-center gap-2 pt-2">
                        <Button
                          size="sm"
                          onClick={(e) => onBookShoot(client, e)}
                          className="flex-1 bg-primary/10 hover:bg-primary/20 text-primary"
                        >
                          Book Shoot
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => onEdit(client, e)}
                          className="flex-1"
                        >
                          Edit
                        </Button>
                      </div>
                    </ClientCardContent>
                  </ClientCard>
                </motion.div>
              ))}
            </motion.div>
          </AnimatePresence>
          
          {totalPages > 1 && (
            <div className="fixed bottom-20 left-0 right-0 flex justify-center py-2 z-10">
              <div className="glass-card py-2 px-4 rounded-full shadow-md">
                <PaginationDots
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={handlePageChange}
                />
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="py-12 flex flex-col items-center justify-center bg-muted/20 rounded-lg border border-dashed">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <UserIcon className="h-8 w-8 text-primary opacity-80" />
          </div>
          <h3 className="font-medium text-lg">No clients found</h3>
          <p className="text-sm mt-1 text-muted-foreground">Try adjusting your search criteria</p>
        </div>
      )}
    </div>
  );
};
