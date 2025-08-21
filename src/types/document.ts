export interface UnifiedDocument {
  id: string;
  fileName: string;
  url: string;
  guestName?: string;
  bookingId: string;
  createdAt: string;
}

export interface DocumentStorageResult {
  success: boolean;
  documentUrl?: string;
  filePath?: string; // Added to support returning file path instead of public URL
  error?: string;
}

export interface DocumentMetadata {
  bookingId: string;
  fileName: string;
  extractedData?: Record<string, unknown>;
  guestId?: string;
}
