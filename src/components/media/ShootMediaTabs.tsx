import React, { useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Download,
  Heart,
  MessageSquare,
  Flag,
  Trash2,
  Star,
  ImageIcon,
  Filter,
  ChevronDown,
} from 'lucide-react';
import type { Role } from '@/components/auth/AuthProvider';
import type { ShootFileData } from '@/types/shoots';
import { cn } from '@/lib/utils';

export type MediaStage = 'raw' | 'edited' | 'flagged';

export interface ShootMediaItem {
  id: string;
  url?: string;
  thumbnail?: string;
  fallbackColor?: string;
  name?: string;
  sequence?: number;
  stage: MediaStage;
  type?: 'image' | 'video' | 'file';
  favorite?: boolean;
  isCover?: boolean;
  flaggedReason?: string;
  flaggedBy?: string;
  uploadedBy?: string;
  bracketGroup?: number;
  orientation?: 'portrait' | 'landscape';
  metadata?: Record<string, unknown>;
}

export type MediaActionType =
  | 'favorite'
  | 'download'
  | 'cover'
  | 'comment'
  | 'flag'
  | 'delete'
  | 'bulk_download'
  | 'bulk_delete';

interface ShootMediaTabsProps {
  items: ShootMediaItem[];
  role: Role;
  expectedRawCount?: number;
  rawUploadedCount?: number;
  rawMissingCount?: number;
  expectedFinalCount?: number;
  editedUploadedCount?: number;
  editedMissingCount?: number;
  onAction?: (action: MediaActionType, item?: ShootMediaItem) => void;
  onBulkAction?: (action: MediaActionType, selectedIds: string[]) => void;
  filesMeta?: ShootFileData[];
}

const placeholderColors = ['#0f172a', '#1d4ed8', '#7c3aed', '#0f766e', '#a16207'];

const getFallbackColor = (index: number) => placeholderColors[index % placeholderColors.length];

const getStageLabel = (stage: MediaStage) => {
  switch (stage) {
    case 'raw':
      return 'RAW Uploaded';
    case 'edited':
      return 'Edited';
    case 'flagged':
      return 'Flagged / Issues';
    default:
      return stage;
  }
};

const MediaTile: React.FC<{
  item: ShootMediaItem;
  selectable: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  role: Role;
  onAction?: (action: MediaActionType, item: ShootMediaItem) => void;
}> = ({ item, selectable, isSelected, onToggleSelect, role, onAction }) => {
  const showDelete = role !== 'client';
  const showCover = role !== 'client';

  const imageSrc = item.thumbnail || item.url;

  return (
    <div className="group relative overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm transition hover:shadow-md">
      {selectable && (
        <div className="absolute left-3 top-3 z-10">
          <Checkbox checked={isSelected} onCheckedChange={() => onToggleSelect()} />
        </div>
      )}
      <div className="relative h-48 w-full bg-muted">
        {imageSrc ? (
          <img src={imageSrc} alt={item.name || 'Media file'} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center text-white"
            style={{ backgroundColor: item.fallbackColor || getFallbackColor(item.sequence || 0) }}
          >
            <ImageIcon className="h-8 w-8 opacity-70" />
          </div>
        )}
        <div className="absolute bottom-3 left-3 flex items-center gap-2">
          <Badge variant="secondary" className="rounded-full bg-black/60 px-3 text-white backdrop-blur">
            #{item.sequence ?? '–'}
          </Badge>
          {item.bracketGroup && (
            <Badge variant="outline" className="rounded-full border-white/40 bg-black/40 text-white backdrop-blur">
              Bracket {item.bracketGroup}
            </Badge>
          )}
        </div>
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/70 via-black/20 to-transparent px-3 py-2 text-white opacity-0 transition group-hover:opacity-100">
          <div className="flex items-center gap-1 text-xs font-medium">
            {item.type?.toUpperCase() ?? 'IMAGE'}
            {item.orientation && <span className="text-white/70">· {item.orientation}</span>}
          </div>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn('h-8 w-8 text-white hover:text-primary', item.favorite && 'text-red-400')}
                  onClick={(e) => {
                    e.stopPropagation();
                    onAction?.('favorite', item);
                  }}
                >
                  <Heart className="h-4 w-4" fill={item.favorite ? 'currentColor' : 'none'} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Favorite</TooltipContent>
            </Tooltip>

            {showCover && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn('h-8 w-8 text-white hover:text-primary', item.isCover && 'text-yellow-300')}
                    onClick={(e) => {
                      e.stopPropagation();
                      onAction?.('cover', item);
                    }}
                  >
                    <Star className="h-4 w-4" fill={item.isCover ? 'currentColor' : 'none'} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Mark as cover</TooltipContent>
              </Tooltip>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-white hover:text-primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAction?.('download', item);
                  }}
                >
                  <Download className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Download</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>

      <div className="space-y-2 p-4">
        <div className="flex items-center justify-between text-sm font-medium">
          <span className="truncate">{item.name || 'Untitled photo'}</span>
          {item.isCover && <Badge variant="outline">Cover</Badge>}
        </div>
        {item.flaggedReason && (
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <p className="font-semibold">Flagged</p>
            <p>{item.flaggedReason}</p>
            {item.flaggedBy && <p className="text-amber-700/80">by {item.flaggedBy}</p>}
          </div>
        )}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {item.uploadedBy && <span>Uploaded by {item.uploadedBy}</span>}
          {item.metadata?.uploadedAt && <span>· {item.metadata.uploadedAt}</span>}
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onAction?.('comment', item)}
                >
                  <MessageSquare className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Comment</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onAction?.('flag', item)}>
                  <Flag className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Flag issue</TooltipContent>
            </Tooltip>
          </div>
          {showDelete && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={() => onAction?.('delete', item)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Delete</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </div>
  );
};

