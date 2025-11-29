import { useState, useCallback, useMemo, useRef, useEffect, Component, ErrorInfo, ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react';
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
    
    // ✅ PROTECTION : Ne pas fermer immédiatement le wizard si c'est une erreur removeChild
    // Ces erreurs sont souvent récupérables et ne devraient pas interrompre le workflow
    if (error.name === 'NotFoundError' && error.message.includes('removeChild')) {
      console.warn('⚠️ [WizardErrorBoundary] Erreur removeChild détectée - tentative de récupération...');
      // Ne pas appeler onError() immédiatement, laisser React essayer de récupérer
      // On va juste logger l'erreur mais ne pas fermer le wizard
      return;
    }
    
    // Pour les autres erreurs, fermer le wizard comme avant
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
  const [isSubmitting, setIsSubmitting] = useState(false); // ✅ PROTECTION : État pour empêcher les clics multiples
  const [formData, setFormData] = useState<BookingFormData>({
    checkInDate: editingBooking?.checkInDate || '',
    checkOutDate: editingBooking?.checkOutDate || '',
    numberOfGuests: editingBooking?.numberOfGuests || 1,
    bookingReference: editingBooking?.bookingReference || '',
    guests: Array.isArray(editingBooking?.guests) ? editingBooking.guests : [],
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
    // ✅ PROTECTION : Vérifier que l'état est valide avant de changer d'étape
    const currentGuests = Array.isArray(formData.guests) ? formData.guests : [];
    const currentDocs = Array.isArray(formData.uploadedDocuments) ? formData.uploadedDocuments : [];
    
    console.log(`🔄 [BookingWizard] handleNext appelé - Étape actuelle: ${currentStep}`);
    console.log('📊 [BookingWizard] État avant transition:', {
      guestsCount: currentGuests.length,
      documentsCount: currentDocs.length,
      numberOfGuests: formData.numberOfGuests,
      guestsList: currentGuests.map(g => ({ id: g.id, fullName: g.fullName }))
    });
    
    // ✅ PROTECTION : Attendre que toutes les mises à jour d'état soient terminées avant de changer d'étape
    // Utiliser requestAnimationFrame pour s'assurer que React a terminé son cycle de rendu
    requestAnimationFrame(() => {
      setTimeout(() => {
        setCurrentStep(prev => {
          if (prev < steps.length - 1) {
            console.log(`✅ [BookingWizard] Transition de l'étape ${prev} vers ${prev + 1}`);
            return prev + 1;
          } else {
            handleSubmit();
            return prev; // Ne pas changer l'étape si on soumet
          }
        });
      }, 50); // Petit délai pour laisser React terminer les mises à jour d'état
    });
  };

  const handlePrevious = () => {
    setCurrentStep(prev => {
      if (prev > 0) {
        return prev - 1;
      }
      return prev;
    });
  };

  const handleSubmit = async () => {
    // ✅ PROTECTION CRITIQUE : Empêcher les clics multiples
    if (isSubmitting) {
      console.warn('⚠️ Tentative de soumission multiple ignorée - traitement déjà en cours');
      return;
    }

    setIsSubmitting(true); // Marquer comme en cours de traitement

    // ✅ FEEDBACK VISUEL : Afficher un toast de chargement
    const loadingToast = toast({
      title: "Création en cours...",
      description: "Veuillez patienter, la réservation est en cours de création.",
    });

    try {
      // ✅ VALIDATION CRITIQUE : Vérifier propertyId obligatoire
      if (!propertyId) {
        console.error('❌ Tentative de création booking sans propertyId');
        toast({
          title: "Erreur critique",
          description: "Impossible de créer une réservation sans propriété sélectionnée. Veuillez rafraîchir la page.",
          variant: "destructive"
        });
        setIsSubmitting(false);
        return;
      }

      // ✅ Dismiss le toast de chargement une fois la validation passée
      // (il sera remplacé par les toasts de succès/erreur)

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

        // ✅ NOUVEAU : Vérifier les conflits avant d'insérer (optionnel - continue si RPC n'existe pas)
        console.log('🔍 Vérification des conflits de réservation...');
        try {
          // La fonction RPC peut ne pas exister dans les types générés, utilisation de 'as any' pour contourner
          const { data: conflictingBookings, error: conflictError } = await (supabase.rpc as any)('check_booking_conflicts', {
            p_property_id: propertyId,
            p_check_in_date: formData.checkInDate,
            p_check_out_date: formData.checkOutDate,
            p_exclude_booking_id: null
          });

        if (conflictError) {
            console.warn('⚠️ Fonction check_booking_conflicts non disponible, continuation sans vérification:', conflictError.message);
            // Continue quand même si la fonction RPC n'existe pas encore
          } else if (conflictingBookings && Array.isArray(conflictingBookings) && conflictingBookings.length > 0) {
            console.error('❌ Conflit détecté avec réservations existantes:', conflictingBookings);
          toast({
            title: "Conflit de réservation",
              description: `Une ou plusieurs réservations existent déjà pour ces dates (${conflictingBookings.length} conflit(s) détecté(s)). Veuillez choisir d'autres dates.`,
            variant: "destructive"
          });
          return;
          } else {
        console.log('✅ Aucun conflit détecté, création de la réservation...');
          }
        } catch (rpcError) {
          console.warn('⚠️ Erreur lors de la vérification des conflits (non bloquant):', rpcError);
          // Continue la création même si la vérification échoue
        }

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

        // ✅ NOUVEAU : Créer la réservation avec statut 'draft' initialement
        // Elle ne sera validée (passage à 'pending'/'completed') qu'après génération complète des documents
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
            status: 'pending' as any, // ✅ TEMPORAIRE : Utiliser 'pending' si 'draft' n'existe pas encore dans l'ENUM
            // TODO: Changer en 'draft' une fois la migration add_draft_status_to_bookings.sql appliquée
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
          const guestsData = formData.guests.map(guest => {
            // ✅ CORRECTION : Convertir date_of_birth en string si c'est une Date
            let dateOfBirth: string | null = null;
            if (guest.dateOfBirth) {
              if (guest.dateOfBirth instanceof Date) {
                dateOfBirth = guest.dateOfBirth.toISOString().split('T')[0]; // Format YYYY-MM-DD
              } else if (typeof guest.dateOfBirth === 'string') {
                dateOfBirth = guest.dateOfBirth;
              }
            }

            return {
          booking_id: bookingData.id,
              full_name: guest.fullName || '',
              date_of_birth: dateOfBirth,
              document_number: guest.documentNumber || '',
              nationality: guest.nationality || 'Non spécifiée',
              place_of_birth: guest.placeOfBirth || null,
              document_type: (guest.documentType || 'passport') as 'passport' | 'national_id'
            };
          });

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

        // 3. ✅ GÉNÉRATION AUTOMATIQUE ROBUSTE DES DOCUMENTS
        // Fonction helper pour générer les documents avec retry et fallback
        const generateDocumentsRobustly = async (bookingId: string): Promise<{ contractUrl?: string; policeUrl?: string }> => {
          const result: { contractUrl?: string; policeUrl?: string } = {};
          
          // Méthode 1 : Essayer avec host_direct si documents uploadés
          if (formData.uploadedDocuments && formData.uploadedDocuments.length > 0) {
            try {
              console.log('🔄 [AUTO-GEN] Tentative génération via host_direct...');
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

            const idDocuments = await Promise.all(
              formData.uploadedDocuments.map(async (doc) => {
                const { DocumentStorageService } = await import('@/services/documentStorageService');
                const uploadResult = await DocumentStorageService.storeDocument(doc.file, {
                    bookingId: bookingId,
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

            const { data, error } = await supabase.functions.invoke('submit-guest-info-unified', {
              body: {
                action: 'host_direct',
                  bookingId: bookingId,
                guestInfo,
                idDocuments,
                bookingData: {
                  checkIn: formData.checkInDate,
                  checkOut: formData.checkOutDate,
                  numberOfGuests: formData.numberOfGuests
                }
              }
            });

              if (!error && data) {
                result.contractUrl = data.contractUrl;
                result.policeUrl = data.policeUrl;
                console.log('✅ [AUTO-GEN] Génération réussie via host_direct');
                return result;
              }
            } catch (error) {
              console.warn('⚠️ [AUTO-GEN] host_direct a échoué, passage au fallback:', error);
          }
          }

          // Méthode 2 (Fallback) : Générer contrat et police séparément
          console.log('🔄 [AUTO-GEN] Génération séparée contrat + police...');
              
          // Générer le contrat
          try {
              const { data: contractData, error: contractError } = await supabase.functions.invoke('submit-guest-info-unified', {
                body: {
                  action: 'generate_contract_only',
                bookingId: bookingId
                }
              });

            if (!contractError && contractData?.contractUrl) {
              result.contractUrl = contractData.contractUrl;
              console.log('✅ [AUTO-GEN] Contrat généré avec succès');
            } else {
              console.warn('⚠️ [AUTO-GEN] Échec génération contrat:', contractError?.message);
            }
          } catch (error) {
            console.warn('⚠️ [AUTO-GEN] Erreur génération contrat:', error);
          }

          // Générer la police
          try {
                  const { data: policeData, error: policeError } = await supabase.functions.invoke('submit-guest-info-unified', {
                    body: {
                      action: 'generate_police_only',
                bookingId: bookingId
                    }
                  });

            if (!policeError && policeData?.policeUrl) {
              result.policeUrl = policeData.policeUrl;
              console.log('✅ [AUTO-GEN] Police générée avec succès');
                  } else {
              console.warn('⚠️ [AUTO-GEN] Échec génération police:', policeError?.message);
                  }
          } catch (error) {
            console.warn('⚠️ [AUTO-GEN] Erreur génération police:', error);
          }

          return result;
        };

        // Générer les documents automatiquement si des guests sont présents
        if (formData.guests.length > 0) {
          console.log('🚀 [AUTO-GEN] Démarrage génération automatique des documents...');
          
          try {
            const documentsResult = await generateDocumentsRobustly(bookingData.id);
            
            // Mettre à jour la réservation avec les URLs générées
            const existingDocs = bookingData.documents_generated && typeof bookingData.documents_generated === 'object' 
              ? bookingData.documents_generated 
              : {};
            
            const updatedDocumentsGenerated = {
              ...existingDocs,
              contract: !!documentsResult.contractUrl,
              policeForm: !!documentsResult.policeUrl,
              contractUrl: documentsResult.contractUrl || undefined,
              policeUrl: documentsResult.policeUrl || undefined
            };

            // ✅ VALIDATION COMPLÈTE : Passer de 'draft' à 'pending'/'completed' seulement si les documents sont générés
            const hasAllDocuments = documentsResult.contractUrl && documentsResult.policeUrl;
            const finalStatus = hasAllDocuments ? 'completed' : 'pending';
            
            console.log('✅ [VALIDATION] Validation réservation:', {
              bookingId: bookingData.id,
              hasContract: !!documentsResult.contractUrl,
              hasPolice: !!documentsResult.policeUrl,
              finalStatus,
              wasDraft: (bookingData.status as any) === 'draft'
            });

                await supabase
                  .from('bookings')
                  .update({
                documents_generated: updatedDocumentsGenerated,
                status: finalStatus, // ✅ Passer de 'draft' à 'pending' ou 'completed' après validation
                guest_name: (formData.guests[0]?.fullName || primaryGuestName || '').trim() || null
                  })
                  .eq('id', bookingData.id);

            await refreshBookings();
            
            // Message de succès adapté selon ce qui a été généré
            const generatedDocs = [];
            if (documentsResult.contractUrl) generatedDocs.push('contrat');
            if (documentsResult.policeUrl) generatedDocs.push('fiche de police');
            
            if (generatedDocs.length > 0) {
              toast({
                title: "Réservation créée avec succès",
                description: `${generatedDocs.join(' et ')} généré${generatedDocs.length > 1 ? 's' : ''} automatiquement.`,
              });
            } else {
            toast({
              title: "Réservation créée",
                description: "La réservation a été créée. Les documents seront générés automatiquement en arrière-plan.",
              });
            }
          } catch (error) {
            console.error('❌ [AUTO-GEN] Erreur lors de la génération automatique:', error);
            // ✅ AMÉLIORATION : Ne pas bloquer le processus même si la génération échoue
            // La réservation est déjà créée, les documents pourront être générés manuellement plus tard
            await refreshBookings();
            toast({
              title: "Réservation créée",
              description: "La réservation a été créée avec succès. Les documents pourront être générés depuis la vue de la réservation.",
              variant: "default"
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
          // @ts-ignore - La fonction RPC peut ne pas exister dans les types générés
          const { error: syncError } = await supabase.rpc('sync_booking_guests', {
            p_booking_id: editingBooking.id,
            p_guests: formData.guests.map(guest => {
              // ✅ CORRECTION : Convertir date_of_birth en string si c'est une Date
              let dateOfBirth: string | null = null;
              if (guest.dateOfBirth) {
                if (guest.dateOfBirth instanceof Date) {
                  dateOfBirth = guest.dateOfBirth.toISOString().split('T')[0]; // Format YYYY-MM-DD
                } else if (typeof guest.dateOfBirth === 'string') {
                  dateOfBirth = guest.dateOfBirth;
                }
              }

              return {
                full_name: guest.fullName || '',
                date_of_birth: dateOfBirth,
                document_number: guest.documentNumber || '',
                nationality: guest.nationality || 'Non spécifiée',
              place_of_birth: guest.placeOfBirth || '',
                document_type: (guest.documentType || 'passport') as 'passport' | 'national_id'
              };
            })
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
              const guestsData = formData.guests.map(guest => {
                // ✅ CORRECTION : Convertir date_of_birth en string si c'est une Date
                let dateOfBirth: string | null = null;
                if (guest.dateOfBirth) {
                  if (guest.dateOfBirth instanceof Date) {
                    dateOfBirth = guest.dateOfBirth.toISOString().split('T')[0]; // Format YYYY-MM-DD
                  } else if (typeof guest.dateOfBirth === 'string') {
                    dateOfBirth = guest.dateOfBirth;
                  }
                }

                return {
                booking_id: editingBooking.id,
                  full_name: guest.fullName || '',
                  date_of_birth: dateOfBirth,
                  document_number: guest.documentNumber || '',
                  nationality: guest.nationality || 'Non spécifiée',
                  place_of_birth: guest.placeOfBirth || null,
                  document_type: (guest.documentType || 'passport') as 'passport' | 'national_id'
                };
              });
              
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

      // ✅ AMÉLIORATION : Le rafraîchissement est maintenant automatique via :
      // 1. Mise à jour optimiste immédiate dans addBooking()/updateBooking()
      // 2. Subscription en temps réel qui va confirmer le changement
      // Plus besoin d'attendre longtemps - juste un court délai pour que l'UI se mette à jour
      console.log('✅ [DIAGNOSTIC] Réservation créée/mise à jour - rafraîchissement automatique en cours...');
      // Petit délai pour que l'UI se mette à jour visuellement
      await new Promise(resolve => setTimeout(resolve, 200));
      console.log('✅ [DIAGNOSTIC] Fermeture du modal après rafraîchissement');

      onClose();
    } catch (error) {
      console.error('❌ Error saving booking:', error);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de l'enregistrement.",
        variant: "destructive",
      });
    } finally {
      // ✅ CRITIQUE : Toujours réinitialiser l'état de soumission, même en cas d'erreur
      setIsSubmitting(false);
    }
  };

  const updateFormData = useCallback((updates: Partial<BookingFormData> | ((prev: BookingFormData) => Partial<BookingFormData>)) => {
    if (typeof updates === 'function') {
      // Si updates est une fonction, l'appeler avec l'état précédent
      console.log('🔄 [BookingWizard] updateFormData appelé avec FONCTION');
    setFormData(prev => {
        // ✅ DÉFENSIF : S'assurer que prev.guests est toujours un tableau
        const safePrev = {
          ...prev,
          guests: Array.isArray(prev.guests) ? prev.guests : []
        };
        
        const result = updates(safePrev);
        console.log('🔄 [BookingWizard] Résultat fonction:', result);
        
        // ✅ DÉFENSIF : S'assurer que result.guests est toujours un tableau si présent
        const safeResult = result.guests !== undefined 
          ? { ...result, guests: Array.isArray(result.guests) ? result.guests : [] }
          : result;
        
        const finalState = { ...safePrev, ...safeResult };
        
        console.log('🔄 [BookingWizard] État final après mise à jour:', {
          guestsCount: finalState.guests.length,
          numberOfGuests: finalState.numberOfGuests,
          hasGuests: finalState.guests.length > 0
        });
        
        return finalState;
    });
    } else {
      // Si updates est un objet, faire un merge simple
      console.log('🔄 [BookingWizard] updateFormData appelé avec OBJET:', updates);
      setFormData(prev => {
        // ✅ DÉFENSIF : S'assurer que prev.guests et updates.guests sont des tableaux
        const safePrev = {
          ...prev,
          guests: Array.isArray(prev.guests) ? prev.guests : []
        };
        
        const safeUpdates = updates.guests !== undefined
          ? { ...updates, guests: Array.isArray(updates.guests) ? updates.guests : [] }
          : updates;
        
        const finalState = { ...safePrev, ...safeUpdates };
        
        console.log('🔄 [BookingWizard] État final après mise à jour (objet):', {
          guestsCount: finalState.guests.length,
          numberOfGuests: finalState.numberOfGuests,
          hasGuests: finalState.guests.length > 0
        });
        
        return finalState;
      });
    }
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
            <Button 
              variant="ghost" 
              onClick={onClose} 
              disabled={isSubmitting}
              className="text-muted-foreground hover:text-foreground"
            >
              ✕
            </Button>
          </div>
          <div className="mt-4">
            <Progress value={progress} className="h-2" />
          </div>
        </CardHeader>

        <CardContent className="p-6">
          {/* ✅ CRITIQUE : Key stable pour forcer la recréation du composant à chaque changement d'étape */}
          {/* Cela évite les erreurs removeChild lors de la transition entre les étapes */}
          {/* La clé inclut currentStep et editingBooking.id pour garantir l'unicité */}
          <CurrentStepComponent
            key={`step-${currentStep}-${editingBooking?.id || 'new'}`}
            formData={formData}
            updateFormData={updateFormData}
            propertyId={propertyId}
            bookingId={editingBooking?.id}
          />
        </CardContent>

        <div className="border-t border-border p-4 bg-muted/20">
          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStep === 0 || isSubmitting}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Précédent
            </Button>
            
            <Button
              onClick={handleNext}
              disabled={!isStepValid || isSubmitting}
              variant={currentStep === steps.length - 1 ? "success" : "professional"}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {currentStep === steps.length - 1 ? 'Création en cours...' : 'Traitement...'}
                </>
              ) : currentStep === steps.length - 1 ? (
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
