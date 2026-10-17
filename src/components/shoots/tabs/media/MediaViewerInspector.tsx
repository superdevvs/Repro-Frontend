import { useId } from 'react';
import { ArrowUp, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { formatViewerDateTime, getRequestStatusClassName } from './mediaViewerTypes';
import type { MediaViewerModel } from './MediaViewerActions';

export function MediaViewerInspector({ model }: { model: MediaViewerModel }) {
  const { currentFile, fileComments, showFileDetails, setShowFileDetails, detailRows, relatedRequests, requestsLoading,
    canInteractSingleMedia, onAddComment, commentDraft, setCommentDraft, shoot } = model;
  const id = useId();
  const initials = (name: string) => name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  const canComment = canInteractSingleMedia && Boolean(onAddComment);
  return <aside className="media-viewer-inspector" aria-label="Image discussion and details">
    <div className="media-viewer-inspector-tabs" role="tablist" aria-label="Image information">
      <button type="button" id={`${id}-comments`} role="tab" aria-selected={!showFileDetails} aria-controls={`${id}-panel`} tabIndex={!showFileDetails ? 0 : -1} onClick={() => setShowFileDetails(false)} onKeyDown={event => { if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); setShowFileDetails(true); (event.currentTarget.nextElementSibling as HTMLElement)?.focus(); } }}>
        Comments <span>{Number(currentFile.comment_count ?? fileComments.length)}</span>
      </button>
      <button type="button" id={`${id}-details`} role="tab" aria-selected={showFileDetails} aria-controls={`${id}-panel`} tabIndex={showFileDetails ? 0 : -1} onClick={() => setShowFileDetails(true)} onKeyDown={event => { if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); setShowFileDetails(false); (event.currentTarget.previousElementSibling as HTMLElement)?.focus(); } }}>Details</button>
    </div>
    <div className="media-viewer-discussion" id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${showFileDetails ? 'details' : 'comments'}`} tabIndex={0}>
      {showFileDetails ? <>
        <dl className="media-viewer-details">{detailRows.map(row => <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl>
        {(relatedRequests.length > 0 || requestsLoading) && <section className="media-viewer-history" aria-label="Revision history">
          <h3>Revision history</h3>
          {requestsLoading ? <p className="text-white/55">Loading request history…</p> : relatedRequests.map(request => <article key={request.id} className="media-viewer-note">
            <Badge className={`${getRequestStatusClassName(request.status)} border capitalize`}>{String(request.status || 'open').replace(/-/g, ' ')}</Badge>
            <p className="mt-2 text-xs text-white/55">{request.raisedBy?.name || 'Client request'}{request.assignedToRole && ` · Assigned to ${request.assignedToRole}`}</p>
            <p className="mt-2 whitespace-pre-wrap break-words">{request.note}</p>
            <time>{formatViewerDateTime(request.updatedAt || request.createdAt)}</time>
          </article>)}
          {shoot?.issuesResolvedAt && <p className="text-emerald-200">Issues resolved · {formatViewerDateTime(shoot.issuesResolvedAt)}</p>}
          {shoot?.submittedForReviewAt && <p className="text-blue-200">Submitted for review · {formatViewerDateTime(shoot.submittedForReviewAt)}</p>}
        </section>}
      </> : fileComments.length ? fileComments.slice().reverse().map((comment, index) => <article key={`${comment.timestamp ?? comment.comment}-${index}`} className="media-viewer-comment">
        <span className="media-viewer-avatar" aria-hidden>{initials(comment.author || 'Team note')}</span>
        <div className="media-viewer-note"><h3>{comment.author || 'Team note'}</h3><p>{comment.comment}</p><time>{formatViewerDateTime(comment.timestamp)}</time></div>
      </article>) : <div className="media-viewer-no-comments"><MessageCircle aria-hidden /><p>No comments yet</p><span>{canComment ? 'Start a conversation about this image.' : 'Comments for this image appear here.'}</span></div>}
    </div>
    {!showFileDetails && canComment && <form className="media-viewer-composer" onSubmit={event => { event.preventDefault(); if (!commentDraft.trim()) return; onAddComment?.(currentFile.id, commentDraft); setCommentDraft(''); }}>
      <label htmlFor={`${id}-comment`}><MessageCircle aria-hidden />Add to the conversation</label>
      <div className="media-viewer-compose-box">
        <Textarea id={`${id}-comment`} value={commentDraft} onChange={event => setCommentDraft(event.target.value)} placeholder="Write a comment about this photo…" aria-label="Comment for this image" />
        <div><Button type="button" variant="ghost" size="sm" onClick={() => setCommentDraft('')} disabled={!commentDraft.trim()}>Clear</Button><Button type="submit" size="sm" disabled={!commentDraft.trim()}>Post <ArrowUp className="h-3.5 w-3.5" /></Button></div>
      </div>
    </form>}
    <p className="media-viewer-inspector-foot"><MessageCircle aria-hidden />Notes stay with this image</p>
  </aside>;
}
