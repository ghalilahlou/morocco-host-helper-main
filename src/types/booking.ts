export interface Guest {
  id: string;
  fullName: string;
  dateOfBirth: string;
  documentNumber: string;
  nationality: string;
  placeOfBirth?: string;
  documentType: 'passport' | 'national_id';
  profession?: string;
  motifSejour?: string;
  adressePersonnelle?: string;
  email?: string; // Champ email optionnel pour l'envoi du contrat
}

export interface Property {
  id: string;
  name: string;
  address?: string;
  property_type?: string;
  max_occupancy?: number;
  description?: string;
  photo_url?: string;
  house_rules?: string[];
  contract_template?: any;
  created_at?: string;
  updated_at?: string;
  user_id?: string;
}

export interface Booking {
  id: string;
  property_id?: string;
  checkInDate: string;
  checkOutDate: string;
  numberOfGuests: number;
  bookingReference?: string;
  status: 'pending' | 'completed' | 'archived';
  documentsGenerated?: {
    policeForm: boolean;
    contract: boolean;
  };
  guests: Guest[];
  property?: Property;
  created_at?: string;
  updated_at?: string;
  user_id?: string;
}

export interface UploadedDocument {
  id: string;
  file: File;
  preview: string;
  extractedData?: Partial<Guest>;
  processingStatus: 'uploading' | 'processing' | 'completed' | 'error';
}