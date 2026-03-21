import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Search, X, ImageIcon } from 'lucide-react';
import { apiClient } from '@/services/api';
import { API_BASE_URL } from '@/config/env';
import { getImageUrl, type ImageUrlFields } from '@/utils/imageUrl';
import type { VideoPreset } from '@/services/higgsFieldService';

interface ShootOption {
  id: number;
  address: string;
  status: string;
  photo_count?: number;
  thumbnail?: string;
  created_at: string;
  files?: any[];
}

interface MediaFile extends ImageUrlFields {
  id: number;
  filename: string;
  fileType?: string;
}

interface ShootAndImageSelectorProps {
  preset: VideoPreset;
  selectedShootId: number | null;
  startFrameId: number | null;
  endFrameId: number | null;
  onShootSelect: (shootId: number) => void;
  onStartFrameSelect: (fileId: number | null) => void;
  onEndFrameSelect: (fileId: number | null) => void;
}

function getShootThumbUrl(shoot: ShootOption): string | null {
  if (shoot.thumbnail) {
    if (/^https?:\/\//i.test(shoot.thumbnail)) return shoot.thumbnail;
    return `${API_BASE_URL}${shoot.thumbnail.startsWith('/') ? '' : '/'}${shoot.thumbnail}`;
  }
  return null;
}

export function ShootAndImageSelector({
  preset,
  selectedShootId,
  startFrameId,
  endFrameId,
  onShootSelect,
  onStartFrameSelect,
  onEndFrameSelect,
}: ShootAndImageSelectorProps) {
  const [shoots, setShoots] = useState<ShootOption[]>([]);
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingShoots, setLoadingShoots] = useState(true);
  const [loadingFiles, setLoadingFiles] = useState(false);

  // Load shoots - fetch delivered + completed (uploaded) tabs which have photos
  useEffect(() => {
    const loadShoots = async () => {
      try {
        const [deliveredRes, completedRes] = await Promise.all([
          apiClient.get('/shoots', { params: { per_page: 100, tab: 'delivered' } }),
          apiClient.get('/shoots', { params: { per_page: 100, tab: 'completed' } }),
        ]);

        const parseData = (res: any) => {
          const d = res.data?.data || res.data || [];
          return Array.isArray(d) ? d : [];
        };

        const delivered = parseData(deliveredRes);
        const completed = parseData(completedRes);

        // Combine and deduplicate by id
        const combined = [...delivered, ...completed];
        const seen = new Set<number>();
        const unique = combined.filter((s: any) => {
          if (seen.has(s.id)) return false;
          seen.add(s.id);
          return true;
        });

        // Map API fields to our interface
        const mapped: ShootOption[] = unique.map((s: any) => ({
          id: s.id,
          address: s.address || s.property_address || s.location || '',
          status: s.status || '',
          photo_count: s.edited_photo_count || s.raw_photo_count || s.media_summary?.editedUploaded || s.media_summary?.delivered || s.files_count || 0,
          thumbnail: s.hero_image || s.thumbnail || s.cover_image || null,
          created_at: s.created_at || '',
        }));

        setShoots(mapped);
      } catch (err) {
        console.error('Failed to load shoots:', err);
      } finally {
        setLoadingShoots(false);
      }
    };
    loadShoots();
  }, []);

  // Load files when shoot is selected
  useEffect(() => {
    if (!selectedShootId) {
      setFiles([]);
      return;
    }

    const loadFiles = async () => {
      setLoadingFiles(true);
      try {
        const response = await apiClient.get(`/shoots/${selectedShootId}/files`);
        const data = response.data?.data || response.data || [];
        const imageFiles = (Array.isArray(data) ? data : []).filter(
          (f: MediaFile) => !f.fileType || f.fileType?.startsWith('image')
        );
        setFiles(imageFiles);
      } catch (err) {
        console.error('Failed to load shoot files:', err);
      } finally {
        setLoadingFiles(false);
      }
    };
    loadFiles();
  }, [selectedShootId]);

  const filteredShoots = shoots.filter((s) =>
    s.address?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleImageClick = (fileId: number) => {
    if (startFrameId === fileId) {
      onStartFrameSelect(null);
      return;
    }
    if (endFrameId === fileId) {
      onEndFrameSelect(null);
      return;
    }

    if (!startFrameId) {
      onStartFrameSelect(fileId);
    } else if (!endFrameId && preset.max_frames === 2) {
      onEndFrameSelect(fileId);
    }
  };

  const selectedShoot = shoots.find((s) => s.id === selectedShootId);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">
          Select Property & Images
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Choose a property and select {preset.max_frames === 1 ? '1 image' : 'up to 2 images'} for your{' '}
          {preset.name} video
        </p>
      </div>

      {/* Shoot selector */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Property</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search properties..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        {loadingShoots ? (
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-4 py-3 flex items-center gap-3">
                <Skeleton className="h-12 w-16 rounded-md flex-shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            ))}
          </div>
        ) : !selectedShootId ? (
          <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700">
            {filteredShoots.map((shoot) => {
              const thumbUrl = getShootThumbUrl(shoot);
              return (
                <button
                  key={shoot.id}
                  onClick={() => onShootSelect(shoot.id)}
                  className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 last:border-b-0"
                >
                  {/* Thumbnail */}
                  <div className="w-16 h-12 rounded-md overflow-hidden bg-slate-100 dark:bg-slate-800 flex-shrink-0">
                    {thumbUrl ? (
                      <img src={thumbUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="h-4 w-4 text-slate-400" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                      {shoot.address || `Shoot #${shoot.id}`}
                    </p>
                    <p className="text-xs text-slate-500">{shoot.photo_count || 0} photos</p>
                  </div>
                  <Badge variant="secondary" className="text-[10px] flex-shrink-0">
                    {shoot.status}
                  </Badge>
                </button>
              );
            })}
            {filteredShoots.length === 0 && (
              <p className="text-center text-sm text-slate-400 py-6">No properties found</p>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
            {/* Selected shoot thumbnail */}
            {(() => {
              const thumbUrl = selectedShoot ? getShootThumbUrl(selectedShoot) : null;
              return thumbUrl ? (
                <div className="w-14 h-10 rounded-md overflow-hidden flex-shrink-0">
                  <img src={thumbUrl} alt="" className="w-full h-full object-cover" />
                </div>
              ) : null;
            })()}
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                {selectedShoot?.address || `Shoot #${selectedShootId}`}
              </p>
              <p className="text-xs text-slate-500">{files.length} images available</p>
            </div>
            <button
              onClick={() => {
                onShootSelect(0 as any);
                onStartFrameSelect(null);
                onEndFrameSelect(null);
                setSearchTerm('');
              }}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Image grid - taller scrollable area */}
      {selectedShootId && (
        <div className="space-y-3">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Select Images ({files.length} available)
          </label>

          {loadingFiles ? (
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {Array.from({ length: 15 }).map((_, i) => (
                <Skeleton key={i} className="aspect-[4/3] rounded-lg" />
              ))}
            </div>
          ) : (
            <>
              <div className="max-h-[420px] overflow-y-auto rounded-lg pr-1">
                <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {files.map((file) => {
                    const isStart = startFrameId === file.id;
                    const isEnd = endFrameId === file.id;
                    const isSelected = isStart || isEnd;
                    const imgUrl = getImageUrl(file, 'thumb');

                    return (
                      <div
                        key={file.id}
                        onClick={() => handleImageClick(file.id)}
                        className={`relative aspect-[4/3] rounded-lg overflow-hidden cursor-pointer group transition-all ${
                          isSelected
                            ? 'ring-3 ring-offset-2'
                            : 'hover:ring-2 hover:ring-slate-300 dark:hover:ring-slate-600'
                        } ${isStart ? 'ring-green-500' : isEnd ? 'ring-blue-500' : ''}`}
                      >
                        {imgUrl ? (
                          <img
                            src={imgUrl}
                            alt={file.filename}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                            <span className="text-xs text-slate-400">No preview</span>
                          </div>
                        )}

                        {/* Overlay badge */}
                        {isSelected && (
                          <div
                            className={`absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                              isStart ? 'bg-green-500' : 'bg-blue-500'
                            }`}
                          >
                            {isStart ? '1' : '2'}
                          </div>
                        )}

                        {/* Hover overlay */}
                        {!isSelected && (
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {files.length === 0 && (
                <p className="text-center text-sm text-slate-400 py-8">
                  No images found in this shoot
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* Selected images preview bar */}
      {(startFrameId || endFrameId) && (
        <div className="flex gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
          {startFrameId && (
            <div className="flex items-center gap-3">
              <div className="relative w-20 h-14 rounded-md overflow-hidden">
                <img
                  src={getImageUrl(files.find((f) => f.id === startFrameId) || {}, 'thumb')}
                  alt="Start frame"
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-1 left-1 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-white text-[10px] font-bold">
                  1
                </div>
              </div>
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Start Frame
              </span>
            </div>
          )}
          {endFrameId && (
            <div className="flex items-center gap-3">
              <div className="relative w-20 h-14 rounded-md overflow-hidden">
                <img
                  src={getImageUrl(files.find((f) => f.id === endFrameId) || {}, 'thumb')}
                  alt="End frame"
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-1 left-1 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-white text-[10px] font-bold">
                  2
                </div>
              </div>
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                End Frame
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
