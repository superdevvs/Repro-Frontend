import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BarChart3, Copy, ExternalLink, Share2, QrCode, ChevronDown, ChevronUp, Download, Edit, Trash, Check, X, Plus, Info, Lock } from 'lucide-react';
export function ShootDetailsTourTabView(props: any) {
  const {
    isClientReleaseLocked,
    onShowAnalytics,
    getTourUrl,
    copyLink,
    openLink,
    shareLink,
    getQrCode,
    showVideoLinksSection,
    showVideoEmbedSection,
    showTourSettings,
    show3dTours,
    showMatterportSection,
    showIguideSection,
    showZillowSection,
    publicVideoLinkConfigs,
    editingVideoLinkKey,
    videoLinkValue,
    setVideoLinkValue,
    isSavingVideoLinkKey,
    isDeletingVideoLinkKey,
    startEditVideoLink,
    cancelEditVideoLink,
    saveVideoLink,
    deleteVideoLink,
    tourLinks,
    isAdmin,
    openSections,
    toggleSection,
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
    propertySection,
    visibleMatterportKeys,
    visibleIguideKeys,
    editing3DKey,
    editing3DValue,
    setEditing3DValue,
    isSaving3D,
    isDeleting3D,
    startEdit3D,
    cancelEdit3D,
    save3DTour,
    confirmDelete3D,
    renderLinkActionButtons,
    iguideSync,
    qrCodeDialog,
    onQrDialogOpenChange,
    onQrImageError,
    onCopyQrDialogLink,
    downloadQrCode,
  } = props;

  if (isClientReleaseLocked) {
    return (
      <div className="space-y-6 w-full">
        <Card className="border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-950/60">
          <CardHeader>
            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
              <Lock className="h-4 w-4" />
              <CardTitle className="text-base">Tours Locked</CardTitle>
            </div>
            <CardDescription>
              Full payment is required before branded, MLS, and generic tour links become active.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-xl border border-dashed border-slate-300 bg-white/70 p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
              Tour links, QR codes, sharing actions, and public tour access unlock automatically after the shoot is fully paid.
            </div>
            <Badge variant="secondary" className="bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              Payment required to unlock tours
            </Badge>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      {/* Tour Links Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Tour Links</CardTitle>
              <CardDescription>Manage and share tour links for this shoot</CardDescription>
            </div>
            {onShowAnalytics && (
              <Button
                variant="outline"
                size="sm"
                onClick={onShowAnalytics}
                className="h-8 text-xs gap-1.5"
              >
                <BarChart3 className="h-3.5 w-3.5" />
                Analytics
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Branded Tour Link */}
          <div className="space-y-2">
            <Label>Branded Tour Link</Label>
            <div className="flex items-center gap-2">
              <Input
                value={getTourUrl('branded')}
                readOnly
                className="flex-1"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyLink('branded')}
                title="Copy link"
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openLink('branded')}
                title="Open in new tab"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => shareLink('branded')}
                title="Share link"
              >
                <Share2 className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => getQrCode('branded')}
                title="Get QR code"
              >
                <QrCode className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {/* MLS-Compliant Link */}
          <div className="space-y-2">
            <Label>MLS-Compliant Link</Label>
            <div className="flex items-center gap-2">
              <Input
                value={getTourUrl('mls')}
                readOnly
                className="flex-1"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyLink('mls')}
                title="Copy link"
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openLink('mls')}
                title="Open in new tab"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => shareLink('mls')}
                title="Share link"
              >
                <Share2 className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => getQrCode('mls')}
                title="Get QR code"
              >
                <QrCode className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {/* Generic MLS Link */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Label>Generic MLS Link</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground">
                    <Info className="h-3.5 w-3.5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-96 max-h-80 overflow-y-auto text-sm" side="top" align="start">
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm">Generic MLS Link Guidelines</h4>
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      A stripped-down tour that may include video, images, and music. Ideally no text, but limited strictly-controlled text is acceptable. No property address or marketing information for a competitor.
                    </p>
                    <ul className="list-disc pl-4 text-xs text-muted-foreground space-y-1.5 leading-relaxed">
                      <li>The URL must have the Tour ID at the end (e.g., <code className="text-[10px] bg-muted px-1 rounded">http://yourvirtualtoururl.com/ID?=TOURID#</code>) so it is distinguishable from a branded tour before the tour ID.</li>
                      <li>No address information on the link or anywhere on the tour.</li>
                      <li>Tours must come directly from your company — no third parties like YouTube, Metacafe, etc.</li>
                      <li>No email forms or emailing options on the tour.</li>
                      <li>Text entered by the agent must be monitored — no address/contact info allowed. If found, the tour company will be removed from the approved vendor list.</li>
                      <li>No agents/people in the tour.</li>
                      <li>No links to third-party sites (social media, etc.) on the tour.</li>
                    </ul>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex items-center gap-2">
              <Input
                value={getTourUrl('genericMls')}
                readOnly
                className="flex-1"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyLink('genericMls')}
                title="Copy link"
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openLink('genericMls')}
                title="Open in new tab"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => shareLink('genericMls')}
                title="Share link"
              >
                <Share2 className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => getQrCode('genericMls')}
                title="Get QR code"
              >
                <QrCode className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      {(showVideoLinksSection || showVideoEmbedSection) && (
        <Card>
          <CardHeader>
            <CardTitle>Video Links</CardTitle>
            <CardDescription>Manage public video pages and embedded tour video.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {showVideoLinksSection && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>Public Video Pages</Label>
                </div>
                {publicVideoLinkConfigs.map(({ key, label, placeholder }) => {
                  const isEditing = editingVideoLinkKey === key;
                  const url = getTourUrl(key);
                  return (
                    <div key={key} className="space-y-2">
                      <Label>{label}</Label>
                      {!isEditing ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={url}
                            readOnly
                            placeholder={placeholder}
                            className="flex-1"
                          />
                          <Button variant="outline" size="sm" onClick={() => copyLink(key)} title="Copy link" disabled={!url}>
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => openLink(key)} title="Open in new tab" disabled={!url}>
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => shareLink(key)} title="Share link" disabled={!url}>
                            <Share2 className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => getQrCode(key)} title="Get QR code" disabled={!url}>
                            <QrCode className="h-4 w-4" />
                          </Button>
                          {isAdmin && (
                            <Button variant="outline" size="sm" onClick={() => startEditVideoLink(key)} title={`Edit ${label}`}>
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          {isAdmin && tourLinks[key] && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => void deleteVideoLink(key)}
                              disabled={isDeletingVideoLinkKey === key}
                              title={`Remove ${label}`}
                            >
                              <Trash className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Input
                            value={videoLinkValue}
                            onChange={(e) => setVideoLinkValue(e.target.value)}
                            placeholder="https://www.youtube.com/watch?v=... or https://vimeo.com/..."
                            className="flex-1"
                          />
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={cancelEditVideoLink}>
                              <X className="h-3.5 w-3.5 mr-1" />
                              Cancel
                            </Button>
                            <Button variant="default" size="sm" onClick={saveVideoLink} disabled={isSavingVideoLinkKey === key}>
                              {isSavingVideoLinkKey === key ? 'Saving...' : <><Check className="h-3.5 w-3.5 mr-1" />Save</>}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {showVideoEmbedSection && (
              <div className="space-y-2">
                {showVideoLinksSection && <Separator />}
                <Label>Video Embed</Label>
                <p className="text-xs text-muted-foreground">
                  Used for embedding video directly inside tour pages. Supports YouTube, Vimeo, or direct video links.
                </p>
                {editingVideoLinkKey !== 'video_link' ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={tourLinks.video_link || ''}
                      readOnly
                      placeholder="No video embed set"
                      className="flex-1"
                    />
                    <Button variant="outline" size="sm" onClick={() => copyLink('video_link')} title="Copy embed link" disabled={!tourLinks.video_link}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openLink('video_link')} title="Open embed link" disabled={!tourLinks.video_link}>
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => startEditVideoLink('video_link')} title="Edit video embed">
                      <Edit className="h-4 w-4" />
                    </Button>
                    {tourLinks.video_link && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => void deleteVideoLink('video_link')}
                        disabled={isDeletingVideoLinkKey === 'video_link'}
                        title="Remove video embed"
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Input
                      value={videoLinkValue}
                      onChange={(e) => setVideoLinkValue(e.target.value)}
                      placeholder="https://www.youtube.com/watch?v=... or https://vimeo.com/..."
                      className="flex-1"
                    />
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={cancelEditVideoLink}>
                        <X className="h-3.5 w-3.5 mr-1" />
                        Cancel
                      </Button>
                      <Button variant="default" size="sm" onClick={saveVideoLink} disabled={isSavingVideoLinkKey === 'video_link'}>
                        {isSavingVideoLinkKey === 'video_link' ? 'Saving...' : <><Check className="h-3.5 w-3.5 mr-1" />Save</>}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
      {/* Tour Settings Section */}
      {showTourSettings && (
        <Card>
          <Collapsible
            open={openSections.settings}
            onOpenChange={() => toggleSection('settings')}
          >
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Tour Settings</CardTitle>
                    <CardDescription>Configure tour display and behavior</CardDescription>
                  </div>
                  {openSections.settings ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Tour Style</Label>
                <Select 
                  value={tourStyle} 
                  onValueChange={async (value) => {
                    // Optimistically update UI
                    setTourStyle(value);
                    // Save to backend
                    await saveTourStyle(value);
                  }}
                  disabled={isSavingTourStyle}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select tour style" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Default</SelectItem>
                    <SelectItem value="neo">Neo</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Choose the visual style for tour links. Changes will apply to new tour page loads.
                </p>
                {isSavingTourStyle && (
                  <p className="text-xs text-blue-500">Saving...</p>
                )}
              </div>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Embed(s)</Label>
                  {savingEmbeds && <span className="text-xs text-blue-500">Saving...</span>}
                </div>
                <p className="text-xs text-muted-foreground">
                  Add HTML embed snippets or direct URLs (iGUIDE, forms, widgets, etc.). Add as many as you need.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <Input
                    value={embedForm.title}
                    onChange={(e) => setEmbedForm((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="Title"
                    className="h-9 text-xs"
                    disabled={!isAdmin}
                  />
                  <Input
                    value={embedForm.branded}
                    onChange={(e) => setEmbedForm((prev) => ({ ...prev, branded: e.target.value }))}
                    placeholder="Branded Embed Link or HTML"
                    className="h-9 text-xs"
                    disabled={!isAdmin}
                  />
                  <Input
                    value={embedForm.mls}
                    onChange={(e) => setEmbedForm((prev) => ({ ...prev, mls: e.target.value }))}
                    placeholder="MLS Embed Link or HTML"
                    className="h-9 text-xs"
                    disabled={!isAdmin}
                  />
                </div>
                {isAdmin && (
                  <div className="flex justify-end">
                    <Button size="sm" onClick={handleSaveEmbed} disabled={savingEmbeds}>
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      {editingEmbedId ? 'Update Embed' : 'Add Embed'}
                    </Button>
                  </div>
                )}
                {embeds.length > 0 ? (
                  <div className="space-y-2">
                    {embeds.map((embed) => {
                      const hasBranded = Boolean(embed.branded);
                      const hasMls = Boolean(embed.mls);
                      const previewUrl = !isEmbedHtml(embed.branded)
                        ? embed.branded
                        : (!isEmbedHtml(embed.mls) ? embed.mls : '');
                      return (
                        <div key={embed.id} className="border rounded-lg p-3 flex flex-col gap-2">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <div className="text-sm font-medium flex items-center gap-2">
                                {embed.title}
                                {featuredEmbedId === embed.id && (
                                  <Badge variant="outline" className="text-[10px]">Featured</Badge>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {hasBranded && 'Branded'}{hasBranded && hasMls ? ' • ' : ''}{hasMls && 'MLS'}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {previewUrl && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => window.open(previewUrl, '_blank')}
                                  title="Open embed"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              {isAdmin && (
                                <Button variant="ghost" size="sm" onClick={() => handleEditEmbed(embed)}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                              )}
                              {isAdmin && (
                                <Button variant="destructive" size="sm" onClick={() => handleDeleteEmbed(embed.id)}>
                                  <Trash className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No embeds added yet.</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Feature Embed</Label>
                <Select
                  value={featuredEmbedId || 'none'}
                  onValueChange={async (value) => {
                    const nextValue = value === 'none' ? '' : value;
                    setFeaturedEmbedId(nextValue);
                    if (isAdmin) {
                      await persistEmbeds(embeds, nextValue);
                    }
                  }}
                  disabled={!isAdmin || savingEmbeds}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select featured embed" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {embeds.map((embed) => (
                      <SelectItem key={embed.id} value={embed.id}>
                        {embed.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Featured embed can be highlighted at the top of tour pages.</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Header Position</Label>
                  {isSavingTourSettings && <span className="text-xs text-blue-500">Saving...</span>}
                </div>
                <Select
                  value={tourSettings.header_position}
                  onValueChange={async (value) => updateTourSetting('header_position', value)}
                  disabled={!isAdmin || isSavingTourSettings}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select header position" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="left">Left</SelectItem>
                    <SelectItem value="center">Center</SelectItem>
                    <SelectItem value="right">Right</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Controls where the headline sits on the hero banner.</p>
              </div>
              <div className="space-y-2">
                <Label>Tour Version</Label>
                <Select
                  value={tourSettings.tour_version}
                  onValueChange={async (value) => updateTourSetting('tour_version', value)}
                  disabled={!isAdmin || isSavingTourSettings}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select version" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                    <SelectItem value="legacy">Legacy</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Use this label to distinguish published variants.</p>
              </div>
              {realtorPicker}
              <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
                <div>
                  <Label>Autoplay</Label>
                  <p className="text-xs text-muted-foreground">Starts tour videos automatically (muted).</p>
                </div>
                <Switch
                  checked={tourSettings.autoplay}
                  onCheckedChange={async (checked) => updateTourSetting('autoplay', checked)}
                  disabled={!isAdmin || isSavingTourSettings}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
                <div>
                  <Label>Show Garage Info</Label>
                  <p className="text-xs text-muted-foreground">Display garage details on public tour pages.</p>
                </div>
                <Switch
                  checked={tourSettings.show_garage}
                  onCheckedChange={async (checked) => updateTourSetting('show_garage', checked)}
                  disabled={!isAdmin || isSavingTourSettings}
                />
              </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}
      {propertySection}
      {/* 3D Tours Section */}
      {show3dTours && (
        <Card>
          <CardHeader>
            <CardTitle>3D Tours</CardTitle>
            <CardDescription>Manage Matterport and iGuide links with branded and MLS options.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Matterport Section */}
            {showMatterportSection && (
              <div className="space-y-3">
                <h4 className="font-semibold text-sm">Matterport</h4>
                {visibleMatterportKeys.map((key) => {
                  const label = key === 'matterport_branded' ? 'Matterport Branded Link' : 'Matterport MLS Link';
                  const url = tourLinks[key] || '';
                  const isEditing = editing3DKey === key;
                  return (
                    <div key={key} className="space-y-2">
                      <Label>{label}</Label>
                      {!isEditing ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={url}
                            readOnly
                            placeholder="No link set"
                            className="flex-1"
                          />
                          {renderLinkActionButtons(key, {
                            editable: isAdmin,
                            onEdit: () => startEdit3D(key),
                            editTitle: `Edit ${label}`,
                            deletable: Boolean(isAdmin && url),
                            onDelete: () => confirmDelete3D(key),
                            deleting: isDeleting3D === key,
                            deleteTitle: `Remove ${label}`,
                          })}
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-2">
                          <Input
                            value={editing3DValue}
                            onChange={(e) => setEditing3DValue(e.target.value)}
                            placeholder="https://"
                            className="flex-1"
                          />
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={cancelEdit3D}>
                              <X className="mr-1 h-3.5 w-3.5" />
                              Cancel
                            </Button>
                            <Button variant="default" size="sm" onClick={save3DTour} disabled={isSaving3D}>
                              {isSaving3D ? 'Saving...' : <><Check className="mr-1 h-3.5 w-3.5" />Save</>}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {/* iGuide Section */}
            {showIguideSection && (
              <div className="space-y-3">
                <h4 className="font-semibold text-sm">iGuide</h4>
                {/* iGuide sync info */}
                {(() => {
                          const iguideTourUrl = iguideSync.url;
                          const iguideFloorplans = iguideSync.floorplans;
                          const iguidePropertyId = iguideSync.propertyId;
                          const iguideLastSyncedAt = iguideSync.lastSyncedAt;
                  if (!iguideTourUrl && !iguideFloorplans.length && !iguidePropertyId && !iguideLastSyncedAt) return null;
                  return (
                    <div className="border rounded-lg p-3 space-y-1.5 text-xs">
                      {iguideTourUrl && (
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Tour:</span>
                          <a href={iguideTourUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                            Open tour <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      )}
                      {iguidePropertyId && (
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Property ID:</span>
                          <span className="font-medium">{iguidePropertyId}</span>
                        </div>
                      )}
                      {iguideLastSyncedAt && (
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Last sync:</span>
                          <span className="font-medium">{new Date(iguideLastSyncedAt).toLocaleDateString()}</span>
                        </div>
                      )}
                      {iguideFloorplans.length > 0 && (
                        <div className="space-y-1 pt-1">
                          <span className="text-[10px] uppercase text-muted-foreground">Floorplans</span>
                          <div className="space-y-1">
                            {iguideFloorplans.map((floorplan: any, index: number) => {
                              const url = typeof floorplan === 'string' ? floorplan : floorplan?.url;
                              if (!url) return null;
                              const label = typeof floorplan === 'string' ? `Floorplan ${index + 1}` : floorplan?.filename || `Floorplan ${index + 1}`;
                              return (
                                <a key={`${url}-${index}`} href={url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline block">
                                  {label}
                                </a>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
                {visibleIguideKeys.map((key) => {
                  const label = key === 'iguide_branded' ? 'iGuide Branded Link' : 'iGuide MLS Link';
                  const url = tourLinks[key] || '';
                  const isEditing = editing3DKey === key;
                  return (
                    <div key={key} className="space-y-2">
                      <Label>{label}</Label>
                      {!isEditing ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={url}
                            readOnly
                            placeholder="No link set"
                            className="flex-1"
                          />
                          {renderLinkActionButtons(key, {
                            editable: isAdmin,
                            onEdit: () => startEdit3D(key),
                            editTitle: `Edit ${label}`,
                            deletable: Boolean(isAdmin && url),
                            onDelete: () => confirmDelete3D(key),
                            deleting: isDeleting3D === key,
                            deleteTitle: `Remove ${label}`,
                          })}
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-2">
                          <Input
                            value={editing3DValue}
                            onChange={(e) => setEditing3DValue(e.target.value)}
                            placeholder="https://"
                            className="flex-1"
                          />
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={cancelEdit3D}>
                              <X className="mr-1 h-3.5 w-3.5" />
                              Cancel
                            </Button>
                            <Button variant="default" size="sm" onClick={save3DTour} disabled={isSaving3D}>
                              {isSaving3D ? 'Saving...' : <><Check className="mr-1 h-3.5 w-3.5" />Save</>}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {/* Zillow 3D Section */}
            {showZillowSection && (
              <div className="space-y-3">
                <h4 className="font-semibold text-sm">Zillow 3D</h4>
                {(() => {
                  const key = 'zillow_3d' as const;
                  const label = 'Zillow 3D Home Tour';
                  const url = tourLinks[key] || '';
                  const isEditing = editing3DKey === key;
                  return (
                    <div key={key} className="space-y-2">
                      <Label>{label}</Label>
                      {!isEditing ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={url}
                            readOnly
                            placeholder="No link set"
                            className="flex-1"
                          />
                          {renderLinkActionButtons(key, {
                            editable: isAdmin,
                            onEdit: () => startEdit3D(key),
                            editTitle: `Edit ${label}`,
                            deletable: Boolean(isAdmin && url),
                            onDelete: () => confirmDelete3D(key),
                            deleting: isDeleting3D === key,
                            deleteTitle: `Remove ${label}`,
                          })}
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-2">
                          <Input
                            value={editing3DValue}
                            onChange={(e) => setEditing3DValue(e.target.value)}
                            placeholder="https://"
                            className="flex-1"
                          />
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={cancelEdit3D}>
                              <X className="mr-1 h-3.5 w-3.5" />
                              Cancel
                            </Button>
                            <Button variant="default" size="sm" onClick={save3DTour} disabled={isSaving3D}>
                              {isSaving3D ? 'Saving...' : <><Check className="mr-1 h-3.5 w-3.5" />Save</>}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </CardContent>
        </Card>
      )}
      {/* QR Code Dialog */}
      <Dialog open={qrCodeDialog.open} onOpenChange={onQrDialogOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>QR Code - {qrCodeDialog.type.charAt(0).toUpperCase() + qrCodeDialog.type.slice(1)} Tour</DialogTitle>
            <DialogDescription>
              Scan this QR code to access the tour link
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center space-y-4 py-4">
            <div className="bg-white p-4 rounded-lg" id="qr-code-container">
              {qrCodeDialog.url ? (
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(qrCodeDialog.url)}`}
                  alt="QR Code"
                  className="w-64 h-64"
                  onError={onQrImageError}
                />
              ) : (
                <div className="w-64 h-64 flex items-center justify-center text-muted-foreground">
                  No URL available
                </div>
              )}
            </div>
            <div className="w-full space-y-2">
              <Input
                value={qrCodeDialog.url}
                readOnly
                className="text-xs"
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onCopyQrDialogLink}
                  className="flex-1"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Link
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadQrCode}
                  className="flex-1"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download QR
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>  );
}
