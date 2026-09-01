import React, { useEffect, useState } from 'react';
import {
  ChevronDown,
  Edit,
  ExternalLink,
  LayoutTemplate,
  Loader2,
  Plus,
  Settings2,
  Trash2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

export type TourEmbed = {
  id: string;
  title: string;
  branded: string;
  mls: string;
};

export type TourEmbedForm = Omit<TourEmbed, 'id'>;

export type TourDisplaySettings = {
  header_position: string;
  tour_version: string;
  realtor_info: string;
  realtor_client_id: string;
  autoplay: boolean;
  show_garage: boolean;
};

type ShootTourSettingsSectionProps = {
  open: boolean;
  onOpenChange: () => void;
  tourStyle: string;
  setTourStyle: (value: string) => void;
  saveTourStyle: (value: string) => void | Promise<void>;
  isSavingTourStyle: boolean;
  embeds: TourEmbed[];
  embedForm: TourEmbedForm;
  setEmbedForm: React.Dispatch<React.SetStateAction<TourEmbedForm>>;
  editingEmbedId: string | null;
  featuredEmbedId: string;
  setFeaturedEmbedId: (value: string) => void;
  savingEmbeds: boolean;
  handleSaveEmbed: () => void | Promise<void>;
  handleEditEmbed: (embed: TourEmbed) => void;
  handleDeleteEmbed: (embedId: string) => void | Promise<void>;
  persistEmbeds: (embeds: TourEmbed[], featuredEmbedId: string) => void | Promise<void>;
  isEmbedHtml: (value: string) => boolean;
  tourSettings: TourDisplaySettings;
  updateTourSetting: <K extends keyof TourDisplaySettings>(
    key: K,
    value: TourDisplaySettings[K],
  ) => void | Promise<void>;
  isSavingTourSettings: boolean;
  realtorPicker: React.ReactNode;
  isAdmin: boolean;
};

const settingLabelClassName = 'text-[11px] font-medium';
const selectTriggerClassName = 'h-8 text-xs';

const titleCase = (value: string) => value
  .split('_')
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join(' ');

export function ShootTourSettingsSection({
  open,
  onOpenChange,
  tourStyle,
  setTourStyle,
  saveTourStyle,
  isSavingTourStyle,
  embeds,
  embedForm,
  setEmbedForm,
  editingEmbedId,
  featuredEmbedId,
  setFeaturedEmbedId,
  savingEmbeds,
  handleSaveEmbed,
  handleEditEmbed,
  handleDeleteEmbed,
  persistEmbeds,
  isEmbedHtml,
  tourSettings,
  updateTourSetting,
  isSavingTourSettings,
  realtorPicker,
  isAdmin,
}: ShootTourSettingsSectionProps) {
  const [embedsOpen, setEmbedsOpen] = useState(Boolean(editingEmbedId));

  useEffect(() => {
    if (editingEmbedId) setEmbedsOpen(true);
  }, [editingEmbedId]);

  const featuredEmbed = embeds.find((embed) => embed.id === featuredEmbedId);
  const settingsSummary = [
    titleCase(tourStyle || 'default'),
    `${titleCase(tourSettings.header_position || 'center')} header`,
    titleCase(tourSettings.tour_version || 'standard'),
  ].join(' · ');
  const embedsSummary = embeds.length
    ? `${embeds.length} embed${embeds.length === 1 ? '' : 's'}${featuredEmbed ? ` · Featured: ${featuredEmbed.title}` : ''}`
    : 'No embeds added';
  const isSaving = isSavingTourStyle || isSavingTourSettings || savingEmbeds;

  return (
    <section
      className="overflow-hidden rounded-lg border bg-card"
      aria-labelledby="tour-settings-title"
      data-testid="tour-settings-section"
    >
      <Collapsible open={open} onOpenChange={onOpenChange}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex min-h-[58px] w-full items-center gap-2.5 px-3 py-2 text-left outline-none transition-colors hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            aria-controls="tour-settings-panel"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <Settings2 className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span id="tour-settings-title" className="block truncate text-sm font-semibold">Tour Settings</span>
              <span className="block truncate text-[11px] text-muted-foreground">{settingsSummary}</span>
            </span>
            {isSaving && (
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" aria-label="Saving tour settings" />
            )}
            <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent id="tour-settings-panel">
          <div className="space-y-3 border-t bg-muted/10 p-3">
            <div className="grid gap-2.5 sm:grid-cols-3">
              <div className="space-y-1">
                <Label className={settingLabelClassName}>Tour style</Label>
                <Select
                  value={tourStyle}
                  onValueChange={(value) => {
                    setTourStyle(value);
                    void saveTourStyle(value);
                  }}
                  disabled={!isAdmin || isSavingTourStyle}
                >
                  <SelectTrigger className={selectTriggerClassName} aria-label="Tour style">
                    <SelectValue placeholder="Select style" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Default</SelectItem>
                    <SelectItem value="neo">Neo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className={settingLabelClassName}>Header position</Label>
                <Select
                  value={tourSettings.header_position}
                  onValueChange={(value) => void updateTourSetting('header_position', value)}
                  disabled={!isAdmin || isSavingTourSettings}
                >
                  <SelectTrigger className={selectTriggerClassName} aria-label="Header position">
                    <SelectValue placeholder="Select position" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="left">Left</SelectItem>
                    <SelectItem value="center">Center</SelectItem>
                    <SelectItem value="right">Right</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className={settingLabelClassName}>Tour version</Label>
                <Select
                  value={tourSettings.tour_version}
                  onValueChange={(value) => void updateTourSetting('tour_version', value)}
                  disabled={!isAdmin || isSavingTourSettings}
                >
                  <SelectTrigger className={selectTriggerClassName} aria-label="Tour version">
                    <SelectValue placeholder="Select version" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                    <SelectItem value="legacy">Legacy</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2">
              <div className="min-w-0">{realtorPicker}</div>
              <div className="overflow-hidden rounded-md border bg-background/60">
                <div className="flex min-h-10 items-center justify-between gap-3 px-3 py-1.5">
                  <div className="min-w-0">
                    <Label className="block truncate text-[11px]">Autoplay</Label>
                    <p className="truncate text-[10px] text-muted-foreground">Start videos muted</p>
                  </div>
                  <Switch
                    checked={tourSettings.autoplay}
                    onCheckedChange={(checked) => void updateTourSetting('autoplay', checked)}
                    disabled={!isAdmin || isSavingTourSettings}
                    className="scale-75"
                    aria-label="Autoplay tour videos"
                  />
                </div>
                <div className="flex min-h-10 items-center justify-between gap-3 border-t px-3 py-1.5">
                  <div className="min-w-0">
                    <Label className="block truncate text-[11px]">Garage info</Label>
                    <p className="truncate text-[10px] text-muted-foreground">Show on public tours</p>
                  </div>
                  <Switch
                    checked={tourSettings.show_garage}
                    onCheckedChange={(checked) => void updateTourSetting('show_garage', checked)}
                    disabled={!isAdmin || isSavingTourSettings}
                    className="scale-75"
                    aria-label="Show garage information"
                  />
                </div>
              </div>
            </div>

            <Collapsible open={embedsOpen} onOpenChange={setEmbedsOpen}>
              <div className="overflow-hidden rounded-md border bg-background/60">
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex min-h-12 w-full items-center gap-2.5 px-3 py-2 text-left outline-none transition-colors hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    aria-controls="tour-embeds-panel"
                  >
                    <LayoutTemplate className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium">Embeds</span>
                      <span className="block truncate text-[10px] text-muted-foreground">{embedsSummary}</span>
                    </span>
                    {savingEmbeds && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                    <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${embedsOpen ? 'rotate-180' : ''}`} />
                  </button>
                </CollapsibleTrigger>

                <CollapsibleContent id="tour-embeds-panel">
                  <div className="space-y-2.5 border-t bg-muted/10 p-3">
                    <div className="grid gap-2 sm:grid-cols-3">
                      <Input
                        value={embedForm.title}
                        onChange={(event) => setEmbedForm((previous) => ({ ...previous, title: event.target.value }))}
                        placeholder="Title"
                        className="h-8 text-xs"
                        disabled={!isAdmin}
                        aria-label="Embed title"
                      />
                      <Input
                        value={embedForm.branded}
                        onChange={(event) => setEmbedForm((previous) => ({ ...previous, branded: event.target.value }))}
                        placeholder="Branded link or HTML"
                        className="h-8 text-xs"
                        disabled={!isAdmin}
                        aria-label="Branded embed"
                      />
                      <Input
                        value={embedForm.mls}
                        onChange={(event) => setEmbedForm((previous) => ({ ...previous, mls: event.target.value }))}
                        placeholder="MLS link or HTML"
                        className="h-8 text-xs"
                        disabled={!isAdmin}
                        aria-label="MLS embed"
                      />
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                      <div className="min-w-0 flex-1 space-y-1">
                        <Label className={settingLabelClassName}>Featured embed</Label>
                        <Select
                          value={featuredEmbedId || 'none'}
                          onValueChange={(value) => {
                            const nextValue = value === 'none' ? '' : value;
                            setFeaturedEmbedId(nextValue);
                            if (isAdmin) void persistEmbeds(embeds, nextValue);
                          }}
                          disabled={!isAdmin || savingEmbeds}
                        >
                          <SelectTrigger className={selectTriggerClassName} aria-label="Featured embed">
                            <SelectValue placeholder="Select featured embed" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            {embeds.map((embed) => (
                              <SelectItem key={embed.id} value={embed.id}>{embed.title}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {isAdmin && (
                        <Button
                          size="sm"
                          onClick={() => void handleSaveEmbed()}
                          disabled={savingEmbeds}
                          className="h-8 shrink-0 px-3 text-xs"
                        >
                          {savingEmbeds ? (
                            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Plus className="mr-1 h-3.5 w-3.5" />
                          )}
                          {editingEmbedId ? 'Update embed' : 'Add embed'}
                        </Button>
                      )}
                    </div>

                    {embeds.length > 0 ? (
                      <div className="divide-y overflow-hidden rounded-md border bg-background">
                        {embeds.map((embed) => {
                          const channels = [embed.branded ? 'Branded' : '', embed.mls ? 'MLS' : '']
                            .filter(Boolean)
                            .join(' · ');
                          const previewUrl = !isEmbedHtml(embed.branded)
                            ? embed.branded
                            : (!isEmbedHtml(embed.mls) ? embed.mls : '');

                          return (
                            <div key={embed.id} className="flex min-h-11 items-center gap-2 px-2.5 py-1.5">
                              <div className="min-w-0 flex-1">
                                <div className="flex min-w-0 items-center gap-1.5">
                                  <span className="truncate text-xs font-medium">{embed.title}</span>
                                  {featuredEmbedId === embed.id && (
                                    <Badge variant="outline" className="h-5 shrink-0 px-1.5 text-[9px]">Featured</Badge>
                                  )}
                                </div>
                                <p className="truncate text-[10px] text-muted-foreground">{channels || 'No content set'}</p>
                              </div>
                              {previewUrl && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => window.open(previewUrl, '_blank', 'noopener,noreferrer')}
                                  aria-label={`Open ${embed.title}`}
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              {isAdmin && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => handleEditEmbed(embed)}
                                  aria-label={`Edit ${embed.title}`}
                                >
                                  <Edit className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              {isAdmin && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                  onClick={() => void handleDeleteEmbed(embed.id)}
                                  aria-label={`Delete ${embed.title}`}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-[10px] text-muted-foreground">
                        Add a URL or HTML snippet when this tour needs an embedded widget.
                      </p>
                    )}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}
