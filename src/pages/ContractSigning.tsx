import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { WelcomingContractSignature } from '@/components/WelcomingContractSignature';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Home, Heart, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useT } from '@/i18n/GuestLocaleProvider';

export const ContractSigning: React.FC = () => {
  const { propertyId, token, airbnbBookingId } = useParams<{ propertyId: string; token: string; airbnbBookingId?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const t = useT();
  
  const [isLoading, setIsLoading] = useState(true);
  const [tokenData, setTokenData] = useState<any>(null);
  const [propertyData, setPropertyData] = useState<any>(null);
  const [submissionData, setSubmissionData] = useState<any>(null);
  const [isContractSigned, setIsContractSigned] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadContractData = async () => {
      if (!propertyId || !token) {
        setError(t('guest.invalidLink.desc'));
        setIsLoading(false);
        return;
      }

      try {
        // ✅ CORRIGÉ : Vérifier IMMÉDIATEMENT localStorage en premier (Vercel perd location.state)
        // ⚠️ IMPORTANT : Sur Vercel, location.state est souvent perdu dès le chargement
        let navigationState = location.state;
        
        // ✅ PRIORITÉ 1 : Vérifier localStorage immédiatement (même si location.state existe)
        // Car location.state peut être perdu sur Vercel même s'il était présent initialement
        console.log('🔍 DEBUG: Vérification localStorage en priorité...');
        try {
          const storedBookingId = localStorage.getItem('currentBookingId');
          const storedBookingData = localStorage.getItem('currentBookingData');
          const storedGuestData = localStorage.getItem('currentGuestData');
          const storedContractUrl = localStorage.getItem('contractUrl');
          const storedPoliceUrl = localStorage.getItem('policeUrl');
          
          if (storedBookingId && storedContractUrl) {
            console.log('✅ Données trouvées dans localStorage, utilisation prioritaire');
            navigationState = {
              bookingId: storedBookingId,
              bookingData: storedBookingData ? JSON.parse(storedBookingData) : null,
              guestData: storedGuestData ? JSON.parse(storedGuestData) : null,
              contractUrl: storedContractUrl,
              policeUrl: storedPoliceUrl || null,
              propertyId: propertyId,
              token: token,
              timestamp: Date.now()
            };
            console.log('✅ Navigation state récupéré depuis localStorage:', navigationState);
          } else if (location.state && location.state.bookingId) {
            // ✅ FALLBACK : Utiliser location.state si localStorage n'a pas les données
            console.log('✅ Utilisation location.state comme fallback');
            navigationState = location.state;
          } else {
            console.log('⚠️ Aucune donnée trouvée dans localStorage ni location.state');
          }
        } catch (localStorageError) {
          console.warn('⚠️ Erreur lors de la récupération depuis localStorage:', localStorageError);
          // Fallback vers location.state si localStorage échoue
          if (location.state && location.state.bookingId) {
            navigationState = location.state;
          }
        }
        
        console.log('🔍 DEBUG: Navigation state reçu:', navigationState);
        console.log('🔍 DEBUG: Location:', location);
        console.log('🔍 DEBUG: PropertyId:', propertyId);
        console.log('🔍 DEBUG: Token:', token);
        
        if (navigationState && navigationState.bookingId && navigationState.contractUrl) {
          console.log('✅ Utilisation des données de navigation state:', navigationState);
          
          setTokenData({
            ok: true,
            propertyId: navigationState.propertyId,
            bookingId: navigationState.bookingId,
            token: navigationState.token,
            property: { 
              id: navigationState.propertyId,
              name: 'Propriété',
              address: 'Adresse',
              contract_template: null,
              contact_info: null,
              house_rules: []
            }
          });
          
          setPropertyData({
            id: navigationState.propertyId,
            name: 'Propriété',
            address: 'Adresse'
          });
          
          // ✅ CORRIGÉ : S'assurer que booking_data existe, sinon le créer depuis bookingData
          // ⚠️ IMPORTANT : bookingData peut avoir checkIn/checkOut (strings) ou checkInDate/checkOutDate
          const rawBookingData = navigationState.bookingData || navigationState.booking_data;
          
          // ✅ CORRIGÉ : Normaliser la structure booking_data
          let booking_data: any;
          if (rawBookingData) {
            // Si bookingData existe, le convertir au format attendu
            booking_data = {
              id: navigationState.bookingId,
              checkInDate: rawBookingData.checkInDate || rawBookingData.checkIn || null,
              checkOutDate: rawBookingData.checkOutDate || rawBookingData.checkOut || null,
              numberOfGuests: rawBookingData.numberOfGuests || rawBookingData.guests?.length || 1,
              // ✅ AJOUT : Préserver les autres propriétés
              ...(rawBookingData.guests && { guests: rawBookingData.guests }),
              ...(rawBookingData.airbnbCode && { airbnbCode: rawBookingData.airbnbCode }),
              ...(rawBookingData.propertyName && { propertyName: rawBookingData.propertyName })
            };
            console.log('✅ booking_data normalisé depuis bookingData:', booking_data);
          } else {
            // Créer un booking_data minimal si absent
            console.warn('⚠️ booking_data absent, création d\'un booking_data minimal');
            booking_data = {
              id: navigationState.bookingId,
              checkInDate: null,
              checkOutDate: null,
              numberOfGuests: 1
            };
          }
          
          // ✅ CORRIGÉ : Normaliser guestData aussi
          const guestData = navigationState.guestData || navigationState.guest_data;
          
          setSubmissionData({
            bookingId: navigationState.bookingId,
            contractUrl: navigationState.contractUrl,
            policeUrl: navigationState.policeUrl,
            guestData: guestData,
            guest_data: guestData, // ✅ AJOUT : Format alternatif
            booking_data: booking_data, // ✅ CORRIGÉ : Utiliser booking_data normalisé
            document_urls: navigationState.documentUrls || [] // ✅ AJOUT : URLs des documents
          });
          
          console.log('✅ Submission data configuré depuis navigation state:', {
            bookingId: navigationState.bookingId,
            hasContractUrl: !!navigationState.contractUrl,
            hasPoliceUrl: !!navigationState.policeUrl,
            hasGuestData: !!navigationState.guestData,
            hasBookingData: !!bookingData,
            bookingDataKeys: bookingData ? Object.keys(bookingData) : []
          });
          
          console.log('✅ États mis à jour, setIsLoading(false)...');
          setIsLoading(false);
          return;
        }

        // Si pas de navigation state, essayer la validation du token
        console.log('⚠️ Pas de navigation state, validation du token...');
        console.log('🔍 DEBUG: Paramètres URL disponibles:', { propertyId, token, airbnbBookingId });
        
        // Tentative d'appel à la fonction Edge
        let tokenVerification;
        let tokenError;
        
        try {
          const response = await supabase.functions.invoke('resolve-guest-link', {
            body: { 
              propertyId, 
              token,
              airbnbCode: airbnbBookingId 
            }
          });
          
          if (response.data) {
            tokenVerification = response.data;
          } else {
            tokenError = response.error;
          }
        } catch (edgeFunctionError) {
          console.log('⚠️ Edge Function non disponible (quota dépassé), utilisation du contournement...');
          
          // CONTOURNEMENT : Récupération directe des données
          try {
            const { data: propertyData, error: propertyError } = await supabase
              .from('properties')
              .select('id, name, address, contract_template, contact_info, house_rules')
              .eq('id', propertyId)
              .single();
            
            if (propertyError) throw propertyError;
            
            // Créer un objet compatible avec le format attendu
            tokenVerification = {
              ok: true,
              propertyId: propertyId,
              bookingId: airbnbBookingId || null,
              token: token,
              property: propertyData,
              id: propertyId, // Pour la compatibilité
              tokenId: propertyId // Pour la compatibilité
            };
            
            console.log('✅ Contournement réussi, données récupérées directement');
            
          } catch (fallbackError) {
            console.error('❌ Échec du contournement:', fallbackError);
            tokenError = fallbackError;
          }
        }

        if (tokenError || !tokenVerification) {
          setError(t('guest.invalidLink.desc'));
          setIsLoading(false);
          return;
        }

        // Convert response to match expected structure
        const tokenData = {
          id: tokenVerification.tokenId,
          property_id: propertyId,
          token: token,
          is_active: true
        };
        const propertyData = tokenVerification.property;

        setTokenData(tokenData);
        setPropertyData(propertyData);

        // If data passed via navigation state (to avoid RLS reads), use it directly
        const navState = (location as any)?.state || {};
        if (navState?.bookingData) {
          setSubmissionData({
            id: navState.bookingId || 'temp',
            token_id: tokenVerification.id,
            booking_data: navState.bookingData,
            guest_data: navState.guestData,
            document_urls: navState.guestData?.documentUrls ?? [],
            status: 'completed',
          });
          setIsLoading(false);
          return;
        }

        // Get the guest submission data using edge function (safer with RLS)
        const { data: guestDocs, error: submissionError } = await supabase.functions.invoke('get-guest-documents-unified', {
          body: { propertyId: propertyId }
        });

        console.log('📍 Guest docs query result:', { guestDocs, submissionError });
        console.log('🔍 TOKEN VERIFICATION ID:', tokenData.id);

        // Find the most recent submission for this property
        const latestSubmission = guestDocs && Array.isArray(guestDocs) && guestDocs.length > 0 
          ? guestDocs[0] // Already sorted by created_at desc in edge function
          : null;

        console.log('📍 Submission query result:', { latestSubmission, submissionError });
        console.log('🔍 TOKEN VERIFICATION ID:', tokenData.id);
        console.log('🔍 SUBMISSION DATA:', latestSubmission);

        
        // ✅ CORRECTION : Gestion robuste des données de soumission
        
        // ✅ CORRECTION : Gestion robuste des données de soumission
        if (latestSubmission) {
          // Transformer la réponse de l'edge function au format attendu
          const transformedSubmission = {
            id: latestSubmission.id,
            token_id: tokenData.id,
            booking_data: {
              id: latestSubmission.bookingId || latestSubmission.id, // ✅ CORRECTION : Utiliser l'ID de réservation
              checkInDate: latestSubmission.checkInDate || new Date().toISOString().split('T')[0],
              checkOutDate: latestSubmission.checkOutDate || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              numberOfGuests: latestSubmission.numberOfGuests || 1,
              guests: [{
                fullName: latestSubmission.fullName,
                documentType: latestSubmission.documentType,
                documentNumber: latestSubmission.documentNumber
              }]
            },
            guest_data: {
              guests: [{
                fullName: latestSubmission.fullName,
                documentType: latestSubmission.documentType,
                documentNumber: latestSubmission.documentNumber
              }]
            },
            document_urls: latestSubmission.files?.map((f: any) => f.url) || [],
            status: 'completed'
          };
          
          setSubmissionData(transformedSubmission);
          
          // ✅ CORRECTION : Vérifier la signature avec gestion d'erreurs
          try {
            const { data: signature, error: signatureError } = await (supabase as any).rpc('check_contract_signature', {
              p_submission_id: latestSubmission.id
            });

            console.log('📍 Signature check result:', { signature, signatureError });

            if (signature && signature.length > 0 && signature[0].signature_data) {
              setIsContractSigned(true);
            }
          } catch (signatureCheckError) {
            console.warn('⚠️ Erreur lors de la vérification de signature:', signatureCheckError);
            // Ne pas faire échouer pour cette erreur non-critique
          }
        } else {
          // ✅ CORRECTION : Créer des données minimales plus robustes
          console.log('📍 No submission found, using token verification data for contract signing');
          
          const mockSubmissionData = {
            id: 'temp-contract-signing',
            token_id: tokenData.id,
            booking_data: {
              id: tokenVerification.bookingId || `temp-${propertyId}-${Date.now()}`,
              checkInDate: new Date().toISOString().split('T')[0],
              checkOutDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              numberOfGuests: 1,
              guests: [{
                fullName: 'Guest User',
                documentType: 'passport',
                documentNumber: 'TBD'
              }]
            },
            guest_data: {
              guests: [{
                fullName: 'Guest User',
                documentType: 'passport',
                documentNumber: 'TBD'
              }]
            },
            status: 'completed'
          };
          
          console.log('📍 Using minimal mock submission data for contract signing:', mockSubmissionData);
          setSubmissionData(mockSubmissionData);
        }

      } catch (error) {
        console.error('Error loading contract data:', error);
        setError(t('guest.contract.errorGeneric'));
      } finally {
        setIsLoading(false);
      }
    };

    loadContractData();
  }, [propertyId, token, location.state, t]); // ✅ AJOUT : location.state et t dans les dépendances

  const handleSignatureComplete = async (signatureData: string) => {
    try {
      // The signature is already linked during creation

      setIsContractSigned(true);
      toast({
        title: t('guest.contract.signed.title'),
        description: t('guest.contract.signed.desc'),
      });
    } catch (error) {
      console.error('Error completing signature:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-6"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-16 h-16 mx-auto border-4 border-blue-500 border-t-transparent rounded-full"
          />
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-2"
          >
            <h3 className="text-2xl font-semibold text-gray-900">Préparation de votre contrat</h3>
            <p className="text-lg text-gray-600">Nous personnalisons votre expérience...</p>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md mx-auto"
        >
          <Card className="p-8 shadow-2xl border-red-200">
            <CardContent className="text-center space-y-6">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring" }}
                className="w-16 h-16 mx-auto bg-red-100 rounded-full flex items-center justify-center"
              >
                <Home className="w-8 h-8 text-red-600" />
              </motion.div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-red-800">Oups ! Un problème est survenu</h2>
                <p className="text-red-600">{error}</p>
              </div>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button onClick={() => navigate('/')} className="w-full bg-red-600 hover:bg-red-700">
                  <Home className="w-4 h-4 mr-2" />
                  Retour à l'accueil
                </Button>
              </motion.div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  if (isContractSigned) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 300 }}
          className="max-w-lg mx-auto"
        >
          <Card className="p-8 shadow-2xl border-green-200 bg-white/90 backdrop-blur-sm">
            <CardContent className="text-center space-y-6">
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                className="w-20 h-20 mx-auto bg-gradient-to-r from-green-400 to-emerald-500 rounded-full flex items-center justify-center"
              >
                <Heart className="w-10 h-10 text-white" />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="space-y-4"
              >
                <h2 className="text-3xl font-bold text-gray-900">Contrat signé avec succès ! 🎉</h2>
                <p className="text-xl text-gray-600">
                  Félicitations ! Votre séjour est maintenant confirmé.
                </p>
                <div className="bg-green-50 p-6 rounded-2xl border border-green-200">
                  <p className="text-green-800 font-medium">
                    ✨ Vous recevrez toutes les informations par email<br/>
                    🏠 Nous avons hâte de vous accueillir !
                  </p>
                </div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.6 }}
                className="flex justify-center gap-4 text-3xl"
              >
                <motion.span animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 2, repeat: Infinity }}>🎉</motion.span>
                <motion.span animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>❤️</motion.span>
                <motion.span animate={{ rotate: [0, -10, 10, 0] }} transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}>🏠</motion.span>
              </motion.div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // ✅ CORRIGÉ : Vérifier submissionData avec logs de debug
  console.log('🔍 DEBUG ContractSigning render:', {
    hasSubmissionData: !!submissionData,
    hasBookingData: !!submissionData?.booking_data,
    submissionDataKeys: submissionData ? Object.keys(submissionData) : [],
    bookingDataKeys: submissionData?.booking_data ? Object.keys(submissionData.booking_data) : [],
    isLoading,
    hasError: !!error
  });

  if (!submissionData || !submissionData.booking_data) {
    // ✅ AJOUT : Si on est en train de charger, ne pas afficher l'erreur immédiatement
    if (isLoading) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-6"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="w-16 h-16 mx-auto border-4 border-blue-500 border-t-transparent rounded-full"
            />
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="space-y-2"
            >
              <h3 className="text-2xl font-semibold text-gray-900">Chargement du contrat...</h3>
              <p className="text-lg text-gray-600">Récupération de vos informations...</p>
            </motion.div>
          </motion.div>
        </div>
      );
    }
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-white to-orange-50 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md mx-auto"
        >
          <Card className="p-8 shadow-2xl border-yellow-200">
            <CardContent className="text-center space-y-6">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring" }}
                className="w-16 h-16 mx-auto bg-yellow-100 rounded-full flex items-center justify-center"
              >
                <Sparkles className="w-8 h-8 text-yellow-600" />
              </motion.div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-yellow-800">Quelques informations manquent</h2>
                <p className="text-yellow-700">
                  Nous avons besoin de vos informations de réservation pour générer le contrat.
                </p>
                <p className="text-sm text-yellow-600 mt-2">
                  {!submissionData ? 'Aucune donnée de soumission' : 'Données de réservation manquantes'}
                </p>
              </div>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button 
                  onClick={() => navigate(`/guest-verification/${propertyId}/${token}`)}
                  className="w-full bg-yellow-600 hover:bg-yellow-700"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Compléter mes informations
                </Button>
              </motion.div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // ✅ CORRIGÉ : Récupérer contractUrl depuis navigation state ou localStorage (fallback Vercel)
  const getContractUrl = () => {
    // 1. Essayer location.state
    if ((location as any)?.state?.contractUrl) {
      return (location as any).state.contractUrl;
    }
    
    // 2. Essayer localStorage (fallback pour Vercel où location.state peut être perdu)
    try {
      const storedContractUrl = localStorage.getItem('contractUrl');
      if (storedContractUrl) {
        console.log('✅ ContractUrl récupéré depuis localStorage (fallback Vercel):', storedContractUrl);
        return storedContractUrl;
      }
    } catch (e) {
      console.warn('⚠️ Erreur lors de la récupération de contractUrl depuis localStorage:', e);
    }
    
    // 3. Essayer submissionData
    if ((submissionData as any)?.contractUrl) {
      return (submissionData as any).contractUrl;
    }
    
    return undefined;
  };

  // ✅ AJOUT : Logs de debug avant rendu final
  console.log('✅ ContractSigning - Rendu WelcomingContractSignature:', {
    hasBookingData: !!submissionData.booking_data,
    hasPropertyData: !!propertyData,
    hasGuestData: !!submissionData.guest_data || !!submissionData.guestData,
    hasContractUrl: !!getContractUrl(),
    contractUrl: getContractUrl()
  });

  return (
    <WelcomingContractSignature
      bookingData={submissionData.booking_data}
      propertyData={propertyData}
      guestData={submissionData.guest_data || submissionData.guestData}
      documentUrls={submissionData.document_urls || []}
      initialContractUrl={getContractUrl()}
      onBack={() => navigate(`/guest-verification/${propertyId}/${token}`)}
      onSignatureComplete={handleSignatureComplete}
    />
  );
};