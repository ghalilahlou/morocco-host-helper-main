import { useState } from 'react';
import { DocumentStorageService } from '@/services/documentStorageService';
import { DocumentMetadata, UnifiedDocument } from '@/types/document';
import { Booking } from '@/types/booking';
import { useToast } from '@/hooks/use-toast';

export const useDocumentStorage = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [documents, setDocuments] = useState<UnifiedDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const uploadDocument = async (file: File, metadata: DocumentMetadata) => {
    setIsUploading(true);
    try {
      const result = await DocumentStorageService.storeDocument(file, metadata);

      if (result.success) {
        toast({
          title: "Document téléchargé",
          description: `${file.name} a été téléchargé avec succès`
        });
        return result.filePath ?? result.documentUrl;
      } else {
        toast({
          title: "Erreur",
          description: result.error ?? "Erreur lors du téléchargement",
          variant: "destructive"
        });
        return null;
      }
    } catch (_error) {
      toast({
        title: "Erreur",
        description: "Erreur lors du téléchargement du document",
        variant: "destructive"
      });
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const loadDocuments = async (booking: Booking) => {
    setIsLoading(true);
    try {
      const docs = await DocumentStorageService.getDocumentsForBooking(booking);
      setDocuments(docs);
      return docs;
    } catch (_error) {
      console.error('Error loading documents:', _error);
      toast({
        title: "Erreur",
        description: "Erreur lors du chargement des documents",
        variant: "destructive"
      });
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  return {
    uploadDocument,
    loadDocuments,
    documents,
    isUploading,
    isLoading
  };
};
