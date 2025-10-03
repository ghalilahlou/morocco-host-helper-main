/**
 * Page de vérification invité avec stepper - NOUVELLE VERSION avec booking-resolve
 * Route: /verify/:token
 * Workflow: Code Airbnb → Upload ID → Signature → Confirmation
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle, 
  Lock, 
  Upload, 
  Calendar, 
  MapPin, 
  User, 
  FileText, 
  Loader2,
  AlertTriangle,
  Download,
  Sparkles,
  Shield,
  ArrowRight,
  Home,
  Clock
} from 'lucide-react';

import { SignaturePad } from '@/components/SignaturePad';
import { resolveBooking, formatBookingDate, calculateNights, type ResolvedBooking } from '@/services/bookingResolve';
import { EnhancedLoader } from '@/components/ui/enhanced-loader';
import { ConfettiEffect, useConfetti } from '@/components/ui/confetti-effect';
import '@/styles/verify-token.css';
import { 
  submitDocumentsUnified, 
  validateGuestInfo, 
  validateIdDocuments, 
  downloadContract,
  type GuestInfo, 
  type IdDocument, 
  type GeneratedDocuments 
} from '@/services/documentServiceUnified';

// Types pour les étapes (suppression de 'info' - extraction automatique depuis les documents)
type VerificationStep = 'code' | 'documents' | 'signature' | 'confirmation';

interface VerificationState {
  step: VerificationStep;
  booking: ResolvedBooking | null;
  guestInfo: Partial<GuestInfo>;
  idDocuments: IdDocument[];
  signature: string | null;
  generatedDocuments: GeneratedDocuments | null;
  isLoading: boolean;
  error: string | null;
}

export function VerifyToken() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isActive: confettiActive, trigger: triggerConfetti } = useConfetti();

  const [state, setState] = useState<VerificationState>({
    step: 'code',
    booking: null,
    guestInfo: {},
    idDocuments: [],
    signature: null,
    generatedDocuments: null,
    isLoading: false,
    error: null
  });

  const [airbnbCode, setAirbnbCode] = useState('');

  // Vérifier que le token est présent
  useEffect(() => {
    if (!token) {
      toast({
        title: "Lien invalide",
        description: "Le lien de vérification est invalide ou malformé",
        variant: "destructive",
      });
      navigate('/');
    }
  }, [token, navigate]);

  // Calculer le progrès (ajusté sans l'étape 'info')
  const getProgress = (): number => {
    const steps: Record<VerificationStep, number> = {
      code: 25,
      documents: 50,
      signature: 75,
      confirmation: 100
    };
    return steps[state.step] || 0;
  };

  // Étape 1: Résoudre le code Airbnb
  const handleResolveCode = async () => {
    if (!airbnbCode.trim()) {
      toast({
        title: "Code requis",
        description: "Veuillez saisir votre code de confirmation Airbnb",
        variant: "destructive",
      });
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      console.log('🔍 Calling resolveBooking with:', { token, airbnbCode });
      const booking = await resolveBooking(token!, airbnbCode);
      
      setState(prev => ({
        ...prev,
        booking,
        step: 'documents', // Passer directement aux documents
        isLoading: false
      }));

      toast({
        title: "Réservation trouvée",
        description: `Séjour du ${formatBookingDate(booking.checkIn)} au ${formatBookingDate(booking.checkOut)}. Veuillez uploader vos documents d'identité.`,
      });

    } catch (error) {
      console.error('❌ Error resolving booking:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Erreur de résolution',
        isLoading: false
      }));
    }
  };

  // Étape 2 supprimée: Validation automatique via extraction des documents

  // Étape 3: Upload documents (simulation)
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const { OpenAIDocumentService } = await import('@/services/openaiDocumentService');
      
      for (const file of Array.from(files)) {
        // ✅ CORRECTION : Convertir le fichier en data: URL
        const reader = new FileReader();
        reader.readAsDataURL(file);
        const dataUrl = await new Promise<string>((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
        });

        // Créer le document avec état de traitement
        const tempDoc: IdDocument = {
          name: file.name,
          url: dataUrl,  // Utiliser data: URL au lieu de blob:
          type: file.type,
          file
        };

        setState(prev => ({
          ...prev,
          idDocuments: [...prev.idDocuments, tempDoc]
        }));

        try {
          // Extraire les données automatiquement
          const extractedData = await OpenAIDocumentService.extractDocumentData(file);
          
          if (extractedData && extractedData.fullName && extractedData.documentNumber) {
            // Mettre à jour les informations invité automatiquement
            setState(prev => ({
              ...prev,
              guestInfo: {
                ...prev.guestInfo,
                firstName: extractedData.fullName?.split(' ')[0] || '',
                lastName: extractedData.fullName?.split(' ').slice(1).join(' ') || '',
                nationality: extractedData.nationality || '',
                idType: extractedData.documentType || '',
                idNumber: extractedData.documentNumber || '',
                dateOfBirth: extractedData.dateOfBirth || '', // ✅ CORRECTION: Ajouter la date de naissance
              }
            }));

            // ✅ DEBUG: Vérifier que la date de naissance a été mise à jour
            console.log('🔍 DEBUG - State mis à jour avec dateOfBirth:', {
              extractedDateOfBirth: extractedData.dateOfBirth,
              hasDateOfBirth: !!extractedData.dateOfBirth,
              fullExtractedData: extractedData
            });

            toast({
              title: "Document analysé",
              description: `Informations extraites: ${extractedData.fullName}`,
            });
          } else {
            toast({
              title: "Document ajouté",
              description: "Document ajouté, extraction manuelle requise",
              variant: "default",
            });
          }
        } catch (extractError) {
          console.warn('Extraction failed for', file.name, extractError);
          toast({
            title: "Document ajouté",
            description: "Document ajouté, extraction automatique échouée",
            variant: "default",
          });
        }
      }

      toast({
        title: "Documents traités",
        description: `${files.length} document(s) analysé(s) avec succès`,
      });

    } catch (error) {
      toast({
        title: "Erreur",
        description: "Erreur lors du traitement des documents",
        variant: "destructive",
      });
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const handleValidateDocuments = async () => {
    const errors = validateIdDocuments(state.idDocuments);
    
    if (errors.length > 0) {
      toast({
        title: "Documents manquants",
        description: errors.join(', '),
        variant: "destructive",
      });
      return;
    }

    // Passer à l'étape signature et créer la réservation + contrat
    setState(prev => ({ ...prev, step: 'signature', isLoading: true }));
    
    try {
      // ✨ NOUVEAU WORKFLOW UNIFIÉ - Un seul appel pour tout
      console.log('🚀 [VerifyToken] Using unified workflow...');
      
      const documents = await submitDocumentsUnified({
        token: token!,
        airbnbCode: state.booking!.airbnbCode,
        guestInfo: state.guestInfo as GuestInfo,
        idDocuments: state.idDocuments,
        // Pas encore de signature à cette étape
        signature: undefined
      });

      setState(prev => ({
        ...prev,
        generatedDocuments: documents,
        isLoading: false,
        // Stocker le bookingId pour la finalisation
        metadata: { bookingId: documents.bookingId }
      }));

      toast({
        title: "Documents générés avec succès !",
        description: "Contrat et fiche de police créés. Vous pouvez maintenant les consulter et signer.",
      });

    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Erreur de génération',
        isLoading: false
      }));

      toast({
        title: "Erreur",
        description: "Impossible de générer le contrat. Veuillez réessayer.",
        variant: "destructive",
      });
    }
  };

  // ✅ FONCTION DE DIAGNOSTIC : Vérifier l'état du système
  const diagnoseSystem = async () => {
    try {
      console.log('🔍 [diagnoseSystem] Starting system diagnosis...');
      
      const { supabase } = await import('@/integrations/supabase/client');
      
      // 1. Vérifier l'authentification
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      console.log('🔍 [diagnoseSystem] Auth status:', { user: !!user, error: authError });
      
      // 2. Vérifier la connexion à la base
      const { data: testData, error: testError } = await supabase
        .from('bookings')
        .select('id')
        .limit(1);
      console.log('🔍 [diagnoseSystem] Database connection:', { success: !testError, error: testError });
      
      // 3. Vérifier les permissions
      const { data: permissions, error: permError } = await supabase
        .from('bookings')
        .select('id, status')
        .limit(1);
      console.log('🔍 [diagnoseSystem] Permissions:', { success: !permError, error: permError });
      
      return {
        auth: !authError,
        database: !testError,
        permissions: !permError
      };
    } catch (error) {
      console.error('❌ [diagnoseSystem] Diagnosis failed:', error);
      return { auth: false, database: false, permissions: false };
    }
  };

  // Finaliser la réservation complète avec tous les documents
  const finalizeReservation = async (signedDocuments: GeneratedDocuments, signatureData: string, bookingId: string) => {
    try {
      console.log('🎯 [finalizeReservation] Starting reservation finalization with bookingId:', bookingId);
      
      // ✅ DIAGNOSTIC : Vérifier l'état du système avant de continuer
      const systemStatus = await diagnoseSystem();
      if (!systemStatus.auth || !systemStatus.database || !systemStatus.permissions) {
        throw new Error('Système non disponible. Vérifiez votre connexion et réessayez.');
      }
      
      // 1. Générer la police automatiquement
      console.log('👮 [finalizeReservation] Generating police form...');
      
      // ✅ CORRECTION : Utiliser edgeClient au lieu de supabase.functions.invoke
      const { edgeClient } = await import('@/lib/edgeClient');
      
      const policeResponse = await edgeClient.post('/submit-guest-info-unified', {
        bookingId: bookingId,
        action: 'generate_police_only'
      });
      
      if (policeResponse.success) {
        console.log('✅ [finalizeReservation] Police form generated successfully');
      } else {
        console.warn('⚠️ [finalizeReservation] Police form generation failed:', policeResponse.error);
      }
      
      // 2. La réservation est déjà créée et gérée par la Edge Function
      // Pas besoin d'accéder directement à la table bookings depuis le client
      console.log('✅ [finalizeReservation] Booking managed by Edge Function');
      console.log('✅ [finalizeReservation] Booking ID:', bookingId);
      console.log('✅ [finalizeReservation] Police form:', policeResponse.success ? 'Generated' : 'Skipped');
      console.log('✅ [finalizeReservation] Contract URL:', signedDocuments.contractUrl);
      console.log('✅ [finalizeReservation] Reservation finalized successfully')
      
    } catch (error) {
      console.error('❌ [finalizeReservation] Error finalizing reservation:', error);
      
      // ✅ CORRECTION : Gestion d'erreur détaillée pour l'utilisateur
      if (error instanceof Error) {
        if (error.message.includes('authentication')) {
          throw new Error('Problème d\'authentification. Veuillez vous reconnecter.');
        } else if (error.message.includes('booking')) {
          throw new Error('Impossible de finaliser la réservation. Veuillez réessayer.');
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          throw new Error('Problème de connexion. Vérifiez votre connexion internet.');
        }
      }
      
      throw error;
      // Ne pas faire échouer le processus principal pour ces erreurs
    }
  };

  // Étape 4: Signature réelle
  const handleSignature = async (signatureData: string) => {
    if (!state.generatedDocuments) {
      toast({
        title: "Erreur",
        description: "Aucun contrat disponible pour signature",
        variant: "destructive",
      });
      return;
    }

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      // ✨ NOUVEAU : Générer le contrat avec signature via le workflow unifié
      console.log('📝 [VerifyToken] Saving signature with unified workflow...');
      
      const signedDocuments = await submitDocumentsUnified({
        token: token!,
        airbnbCode: state.booking!.airbnbCode,
        guestInfo: state.guestInfo as GuestInfo,
        idDocuments: state.idDocuments,
        signature: {
          data: signatureData,
          timestamp: new Date().toISOString()
        }
      });

      // Finaliser la réservation complète
      console.log('🎯 [VerifyToken] Finalizing complete reservation...');
      console.log('🎯 [VerifyToken] Booking data:', state.booking);
      console.log('🎯 [VerifyToken] Guest info:', state.guestInfo);
      
      // Récupérer le bookingId depuis les métadonnées stockées
      const storedBookingId = (state as any).metadata?.bookingId;
      if (storedBookingId) {
        await finalizeReservation(signedDocuments, signatureData, storedBookingId);
      } else {
        console.warn('⚠️ [VerifyToken] No bookingId available for finalization');
      }

      // Marquer comme signé
      setState(prev => ({ 
        ...prev, 
        signature: signatureData,
        generatedDocuments: signedDocuments, // Mettre à jour avec le contrat signé
        step: 'confirmation',
        isLoading: false
      }));
      
      // Déclencher l'effet confetti après une courte pause
      setTimeout(() => {
        triggerConfetti(4000); // 4 secondes de confetti
      }, 500);

      toast({
        title: "Réservation finalisée !",
        description: "Contrat signé, police générée et réservation confirmée",
      });

    } catch (error) {
      console.error('❌ [VerifyToken] Signature error:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Erreur de signature',
        isLoading: false
      }));

      toast({
        title: "Erreur de signature",
        description: "Impossible de sauvegarder la signature. Veuillez réessayer.",
        variant: "destructive",
      });
    }
  };


  // Télécharger le contrat
  const handleDownload = async () => {
    if (!state.generatedDocuments) return;

    try {
      await downloadContract(
        state.generatedDocuments.contractUrl,
        state.generatedDocuments.fileName
      );
    } catch (error) {
      console.error('Download error:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50 particles-bg">
      {/* Effet confetti pour la célébration */}
      <ConfettiEffect active={confettiActive} />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* En-tête moderne avec animation */}
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-8"
          >
            <div className="inline-flex items-center gap-3 mb-4">
              <div className="p-3 bg-gradient-to-r from-blue-500 to-teal-500 rounded-full">
                <Shield className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-teal-600 bg-clip-text text-transparent">
                  Vérification Sécurisée
                </h1>
                <p className="text-gray-600 mt-1">Confirmation de votre séjour</p>
              </div>
            </div>
            
            {/* Barre de progression améliorée */}
            <div className="max-w-md mx-auto mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Progression</span>
                <span className="text-sm font-bold text-blue-600">{getProgress()}%</span>
              </div>
              <Progress 
                value={getProgress()} 
                className="h-3 bg-gray-200 rounded-full overflow-hidden"
              />
            </div>
            
            {/* Stepper horizontal moderne */}
            <div className="flex items-center justify-center space-x-8 text-sm">
              {[
                { step: 'code', label: 'Code Airbnb', icon: Home },
                { step: 'documents', label: 'Documents', icon: FileText },
                { step: 'signature', label: 'Signature', icon: User },
                { step: 'confirmation', label: 'Confirmation', icon: CheckCircle }
              ].map(({ step, label, icon: Icon }, index) => (
                <motion.div
                  key={step}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1, duration: 0.3 }}
                  className={`flex flex-col items-center space-y-2 ${
                    state.step === step ? 'text-blue-600' : 'text-gray-400'
                  }`}
                >
                  <div className={`p-2 rounded-full border-2 transition-all duration-300 ${
                    state.step === step 
                      ? 'bg-blue-100 border-blue-500 shadow-lg scale-110' 
                      : 'bg-gray-100 border-gray-300'
                  }`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className={`font-medium transition-all duration-300 ${
                    state.step === step ? 'text-blue-600 font-bold' : 'text-gray-500'
                  }`}>
                    {label}
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.div>

        {/* Erreur globale */}
        {state.error && (
          <Alert className="mb-6" variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}

        {/* Étape 1: Code Airbnb */}
        <AnimatePresence mode="wait">
          {state.step === 'code' && (
            <motion.div
              key="code-step"
              initial={{ opacity: 0, x: 50, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -50, scale: 0.95 }}
              transition={{ duration: 0.4, ease: "easeInOut" }}
            >
              <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
                <CardHeader className="bg-gradient-to-r from-blue-50 to-teal-50 rounded-t-lg">
                  <CardTitle className="flex items-center gap-3 text-xl">
                    <div className="p-2 bg-gradient-to-r from-blue-500 to-teal-500 rounded-lg">
                      <Home className="h-5 w-5 text-white" />
                    </div>
                    Code de confirmation Airbnb
                  </CardTitle>
                  <CardDescription className="text-gray-600">
                    Saisissez le code de confirmation que vous avez reçu d'Airbnb (ex: HMKZPEAKQ5)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 p-6">
                  <div className="space-y-2">
                    <Label htmlFor="airbnbCode" className="text-sm font-semibold text-gray-700">
                      Code de confirmation Airbnb
                    </Label>
                    <div className="relative">
                      <Input
                        id="airbnbCode"
                        placeholder="HMXXXXXXXX"
                        value={airbnbCode}
                        onChange={(e) => setAirbnbCode(e.target.value.toUpperCase())}
                        disabled={state.isLoading}
                        className="h-12 text-lg font-mono border-2 border-gray-200 focus:border-blue-500 rounded-lg transition-all duration-300 uppercase"
                      />
                      {airbnbCode && (
                        <motion.div 
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2"
                        >
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        </motion.div>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 flex items-center gap-1">
                      <Sparkles className="h-3 w-3" />
                      Le code commence généralement par "HM" suivi de caractères alphanumériques
                    </p>
                  </div>
                  
                  <Button 
                    onClick={handleResolveCode} 
                    className="w-full h-12 bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-700 hover:to-teal-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02]" 
                    disabled={state.isLoading || !airbnbCode.trim()}
                  >
                    {state.isLoading ? (
                      <>
                        <EnhancedLoader type="security" size="sm" className="mr-2" />
                        Vérification en cours...
                      </>
                    ) : (
                      <>
                        <Shield className="mr-2 h-5 w-5" />
                        Vérifier la réservation
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </>
                    )}
                  </Button>
                  
                  {/* Indicateur de sécurité */}
                  <div className="flex items-center justify-center gap-2 text-sm text-gray-500 bg-gray-50 rounded-lg p-3">
                    <Lock className="h-4 w-4" />
                    <span>Connexion sécurisée SSL</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Affichage de la réservation résolue */}
        {state.booking && state.step !== 'code' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-6"
          >
            <Card className="border-2 border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-green-100 to-emerald-100 rounded-t-lg">
                <CardTitle className="flex items-center gap-3 text-green-800">
                  <div className="p-2 bg-green-500 rounded-full">
                    <CheckCircle className="h-5 w-5 text-white" />
                  </div>
                  Réservation confirmée
                  <Badge variant="outline" className="ml-auto bg-white/50 border-green-300 text-green-700">
                    <Lock className="h-3 w-3 mr-1" />
                    Sécurisé
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                    className="flex items-center gap-3 p-3 bg-white rounded-lg shadow-sm"
                  >
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Calendar className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800">Arrivée</p>
                      <p className="text-lg font-mono text-blue-600">{formatBookingDate(state.booking.checkIn)}</p>
                    </div>
                  </motion.div>
                  
                  <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 }}
                    className="flex items-center gap-3 p-3 bg-white rounded-lg shadow-sm"
                  >
                    <div className="p-2 bg-teal-100 rounded-lg">
                      <Clock className="h-5 w-5 text-teal-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800">Départ</p>
                      <p className="text-lg font-mono text-teal-600">{formatBookingDate(state.booking.checkOut)}</p>
                    </div>
                  </motion.div>
                  
                  {state.booking.propertyName && (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                      className="flex items-center gap-3 p-3 bg-white rounded-lg shadow-sm md:col-span-2"
                    >
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <MapPin className="h-5 w-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800">Propriété</p>
                        <p className="text-lg text-purple-600">{state.booking.propertyName}</p>
                      </div>
                    </motion.div>
                  )}
                </div>
                
                <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-green-200">
                  <Badge className="bg-gradient-to-r from-blue-500 to-teal-500 text-white px-3 py-1">
                    <Sparkles className="h-3 w-3 mr-1" />
                    {calculateNights(state.booking.checkIn, state.booking.checkOut)} nuits
                  </Badge>
                  <Badge variant="outline" className="border-green-300 text-green-700 bg-white/50">
                    <Lock className="h-3 w-3 mr-1" />
                    Dates verrouillées par Airbnb
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Étape 2 supprimée: Les informations seront extraites automatiquement des documents d'identité */}

        {/* Étape 2: Documents d'identité */}
        <AnimatePresence mode="wait">
          {state.step === 'documents' && (
            <motion.div
              key="documents-step"
              initial={{ opacity: 0, x: 50, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -50, scale: 0.95 }}
              transition={{ duration: 0.4, ease: "easeInOut" }}
            >
              <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
                <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-t-lg">
                  <CardTitle className="flex items-center gap-3 text-xl">
                    <div className="p-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg">
                      <FileText className="h-5 w-5 text-white" />
                    </div>
                    Documents d'identité
                  </CardTitle>
                  <CardDescription className="text-gray-600">
                    Uploadez vos pièces d'identité (passeport, carte d'identité, etc.).
                  </CardDescription>
                  <div className="flex items-center gap-2 mt-2 p-2 bg-blue-50 rounded-lg border border-blue-200 mx-6">
                    <Sparkles className="h-4 w-4 text-blue-600" />
                    <span className="text-sm text-blue-700 font-medium">
                      Vos informations personnelles seront extraites automatiquement des documents
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6 p-6">
                  <motion.div 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="border-2 border-dashed border-purple-300 rounded-xl p-8 text-center bg-gradient-to-br from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100 transition-all duration-300 cursor-pointer"
                  >
                    <input
                      type="file"
                      multiple
                      accept="image/*,.pdf"
                      onChange={(e) => handleFileUpload(e.target.files)}
                      className="hidden"
                      id="file-upload"
                    />
                    <label
                      htmlFor="file-upload"
                      className="cursor-pointer flex flex-col items-center"
                    >
                      <motion.div
                        animate={{ 
                          y: [0, -10, 0],
                          rotate: [0, 5, -5, 0] 
                        }}
                        transition={{ 
                          duration: 2,
                          repeat: Infinity,
                          ease: "easeInOut" 
                        }}
                        className="p-4 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full mb-4"
                      >
                        <Upload className="h-8 w-8 text-white" />
                      </motion.div>
                      <span className="text-lg font-semibold text-gray-700 mb-2">
                        Cliquez pour sélectionner vos documents
                      </span>
                      <span className="text-sm text-gray-500">
                        Images (JPG, PNG) ou PDF acceptés • Max 10MB par fichier
                      </span>
                    </label>
                  </motion.div>

                  {state.idDocuments.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="space-y-2"
                    >
                      <Label className="text-sm font-semibold text-gray-700">Documents sélectionnés:</Label>
                      {state.idDocuments.map((doc, index) => (
                        <motion.div 
                          key={index}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="flex items-center gap-3 p-3 bg-white rounded-lg shadow-sm border border-purple-200"
                        >
                          <div className="p-2 bg-purple-100 rounded-lg">
                            <FileText className="h-4 w-4 text-purple-600" />
                          </div>
                          <div className="flex-1">
                            <span className="text-sm font-medium text-gray-700">{doc.name}</span>
                            <Badge variant="outline" className="ml-2 text-xs border-purple-300 text-purple-700">
                              {doc.type}
                            </Badge>
                          </div>
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        </motion.div>
                      ))}
                    </motion.div>
                  )}

                  {/* Affichage des informations extraites */}
                  {state.guestInfo.firstName && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="p-4 bg-green-50 rounded-lg border border-green-200"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <span className="font-semibold text-green-800">Informations extraites automatiquement</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-gray-600">Nom:</span>
                          <span className="ml-2 font-medium">{state.guestInfo.firstName} {state.guestInfo.lastName}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Date de naissance:</span>
                          <span className="ml-2 font-medium">
                            {state.guestInfo.dateOfBirth 
                              ? new Date(state.guestInfo.dateOfBirth).toLocaleDateString('fr-FR')
                              : 'Non spécifiée'
                            }
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">Nationalité:</span>
                          <span className="ml-2 font-medium">{state.guestInfo.nationality || 'Non spécifiée'}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Type ID:</span>
                          <span className="ml-2 font-medium">{state.guestInfo.idType || 'Non spécifié'}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Numéro:</span>
                          <span className="ml-2 font-medium">{state.guestInfo.idNumber || 'Non spécifié'}</span>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  <Button 
                    onClick={handleValidateDocuments} 
                    disabled={state.idDocuments.length === 0}
                    className="w-full h-12 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02]"
                  >
                    {state.idDocuments.length === 0 ? (
                      <>
                        <Upload className="mr-2 h-5 w-5" />
                        Sélectionnez vos documents d'abord
                      </>
                    ) : (
                      <>
                        <User className="mr-2 h-5 w-5" />
                        Continuer vers la signature
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </>
                    )}
                  </Button>
                  
                  {/* Informations de sécurité */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-gray-500">
                    <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                      <Shield className="h-3 w-3" />
                      <span>Données chiffrées SSL</span>
                    </div>
                    <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                      <Lock className="h-3 w-3" />
                      <span>Stockage sécurisé</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Étape 3: Signature */}
        <AnimatePresence mode="wait">
          {state.step === 'signature' && (
            <motion.div
              key="signature-step"
              initial={{ opacity: 0, x: 50, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -50, scale: 0.95 }}
              transition={{ duration: 0.4, ease: "easeInOut" }}
            >
              <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
                <CardHeader className="bg-gradient-to-r from-emerald-50 to-green-50 rounded-t-lg">
                  <CardTitle className="flex items-center gap-3 text-xl">
                    <div className="p-2 bg-gradient-to-r from-emerald-500 to-green-500 rounded-lg">
                      <User className="h-5 w-5 text-white" />
                    </div>
                    Signature du contrat
                  </CardTitle>
                  <CardDescription className="text-gray-600">
                    Signez numériquement votre contrat de location pour finaliser le processus
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 p-6">
                  {/* Affichage du contrat généré */}
                  {state.generatedDocuments ? (
                    <>
                      {/* Aperçu du contrat */}
                      <div className="border-2 border-blue-200 rounded-xl p-6 bg-gradient-to-br from-blue-50 to-indigo-50">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="p-2 bg-blue-500 rounded-lg">
                            <FileText className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-800">Contrat de location généré</h3>
                            <p className="text-sm text-gray-600">Consultez votre contrat avant de le signer</p>
                          </div>
                        </div>
                        
                        <div className="bg-white rounded-lg p-4 border">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-gray-600">Invité:</span>
                              <span className="ml-2 font-medium">{state.guestInfo.firstName} {state.guestInfo.lastName}</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Propriété:</span>
                              <span className="ml-2 font-medium">{state.booking?.propertyName || 'N/A'}</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Arrivée:</span>
                              <span className="ml-2 font-medium">{formatBookingDate(state.booking?.checkIn || '')}</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Départ:</span>
                              <span className="ml-2 font-medium">{formatBookingDate(state.booking?.checkOut || '')}</span>
                            </div>
                          </div>
                          
                          <Button 
                            onClick={() => window.open(state.generatedDocuments!.contractUrl, '_blank')}
                            variant="outline" 
                            className="w-full mt-4"
                          >
                            <FileText className="mr-2 h-4 w-4" />
                            Consulter le contrat complet (PDF)
                          </Button>
                        </div>
                      </div>

                      {/* Zone de signature interactive */}
                      <div className="space-y-4">
                        <div className="text-center">
                          <h3 className="text-lg font-semibold text-gray-700 mb-2">
                            Signature électronique
                          </h3>
                          <p className="text-sm text-gray-600">
                            Signez votre contrat dans la zone ci-dessous pour finaliser le processus
                          </p>
                        </div>
                        
                        <SignaturePad 
                          onSignature={handleSignature}
                          disabled={state.isLoading}
                        />
                      </div>
                    </>
                  ) : (
                    /* Chargement du contrat */
                    <div className="text-center py-8">
                      <div className="flex flex-col items-center gap-4">
                        {state.isLoading ? (
                          <>
                            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                            <p className="text-gray-600">Génération du contrat en cours...</p>
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="h-8 w-8 text-amber-500" />
                            <p className="text-gray-600">Le contrat n'a pas pu être généré</p>
                            <Button onClick={() => handleValidateDocuments()} variant="outline">
                              Réessayer
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Informations légales */}
                  <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
                    <p className="mb-1">
                      <strong>Signature électronique :</strong> Votre signature numérique a la même valeur légale qu'une signature manuscrite.
                    </p>
                    <p>
                      En signant, vous acceptez les termes et conditions du contrat de location.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Étape 4: Confirmation */}
        <AnimatePresence mode="wait">
          {state.step === 'confirmation' && state.generatedDocuments && (
            <motion.div
              key="confirmation-step"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
            >
              <Card className="shadow-xl border-0 bg-gradient-to-br from-green-50 to-emerald-50">
                <CardHeader className="bg-gradient-to-r from-green-100 to-emerald-100 rounded-t-lg text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                    className="mx-auto w-fit"
                  >
                    <div className="p-4 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full mb-4">
                      <CheckCircle className="h-12 w-12 text-white" />
                    </div>
                  </motion.div>
                  <CardTitle className="text-2xl text-green-800 mb-2">
                    🎉 Vérification terminée !
                  </CardTitle>
                  <CardDescription className="text-green-700">
                    Votre contrat a été signé avec succès. Vous pouvez maintenant le télécharger.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 p-6 text-center">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="space-y-4"
                  >
                    <div className="flex items-center justify-center gap-3 text-green-700 bg-white rounded-lg p-4 shadow-sm">
                      <CheckCircle className="h-5 w-5" />
                      <span>Documents vérifiés</span>
                    </div>
                    <div className="flex items-center justify-center gap-3 text-green-700 bg-white rounded-lg p-4 shadow-sm">
                      <CheckCircle className="h-5 w-5" />
                      <span>Contrat signé électroniquement</span>
                    </div>
                    <div className="flex items-center justify-center gap-3 text-green-700 bg-white rounded-lg p-4 shadow-sm">
                      <CheckCircle className="h-5 w-5" />
                      <span>Processus de vérification complet</span>
                    </div>
                  </motion.div>

                  <Button 
                    onClick={handleDownload} 
                    className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02]"
                  >
                    <Download className="mr-2 h-5 w-5" />
                    Télécharger votre contrat signé
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                  
                  <p className="text-sm text-gray-600">
                    Vous recevrez également une copie par email dans quelques instants.
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer moderne */}
        <motion.footer
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 0.5 }}
            className="mt-16 text-center"
          >
            <div className="max-w-2xl mx-auto">
              <div className="flex items-center justify-center gap-6 text-sm text-gray-500 mb-4">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-green-500" />
                  <span>Sécurisé par SSL</span>
                </div>
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-blue-500" />
                  <span>Données protégées</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-purple-500" />
                  <span>Conformé RGPD</span>
                </div>
              </div>
              <p className="text-xs text-gray-400">
                © 2024 Morocco Host Helper - Vérification sécurisée des invités
              </p>
            </div>
          </motion.footer>
        </div>
      </div>
    </div>
  );
}
