
export type BracketMode = 3 | 5 | null;

export interface ShootPackageInfo {
  name?: string;
  expectedDeliveredCount?: number;
  bracketMode?: BracketMode;
  servicesIncluded?: string[];
  notes?: string;
}

export interface ShootMediaSummary {
  rawUploaded?: number;
  editedUploaded?: number;
  extraUploaded?: number;
  flagged?: number;
  favorites?: number;
  delivered?: number;
}

export interface ShootWeatherSummary {
  summary?: string;
  icon?: string;
  temperature?: string;
}

export interface ShootAction {
  label: string;
  action:
    | 'pay'
    | 'view_media'
    | 'upload_raw'
    | 'upload_final'
    | 'open_workflow'
    | 'assign_editor'
    | 'start_editing';
  href?: string;
  disabled?: boolean;
}

export interface ShootFileData {
  id: string;
  shoot_id?: string | number;
  shoot_service_id?: string | number | null;
  shootServiceId?: string | number | null;
  filename: string;
  stored_filename?: string;
  storedFilename?: string;
  path?: string;
  url?: string;
  original?: string;
  original_url?: string;
  file_type?: string;
  fileType?: string;
  file_size?: number;
  fileSize?: number;
  formattedSize?: string;
  workflow_stage?: string;
  workflowStage?: string;
  uploaded_by?: string | number;
  uploadedBy?: string;
  is_cover?: boolean;
  isCover?: boolean;
  is_favorite?: boolean;
  favorite?: boolean;
  is_hidden?: boolean;
  bracket_group?: number;
  sequence?: number;
  flag_reason?: string;
  metadata?: Record<string, unknown>;
  media_type?: string;
  processed_at?: string;
  thumbnail_path?: string;
  web_path?: string;
  placeholder_path?: string;
  thumb?: string;
  thumb_url?: string;
  thumbnail_url?: string;
  /** Tuned 600px rendition (600x400 on a 3:2 frame, Q85, Lanczos + unsharp) used by cards and grids. */
  grid_url?: string;
  grid_path?: string;
  medium?: string;
  medium_url?: string;
  web_url?: string;
  large?: string;
  large_url?: string;
  placeholder_url?: string;
  preview_images?: string[];
  previewImages?: string[];
  watermarked_storage_path?: string;
  watermarked_thumbnail_path?: string;
  watermarked_web_path?: string;
  watermarked_placeholder_path?: string;
  uses_watermark?: boolean;
  processing_failed_at?: string;
  processing_error?: string;
  comments?: Array<{
    author?: string | null;
    comment: string;
    timestamp?: string | null;
  }>;
  comment_count?: number;
  latest_comment?: {
    author?: string | null;
    comment: string;
    timestamp?: string | null;
  } | null;
}

export interface ShootMediaPayload {
  images?: Array<{
    id: string;
    url: string;
    thumbnail?: string;
    type: string;
    approved?: boolean;
    favorite?: boolean;
    isCover?: boolean;
    flagReason?: string;
    sequence?: number;
  }>;
  extra?: Array<{
    id: string;
    url: string;
    thumbnail?: string;
    name: string;
    size: number;
  }>;
  videos?: Array<{
    id: string;
    url: string;
    thumbnail?: string;
    type: string;
    approved?: boolean;
  }>;
  files?: Array<{
    id: string;
    url: string;
    name: string;
    type: string;
    size: number;
  }>;
  photos?: Array<string>; // Legacy format for backward compatibility
  slideshows?: Array<{
    id: string;
    title: string;
    url: string;
  }>;
}

export interface ShootServicePhotographer {
  id?: string | number;
  name: string;
  avatar?: string;
  email?: string;
  phone?: string;
}

export interface ShootServiceEditor {
  id?: string | number;
  name: string;
  avatar?: string;
  email?: string;
}

export interface ShootGhostUser {
  id: string;
  name: string;
  email?: string;
  company?: string;
}

export interface ShootRealtorClient {
  id: string;
  name: string;
  email?: string;
  company?: string;
}

export interface ShootUserSummary {
  id?: string | number;
  name: string;
  avatar?: string;
  email?: string;
  phone?: string;
}

