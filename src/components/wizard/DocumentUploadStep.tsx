import { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, FileText, Loader2, Check, X, Eye, Edit, Trash2, Camera, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { BookingFormData } from '../BookingWizard';
import { UploadedDocument, Guest } from '@/types/booking';
import { v4 as uuidv4 } from 'uuid';

// Extend the UploadedDocument type to include the guest ID it created
interface ExtendedUploadedDocument extends UploadedDocument {
  createdGuestId?: string;
}

interface DocumentUploadStepProps {
  formData: BookingFormData;
  updateFormData: (updates: Partial<BookingFormData>) => void;
}

export const DocumentUploadStep = ({ formData, updateFormData }: DocumentUploadStepProps) => {
  const { toast } = useToast();
  const [uploadedDocs, setUploadedDocs] = useState<ExtendedUploadedDocument[]>(formData.uploadedDocuments || []);
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null);
  const [showPreview, setShowPreview] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      setEditingGuest(null);
      setShowPreview(null);
    };
  }, []);

  // Update form data whenever uploadedDocs changes
  useEffect(() => {
    updateFormData({ uploadedDocuments: uploadedDocs });
  }, [uploadedDocs, updateFormData]);

  const handleFileUpload = useCallback(async (files: FileList) => {
    // Calculate how many guests we will have after this upload; auto-expand guest count if needed
    const currentGuestCount = formData.guests.length;
    const newFilesCount = files.length;

    // Do not block the upload; if exceeding, we will increase the reservation guest count automatically
    const resultingGuests = currentGuestCount + newFilesCount;
    if (resultingGuests > formData.numberOfGuests) {
      updateFormData({ numberOfGuests: resultingGuests });
    }
    
    const newDocs: ExtendedUploadedDocument[] = [];
    // We'll accumulate guests extracted from documents and update once at the end
    const pendingGuests: Guest[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      if (!file.type.match(/^image\/(jpeg|jpg|png|gif)$/)) {
        toast({
          title: "Format non supporté",
          description: `Le fichier ${file.name} n'est pas une image valide.`,
          variant: "destructive",
        });
        continue;
      }

      const doc: ExtendedUploadedDocument = {
        id: uuidv4(),
        file,
        preview: URL.createObjectURL(file),
        processingStatus: 'processing'
      };

      newDocs.push(doc);
    }

    const updatedDocs = [...uploadedDocs, ...newDocs];
    setUploadedDocs(updatedDocs);

    // Process OCR for each document
    for (const doc of newDocs) {
      try {
        
        let extractedData;
        
        // Try OpenAI Vision API first (most accurate)
        try {
          
          const { OpenAIDocumentService } = await import('@/services/openaiDocumentService');
          extractedData = await OpenAIDocumentService.extractDocumentData(doc.file);
          
        } catch (openAiError) {
          console.warn('❌ OpenAI Vision failed, using AI OCR fallback:', openAiError);
          
          // Fallback to AI OCR
          const { AILocrService } = await import('@/services/aiOcrService');
          const extractedText = await AILocrService.extractTextFromImage(doc.file);
          console.log('📝 Raw text extracted by AI OCR:', extractedText);
          extractedData = await AILocrService.parseGuestInfo(extractedText);
          console.log('✅ AI OCR parsing complete:', extractedData);
        }
        
        // Mark as processing completed but don't duplicate the state update

        // Auto-create guest if data was extracted successfully
        if (extractedData.fullName) {
          const newGuestId = uuidv4();
          const newGuest: Guest = {
            id: newGuestId,
            fullName: extractedData.fullName || '',
            dateOfBirth: extractedData.dateOfBirth || '',
            documentNumber: extractedData.documentNumber || '',
            nationality: extractedData.nationality || '',
            placeOfBirth: extractedData.placeOfBirth || '',
            documentType: extractedData.documentType || 'passport'
          };

          console.log('🔗 Creating guest from document:', doc.id, '->', newGuestId);
          
          // Update document with guest reference
          setUploadedDocs(prev => prev.map(d => 
            d.id === doc.id 
              ? { ...d, extractedData, processingStatus: 'completed', createdGuestId: newGuestId }
              : d
          ));

          // Queue guest to be added (batch update later)
          pendingGuests.push(newGuest);
        } else {
          console.warn('No valid guest data extracted from document:', extractedData);
          
          // Still mark as completed even if no guest data
          setUploadedDocs(prev => {
            const updatedDocs = prev.map(d => 
              d.id === doc.id 
                ? { ...d, extractedData, processingStatus: 'completed' as const }
                : d
            );
            return updatedDocs;
          });
        }

      } catch (error) {
        console.error(`❌ Critical error processing ${doc.file.name}:`, error);
        console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace available');
        
        setUploadedDocs(prev => {
          const updatedDocs = prev.map(d => 
            d.id === doc.id 
              ? { ...d, processingStatus: 'error' as const }
              : d
          );
          
          return updatedDocs;
        });
        
        toast({
          title: "Erreur d'extraction",
          description: `Impossible d'extraire les données de ${doc.file.name}: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
          variant: "destructive",
        });
      }
    }
    // Batch update guests once after processing all documents
    if (pendingGuests.length > 0) {
      const base = formData.guests;
      // Ensure we don't drop guests due to an outdated numberOfGuests limit
      const targetMax = Math.max(formData.numberOfGuests, base.length + pendingGuests.length);
      const merged = [...base, ...pendingGuests].slice(0, targetMax);
      updateFormData({ guests: merged, numberOfGuests: targetMax });
    }
  }, [updateFormData, toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length) {
      handleFileUpload(files);
    }
  }, [handleFileUpload]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      handleFileUpload(e.target.files);
    }
  };

  const addManualGuest = () => {
    const newGuest: Guest = {
      id: uuidv4(),
      fullName: '',
      dateOfBirth: '',
      documentNumber: '',
      nationality: '',
      placeOfBirth: '',
      documentType: 'passport'
    };
    setEditingGuest(newGuest);
  };

  const saveGuest = (guest: Guest) => {
    if (formData.guests.find(g => g.id === guest.id)) {
      updateFormData({
        guests: formData.guests.map(g => g.id === guest.id ? guest : g)
      });
    } else {
      updateFormData({
        guests: [...formData.guests, guest]
      });
    }
    setEditingGuest(null);
  };

  const deleteGuest = (guestId: string) => {
    console.log('🗑️ Deleting guest:', guestId);
    
    // Remove the guest from uploaded docs if it was created from a document
    setUploadedDocs(prev => prev.map(doc => 
      doc.createdGuestId === guestId 
        ? { ...doc, createdGuestId: undefined }
        : doc
    ));
    
    // Remove guest from form data
    updateFormData({
      guests: formData.guests.filter(g => g.id !== guestId)
    });
  };

  const removeDocument = (docId: string) => {
    console.log('🗑️ REMOVING DOCUMENT:', docId);
    
    // Find the document
    const docToRemove = uploadedDocs.find(d => d.id === docId);
    if (!docToRemove) return;
    
    console.log('📄 Document found:', docToRemove.file.name, 'Guest ID:', docToRemove.createdGuestId);
    
    // Clean up preview URL
    URL.revokeObjectURL(docToRemove.preview);
    
    // Remove document from list
    setUploadedDocs(prev => {
      const filtered = prev.filter(d => d.id !== docId);
      console.log('📋 Documents after removal:', filtered.length);
      return filtered;
    });
    
    // Remove associated guest if exists
    if (docToRemove.createdGuestId) {
      console.log('✂️ REMOVING GUEST:', docToRemove.createdGuestId);
      updateFormData({
        guests: formData.guests.filter(g => {
          const keep = g.id !== docToRemove.createdGuestId;
          console.log(`Guest ${g.fullName} (${g.id}): ${keep ? 'KEEP' : 'REMOVE'}`);
          return keep;
        })
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-xl sm:text-2xl font-semibold text-foreground mb-2">
          Documents des clients
        </h2>
        <p className="text-muted-foreground">
          Importez les documents d'identité ou ajoutez manuellement les informations
        </p>
      </div>

      {/* Validation Alert */}
      {formData.guests.length > formData.numberOfGuests && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-6">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <div className="w-5 h-5 bg-destructive rounded-full flex items-center justify-center">
                <span className="text-xs text-destructive-foreground font-bold">!</span>
              </div>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-destructive">Trop de documents uploadés</h4>
              <p className="text-sm text-destructive/80">
                Vous avez {formData.guests.length} client(s) enregistré(s) mais votre réservation ne compte que {formData.numberOfGuests} client(s). 
                Veuillez retourner à l'étape précédente pour modifier le nombre de clients ou supprimer les documents excédentaires.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Upload Area */}
      <div
        className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => document.getElementById('file-upload')?.click()}
      >
        <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">
          Glissez-déposez vos documents ici
        </h3>
        <p className="text-muted-foreground mb-4">
          ou cliquez pour sélectionner des fichiers
        </p>
        <p className="text-xs text-muted-foreground">
          Formats supportés: JPG, PNG, GIF (max 10MB)
        </p>
        <input
          id="file-upload"
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileInput}
          className="hidden"
        />
      </div>

      {/* Uploaded Documents */}
      {uploadedDocs.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Documents uploadés</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {uploadedDocs.map((doc) => (
              <Card key={doc.id} className="relative">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <FileText className="w-4 h-4" />
                      <span className="text-sm font-medium truncate">{doc.file.name}</span>
                    </div>
                    <div className="flex space-x-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => setShowPreview(doc.preview)}
                      >
                        <Eye className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => removeDocument(doc.id)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    {doc.processingStatus === 'processing' && (
                      <div className="flex items-center space-x-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-xs text-muted-foreground">Traitement...</span>
                      </div>
                    )}
                    {doc.processingStatus === 'completed' && (
                      <Badge variant="default" className="bg-success text-success-foreground">
                        <Check className="w-3 h-3 mr-1" />
                        Traité
                      </Badge>
                    )}
                    {doc.processingStatus === 'error' && (
                      <Badge variant="destructive">
                        <X className="w-3 h-3 mr-1" />
                        Erreur
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Guests List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">
            Clients enregistrés ({formData.guests.length}/{formData.numberOfGuests})
          </h3>
          <Button onClick={addManualGuest} variant="outline" size="sm">
            <Edit className="w-4 h-4 mr-2" />
            Ajouter manuellement
          </Button>
        </div>

        {formData.guests.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>Aucun client enregistré</p>
            <p className="text-sm">Uploadez des documents ou ajoutez manuellement</p>
          </div>
        ) : (
          <div className="space-y-3">
            {formData.guests.map((guest) => (
              <Card key={guest.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="font-medium">{guest.fullName || 'Nom non renseigné'}</p>
                      <div className="flex space-x-4 text-sm text-muted-foreground">
                        <span>{guest.nationality}</span>
                        <span>{guest.documentNumber}</span>
                        <span>{guest.dateOfBirth}</span>
                      </div>
                    </div>
                    <div className="flex space-x-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditingGuest(guest)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteGuest(guest.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Guest Edit Dialog */}
      <GuestEditDialog
        guest={editingGuest}
        open={!!editingGuest}
        onSave={saveGuest}
        onClose={() => setEditingGuest(null)}
      />

      {/* Preview Dialog */}
      <Dialog open={!!showPreview} onOpenChange={(open) => {
        if (!open) setShowPreview(null);
      }}>
        <DialogContent className="max-w-3xl" aria-describedby="document-preview-description">
          <DialogHeader>
            <DialogTitle>Aperçu du document</DialogTitle>
            <DialogDescription id="document-preview-description">
              Aperçu du document d'identité sélectionné.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center">
            {showPreview && (
              <img
                src={showPreview}
                alt="Prévisualisation du document"
                className="max-w-full max-h-96 object-contain"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

interface GuestEditDialogProps {
  guest: Guest | null;
  open: boolean;
  onSave: (guest: Guest) => void;
  onClose: () => void;
}

const GuestEditDialog = ({ guest, open, onSave, onClose }: GuestEditDialogProps) => {
  const [formData, setFormData] = useState<Guest | null>(guest);

  useEffect(() => {
    setFormData(guest);
  }, [guest]);

  if (!formData) return (
    <Dialog open={open} onOpenChange={(value) => {
      if (!value) onClose();
    }} />
  );

  const handleSave = () => {
    if (!formData.fullName.trim()) {
      return;
    }
    onSave(formData);
  };

  return (
    <Dialog open={open} onOpenChange={(value) => {
      if (!value) onClose();
    }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Informations du client</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nom complet *</Label>
            <Input
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              placeholder="Nom complet"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date de naissance</Label>
              <Input
                type="date"
                value={formData.dateOfBirth}
                onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Nationalité</Label>
              <Input
                value={formData.nationality}
                onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                placeholder="Ex: FRANÇAIS"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type de document</Label>
              <Select
                value={formData.documentType}
                onValueChange={(value: 'passport' | 'national_id') => 
                  setFormData({ ...formData, documentType: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="passport">Passeport</SelectItem>
                  <SelectItem value="national_id">Carte d'identité</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Numéro de document</Label>
              <Input
                value={formData.documentNumber}
                onChange={(e) => setFormData({ ...formData, documentNumber: e.target.value })}
                placeholder="Numéro du document"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Lieu de naissance</Label>
            <Input
              value={formData.placeOfBirth || ''}
              onChange={(e) => setFormData({ ...formData, placeOfBirth: e.target.value })}
              placeholder="Lieu de naissance (optionnel)"
            />
          </div>
        </div>
        <div className="flex justify-end space-x-2 pt-4">
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={!formData.fullName.trim()}>
            Enregistrer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};