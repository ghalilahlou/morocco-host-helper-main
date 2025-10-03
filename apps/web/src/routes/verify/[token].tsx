/**
 * Page de vérification invité avec stepper
 * Route: /verify/:token
 * Workflow: Code Airbnb → Upload ID → Signature → Confirmation
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
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
  Download
} from 'lucide-react';

import { resolveBooking, formatBookingDate, calculateNights, type ResolvedBooking } from '@/services/bookingResolve';
import { 
  submitDocumentsAndSign, 
  validateGuestInfo, 
  validateIdDocuments, 
  downloadContract,
  type GuestInfo, 
  type IdDocument, 
  type GeneratedDocuments 
} from '@/services/documentService';

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

export default function VerifyToken() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

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
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Erreur de résolution',
        isLoading: false
      }));
    }
  };

  // Étape 2 supprimée: Validation automatique via extraction des documents

  // Étape 3: Upload documents (simulation)
  const handleFileUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newDocuments: IdDocument[] = Array.from(files).map(file => ({
      name: file.name,
      url: `temp://${file.name}`, // En réalité, upload vers Supabase Storage
      type: file.type,
      file
    }));

    setState(prev => ({
      ...prev,
      idDocuments: [...prev.idDocuments, ...newDocuments]
    }));

    toast({
      title: "Documents ajoutés",
      description: `${files.length} document(s) prêt(s) pour soumission`,
    });
  };

  const handleValidateDocuments = () => {
    const errors = validateIdDocuments(state.idDocuments);
    
    if (errors.length > 0) {
      toast({
        title: "Documents manquants",
        description: errors.join(', '),
        variant: "destructive",
      });
      return;
    }

    setState(prev => ({ ...prev, step: 'signature' }));
  };

  // Étape 4: Signature (simulation)
  const handleSign = () => {
    const signatureData = `data:image/png;base64,${btoa('signature_simulation')}`; // Simulation
    setState(prev => ({ ...prev, signature: signatureData, step: 'confirmation' }));
    handleSubmitAll();
  };

  // Soumission finale
  const handleSubmitAll = async () => {
    if (!state.booking || !state.signature) return;

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const documents = await submitDocumentsAndSign({
        token: token!,
        airbnbCode: state.booking.airbnbCode,
        guestInfo: state.guestInfo as GuestInfo,
        idDocuments: state.idDocuments,
        signature: {
          data: state.signature,
          timestamp: new Date().toISOString()
        }
      });

      setState(prev => ({
        ...prev,
        generatedDocuments: documents,
        isLoading: false
      }));

    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Erreur de génération',
        isLoading: false
      }));
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
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Header avec progress */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-center mb-4">
            Vérification de votre séjour
          </h1>
          <Progress value={getProgress()} className="mb-4" />
          <div className="flex justify-center space-x-4 text-sm text-gray-600">
            <span className={state.step === 'code' ? 'font-bold text-blue-600' : ''}>
              1. Code Airbnb
            </span>
            <span className={state.step === 'documents' ? 'font-bold text-blue-600' : ''}>
              2. Documents d'identité
            </span>
            <span className={state.step === 'signature' ? 'font-bold text-blue-600' : ''}>
              3. Signature
            </span>
            <span className={state.step === 'confirmation' ? 'font-bold text-blue-600' : ''}>
              4. Confirmation
            </span>
          </div>
        </div>

        {/* Erreur globale */}
        {state.error && (
          <Alert className="mb-6" variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}

        {/* Étape 1: Code Airbnb */}
        {state.step === 'code' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Entrez votre code de confirmation Airbnb
              </CardTitle>
              <CardDescription>
                Saisissez le code de confirmation que vous avez reçu d'Airbnb (ex: HMKZPEAKQ5)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="airbnbCode">Code de confirmation Airbnb</Label>
                <Input
                  id="airbnbCode"
                  placeholder="HMXXXXXXXX"
                  value={airbnbCode}
                  onChange={(e) => setAirbnbCode(e.target.value.toUpperCase())}
                  className="uppercase"
                  disabled={state.isLoading}
                />
                <p className="text-sm text-gray-500 mt-1">
                  Le code commence généralement par "HM" suivi de caractères alphanumériques
                </p>
              </div>

              <Button 
                onClick={handleResolveCode} 
                disabled={state.isLoading || !airbnbCode.trim()}
                className="w-full"
              >
                {state.isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Vérifier la réservation
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Affichage de la réservation résolue */}
        {state.booking && state.step !== 'code' && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Réservation confirmée
                <Lock className="h-4 w-4 text-gray-500" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-blue-600" />
                  <div>
                    <p className="font-medium">Arrivée</p>
                    <p className="text-sm text-gray-600">{formatBookingDate(state.booking.checkIn)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-blue-600" />
                  <div>
                    <p className="font-medium">Départ</p>
                    <p className="text-sm text-gray-600">{formatBookingDate(state.booking.checkOut)}</p>
                  </div>
                </div>
                {state.booking.propertyName && (
                  <div className="flex items-center gap-2 md:col-span-2">
                    <MapPin className="h-4 w-4 text-blue-600" />
                    <div>
                      <p className="font-medium">Propriété</p>
                      <p className="text-sm text-gray-600">{state.booking.propertyName}</p>
                    </div>
                  </div>
                )}
                <div className="md:col-span-2">
                  <Badge variant="secondary" className="text-sm">
                    {calculateNights(state.booking.checkIn, state.booking.checkOut)} nuits
                  </Badge>
                  <Badge variant="outline" className="ml-2 text-sm">
                    <Lock className="h-3 w-3 mr-1" />
                    Dates verrouillées par Airbnb
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Étape 2 supprimée: Les informations seront extraites automatiquement des documents d'identité */}

        {/* Étape 3: Upload documents */}
        {state.step === 'documents' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Pièces d'identité
              </CardTitle>
              <CardDescription>
                Uploadez vos pièces d'identité (passeport, carte d'identité, etc.).
                <br />
                <span className="text-sm text-blue-600 font-medium">
                  ℹ️ Vos informations personnelles seront extraites automatiquement des documents
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
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
                  <Upload className="h-8 w-8 text-gray-400 mb-2" />
                  <span className="text-sm text-gray-600">
                    Cliquez pour sélectionner des fichiers
                  </span>
                  <span className="text-xs text-gray-400 mt-1">
                    Images ou PDF acceptés
                  </span>
                </label>
              </div>

              {state.idDocuments.length > 0 && (
                <div className="space-y-2">
                  <Label>Documents sélectionnés:</Label>
                  {state.idDocuments.map((doc, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                      <FileText className="h-4 w-4" />
                      <span className="text-sm">{doc.name}</span>
                      <Badge variant="outline" className="text-xs">{doc.type}</Badge>
                    </div>
                  ))}
                </div>
              )}

              <Button 
                onClick={handleValidateDocuments} 
                disabled={state.idDocuments.length === 0}
                className="w-full"
              >
                Continuer vers la signature
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Étape 4: Signature */}
        {state.step === 'signature' && (
          <Card>
            <CardHeader>
              <CardTitle>Signature du contrat</CardTitle>
              <CardDescription>
                Signez électroniquement votre contrat de location
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border rounded-lg p-4 bg-gray-50">
                <p className="text-sm text-gray-600 mb-4">
                  En signant, vous acceptez les termes et conditions de la location 
                  pour la période du <strong>{state.booking && formatBookingDate(state.booking.checkIn)}</strong> 
                  au <strong>{state.booking && formatBookingDate(state.booking.checkOut)}</strong>.
                </p>
                
                {/* Zone de signature simulée */}
                <div className="border-2 border-dashed border-gray-300 rounded h-32 flex items-center justify-center">
                  <span className="text-gray-400">Zone de signature électronique</span>
                </div>
              </div>

              <Button onClick={handleSign} className="w-full">
                {state.isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Signer et finaliser
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Étape 5: Confirmation */}
        {state.step === 'confirmation' && state.generatedDocuments && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-6 w-6" />
                Vérification terminée
              </CardTitle>
              <CardDescription>
                Votre contrat a été généré avec succès
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  Toutes vos informations ont été enregistrées et votre contrat est prêt.
                </AlertDescription>
              </Alert>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="font-medium text-green-800 mb-2">Récapitulatif:</h3>
                <ul className="text-sm text-green-700 space-y-1">
                  <li>✅ Réservation Airbnb vérifiée</li>
                  <li>✅ Informations personnelles enregistrées</li>
                  <li>✅ Pièces d'identité uploadées</li>
                  <li>✅ Contrat signé électroniquement</li>
                </ul>
              </div>

              <div className="flex gap-3">
                <Button onClick={handleDownload} className="flex-1">
                  <Download className="mr-2 h-4 w-4" />
                  Télécharger le contrat
                </Button>
                <Button variant="outline" onClick={() => navigate('/')}>
                  Retour à l'accueil
                </Button>
              </div>

              <p className="text-xs text-gray-500 text-center">
                Votre contrat expire le {state.generatedDocuments.expiresAt && 
                new Date(state.generatedDocuments.expiresAt).toLocaleDateString('fr-FR')}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
