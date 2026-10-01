import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Pause, Play } from 'lucide-react';
import { format } from 'date-fns';
import type { DashboardShootSummary } from '@/types/dashboard';
import { cn } from '@/lib/utils';
import { useMediaQuery } from '@/hooks/use-media-query';
import { normalizeDashboardRole } from '@/utils/dashboardFilterPermissions';
import {
  formatDashboardDayDistance,
  formatDashboardShootSchedule,
  getDashboardBookedDayOffset,
  getDashboardShootDisplayDate,
} from '@/utils/dashboardShootSchedule';
import { formatWorkflowStatus } from '@/utils/status';
import { isStaffShootStackRole } from './earlierUnfinishedShoots';
import './EarlierShootsStack.css';

export interface EarlierShootsStackProps {
  /** Already scoped to the viewer and filtered to earlier unfinished work. */
  shoots: DashboardShootSummary[];
  role?: string;
  onSelect: (shoot: DashboardShootSummary) => void;
  className?: string;
}

const ROTATION_MS = 5000;
const REVIEW_STATUSES = new Set(['ready']);
const REVIEW_ROLES = new Set(['admin', 'superadmin', 'editing_manager']);

function cardStatus(shoot: DashboardShootSummary, role: string) {
  const value = (shoot.workflowStatus || shoot.status || '').toLowerCase();
  if (role === 'editor' && shoot.hasPendingEditorWork) return { label: 'Editing in progress', tone: 'editing' };
  if (REVIEW_STATUSES.has(value)) return { label: 'Ready to finalize', tone: 'ready' };
  if (['scheduled', 'booked', 'confirmed', 'raw_upload_pending'].includes(value)) {
    return { label: 'Needs status update', tone: 'attention' };
  }
  return {
    label: formatWorkflowStatus(value, 'In progress'),
    tone: ['editing', 'editing_uploaded', 'editing_issue'].includes(value) ? 'editing' : 'neutral',
  };
}

function hasOpenModal() {
  return Array.from(document.querySelectorAll(
    'dialog[open], [role="dialog"]:not([data-state="closed"]), [role="alertdialog"]:not([data-state="closed"]), [aria-modal="true"]',
  )).some((element) => !element.hasAttribute('hidden') && element.getAttribute('aria-hidden') !== 'true');
}