export interface ShootServiceObject {
  id: string;
  invoice_id?: string | number | null;
  invoiceId?: string | number | null;
  invoice_item_id?: string | number | null;
  invoiceItemId?: string | number | null;
  source?: string;
  is_invoice_adjustment?: boolean;
  isInvoiceAdjustment?: boolean;
  service_id?: string | null;
  serviceId?: string | number | null;
  shoot_service_id?: string | null;
  shootServiceId?: string | number | null;
  name: string;
  price: number;
  unit_amount?: number;
  unitAmount?: number;
  quantity: number;
  subtotal?: number;
  total_amount?: number;
  totalAmount?: number;
  bills_client?: boolean;
  billsClient?: boolean;
  charge_type?: string;
  chargeType?: string;
  photo_count?: number | null;
  /**
   * Which upload lane this service can receive (`services.upload_intake_type`):
   * `photo`, `video`, `photo_video`, or `none`. Capability data — a bookable
   * service is not automatically an upload target, and this is never inferred
   * from the service name or category.
   */
  upload_intake_type?: string | null;
  uploadIntakeType?: string | null;
  supports_photo_intake?: boolean | number | string | null;
  supportsPhotoIntake?: boolean | number | string | null;
  supports_video_intake?: boolean | number | string | null;
  supportsVideoIntake?: boolean | number | string | null;
  /**
   * True when this item owes photos but no contracted count is configured. The UI
   * must render that as unset rather than fabricating a denominator.
   */
  expected_raw_unspecified?: boolean | number | string | null;
  expectedRawUnspecified?: boolean | number | string | null;
  /**
   * Whether this deliverable is captured as multi-exposure bracket stacks
   * (`services.uses_hdr_brackets`). Catalogue data, not inferred from the name.
   */
  uses_hdr_brackets?: boolean | number | string | null;
  usesHdrBrackets?: boolean | number | string | null;
  /** The size recorded for this service on this shoot, if any. */
  bracket_mode?: number | string | null;
  bracketMode?: number | string | null;
  /**
   * The size stacking will actually use: the recorded value, else the assigned
   * photographer's preference, else 5. Null when the service does not bracket.
   */
  effective_bracket_mode?: number | string | null;
  effectiveBracketMode?: number | string | null;
  pricing_type?: 'fixed' | 'variable';
  sqft_ranges?: Array<{
    id?: number;
    sqft_from: number;
    sqft_to: number;
    duration: number | null;
    price: number;
    photographer_pay: number | null;
    photo_count?: number | null;
  }>;
  category?: { id: string; name: string } | null;
  photographer_pay?: number | null;
  photographer_id?: string | null;
  resolved_photographer_id?: string | null;
  photographer?: ShootServicePhotographer | null;
  editor_id?: string | null;
  resolved_editor_id?: string | null;
  editor?: ShootServiceEditor | null;
  requires_editing?: boolean | null;
  requiresEditing?: boolean | null;
  editing_completed_at?: string | null;
  scheduled_at?: string | null;
  scheduledAt?: string | null;
  workflow_status?: string | null;
  workflowStatus?: string | null;
  delivery_status?: string | null;
  deliveryStatus?: string | null;
  ready_at?: string | null;
  readyAt?: string | null;
  delivered_at?: string | null;
  deliveredAt?: string | null;
  is_deliverable?: boolean;
  isDeliverable?: boolean;
  paid_amount?: number;
  paidAmount?: number;
  balance_due?: number;
  balanceDue?: number;
  payment_status?: 'unpaid' | 'partially_paid' | 'paid' | string;
  paymentStatus?: 'unpaid' | 'partially_paid' | 'paid' | string;
  force_unlock_delivery?: boolean;
  forceUnlockDelivery?: boolean;
  is_unlocked_for_delivery?: boolean;
  isUnlockedForDelivery?: boolean;
  unlock_state?: string;
  unlockState?: string;
  lane?: string | null;
  category_key?: string | null;
}

export interface ShootEditorAssignment {
  lane: string;
  label?: string;
  editorId?: string | null;
  editor?: ShootServiceEditor | null;
  serviceIds?: string[];
  serviceNames?: string[];
  ready?: boolean;
  readyAt?: string | null;
}

