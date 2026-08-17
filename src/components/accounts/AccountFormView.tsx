import React from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ImageUpload } from '@/components/profile/ImageUpload';
import { AvatarPicker } from '@/components/profile/AvatarPicker';
import { FileUploadModal } from '@/components/accounts/FileUploadModal';
import { STATE_OPTIONS } from '@/utils/stateUtils';
import { Upload, FileText, X, Camera, Loader2, MapPin, Plus, Wrench } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { PhoneInput } from '@/components/ui/phone-input';
import { MultiSelectChecklist } from '@/components/ui/multi-select-checklist';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { equipmentStatusLabel } from '@/services/photographerEquipmentService';
import {
  TIMEZONE_OPTIONS,
  editorCapabilityOptions,
  formatEquipmentMoney,
  payoutFrequencyOptions,
  repCategoryOptions,
} from './accountFormModel';
import type { AccountFormController } from './useAccountFormController';
import { AccountEquipmentFields } from './AccountEquipmentFields';
import { AccountInsuranceFields } from './AccountInsuranceFields';
import { AccountRoleSettings } from './AccountRoleSettings';
export function AccountFormView({ controller }: { controller: AccountFormController }) {
  const {
    open, onOpenChange, initialData, avatarUrl, setAvatarUrl, adminsAndReps,
    pilotLicenseModalOpen, setPilotLicenseModalOpen, insuranceModalOpen,
    setInsuranceModalOpen, avatarPickerOpen, setAvatarPickerOpen, emailWarningOverride,
    setEmailWarningOverride, equipmentRows, existingEquipmentOptions,
    assignedEquipmentOptions, assignedEquipmentLoading, assignedEquipmentError,
    selectedExistingEquipmentIds, setSelectedExistingEquipmentIds, equipmentManageOpen,
    setEquipmentManageOpen, equipmentSaving, editingEquipmentId, setEditingEquipmentId,
    equipmentEditValues, setEquipmentEditValues, updateEquipmentRow, addEquipmentRow,
    removeEquipmentRow, handleSaveAccountEquipment, openEquipmentEdit, saveEquipmentEdit,
    serverEmailHealth, setServerEmailHealth, form, viewerRole, currentUser, currentRole,
    isClientRole, localEmailHint, emailHelpState, displayedRepId,
    displayedRepName, repAssigned, serviceGroupOptions, handleSubmit, serviceOptions,
    serviceCategories, categoryCapabilityOptions, isLoadingCategoryCapabilities, isSalesRep,
    isEditorRole, isSalesRepViewer, roleSelectionDisabled, canManageRoles, canCreateSalesRep,
    canEditSensitiveRepFields, canEditClientRep, showRepSelector, repLabel,
    useDesktopAvatarPicker,
  } = controller;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[calc(100dvh-0.5rem)] w-[calc(100vw-0.5rem)] max-w-[1100px] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:h-auto sm:max-h-[90vh] sm:w-full sm:gap-4 sm:rounded-lg sm:px-6 sm:py-8">
        <Form {...form}>
        <DialogHeader className="relative border-b px-3 py-2.5 sm:-mt-2 sm:border-0 sm:px-0 sm:pt-0 sm:pb-0 sm:pr-14">
          {}
          <div className="flex w-full items-center justify-between gap-3 pr-8 sm:pr-0">
            <DialogTitle className="min-w-0 truncate pt-0 text-[15px] font-semibold sm:text-xl sm:truncate-none">
              {initialData
                ? "Update account"
                : "New account"}
              <span className="hidden sm:inline">
                {initialData ? " details" : " — create user"}
              </span>
            </DialogTitle>
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem className="flex-shrink-0">
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={roleSelectionDisabled}
                  >
                    <FormControl>
                      <SelectTrigger disabled={roleSelectionDisabled} className="h-7 w-auto gap-1 rounded-full border-border/60 bg-muted/40 px-2.5 text-xs font-medium sm:h-9 sm:w-[140px] sm:rounded-md sm:px-3 sm:text-sm">
                        <SelectValue placeholder="Role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {isSalesRepViewer ? (
                        <SelectItem value="client">Client</SelectItem>
                      ) : (
                        <>
                          {viewerRole === 'superadmin' && (
                            <SelectItem value="superadmin" disabled={!canManageRoles}>
                              Super Admin
                            </SelectItem>
                          )}
                          <SelectItem value="admin" disabled={!canManageRoles}>
                            Admin
                          </SelectItem>
                          <SelectItem value="editing_manager" disabled={!canManageRoles}>
                            Editing Manager
                          </SelectItem>
                          <SelectItem value="photographer" disabled={!canManageRoles}>
                            Photographer
                          </SelectItem>
                          <SelectItem value="client">Client</SelectItem>
                          <SelectItem value="editor" disabled={!canManageRoles}>
                            Editor
                          </SelectItem>
                          <SelectItem value="salesRep" disabled={!canCreateSalesRep}>
                            Sales/Rep
                          </SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                  {isSalesRepViewer && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 text-right whitespace-nowrap sm:text-xs sm:mt-1">
                      {initialData
                        ? 'Sales reps can edit only client accounts they manage.'
                        : 'Sales reps can only create client accounts.'}
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          {}
          {showRepSelector && (
            <FormField
              control={form.control}
              name="created_by_id"
              render={({ field }) => (
                <FormItem className="mt-0.5">
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] text-muted-foreground sm:text-xs">{repLabel}:</span>
                    <Select
                      onValueChange={(value) => {
                        field.onChange(value);
                        const selected = adminsAndReps.find(u => u.id === value);
                        if (selected) {
                          form.setValue('created_by_name', selected.name);
                        }
                      }}
                      value={field.value || (currentUser?.id ? String(currentUser.id) : "")}
                    >
                      <FormControl>
                        <SelectTrigger className="border-0 bg-transparent shadow-none h-auto p-0 gap-1 text-[11px] font-medium text-foreground hover:bg-transparent focus:ring-0 focus:ring-offset-0 w-auto sm:text-xs">
                          <SelectValue placeholder={`Select ${repLabel.toLowerCase()}`} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {adminsAndReps.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          {!showRepSelector && isClientRole && (
            <div className="text-[11px] text-muted-foreground mt-0.5 sm:text-xs">
              {repLabel}: <span className="font-medium text-foreground">
                {displayedRepName || 'Unassigned'}
              </span>
            </div>
          )}
        </DialogHeader>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-0 sm:py-2">
              <div className="space-y-3 sm:space-y-8">
            <div className="grid gap-4 md:grid-cols-[260px,1fr]">
              <div className="flex flex-row items-center gap-3 sm:flex-col sm:gap-3">
                <ImageUpload
                  initialImage={avatarUrl}
                  onChange={(url) => {
                    setAvatarUrl(url);
                    form.setValue("avatar", url);
                  }}
                  className="h-16 w-16 sm:h-24 sm:w-24"
                />
                <div className="flex flex-col gap-1.5 sm:items-center">
                  {useDesktopAvatarPicker ? (
                    <Popover open={avatarPickerOpen} onOpenChange={setAvatarPickerOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9 gap-2 text-sm"
                        >
                          {avatarUrl ? (
                            <img src={avatarUrl} alt="Selected avatar" className="h-5 w-5 rounded-full object-cover" />
                          ) : (
                            <Camera className="h-4 w-4" />
                          )}
                          Choose Avatar
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        side="bottom"
                        align="center"
                        sideOffset={8}
                        className="z-[80] w-[360px] max-w-[calc(100vw-2rem)] rounded-xl p-4 shadow-xl"
                      >
                        <div className="mb-3 space-y-1">
                          <h3 className="text-sm font-semibold">Choose Avatar</h3>
                          <p className="text-xs text-muted-foreground">
                            Choose a default avatar for this account.
                          </p>
                        </div>
                        <AvatarPicker
                          selectedAvatar={avatarUrl}
                          onSelect={(url) => {
                            setAvatarUrl(url);
                            form.setValue("avatar", url);
                            setAvatarPickerOpen(false);
                          }}
                        />
                      </PopoverContent>
                    </Popover>
                  ) : (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 text-xs"
                        onClick={() => setAvatarPickerOpen(true)}
                      >
                        {avatarUrl ? (
                          <img src={avatarUrl} alt="Selected avatar" className="h-4 w-4 rounded-full object-cover" />
                        ) : (
                          <Camera className="h-3.5 w-3.5" />
                        )}
                        Choose Avatar
                      </Button>
                      <Drawer open={avatarPickerOpen} onOpenChange={setAvatarPickerOpen}>
                        <DrawerContent className="max-h-[70dvh]">
                          <DrawerHeader className="pb-2">
                            <DrawerTitle>Choose Avatar</DrawerTitle>
                            <p className="text-sm text-muted-foreground">
                              Choose a default avatar for this account.
                            </p>
                          </DrawerHeader>
                          <div className="overflow-y-auto px-4 pb-6">
                            <AvatarPicker
                              selectedAvatar={avatarUrl}
                              onSelect={(url) => {
                                setAvatarUrl(url);
                                form.setValue("avatar", url);
                                setAvatarPickerOpen(false);
                              }}
                            />
                          </div>
                        </DrawerContent>
                      </Drawer>
                    </>
                  )}
                </div>
              </div>
              <div className="space-y-2.5 sm:space-y-4">
                <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name</FormLabel>
                        <FormControl>
                          <Input placeholder="First name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Last name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-1 gap-2.5 sm:gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input placeholder="user@example.com" type="email" {...field} />
                        </FormControl>
                        {isClientRole && emailHelpState?.message && (
                          <div
                            className={cn(
                              "rounded-lg border p-3 text-sm",
                              emailHelpState.level === "error" && "border-rose-200 bg-rose-50 text-rose-800",
                              emailHelpState.level === "warning" && "border-amber-200 bg-amber-50 text-amber-800",
                              emailHelpState.level === "info" && "border-sky-200 bg-sky-50 text-sky-800",
                            )}
                          >
                            <p>{emailHelpState.message}</p>
                            {emailHelpState.suggestedCorrection && !emailWarningOverride && (
                              <div className="mt-3 flex flex-wrap gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    form.setValue('email', emailHelpState.suggestedCorrection || '', {
                                      shouldDirty: true,
                                      shouldValidate: true,
                                    });
                                    setEmailWarningOverride(false);
                                    setServerEmailHealth(undefined);
                                    form.clearErrors('email');
                                  }}
                                >
                                  Use suggested email
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setEmailWarningOverride(true);
                                    form.clearErrors('email');
                                  }}
                                >
                                  Keep anyway
                                </Button>
                              </div>
                            )}
                            {emailWarningOverride && (
                              <p className="mt-2 text-xs font-medium">
                                Warning override enabled. This email will save with a delivery-risk warning.
                              </p>
                            )}
                          </div>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                          <PhoneInput
                            value={field.value}
                            onChange={field.onChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="company"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company</FormLabel>
                    <FormControl>
                      <Input placeholder="Company name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="licenseNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>License number</FormLabel>
                    <FormControl>
                      <Input placeholder="LI0123456" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="timezone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Timezone</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ''}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select timezone" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TIMEZONE_OPTIONS.map((tz) => (
                          <SelectItem key={tz.value} value={tz.value}>
                            {tz.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {!isSalesRep && (
                <>
                  {!(isSalesRepViewer && currentRole === 'photographer') && (
                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address</FormLabel>
                        <FormControl>
                          <Input placeholder="Street address" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  )}
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input placeholder="City" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>State</FormLabel>
                        <FormControl>
                          <Select value={field.value || ''} onValueChange={field.onChange}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select state" />
                            </SelectTrigger>
                            <SelectContent>
                              {STATE_OPTIONS.map((state) => (
                                <SelectItem key={state.value} value={state.value}>
                                  {state.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="zipcode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Zip Code</FormLabel>
                        <FormControl>
                          <Input placeholder="Zip Code" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}
            </div>
            <AccountInsuranceFields controller={controller} />
            {isSalesRep && (
              <div className="space-y-4 rounded-lg border border-border/60 bg-muted/30 p-4">
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold">Rep Settings</h3>
                  <p className="text-sm text-muted-foreground">
                    Configure payout, coverage, and communication preferences for this rep.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-2.5 sm:gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="repPayoutEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payout Email</FormLabel>
                        <FormControl>
                          <Input placeholder="payouts@rep.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="repPayoutFrequency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payout Frequency</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select schedule" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {payoutFrequencyOptions.map((freq) => (
                              <SelectItem key={freq} value={freq}>
                                {freq === 'weekly' && 'Weekly (Sunday recap)'}
                                {freq === 'biweekly' && 'Bi-weekly'}
                                {freq === 'monthly' && 'Monthly'}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
                  <FormField
                    control={form.control}
                    name="repHomeStreet"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Home Address</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Street address"
                            {...field}
                            disabled={!canEditSensitiveRepFields}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="repHomeStreet2"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Apartment / Suite</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Unit or suite"
                            {...field}
                            disabled={!canEditSensitiveRepFields}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="repHomeCity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="City"
                            {...field}
                            disabled={!canEditSensitiveRepFields}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="repHomeState"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>State</FormLabel>
                        <FormControl>
                          <Select
                            value={field.value || ''}
                            onValueChange={field.onChange}
                            disabled={!canEditSensitiveRepFields}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select state" />
                            </SelectTrigger>
                            <SelectContent>
                              {STATE_OPTIONS.map((state) => (
                                <SelectItem key={state.value} value={state.value}>
                                  {state.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="repHomeZip"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Postal Code</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Zip / Postal code"
                            {...field}
                            disabled={!canEditSensitiveRepFields}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="repCommissionRate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Commission %</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            placeholder="10"
                            {...field}
                            disabled={!canEditSensitiveRepFields}
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">
                          Only super admins can adjust commission percentages.
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="repSalesCategories"
                  render={({ field }) => {
                    const valueArray: string[] = Array.isArray(field.value) ? field.value : [];
                    const toggle = (opt: string) => {
                      if (valueArray.includes(opt)) field.onChange(valueArray.filter((v) => v !== opt));
                      else field.onChange([...valueArray, opt]);
                    };
                    return (
                      <FormItem>
                        <FormLabel>Eligible Sales Categories</FormLabel>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {repCategoryOptions.map((opt) => {
                            const active = valueArray.includes(opt);
                            return (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => toggle(opt)}
                                className={cn(
                                  "px-3 py-1.5 rounded-full text-sm border transition",
                                  active
                                    ? "bg-[#6E59A5] text-white border-[#6E59A5] shadow-sm"
                                    : "bg-transparent text-slate-600 dark:text-slate-300 border-slate-400/60 hover:bg-slate-100 dark:hover:bg-slate-800/40"
                                )}
                              >
                                {opt}
                              </button>
                            );
                          })}
                        </div>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
                <div className="grid grid-cols-1 gap-2.5 sm:gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="repAutoApprovePayouts"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border px-4 py-3">
                        <div className="space-y-0.5">
                          <FormLabel>Auto-approve payouts</FormLabel>
                          <p className="text-sm text-muted-foreground">
                            Send weekly payout reports and auto-approve when enabled.
                          </p>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="repCanTextClients"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border px-4 py-3">
                        <div className="space-y-0.5">
                          <FormLabel>Allow SMS outreach</FormLabel>
                          <p className="text-sm text-muted-foreground">
                            Enable this rep to send text messages from the dashboard.
                          </p>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="repNotes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Internal Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Additional comp notes or special handling for this rep"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}
            {currentRole === "photographer" && (
              <>
                <FormField
                  control={form.control}
                  name="specialties"
                  render={({ field }) => {
                    const valueArray: string[] = Array.isArray(field.value) ? field.value : [];
                    const toggle = (categoryId: string, serviceIds: string[]) => {
                      const selected = valueArray.includes(categoryId) || serviceIds.some((id) => valueArray.includes(id));
                      const categoryServiceIds = new Set(serviceIds);
                      if (selected) {
                        field.onChange(valueArray.filter((value) => value !== categoryId && !categoryServiceIds.has(value)));
                        return;
                      }
                      field.onChange([
                        ...valueArray.filter((value) => !categoryServiceIds.has(value)),
                        categoryId,
                      ]);
                    };
                    return (
                      <FormItem>
                        <FormLabel>Service Capabilities</FormLabel>
                        <p className="text-xs text-muted-foreground mb-2">
                          Select categories this photographer can shoot
                        </p>
                        {isLoadingCategoryCapabilities ? (
                          <div className="flex items-center gap-2 py-4 text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="text-sm">Loading categories...</span>
                          </div>
                        ) : categoryCapabilityOptions.length === 0 ? (
                          <p className="text-sm text-muted-foreground py-2">
                            No categories configured. Add services in Scheduling Settings.
                          </p>
                        ) : (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {categoryCapabilityOptions.map((category) => {
                              const serviceIds = category.services.map((service) => service.id);
                              const active = valueArray.includes(category.id) || serviceIds.some((id) => valueArray.includes(id));
                              return (
                                <button
                                  key={category.id}
                                  type="button"
                                  onClick={() => toggle(category.id, serviceIds)}
                                  title={`${category.services.length} services`}
                                  className={cn(
                                    "px-3 py-1.5 rounded-full text-sm border transition",
                                    active
                                      ? "bg-primary/10 text-primary border-primary/30 shadow-sm"
                                      : "bg-background text-muted-foreground border-border/70 hover:bg-muted/60 hover:text-foreground"
                                  )}
                                >
                                  {category.label}
                                </button>
                              );
                            })}
                          </div>
                        )}
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
                {}
                <div className="space-y-3 rounded-lg border border-border/60 bg-muted/30 p-4">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold">Travel Range</h3>
                  </div>
                  <FormField
                    control={form.control}
                    name="travelRange"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between">
                          <FormLabel className="text-xs text-muted-foreground">Max Distance</FormLabel>
                          <span className="text-sm font-semibold">{field.value || 25} {form.watch('travelRangeUnit') || 'miles'}</span>
                        </div>
                        <FormControl>
                          <Slider
                            value={[field.value || 25]}
                            onValueChange={([val]) => field.onChange(val)}
                            min={5}
                            max={150}
                            step={5}
                            className="mt-2"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="travelRangeUnit"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex gap-2">
                          {(['miles', 'km'] as const).map((unit) => (
                            <button
                              key={unit}
                              type="button"
                              onClick={() => field.onChange(unit)}
                              className={cn(
                                "px-3 py-1 rounded-full text-xs border transition",
                                field.value === unit
                                  ? "bg-primary/10 text-primary border-primary/30"
                                  : "bg-background text-muted-foreground border-border/70 hover:bg-muted/60"
                              )}
                            >
                              {unit === 'miles' ? 'Miles' : 'Kilometers'}
                            </button>
                          ))}
                        </div>
                      </FormItem>
                    )}
                  />
                </div>
                <AccountEquipmentFields controller={controller} />
              </>
            )}
            <AccountRoleSettings controller={controller} />
            <FormField
              control={form.control}
              name="companyNotes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Add any internal notes about this user or their company"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
              </div>
            </div>
            {currentRole === "photographer" && (
              <FileUploadModal
                open={pilotLicenseModalOpen}
                onOpenChange={setPilotLicenseModalOpen}
                onUploadComplete={(url, fileName) => {
                  form.setValue("pilotLicenseFile", url);
                  form.setValue("pilotLicenseFileName", fileName || "Pilot License");
                }}
                title="Upload Pilot License"
                folder="pilot-licenses"
                accept="image/*,.pdf"
                initialValue={form.watch("pilotLicenseFile")}
                initialFileName={form.watch("pilotLicenseFileName")}
                showFileNameInput={true}
                fileNameLabel="License Number/Name"
              />
            )}
            {currentRole === "photographer" && !isSalesRep && (
              <FileUploadModal
                open={insuranceModalOpen}
                onOpenChange={setInsuranceModalOpen}
                onUploadComplete={(url, fileName) => {
                  form.setValue("insuranceFile", url);
                  form.setValue("insuranceFileName", fileName || "Insurance Document");
                }}
                title="Upload Insurance Document"
                folder="insurance"
                accept="image/*,.pdf"
                initialValue={form.watch("insuranceFile")}
                initialFileName={form.watch("insuranceFileName")}
                showFileNameInput={true}
                fileNameLabel="Document Name"
              />
            )}
            <DialogFooter className="flex-row gap-2 border-t bg-background px-3 py-2.5 sm:justify-end sm:gap-0 sm:space-x-2 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 [padding-bottom:calc(0.5rem+env(safe-area-inset-bottom))] sm:[padding-bottom:0]">
              <Button type="button" variant="outline" className="flex-1 sm:flex-initial sm:w-auto" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                className="flex-1 sm:flex-initial sm:w-auto"
                onClick={() => {
                  console.log("✅ Create Account button clicked");
                  form.handleSubmit(handleSubmit)();
                }}
              >
                {initialData ? "Update Account" : "Create Account"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
