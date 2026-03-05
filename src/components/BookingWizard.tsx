import { useState, useCallback, useMemo, useRef, useEffect, Component, ErrorInfo, ReactNode, startTransition } from 'react';

// Helper function to normalize names for comparison
function normName(s?: string): string {
  return (s ?? '')
    .toString()
    .normalize('NFKD')
    .replace(/[^\p{L}\s'-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}
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
import { useT } from '@/i18n/GuestLocaleProvider';

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
    
    // ✅ PROTECTION RENFORCÉE : Ne pas fermer le wizard pour les erreurs removeChild/insertBefore
    // Ces erreurs sont souvent récupérables et ne devraient pas interrompre le workflow
    const errorMessage = error?.message || '';
    const errorStack = errorInfo?.componentStack || '';
    
    const isPortalOrDOMError = 
      error.name === 'NotFoundError' ||
      errorMessage.includes('removeChild') ||
      errorMessage.includes('insertBefore') ||
      errorMessage.includes('not a child of this node') ||
      errorMessage.includes('The node to be removed') ||
      errorMessage.includes('The node before which') ||
      errorStack.includes('removeChild') ||
      errorStack.includes('insertBefore');
    
    if (isPortalOrDOMError) {
      console.warn('⚠️ [WizardErrorBoundary] Erreur DOM/Portal détectée - tentative de récupération...');
      // ✅ CRITIQUE : Ne pas changer l'état immédiatement pour éviter les re-renders qui causent plus d'erreurs
      // Réinitialiser l'état d'erreur après un court délai pour permettre la récupération
      setTimeout(() => {
        if (this.state.hasError) {
          this.setState({ hasError: false, error: null });
        }
      }, 100);
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
  // ✅ FIX CRITIQUE : Utiliser le MÊME propertyId que Dashboard pour synchroniser les états
  const { addBooking, updateBooking, refreshBookings } = useBookings({ propertyId });
  const { toast } = useToast();
  const t = useT();
  
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
  const [isTransitioning, setIsTransitioning] = useState(false); // ✅ NOUVEAU : État pour gérer les transitions
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
    // ✅ PROTECTION : Empêcher les transitions multiples simultanées
    if (isTransitioning) {
      console.warn('⚠️ [BookingWizard] Transition déjà en cours, ignorée');
      return;
    }
    
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
    
    // ✅ NOUVEAU : Marquer la transition comme en cours
    setIsTransitioning(true);
    
    // ✅ CRITIQUE : Utiliser startTransition pour marquer le changement d'étape comme non-urgent
    // Cela permet à React de gérer les transitions de manière plus sûre et évite les erreurs removeChild
    startTransition(() => {
      // ✅ PROTECTION : Attendre que toutes les mises à jour d'état soient terminées avant de changer d'étape
      // Utiliser requestAnimationFrame pour s'assurer que React a terminé son cycle de rendu
      requestAnimationFrame(() => {
        setTimeout(() => {
          setCurrentStep(prev => {
            if (prev < steps.length - 1) {
              console.log(`✅ [BookingWizard] Transition de l'étape ${prev} vers ${prev + 1}`);
              // ✅ NOUVEAU : Réinitialiser l'état de transition après un délai supplémentaire
              setTimeout(() => setIsTransitioning(false), 200);
              return prev + 1;
            } else {
              setIsTransitioning(false);
              handleSubmit();
              return prev; // Ne pas changer l'étape si on soumet
            }
          });
        }, 100); // Délai augmenté pour laisser plus de temps à React
      });
    });
  };

  const handlePrevious = () => {
    // ✅ PROTECTION : Empêcher les transitions multiples simultanées
    if (isTransitioning) {
      console.warn('⚠️ [BookingWizard] Transition déjà en cours, ignorée');
      return;
    }
    
    // ✅ CRITIQUE : Utiliser startTransition pour marquer le changement d'étape comme non-urgent
    setIsTransitioning(true);
    startTransition(() => {
      setCurrentStep(prev => {
        if (prev > 0) {
          setTimeout(() => setIsTransitioning(false), 200);
          return prev - 1;
        }
        setIsTransitioning(false);
        return prev;
      });
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
      title: t('bookingWizard.creating.title'),
      description: t('bookingWizard.creating.desc'),
    });

    try {
      // ✅ VALIDATION CRITIQUE : Vérifier propertyId obligatoire
      if (!propertyId) {
        console.error('❌ Tentative de création booking sans propertyId');
        toast({
          title: t('bookingWizard.errorNoProperty.title'),
          description: t('bookingWizard.errorNoProperty.desc'),
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
          title: t('bookingWizard.sessionExpired.title'),
          description: t('bookingWizard.sessionExpired.desc'),
          variant: "destructive"
        });
        return;
      }

      console.log('🔍 PropertyId validé pour création booking:', propertyId);
      
      const bookingId = editingBooking?.id || uuidv4();
      // ✅ DÉFENSIF : formData.guests = invités extraits des pièces d'identité (nom du vrai guest)
      const currentGuests = Array.isArray(formData.guests) ? formData.guests : [];
      // Nom du guest principal : priorité aux invités enregistrés, sinon premier document extrait (flux host sans signature)
      const primaryGuestName = (currentGuests.length > 0
        ? (currentGuests[0].fullName || '').trim()
        : (formData.uploadedDocuments?.[0]?.extractedData as { fullName?: string } | undefined)?.fullName?.trim()) || null;
      const primaryGuestEmail = currentGuests.length > 0 && currentGuests[0].email
        ? (currentGuests[0].email || '').trim()
        : null;
      
      console.log('📊 [DIAGNOSTIC] État guests au début de handleSubmit:', {
        guestsCount: currentGuests.length,
        isArray: Array.isArray(formData.guests),
        primaryGuestName,
        guestsList: currentGuests.map(g => ({ id: g.id, fullName: g.fullName }))
      });
      

      if (!editingBooking) {
        // Create new booking with direct database calls to handle documents
        const { data: userData } = await supabase.auth.getUser();
        
        // ✅ FALLBACK : Utiliser l'userId initial si l'appel échoue (déconnexion temporaire)
        const userId = userData.user?.id || initialUserIdRef.current;
        
        // ✅ VALIDATION CRITIQUE : S'assurer que userId n'est JAMAIS null ou undefined
        if (!userId) {
          console.error('❌ [CRITICAL] userId est null ou undefined!', {
            userDataUserId: userData.user?.id,
            initialUserIdRef: initialUserIdRef.current,
            userData: userData
          });
          toast({
            title: t('bookingWizard.authError.title'),
            description: t('bookingWizard.authError.desc'),
            variant: "destructive"
          });
          setIsSubmitting(false);
          return;
        }
        
        console.log('✅ [VALIDATION] userId validé:', userId);

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
            title: t('bookingWizard.conflict.title'),
              description: t('bookingWizard.conflict.desc', { count: conflictingBookings.length }),
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
          hasGuests: currentGuests.length > 0,
          guestsCount: currentGuests.length
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
            title: t('bookingWizard.propertyError.title'),
            description: t('bookingWizard.propertyError.desc'),
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
            title: t('bookingWizard.permissionError.title'),
            description: t('bookingWizard.permissionError.desc'),
            variant: "destructive"
          });
          return;
        }

        console.log('✅ [DIAGNOSTIC] Propriété vérifiée:', propertyCheck.name);

        // ✅ PROTECTION ULTIME : Vérifier une dernière fois que userId n'est pas NULL
        if (!userId) {
          console.error('❌ [CRITICAL] userId est NULL juste avant insertion!');
          throw new Error('CRITICAL: userId is NULL before database insertion');
        }

        console.log('🔒 [SECURITY] userId confirmé avant insertion:', userId);

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
            guest_email: primaryGuestEmail || null, // ✅ Réservation host : email invité principal pour documents/signature
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
            title: t('bookingWizard.createError.title'),
            description: errorMessage,
            variant: "destructive"
          });
          throw bookingError;
        }

        if (!bookingData) {
          console.error('❌ [DIAGNOSTIC] Aucune donnée retournée après insertion');
          toast({
            title: t('bookingWizard.createError.title'),
            description: t('bookingWizard.createError.desc'),
            variant: "destructive"
          });
          return;
        }

        console.log('✅ [DIAGNOSTIC] Booking créé avec succès:', {
          id: bookingData.id,
          propertyId: bookingData.property_id,
          status: bookingData.status
        });

        // ✅ CRITIQUE : Stocker immédiatement les documents uploadés dans Storage maintenant qu'on a le bookingId
        // Note: On stocke AVANT l'insertion des guests pour pouvoir les lier ensuite
        if (formData.uploadedDocuments && formData.uploadedDocuments.length > 0) {
          console.log('💾 [STORAGE] Stockage immédiat des documents uploadés pour bookingId:', bookingData.id);
          const { DocumentStorageService } = await import('@/services/documentStorageService');
          
          for (const doc of formData.uploadedDocuments) {
            try {
              // Vérifier si le document a déjà une URL Storage (cas d'édition)
              const hasStorageUrl = doc.preview && (doc.preview.startsWith('http://') || doc.preview.startsWith('https://'));
              
              if (!hasStorageUrl) {
                // Stocker le document dans Storage + uploaded_documents (persistance pièce d'identité)
                const storageResult = await DocumentStorageService.storeDocument(doc.file, {
                  bookingId: bookingData.id,
                  fileName: doc.file.name,
                  extractedData: doc.extractedData,
                  documentType: 'identity' // ✅ Pièce d'identité pour réservation host (reconnu par la modale)
                  // Note: guestId sera mis à jour après l'insertion des guests
                });
                
                if (storageResult.success && storageResult.documentUrl) {
                  console.log('✅ [STORAGE] Document stocké:', {
                    fileName: doc.file.name,
                    url: storageResult.documentUrl.substring(0, 50) + '...',
                    path: storageResult.filePath
                  });
                  
                  // ✅ CRITIQUE : Mettre à jour formData avec l'URL Storage réelle pour la prévisualisation
                  // Cela remplace l'URL blob temporaire par l'URL permanente
                  const updatedDocs = formData.uploadedDocuments.map(d => 
                    d.id === doc.id 
                      ? { ...d, preview: storageResult.documentUrl! } as typeof doc
                      : d
                  );
                  
                  // Mettre à jour le state (même si on est en train de soumettre, cela aide pour les futurs re-renders)
                  updateFormData(prev => ({
                    ...prev,
                    uploadedDocuments: updatedDocs
                  }));
                  
                  console.log('✅ [STORAGE] Document mis à jour avec URL Storage dans formData');
                } else {
                  console.warn('⚠️ [STORAGE] Échec stockage document:', doc.file.name, storageResult.error);
                  toast({
                    title: t('bookingWizard.docNotSaved.title'),
                    description: t('bookingWizard.docNotSaved.desc', { filename: doc.file.name, error: storageResult.error || '' }),
                    variant: "destructive",
                  });
                }
              } else {
                console.log('ℹ️ [STORAGE] Document déjà stocké:', doc.file.name);
              }
            } catch (storageError) {
              console.error('❌ [STORAGE] Erreur stockage document:', doc.file.name, storageError);
              toast({
                title: t('bookingWizard.docError.title'),
                description: t('bookingWizard.docError.desc', { filename: doc.file.name }),
                variant: "destructive",
              });
            }
          }
        }

        // 2. Insert guests
        // ✅ DÉFENSIF : Vérifier que formData.guests est un tableau valide
        const guestsToInsert = Array.isArray(formData.guests) ? formData.guests : [];
        
        console.log('📊 [DIAGNOSTIC] Vérification guests avant insertion:', {
          guestsCount: guestsToInsert.length,
          isArray: Array.isArray(formData.guests),
          guestsList: guestsToInsert.map(g => ({ id: g.id, fullName: g.fullName }))
        });
        
        if (guestsToInsert.length > 0) {
          // ✅ Table guests n'a pas de colonne email — insertion via REST (pas via supabase.from().insert) pour éviter PGRST204.
          console.log('✅ [GUESTS] Insert via REST (corps sans email)');
          const guestsPayload: Array<{
            booking_id: string;
            full_name: string;
            date_of_birth: string | null;
            document_number: string;
            nationality: string;
            place_of_birth: string | null;
            document_type: 'passport' | 'national_id';
          }> = guestsToInsert.map(guest => {
            let dateOfBirth: string | null = null;
            if (guest.dateOfBirth) {
              if (guest.dateOfBirth instanceof Date) {
                dateOfBirth = guest.dateOfBirth.toISOString().split('T')[0];
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
              place_of_birth: guest.placeOfBirth ?? null,
              document_type: (guest.documentType || 'passport') as 'passport' | 'national_id'
            };
          });

          const { data: { session } } = await supabase.auth.getSession();
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
          const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
          const res = await fetch(`${supabaseUrl}/rest/v1/guests`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': anonKey || '',
              'Authorization': `Bearer ${session?.access_token || anonKey}`,
              'Prefer': 'return=representation'
            },
            body: JSON.stringify(guestsPayload)
          });

          if (!res.ok) {
            const errBody = await res.json().catch(() => ({}));
            const msg = (errBody as any)?.message || res.statusText;
            console.error('❌ [DIAGNOSTIC] Erreur insertion guests:', { code: res.status, message: msg });
            throw new Error(msg);
          }
          const insertedGuests = (await res.json()) as Array<{ id: string; full_name: string | null }>;
          console.log('✅ [DIAGNOSTIC] Guests insérés avec succès:', {
            count: insertedGuests?.length || 0,
            guests: insertedGuests?.map(g => ({ id: g.id, full_name: g.full_name }))
          });
          
          // ✅ CRITIQUE : Attendre un peu pour s'assurer que les guests sont bien visibles dans la base
          // Cela évite les problèmes de timing lors de la génération des documents
          console.log('⏳ [DIAGNOSTIC] Attente de 500ms pour garantir la visibilité des guests en base...');
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // ✅ VÉRIFICATION : Vérifier que les guests sont bien en base avant de continuer
          const { data: verifyGuests, error: verifyError } = await supabase
            .from('guests')
            .select('id, full_name')
            .eq('booking_id', bookingData.id);
          
          if (verifyError) {
            console.warn('⚠️ [DIAGNOSTIC] Erreur vérification guests:', verifyError);
          } else {
            console.log('✅ [DIAGNOSTIC] Vérification guests en base:', {
              count: verifyGuests?.length || 0,
              guests: verifyGuests?.map(g => ({ id: g.id, full_name: g.full_name }))
            });
            
            // ✅ CRITIQUE : Mettre à jour les documents avec les guestId réels maintenant qu'ils sont en base
            if (formData.uploadedDocuments && formData.uploadedDocuments.length > 0 && verifyGuests && verifyGuests.length > 0) {
              console.log('🔗 [STORAGE] Liaison des documents aux guests...');
              for (const doc of formData.uploadedDocuments) {
                if (doc.createdGuestId && doc.extractedData?.fullName) {
                  // Trouver le guest correspondant par nom (car createdGuestId est un UUID temporaire)
                  const docGuestName = doc.extractedData.fullName;
                  const matchingGuest = verifyGuests.find(g => {
                    return normName(g.full_name) === normName(docGuestName);
                  });
                  
                  if (matchingGuest) {
                    // Mettre à jour le document dans uploaded_documents avec le guestId réel
                    const { error: updateError } = await supabase
                      .from('uploaded_documents')
                      .update({ guest_id: matchingGuest.id })
                      .eq('booking_id', bookingData.id)
                      .eq('file_name', doc.file.name);
                    
                    if (updateError) {
                      console.warn('⚠️ [STORAGE] Erreur liaison document-guest:', updateError);
                    } else {
                      console.log('✅ [STORAGE] Document lié au guest:', doc.file.name, '->', matchingGuest.id);
                    }
                  } else {
                    console.warn('⚠️ [STORAGE] Guest correspondant non trouvé pour:', docGuestName);
                  }
                }
              }
            }
          }
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
            // ✅ DÉFENSIF : Utiliser currentGuests au lieu de formData.guests directement
            const guestsForGeneration = Array.isArray(formData.guests) ? formData.guests : [];
            if (guestsForGeneration.length === 0) {
              console.warn('⚠️ [AUTO-GEN] Aucun guest disponible pour la génération');
              return result;
            }
            const mainGuest = guestsForGeneration[0];
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
                  extractedData: doc.extractedData,
                  documentType: 'identity'
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

            console.log('📤 [AUTO-GEN] Appel Edge Function host_direct avec:', {
              bookingId,
              guestInfo: { ...guestInfo, email: guestInfo.email ? '***' : null },
              idDocumentsCount: idDocuments.length,
              bookingData: {
                checkIn: formData.checkInDate,
                checkOut: formData.checkOutDate,
                numberOfGuests: formData.numberOfGuests
              }
            });
            
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

            console.log('📥 [AUTO-GEN] Réponse Edge Function host_direct:', {
              hasError: !!error,
              errorMessage: error?.message,
              hasData: !!data,
              hasContractUrl: !!data?.contractUrl,
              hasPoliceUrl: !!data?.policeUrl,
              dataKeys: data ? Object.keys(data) : []
            });

              if (error) {
                console.error('❌ [AUTO-GEN] Erreur Edge Function host_direct:', error);
                throw error;
              }
              
              if (data) {
                result.contractUrl = data.contractUrl;
                result.policeUrl = data.policeUrl;
                console.log('✅ [AUTO-GEN] Génération réussie via host_direct:', {
                  hasContract: !!result.contractUrl,
                  hasPolice: !!result.policeUrl
                });
                return result;
              } else {
                console.warn('⚠️ [AUTO-GEN] Aucune donnée retournée par host_direct');
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
                  // ✅ NOUVEAU: Utiliser la nouvelle Edge Function dédiée
                  const { data: policeData, error: policeError } = await supabase.functions.invoke('generate-police-form', {
                    body: {
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
        // ✅ DÉFENSIF : Vérifier que formData.guests est un tableau valide
        const guestsForDocGeneration = Array.isArray(formData.guests) ? formData.guests : [];
        if (guestsForDocGeneration.length > 0) {
          console.log('🚀 [AUTO-GEN] Démarrage génération automatique des documents...');
          console.log('📊 [AUTO-GEN] Guests disponibles:', guestsForDocGeneration.length);
          
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
                guest_name: (guestsForDocGeneration[0]?.fullName || primaryGuestName || '').trim() || null
                  })
                  .eq('id', bookingData.id);

            await refreshBookings();
            
            // Message de succès adapté selon ce qui a été généré
            const generatedDocs = [];
            if (documentsResult.contractUrl) generatedDocs.push('contrat');
            if (documentsResult.policeUrl) generatedDocs.push('fiche de police');
            
            if (generatedDocs.length > 0) {
              toast({
                title: t('bookingWizard.success.title'),
                description: t('bookingWizard.success.desc', { docs: generatedDocs.join(' et '), plural: generatedDocs.length > 1 ? 's' : '' }),
              });
            } else {
            toast({
              title: t('bookingWizard.successBasic.title'),
                description: t('bookingWizard.successBasic.desc'),
              });
            }
          } catch (error) {
            console.error('❌ [AUTO-GEN] Erreur lors de la génération automatique:', error);
            // ✅ AMÉLIORATION : Ne pas bloquer le processus même si la génération échoue
            // La réservation est déjà créée, les documents pourront être générés manuellement plus tard
            await refreshBookings();
            toast({
              title: t('bookingWizard.successBasic.title'),
              description: t('bookingWizard.successManualDocs.desc'),
              variant: "default"
            });
          }
        } else if (formData.uploadedDocuments && formData.uploadedDocuments.length > 0) {
          // Fallback : Documents uploadés mais pas de guests → Juste stocker les documents (pièces d'identité)
          console.log('📄 Stockage des documents sans génération de contrat (pas de guests)');
          for (const doc of formData.uploadedDocuments) {
            try {
              const { DocumentStorageService } = await import('@/services/documentStorageService');
              const result = await DocumentStorageService.storeDocument(doc.file, {
                bookingId: bookingData.id,
                fileName: doc.file.name,
                extractedData: doc.extractedData,
                documentType: 'identity'
              });

              if (!result.success) {
                console.error('Failed to store document:', result.error);
                toast({
                  title: t('bookingWizard.docNotSaved.title'),
                  description: result.error || t('bookingWizard.docNotSaved.desc', { filename: doc.file.name, error: '' }),
                  variant: "destructive",
                });
              }
            } catch (error) {
              console.error('❌ Error storing document:', error);
              toast({
                title: t('bookingWizard.docError.title'),
                description: t('bookingWizard.docError.desc', { filename: doc.file.name }),
                variant: "destructive",
              });
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
          status: formData.guests.length > 0 ? 'confirmed' : 'pending'
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

            // Insert new guests via REST (pas d'email — table guests sans colonne email)
            if (formData.guests.length > 0) {
              const guestsPayloadEdit: Array<{
                booking_id: string;
                full_name: string;
                date_of_birth: string | null;
                document_number: string;
                nationality: string;
                place_of_birth: string | null;
                document_type: 'passport' | 'national_id';
              }> = formData.guests.map(guest => {
                let dateOfBirth: string | null = null;
                if (guest.dateOfBirth) {
                  if (guest.dateOfBirth instanceof Date) {
                    dateOfBirth = guest.dateOfBirth.toISOString().split('T')[0];
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
                  place_of_birth: guest.placeOfBirth ?? null,
                  document_type: (guest.documentType || 'passport') as 'passport' | 'national_id'
                };
              });
              const { data: { session } } = await supabase.auth.getSession();
              const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
              const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
              const resEdit = await fetch(`${supabaseUrl}/rest/v1/guests`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'apikey': anonKey || '',
                  'Authorization': `Bearer ${session?.access_token || anonKey}`,
                  'Prefer': 'return=minimal'
                },
                body: JSON.stringify(guestsPayloadEdit)
              });
              if (!resEdit.ok) {
                const errBody = await resEdit.json().catch(() => ({}));
                throw new Error((errBody as any)?.message || resEdit.statusText);
              }
            }
          }
          
          console.log('✅ Guests synchronized successfully');
        } catch (guestSyncError) {
          console.error('❌ Critical error during guest sync:', guestSyncError);
          toast({
            title: t('bookingWizard.syncError.title'),
            description: t('bookingWizard.syncError.desc'),
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
      // ✅ DÉFENSIF : Vérifier que formData.guests est un tableau valide
      const finalGuestsCheck = Array.isArray(formData.guests) ? formData.guests : [];
      if (editingBooking || !formData.uploadedDocuments || formData.uploadedDocuments.length === 0 || finalGuestsCheck.length === 0) {
        toast({
          title: editingBooking ? t('bookingWizard.updated.title') : t('bookingWizard.created.title'),
          description: editingBooking 
            ? t('bookingWizard.updated.desc')
            : t('bookingWizard.created.desc'),
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
        title: t('bookingWizard.saveError.title'),
        description: t('bookingWizard.saveError.desc'),
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
          {/* ✅ CRITIQUE : Wrapper avec état de transition pour éviter les erreurs removeChild */}
          {/* Utiliser un div wrapper avec une clé stable pour forcer React à bien gérer la transition */}
          {isTransitioning ? (
            <div key="transition-loader" className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div 
              key={`step-wrapper-${currentStep}-${editingBooking?.id || 'new'}`}
              // ✅ CRITIQUE : Ajouter un style pour forcer le re-render propre et éviter les conflits DOM
              style={{ minHeight: '200px' }}
            >
              <CurrentStepComponent
                key={`step-${currentStep}-${editingBooking?.id || 'new'}-${isTransitioning ? 'transitioning' : 'stable'}`}
                formData={formData}
                updateFormData={updateFormData}
                propertyId={propertyId}
                bookingId={editingBooking?.id}
              />
            </div>
          )}
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
              disabled={!isStepValid || isSubmitting || isTransitioning}
              variant={currentStep === steps.length - 1 ? "success" : "professional"}
              key={`next-button-${currentStep}-${isSubmitting ? 'submitting' : 'idle'}-${editingBooking ? 'edit' : 'new'}`}
            >
              {/* ✅ CRITIQUE : Utiliser un fragment avec key pour stabiliser le contenu conditionnel */}
              {(() => {
                if (isSubmitting) {
                  return (
                    <span key="submitting-content">
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {currentStep === steps.length - 1 ? 'Création en cours...' : 'Traitement...'}
                    </span>
                  );
                }
                if (currentStep === steps.length - 1) {
                  return (
                    <span key="final-step-content">
                      <Check className="w-4 h-4 mr-2" />
                      {editingBooking ? 'Mettre à jour' : 'Créer la réservation'}
                    </span>
                  );
                }
                return (
                  <span key="next-content">
                    Suivant
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </span>
                );
              })()}
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
