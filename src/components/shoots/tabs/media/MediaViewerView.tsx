import { useState } from 'react';
import { Heart, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMediaQuery } from '@/hooks/use-media-query';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatViewerFileSize } from './mediaViewerTypes';
import { MediaViewerSlideshow } from './MediaViewerSlideshow';
import { MediaViewerActions, type MediaViewerModel } from './MediaViewerActions';
import { MediaViewerCanvas } from './MediaViewerCanvas';
import { MediaViewerInspector } from './MediaViewerInspector';
import { MediaViewerComposers } from './MediaViewerComposers';
import { MediaViewerZoomControls } from './MediaViewerControls';
import './mediaViewerGlass.css';

export function MediaViewerView({ model }: { model: MediaViewerModel }) {
  const { isOpen, onClose, currentFile, displayFilename, currentIndex, files, shoot, isClient, viewerMode, slideshowCurrentFile } = model;
  const [mobileInformationOpen, setMobileInformationOpen] = useState(false);
  const controlsInHeader = useMediaQuery('(min-width: 1001px)');
  return <>
    <Dialog open={isOpen} onOpenChange={next => { if (!next) onClose(); }}>
      <DialogContent className="media-viewer-dialog" style={{ zIndex: 100 }} onEscapeKeyDown={event => {
        if (model.showRequestComposer || model.showRenameComposer) { event.preventDefault(); return; }
        if (viewerMode === 'slideshow') { event.preventDefault(); event.stopPropagation(); model.exitSlideshow(); return; }
        if (mobileInformationOpen) { event.preventDefault(); event.stopPropagation(); setMobileInformationOpen(false); }
      }}>
        <DialogHeader className="sr-only"><DialogTitle>Media Viewer</DialogTitle><DialogDescription>View and discuss media files for this shoot</DialogDescription></DialogHeader>
        {viewerMode === 'slideshow' && slideshowCurrentFile ? <MediaViewerSlideshow model={model} /> : <div className="media-viewer-shell">
          <header className="media-viewer-header">
            <div className="media-viewer-heading">
              <p className="media-viewer-breadcrumb">{shoot?.location?.address || 'Shoot media'}<span>›</span>{currentFile.media_type?.replace(/_/g, ' ') || 'All media'}</p>
              <h2 title={displayFilename}>{displayFilename}</h2>
              <p className="media-viewer-metadata"><span>{currentIndex + 1} of {files.length}</span>{currentFile.width && currentFile.height && <span>{currentFile.width} × {currentFile.height}</span>}{!isClient && Boolean(currentFile.fileSize) && <span>{formatViewerFileSize(currentFile.fileSize)}</span>}</p>
            </div>
            {controlsInHeader && model.isImg && <div className="media-viewer-header-viewing-controls"><MediaViewerZoomControls model={model} inline /></div>}
            <div className="media-viewer-header-controls">
              {model.canInteractSingleMedia && model.onToggleFavorite && <Button variant="ghost" size="icon" className={`media-viewer-icon-button ${currentFile.is_favorite ? 'media-viewer-liked' : ''}`} onClick={() => model.onToggleFavorite?.(currentFile.id)} aria-label={currentFile.is_favorite ? 'Unlike image' : 'Like image'} aria-pressed={Boolean(currentFile.is_favorite)}><Heart className={currentFile.is_favorite ? 'fill-current' : ''} /></Button>}
              <MediaViewerActions model={model} />
              <Button variant="ghost" size="icon" className="media-viewer-icon-button" onClick={onClose} aria-label="Close media viewer"><X /></Button>
            </div>
          </header>
          <div className="media-viewer-workspace"><MediaViewerCanvas model={model} controlsInHeader={controlsInHeader} /><MediaViewerInspector model={model} mobileOpen={mobileInformationOpen} setMobileOpen={setMobileInformationOpen} /></div>
          <footer className="media-viewer-keyboard-hint">← → to navigate · + − to zoom · Esc to close</footer>
        </div>}
      </DialogContent>
    </Dialog>
    <MediaViewerComposers model={model} />
  </>;
}
