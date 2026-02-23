
export type UserRole =
  | 'superadmin'
  | 'admin'
  | 'editing_manager'
  | 'salesRep'
  | 'photographer'
  | 'editor'
  | 'client';

export type RepPayoutFrequency = 'weekly' | 'biweekly' | 'monthly';

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
  linkedAccounts?: LinkedAccount[];
  sharedData?: SharedData;
  totalShoots?: number;
  totalSpent?: number;
  linkedProperties?: PropertyData[];
}

export interface LinkedAccount {
  id: string;
  accountId: string;
  accountName: string;
  accountEmail: string;
  mainAccountId: string;
  mainAccountName: string;
  mainAccountEmail: string;
  sharedDetails: {
    shoots: boolean;
    invoices: boolean;
    clients: boolean;
    availability: boolean;
    settings: boolean;
    profile: boolean;
    documents: boolean;
  };
  linkedAt: string;
  status: 'active' | 'inactive' | 'suspended';
  notes?: string;
}

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
