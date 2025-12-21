
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
  bracket_group?: number;
  sequence?: number;
  flag_reason?: string;
  metadata?: Record<string, unknown>;
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
    id?: string;
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
    id?: string;
    name: string;
    avatar?: string;
  };
  editor?: {
    id?: string;
    name: string;
    avatar?: string;
  };
  services: string[];
  payment: {
    baseQuote: number;
    taxRate: number;
    taxAmount: number;
    totalQuote: number;
    totalPaid: number;  // Making this required
    lastPaymentDate?: string;
    lastPaymentType?: string;
  };
  status: string;
  workflowStatus?: string;
  notes?: string | {
    shootNotes?: string;
    photographerNotes?: string;
    companyNotes?: string;
    editingNotes?: string;
  };
  adminIssueNotes?: string;
  isFlagged?: boolean;
  issuesResolvedAt?: string;
  issuesResolvedBy?: string;
  submittedForReviewAt?: string;
  createdBy: string;
  completedDate?: string;
  package?: ShootPackageInfo;
  bracketMode?: BracketMode;
  expectedFinalCount?: number;
  expectedRawCount?: number;
  rawPhotoCount?: number;
  editedPhotoCount?: number;
  extraPhotoCount?: number;
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
    cubicasa?: string;
    branded?: string;
    mls?: string;
    genericMls?: string;
  };
  files?: ShootFileData[];
  tourPurchased?: boolean; // Add this field for ImportShootsDialog
  propertyDetails?: {
    presenceOption?: 'self' | 'other' | 'lockbox';
    lockboxCode?: string;
    lockboxLocation?: string;
    accessContactName?: string;
    accessContactPhone?: string;
    [key: string]: unknown;
  };
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
    photographer?: string | null;
    company?: string | null;
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
