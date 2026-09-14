import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BarChart3, Copy, ExternalLink, Share2, QrCode, Download, Edit, Trash, Check, X, Info } from 'lucide-react';
import { ShootTourSettingsSection } from './ShootTourSettingsSection';
import { TourProvidersSection } from './tours/TourProvidersSection';
import { TourLinkRow, type TourLinkAction } from './tours/TourLinkRow';
// This legacy view is a pass-through shell while its sections are progressively extracted.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function ShootDetailsTourTabView(props: any) {
  const {
    shootId,
    onShootUpdate,
    onShowAnalytics,
    getTourUrl,
    copyLink,
    openLink,
    shareLink,
    getQrCode,
    showVideoLinksSection,
    showVideoEmbedSection,
    showTourSettings,
    tourSettingsRealtorOnly = false,
    isClientView,
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
    tourPalette,
    setTourPalette,
    saveTourPalette,
    isSavingTourPalette,
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
    createCubicasaOrderButton,
    qrCodeDialog,
    onQrDialogOpenChange,
    onQrImageError,
    onCopyQrDialogLink,
    downloadQrCode,
  } = props;

  const providerSection = (
    <TourProvidersSection
      shootId={shootId}
      onShootUpdate={onShootUpdate}
      isAdmin={isAdmin}
      isClientView={isClientView}
      show3dTours={show3dTours}
      showMatterportSection={showMatterportSection}
      showIguideSection={showIguideSection}
      showZillowSection={showZillowSection}
      visibleMatterportKeys={visibleMatterportKeys}
      visibleIguideKeys={visibleIguideKeys}
      tourLinks={tourLinks}
      editing3DKey={editing3DKey}
      editing3DValue={editing3DValue}
      setEditing3DValue={setEditing3DValue}
      isSaving3D={isSaving3D}
      isDeleting3D={isDeleting3D}
      startEdit3D={startEdit3D}
      cancelEdit3D={cancelEdit3D}
      save3DTour={save3DTour}
      confirmDelete3D={confirmDelete3D}
      copyLink={copyLink}
      openLink={openLink}
      shareLink={shareLink}
      iguideSync={iguideSync}
      iguidePropertyIdInput={iguidePropertyIdInput}
      setIguidePropertyIdInput={setIguidePropertyIdInput}
      iguideWorkOrderIdInput={iguideWorkOrderIdInput}
      setIguideWorkOrderIdInput={setIguideWorkOrderIdInput}
      saveIguideIdentifiers={saveIguideIdentifiers}
      isSavingIguideIdentifiers={isSavingIguideIdentifiers}
      syncIguideNow={syncIguideNow}
      isSyncingIguide={isSyncingIguide}
      cubicasaSync={cubicasaSync}
      cubicasaOrderIdInput={cubicasaOrderIdInput}
      setCubicasaOrderIdInput={setCubicasaOrderIdInput}
      cubicasaExternalIdInput={cubicasaExternalIdInput}
      setCubicasaExternalIdInput={setCubicasaExternalIdInput}
      saveCubicasaIdentifiers={saveCubicasaIdentifiers}
      isSavingCubicasaIdentifiers={isSavingCubicasaIdentifiers}
      syncCubicasaNow={syncCubicasaNow}
      isSyncingCubicasa={isSyncingCubicasa}
      createCubicasaOrderButton={createCubicasaOrderButton}
    />
  );

  // Every link row offers the same four public actions; video rows add edit
  // and remove for admins. Built here once so the phone menu and the desktop
  // buttons can never drift apart.
  const shareActions = (key: string, hasUrl = true): TourLinkAction[] => [
    { key: 'copy', label: 'Copy link', icon: Copy, onSelect: () => copyLink(key), disabled: !hasUrl },
    { key: 'open', label: 'Open in new tab', icon: ExternalLink, onSelect: () => openLink(key), disabled: !hasUrl },
    { key: 'share', label: 'Share link', icon: Share2, onSelect: () => shareLink(key), disabled: !hasUrl },
    { key: 'qr', label: 'Get QR code', icon: QrCode, onSelect: () => getQrCode(key), disabled: !hasUrl },
  ];
  const manageActions = (key: string, label: string): TourLinkAction[] => (isAdmin
    ? [
      { key: 'edit', label: `Edit ${label}`, icon: Edit, onSelect: () => startEditVideoLink(key) },
      ...(tourLinks[key]
        ? [{ key: 'remove', label: `Remove ${label}`, icon: Trash, onSelect: () => void deleteVideoLink(key), disabled: isDeletingVideoLinkKey === key, destructive: true }]
        : []),
    ]
    : []);

  return (
    <div className="w-full space-y-4">
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
            <TourLinkRow label="Branded Tour Link" value={getTourUrl('branded')} actions={shareActions('branded')} />
          </div>
          {/* MLS-Compliant Link */}
          <div className="space-y-2">
            <Label>MLS-Compliant Link</Label>
            <TourLinkRow label="MLS-Compliant Link" value={getTourUrl('mls')} actions={shareActions('mls')} />
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
            <TourLinkRow label="Generic MLS Link" value={getTourUrl('genericMls')} actions={shareActions('genericMls')} />
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
                          <TourLinkRow
                            label={label}
                            value={url}
                            placeholder={placeholder}
                            actions={[...shareActions(key, Boolean(url)), ...manageActions(key, label)]}
                          />
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
                  <TourLinkRow
                    label="Video embed"
                    value={tourLinks.video_link || ''}
                    placeholder="No video embed set"
                    actions={[
                      { key: 'copy', label: 'Copy embed link', icon: Copy, onSelect: () => copyLink('video_link'), disabled: !tourLinks.video_link },
                      { key: 'open', label: 'Open embed link', icon: ExternalLink, onSelect: () => openLink('video_link'), disabled: !tourLinks.video_link },
                      ...manageActions('video_link', 'video embed'),
                    ]}
                  />
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
      {/* 3D tours and floor plans sit with the other shareable links, directly
          under Video Links, rather than after the settings and property forms. */}
      {providerSection}
      {/* Tour Settings Section */}
      {showTourSettings && (
        <ShootTourSettingsSection
          open={openSections.settings}
          onOpenChange={() => toggleSection('settings')}
          tourStyle={tourStyle}
          setTourStyle={setTourStyle}
          saveTourStyle={saveTourStyle}
          isSavingTourStyle={isSavingTourStyle}
          tourPalette={tourPalette}
          setTourPalette={setTourPalette}
          saveTourPalette={saveTourPalette}
          isSavingTourPalette={isSavingTourPalette}
          embeds={embeds}
          embedForm={embedForm}
          setEmbedForm={setEmbedForm}
          editingEmbedId={editingEmbedId}
          featuredEmbedId={featuredEmbedId}
          setFeaturedEmbedId={setFeaturedEmbedId}
          savingEmbeds={savingEmbeds}
          handleSaveEmbed={handleSaveEmbed}
          handleEditEmbed={handleEditEmbed}
          handleDeleteEmbed={handleDeleteEmbed}
          persistEmbeds={persistEmbeds}
          isEmbedHtml={isEmbedHtml}
          tourSettings={tourSettings}
          updateTourSetting={updateTourSetting}
          isSavingTourSettings={isSavingTourSettings}
          realtorPicker={realtorPicker}
          isAdmin={isAdmin}
          realtorOnly={tourSettingsRealtorOnly}
        />
      )}
      {propertySection}
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
