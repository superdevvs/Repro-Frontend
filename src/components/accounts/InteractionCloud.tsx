import React, { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

export type InteractionCloudAccount = {
  id: string;
  name: string;
  company?: string;
  avatar?: string;
  totalShoots: number;
  deliveredShoots: number;
  deliveredImages: number;
  role?: string;
};

type InteractionCloudProps = {
  accounts: InteractionCloudAccount[];
  showCloud: boolean;
  onToggle: () => void;
  headline?: string;
  subline?: string;
  contextLabel?: string;
  metric?: 'bookings' | 'deliveries';
};

const accentPalette = [
  "from-[#5DE0E6]/80 via-[#3381FF]/70 to-[#004AAD]/70",
  "from-[#FFB347]/80 via-[#FF8E53]/70 to-[#FFCC33]/70",
  "from-[#FF6CAB]/80 via-[#AA5BFF]/70 to-[#7366FF]/70",
  "from-[#7EE8FA]/80 via-[#4AC29A]/70 to-[#80FF72]/70",
  "from-[#F4D03F]/80 via-[#F39C12]/70 to-[#16A085]/70",
  "from-[#F857A6]/80 via-[#FF6B6B]/70 to-[#FF5858]/70",
];

const getInitials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const formatPlural = (value: number, noun: string) =>
  `${value} ${noun}${value === 1 ? "" : "s"}`;

const MAX_RENDERED_ACCOUNTS = 14;
const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 360;
const clampValue = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function InteractionCloud({ accounts, showCloud, onToggle, headline, subline, contextLabel, metric = 'bookings' }: InteractionCloudProps) {
  if (!accounts.length) return null;

  const topAccount = accounts[0];
  const leastAccount = accounts[accounts.length - 1];
  const displayedAccounts = accounts.slice(0, MAX_RENDERED_ACCOUNTS);
  const getPrimaryValue = (account: InteractionCloudAccount) =>
    metric === 'deliveries' ? account.deliveredImages : account.totalShoots;
  const metricNoun = metric === 'deliveries' ? 'image' : 'booking';
  const metricSuffix = metric === 'deliveries' ? ' delivered' : '';
  const formatPrimaryValue = (value: number) =>
    metric === 'deliveries'
      ? `${formatPlural(value, 'image')} delivered`
      : formatPlural(value, 'booking');
  const maxPrimary = Math.max(
    ...accounts.map((account) => Math.max(getPrimaryValue(account), 1)),
    1,
  );

  const [activeAccountId, setActiveAccountId] = useState<string | undefined>(accounts[0]?.id);
  const [cardDismissed, setCardDismissed] = useState(false);

  useEffect(() => {
    if (!accounts.length) {
      setActiveAccountId(undefined);
      setCardDismissed(false);
      return;
    }
    setActiveAccountId((prev) => {
      if (!prev) {
        return cardDismissed ? undefined : accounts[0]?.id;
      }
      const exists = accounts.some((account) => account.id === prev);
      return exists ? prev : cardDismissed ? undefined : accounts[0]?.id;
    });
  }, [accounts, cardDismissed]);

  const activeAccount = useMemo(() => {
    if (!activeAccountId) return undefined;
    return accounts.find((account) => account.id === activeAccountId);
  }, [accounts, activeAccountId]);

  const circleLayout = useMemo(() => {
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    const padding = 12;

    const nodes = displayedAccounts.map((account, index) => {
      const isPrimary = index === 0;
      const baseSize = isPrimary ? 110 : 74;
      const primaryValue = Math.max(getPrimaryValue(account), 0);
      const dynamicBoost = Math.round((primaryValue / maxPrimary) * (isPrimary ? 55 : 28));
      const size = Math.min(baseSize + dynamicBoost, isPrimary ? 180 : 118);
      return {
        account,
        size,
        radius: size / 2,
      };
    });

    const placements: { x: number; y: number }[] = [];

    nodes.forEach((node, idx) => {
      if (idx === 0) {
        placements.push({ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 });
        return;
      }

      let placed = false;
      let attempts = 0;
      let angle = idx * goldenAngle;
      let distance = nodes[idx - 1]?.radius + node.radius + 40;

      while (!placed && attempts < 220) {
        const candidateX = CANVAS_WIDTH / 2 + Math.cos(angle) * distance;
        const candidateY = CANVAS_HEIGHT / 2 + Math.sin(angle) * distance;

        const x = clampValue(candidateX, node.radius + padding, CANVAS_WIDTH - node.radius - padding);
        const y = clampValue(candidateY, node.radius + padding, CANVAS_HEIGHT - node.radius - padding);

        const collides = placements.some((pos, compareIdx) => {
          const other = nodes[compareIdx];
          const dx = x - pos.x;
          const dy = y - pos.y;
          const distanceBetween = Math.hypot(dx, dy);
          const minDistance = other.radius + node.radius + padding;
          return distanceBetween < minDistance;
        });

        if (!collides) {
          placements.push({ x, y });
          placed = true;
        } else {
          distance += 14;
          angle += goldenAngle / 2;
          attempts += 1;
        }
      }

      if (!placed) {
        placements.push({
          x: clampValue(CANVAS_WIDTH / 2 + (idx % 4) * 36, node.radius + padding, CANVAS_WIDTH - node.radius - padding),
          y: clampValue(CANVAS_HEIGHT / 2 + Math.floor(idx / 4) * 36, node.radius + padding, CANVAS_HEIGHT - node.radius - padding),
        });
      }
    });

    return nodes.map((node, idx) => ({
      account: node.account,
      size: node.size,
      left: `${(placements[idx].x / CANVAS_WIDTH) * 100}%`,
      top: `${(placements[idx].y / CANVAS_HEIGHT) * 100}%`,
    }));
  }, [displayedAccounts, maxPrimary, metric]);

  const renderCircle = (node: { account: InteractionCloudAccount; size: number; left: string; top: string }, index: number) => {
    const { account, size, left, top } = node;
    const isPrimary = index === 0;
    const primaryValue = Math.max(getPrimaryValue(account), 0);
    const isActive = activeAccount?.id === account.id;

    const paletteClass = accentPalette[index % accentPalette.length];
    const initials = getInitials(account.name);
    const companyLabel = account.company ?? account.role;
    const metricUnit = metric === 'deliveries' ? 'images delivered' : 'bookings logged';
    const metricLine = primaryValue > 0
      ? `${primaryValue.toLocaleString()} ${metricUnit}`
      : `No ${metricUnit} yet`;
    const supportLine = metric === 'deliveries'
      ? (account.deliveredShoots > 0
        ? `${formatPlural(account.deliveredShoots, 'shoot')} completed`
        : 'Shoots still in progress')
      : (account.deliveredImages > 0
        ? `${formatPlural(account.deliveredImages, 'image')} delivered`
        : 'Deliveries pending');

    return (
      <button
        key={account.id}
        className={cn(
          "absolute flex flex-col items-center justify-center rounded-full border text-center text-white shadow-[0_18px_40px_rgba(3,7,18,0.45)] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent focus-visible:ring-white/80",
          isPrimary ? "bg-white/15 backdrop-blur-xl" : cn("bg-gradient-to-br", paletteClass, "backdrop-blur"),
          isActive ? "border-white/70 scale-105" : "border-white/15 hover:border-white/40"
        )}
        style={{
          width: size,
          height: size,
          left,
          top,
          transform: "translate(-50%, -50%)",
        }}
        type="button"
        title="Click to view client activity"
        onClick={() => {
          setCardDismissed(false);
          setActiveAccountId(account.id);
        }}
      >
        <span className="sr-only">Inspect {account.name}</span>
        <div className="relative flex h-full w-full flex-col items-center justify-center px-4 text-center">
          <div className="absolute -top-5 flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-white/40 bg-white/15 text-[11px] font-semibold uppercase tracking-[0.2em] text-white shadow-[0_4px_12px_rgba(2,6,23,0.55)]">
            {account.avatar ? (
              <span
                className="h-full w-full"
                style={{ backgroundImage: `url(${account.avatar})`, backgroundSize: "cover", backgroundPosition: "center" }}
              />
            ) : (
              initials
            )}
          </div>

          <div className="flex flex-col items-center justify-center pt-4 text-white drop-shadow-[0_6px_22px_rgba(2,6,23,0.45)]">
            <p className={cn("text-sm font-semibold leading-tight text-balance line-clamp-2", isPrimary && "text-base")}>{account.name}</p>
            {companyLabel && (
              <p className="text-[11px] text-white/75 text-center text-balance line-clamp-1 max-w-[90%]">{companyLabel}</p>
            )}
          </div>
        </div>
        <div className="mt-3 text-center">
          <p className="text-[11px] font-medium text-white/90 text-balance line-clamp-2">
            {metricLine}
          </p>
          <p className="text-[11px] text-white/70 text-balance line-clamp-2">
            {supportLine}
          </p>
        </div>
      </button>
    );
  };

  const topPrimaryValue = Math.max(getPrimaryValue(topAccount), 0);
  const leastPrimaryValue = Math.max(getPrimaryValue(leastAccount), 0);
  const momentumPercent = Math.round((topPrimaryValue / (maxPrimary || 1)) * 100);

  const activeAccountRole = activeAccount?.role ?? 'client';
  const insightTitleMap: Record<string, string> = {
    client: 'Client insights',
    photographer: 'Photographer insights',
    editor: 'Editing insights',
    salesRep: 'Sales insights',
  };

  const insightTagSets: Record<string, { category: string; value: string }[]> = {
    client: [
      { category: 'Style', value: 'Warm tones' },
      { category: 'Style', value: 'Luxury detail' },
      { category: 'Preference', value: 'Twilight shoots' },
    ],
    photographer: [
      { category: 'Rhythm', value: 'Fast turnaround' },
      { category: 'Quality', value: 'Top-rated' },
      { category: 'Coverage', value: 'Full-market' },
    ],
    editor: [
      { category: 'Focus', value: 'HDR finesse' },
      { category: 'Role', value: 'Color lead' },
      { category: 'Pace', value: 'Quick QA cycles' },
    ],
    salesRep: [
      { category: 'Motion', value: 'Follow-up ready' },
      { category: 'Opportunity', value: 'Upsell targets' },
      { category: 'Care', value: 'Nurture touchpoints' },
    ],
  };

  const insightTags = insightTagSets[activeAccountRole] || insightTagSets.client;
  const infoCardTitle = insightTitleMap[activeAccountRole] || 'Team insights';
  const contextCopy = contextLabel ?? 'Insights · This month (MTD)';
  const contextTooltip = 'Data updates in real time as shoots progress.';

  return (
    <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-[#020617] via-[#08152b] to-[#0b1f47] text-white shadow-2xl">
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className="absolute left-[-15%] top-[-35%] h-64 w-64 rounded-full bg-[#4978f6]/25 blur-[110px]" />
        <div className="absolute bottom-[-25%] right-[-5%] h-72 w-72 rounded-full bg-[#5de0e6]/35 blur-[130px]" />
        <div className="absolute inset-x-10 top-1/2 hidden h-px bg-gradient-to-r from-transparent via-white/25 to-transparent lg:block" />
      </div>

      <div className="relative px-6 py-6 md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-white/80" title={contextTooltip}>
              <p className="text-xs font-semibold tracking-[0.35em] uppercase">Insights</p>
              <span className="rounded-full border border-white/20 px-3 py-1 text-[11px] font-medium text-white">
                {contextCopy}
              </span>
            </div>
            <h2 className="mt-2 text-xl font-semibold leading-tight md:text-2xl">{headline ?? "Momentum cloud"}</h2>
            {subline && (
              <p className="mt-1 max-w-2xl text-sm text-white/75">
                {subline}
              </p>
            )}
          </div>

          <button
            aria-pressed={showCloud}
            aria-label="Toggle interaction cloud"
            aria-controls="interaction-cloud-constellation"
            onClick={onToggle}
            className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.35em] text-white/70 transition hover:border-white/40 hover:text-white"
          >
            {showCloud ? (
              <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span>{showCloud ? "Hide" : "Show"}</span>
          </button>
        </div>

        {showCloud ? (
          <>
            <div className="mt-8 space-y-6">
              <div className="relative">
                <div
                  id="interaction-cloud-constellation"
                  className="relative h-[320px] w-full overflow-hidden rounded-[40px] border border-white/10 bg-[#050b1a] bg-gradient-to-br from-white/10 to-white/0 px-2 py-2 sm:px-4 sm:py-4 lg:h-[360px]"
                >
                  <div className="pointer-events-none absolute inset-6 rounded-[34px] border border-white/5" />
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.15),_transparent_65%)]" />
                  {circleLayout.map((node, index) => renderCircle(node, index))}
                </div>

                {activeAccount && (
                  <article className="pointer-events-auto mt-4 rounded-[28px] border border-white/15 bg-[#0b1227]/95 p-5 text-left text-white shadow-[0_30px_70px_rgba(3,7,18,0.65)] backdrop-blur-xl lg:absolute lg:right-8 lg:top-1/2 lg:mt-0 lg:w-[360px] lg:-translate-y-1/2">
                    <header className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.35em] text-white/60">{infoCardTitle}</p>
                        <h3 className="mt-1 text-2xl font-semibold leading-tight">{activeAccount.name}</h3>
                        {activeAccount.company && (
                          <p className="text-sm text-white/70">{activeAccount.company}</p>
                        )}
                        <p className="mt-2 text-xs text-white/70">Month-to-date performance snapshot</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setCardDismissed(true);
                          setActiveAccountId(undefined);
                        }}
                        aria-label="Close insight card"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/20 text-lg text-white/80 transition hover:border-white/40 hover:text-white"
                      >
                        ×
                      </button>
                    </header>

                    <div className="mt-5 flex flex-wrap gap-2">
                      {insightTags.map((tag) => (
                        <span key={`${tag.category}-${tag.value}`} className="rounded-full border border-white/20 px-3 py-1 text-[11px] text-white/85">
                          <span className="text-white/60">{tag.category}:</span> {tag.value}
                        </span>
                      ))}
                    </div>

                    <div className="mt-4 space-y-1 text-sm text-white/85">
                      <p className="font-semibold">
                        {metric === 'deliveries'
                          ? (activeAccount.deliveredImages
                            ? `${activeAccount.deliveredImages.toLocaleString()} images delivered`
                            : 'No deliveries this month')
                          : (activeAccount.totalShoots
                            ? `${activeAccount.totalShoots.toLocaleString()} bookings logged`
                            : 'No bookings logged yet')}
                      </p>
                      <p className="text-white/70">
                        {metric === 'deliveries'
                          ? (activeAccount.deliveredShoots
                            ? `${formatPlural(activeAccount.deliveredShoots, 'shoot')} completed`
                            : 'Shoots scheduled but not completed')
                          : (activeAccount.deliveredImages
                            ? `${formatPlural(activeAccount.deliveredImages, 'image')} already delivered`
                            : 'Deliveries pending')}
                      </p>
                    </div>

                    <div className="mt-5 space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-[11px] uppercase tracking-[0.3em] text-white/60">Delivery history (MTD)</p>
                      <div className="space-y-2 text-sm text-white/85">
                        <div className="flex items-center justify-between">
                          <span>Total shoots</span>
                          <strong className="font-semibold">{activeAccount.totalShoots}</strong>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Completed</span>
                          <strong className="font-semibold">{activeAccount.deliveredShoots}</strong>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Images delivered</span>
                          <strong className="font-semibold">{activeAccount.deliveredImages}</strong>
                        </div>
                      </div>
                    </div>
                  </article>
                )}
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-white/12 bg-white/5 p-4">
                  <p className="text-[10px] uppercase tracking-[0.35em] text-white/60">Top account</p>
                  <h3 className="mt-1 text-lg font-semibold">{topAccount.name}</h3>
                  <p className="text-sm text-white/75">
                    {topAccount.totalShoots ? `${formatPlural(topAccount.totalShoots, 'booking')} · ` : ''}
                    {topAccount.deliveredImages ? `${formatPlural(topAccount.deliveredImages, 'image')} delivered` : 'No deliveries yet'}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/12 bg-white/5 p-4">
                  <p className="text-[10px] uppercase tracking-[0.35em] text-white/60">Quiet watch</p>
                  <h3 className="mt-1 text-lg font-semibold">{leastAccount.name}</h3>
                  <p className="text-sm text-white/70">
                    {leastPrimaryValue
                      ? formatPrimaryValue(leastPrimaryValue)
                      : metric === 'deliveries'
                        ? 'Awaiting first delivery'
                        : 'No activity this month'}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/12 bg-white/5 p-4">
                  <p className="text-[10px] uppercase tracking-[0.35em] text-white/60">Momentum</p>
                  <h3 className="mt-1 text-3xl font-semibold">{momentumPercent}%</h3>
                  <p className="text-sm text-white/70">
                    Share of this month’s {metricNoun}{metricSuffix} attributed to {topAccount.name}
                  </p>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="mt-8 flex flex-col gap-3 rounded-2xl border border-white/12 bg-white/5 p-5 text-sm text-white/70 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-white/60">Cloud paused</p>
              <p className="mt-1 text-white">Tap the preview to bring the constellation back whenever you need a quick momentum read.</p>
              <p className="text-sm text-white/70">Clients will appear once shoots are completed.</p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-white/80">
              <span className="rounded-full border border-white/20 px-3 py-1">Top: {topAccount.name}</span>
              <span className="rounded-full border border-white/20 px-3 py-1">Quiet: {leastAccount.name}</span>
              <span className="rounded-full border border-white/20 px-3 py-1">Volume: {momentumPercent}%</span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
