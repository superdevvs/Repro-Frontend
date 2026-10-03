
import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  MailIcon,
  PhoneIcon,
  BuildingIcon,
  MoreHorizontalIcon,
  CalendarIcon,
  CameraIcon,
  MapPinIcon
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Card,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Client } from '@/types/clients';
import { ClientPortal } from '@/components/clients/ClientPortal';

interface ClientCardComponentProps {
  client: Client;
  onSelect: (client: Client) => void;
  onEdit: (client: Client, e: React.MouseEvent) => void;
  onBookShoot: (client: Client, e: React.MouseEvent) => void;
  onClientPortal: (client: Client, e: React.MouseEvent) => void;
  onDelete: (client: Client, e: React.MouseEvent) => void;
}

export const ClientCardComponent: React.FC<ClientCardComponentProps> = ({
  client,
  onSelect,
  onEdit,
  onBookShoot,
  onClientPortal,
  onDelete
}) => {
  const statusColors = {
    active: 'bg-green-100 text-green-800 border-green-200',
    inactive: 'bg-gray-100 text-gray-800 border-gray-200'
  };

  const openClientPortalInNewTab = (e: React.MouseEvent) => {
    e.stopPropagation();
    // route: /client-portal/:id  (React Router ya Next.js app route ke saath)
    const url = `${window.location.origin}/client-portal/${client.id}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    // optional: agar tum tracking/analytics ke liye parent handler chalana chahte ho
    onClientPortal(client, e);
  };


  return (
    <Card
      onClick={() => onSelect(client)}
      className="overflow-hidden transition-all hover:shadow-md border-border mb-4"
    >
      {/* Header with background and avatar */}
      <div className="relative bg-gradient-to-r from-primary/10 to-secondary/10 h-24">
        <div className="absolute -bottom-12 left-4">
          <Avatar className="h-24 w-24 border-4 border-background shadow-md">
            {client.avatar ? (
              <AvatarImage src={client.avatar} alt={client.name} />
            ) : (
              <AvatarFallback className="text-xl bg-primary/10 text-primary font-medium">
                {client.name.split(' ').map((n) => n[0]).join('')}
              </AvatarFallback>
            )}
          </Avatar>
        </div>
        <div className="absolute top-4 right-4">
          <Badge
            variant="outline"
            className={`${client.status === 'active'
              ? statusColors.active
              : statusColors.inactive}`}
          >
            {client.status}
          </Badge>
        </div>
      </div>

      {/* Content */}
      <CardContent className="pt-16 px-4 pb-4">
        <div className="flex flex-col gap-1 mb-3">
          <h3 className="font-semibold text-lg">{client.name}</h3>
          {client.company && (
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              <BuildingIcon className="h-3.5 w-3.5 inline" />
              {client.company}
            </p>
          )}
        </div>

        <div className="space-y-2.5">
          <div className="flex items-center gap-2.5 text-sm py-0.5">
            <MailIcon className="h-4 w-4 text-muted-foreground" />
            <span className="truncate">{client.email}</span>
          </div>

          {client.phone && (
            <div className="flex items-center gap-2.5 text-sm py-0.5">
              <PhoneIcon className="h-4 w-4 text-muted-foreground" />
              <span>{client.phone}</span>
            </div>
          )}
          {client.office_phone && (
            <div className="flex items-center gap-2.5 text-sm py-0.5">
              <PhoneIcon className="h-4 w-4 text-muted-foreground" />
              <span>Office: {client.office_phone}</span>
            </div>
          )}

          {client.address && (
            <div className="flex items-center gap-2.5 text-sm py-0.5">
              <MapPinIcon className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">{client.address}</span>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <div className="bg-muted/30 rounded-md px-2 py-1 flex items-center gap-1">
              <CameraIcon className="h-3 w-3 text-primary/80" />
              <span className="text-xs font-medium">{client.shootsCount || 0} shoots</span>
            </div>

            {client.lastActivity && (
              <div className="bg-muted/30 rounded-md px-2 py-1 flex items-center gap-1">
                <CalendarIcon className="h-3 w-3 text-primary/80" />
                <span className="text-xs font-medium">
                  {new Date(client.lastActivity).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        </div>
      </CardContent>

      {/* Footer */}
      <CardFooter className="flex justify-between border-t bg-muted/10 px-4 py-3">
        <Button
          variant="secondary"
          size="sm"
          className="px-4"
          onClick={(e) => {
            e.stopPropagation();
            onBookShoot(client, e);
          }}
        >
          Book Shoot
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="rounded-full h-8 w-8">
              <MoreHorizontalIcon className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={(e) => {
              e.stopPropagation();
              onEdit(client, e);
            }}>
              Edit Client
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                const url = `${window.location.origin}/client-portal`;
                window.open(url, '_blank', 'noopener,noreferrer');
              }}
            >
              Client Portal
            </DropdownMenuItem>

            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(client, e);
              }}
            >
              Delete Client
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardFooter>
    </Card>
  );
};