export type ShootTourLinkValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | ShootRealtorClient
  | Record<string, unknown>
  | unknown[];

export interface PendingPaymentIntent {
  id: number;
  amount: number;
  currency: string;
  paymentMethod: 'cash' | 'check' | string;
  status: string;
  createdAt?: string | null;
  submittedByName?: string | null;
  submittedByRole?: string | null;
  checkNumber?: string | null;
  paymentDate?: string | null;
  notes?: string | null;
}

export interface ShootData {
  id: string;
  scheduledDate: string;
  time: string;  // Required field
  propertySlug?: string;
  dropboxPaths?: {
    rawFolder?: string | null;
    extraFolder?: string | null;
    editedFolder?: string | null;
    archiveFolder?: string | null;
  };
  client: {
    name: string;
    email: string;
    emailVerified?: boolean;
    email_verified?: boolean;
    company?: string;
    phone?: string;
    totalShoots: number;
    id?: string | number;
    rep?: ShootUserSummary | null;
  };
  location: {
    address: string;
    address2?: string;
    city: string;
    state: string;
    zip: string;
    fullAddress: string;
    latitude?: number;
    longitude?: number;
  };
  photographer: {
    id?: string | number;
    name: string;
    avatar?: string;
    email?: string;
    phone?: string;
  };
  editor?: {
    id?: string | number;
    name: string;
    avatar?: string;
    email?: string;
  };
  rep?: ShootUserSummary | null;
  editorId?: string;
  services: string[];
  serviceObjects?: ShootServiceObject[];
  serviceItems?: ShootServiceObject[];
  service_items?: ShootServiceObject[];
  editorAssignments?: ShootEditorAssignment[];
  paymentStatus?: 'paid' | 'unpaid' | 'partial' | 'partially_paid' | string | null;
  payment_status?: 'paid' | 'unpaid' | 'partial' | 'partially_paid' | string | null;
  bypassPaywall?: boolean;
  bypass_paywall?: boolean;
  payment: {
    serviceSubtotal?: number;
    baseQuote: number;
    discountType?: 'fixed' | 'percent' | 'percentage' | null;
    discountValue?: number | null;
    discountAmount?: number;
    discountedSubtotal?: number;
    taxRate: number;
    taxPercent?: number;
    taxAmount: number;
    invoiceAdjustmentsTotal?: number;
    orderTotal?: number;
    totalQuote: number;
    totalPaid: number;  // Making this required
    paymentStatus?: 'paid' | 'unpaid' | 'partial' | null;
    lastPaymentDate?: string;
    lastPaymentType?: string;
    originalServiceSubtotal?: number;
    cancellationFee?: number;
    isCancellationFeeOnly?: boolean;
    pendingPayments?: PendingPaymentIntent[];
    pendingTotal?: number;
  };
  isPrivateListing?: boolean;
  isFeatured?: boolean;
  is_featured?: boolean;
  featuredPending?: boolean;
  featured_pending?: boolean;
  featuredStatus?: 'none' | 'pending' | 'featured' | string;
  featured_status?: 'none' | 'pending' | 'featured' | string;
  featuredRequestedAt?: string | null;
  featured_requested_at?: string | null;
  featuredRequestedBy?: number | string | null;
  featured_requested_by?: number | string | null;
  featuredApprovedAt?: string | null;
  featured_approved_at?: string | null;
  featuredApprovedBy?: number | string | null;
  featured_approved_by?: number | string | null;
  featured_homepage_title?: string | null;
  featuredHomepageTitle?: string | null;
  featured_homepage_location?: string | null;
  featuredHomepageLocation?: string | null;
  featured_homepage_subtitle?: string | null;
  featuredHomepageSubtitle?: string | null;
  featured_homepage_cta_label?: string | null;
  featuredHomepageCtaLabel?: string | null;
  featured_homepage_cta_href?: string | null;
  featuredHomepageCtaHref?: string | null;
  featured_homepage_images?: Array<{
    id?: number;
    shoot_file_id?: number | string;
    sort?: number;
    alt?: string | null;
    focal?: string | null;
  }>;
  featuredHomepageImages?: Array<{
    id?: number;
    shootFileId?: number | string;
    sort?: number;
    alt?: string | null;
    focal?: string | null;
  }>;
  timezone?: string | null;
  mlsImageWidth?: number | null;
  mls_image_width?: number | null;
  listingType?: 'for_sale' | 'for_rent';
  listing_type?: 'for_sale' | 'for_rent';
  propertyStatus?: 'available' | 'coming_soon' | 'pending' | 'sold' | 'rented';
  property_status?: 'available' | 'coming_soon' | 'pending' | 'sold' | 'rented';
  status: string;
  /**
   * Internal shoot classification (e.g. 'standard', 'internal_test'). Surfaced so the
   * Schedule_View can mark a Test_Shoot apart from real bookings (Req 10.10).
   */
  shootType?: string;
  workflowStatus?: string;
  deliveryStatus?: string;
  notes?: string | {
    shootNotes?: string;
    approvalNotes?: string;
    photographerNotes?: string;
    companyNotes?: string;
    editingNotes?: string;
  };
  adminIssueNotes?: string;
  isFlagged?: boolean;
  issuesResolvedAt?: string;
  issuesResolvedBy?: string;
  submittedForReviewAt?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  completedDate?: string;
  package?: ShootPackageInfo;
  package_details?: ShootPackageInfo;
  bracketMode?: BracketMode;
  baseQuote?: number;
  totalQuote?: number;
  totalPaid?: number;
  taxAmount?: number;
  expectedFinalCount?: number;
  expectedRawCount?: number;
  rawPhotoCount?: number;
  editedPhotoCount?: number;
  extraPhotoCount?: number;
  totalPhotographerPay?: number;
  photographerPay?: number;
  taxPercent?: number;
  tax_percent?: number;
  rawMissingCount?: number;
  editedMissingCount?: number;
  missingRaw?: boolean;
  missingFinal?: boolean;
  canSubmitRaw?: boolean;
  canSubmitEdits?: boolean;
  canApproveEditingReview?: boolean;
  canViewInvoice?: boolean;
  can_submit_raw?: boolean;
  can_submit_edits?: boolean;
  can_approve_editing_review?: boolean;
  can_view_invoice?: boolean;
  mediaSummary?: ShootMediaSummary;
  bracketNotes?: string;
  heroImage?: string;
  weather?: ShootWeatherSummary;
  primaryAction?: ShootAction;
  secondaryActions?: ShootAction[];
  media?: ShootMediaPayload;
  tourLinks?: {
    matterport?: string;
    iGuide?: string;
    matterport_branded?: string;
    matterport_mls?: string;
    iguide_branded?: string;
    iguide_mls?: string;
    branded?: string;
    mls?: string;
    genericMls?: string;
    video_link?: string;
    video_branded?: string;
    video_mls?: string;
    video_generic?: string;
    tour_style?: string;
    realtor_client_id?: string | number | null;
    realtor_client?: ShootRealtorClient | null;
    [key: string]: ShootTourLinkValue;
  };
  iguideTourUrl?: string;
  iguide_tour_url?: string;
  iguideFloorplans?: Array<{ url?: string; filename?: string; [key: string]: unknown } | string>;
  iguide_floorplans?: Array<{ url?: string; filename?: string; [key: string]: unknown } | string>;
  iguidePropertyId?: string;
  iguide_property_id?: string;
  iguideWorkOrderId?: string;
  iguide_work_order_id?: string;
  iguideLastSyncedAt?: string;
  iguide_last_synced_at?: string;
  iguideData?: Record<string, unknown> | null;
  iguide_data?: Record<string, unknown> | null;
  cubicasaTourUrl?: string;
  cubicasa_tour_url?: string;
  cubicasaFloorplans?: Array<{ url?: string; filename?: string; [key: string]: unknown } | string>;
  cubicasa_floorplans?: Array<{ url?: string; filename?: string; [key: string]: unknown } | string>;
  cubicasaData?: Record<string, unknown> | null;
  cubicasa_data?: Record<string, unknown> | null;
  cubicasaStatus?: string;
  cubicasa_status?: string;
  cubicasaProductType?: string;
  cubicasa_product_type?: string;
  cubicasaOrderId?: string | number;
  cubicasa_order_id?: string | number;
  cubicasaExternalId?: string | number;
  cubicasa_external_id?: string | number;
  cubicasaLastSyncedAt?: string;
  cubicasa_last_synced_at?: string;
  files?: ShootFileData[];
  tourPurchased?: boolean; // Add this field for ImportShootsDialog
  propertyDetails?: {
    presenceOption?: 'self' | 'other' | 'lockbox';
    lockboxCode?: string;
    lockboxLocation?: string;
    accessContactName?: string;
    accessContactPhone?: string;
    bedrooms?: string | number | null;
    bathrooms?: string | number | null;
    sqft?: string | number | null;
    beds?: string | number | null;
    baths?: string | number | null;
    squareFeet?: string | number | null;
    square_feet?: string | number | null;
    price?: string | number | null;
    mls_id?: string | number | null;
    lot_size?: string | number | null;
    year_built?: string | number | null;
    [key: string]: unknown;
  };
  property_details?: ShootData['propertyDetails'];
  extraData?: Record<string, unknown>;
  cancellationRequestedAt?: string;
  cancellationReason?: string;
  holdRequestedAt?: string;
  holdRequestedBy?: string | number;
  holdReason?: string;
  holdStatus?: string;
  mmmStatus?: string;
  mmmOrderNumber?: string;
  mmmBuyerCookie?: string;
  mmmRedirectUrl?: string;
  mmmLastPunchoutAt?: string;
  mmmLastOrderAt?: string;
  mmmLastError?: string;
  ghostUsers?: ShootGhostUser[];
  ghostUserIds?: string[];
  isGhostVisibleForUser?: boolean;
  realtorClient?: ShootRealtorClient | null;
  // External booking sync (mapped from the external site). All nullable for
  // backward compatibility - only populated for shoots that originated from the
  // external booking flow.
  alternate_scheduled_date?: string | null;
  alternate_time?: string | null;
  alternate_scheduled_at?: string | null;
  requested_photographers?: Array<number | string | Record<string, unknown>> | null;
  external_booking_payload?: Record<string, unknown> | null;
  external_booking_warnings?: string[] | null;
  external_booking_mapping_status?: string | null;
}

