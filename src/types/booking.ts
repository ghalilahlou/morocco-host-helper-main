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
  checkInDate: string;        // ✅ DB: check_in_date
  checkOutDate: string;       // ✅ DB: check_out_date
  numberOfGuests: number;     // ✅ DB: number_of_guests
  bookingReference?: string;  // ✅ DB: booking_reference
  guests: Guest[];
  status: 'pending' | 'completed' | 'archived';
  createdAt: string;          // ✅ DB: created_at
  
  // ✅ CORRECTION : CamelCase cohérent partout
  propertyId?: string;        // ✅ DB: property_id (au lieu de property_id)
  property?: Property;
  source?: 'host' | 'guest' | 'airbnb'; // To differentiate booking source for signature handling
  submissionId?: string;      // ✅ DB: submission_id (au lieu de submission_id)
  documentsGenerated: {       // ✅ DB: documents_generated
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