const ShootMediaTabs: React.FC<ShootMediaTabsProps> = ({
  items,
  role,
  expectedRawCount,
  rawUploadedCount,
  rawMissingCount,
  expectedFinalCount,
  editedUploadedCount,
  editedMissingCount,
  onAction,
  onBulkAction,
}) => {
  const [tab, setTab] = useState<MediaStage>('raw');
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [orientationFilter, setOrientationFilter] = useState<'all' | 'portrait' | 'landscape'>('all');
  const [favoriteFilter, setFavoriteFilter] = useState<'all' | 'favorites'>('all');
  const [bracketFilter, setBracketFilter] = useState<'all' | '3' | '5'>('all');

  const byStage = useMemo(() => {
    return {
      raw: items.filter((item) => item.stage === 'raw'),
      edited: items.filter((item) => item.stage === 'edited'),
      flagged: items.filter((item) => item.stage === 'flagged'),
    };
  }, [items]);

  const filteredList = useMemo(() => {
    return byStage[tab].filter((item) => {
      if (orientationFilter !== 'all' && item.orientation !== orientationFilter) return false;
      if (favoriteFilter === 'favorites' && !item.favorite) return false;
      if (bracketFilter !== 'all' && item.bracketGroup?.toString() !== bracketFilter) return false;
      return true;
    });
  }, [byStage, tab, orientationFilter, favoriteFilter, bracketFilter]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  };

  const handleSelectMode = () => {
    if (selectMode) {
      setSelected([]);
    }
    setSelectMode((prev) => !prev);
  };

  const handleBulkAction = (action: MediaActionType) => {
    if (selected.length === 0) return;
    onBulkAction?.(action, selected);
  };

  return (
    <div className="rounded-2xl border border-border/80 bg-card/80 p-4 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Media</p>
          <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
            {typeof expectedRawCount === 'number' && (
              <Badge variant="outline" className="rounded-full">
                RAW {rawUploadedCount ?? 0}/{expectedRawCount}{' '}
                {rawMissingCount ? `· Missing ${rawMissingCount}` : ''}
              </Badge>
            )}
            {typeof expectedFinalCount === 'number' && (
              <Badge variant="outline" className="rounded-full">
                Finals {editedUploadedCount ?? 0}/{expectedFinalCount}{' '}
                {editedMissingCount ? `· Missing ${editedMissingCount}` : ''}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleSelectMode}>
            {selectMode ? 'Cancel Selection' : 'Select Multiple'}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="sm" className="gap-1">
                <Download className="h-4 w-4" />
                Download All
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onAction?.('bulk_download')}>Full Resolution</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAction?.('bulk_download')}>Web Size</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAction?.('bulk_download')}>ZIP Package</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {selectMode && (
            <Button variant="destructive" size="sm" onClick={() => handleBulkAction('bulk_delete')}>
              Delete Selected ({selected.length})
            </Button>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 rounded-xl border bg-muted/20 p-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Filter className="h-4 w-4 text-muted-foreground" />
          Filters
        </div>
        <div className="flex flex-1 flex-wrap gap-3">
          <Select value={orientationFilter} onValueChange={(value) => setOrientationFilter(value as typeof orientationFilter)}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Orientation" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Orientations</SelectItem>
              <SelectItem value="landscape">Landscape</SelectItem>
              <SelectItem value="portrait">Portrait</SelectItem>
            </SelectContent>
          </Select>

          <Select value={favoriteFilter} onValueChange={(value) => setFavoriteFilter(value as typeof favoriteFilter)}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Favorites" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Photos</SelectItem>
              <SelectItem value="favorites">Favorites Only</SelectItem>
            </SelectContent>
          </Select>

          <Select value={bracketFilter} onValueChange={(value) => setBracketFilter(value as typeof bracketFilter)}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Bracket" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Brackets</SelectItem>
              <SelectItem value="3">3 bracket</SelectItem>
              <SelectItem value="5">5 bracket</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as MediaStage)} className="mt-4">
        <TabsList className="grid w-full grid-cols-3">
          {(['raw', 'edited', 'flagged'] as MediaStage[]).map((stage) => (
            <TabsTrigger key={stage} value={stage}>
              {getStageLabel(stage)} ({byStage[stage].length})
            </TabsTrigger>
          ))}
        </TabsList>

        {(['raw', 'edited', 'flagged'] as MediaStage[]).map((stage) => (
          <TabsContent key={stage} value={stage} className="mt-6">
            {tab === stage && (
              <ScrollArea className="h-full">
                {filteredList.length === 0 ? (
                  <div className="flex h-48 flex-col items-center justify-center rounded-2xl border border-dashed text-center text-muted-foreground">
                    <ImageIcon className="mb-2 h-8 w-8 opacity-60" />
                    <p>No media in this tab</p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {filteredList.map((item, index) => (
                      <MediaTile
                        key={item.id}
                        item={{ ...item, fallbackColor: item.fallbackColor ?? getFallbackColor(index) }}
                        selectable={selectMode}
                        isSelected={selected.includes(item.id)}
                        onToggleSelect={() => toggleSelect(item.id)}
                        role={role}
                        onAction={onAction}
                      />
                    ))}
                  </div>
                )}
              </ScrollArea>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default ShootMediaTabs;

