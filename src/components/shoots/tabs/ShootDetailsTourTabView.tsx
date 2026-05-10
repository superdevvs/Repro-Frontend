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
import { BarChart3, Copy, ExternalLink, Share2, QrCode, ChevronDown, ChevronUp, Download, Edit, Trash, Check, X, Plus, Info } from 'lucide-react';
export function ShootDetailsTourTabView(props: any) {
  const {
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
    iguidePropertyIdInput,
    setIguidePropertyIdInput,
    iguideWorkOrderIdInput,
    setIguideWorkOrderIdInput,
    saveIguideIdentifiers,
    isSavingIguideIdentifiers,
    syncIguideNow,
    isSyncingIguide,
    // CubiCasa
    cubicasaSync,
    cubicasaOrderIdInput,
    setCubicasaOrderIdInput,
    cubicasaExternalIdInput,
    setCubicasaExternalIdInput,
    saveCubicasaIdentifiers,
    isSavingCubicasaIdentifiers,
    syncCubicasaNow,
    isSyncingCubicasa,
    qrCodeDialog,
    onQrDialogOpenChange,
    onQrImageError,
    onCopyQrDialogLink,
    downloadQrCode,
  } = props;

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
                  {isAdmin && (
                    <p className="text-xs text-muted-foreground">
                      These links stay fixed. Editing a row changes the video that the public page plays.
                    </p>
                  )}
                </div>
                {publicVideoLinkConfigs.map(({ key, label, placeholder }) => {
                  const isEditing = editingVideoLinkKey === key;
                  const url = getTourUrl(key);
                  const destinationUrl = typeof tourLinks[key] === 'string' ? tourLinks[key] : '';
                  return (
                    <div key={key} className="space-y-2">
                      <Label>{label}</Label>
                      {!isEditing ? (
                        <div className="space-y-2">
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
                          {isAdmin && (
                            <p className="truncate text-xs text-muted-foreground">
                              Destination: {destinationUrl || placeholder}
                            </p>
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
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-sm">iGuide</h4>
                  {syncIguideNow && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={syncIguideNow}
                      disabled={isSyncingIguide}
                      title="Re-fetch iGuide deliverables from youriguide.com"
                    >
                      {isSyncingIguide ? 'Syncing…' : (<><Download className="mr-1 h-3.5 w-3.5" />Sync iGuide now</>)}
                    </Button>
                  )}
                </div>
                {/* iGuide sync info */}
                {(() => {
                  const s = iguideSync || {};
                  const iguideTourUrl = s.url;
                  const iguideFloorplans = s.floorplans || [];
                  const iguidePropertyId = s.propertyId;
                  const iguideWorkOrderId = s.workOrderId;
                  const iguideLastSyncedAt = s.lastSyncedAt;
                  const billing = s.billing;
                  const hasAny = Boolean(
                    iguideTourUrl || iguideFloorplans.length || iguidePropertyId
                      || iguideWorkOrderId || iguideLastSyncedAt || s.unbrandedUrl
                      || s.embeddedUrl || s.manageUrl || s.embedImageUrl || billing,
                  );
                  if (!hasAny) return null;
                  return (
                    <div className="border rounded-lg p-3 space-y-2 text-xs">
                      {s.embedImageUrl && (
                        <a
                          href={iguideTourUrl || s.embedImageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block w-full max-h-40 overflow-hidden rounded border"
                          title="Open iGuide tour"
                        >
                          <img src={s.embedImageUrl} alt="iGuide preview" className="w-full h-full object-cover" />
                        </a>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {iguideTourUrl && (
                          <a
                            href={iguideTourUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            Open tour <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                        {s.unbrandedUrl && (
                          <a
                            href={s.unbrandedUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            Unbranded <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                        {s.embeddedUrl && (
                          <a
                            href={s.embeddedUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            Embed page <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                        {isAdmin && s.manageUrl && (
                          <a
                            href={s.manageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            Manage on iGuide <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                      {(iguidePropertyId || iguideWorkOrderId || iguideLastSyncedAt) && (
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                          {iguidePropertyId && (
                            <>
                              <span className="text-muted-foreground">Property ID:</span>
                              <span className="font-medium truncate" title={iguidePropertyId}>{iguidePropertyId}</span>
                            </>
                          )}
                          {iguideWorkOrderId && (
                            <>
                              <span className="text-muted-foreground">Work order:</span>
                              <span className="font-medium truncate" title={iguideWorkOrderId}>{iguideWorkOrderId}</span>
                            </>
                          )}
                          {iguideLastSyncedAt && (
                            <>
                              <span className="text-muted-foreground">Last sync:</span>
                              <span className="font-medium">{new Date(iguideLastSyncedAt).toLocaleString()}</span>
                            </>
                          )}
                        </div>
                      )}
                      {billing && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {billing.iguideType && (
                            <Badge variant="secondary" className="text-[10px] uppercase">{billing.iguideType}</Badge>
                          )}
                          {Array.isArray(billing.addons) && billing.addons.map((addon: string) => (
                            <Badge key={addon} variant="outline" className="text-[10px] uppercase">{addon}</Badge>
                          ))}
                          {typeof billing.billableAreaSqFeet === 'number' && (
                            <Badge variant="outline" className="text-[10px]">
                              {Math.round(billing.billableAreaSqFeet).toLocaleString()} sqft
                            </Badge>
                          )}
                        </div>
                      )}
                      {(s.pdfMetricUrl || s.pdfImperialUrl) && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {s.pdfImperialUrl && (
                            <a
                              href={s.pdfImperialUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-primary hover:underline"
                            >
                              <Download className="h-3 w-3" /> Floor plan PDF (Imperial)
                            </a>
                          )}
                          {s.pdfMetricUrl && (
                            <a
                              href={s.pdfMetricUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-primary hover:underline"
                            >
                              <Download className="h-3 w-3" /> Floor plan PDF (Metric)
                            </a>
                          )}
                        </div>
                      )}
                      {iguideFloorplans.length > 0 && (
                        <div className="space-y-1 pt-1">
                          <span className="text-[10px] uppercase text-muted-foreground">All deliverables</span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                            {iguideFloorplans.map((floorplan: any, index: number) => {
                              const url = typeof floorplan === 'string' ? floorplan : floorplan?.url;
                              if (!url) return null;
                              const label = typeof floorplan === 'string'
                                ? `Floorplan ${index + 1}`
                                : (floorplan?.label || floorplan?.filename || `Floorplan ${index + 1}`);
                              return (
                                <a key={`${url}-${index}`} href={url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">
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
                {/* Admin-only iGuide identifier inputs (drives webhook matching). */}
                {isAdmin && (saveIguideIdentifiers || setIguidePropertyIdInput) && (
                  <div className="border rounded-lg p-3 space-y-2 text-xs">
                    <span className="text-[10px] uppercase text-muted-foreground">iGuide matching</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[11px]">Property ID</Label>
                        <Input
                          value={iguidePropertyIdInput ?? ''}
                          onChange={(e) => setIguidePropertyIdInput && setIguidePropertyIdInput(e.target.value)}
                          placeholder="igYGFV5GG6V8DD1"
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px]">Work order ID</Label>
                        <Input
                          value={iguideWorkOrderIdInput ?? ''}
                          onChange={(e) => setIguideWorkOrderIdInput && setIguideWorkOrderIdInput(e.target.value)}
                          placeholder="WO1234 or shoot:123"
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button
                        variant="default"
                        size="sm"
                        onClick={saveIguideIdentifiers}
                        disabled={isSavingIguideIdentifiers}
                      >
                        {isSavingIguideIdentifiers ? 'Saving…' : 'Save identifiers'}
                      </Button>
                    </div>
                  </div>
                )}
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
            {/* CubiCasa Section — floor-plan ingestion only (no tour links). */}
            {(cubicasaSync || isAdmin) && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-sm">CubiCasa Floor Plans</h4>
                  {syncCubicasaNow && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={syncCubicasaNow}
                      disabled={isSyncingCubicasa}
                      title="Re-fetch CubiCasa floor plans from app.cubi.casa"
                    >
                      {isSyncingCubicasa ? 'Syncing…' : (<><Download className="mr-1 h-3.5 w-3.5" />Sync CubiCasa now</>)}
                    </Button>
                  )}
                </div>
                {(() => {
                  const c = cubicasaSync || {};
                  const status = c.status;
                  const productType = c.productType;
                  const lastSyncedAt = c.lastSyncedAt;
                  const orderId = c.orderId;
                  const externalId = c.externalId;
                  const hasAny = Boolean(status || orderId || externalId || lastSyncedAt);
                  if (!hasAny && !isAdmin) return null;
                  const statusVariant: any = (() => {
                    const s = (status || '').toString().toLowerCase();
                    if (s === 'ready') return 'default';
                    if (s === 'fixing') return 'destructive';
                    if (s === 'pending') return 'secondary';
                    return 'outline';
                  })();
                  return (
                    <div className="border rounded-lg p-3 space-y-2 text-xs">
                      <p className="text-muted-foreground text-[11px]">
                        Floor plans appear under <strong>Media → Edited → Floor Plans</strong> once CubiCasa
                        marks the order as <em>Ready</em>.
                      </p>
                      {(status || productType) && (
                        <div className="flex flex-wrap items-center gap-2">
                          {status && <Badge variant={statusVariant}>{status}</Badge>}
                          {productType && <span className="text-muted-foreground">{productType}</span>}
                        </div>
                      )}
                      {(orderId || externalId || lastSyncedAt) && (
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                          {orderId && (
                            <div className="col-span-2">
                              <span className="text-muted-foreground">Order ID:</span>{' '}
                              <span className="font-mono">{orderId}</span>
                            </div>
                          )}
                          {externalId && (
                            <div>
                              <span className="text-muted-foreground">External ID:</span>{' '}
                              <span className="font-mono">{externalId}</span>
                            </div>
                          )}
                          {lastSyncedAt && (
                            <div className="col-span-2">
                              <span className="text-muted-foreground">Last synced:</span>{' '}
                              <span>{new Date(lastSyncedAt).toLocaleString()}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}
                {/* Admin-only CubiCasa identifier inputs (drives webhook matching). */}
                {isAdmin && saveCubicasaIdentifiers && (
                  <div className="border rounded-lg p-3 space-y-2 text-xs">
                    <span className="text-[10px] uppercase text-muted-foreground">CubiCasa matching</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[11px]">Order ID</Label>
                        <Input
                          value={cubicasaOrderIdInput ?? ''}
                          onChange={(e) => setCubicasaOrderIdInput && setCubicasaOrderIdInput(e.target.value)}
                          placeholder="9ba65f04-3ee2-4de9-a098-ece787ceee57"
                          className="h-8 text-xs font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px]">External ID (optional)</Label>
                        <Input
                          value={cubicasaExternalIdInput ?? ''}
                          onChange={(e) => setCubicasaExternalIdInput && setCubicasaExternalIdInput(e.target.value)}
                          placeholder="shoot:123"
                          className="h-8 text-xs font-mono"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button
                        variant="default"
                        size="sm"
                        onClick={saveCubicasaIdentifiers}
                        disabled={isSavingCubicasaIdentifiers}
                      >
                        {isSavingCubicasaIdentifiers ? 'Saving…' : 'Save identifiers'}
                      </Button>
                    </div>
                  </div>
                )}
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
