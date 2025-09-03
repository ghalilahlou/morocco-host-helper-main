// Common types to replace 'any' usage throughout the application

export interface ApiResponse<T = unknown> {
  data: T | null;
  error: string | null;
  success: boolean;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  count: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface SupabaseError {
  message: string;
  details?: string;
  hint?: string;
  code?: string;
}

export interface FileUpload {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  uploadedAt: string;
}

export interface SignatureData {
  signatureUrl: string;
  signedAt: string;
  signedBy: string;
}

export interface DocumentData {
  id: string;
  type: 'passport' | 'national_id' | 'other';
  url: string;
  extractedData?: Record<string, unknown>;
  uploadedAt: string;
}

export interface GuestSubmissionData {
  id: string;
  tokenId: string;
  guestData: GuestData[];
  documentUrls: string[];
  submittedAt: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface GuestData {
  fullName: string;
  dateOfBirth: string;
  nationality: string;
  documentNumber: string;
  documentType: 'passport' | 'national_id';
  placeOfBirth?: string;
  profession?: string;
  motifSejour?: string;
  adressePersonnelle?: string;
}

export interface ContractTemplate {
  landlordName: string;
  landlordStatus: 'particulier' | 'entreprise';
  landlordCompany?: string;
  propertyAddress: string;
  propertyType: string;
  houseRules: string[];
  additionalTerms?: string;
}

export interface BookingStatus {
  status: 'pending' | 'completed' | 'archived';
  processingStatus: 'uploading' | 'processing' | 'completed' | 'error';
  documentsGenerated: {
    policeForm: boolean;
    contract: boolean;
  };
}

export interface AirbnbReservationData {
  airbnbBookingId: string;
  guestName: string | null;
  startDate: string;
  endDate: string;
  summary: string;
  description: string | null;
  numberOfGuests: number | null;
  rawEventData: Record<string, unknown> | null;
}

export interface SyncStatus {
  id: string;
  propertyId: string;
  syncStatus: 'idle' | 'syncing' | 'completed' | 'error';
  lastSyncAt: string | null;
  lastError: string | null;
  reservationsCount: number | null;
}

export interface PropertyVerificationToken {
  id: string;
  propertyId: string;
  bookingId?: string;
  token: string;
  expiresAt: string;
  createdAt: string;
  isUsed: boolean;
}

// Utility types
export type NonNullableFields<T> = {
  [P in keyof T]: NonNullable<T[P]>;
};

export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;