function EarlierShootsCarousel({ shoots, role, onSelect, className }: EarlierShootsStackProps) {
  const normalizedRole = normalizeDashboardRole(role);
  const editor = normalizedRole === 'editor';
  const rootRef = useRef<HTMLElement>(null);
  const shootsRef = useRef(shoots);
  shootsRef.current = shoots;
  const [selection, setSelection] = useState({ id: shoots[0].id, index: 0 });
  const foundIndex = shoots.findIndex((shoot) => shoot.id === selection.id);
  const index = foundIndex >= 0 ? foundIndex : Math.min(selection.index, shoots.length - 1);
  const active = shoots[index];
  const ids = shoots.map((shoot) => shoot.id).join(',');
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const canHover = useMediaQuery('(hover: hover)');
  const [playing, setPlaying] = useState(() =>
    typeof window.matchMedia !== 'function' || !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [touching, setTouching] = useState(false);
  const [hidden, setHidden] = useState(document.hidden);
  const [visible, setVisible] = useState(typeof IntersectionObserver === 'undefined');
  const [modalOpen, setModalOpen] = useState(hasOpenModal);
  const [cycle, setCycle] = useState(0);
  const gesture = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const instructionId = useId();
  const headingId = useId();
  const running = playing && shoots.length > 1 && !hidden && visible && !modalOpen
    && !focused && !touching && !(hovered && canHover);

  useEffect(() => {
    if (active.id !== selection.id || index !== selection.index) {
      setSelection({ id: active.id, index });
    }
  }, [active.id, index, selection.id, selection.index]);

  useEffect(() => { if (reducedMotion) setPlaying(false); }, [reducedMotion]);

  const move = useCallback((direction: number, targetId?: number) => {
    const items = shootsRef.current;
    setSelection((previous) => {
      const current = items.findIndex((shoot) => shoot.id === previous.id);
      const target = targetId == null
        ? ((current >= 0 ? current : Math.min(previous.index, items.length - 1)) + direction + items.length) % items.length
        : items.findIndex((shoot) => shoot.id === targetId);
      return target < 0 ? previous : { id: items[target].id, index: target };
    });
    setCycle((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(() => move(1), ROTATION_MS);
    return () => window.clearTimeout(timer);
  }, [running, active.id, ids, cycle, move]);

  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    let previousModal = hasOpenModal();
    const observer = new MutationObserver(() => {
      const nextModal = hasOpenModal();
      if (nextModal !== previousModal) {
        previousModal = nextModal;
        setModalOpen(nextModal);
      }
    });
    observer.observe(document.body, {
      childList: true, subtree: true, attributes: true,
      attributeFilter: ['open', 'data-state', 'aria-modal', 'aria-hidden', 'hidden'],
    });
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.1 });
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  const endTouch = (event: React.PointerEvent<HTMLElement>, cancelled = false) => {
    if (event.pointerType !== 'touch') return;
    const start = gesture.current;
    gesture.current = null;
    setTouching(false);
    if (!start || cancelled || start.pointerId !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.5) move(dx < 0 ? 1 : -1);
  };

  const status = cardStatus(active, normalizedRole);
  const canReview = REVIEW_ROLES.has(normalizedRole)
    && REVIEW_STATUSES.has((active.workflowStatus || active.status || '').toLowerCase());
  const date = getDashboardShootDisplayDate(active);
  const offset = getDashboardBookedDayOffset(active);
  const age = offset == null ? 'Earlier' : formatDashboardDayDistance(offset, date);
  const schedule = formatDashboardShootSchedule(active);
  const dateLabel = date ? format(date, 'MMM d') : active.dayLabel || 'Date unavailable';
  const person = editor ? active.services.map((service) => service.label).filter(Boolean).join(' · ') || 'Assigned media'
    : active.photographer?.name || 'Photographer unassigned';
  const firstDot = Math.max(0, Math.min(index - 2, shoots.length - 5));
  const helper = shoots.length < 2 ? 'One unfinished shoot'
    : !playing ? 'Auto switching off' : running ? 'Switches every 5s' : 'Paused while reading';

  return (
    <section
      ref={rootRef}
      className={cn('earlier-shoots-stack', className)}
      role="region"
      aria-roledescription="carousel"
      aria-labelledby={headingId}
      aria-describedby={instructionId}
      tabIndex={0}
      data-running={running}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
      }}
      onPointerDown={(event) => {
        if (event.pointerType !== 'touch') return;
        setTouching(true);
        if (!(event.target as Element).closest('button')) {
          gesture.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
        }
      }}
      onPointerUp={(event) => endTouch(event)}
      onPointerCancel={(event) => endTouch(event, true)}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault();
          move(event.key === 'ArrowLeft' ? -1 : 1);
        } else if (event.key === ' ' && event.target === event.currentTarget) {
          event.preventDefault();
          setPlaying((value) => !value);
        }
      }}
    >
      <span id={instructionId} className="sr-only">Swipe or use left and right arrow keys to change shoots. Space pauses or resumes automatic switching.</span>
      <div className="earlier-shoots-stack__heading">
        <div className="earlier-shoots-stack__label">
          <h3 id={headingId}>{editor ? 'Earlier assignments' : 'Earlier, still open'} <span>{shoots.length}</span></h3>
          <span className="earlier-shoots-stack__helper">{helper}</span>
        </div>
        <div className="earlier-shoots-stack__controls" aria-label="Earlier shoot controls">
          <button type="button" className="earlier-shoots-stack__icon" disabled={shoots.length < 2}
            aria-label={playing ? 'Pause automatic switching' : 'Start automatic switching'}
            title={playing ? 'Pause automatic switching' : 'Start automatic switching'}
            aria-pressed={playing} onClick={() => setPlaying((value) => !value)}>
            {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
          </button>
          <div className="earlier-shoots-stack__dots" aria-label="Choose an earlier shoot">
            {shoots.slice(firstDot, firstDot + 5).map((shoot, windowIndex) => (
              <button type="button" key={shoot.id}
                className="earlier-shoots-stack__dot" aria-label={`Show ${shoot.addressLine}`}
                aria-pressed={index === firstDot + windowIndex} onClick={() => move(0, shoot.id)}>
                <span><i key={index === firstDot + windowIndex ? cycle : -1} /></span>
              </button>
            ))}
          </div>
          <span className="earlier-shoots-stack__position" aria-label={`${index + 1} of ${shoots.length}`}>{index + 1} / {shoots.length}</span>
          <button type="button" className="earlier-shoots-stack__icon" disabled={shoots.length < 2}
            aria-label="Previous unfinished shoot" onClick={() => move(-1)}><ArrowLeft aria-hidden="true" /></button>
          <button type="button" className="earlier-shoots-stack__icon" disabled={shoots.length < 2}
            aria-label="Next unfinished shoot" onClick={() => move(1)}><ArrowRight aria-hidden="true" /></button>
        </div>
      </div>
      <div className="earlier-shoots-stack__stage" aria-live="off">
        <div className="earlier-shoots-stack__back earlier-shoots-stack__back--far" aria-hidden="true" hidden={shoots.length < 3} />
        <div className="earlier-shoots-stack__back" aria-hidden="true" hidden={shoots.length < 2} />
        <article className="earlier-shoots-stack__card" aria-label={`${index + 1} of ${shoots.length}: ${active.addressLine}`}>
          <div className="earlier-shoots-stack__meta">
            <span className="earlier-shoots-stack__date" title={schedule || dateLabel}><strong>{age}</strong><span>· {schedule || dateLabel}</span></span>
            <span className={`earlier-shoots-stack__status earlier-shoots-stack__status--${status.tone}`} title={status.label}>{status.label}</span>
          </div>
          <div className="earlier-shoots-stack__body">
            <div className="earlier-shoots-stack__property"><h4 title={active.addressLine}>{active.addressLine}</h4><p title={person}>{person} <span>· #{active.id}</span></p></div>
            <button type="button" className={cn('earlier-shoots-stack__open', canReview && 'earlier-shoots-stack__open--review')}
              aria-label={`${canReview ? 'Review' : 'Open'} ${active.addressLine}`} onClick={() => onSelect(active)}>
              {canReview ? 'Review' : 'Open'}<ArrowRight aria-hidden="true" />
            </button>
          </div>
        </article>
      </div>
    </section>
  );
}

export function EarlierShootsStack(props: EarlierShootsStackProps) {
  if (!props.shoots.length || !isStaffShootStackRole(props.role)) return null;
  return <EarlierShootsCarousel {...props} />;
}
