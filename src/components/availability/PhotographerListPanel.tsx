import { Search, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAvatarUrl } from "@/utils/defaultAvatars";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/availability/utils";
import type { Photographer } from "@/types/availability";

interface PhotographerListPanelProps {
  variant: "desktop" | "mobile-sheet";
  photographers: Photographer[];
  filteredPhotographers: Photographer[];
  selectedPhotographer: string;
  setSelectedPhotographer: (id: string) => void;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  setEditingWeeklySchedule: (value: boolean) => void;
  getPhotographerAvailabilityLabel: (id: string) => string;
  // For mobile-sheet
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function PhotographerListPanel({
  variant,
  filteredPhotographers,
  selectedPhotographer,
  setSelectedPhotographer,
  searchQuery,
  setSearchQuery,
  setEditingWeeklySchedule,
  getPhotographerAvailabilityLabel,
  open,
  onOpenChange,
}: PhotographerListPanelProps) {
  const listContent = (onSelect?: () => void) => (
    <>
      <div className={variant === "desktop" ? "mb-4" : "mt-4 space-y-3"}>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className={cn(
              "absolute left-3 top-1/2 h-4 w-4 text-muted-foreground",
              variant === "desktop" ? "transform -translate-y-1/2" : "-translate-y-1/2"
            )} />
            <Input
              placeholder="Search team..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn("pl-9", variant === "desktop" && "border-muted")}
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-9 px-3"
            onClick={() => {
              setSelectedPhotographer("all");
              setEditingWeeklySchedule(false);
              setSearchQuery("");
            }}
          >
            All
          </Button>
        </div>
      </div>
      <div className={cn(
        variant === "desktop"
          ? "flex-1 overflow-y-auto space-y-3"
          : "overflow-y-auto space-y-3 max-h-[calc(100vh-200px)]"
      )}>
        {filteredPhotographers.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">No photographers found</p>
          </div>
        )}
        {filteredPhotographers.map((photographer) => {
          const isSelected = selectedPhotographer === photographer.id;
          return (
            <div
              key={photographer.id}
              onClick={() => {
                setSelectedPhotographer(photographer.id);
                setEditingWeeklySchedule(false);
                onSelect?.();
              }}
              className={cn(
                "p-4 rounded-md cursor-pointer transition-all border-2",
                isSelected
                  ? "bg-primary text-primary-foreground border-primary shadow-md"
                  : "bg-card border-border hover:border-primary/50"
              )}
            >
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={getAvatarUrl(photographer.avatar, 'photographer', undefined, photographer.id)} alt={photographer.name} />
                  <AvatarFallback className={cn(
                    isSelected
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-muted text-foreground"
                  )}>
                    {getInitials(photographer.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "font-medium truncate",
                    isSelected ? "text-primary-foreground" : ""
                  )}>{photographer.name}</p>
                  <p className={cn(
                    "text-xs",
                    isSelected ? "text-primary-foreground/80" : "text-muted-foreground"
                  )}>
                    {getPhotographerAvailabilityLabel(photographer.id)}
                  </p>
                </div>
                {isSelected && (
                  <div className="h-2 w-2 rounded-full bg-green-500 ring-2 ring-primary-foreground/20" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );

  if (variant === "mobile-sheet") {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" className="shrink-0 gap-2 px-3">
            <Users className="h-4 w-4" />
            Team
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[85vw] sm:w-[400px]">
          <SheetHeader>
            <SheetTitle>Select Photographer</SheetTitle>
          </SheetHeader>
          {listContent(() => onOpenChange?.(false))}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <div className="lg:col-span-3 flex flex-col min-h-0">
      <Card className="p-4 flex flex-col h-full border shadow-sm rounded-md min-h-0 overflow-hidden">
        {listContent()}
      </Card>
    </div>
  );
}
