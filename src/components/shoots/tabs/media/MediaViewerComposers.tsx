import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { MediaViewerModel } from './MediaViewerActions';

export function MediaViewerComposers({ model }: { model: MediaViewerModel }) {
  const closeRename = () => { model.setShowRenameComposer(false); model.setRenameDraft(''); };
  const closeRequest = () => { model.setShowRequestComposer(false); model.setFlagReason(''); };
  return <>
    <Dialog open={model.canShowRenameFilename && model.renameApiEnabled && model.showRenameComposer} onOpenChange={open => { if (!open && !model.renamingFilename) closeRename(); }}>
      <DialogContent className="media-viewer-composer-dialog" onEscapeKeyDown={event => event.stopPropagation()}>
        <DialogHeader><DialogTitle>Rename filename</DialogTitle><DialogDescription>Letters, numbers, spaces, and . _ - ( ) only. The extension stays the same if omitted.</DialogDescription></DialogHeader>
        <form onSubmit={event => { event.preventDefault(); void model.handleSubmitRename(); }}>
          <Input autoFocus aria-label="New filename" value={model.renameDraft} onChange={event => model.setRenameDraft(event.target.value)} disabled={model.renamingFilename} />
          <div className="mt-4 flex justify-end gap-2"><Button type="button" variant="ghost" onClick={closeRename} disabled={model.renamingFilename}>Cancel</Button><Button type="submit" disabled={!model.renameDraft.trim() || model.renamingFilename}>{model.renamingFilename ? 'Saving…' : 'Save name'}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
    <Dialog open={model.canRequestModification && model.showRequestComposer} onOpenChange={open => { if (!open && !model.flagging) closeRequest(); }}>
      <DialogContent className="media-viewer-composer-dialog" onEscapeKeyDown={event => event.stopPropagation()}>
        <DialogHeader><DialogTitle>Request modification</DialogTitle><DialogDescription>Describe the changes needed for this image.</DialogDescription></DialogHeader>
        <form onSubmit={event => { event.preventDefault(); void model.handleFlagImage(); }}>
          <Textarea autoFocus aria-label="Modification request" value={model.flagReason} onChange={event => model.setFlagReason(event.target.value)} placeholder="What would you like changed?" disabled={model.flagging} />
          <div className="mt-4 flex justify-end gap-2"><Button type="button" variant="ghost" onClick={closeRequest} disabled={model.flagging}>Cancel</Button><Button type="submit" disabled={!model.flagReason.trim() || model.flagging}>{model.flagging ? 'Creating request…' : 'Create request'}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  </>;
}
