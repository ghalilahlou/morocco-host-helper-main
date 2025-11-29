import { useState, useEffect, useCallback, useRef } from 'react';
import { Upload, FileText, Loader2, Check, X, Eye, Trash2, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { SafeSelect, SafeSelectContent, SafeSelectItem, SafeSelectTrigger, SafeSelectValue } from '@/components/ui/safe-select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { SimpleModal, SimpleModalHeader, SimpleModalTitle, SimpleModalDescription } from '@/components/ui/simple-modal';
import { useToast } from '@/hooks/use-toast';
import { Guest, UploadedDocument } from '@/types/booking';
import { v4 as uuidv4 } from 'uuid';

// ExtendedUploadedDocument uses UploadedDocument but allows processing status to be more specific
type ExtendedUploadedDocument = Omit<UploadedDocument, 'processingStatus'> & {
  processingStatus: 'processing' | 'completed' | 'error';
  extractedData?: {
    fullName?: string;
    dateOfBirth?: string;
    documentNumber?: string;
    nationality?: string;
    placeOfBirth?: string;
    documentType?: 'passport' | 'national_id';
  };
};

interface GuestEditDialogProps {
  guest: Guest | null;
  open: boolean;
  onSave: (guest: Guest) => void;
  onClose: () => void;
  uploadedDocuments?: UploadedDocument[];
  onDocumentsUpdate?: (documents: UploadedDocument[]) => void;
}

export const GuestEditDialog = ({
  guest,
  open,
  onSave,
  onClose,
  uploadedDocuments = [],
  onDocumentsUpdate
}: GuestEditDialogProps) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState<Guest | null>(null);
  const [localDocuments, setLocalDocuments] = useState<ExtendedUploadedDocument[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPreview, setShowPreview] = useState<string | null>(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const isMountedRef = useRef(true);
  const processingRef = useRef(false);

  // Initialize form data when guest changes
  useEffect(() => {
    if (guest) {
      setFormData({ ...guest });
    }
  }, [guest]);

  // Initialize local documents from props
  useEffect(() => {
    if (open && uploadedDocuments) {
      const extendedDocs: ExtendedUploadedDocument[] = uploadedDocuments.map(doc => ({
        ...doc,
        processingStatus: (doc.processingStatus === 'processing' || doc.processingStatus === 'completed' || doc.processingStatus === 'error') 
          ? doc.processingStatus 
          : 'completed' as const
      }));
      setLocalDocuments(extendedDocs);
    }
  }, [open, uploadedDocuments]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Revoke all object URLs on cleanup
      localDocuments.forEach(doc => {
        if (doc.preview) {
          URL.revokeObjectURL(doc.preview);
        }
      });
    };
  }, []);

  // Handle file upload
  const handleFileUpload = useCallback(async (files: FileList) => {
    if (processingRef.current) {
      toast({
        title: "Traitement en cours",
        description: "Veuillez attendre la fin du traitement en cours.",
        variant: "default"
      });
      return;
    }

    processingRef.current = true;
    setIsProcessing(true);

    const newDocs: ExtendedUploadedDocument[] = [];

    // Validate and create document objects
    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Validate MIME type (jpeg, png, gif only)
      if (!file.type.match(/^image\/(jpeg|jpg|png|gif)$/i)) {
        toast({
          title: "Format non supporté",
          description: `Le fichier ${file.name} n'est pas une image valide (JPG, PNG, GIF uniquement).`,
          variant: "destructive"
        });
        continue;
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "Fichier trop volumineux",
          description: `Le fichier ${file.name} dépasse 10MB.`,
          variant: "destructive"
        });
        continue;
      }

      try {
        const preview = URL.createObjectURL(file);
        const doc: ExtendedUploadedDocument = {
          id: uuidv4(),
          file,
          preview,
          processingStatus: 'processing'
        };
        newDocs.push(doc);
      } catch (error) {
        console.error('Error creating document:', error);
        toast({
          title: "Erreur",
          description: `Impossible de charger ${file.name}`,
          variant: "destructive"
        });
      }
    }

    if (newDocs.length === 0) {
      setIsProcessing(false);
      processingRef.current = false;
      return;
    }

    // Add documents to local state
    setLocalDocuments(prev => [...prev, ...newDocs]);

    // Process OCR for each document
    for (const doc of newDocs) {
      if (!isMountedRef.current) {
        // Cleanup if component unmounted
        URL.revokeObjectURL(doc.preview);
        break;
      }

      try {
        let extractedData;

        // Try OpenAI Vision API first
        try {
          const { OpenAIDocumentService } = await import('@/services/openaiDocumentService');
          extractedData = await OpenAIDocumentService.extractDocumentData(doc.file);
        } catch (openAiError) {
          console.warn('OpenAI Vision failed, using AI OCR fallback:', openAiError);
          
          // Fallback to AI OCR
          const { AILocrService } = await import('@/services/aiOcrService');
          const extractedText = await AILocrService.extractTextFromImage(doc.file);
          extractedData = await AILocrService.parseGuestInfo(extractedText);
        }

        if (!isMountedRef.current) break;

        // Update document with extracted data
        setLocalDocuments(prev => prev.map(d =>
          d.id === doc.id
            ? { ...d, extractedData, processingStatus: 'completed' as const }
            : d
        ));

        // Auto-fill form if data extracted and form is empty
        if (extractedData?.fullName && formData) {
          setFormData(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              fullName: prev.fullName || extractedData.fullName || '',
              dateOfBirth: prev.dateOfBirth || extractedData.dateOfBirth || '',
              documentNumber: prev.documentNumber || extractedData.documentNumber || '',
              nationality: prev.nationality || extractedData.nationality || '',
              placeOfBirth: prev.placeOfBirth || extractedData.placeOfBirth || '',
              documentType: prev.documentType || extractedData.documentType || 'passport'
            };
          });
        }

      } catch (error) {
        console.error(`Error processing ${doc.file.name}:`, error);
        
        if (!isMountedRef.current) break;

        setLocalDocuments(prev => prev.map(d =>
          d.id === doc.id
            ? { ...d, processingStatus: 'error' as const }
            : d
        ));

        toast({
          title: "Erreur d'extraction",
          description: `Impossible d'extraire les données de ${doc.file.name}`,
          variant: "destructive"
        });
      }
    }

    setIsProcessing(false);
    processingRef.current = false;
  }, [formData, toast]);

  // Handle file input change
  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      handleFileUpload(e.target.files);
    }
    // Reset input
    e.target.value = '';
  }, [handleFileUpload]);

  // Remove document
  const removeDocument = useCallback((docId: string) => {
    setLocalDocuments(prev => {
      const docToRemove = prev.find(d => d.id === docId);
      if (docToRemove?.preview) {
        URL.revokeObjectURL(docToRemove.preview);
      }
      return prev.filter(d => d.id !== docId);
    });
  }, []);

  // Show preview
  const showDocumentPreview = useCallback((preview: string) => {
    if (preview) {
      setShowPreview(preview);
      setPreviewModalOpen(true);
    }
  }, []);

  // Handle save
  const handleSave = useCallback(() => {
    if (!formData || !formData.fullName.trim()) {
      toast({
        title: "Nom requis",
        description: "Le nom complet est obligatoire.",
        variant: "destructive"
      });
      return;
    }

    // Update documents if callback provided
    if (onDocumentsUpdate) {
      const baseDocuments: UploadedDocument[] = localDocuments.map(({ processingStatus, extractedData, createdGuestId, ...doc }) => doc);
      onDocumentsUpdate(baseDocuments);
    }

    onSave(formData);
  }, [formData, localDocuments, onSave, onDocumentsUpdate, toast]);

  // Handle close
  const handleClose = useCallback(() => {
    if (processingRef.current) {
      toast({
        title: "Traitement en cours",
        description: "Veuillez attendre la fin du traitement avant de fermer.",
        variant: "default"
      });
      return;
    }
    onClose();
  }, [onClose, toast]);

  if (!open || !formData) return null;

  return (
    <>
      <SimpleModal
        open={open}
        onOpenChange={(value) => {
          if (!value) handleClose();
        }}
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <SimpleModalHeader>
          <SimpleModalTitle>Informations du client</SimpleModalTitle>
          <SimpleModalDescription>
            Modifiez les informations du client et gérez ses documents d'identité.
          </SimpleModalDescription>
        </SimpleModalHeader>

        <div className="space-y-6 p-6">
          {/* Guest Information Form */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Nom complet *</Label>
              <Input
                id="fullName"
                value={formData.fullName}
                onChange={(e) => setFormData(prev => prev ? { ...prev, fullName: e.target.value } : null)}
                placeholder="Nom complet"
                disabled={isProcessing}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dateOfBirth">Date de naissance</Label>
                <Input
                  id="dateOfBirth"
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={(e) => setFormData(prev => prev ? { ...prev, dateOfBirth: e.target.value } : null)}
                  disabled={isProcessing}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nationality">Nationalité</Label>
                <Input
                  id="nationality"
                  value={formData.nationality}
                  onChange={(e) => setFormData(prev => prev ? { ...prev, nationality: e.target.value } : null)}
                  placeholder="Ex: FRANÇAIS"
                  disabled={isProcessing}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="documentType">Type de document</Label>
                <SafeSelect
                  value={formData.documentType}
                  onValueChange={(value: 'passport' | 'national_id') =>
                    setFormData(prev => prev ? { ...prev, documentType: value } : null)
                  }
                  disabled={isProcessing}
                >
                  <SafeSelectTrigger id="documentType">
                    <SafeSelectValue />
                  </SafeSelectTrigger>
                  <SafeSelectContent>
                    <SafeSelectItem value="passport">Passeport</SafeSelectItem>
                    <SafeSelectItem value="national_id">Carte d'identité</SafeSelectItem>
                  </SafeSelectContent>
                </SafeSelect>
              </div>
              <div className="space-y-2">
                <Label htmlFor="documentNumber">Numéro de document</Label>
                <Input
                  id="documentNumber"
                  value={formData.documentNumber}
                  onChange={(e) => setFormData(prev => prev ? { ...prev, documentNumber: e.target.value } : null)}
                  placeholder="Numéro du document"
                  disabled={isProcessing}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="placeOfBirth">Lieu de naissance</Label>
              <Input
                id="placeOfBirth"
                value={formData.placeOfBirth || ''}
                onChange={(e) => setFormData(prev => prev ? { ...prev, placeOfBirth: e.target.value } : null)}
                placeholder="Lieu de naissance (optionnel)"
                disabled={isProcessing}
              />
            </div>
          </div>

          {/* Document Upload Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Documents d'identité</Label>
              <input
                id="guest-document-upload"
                type="file"
                multiple
                accept="image/jpeg,image/jpg,image/png,image/gif"
                onChange={handleFileInput}
                className="hidden"
                disabled={isProcessing}
              />
              <label htmlFor="guest-document-upload">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isProcessing}
                  asChild
                >
                  <span>
                    <Upload className="w-4 h-4 mr-2" />
                    Ajouter un document
                  </span>
                </Button>
              </label>
            </div>

            {/* Processing Indicator */}
            {isProcessing && (
              <div className="flex items-center space-x-2 p-4 bg-muted rounded-lg">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Traitement OCR en cours...</span>
              </div>
            )}

            {/* Uploaded Documents List */}
            {localDocuments.length > 0 && (
              <div className="space-y-2">
                {localDocuments.map((doc) => (
                  <Card key={doc.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2 flex-1 min-w-0">
                          <FileText className="w-4 h-4 flex-shrink-0" />
                          <span className="text-sm font-medium truncate">{doc.file.name}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          {doc.processingStatus === 'processing' && (
                            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                          )}
                          {doc.processingStatus === 'completed' && (
                            <Badge variant="default" className="bg-success text-success-foreground">
                              <Check className="w-3 h-3 mr-1" />
                              Traité
                            </Badge>
                          )}
                          {doc.processingStatus === 'error' && (
                            <Badge variant="destructive">
                              <AlertCircle className="w-3 h-3 mr-1" />
                              Erreur
                            </Badge>
                          )}
                          {doc.preview && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => showDocumentPreview(doc.preview)}
                              disabled={isProcessing}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => removeDocument(doc.id)}
                            disabled={isProcessing}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    {doc.extractedData && doc.processingStatus === 'completed' && (
                      <CardContent className="pt-0">
                        <div className="text-xs text-muted-foreground">
                          <p>Données extraites: {doc.extractedData.fullName || 'Non disponible'}</p>
                        </div>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button variant="outline" onClick={handleClose} disabled={isProcessing}>
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={!formData.fullName.trim() || isProcessing}>
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Traitement...
                </>
              ) : (
                'Enregistrer'
              )}
            </Button>
          </div>
        </div>
      </SimpleModal>

      {/* Preview Modal */}
      {previewModalOpen && showPreview && (
        <SimpleModal
          open={previewModalOpen}
          onOpenChange={setPreviewModalOpen}
          className="max-w-3xl"
        >
          <SimpleModalHeader>
            <SimpleModalTitle>Aperçu du document</SimpleModalTitle>
            <SimpleModalDescription>
              Aperçu du document d'identité sélectionné.
            </SimpleModalDescription>
          </SimpleModalHeader>
          <div className="flex justify-center p-6">
            <img
              src={showPreview}
              alt="Prévisualisation du document"
              className="max-w-full max-h-96 object-contain"
              onError={() => {
                setPreviewModalOpen(false);
                setShowPreview(null);
                toast({
                  title: "Erreur de prévisualisation",
                  description: "Impossible d'afficher l'aperçu du document.",
                  variant: "destructive"
                });
              }}
            />
          </div>
        </SimpleModal>
      )}
    </>
  );
};