export interface ShootHistoryFinancials {
  baseQuote: number;
  taxPercent: number;
  taxAmount: number;
  totalQuote: number;
  totalPaid: number;
  lastPaymentDate?: string | null;
  lastPaymentType?: string | null;
}

export interface ShootHistoryRecord {
  id: number;
  scheduledDate?: string | null;
  completedDate?: string | null;
  status?: string | null;
  mls_id?: string | number | null;
  listing_source?: string | null;
  listingSource?: string | null;
  bright_mls_publish_status?: string | null;
  client: {
    id?: number | null;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    company?: string | null;
    totalShoots?: number;
  };
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
    full: string;
  };
  photographer: {
    id?: number | null;
    name?: string | null;
  };
  services: string[];
  financials: ShootHistoryFinancials;
  tourPurchased: boolean;
  notes: {
    shoot?: string | null;
    approval?: string | null;
    photographer?: string | null;
    company?: string | null;
    editing?: string | null;
    approvalNotes?: string | null;
    editingNotes?: string | null;
  };
  userCreatedBy?: string | null;
}

export interface ShootHistoryServiceAggregate {
  serviceId: number;
  serviceName: string;
  shootCount: number;
  baseQuoteTotal: number;
  taxTotal: number;
  totalQuote: number;
  totalPaid: number;
}

export interface ShootHistoryFiltersMeta {
  clients: Array<{ id?: number | null; name?: string | null }>;
  photographers: Array<{ id?: number | null; name?: string | null }>;
  services: string[];
}

// Update the PhotographerAvailability interface to include the required properties
export interface PhotographerAvailability {
  id: string;
  photographerId: string;
  photographerName?: string; // Add this field for compatibility
  date: string;
  timeSlots: {
    start: string;
    end: string;
    booked: boolean;
  }[];
  startTime?: string; // Add for backward compatibility
  endTime?: string;   // Add for backward compatibility
}
