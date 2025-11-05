import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { BookingDetailsStep } from './wizard/BookingDetailsStep';
import { DocumentUploadStep } from './wizard/DocumentUploadStep';
import { ReviewStep } from './wizard/ReviewStep';
import { Booking, Guest, UploadedDocument } from '@/types/booking';
import { useBookings } from '@/hooks/useBookings';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { v4 as uuidv4 } from 'uuid';

interface BookingWizardProps {
  onClose: () => void;
  editingBooking?: Booking;
  propertyId?: string; // Add propertyId prop
}

export interface BookingFormData {
  checkInDate: string;
  checkOutDate: string;
  numberOfGuests: number;
  bookingReference: string;
  guests: Guest[];
  uploadedDocuments?: UploadedDocument[];
}

export const BookingWizard = ({ onClose, editingBooking, propertyId }: BookingWizardProps) => {
  const { addBooking, updateBooking } = useBookings();
  const { toast } = useToast();
  
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<BookingFormData>({
    checkInDate: editingBooking?.checkInDate || '',
    checkOutDate: editingBooking?.checkOutDate || '',
    numberOfGuests: editingBooking?.numberOfGuests || 1,
    bookingReference: editingBooking?.bookingReference || '',
    guests: editingBooking?.guests || [],
    uploadedDocuments: []
  });

  const steps = [
    { title: 'Détails de la réservation', component: BookingDetailsStep },
    { title: 'Documents des clients', component: DocumentUploadStep },
    { title: 'Vérification', component: ReviewStep }
  ];

  const isStepValid = () => {
    switch (currentStep) {
      case 0: {
        // ✅ VALIDATION RENFORCÉE : Vérifier propriété, dates et invités
        const hasValidDates = formData.checkInDate && formData.checkOutDate;
        const hasValidGuests = formData.numberOfGuests > 0;
        const hasProperty = propertyId; // Vérifier que la propriété est sélectionnée
        
        if (!hasProperty) {
          console.warn('⚠️ Étape 0 : Pas de propriété sélectionnée');
        }
        if (!hasValidDates) {
          console.warn('⚠️ Étape 0 : Dates invalides');
        }
        if (!hasValidGuests) {
          console.warn('⚠️ Étape 0 : Nombre d\'invités invalide');
        }
        
        return hasValidDates && hasValidGuests && hasProperty;
      }
      case 1: {
        const hasGuests = formData.guests.length > 0;
        if (!hasGuests) {
          console.warn('⚠️ Étape 1 : Aucun invité ajouté');
        }
        return hasGuests;
      }
      case 2:
        return true; // Étape de révision, toujours valide
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleSubmit();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    try {
      // ✅ VALIDATION CRITIQUE : Vérifier propertyId obligatoire
      if (!propertyId) {
        console.error('❌ Tentative de création booking sans propertyId');
        toast({
          title: "Erreur critique",
          description: "Impossible de créer une réservation sans propriété sélectionnée. Veuillez rafraîchir la page.",
          variant: "destructive"
        });
        return;
      }

      console.log('🔍 PropertyId validé pour création booking:', propertyId);
      
      const bookingId = editingBooking?.id || uuidv4();
      

      if (!editingBooking) {
        // Create new booking with direct database calls to handle documents
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) {
          throw new Error('User not authenticated');
        }

        console.log('📝 Création booking avec données:', {
          bookingId,
          propertyId,
          userId: userData.user.id,
          checkIn: formData.checkInDate,
          checkOut: formData.checkOutDate,
          guests: formData.numberOfGuests
        });

        // ✅ NOUVEAU : Vérifier les conflits avant d'insérer
        console.log('🔍 Vérification des conflits de réservation...');
        const { data: conflictingBookings, error: conflictError } = await supabase
          .rpc('check_booking_conflicts', {
            p_property_id: propertyId,
            p_check_in_date: formData.checkInDate,
            p_check_out_date: formData.checkOutDate,
            p_exclude_booking_id: null
          });

        if (conflictError) {
          console.warn('⚠️ Erreur lors de la vérification des conflits:', conflictError);
          // Continue quand même si la fonction RPC n'existe pas encore
        } else if (conflictingBookings && conflictingBookings.length > 0) {
          console.error('❌ Conflit détecté avec réservations existantes:', conflictingBookings);
          toast({
            title: "Conflit de réservation",
            description: `Une ou plusieurs réservations existent déjà pour ces dates (${conflictingBookings.length} conflit(s) détecté(s)). Veuillez choisir d'autres dates.`,
            variant: "destructive"
          });
          return;
        }

        console.log('✅ Aucun conflit détecté, création de la réservation...');

        // 1. Insert booking
        const { data: bookingData, error: bookingError } = await supabase
          .from('bookings')
          .insert({
            id: bookingId,
            user_id: userData.user.id,
            property_id: propertyId, // Maintenant sûr d'être défini
            check_in_date: formData.checkInDate,
            check_out_date: formData.checkOutDate,
            number_of_guests: formData.numberOfGuests,
            booking_reference: formData.bookingReference,
            status: formData.guests.length > 0 ? 'completed' : 'pending',
            documents_generated: {
              policeForm: false,
              contract: false
            }
          })
          .select()
          .single();

        if (bookingError) {
          console.error('❌ Erreur création booking:', bookingError);
          throw bookingError;
        }

        console.log('✅ Booking créé avec succès:', bookingData);

        

        // 2. Insert guests
        if (formData.guests.length > 0) {
          const guestsData = formData.guests.map(guest => ({
            booking_id: bookingData.id,
            full_name: guest.fullName,
            date_of_birth: guest.dateOfBirth,
            document_number: guest.documentNumber,
            nationality: guest.nationality,
            place_of_birth: guest.placeOfBirth,
            document_type: guest.documentType
          }));

          const { error: guestsError } = await supabase
            .from('guests')
            .insert(guestsData);

          if (guestsError) {
            throw guestsError;
          }
          
        }

        // 3. Save uploaded documents
        if (formData.uploadedDocuments && formData.uploadedDocuments.length > 0) {
          
          // Upload documents using unified service
          for (const doc of formData.uploadedDocuments) {
            try {
              const { DocumentStorageService } = await import('@/services/documentStorageService');
              const result = await DocumentStorageService.storeDocument(doc.file, {
                bookingId: bookingData.id,
                fileName: doc.file.name,
                extractedData: doc.extractedData
              });

              if (!result.success) {
                console.error('Failed to store document:', result.error);
              }
            } catch (error) {
              console.error('❌ Error storing document:', error);
            }
          }
        }
      } else {
        // Handle editing existing booking - update booking and sync guests + documents
        await updateBooking(editingBooking.id, {
          checkInDate: formData.checkInDate,
          checkOutDate: formData.checkOutDate,
          numberOfGuests: formData.numberOfGuests,
          bookingReference: formData.bookingReference,
          guests: formData.guests,
          status: formData.guests.length > 0 ? 'completed' : 'pending'
        });

        // ✅ CORRECTION: Transaction sécurisée pour la synchronisation des invités
        console.log('🔄 Syncing guests for booking:', editingBooking.id);
        
        try {
          // Use RPC function for atomic guest replacement
          const { error: syncError } = await supabase.rpc('sync_booking_guests', {
            p_booking_id: editingBooking.id,
            p_guests: formData.guests.map(guest => ({
              full_name: guest.fullName,
              date_of_birth: guest.dateOfBirth,
              document_number: guest.documentNumber,
              nationality: guest.nationality,
              place_of_birth: guest.placeOfBirth || '',
              document_type: guest.documentType
            }))
          });

          if (syncError) {
            console.error('❌ Error syncing guests via RPC:', syncError);
            // Fallback to manual transaction if RPC fails
            console.log('🔄 Falling back to manual guest sync...');
            
            // Delete existing guests
            const { error: deleteError } = await supabase
              .from('guests')
              .delete()
              .eq('booking_id', editingBooking.id);
            
            if (deleteError) {
              throw new Error(`Failed to delete existing guests: ${deleteError.message}`);
            }

            // Insert new guests if any
            if (formData.guests.length > 0) {
              const guestsData = formData.guests.map(guest => ({
                booking_id: editingBooking.id,
                full_name: guest.fullName,
                date_of_birth: guest.dateOfBirth,
                document_number: guest.documentNumber,
                nationality: guest.nationality,
                place_of_birth: guest.placeOfBirth || '',
                document_type: guest.documentType
              }));
              
              const { error: insertError } = await supabase
                .from('guests')
                .insert(guestsData);
              
              if (insertError) {
                throw new Error(`Failed to insert new guests: ${insertError.message}`);
              }
            }
          }
          
          console.log('✅ Guests synchronized successfully');
        } catch (guestSyncError) {
          console.error('❌ Critical error during guest sync:', guestSyncError);
          toast({
            title: "Erreur de synchronisation",
            description: "Échec de la mise à jour des invités. Veuillez réessayer.",
            variant: "destructive"
          });
          return; // Don't continue if guest sync fails
        }

        // Sync uploaded documents: replace previous set with current form state
        try {
          const { DocumentStorageService } = await import('@/services/documentStorageService');
          await DocumentStorageService.deleteDocumentsForBooking(editingBooking.id);

          if (formData.uploadedDocuments && formData.uploadedDocuments.length > 0) {
            for (const doc of formData.uploadedDocuments) {
              try {
                await DocumentStorageService.storeDocument(doc.file, {
                  bookingId: editingBooking.id,
                  fileName: doc.file.name,
                  extractedData: doc.extractedData
                });
              } catch (error) {
                console.error('❌ Error storing document during edit:', error);
              }
            }
          }
        } catch (error) {
          console.error('❌ Error preparing document sync:', error);
        }
      }

      toast({
        title: editingBooking ? "Réservation mise à jour" : "Réservation créée",
        description: editingBooking 
          ? "La réservation a été mise à jour avec succès."
          : "La nouvelle réservation a été créée avec succès.",
      });

      onClose();
    } catch (error) {
      console.error('❌ Error saving booking:', error);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de l'enregistrement.",
        variant: "destructive",
      });
    }
  };

  const updateFormData = (updates: Partial<BookingFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const CurrentStepComponent = steps[currentStep].component;
  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[1050] flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-auto shadow-floating">
        <CardHeader className="border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">
                {editingBooking ? 'Modifier la réservation' : 'Nouvelle réservation'}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Étape {currentStep + 1} sur {steps.length}: {steps[currentStep].title}
              </p>
            </div>
            <Button variant="ghost" onClick={onClose} className="text-muted-foreground hover:text-foreground">
              ✕
            </Button>
          </div>
          <div className="mt-4">
            <Progress value={progress} className="h-2" />
          </div>
        </CardHeader>

        <CardContent className="p-6">
          <CurrentStepComponent
            formData={formData}
            updateFormData={updateFormData}
          />
        </CardContent>

        <div className="border-t border-border p-4 bg-muted/20">
          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStep === 0}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Précédent
            </Button>
            
            <Button
              onClick={handleNext}
              disabled={!isStepValid()}
              variant={currentStep === steps.length - 1 ? "success" : "professional"}
            >
              {currentStep === steps.length - 1 ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  {editingBooking ? 'Mettre à jour' : 'Créer la réservation'}
                </>
              ) : (
                <>
                  Suivant
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};
