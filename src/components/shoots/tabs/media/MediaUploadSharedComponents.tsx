import type React from 'react';

import {
  getQueueClassification,
  isVideoUpload,
  UPLOAD_CLASSIFICATION_OPTIONS,
  type QueueClassificationMap,
  type UploadQueueMediaType,
} from './mediaUploadUtils';

export function CircularProgress({ progress }: { progress: number }) {
  const safeProgress = Math.max(0, Math.min(100, progress));
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (safeProgress / 100) * circumference;

  return (
    <svg width="40" height="40" viewBox="0 0 40 40" className="shrink-0">
      <circle cx="20" cy="20" r={radius} stroke="currentColor" strokeWidth="3" className="text-muted/30" fill="none" />
      <circle
        cx="20"
        cy="20"
        r={radius}
        stroke="currentColor"
        strokeWidth="3"
        className="text-primary"
        fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        transform="rotate(-90 20 20)"
      />
      <text x="20" y="24" textAnchor="middle" className="fill-current text-[10px] font-semibold text-foreground">
        {safeProgress}%
      </text>
    </svg>
  );
}

export function SummaryCard({
  label,
  value,
  tone = 'default',
  className = '',
}: {
  label: string;
  value: React.ReactNode;
  tone?: 'default' | 'success' | 'info';
  className?: string;
}) {
  const toneClassName =
    tone === 'success'
      ? 'border-emerald-500/30 bg-emerald-500/10'
      : tone === 'info'
        ? 'border-primary/30 bg-primary/10'
        : 'border-border bg-card';

  return (
    <div className={`rounded-lg border p-3 ${toneClassName} ${className}`.trim()}>
      <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-foreground">{value}</div>
    </div>
  );
}

export function SummaryBadge({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1">
      <span className="text-[11px] font-medium text-foreground/90">{label}</span>
      <span className="text-sm font-semibold text-foreground">{value}</span>
    </div>
  );
}

export function UploadClassificationButtons({
  file,
  index,
  classifications,
  onToggle,
  compact = false,
  options = UPLOAD_CLASSIFICATION_OPTIONS,
}: {
  file: File;
  index: number;
  classifications: QueueClassificationMap;
  onToggle: (file: File, index: number, mediaType: UploadQueueMediaType) => void;
  compact?: boolean;
  /**
   * Which per-file controls to offer.
   *
   * Raw staging passes the Extra-only set. Service ownership is decided by the
   * group's booked-service selector, so per-file service shortcuts there both
   * duplicated that model and offered services the shoot had never booked.
   */
  options?: typeof UPLOAD_CLASSIFICATION_OPTIONS;
}) {
  const isVideo = isVideoUpload(file);
  const buttonClassName = compact ? 'rounded px-1.5 py-0.5 text-[9px]' : 'rounded px-2 py-1 text-[10px]';

  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      {options.map((option) => {
        const isActive = getQueueClassification(file, index, classifications) === option.type;
        const isDisabled = Boolean(isVideo && option.photoOnly);

        return (
          <button
            key={option.type}
            type="button"
            className={`${buttonClassName} font-semibold transition-colors ${
              isActive ? option.activeClassName : option.inactiveClassName
            } ${isDisabled ? 'cursor-not-allowed opacity-40' : ''}`}
            onClick={() => {
              if (isDisabled) return;
              onToggle(file, index, option.type);
            }}
            disabled={isDisabled}
            title={isDisabled ? `${option.title} is only available for photo uploads` : option.title}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}


