export interface Guest {
  id: string;
  fullName: string;
  dateOfBirth: string;
  documentNumber: string;
  nationality: string;
  placeOfBirth?: string;
  documentType: 'passport' | 'national_id';
}

export interface Property {
  id: string;
  name: string;
  address?: string;
  property_type: string;
  max_occupancy: number;
  description?: string;
  contact_info?: any;
  house_rules: string[];
  contract_template: any;
  user_id: string;
  created_at: string;
  updated_at: string;
  airbnb_ics_url?: string;
  photo_url?: string;
}

export interface Booking {
  id: string;
  checkInDate: string;
  checkOutDate: string;
  numberOfGuests: number;
  bookingReference?: string;
  guests: Guest[];
  status: 'pending' | 'completed' | 'archived';
  createdAt: string;
  property_id?: string;
  property?: Property;
  source?: 'host' | 'guest' | 'airbnb'; // To differentiate booking source for signature handling
  submission_id?: string; // Link to guest submission data
  documentsGenerated: {
    policeForm: boolean;
    contract: boolean;
  };
}

export interface UploadedDocument {
  id: string;
  file: File;
  preview: string;
  extractedData?: Partial<Guest>;
  processingStatus: 'uploading' | 'processing' | 'completed' | 'error';
}