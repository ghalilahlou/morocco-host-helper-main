import { useState, useCallback, useEffect } from 'react';
import { Upload, FileText, Loader2, Check, X, Eye, Edit, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { SafeSelect, SafeSelectContent, SafeSelectItem, SafeSelectTrigger, SafeSelectValue } from '@/components/ui/safe-select';
import { Badge } from '@/components/ui/badge';
import { SimpleModal, SimpleModalHeader, SimpleModalTitle, SimpleModalDescription } from '@/components/ui/simple-modal';
import { useToast } from '@/hooks/use-toast';
import { BookingFormData, BookingFormUpdate } from '../BookingWizard';
import { UploadedDocument, Guest } from '@/types/booking';
import { v4 as uuidv4 } from 'uuid';

interface DocumentUploadStepProps {
  formData: BookingFormData;
  updateFormData: (updates: BookingFormUpdate) => void;
  propertyId?: string; // Optionnel pour compatibilité avec BookingWizard
  bookingId?: string; // Optionnel pour compatibilité avec BookingWizard
}

// Type étendu pour les documents avec statut de traitement
interface ExtendedUploadedDocument extends UploadedDocument {
  processingStatus?: 'processing' | 'completed' | 'error';
}

export const DocumentUploadStep = ({ formData, updateFormData }: DocumentUploadStepProps) => {
  // ✅ TEST MODIFICATION - Ce log confirme que le code modifié est chargé
  console.log('🟢 [DocumentUploadStep] Chargé - Version du ' + new Date().toISOString());
  
  const { toast } = useToast();
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null);
  const [showPreview, setShowPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const uploadedDocs = formData.uploadedDocuments || [];
  
  // 🔍 LOG DE DÉBOGAGE : Tracer l'état
  console.log('📊 [DocumentUploadStep] État actuel:', {
    uploadedDocs: uploadedDocs.length,
    guests: formData.guests.length,
    numberOfGuests: formData.numberOfGuests
  });

  useEffect(() => {
    return () => {
      setEditingGuest(null);
      setShowPreview(null);
    };
  }, []);

  const updateUploadedDocuments = useCallback((updater: (docs: UploadedDocument[]) => UploadedDocument[]) => {
    console.log('📝 [updateUploadedDocuments] Mise à jour des documents...');
    updateFormData(prev => {
      const currentDocs = prev.uploadedDocuments || [];
      const newDocs = updater(currentDocs);
      console.log('📝 [updateUploadedDocuments] Documents:', currentDocs.length, '→', newDocs.length);
      return {
        uploadedDocuments: newDocs
      };
    });
  }, [updateFormData]);

useEffect(() => {
  if (!uploadedDocs.length) {
    return;
  }

  updateFormData(prev => {
    const existingIds = new Set(prev.guests.map(g => g.id));
    const docsWithGuests = uploadedDocs.filter(doc => doc.createdGuestId && doc.extractedData);

    const newGuests = docsWithGuests
      .filter(doc => !existingIds.has(doc.createdGuestId!))
      .map(doc => ({
        id: doc.createdGuestId!,
        fullName: (doc.extractedData?.fullName as string) || doc.file.name,
        dateOfBirth: doc.extractedData?.dateOfBirth || '',
        documentNumber: doc.extractedData?.documentNumber || '',
        nationality: doc.extractedData?.nationality || '',
        placeOfBirth: doc.extractedData?.placeOfBirth || '',
        documentType: (doc.extractedData?.documentType as 'passport' | 'national_id') || 'passport'
      }));

    if (newGuests.length === 0) {
      return prev;
    }

    const guests = [...prev.guests, ...newGuests];
    const guestCount = Math.max(prev.numberOfGuests, guests.length);

    return {
      guests,
      numberOfGuests: guestCount
    };
  });
}, [uploadedDocs, updateFormData]);

  const handleFileUpload = useCallback(async (files: FileList) => {
    console.log('🚀 [UPLOAD START] Début du traitement de', files.length, 'fichier(s)');
    
    // Calculate how many guests we will have after this upload; auto-expand guest count if needed
    const currentGuestCount = formData.guests.length;
    const newFilesCount = files.length;

    console.log('📊 [UPLOAD] Invités actuels:', currentGuestCount, 'Nouveaux fichiers:', newFilesCount);

    // Do not block the upload; if exceeding, we will increase the reservation guest count automatically
    const resultingGuests = currentGuestCount + newFilesCount;
    if (resultingGuests > formData.numberOfGuests) {
      console.log('⬆️ [UPLOAD] Augmentation du nombre d\'invités de', formData.numberOfGuests, 'à', resultingGuests);
      updateFormData({ numberOfGuests: resultingGuests });
    }
    
    const newDocs: ExtendedUploadedDocument[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      console.log(`📄 [UPLOAD] Traitement du fichier ${i + 1}/${files.length}:`, file.name, 'Type:', file.type, 'Taille:', Math.round(file.size / 1024), 'KB');
      
      if (!file.type.match(/^image\/(jpeg|jpg|png|gif)$/)) {
        console.error('❌ [UPLOAD] Format non supporté:', file.type);
        toast({
          title: "Format non supporté",
          description: `Le fichier ${file.name} n'est pas une image valide (type: ${file.type}).`,
          variant: "destructive",
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

        console.log('✅ [UPLOAD] Document créé avec ID:', doc.id);
        newDocs.push(doc);
      } catch (error) {
        console.error('❌ [UPLOAD] Erreur création document:', error);
        toast({
          title: "Erreur",
          description: `Impossible de charger ${file.name}`,
          variant: "destructive",
        });
      }
    }

    if (newDocs.length > 0) {
      console.log('✅ [UPLOAD] Ajout de', newDocs.length, 'document(s) à la liste');
      updateUploadedDocuments(prev => [...prev, ...newDocs]);
      
      toast({
        title: "Fichiers ajoutés",
        description: `${newDocs.length} fichier(s) ajouté(s). Extraction des données en cours...`,
      });
    } else {
      console.warn('⚠️ [UPLOAD] Aucun document valide à ajouter');
      return;
    }

    // Process OCR for each document
    console.log('🔍 [OCR] Début de l\'extraction pour', newDocs.length, 'document(s)');
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
          updateUploadedDocuments(prev => prev.map(d => 
            d.id === doc.id 
              ? { ...d, extractedData, processingStatus: 'completed', createdGuestId: newGuestId }
              : d
          ));

          // Inject guest immediately into form state
          updateFormData(prev => {
            const guests = [...prev.guests, newGuest];
            const guestCount = Math.max(prev.numberOfGuests, guests.length);
            return {
              guests,
              numberOfGuests: guestCount
            };
          });
        } else {
          console.warn('No valid guest data extracted from document:', extractedData);
          
          // Still mark as completed even if no guest data
          updateUploadedDocuments(prev => prev.map(d => 
            d.id === doc.id 
              ? { ...d, extractedData, processingStatus: 'completed' as const }
              : d
          ));
        }

      } catch (error) {
        console.error(`❌ Critical error processing ${doc.file.name}:`, error);
        console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace available');
        
        updateUploadedDocuments(prev => prev.map(d => 
          d.id === doc.id 
            ? { ...d, processingStatus: 'error' as const }
            : d
        ));
        
        toast({
          title: "Erreur d'extraction",
          description: `Impossible d'extraire les données de ${doc.file.name}: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
          variant: "destructive",
        });
      }
    }
  }, [formData.guests.length, formData.numberOfGuests, updateFormData, updateUploadedDocuments, toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    console.log('📁 [DRAG & DROP] Fichiers déposés:', files.length);
    if (files.length) {
      handleFileUpload(files);
    }
  }, [handleFileUpload]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    // Only set to false if leaving the drop zone itself
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('📂 [FILE INPUT] Fichiers sélectionnés:', e.target.files?.length);
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
    updateFormData(prev => {
      const exists = prev.guests.find(g => g.id === guest.id);
      const guests = exists
        ? prev.guests.map(g => g.id === guest.id ? guest : g)
        : [...prev.guests, guest];
      return {
        guests,
        numberOfGuests: Math.max(prev.numberOfGuests, guests.length)
      };
    });
    setEditingGuest(null);
  };

  const deleteGuest = (guestId: string) => {
    console.log('🗑️ Deleting guest:', guestId);
    
    // Remove the guest from uploaded docs if it was created from a document
    updateUploadedDocuments(prev => prev.map(doc => 
      doc.createdGuestId === guestId 
        ? { ...doc, createdGuestId: undefined }
        : doc
    ));
    
    // Remove guest from form data
    updateFormData(prev => ({
      guests: prev.guests.filter(g => g.id !== guestId)
    }));
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
    updateUploadedDocuments(prev => {
      const filtered = prev.filter(d => d.id !== docId);
      console.log('📋 Documents after removal:', filtered.length);
      return filtered;
    });
    
    // Remove associated guest if exists
    if (docToRemove.createdGuestId) {
      console.log('✂️ REMOVING GUEST:', docToRemove.createdGuestId);
      updateFormData(prev => ({
        guests: prev.guests.filter(g => {
          const keep = g.id !== docToRemove.createdGuestId;
          console.log(`Guest ${g.fullName} (${g.id}): ${keep ? 'KEEP' : 'REMOVE'}`);
          return keep;
        })
      }));
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
      <div>
        <input
          id="file-upload"
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileInput}
          className="hidden"
        />
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
            isDragging 
              ? 'border-primary bg-primary/10 scale-105' 
              : 'border-border hover:border-primary/50'
          }`}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onClick={() => {
            console.log('🖱️ [CLICK] Zone de upload cliquée');
            const fileInput = document.getElementById('file-upload') as HTMLInputElement;
            if (fileInput) {
              console.log('✅ [CLICK] Input trouvé, déclenchement du clic');
              fileInput.click();
            } else {
              console.error('❌ [CLICK] Input file-upload non trouvé !');
            }
          }}
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
        </div>
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

      {/* Guest Edit Dialog - Rendu conditionnel avec key pour éviter les erreurs de portal */}
      {editingGuest && (
        <GuestEditDialog
          key={`guest-edit-${editingGuest.id}`}
          guest={editingGuest}
          open={true}
          onSave={saveGuest}
          onClose={() => setEditingGuest(null)}
        />
      )}

      {/* Preview Modal - Utilise SimpleModal sans portal pour éviter les erreurs */}
      {showPreview && (
        <SimpleModal
          open={!!showPreview}
          onOpenChange={(open) => {
            if (!open) {
              setShowPreview(null);
            }
          }}
          className="max-w-3xl"
        >
          <SimpleModalHeader>
            <SimpleModalTitle>Aperçu du document</SimpleModalTitle>
            <SimpleModalDescription>
              Aperçu du document d'identité sélectionné.
            </SimpleModalDescription>
          </SimpleModalHeader>
          <div className="flex justify-center">
            <img
              src={showPreview}
              alt="Prévisualisation du document"
              className="max-w-full max-h-96 object-contain"
            />
          </div>
        </SimpleModal>
      )}
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

  // Ne rien rendre si pas de guest ou pas ouvert (évite les erreurs de portal)
  if (!formData || !open) return null;

  const handleSave = () => {
    if (!formData.fullName.trim()) {
      return;
    }
    onSave(formData);
  };

  return (
    <SimpleModal
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <SimpleModalHeader>
        <SimpleModalTitle>Informations du client</SimpleModalTitle>
      </SimpleModalHeader>
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
              <SafeSelect
                value={formData.documentType}
                onValueChange={(value: 'passport' | 'national_id') => 
                  setFormData({ ...formData, documentType: value })
                }
              >
                <SafeSelectTrigger>
                  <SafeSelectValue />
                </SafeSelectTrigger>
                <SafeSelectContent>
                  <SafeSelectItem value="passport">Passeport</SafeSelectItem>
                  <SafeSelectItem value="national_id">Carte d'identité</SafeSelectItem>
                </SafeSelectContent>
              </SafeSelect>
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
    </SimpleModal>
  );
};