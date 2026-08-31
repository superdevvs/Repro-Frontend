import React from 'react';

interface OverflowRevealAddressTitleProps {
  compactAddress: string;
  fullAddress?: string | null;
}

const normalizeAddressForComparison = (value: string) =>
  value.replace(/\s+/g, ' ').replace(/\s*,\s*/g, ',').trim().toLocaleLowerCase();

export function OverflowRevealAddressTitle({
  compactAddress,
  fullAddress,
}: OverflowRevealAddressTitleProps) {
  const viewportRef = React.useRef<HTMLButtonElement>(null);
  const fullTextRef = React.useRef<HTMLSpanElement>(null);
  const [scrollDistance, setScrollDistance] = React.useState(0);
  const [isHovered, setIsHovered] = React.useState(false);
  const [isFocused, setIsFocused] = React.useState(false);
  const [isPinnedOpen, setIsPinnedOpen] = React.useState(false);
  const [suppressTransientReveal, setSuppressTransientReveal] = React.useState(false);

  const trimmedCompactAddress = compactAddress.trim() || 'Shoot Details';
  const resolvedFullAddress = fullAddress?.replace(/\s+/g, ' ').trim() || trimmedCompactAddress;
  const hasFullerAddress = normalizeAddressForComparison(resolvedFullAddress)
    !== normalizeAddressForComparison(trimmedCompactAddress);
  const compactPreview = hasFullerAddress
    ? `${trimmedCompactAddress.replace(/(?:\.\.\.|…)+$/, '')}…`
    : trimmedCompactAddress;

  const measureOverflow = React.useCallback(() => {
    const viewport = viewportRef.current;
    const fullText = fullTextRef.current;
    if (!viewport || !fullText) return;

    const nextDistance = Math.max(Math.ceil(fullText.scrollWidth - viewport.clientWidth), 0);
    setScrollDistance((currentDistance) => (
      currentDistance === nextDistance ? currentDistance : nextDistance
    ));
  }, []);

  React.useLayoutEffect(() => {
    measureOverflow();

    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(measureOverflow)
      : null;

    if (resizeObserver && viewportRef.current && fullTextRef.current) {
      resizeObserver.observe(viewportRef.current);
      resizeObserver.observe(fullTextRef.current);
    }

    window.addEventListener('resize', measureOverflow);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', measureOverflow);
    };
  }, [measureOverflow, resolvedFullAddress]);

  React.useEffect(() => {
    setIsPinnedOpen(false);
    setSuppressTransientReveal(false);
  }, [resolvedFullAddress]);

  const canReveal = hasFullerAddress || scrollDistance > 0;
  const isTransientRevealActive = !suppressTransientReveal && (isHovered || isFocused);
  const isRevealActive = canReveal && (isPinnedOpen || isTransientRevealActive);
  const revealDurationMs = Math.min(2400, Math.max(700, scrollDistance * 10));

  const togglePinnedReveal = () => {
    if (!canReveal) return;
    if (isPinnedOpen) {
      setIsPinnedOpen(false);
      setSuppressTransientReveal(true);
      return;
    }

    setSuppressTransientReveal(false);
    setIsPinnedOpen(true);
  };

  return (
    <h2 className="relative min-w-0 max-w-[24rem] flex-[0_1_auto] text-left text-base font-bold sm:text-lg">
      <button
        ref={viewportRef}
        type="button"
        disabled={!canReveal}
        className={`relative block w-full min-w-0 max-w-full appearance-none overflow-hidden rounded-sm border-0 bg-transparent p-0 text-left font-inherit text-inherit ${
          canReveal
            ? 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background'
            : 'cursor-default'
        }`}
        aria-label={resolvedFullAddress}
        aria-pressed={canReveal ? isPinnedOpen : undefined}
        title={resolvedFullAddress}
        data-testid="shoot-address-reveal"
        data-overflowing={scrollDistance > 0 ? 'true' : 'false'}
        onMouseEnter={() => {
          setSuppressTransientReveal(false);
          setIsHovered(true);
        }}
        onMouseLeave={() => {
          setIsHovered(false);
          if (!isFocused) setSuppressTransientReveal(false);
        }}
        onFocus={() => {
          setSuppressTransientReveal(false);
          setIsFocused(true);
        }}
        onBlur={() => {
          setIsFocused(false);
          if (!isHovered) setSuppressTransientReveal(false);
        }}
        onClick={togglePinnedReveal}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setIsPinnedOpen(false);
            setSuppressTransientReveal(true);
            event.currentTarget.blur();
          }
        }}
      >
        <span
          className={`block truncate transition-opacity duration-100 motion-reduce:opacity-100 motion-reduce:transition-none ${
            isRevealActive ? 'opacity-0' : 'opacity-100'
          }`}
          data-testid="shoot-address-preview"
        >
          {compactPreview}
        </span>
        <span
          ref={fullTextRef}
          aria-hidden="true"
          className={`pointer-events-none absolute left-0 top-0 block w-max max-w-none whitespace-nowrap transition-transform ease-in-out motion-reduce:!transform-none motion-reduce:opacity-0 motion-reduce:transition-none ${
            isRevealActive ? 'opacity-100 will-change-transform' : 'opacity-0'
          }`}
          style={{
            transform: isRevealActive ? `translateX(-${scrollDistance}px)` : 'translateX(0)',
            transitionDuration: `${revealDurationMs}ms`,
          }}
          data-testid="shoot-address-full"
        >
          {resolvedFullAddress}
        </span>
      </button>
      {isRevealActive ? (
        <span
          role="tooltip"
          className="pointer-events-none absolute left-0 top-full z-[100] mt-2 hidden max-w-[min(24rem,calc(100vw-2rem))] whitespace-normal rounded-md border border-border bg-popover px-3 py-2 text-sm font-medium leading-snug text-popover-foreground shadow-md motion-reduce:block"
        >
          {resolvedFullAddress}
        </span>
      ) : null}
    </h2>
  );
}
