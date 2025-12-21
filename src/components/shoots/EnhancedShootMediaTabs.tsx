import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Download,
  Upload,
  Image as ImageIcon,
  AlertTriangle,
  Star,
  Trash2,
  Flag,
} from 'lucide-react';
import { useAuth } from '@/components/auth';
import { useToast } from '@/hooks/use-toast';
import {
  fetchShootMedia,
  uploadRawPhotos,
  uploadExtraPhotos,
  uploadEditedPhotos,
  downloadMediaZip,
  type DropboxMediaFile,
} from '@/services/dropboxMediaService';
import { MissingPhotosAlert, PhotoCountsSummary } from './MissingPhotosAlert';
import { BracketModeSelector, type BracketMode } from './BracketModeSelector';
import { MediaUploadProgress } from './MediaUploadProgress';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface EnhancedShootMediaTabsProps {
  shootId: string;
  rawPhotoCount?: number;
  editedPhotoCount?: number;
  extraPhotoCount?: number;
  expectedRawCount?: number;
  expectedFinalCount?: number;
  rawMissingCount?: number;
  editedMissingCount?: number;
  bracketMode?: BracketMode;
  canUploadRaw?: boolean;
  canUploadEdited?: boolean;
  onCountsUpdate?: () => void;
}

export const EnhancedShootMediaTabs: React.FC<EnhancedShootMediaTabsProps> = ({
  shootId,
  rawPhotoCount = 0,
  editedPhotoCount = 0,
  extraPhotoCount = 0,
  expectedRawCount = 0,
  expectedFinalCount = 0,
  rawMissingCount = 0,
  editedMissingCount = 0,
  bracketMode: initialBracketMode = null,
  canUploadRaw = false,
  canUploadEdited = false,
  onCountsUpdate,
}) => {
  const { session } = useAuth();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState('raw');
  const [rawFiles, setRawFiles] = useState<DropboxMediaFile[]>([]);
  const [editedFiles, setEditedFiles] = useState<DropboxMediaFile[]>([]);
  const [extraFiles, setExtraFiles] = useState<DropboxMediaFile[]>([]);
  const [flaggedFiles, setFlaggedFiles] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedCount, setUploadedCount] = useState(0);
  const [totalUploadCount, setTotalUploadCount] = useState(0);
  const [currentFileName, setCurrentFileName] = useState<string>();
  
  const [selectedBracketMode, setSelectedBracketMode] = useState<BracketMode>(initialBracketMode);
  const [counts, setCounts] = useState({
    raw_photo_count: rawPhotoCount,
    edited_photo_count: editedPhotoCount,
    extra_photo_count: extraPhotoCount,
    expected_raw_count: expectedRawCount,
    expected_final_count: expectedFinalCount,
    raw_missing_count: rawMissingCount,
    edited_missing_count: editedMissingCount,
    bracket_mode: initialBracketMode,
  });

  useEffect(() => {
    if (activeTab === 'raw') {
      loadRawFiles();
    } else if (activeTab === 'edited') {
      loadEditedFiles();
    } else if (activeTab === 'extra') {
      loadExtraFiles();
    }
  }, [activeTab, shootId]);

  const loadRawFiles = async () => {
    if (!session?.access_token) return;
    
    setLoading(true);
    try {
      const response = await fetchShootMedia(shootId, 'raw', session.access_token);
      setRawFiles(response.data);
      setCounts(response.counts);
    } catch (error) {
      console.error('Failed to load RAW files:', error);
      toast({
        title: 'Error',
        description: 'Failed to load RAW files',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadEditedFiles = async () => {
    if (!session?.access_token) return;
    
    setLoading(true);
    try {
      const response = await fetchShootMedia(shootId, 'edited', session.access_token);
      setEditedFiles(response.data);
      setCounts(response.counts);
    } catch (error) {
      console.error('Failed to load edited files:', error);
      toast({
        title: 'Error',
        description: 'Failed to load edited files',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadExtraFiles = async () => {
    if (!session?.access_token) return;
    
    setLoading(true);
    try {
      const response = await fetchShootMedia(shootId, 'extra', session.access_token);
      setExtraFiles(response.data);
      setCounts(response.counts);
    } catch (error) {
      console.error('Failed to load extra files:', error);
      toast({
        title: 'Error',
        description: 'Failed to load extra files',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRawUpload = async (files: FileList) => {
    if (!session?.access_token || files.length === 0) return;

    setUploading(true);
    setUploadProgress(0);
    setUploadedCount(0);
    setTotalUploadCount(files.length);

    try {
      const fileArray = Array.from(files);
      const response = await uploadRawPhotos(
        shootId,
        fileArray,
        selectedBracketMode,
        session.access_token,
        (progress) => {
          setUploadProgress(progress);
          if (fileArray[Math.floor((progress / 100) * fileArray.length)]) {
            setCurrentFileName(fileArray[Math.floor((progress / 100) * fileArray.length)].name);
          }
        }
      );

      setUploadedCount(fileArray.length);
      toast({
        title: 'Success',
        description: `Uploaded ${response.success_count} RAW photos`,
      });

      loadRawFiles();
      onCountsUpdate?.();
    } catch (error) {
      console.error('Failed to upload RAW files:', error);
      toast({
        title: 'Error',
        description: 'Failed to upload RAW files',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleExtraUpload = async (files: FileList) => {
    if (!session?.access_token || files.length === 0) return;

    setUploading(true);
    setUploadProgress(0);
    setUploadedCount(0);
    setTotalUploadCount(files.length);

    try {
      const fileArray = Array.from(files);
      const response = await uploadExtraPhotos(
        shootId,
        fileArray,
        session.access_token,
        (progress) => setUploadProgress(progress)
      );

      setUploadedCount(fileArray.length);
      toast({
        title: 'Success',
        description: `Uploaded ${fileArray.length} extra photos`,
      });

      loadExtraFiles();
      onCountsUpdate?.();
    } catch (error) {
      console.error('Failed to upload extra files:', error);
      toast({
        title: 'Error',
        description: 'Failed to upload extra files',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleEditedUpload = async (files: FileList) => {
    if (!session?.access_token || files.length === 0) return;

    setUploading(true);
    setUploadProgress(0);
    setUploadedCount(0);
    setTotalUploadCount(files.length);

    try {
      const fileArray = Array.from(files);
      const response = await uploadEditedPhotos(
        shootId,
        fileArray,
        session.access_token,
        (progress) => setUploadProgress(progress)
      );

      setUploadedCount(fileArray.length);
      toast({
        title: 'Success',
        description: `Uploaded ${response.success_count} edited photos`,
      });

      loadEditedFiles();
      onCountsUpdate?.();
    } catch (error) {
      console.error('Failed to upload edited files:', error);
      toast({
        title: 'Error',
        description: 'Failed to upload edited files',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDownloadZip = async (type: 'raw' | 'edited') => {
    if (!session?.access_token) return;

    try {
      const response = await downloadMediaZip(shootId, type, session.access_token);
      
      if (response.type === 'redirect' && response.url) {
        window.open(response.url, '_blank');
      }
      
      toast({
        title: 'Download Started',
        description: `Downloading ${type} photos as ZIP`,
      });
    } catch (error) {
      console.error('Failed to download ZIP:', error);
      toast({
        title: 'Error',
        description: 'Failed to download ZIP file',
        variant: 'destructive',
      });
    }
  };

  const renderMediaGrid = (files: DropboxMediaFile[]) => {
    if (loading) {
      return <div className="text-center py-8 text-muted-foreground">Loading files...</div>;
    }

    if (files.length === 0) {
      return (
        <div className="text-center py-12">
          <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No files uploaded yet</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {files.map((file) => (
          <Card key={file.id} className="overflow-hidden">
            <CardContent className="p-2">
              <div className="aspect-square bg-muted rounded flex items-center justify-center mb-2">
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="text-xs truncate" title={file.name}>
                {file.name}
              </div>
              <div className="text-xs text-muted-foreground">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <PhotoCountsSummary
        rawUploaded={counts.raw_photo_count}
        rawExpected={counts.expected_raw_count}
        editedUploaded={counts.edited_photo_count}
        editedExpected={counts.expected_final_count}
        extraUploaded={counts.extra_photo_count}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="raw">
            RAW
            <Badge variant="secondary" className="ml-2">
              {counts.raw_photo_count}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="extra">
            Extra
            <Badge variant="secondary" className="ml-2">
              {counts.extra_photo_count}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="edited">
            Edited
            <Badge variant="secondary" className="ml-2">
              {counts.edited_photo_count}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="flagged">
            <Flag className="h-4 w-4 mr-1" />
            Flagged
          </TabsTrigger>
        </TabsList>

        <TabsContent value="raw" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  RAW Media · {counts.raw_photo_count} / {counts.expected_raw_count} files
                  {counts.raw_missing_count > 0 && (
                    <span className="text-destructive ml-2">
                      · {counts.raw_missing_count} missing
                    </span>
                  )}
                  {counts.bracket_mode && (
                    <span className="text-muted-foreground ml-2">
                      · Bracket: {counts.bracket_mode}
                    </span>
                  )}
                </CardTitle>
                <Button onClick={() => handleDownloadZip('raw')} variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Download RAW (ZIP)
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {canUploadRaw && (
                <>
                  <BracketModeSelector
                    value={selectedBracketMode}
                    onChange={setSelectedBracketMode}
                    expectedDeliveredCount={counts.expected_final_count}
                  />
                  
                  <div>
                    <Input
                      type="file"
                      multiple
                      accept="image/*,.raw,.cr2,.nef,.arw,.dng"
                      onChange={(e) => e.target.files && handleRawUpload(e.target.files)}
                      disabled={uploading}
                    />
                  </div>

                  <MediaUploadProgress
                    isUploading={uploading}
                    progress={uploadProgress}
                    uploadedCount={uploadedCount}
                    totalCount={totalUploadCount}
                    currentFileName={currentFileName}
                  />
                </>
              )}

              {counts.raw_missing_count !== 0 && (
                <MissingPhotosAlert
                  type="raw"
                  uploaded={counts.raw_photo_count}
                  expected={counts.expected_raw_count}
                  missing={counts.raw_missing_count}
                  bracketMode={counts.bracket_mode}
                />
              )}

              {renderMediaGrid(rawFiles)}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="extra" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Extra RAW Media · {counts.extra_photo_count} files
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {canUploadRaw && (
                <div>
                  <Input
                    type="file"
                    multiple
                    accept="image/*,.raw,.cr2,.nef,.arw,.dng"
                    onChange={(e) => e.target.files && handleExtraUpload(e.target.files)}
                    disabled={uploading}
                  />
                  
                  <MediaUploadProgress
                    isUploading={uploading}
                    progress={uploadProgress}
                    uploadedCount={uploadedCount}
                    totalCount={totalUploadCount}
                    currentFileName={currentFileName}
                  />
                </div>
              )}

              {renderMediaGrid(extraFiles)}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="edited" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  Edited Media · {counts.edited_photo_count} / {counts.expected_final_count} delivered
                </CardTitle>
                <Button onClick={() => handleDownloadZip('edited')} variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Download Edited (ZIP)
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {canUploadEdited && (
                <div>
                  <Input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={(e) => e.target.files && handleEditedUpload(e.target.files)}
                    disabled={uploading}
                  />
                  
                  <MediaUploadProgress
                    isUploading={uploading}
                    progress={uploadProgress}
                    uploadedCount={uploadedCount}
                    totalCount={totalUploadCount}
                    currentFileName={currentFileName}
                  />
                </div>
              )}

              {counts.edited_missing_count !== 0 && (
                <MissingPhotosAlert
                  type="edited"
                  uploaded={counts.edited_photo_count}
                  expected={counts.expected_final_count}
                  missing={counts.edited_missing_count}
                />
              )}

              {renderMediaGrid(editedFiles)}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="flagged" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Flagged Photos</CardTitle>
            </CardHeader>
            <CardContent>
              {flaggedFiles.length === 0 ? (
                <div className="text-center py-12">
                  <Flag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No flagged photos</p>
                </div>
              ) : (
                renderMediaGrid(flaggedFiles)
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

