import { useState, useCallback, useMemo, useRef, useEffect, Component, ErrorInfo, ReactNode } from 'react';
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

// ✅ ErrorBoundary local pour isoler le wizard
class WizardErrorBoundary extends Component<
  { children: ReactNode; onError: () => void },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; onError: () => void }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('🔴 [WizardErrorBoundary] Erreur capturée:', error, errorInfo);
    this.props.onError();
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[1050] flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardContent className="p-6 text-center space-y-4">
              <h2 className="text-xl font-semibold">Une erreur s'est produite</h2>
              <p className="text-muted-foreground">
                Le formulaire a rencontré une erreur inattendue. Nous allons fermer la fenêtre.
              </p>
              <Button onClick={this.props.onError}>
                Fermer
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

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
  const { addBooking, updateBooking, refreshBookings } = useBookings();
  const { toast } = useToast();
  
  // ✅ PROTECTION : Capturer l'userId au mount pour éviter les crashs si déconnexion temporaire
  const initialUserIdRef = useRef<string | null>(null);
  
  useEffect(() => {
    // Capturer l'userId une seule fois au mount
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user?.id) {
        initialUserIdRef.current = data.session.user.id;
      }
    });
  }, []);
  
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

  // ✅ OPTIMISATION : Mémoriser la validation pour éviter les recalculs inutiles
  const isStepValid = useMemo(() => {
    switch (currentStep) {
      case 0: {
        // ✅ VALIDATION RENFORCÉE : Vérifier propriété, dates et invités
        const hasValidDates = formData.checkInDate && formData.checkOutDate;
        const hasValidGuests = formData.numberOfGuests > 0;
        const hasProperty = propertyId; // Vérifier que la propriété est sélectionnée
        
        return hasValidDates && hasValidGuests && hasProperty;
      }
      case 1: {
        const hasGuests = formData.guests.length > 0;
        return hasGuests;
      }
      case 2:
        return true; // Étape de révision, toujours valide
      default:
        return false;
    }
  }, [currentStep, formData.checkInDate, formData.checkOutDate, formData.numberOfGuests, formData.guests.length, propertyId]);

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

      // ✅ VALIDATION SESSION : Vérifier que l'utilisateur est toujours connecté
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error('❌ Session expirée pendant la création de réservation');
        toast({
          title: "Session expirée",
          description: "Votre session a expiré. Veuillez vous reconnecter.",
          variant: "destructive"
        });
        return;
      }

      console.log('🔍 PropertyId validé pour création booking:', propertyId);
      
      const bookingId = editingBooking?.id || uuidv4();
      const primaryGuestName = formData.guests.length > 0
        ? (formData.guests[0].fullName || '').trim()
        : null;
      

      if (!editingBooking) {
        // Create new booking with direct database calls to handle documents
        const { data: userData } = await supabase.auth.getUser();
        
        // ✅ FALLBACK : Utiliser l'userId initial si l'appel échoue (déconnexion temporaire)
        const userId = userData.user?.id || initialUserIdRef.current;
        if (!userId) {
          throw new Error('User not authenticated');
        }

        console.log('📝 Création booking avec données:', {
          bookingId,
          propertyId,
          userId,
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

        // ✅ DIAGNOSTIC : Vérifier les permissions avant l'insertion
        console.log('🔍 [DIAGNOSTIC] Données avant insertion:', {
          bookingId,
          userId,
          propertyId,
          checkIn: formData.checkInDate,
          checkOut: formData.checkOutDate,
          guests: formData.numberOfGuests,
          hasGuests: formData.guests.length > 0
        });

        // Vérifier que l'utilisateur est bien propriétaire de la propriété
        const { data: propertyCheck, error: propertyCheckError } = await supabase
          .from('properties')
          .select('id, user_id, name')
          .eq('id', propertyId)
          .single();

        if (propertyCheckError || !propertyCheck) {
          console.error('❌ [DIAGNOSTIC] Erreur vérification propriété:', propertyCheckError);
          toast({
            title: "Erreur de propriété",
            description: "Impossible de vérifier la propriété. Veuillez réessayer.",
            variant: "destructive"
          });
          return;
        }

        if (propertyCheck.user_id !== userId) {
          console.error('❌ [DIAGNOSTIC] L\'utilisateur n\'est pas propriétaire de la propriété:', {
            propertyUserId: propertyCheck.user_id,
            currentUserId: userId
          });
          toast({
            title: "Erreur de permissions",
            description: "Vous n'êtes pas autorisé à créer une réservation pour cette propriété.",
            variant: "destructive"
          });
          return;
        }

        console.log('✅ [DIAGNOSTIC] Propriété vérifiée:', propertyCheck.name);

        // 1. Insert booking
        const { data: bookingData, error: bookingError } = await supabase
          .from('bookings')
          .insert({
            id: bookingId,
            user_id: userId, // ✅ Utiliser le userId avec fallback
            property_id: propertyId, // Maintenant sûr d'être défini
            check_in_date: formData.checkInDate,
            check_out_date: formData.checkOutDate,
            number_of_guests: formData.numberOfGuests,
            booking_reference: formData.bookingReference || null,
            guest_name: primaryGuestName || null,
            status: formData.guests.length > 0 ? 'completed' : 'pending',
            documents_generated: {
              policeForm: false,
              contract: false
            }
          })
          .select()
          .single();

        if (bookingError) {
          console.error('❌ [DIAGNOSTIC] Erreur création booking:', {
            error: bookingError,
            code: bookingError.code,
            message: bookingError.message,
            details: bookingError.details,
            hint: bookingError.hint
          });
          
          // ✅ AMÉLIORATION : Message d'erreur plus détaillé
          let errorMessage = "Impossible de créer la réservation.";
          if (bookingError.code === '42501') {
            errorMessage = "Vous n'avez pas les permissions nécessaires pour créer cette réservation.";
          } else if (bookingError.code === '23505') {
            errorMessage = "Une réservation avec cet ID existe déjà.";
          } else if (bookingError.message) {
            errorMessage = `Erreur: ${bookingError.message}`;
          }
          
          toast({
            title: "Erreur de création",
            description: errorMessage,
            variant: "destructive"
          });
          throw bookingError;
        }

        if (!bookingData) {
          console.error('❌ [DIAGNOSTIC] Aucune donnée retournée après insertion');
          toast({
            title: "Erreur de création",
            description: "La réservation n'a pas pu être créée. Aucune donnée retournée.",
            variant: "destructive"
          });
          return;
        }

        console.log('✅ [DIAGNOSTIC] Booking créé avec succès:', {
          id: bookingData.id,
          propertyId: bookingData.property_id,
          status: bookingData.status
        });

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
            console.error('❌ [DIAGNOSTIC] Erreur insertion guests:', guestsError);
            throw guestsError;
          }
          
          console.log('✅ [DIAGNOSTIC] Guests insérés avec succès');
        }

        // ✅ CRITIQUE : Rafraîchir immédiatement après création pour que la réservation s'affiche
        console.log('🔄 [DIAGNOSTIC] Rafraîchissement des réservations après création...');
        console.log('🔄 [DIAGNOSTIC] Booking ID créé:', bookingData.id);
        console.log('🔄 [DIAGNOSTIC] Property ID:', propertyId);
        await refreshBookings();
        console.log('✅ [DIAGNOSTIC] Réservations rafraîchies - la réservation devrait maintenant être visible');

        // 3. Save uploaded documents & generate contract + police form (HOST WORKFLOW)
        // ✅ CORRIGÉ : Générer le contrat même sans documents uploadés si des guests sont présents (workflow signature physique)
        if (formData.guests.length > 0) {
          // Cas 1 : Documents uploadés → Générer contrat + fiche police automatiquement
          if (formData.uploadedDocuments && formData.uploadedDocuments.length > 0) {
          console.log('🏠 [HOST WORKFLOW] Génération automatique contrat + fiche police...');
          
          try {
            // ✅ WORKFLOW HOST : Appeler le service unifié pour tout générer d'un coup
            const { submitDocumentsUnified } = await import('@/services/documentServiceUnified');
            
            // Préparer les données du premier guest (requis pour le contrat)
            const mainGuest = formData.guests[0];
            const guestInfo = {
              firstName: mainGuest.fullName.split(' ')[0] || mainGuest.fullName,
              lastName: mainGuest.fullName.split(' ').slice(1).join(' ') || '',
              email: mainGuest.email || '',
              phone: '',
              nationality: mainGuest.nationality || '',
              idType: mainGuest.documentType === 'passport' ? 'passport' : 'national_id',
              idNumber: mainGuest.documentNumber || '',
              dateOfBirth: typeof mainGuest.dateOfBirth === 'string' 
                ? mainGuest.dateOfBirth 
                : mainGuest.dateOfBirth?.toString() || ''
            };

            // Convertir les documents uploadés en format attendu par l'Edge Function
            const idDocuments = await Promise.all(
              formData.uploadedDocuments.map(async (doc) => {
                const { DocumentStorageService } = await import('@/services/documentStorageService');
                const uploadResult = await DocumentStorageService.storeDocument(doc.file, {
                  bookingId: bookingData.id,
                  fileName: doc.file.name,
                  extractedData: doc.extractedData
                });

                if (!uploadResult.success || !uploadResult.filePath) {
                  throw new Error(`Échec upload document: ${doc.file.name}`);
                }

                const { data: signedData, error: signedError } = await supabase.storage
                  .from('guest-documents')
                  .createSignedUrl(uploadResult.filePath, 3600);

                if (signedError || !signedData?.signedUrl) {
                  throw new Error(`Impossible de signer l'URL du document: ${doc.file.name}`);
                }

                return {
                  name: doc.file.name,
                  url: signedData.signedUrl,
                  type: doc.file.type,
                  size: doc.file.size
                };
              })
            );

            console.log('📤 [HOST WORKFLOW] Appel submit-guest-info-unified (mode host_direct)...', {
              bookingId: bookingData.id,
              guestName: guestInfo.firstName + ' ' + guestInfo.lastName,
              documentsCount: idDocuments.length
            });

            // ✅ Appel direct à l'Edge Function avec action=host_direct
            const { data, error } = await supabase.functions.invoke('submit-guest-info-unified', {
              body: {
                action: 'host_direct',
                bookingId: bookingData.id,
                guestInfo,
                idDocuments,
                bookingData: {
                  checkIn: formData.checkInDate,
                  checkOut: formData.checkOutDate,
                  numberOfGuests: formData.numberOfGuests
                }
              }
            });

            if (error) {
              throw new Error(error.message || 'Erreur lors de la génération des documents');
            }

            const result = {
              bookingId: data.bookingId,
              contractUrl: data.contractUrl,
              policeUrl: data.policeUrl,
              booking: data.booking
            };

            console.log('✅ [HOST WORKFLOW] Documents générés avec succès:', {
              bookingId: result.bookingId,
              contractUrl: result.contractUrl,
              policeUrl: result.policeUrl
            });

            const updatedDocumentsGenerated = {
              ...(bookingData.documents_generated || {}),
              contract: true,
              policeForm: true,
              contractUrl: result.contractUrl,
              policeUrl: result.policeUrl
            };

            await supabase
              .from('bookings')
              .update({
                documents_generated: updatedDocumentsGenerated,
                status: 'completed',
                guest_name: (mainGuest?.fullName || primaryGuestName || '').trim() || null
              })
              .eq('id', bookingData.id);

            await refreshBookings();

            toast({
              title: "Réservation créée avec succès",
              description: "Contrat et fiche de police générés automatiquement. Email envoyé au client.",
            });

          } catch (workflowError) {
            console.error('❌ [HOST WORKFLOW] Erreur génération documents:', workflowError);
            toast({
              title: "Réservation créée",
              description: "La réservation est créée mais la génération des documents a échoué. Vous pouvez les générer manuellement.",
              variant: "destructive"
            });
            // ✅ CORRIGÉ : Rafraîchir même en cas d'erreur pour que la réservation s'affiche
            await refreshBookings();
          }
          } else {
            // Cas 2 : Pas de documents uploadés mais guests présents → Workflow signature physique
            // ✅ CORRIGÉ : Générer le contrat même sans documents pour le workflow signature physique
            console.log('📝 [WORKFLOW SIGNATURE PHYSIQUE] Réservation créée sans documents, génération du contrat...');
            
            try {
              // Préparer les données du premier guest pour la génération du contrat
              const mainGuest = formData.guests[0];
              const guestName = primaryGuestName || mainGuest?.fullName || '';
              
              // ✅ CORRIGÉ : Générer le contrat même sans documents uploadés
              const { data: contractData, error: contractError } = await supabase.functions.invoke('submit-guest-info-unified', {
                body: {
                  action: 'generate_contract_only',
                  bookingId: bookingData.id
                }
              });

              if (contractError) {
                console.error('❌ [WORKFLOW SIGNATURE PHYSIQUE] Erreur génération contrat:', contractError);
                // Continuer quand même, le contrat pourra être généré plus tard
              } else if (contractData?.contractUrl) {
                console.log('✅ [WORKFLOW SIGNATURE PHYSIQUE] Contrat généré avec succès:', contractData.contractUrl);
                
                // ✅ NOUVEAU : Générer aussi la fiche de police pour le workflow signature physique
                let policeUrl = null;
                try {
                  console.log('👮 [WORKFLOW SIGNATURE PHYSIQUE] Génération de la fiche de police...');
                  const { data: policeData, error: policeError } = await supabase.functions.invoke('submit-guest-info-unified', {
                    body: {
                      action: 'generate_police_only',
                      bookingId: bookingData.id
                    }
                  });

                  if (policeError) {
                    console.error('❌ [WORKFLOW SIGNATURE PHYSIQUE] Erreur génération fiche police:', policeError);
                    // Continuer quand même, la fiche police pourra être générée plus tard
                  } else if (policeData?.policeUrl) {
                    policeUrl = policeData.policeUrl;
                    console.log('✅ [WORKFLOW SIGNATURE PHYSIQUE] Fiche de police générée avec succès:', policeUrl);
                  } else {
                    console.warn('⚠️ [WORKFLOW SIGNATURE PHYSIQUE] Pas d\'URL de fiche police retournée');
                  }
                } catch (policeGenError) {
                  console.error('❌ [WORKFLOW SIGNATURE PHYSIQUE] Erreur lors de la génération de la fiche de police:', policeGenError);
                  // Continuer quand même
                }
                
                // Mettre à jour la réservation avec l'URL du contrat et de la fiche de police
                await supabase
                  .from('bookings')
                  .update({
                    documents_generated: {
                      ...(bookingData.documents_generated || {}),
                      contract: true,
                      contractUrl: contractData.contractUrl,
                      policeForm: !!policeUrl, // True si la fiche police a été générée
                      policeUrl: policeUrl || undefined
                    },
                    status: 'pending', // En attente de signature physique
                    guest_name: guestName.trim() || null
                  })
                  .eq('id', bookingData.id);
              } else {
                // Pas d'erreur mais pas d'URL non plus, mettre à jour quand même
                await supabase
                  .from('bookings')
                  .update({
                    status: 'pending',
                    guest_name: guestName.trim() || null
                  })
                  .eq('id', bookingData.id);
              }
            } catch (contractGenError) {
              console.error('❌ [WORKFLOW SIGNATURE PHYSIQUE] Erreur lors de la génération du contrat:', contractGenError);
              // Mettre à jour quand même le statut et le guest_name
              await supabase
                .from('bookings')
                .update({
                  status: 'pending',
                  guest_name: (primaryGuestName || formData.guests[0]?.fullName || '').trim() || null
                })
                .eq('id', bookingData.id);
            }
            
            // ✅ CORRIGÉ : Rafraîchir pour que la réservation s'affiche dans le calendrier
            await refreshBookings();
            
            toast({
              title: "Réservation créée",
              description: "La réservation a été créée. Le contrat a été généré et sera signé physiquement.",
            });
          }
        } else if (formData.uploadedDocuments && formData.uploadedDocuments.length > 0) {
          // Fallback : Documents uploadés mais pas de guests → Juste stocker les documents
          console.log('📄 Stockage des documents sans génération de contrat (pas de guests)');
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
          // ✅ CORRIGÉ : Rafraîchir même dans ce cas
          await refreshBookings();
        } else {
          // ✅ CORRIGÉ : Cas où aucune donnée supplémentaire n'est fournie, rafraîchir quand même
          console.log('✅ Réservation créée sans guests ni documents');
          await refreshBookings();
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

      // ✅ Toast de succès uniquement si pas déjà affiché par le workflow host
      if (editingBooking || !formData.uploadedDocuments || formData.uploadedDocuments.length === 0 || formData.guests.length === 0) {
        toast({
          title: editingBooking ? "Réservation mise à jour" : "Réservation créée",
          description: editingBooking 
            ? "La réservation a été mise à jour avec succès."
            : "La nouvelle réservation a été créée avec succès.",
        });
      }

      // ✅ CRITIQUE : Attendre que refreshBookings() termine et laisser le temps aux subscriptions de se mettre à jour
      console.log('⏳ [DIAGNOSTIC] Attente finale avant fermeture du modal...');
      await refreshBookings();
      // Attendre un court délai pour que les subscriptions en temps réel se mettent à jour
      await new Promise(resolve => setTimeout(resolve, 500));
      console.log('✅ [DIAGNOSTIC] Fermeture du modal après rafraîchissement');

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

  const updateFormData = useCallback((updates: Partial<BookingFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  }, []);

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
              disabled={!isStepValid}
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

// ✅ Export avec ErrorBoundary wrapper
export const BookingWizardWithBoundary = (props: BookingWizardProps) => (
  <WizardErrorBoundary onError={props.onClose}>
    <BookingWizard {...props} />
  </WizardErrorBoundary>
);
