import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, CheckCircle, Upload, Calendar, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useT } from '@/i18n/GuestLocaleProvider';
import { MobileLayout } from './MobileLayout';

// Interfaces
interface Guest {
  fullName: string;
  dateOfBirth: string;
  documentNumber: string;
  nationality: string;
  placeOfBirth?: string;
  documentType: 'passport' | 'id_card';
}

interface BookingData {
  checkInDate: Date | null;
  checkOutDate: Date | null;
  numberOfGuests: number;
}

interface UploadedDocument {
  file: File;
  preview: string;
  processing: boolean;
  extractedData?: any;
  isInvalid?: boolean;
}

export const MobileGuestVerification = () => {
  const { propertyId, token } = useParams<{ propertyId: string; token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const t = useT();

  // States
  const [currentStep, setCurrentStep] = useState<'booking' | 'documents' | 'signature'>('booking');
  const [isLoading, setIsLoading] = useState(false);
  const [submissionComplete, setSubmissionComplete] = useState(false);
  const [isValidToken, setIsValidToken] = useState(false);
  const [checkingToken, setCheckingToken] = useState(true);
  const [propertyName, setPropertyName] = useState('');

  // Form Data
  const [bookingData, setBookingData] = useState<BookingData>({
    checkInDate: null,
    checkOutDate: null,
    numberOfGuests: 1
  });

  const [guests, setGuests] = useState<Guest[]>([{
    fullName: '',
    dateOfBirth: '',
    documentNumber: '',
    nationality: 'Morocco',
    placeOfBirth: '',
    documentType: 'id_card'
  }]);

  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedDocument[]>([]);

  // Steps configuration
  const steps = [
    { id: 'booking', title: 'Réservation', icon: Calendar, description: 'Dates et invités' },
    { id: 'documents', title: 'Documents', icon: Upload, description: 'Pièces d\'identité' },
    { id: 'signature', title: 'Signature', icon: CheckCircle, description: 'Finalisation' }
  ];

  const currentStepIndex = steps.findIndex(step => step.id === currentStep);

  // Token verification
  useEffect(() => {
    const verifyToken = async () => {
      if (!propertyId || !token) {
        setIsValidToken(false);
        setCheckingToken(false);
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke('resolve-guest-link', {
          body: { propertyId, token }
        });

        if (error) throw error;

        setIsValidToken(true);
        setPropertyName(data.propertyName || 'Propriété');
      } catch (error) {
        console.error('Token verification failed:', error);
        setIsValidToken(false);
      } finally {
        setCheckingToken(false);
      }
    };

    verifyToken();
  }, [propertyId, token]);

  // Navigation
  const goToNextStep = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex].id as any);
    }
  };

  const goToPreviousStep = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(steps[prevIndex].id as any);
    }
  };

  const canProceedToNext = () => {
    switch (currentStep) {
      case 'booking':
        return bookingData.checkInDate && bookingData.checkOutDate && bookingData.numberOfGuests > 0;
      case 'documents':
        return uploadedDocuments.length > 0 && guests.every(guest => guest.fullName && guest.documentNumber);
      case 'signature':
        return true;
      default:
        return false;
    }
  };

  // Loading state
  if (checkingToken) {
    return (
      <MobileLayout fullScreen>
        <div className="flex items-center justify-center h-full">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="w-12 h-12 mx-auto mb-4 rounded-full border-4 border-blue-200 border-t-blue-600"
            />
            <p className="text-gray-600">Vérification en cours...</p>
          </motion.div>
        </div>
      </MobileLayout>
    );
  }

  // Invalid token
  if (!isValidToken) {
    return (
      <MobileLayout fullScreen>
        <div className="flex items-center justify-center h-full p-6">
          <Card className="w-full max-w-md">
            <CardContent className="text-center p-6">
              <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                <X className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Lien invalide</h2>
              <p className="text-gray-600 mb-4">
                Ce lien de vérification n'est plus valide ou a expiré.
              </p>
              <Button onClick={() => navigate('/')} className="w-full">
                Retour à l'accueil
              </Button>
            </CardContent>
          </Card>
        </div>
      </MobileLayout>
    );
  }

  // Success state
  if (submissionComplete) {
    return (
      <MobileLayout fullScreen>
        <div className="flex items-center justify-center h-full p-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <Card className="w-full max-w-md">
              <CardContent className="text-center p-8">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring" }}
                  className="w-20 h-20 mx-auto mb-6 bg-green-100 rounded-full flex items-center justify-center"
                >
                  <CheckCircle className="w-10 h-10 text-green-600" />
                </motion.div>
                <h2 className="text-2xl font-bold text-gray-900 mb-3">
                  Informations envoyées !
                </h2>
                <p className="text-gray-600 mb-6">
                  Vos informations ont été transmises avec succès. L'hôte va maintenant générer vos documents.
                </p>
                <Button 
                  onClick={() => navigate('/')}
                  className="w-full h-12"
                >
                  Terminé
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout fullScreen>
      <div className="h-full flex flex-col bg-white">
        {/* Header */}
        <div className="flex-shrink-0 p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={currentStepIndex > 0 ? goToPreviousStep : () => navigate('/')}
              className="h-10 w-10"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-lg font-semibold text-gray-900">
              Vérification Client
            </h1>
            <div className="w-10" />
          </div>

          {/* Progress */}
          <div className="flex items-center space-x-2 mb-2">
            {steps.map((step, index) => (
              <div key={step.id} className="flex-1">
                <div
                  className={`h-2 rounded-full transition-colors ${
                    index <= currentStepIndex ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                />
              </div>
            ))}
          </div>

          {/* Current Step Info */}
          <div className="text-center">
            <h2 className="text-xl font-bold text-gray-900">
              {steps[currentStepIndex].title}
            </h2>
            <p className="text-sm text-gray-600">
              {steps[currentStepIndex].description}
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.3 }}
              className="h-full"
            >
              {currentStep === 'booking' && (
                <BookingStepMobile 
                  bookingData={bookingData}
                  setBookingData={setBookingData}
                  guests={guests}
                  setGuests={setGuests}
                />
              )}
              
              {currentStep === 'documents' && (
                <DocumentsStepMobile 
                  uploadedDocuments={uploadedDocuments}
                  setUploadedDocuments={setUploadedDocuments}
                  guests={guests}
                  setGuests={setGuests}
                />
              )}
              
              {currentStep === 'signature' && (
                <SignatureStepMobile 
                  bookingData={bookingData}
                  guests={guests}
                  uploadedDocuments={uploadedDocuments}
                  onComplete={() => setSubmissionComplete(true)}
                  propertyId={propertyId}
                  token={token}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 p-4 border-t border-gray-200 bg-white">
          <div className="flex space-x-3">
            {currentStepIndex > 0 && (
              <Button
                variant="outline"
                onClick={goToPreviousStep}
                className="flex-1 h-12"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Précédent
              </Button>
            )}
            
            <Button
              onClick={currentStepIndex === steps.length - 1 ? undefined : goToNextStep}
              disabled={!canProceedToNext() || isLoading}
              className="flex-1 h-12"
            >
              {isLoading ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full"
                />
              ) : (
                <>
                  {currentStepIndex === steps.length - 1 ? 'Envoyer' : 'Suivant'}
                  {currentStepIndex < steps.length - 1 && (
                    <ArrowRight className="w-4 h-4 ml-2" />
                  )}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </MobileLayout>
  );
};

// Placeholder components for the steps
const BookingStepMobile = ({ bookingData, setBookingData, guests, setGuests }: any) => (
  <div className="p-4">
    <p className="text-gray-600 mb-4">Sélectionnez vos dates de séjour et le nombre d'invités.</p>
    {/* Add booking form components here */}
  </div>
);

const DocumentsStepMobile = ({ uploadedDocuments, setUploadedDocuments, guests, setGuests }: any) => (
  <div className="p-4">
    <p className="text-gray-600 mb-4">Téléchargez vos pièces d'identité.</p>
    {/* Add document upload components here */}
  </div>
);

const SignatureStepMobile = ({ bookingData, guests, uploadedDocuments, onComplete }: any) => (
  <div className="p-4">
    <p className="text-gray-600 mb-4">Vérifiez vos informations avant l'envoi.</p>
    <Button onClick={onComplete} className="w-full h-12 mt-6">
      Envoyer les informations
    </Button>
  </div>
);
