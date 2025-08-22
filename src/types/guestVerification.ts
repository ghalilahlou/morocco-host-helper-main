export interface PropertyVerificationToken {
  id: string;
  property_id: string;
  token: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface GuestSubmission {
  id: string;
  token_id: string;
  booking_data?: any;
  guest_data?: any;
  document_urls: string[];
  signature_data?: string;
  submitted_at?: string;
  status: 'pending' | 'completed' | 'reviewed' | 'rejected';
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface GuestVerificationFormData {
  checkInDate: string;
  checkOutDate: string;
  numberOfGuests: number;
  guests: Array<{
    fullName: string;
    dateOfBirth: string;
    nationality: string;
    documentNumber: string;
    documentType: 'passport' | 'national_id';
    placeOfBirth?: string;
  }>;
  signature?: string;
}