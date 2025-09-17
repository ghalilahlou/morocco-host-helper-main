import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, ArrowRight, X, Check } from 'lucide-react';
import { useBookings } from '@/hooks/useBookings';
import { Booking } from '@/types/booking';
import { MobileLayout } from './MobileLayout';

interface MobileBookingWizardProps {
  onClose: () => void;
  editingBooking?: Booking;
  propertyId?: string;
}

export const MobileBookingWizard = ({ 
  onClose, 
  editingBooking, 
  propertyId 
}: MobileBookingWizardProps) => {
  const { addBooking, updateBooking } = useBookings();
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  
  // Form data state
  const [formData, setFormData] = useState({
    checkInDate: editingBooking?.check_in_date ? new Date(editingBooking.check_in_date) : null,
    checkOutDate: editingBooking?.check_out_date ? new Date(editingBooking.check_out_date) : null,
    numberOfGuests: editingBooking?.number_of_guests || 1,
    guests: editingBooking?.guests || [],
    uploadedDocuments: [],
    notes: editingBooking?.notes || ''
  });

  // Steps configuration
  const steps = [
    {
      id: 'dates',
      title: 'Dates',
      description: 'Sélectionnez les dates de séjour',
      component: DatesStepMobile
    },
    {
      id: 'guests',
      title: 'Invités',
      description: 'Informations des invités',
      component: GuestsStepMobile
    },
    {
      id: 'documents',
      title: 'Documents',
      description: 'Upload des documents',
      component: DocumentsStepMobile
    },
    {
      id: 'review',
      title: 'Révision',
      description: 'Vérifiez les informations',
      component: ReviewStepMobile
    }
  ];

  const updateFormData = (updates: any) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const canProceedToNext = () => {
    switch (currentStep) {
      case 0: // Dates
        return formData.checkInDate && formData.checkOutDate;
      case 1: // Guests
        return formData.numberOfGuests > 0;
      case 2: // Documents
        return true; // Documents are optional
      case 3: // Review
        return true;
      default:
        return false;
    }
  };

  const goToNextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const goToPreviousStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      const bookingData = {
        property_id: propertyId,
        check_in_date: formData.checkInDate?.toISOString(),
        check_out_date: formData.checkOutDate?.toISOString(),
        number_of_guests: formData.numberOfGuests,
        status: 'pending' as const,
        notes: formData.notes
      };

      if (editingBooking) {
        await updateBooking(editingBooking.id, bookingData);
      } else {
        await addBooking(bookingData);
      }

      onClose();
    } catch (error) {
      console.error('Error saving booking:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const progress = ((currentStep + 1) / steps.length) * 100;
  const CurrentStepComponent = steps[currentStep].component;

  return (
    <MobileLayout fullScreen>
      <div className="h-full flex flex-col bg-white">
        {/* Header */}
        <div className="flex-shrink-0 p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={currentStep > 0 ? goToPreviousStep : onClose}
              className="h-10 w-10"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-lg font-semibold text-gray-900">
              {editingBooking ? 'Modifier' : 'Nouvelle'} Réservation
            </h1>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-10 w-10"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Progress */}
          <div className="mb-4">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Étape {currentStep + 1} sur {steps.length}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* Current Step Info */}
          <div className="text-center">
            <h2 className="text-xl font-bold text-gray-900">
              {steps[currentStep].title}
            </h2>
            <p className="text-sm text-gray-600">
              {steps[currentStep].description}
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
              <CurrentStepComponent
                formData={formData}
                updateFormData={updateFormData}
                editingBooking={editingBooking}
              />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 p-4 border-t border-gray-200 bg-white">
          <div className="flex space-x-3">
            {currentStep > 0 && (
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
              onClick={currentStep === steps.length - 1 ? handleSubmit : goToNextStep}
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
                  {currentStep === steps.length - 1 ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Enregistrer
                    </>
                  ) : (
                    <>
                      Suivant
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
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

// Step Components
const DatesStepMobile = ({ formData, updateFormData }: any) => (
  <div className="p-4 space-y-6">
    <div className="text-center py-8">
      <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
        <CalendarIcon className="w-8 h-8 text-blue-600" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        Sélectionnez vos dates
      </h3>
      <p className="text-gray-600">
        Choisissez les dates d'arrivée et de départ
      </p>
    </div>

    {/* Date pickers would go here */}
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Date d'arrivée
        </label>
        <Button
          variant="outline"
          className="w-full h-12 justify-start text-left"
        >
          {formData.checkInDate ? 
            formData.checkInDate.toLocaleDateString() : 
            'Sélectionner une date'
          }
        </Button>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Date de départ
        </label>
        <Button
          variant="outline"
          className="w-full h-12 justify-start text-left"
        >
          {formData.checkOutDate ? 
            formData.checkOutDate.toLocaleDateString() : 
            'Sélectionner une date'
          }
        </Button>
      </div>
    </div>
  </div>
);

const GuestsStepMobile = ({ formData, updateFormData }: any) => (
  <div className="p-4 space-y-6">
    <div className="text-center py-8">
      <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
        <Users className="w-8 h-8 text-green-600" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        Nombre d'invités
      </h3>
      <p className="text-gray-600">
        Combien de personnes séjourneront ?
      </p>
    </div>

    <div className="flex items-center justify-center space-x-6">
      <Button
        variant="outline"
        size="icon"
        onClick={() => updateFormData({ 
          numberOfGuests: Math.max(1, formData.numberOfGuests - 1) 
        })}
        className="h-12 w-12"
      >
        -
      </Button>
      
      <div className="text-center">
        <div className="text-3xl font-bold text-gray-900">
          {formData.numberOfGuests}
        </div>
        <div className="text-sm text-gray-600">
          invité{formData.numberOfGuests > 1 ? 's' : ''}
        </div>
      </div>
      
      <Button
        variant="outline"
        size="icon"
        onClick={() => updateFormData({ 
          numberOfGuests: formData.numberOfGuests + 1 
        })}
        className="h-12 w-12"
      >
        +
      </Button>
    </div>
  </div>
);

const DocumentsStepMobile = ({ formData, updateFormData }: any) => (
  <div className="p-4 space-y-6">
    <div className="text-center py-8">
      <div className="w-16 h-16 mx-auto mb-4 bg-purple-100 rounded-full flex items-center justify-center">
        <Upload className="w-8 h-8 text-purple-600" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        Documents (optionnel)
      </h3>
      <p className="text-gray-600">
        Ajoutez des documents si nécessaire
      </p>
    </div>

    <Button variant="outline" className="w-full h-12">
      <Upload className="w-4 h-4 mr-2" />
      Ajouter un document
    </Button>
  </div>
);

const ReviewStepMobile = ({ formData }: any) => (
  <div className="p-4 space-y-6">
    <div className="text-center py-8">
      <div className="w-16 h-16 mx-auto mb-4 bg-orange-100 rounded-full flex items-center justify-center">
        <Check className="w-8 h-8 text-orange-600" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        Révision
      </h3>
      <p className="text-gray-600">
        Vérifiez vos informations avant de sauvegarder
      </p>
    </div>

    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex justify-between">
          <span className="text-gray-600">Arrivée :</span>
          <span className="font-medium">
            {formData.checkInDate?.toLocaleDateString() || 'Non définie'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Départ :</span>
          <span className="font-medium">
            {formData.checkOutDate?.toLocaleDateString() || 'Non définie'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Invités :</span>
          <span className="font-medium">{formData.numberOfGuests}</span>
        </div>
      </CardContent>
    </Card>
  </div>
);
