
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
  medium?: string;
  medium_url?: string;
  web_url?: string;
  large?: string;
  large_url?: string;
  placeholder_url?: string;
  watermarked_storage_path?: string;
  watermarked_thumbnail_path?: string;
  watermarked_web_path?: string;
  watermarked_placeholder_path?: string;
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

export interface ShootServiceObject {
  id: string;
  name: string;
  price: number;
  quantity: number;
  photo_count?: number | null;
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
    company?: string;
    phone?: string;
    totalShoots: number;
    id?: string | number;
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
  };
  editor?: {
    id?: string | number;
    name: string;
    avatar?: string;
    email?: string;
  };
  editorId?: string;
  services: string[];
  serviceObjects?: ShootServiceObject[];
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
    totalQuote: number;
    totalPaid: number;  // Making this required
    paymentStatus?: 'paid' | 'unpaid' | 'partial' | null;
    lastPaymentDate?: string;
    lastPaymentType?: string;
  };
  isPrivateListing?: boolean;
  isFeatured?: boolean;
  is_featured?: boolean;
  listingType?: 'for_sale' | 'for_rent';
  listing_type?: 'for_sale' | 'for_rent';
  propertyStatus?: 'available' | 'sold' | 'rented';
  property_status?: 'available' | 'sold' | 'rented';
  status: string;
  workflowStatus?: string;
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
  iguideFloorplans?: Array<{ url?: string; filename?: string; [key: string]: unknown } | string>;
  iguidePropertyId?: string;
  iguideLastSyncedAt?: string;
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
