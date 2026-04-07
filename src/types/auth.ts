
import type { ServiceGroupSummary } from '@/types/serviceGroups';

export type UserRole =
  | 'superadmin'
  | 'admin'
  | 'editing_manager'
  | 'salesRep'
  | 'photographer'
  | 'editor'
  | 'client';

export type RepPayoutFrequency = 'weekly' | 'biweekly' | 'monthly';
export type ClientDiscountType = 'fixed' | 'percent' | null;
export type AccountLinkStatus = 'active' | 'inactive' | 'suspended';

export interface SharedDetails {
  shoots: boolean;
  invoices: boolean;
  clients: boolean;
  availability: boolean;
  settings: boolean;
  profile: boolean;
  documents: boolean;
}

export interface AddressInfo {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
}

export interface RepDetails {
  homeAddress?: AddressInfo;
  commissionPercentage?: number;
  salesCategories?: string[];
  payoutEmail?: string;
  payoutFrequency?: RepPayoutFrequency;
  autoApprovePayouts?: boolean;
  smsEnabled?: boolean;
  approvalEmail?: string;
  lastPayoutReportSent?: string;
  notes?: string;
}

export interface UserMetadata {
  accountRepId?: string;
  accountRep?: string;
  repDetails?: RepDetails;
  [key: string]: any;
}

export interface UserData {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email: string;
  role: UserRole;
  avatar?: string;
  gender?: 'male' | 'female' | 'unknown';
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipcode?: string;
  timezone?: string;
  company?: string;
  companyNotes?: string;
  bio?: string;
  about?: string;
  username?: string;
  facebookUrl?: string;
  twitterUrl?: string;
  linkedinUrl?: string;
  pinterestUrl?: string;
  lastLogin?: string;
  createdAt?: string;
  isActive?: boolean;
  metadata?: UserMetadata;
  session?: AuthSession;
  // Account linking properties
  linkedAccounts?: LinkedAccountSummary[];
  sharedData?: SharedData;
  totalShoots?: number;
  totalSpent?: number;
  linkedProperties?: PropertyData[];
  service_groups?: ServiceGroupSummary[];
  service_group_ids?: string[];
  shootCcEmails?: string[];
  shoot_cc_emails?: string[];
  clientDiscountType?: ClientDiscountType;
  client_discount_type?: ClientDiscountType;
  clientDiscountValue?: number | null;
  client_discount_value?: number | null;
}

export interface AccountLinkRecord {
  id: string;
  accountId: string;
  accountName: string;
  accountEmail: string;
  accountRole?: UserRole | null;
  accountAvatar?: string | null;
  accountStatus?: string | null;
  mainAccountId: string;
  mainAccountName: string;
  mainAccountEmail: string;
  mainAccountRole?: UserRole | null;
  mainAccountAvatar?: string | null;
  mainAccountStatus?: string | null;
  sharedDetails: SharedDetails;
  linkedAt?: string | null;
  unlinkedAt?: string | null;
  status: AccountLinkStatus;
  notes?: string;
}

export interface LinkedAccountSummary {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string | null;
  status?: AccountLinkStatus;
  sharedDetails: SharedDetails;
  linkedAt?: string | null;
  linkId?: string | number;
}

export interface LinkedOwnerSummary {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string | null;
  accountStatus?: string | null;
  status?: AccountLinkStatus;
  sharedDetails: SharedDetails;
  linkedAt?: string | null;
  linkId?: string | number;
  linkDirection?: 'incoming' | 'outgoing';
}

export type LinkedAccount = AccountLinkRecord;

export interface SharedData {
  totalShoots: number;
  totalSpent: number;
  properties: PropertyData[];
  paymentHistory: PaymentData[];
  lastActivity: string | null;
  communicationHistory: {
    emails: any[];
    sms: any[];
    calls: any[];
    notes: any[];
  };
}

export interface PropertyData {
  id: string | null;
  address: string;
  city: string;
  state: string;
  shootCount: number;
}

export interface PaymentData {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  shoot?: {
    id: string;
    address: string;
  };
}

export interface ClientSharedShoot {
  id: string;
  address: string;
  city?: string | null;
  state?: string | null;
  scheduledDate?: string | null;
  status?: string | null;
  heroImage?: string | null;
}

export interface ClientSharedOwnerData {
  totalShoots: number;
  totalSpent: number;
  properties: PropertyData[];
  paymentHistory: PaymentData[];
  lastActivity: string | null;
  sharedShoots: ClientSharedShoot[];
}

export interface LinkedSharedVisibilityResponse {
  hasLinkedAccounts: boolean;
  linkedAccounts: LinkedOwnerSummary[];
}

export interface ClientSharedDataResponse {
  owner: LinkedOwnerSummary;
  link: AccountLinkRecord;
  sharedData: ClientSharedOwnerData;
}

export interface AuthSession {
  accessToken: string;
  refreshToken?: string | null;
  tokenType?: string;
  expiresIn?: number | null;
  expiresAt?: number | null;
  issuedAt?: number | null;
  user: {
    id: string;
    email?: string;
    role?: UserRole;
    metadata?: UserMetadata;
    createdAt?: string;
  };
}
