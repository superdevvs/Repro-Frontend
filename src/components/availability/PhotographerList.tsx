import React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface Photographer {
    id: string;
    name: string;
    avatar?: string;
}

interface PhotographerListProps {
    photographers: Photographer[];
    onSelect: (id: string) => void;
}

export function PhotographerList({ photographers, onSelect }: PhotographerListProps) {
    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map(part => part[0])
            .join('')
            .toUpperCase()
            .substring(0, 2);
    };

    return (
        <div className="flex items-center justify-center h-full w-full min-h-[400px]">
            <div className="flex items-center -space-x-4 hover:space-x-1 transition-all duration-300">
                <TooltipProvider>
                    {photographers.map((photographer, index) => (
                        <Tooltip key={photographer.id} delayDuration={0}>
                            <TooltipTrigger asChild>
                                <div
                                    className={cn(
                                        "relative group cursor-pointer transition-all duration-300 hover:-translate-y-2 hover:z-10",
                                        "border-4 border-background rounded-full"
                                    )}
                                    onClick={() => onSelect(photographer.id)}
                                    style={{ zIndex: index }}
                                >
                                    <Avatar className="h-16 w-16 sm:h-20 sm:w-20 border-2 border-muted transition-transform group-hover:scale-110">
                                        <AvatarImage src={photographer.avatar} alt={photographer.name} className="object-cover" />
                                        <AvatarFallback className="bg-muted text-muted-foreground text-lg font-semibold">
                                            {getInitials(photographer.name)}
                                        </AvatarFallback>
                                    </Avatar>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="bg-popover text-popover-foreground px-4 py-2 rounded-lg shadow-lg border text-sm font-medium mb-2">
                                <p>{photographer.name}</p>
                            </TooltipContent>
                        </Tooltip>
                    ))}
                </TooltipProvider>
                {photographers.length === 0 && (
                    <div className="text-muted-foreground text-sm">No photographers found</div>
                )}
            </div>
        </div>
    );
}
