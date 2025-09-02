import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Upload, FileText, X, CheckCircle, Users, Calendar as CalendarLucide, ArrowRight, ArrowLeft, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { OpenAIDocumentService } from '@/services/openaiDocumentService';
import { useT } from '@/i18n/GuestLocaleProvider';
import { EnhancedInput } from '@/components/ui/enhanced-input';
import { EnhancedFileUpload } from '@/components/ui/enhanced-file-upload';
import { AnimatedStepper } from '@/components/ui/animated-stepper';
import { IntuitiveBookingPicker } from '@/components/ui/intuitive-date-picker';

// Liste complète des nationalités
const NATIONALITIES = [
  'Morocco', '---', 'France', 'Spain', 'Italy', 'Germany', 'United Kingdom', 'Belgium', 'Netherlands', 'Portugal',
  'Algeria', 'Tunisia', 'Turkey', 'United States', 'Canada', 'Brazil', 'Argentina', 'Russia', 'China', 
  'Japan', 'South Korea', 'India', 'Australia', 'New Zealand', 'South Africa', 'Egypt', 'Nigeria',
  'Saudi Arabia', 'United Arab Emirates', 'Qatar', 'Kuwait', 'Lebanon', 'Jordan', 'Syria', 'Iraq', 'Iran',
  'Pakistan', 'Bangladesh', 'Afghanistan', 'Thailand', 'Vietnam', 'Malaysia', 'Singapore',
  'Indonesia', 'Philippines', 'Mexico', 'Colombia', 'Venezuela', 'Peru', 'Chile', 'Ukraine',
  'Poland', 'Czech Republic', 'Hungary', 'Romania', 'Bulgaria', 'Croatia', 'Serbia', 'Bosnia and Herzegovina', 'Albania',
  'Greece', 'Cyprus', 'Malta', 'Norway', 'Sweden', 'Denmark', 'Finland', 'Iceland', 'Ireland',
  'Switzerland', 'Austria', 'Luxembourg', 'Monaco', 'Andorra', 'San Marino', 'Vatican City',
  'Slovenia', 'Slovakia', 'Estonia', 'Latvia', 'Lithuania', 'Belarus', 'Moldova', 'Georgia',
  'Armenia', 'Azerbaijan', 'Kazakhstan', 'Kyrgyzstan', 'Uzbekistan', 'Tajikistan', 'Turkmenistan', 'Mongolia', 'North Korea',
  'Taiwan', 'Hong Kong', 'Macao', 'Myanmar', 'Laos', 'Cambodia', 'Brunei', 'Timor-Leste', 'Other'
];

interface Guest {
  fullName: string;
  dateOfBirth: Date | undefined;
  nationality: string;
  documentNumber: string;
  documentType: 'passport' | 'national_id';
}

interface UploadedDocument {
  file: File;
  url: string;
  processing: boolean;
  extractedData?: any;
  isInvalid?: boolean;
}

// Animation variants
const fadeInUp = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -30 }
};

const slideInRight = {
  initial: { opacity: 0, x: 50 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -50 }
};

const stagger = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
};

export const GuestVerification = () => {
  const { propertyId, token, airbnbBookingId } = useParams<{
    propertyId: string; 
    token: string; 
    airbnbBookingId?: string; 
  }>();

  // ✅ FONCTION UTILITAIRE: Validation des dates
  const validateDates = (checkIn: Date, checkOut: Date): { isValid: boolean; error?: string } => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkInDateStartOfDay = new Date(checkIn);
    checkInDateStartOfDay.setHours(0, 0, 0, 0);
    const checkOutDateStartOfDay = new Date(checkOut);
    checkOutDateStartOfDay.setHours(0, 0, 0, 0);
    
    if (checkInDateStartOfDay < today) {
      return { isValid: false, error: t('validation.dateFuture.desc') };
    }

    if (checkOutDateStartOfDay <= checkInDateStartOfDay) {
      return { isValid: false, error: t('validation.checkoutAfterCheckin.desc') };
    }

    const daysDifference = Math.ceil((checkOutDateStartOfDay.getTime() - checkInDateStartOfDay.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDifference > 30) {
      return { isValid: false, error: "La durée maximale du séjour est de 30 jours" };
    }

    return { isValid: true };
  };

  const navigate = useNavigate();
  const { toast } = useToast();
  const t = useT();
  const [isLoading, setIsLoading] = useState(false);
  const [submissionComplete, setSubmissionComplete] = useState(false);
  const [isValidToken, setIsValidToken] = useState(false);
  const [checkingToken, setCheckingToken] = useState(true);
  const [propertyName, setPropertyName] = useState('');
  const [guests, setGuests] = useState<Guest[]>([{
    fullName: '',
    dateOfBirth: undefined,
    nationality: '',
    documentNumber: '',
    documentType: 'passport'
  }]);
  const [checkInDate, setCheckInDate] = useState<Date | undefined>();
  const [checkOutDate, setCheckOutDate] = useState<Date | undefined>();
  const [numberOfGuests, setNumberOfGuests] = useState(1);
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedDocument[]>([]);
  const [currentStep, setCurrentStep] = useState<'booking' | 'documents' | 'signature'>('booking');

  // Étapes pour le stepper
  const steps = [
    {
      id: 'booking',
      title: t('guest.booking.title'),
      description: 'Dates et invités',
      icon: CalendarLucide,
      status: currentStep === 'booking' ? 'current' : 
             ['documents', 'signature'].includes(currentStep) ? 'completed' : 'pending'
    },
    {
      id: 'documents',
      title: t('guest.documents.title'),
      description: 'Pièces d\'identité',
      icon: FileText,
      status: currentStep === 'documents' ? 'current' : 
             currentStep === 'signature' ? 'completed' : 'pending'
    },
    {
      id: 'signature',
      title: t('contractSignature.pill'),
      description: 'Finalisation',
      icon: CheckCircle,
      status: currentStep === 'signature' ? 'current' : 'pending'
    }
  ];

  useEffect(() => {
    const verifyToken = async () => {
      if (!propertyId || !token) {
        setCheckingToken(false);
        return;
      }

      console.log('🔍 GuestVerification params:', { propertyId, token, airbnbBookingId });
      console.log('🔍 About to call resolve-guest-link with:', { 
        propertyId, 
        token, 
        airbnbCode: airbnbBookingId 
      });

      try {
        const { data: tokenData, error } = await supabase.functions.invoke('resolve-guest-link', {
          body: { 
            propertyId, 
            token, 
            airbnbCode: airbnbBookingId
          }
        });

        if (error) {
          console.error('resolve-guest-link error:', error);
          setIsValidToken(false);
        } else if (tokenData?.ok) {
          setIsValidToken(true);
          setPropertyName(tokenData.property?.name || 'Property');
        } else {
          console.error('resolve-guest-link failed:', tokenData);
          setIsValidToken(false);
        }
      } catch (error) {
        console.error('Error verifying token:', error);
        setIsValidToken(false);
      } finally {
        setCheckingToken(false);
      }
    };

    verifyToken();
  }, [propertyId, token, airbnbBookingId]);

  // Effect to handle Airbnb booking ID matching and date pre-filling
  useEffect(() => {
    const matchAirbnbBooking = async () => {
      if (!isValidToken || !propertyId || !airbnbBookingId) {
        return;
      }
      
      try {
        const { data: searchResult, error: searchError } = await supabase.functions.invoke('get-airbnb-reservation', {
          body: { propertyId, bookingId: airbnbBookingId }
        });

        if (searchError) {
          console.error('❌ Edge function error:', searchError);
          return;
        }
        
        if (searchResult?.reservation) {
          const matchedReservation = searchResult.reservation;
          
          const foundCheckInDate = new Date(matchedReservation.start_date);
          const foundCheckOutDate = new Date(matchedReservation.end_date);
          
          setCheckInDate(foundCheckInDate);
          setCheckOutDate(foundCheckOutDate);
          
          if (matchedReservation.number_of_guests) {
            setNumberOfGuests(matchedReservation.number_of_guests);
          }
          
          if (matchedReservation.guest_name) {
            setGuests(prevGuests => {
              const updatedGuests = [...prevGuests];
              updatedGuests[0] = { ...updatedGuests[0], fullName: matchedReservation.guest_name };
              return updatedGuests;
            });
          }
        }
      } catch (error) {
        console.error('❌ Error matching Airbnb booking:', error);
      }
    };

    matchAirbnbBooking();
  }, [airbnbBookingId, isValidToken, propertyId]);

  const addGuest = () => {
    setGuests([...guests, {
      fullName: '',
      dateOfBirth: undefined,
      nationality: '',
      documentNumber: '',
      documentType: 'passport'
    }]);
  };

  const updateGuest = (index: number, field: keyof Guest, value: any) => {
    const updatedGuests = [...guests];
    updatedGuests[index] = { ...updatedGuests[index], [field]: value };
    setGuests(updatedGuests);
  };

  const removeGuest = (index: number) => {
    if (guests.length > 1) {
      setGuests(guests.filter((_, i) => i !== index));
    }
  };

  const handleFileUpload = async (files: FileList) => {
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      if (!file.type.startsWith('image/')) {
        toast({
          title: t('upload.error.notImage.title'),
          description: t('upload.error.notImage.desc', { filename: file.name }),
          variant: "destructive"
        });
        continue;
      }

      const url = URL.createObjectURL(file);
      const newDoc: UploadedDocument = {
        file,
        url,
        processing: true,
        extractedData: null
      };

      setUploadedDocuments(prev => [...prev, newDoc]);

      try {
        const extractedData = await OpenAIDocumentService.extractDocumentData(file);

        setUploadedDocuments(prev => 
          prev.map(doc => 
            doc.url === url 
              ? { ...doc, processing: false, extractedData }
              : doc
          )
        );

        if (extractedData && Object.keys(extractedData).length > 0) {
          const hasRequiredIdFields = extractedData.fullName && 
                                    extractedData.documentNumber && 
                                    extractedData.nationality && 
                                    extractedData.documentType;

          if (!hasRequiredIdFields) {
            toast({
              title: t('upload.docInvalid.title'),
              description: t('upload.docInvalid.desc'),
              variant: "destructive",
            });
            
            setUploadedDocuments(prev => 
              prev.map(doc => 
                doc.url === url 
                  ? { ...doc, processing: false, extractedData: null, isInvalid: true }
                  : doc
              )
            );
            return;
          }

          const updatedGuests = [...guests];
          const emptyGuestIndex = updatedGuests.findIndex(guest => 
            !guest.fullName && !guest.documentNumber
          );
          
          if (emptyGuestIndex !== -1) {
            const targetIndex = emptyGuestIndex;
            if (extractedData.fullName) updatedGuests[targetIndex].fullName = extractedData.fullName;
            if (extractedData.nationality) updatedGuests[targetIndex].nationality = extractedData.nationality;
            if (extractedData.documentNumber) updatedGuests[targetIndex].documentNumber = extractedData.documentNumber;
            if (extractedData.documentType) updatedGuests[targetIndex].documentType = extractedData.documentType as 'passport' | 'national_id';
            if (extractedData.dateOfBirth) {
              const parsedDate = new Date(extractedData.dateOfBirth);
              if (!isNaN(parsedDate.getTime())) {
                updatedGuests[targetIndex].dateOfBirth = parsedDate;
              }
            }
            setGuests(updatedGuests);
          } else {
            const newGuest: Guest = {
              fullName: extractedData.fullName || '',
              dateOfBirth: extractedData.dateOfBirth ? new Date(extractedData.dateOfBirth) : undefined,
              nationality: extractedData.nationality || '',
              documentNumber: extractedData.documentNumber || '',
              documentType: (extractedData.documentType as 'passport' | 'national_id') || 'passport'
            };
            setGuests([...updatedGuests, newGuest]);
          }

          toast({
            title: "Document traité",
            description: "Document d'identité valide. Informations extraites automatiquement.",
          });
        } else {
          toast({
            title: t('upload.docNotRecognized.title'),
            description: t('upload.docNotRecognized.desc'),
            variant: "destructive"
          });
        }
      } catch (error) {
        console.error('Document processing failed:', error);
        setUploadedDocuments(prev => 
          prev.map(doc => 
            doc.url === url 
              ? { ...doc, processing: false }
              : doc
          )
        );
        
        toast({
          title: t('upload.warning.title'),
          description: t('upload.warning.desc'),
          variant: "destructive"
        });
      }
    }
  };

  const removeDocument = (url: string) => {
    console.log('🗑️ Removing document:', url);
    
    const docToRemove = uploadedDocuments.find(doc => doc.url === url);
    
    if (docToRemove && docToRemove.extractedData) {
      console.log('📄 Document had extracted data, finding associated guest...');
      
      const guestToResetIndex = guests.findIndex(guest => 
        guest.fullName === docToRemove.extractedData?.fullName ||
        guest.documentNumber === docToRemove.extractedData?.documentNumber
      );
      
      if (guestToResetIndex !== -1) {
        console.log('✂️ Clearing guest data at index:', guestToResetIndex);
        
        const updatedGuests = [...guests];
        updatedGuests[guestToResetIndex] = {
          fullName: '',
          dateOfBirth: undefined,
          nationality: '',
          documentNumber: '',
          documentType: 'passport'
        };
        setGuests(updatedGuests);
        
        toast({
          title: t('removeDoc.deleted.title'),
          description: t('removeDoc.deleted.desc'),
        });
      }
    }
    
    setUploadedDocuments(prev => prev.filter(doc => doc.url !== url));
    URL.revokeObjectURL(url);
  };

  const handleSubmit = async () => {
    console.log('🔍 Validation - Upload check:', {
      uploadedDocuments: uploadedDocuments.length,
      numberOfGuests: numberOfGuests,
      guestsArray: guests.length
    });

    if (!checkInDate || !checkOutDate) {
      toast({
        title: t('validation.error.title'),
        description: t('validation.selectDates.desc'),
        variant: "destructive"
      });
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkInDateStartOfDay = new Date(checkInDate);
    checkInDateStartOfDay.setHours(0, 0, 0, 0);
    
    if (checkInDateStartOfDay < today) {
      toast({
        title: t('validation.error.title'),
        description: t('validation.dateFuture.desc'),
        variant: "destructive"
      });
      return;
    }

    if (uploadedDocuments.length !== numberOfGuests) {
      console.log('❌ Document validation failed:', {
        uploadedCount: uploadedDocuments.length,
        expectedCount: numberOfGuests
      });
      toast({
        title: t('validation.error.title'),
        description: t('validation.exactDocs.desc', { count: numberOfGuests, s: numberOfGuests > 1 ? 's' : '' }),
        variant: "destructive"
      });
      return;
    }

    console.log('✅ Document validation passed');

    const incompleteGuests = guests.filter(guest => 
      !guest.fullName || !guest.dateOfBirth || !guest.nationality || !guest.documentNumber
    );

    if (incompleteGuests.length > 0) {
      toast({
        title: t('validation.error.title'),
        description: t('validation.completeGuests.desc'),
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const guestData = {
        guests: guests.map(guest => ({
          ...guest,
          dateOfBirth: guest.dateOfBirth ? format(guest.dateOfBirth, 'yyyy-MM-dd') : null
        }))
      };

      const bookingData = {
        checkInDate: format(checkInDate, 'yyyy-MM-dd'),
        checkOutDate: format(checkOutDate, 'yyyy-MM-dd'),
        numberOfGuests
      };

      // ✅ CORRECTION : Déclarer uploadErrors AVANT de l'utiliser
      const uploadErrors: string[] = [];
      const finalDocumentUrls: string[] = [];
      
      // ✅ CORRECTION : Validation préventive des noms de fichiers (autoriser caractères français)
      const validateFileName = (fileName: string) => {
        // Autoriser lettres, chiffres, points, tirets, espaces ET caractères français courants
        const invalidChars = /[^a-zA-ZÀ-ÿ0-9.\-\s'`]/;
        if (invalidChars.test(fileName)) {
          return `Le nom de fichier "${fileName}" contient des caractères non autorisés. Utilisez seulement des lettres, chiffres, points, tirets, espaces et caractères français.`;
        }
        return null;
      };
      
      // Vérifier tous les noms de fichiers avant l'upload
      for (const doc of uploadedDocuments) {
        const validationError = validateFileName(doc.file.name);
        if (validationError) {
          uploadErrors.push(validationError);
        }
      }
      
      if (uploadErrors.length > 0) {
        const errorMessage = `Noms de fichiers invalides: ${uploadErrors.join(', ')}`;
        console.error('❌', errorMessage);
        toast({
          title: "Noms de fichiers invalides",
          description: errorMessage,
          variant: "destructive"
        });
        return;
      }
      
      // Upload documents to storage first
      for (const doc of uploadedDocuments) {
        try {
                     // ✅ CORRECTION : Normaliser le nom de fichier pour éviter les erreurs Supabase
           const sanitizeFileName = (originalName: string) => {
             return originalName
               // Remplacer TOUS les caractères spéciaux par des underscores pour Supabase
               .replace(/[^a-zA-Z0-9.-]/g, '_')
               .replace(/_+/g, '_')
               .replace(/^_|_$/g, '')
               // Limiter la longueur pour éviter les erreurs
               .substring(0, 100);
           };
          
          const safeFileName = sanitizeFileName(doc.file.name);
          const fileName = `${Date.now()}_${safeFileName}`;
          console.log('📤 Uploading document:', fileName);
          
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('guest-documents')
            .upload(fileName, doc.file);

                     if (uploadError) {
             console.error('❌ Upload error for', fileName, ':', uploadError);
             console.error('💡 Original filename:', doc.file.name);
             console.error('💡 Sanitized filename:', fileName);
             
             if (uploadError.message.includes('Invalid key')) {
               uploadErrors.push(`Nom de fichier invalide: "${doc.file.name}" → "${fileName}"`);
               console.error('💡 Suggestion: Le nom de fichier contient des caractères spéciaux non autorisés par Supabase');
             } else {
               uploadErrors.push(`Échec upload ${doc.file.name}: ${uploadError.message}`);
             }
             continue;
           }

          console.log('✅ Document uploaded successfully:', fileName);
          
          const { data: signedData, error: signedError } = await supabase.functions.invoke('storage-sign-url', {
            body: { bucket: 'guest-documents', path: fileName, expiresIn: 3600 }
          });
          
          if (signedError) {
            console.error('❌ Signed URL error for', fileName, ':', signedError);
            uploadErrors.push(`Échec URL signée ${doc.file.name}: ${signedError.message}`);
            continue;
          }
          
          if (signedData?.signedUrl) {
            finalDocumentUrls.push(signedData.signedUrl);
            console.log('✅ Signed URL created:', signedData.signedUrl);
          } else {
            console.error('❌ No signed URL returned for', fileName);
            uploadErrors.push(`Pas d'URL signée pour ${doc.file.name}`);
          }
        } catch (error) {
          console.error('❌ Error uploading document:', error);
          uploadErrors.push(`Erreur upload ${doc.file.name}: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
        }
      }

      if (finalDocumentUrls.length !== uploadedDocuments.length) {
        const errorMessage = `Échec upload: ${uploadedDocuments.length - finalDocumentUrls.length}/${uploadedDocuments.length} documents non uploadés. Erreurs: ${uploadErrors.join(', ')}`;
        console.error('❌', errorMessage);
        throw new Error(errorMessage);
      }

      console.log('✅ Tous les documents uploadés avec succès:', finalDocumentUrls);

      const finalGuestData = {
        ...guestData,
        documentUrls: finalDocumentUrls
      };

      const { data, error: functionError } = await supabase.functions.invoke('submit-guest-info', {
        body: {
          propertyId,
          token,
          bookingData,
          guestData: finalGuestData
        }
      });

      if (functionError) {
        console.error('Function error:', functionError);
        throw new Error(functionError.message || 'Erreur lors de la soumission');
      }

      if (!data?.success || !data?.bookingId) {
        throw new Error(data?.message || 'Erreur lors de la création de la réservation');
      }

      const bookingId = data.bookingId as string;
      console.log('✅ Booking created with ID:', bookingId);

      toast({
        title: "Données soumises avec succès",
        description: "Vous pouvez maintenant signer le contrat.",
      });

      const baseUrl = `/contract-signing/${propertyId}/${token}`;
      const url = airbnbBookingId ? `${baseUrl}/${airbnbBookingId}` : baseUrl;
      navigate(url, { state: { bookingId, bookingData, guestData: finalGuestData } });

    } catch (error) {
      console.error('Error submitting guest information:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      toast({
        title: "Erreur",
        description: `Erreur lors de l'envoi des informations: ${errorMessage}`,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (checkingToken) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-white to-teal-50 flex items-center justify-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-16 h-16 mx-auto mb-4 rounded-full border-4 border-primary/20 border-t-primary"
          />
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-lg text-muted-foreground font-medium"
          >
            Vérification du lien...
          </motion.p>
        </motion.div>
      </div>
    );
  }

  if (!isValidToken) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md mx-auto"
        >
          <Card className="border-red-200 shadow-xl">
            <CardHeader className="text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring" }}
                className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center"
              >
                <X className="w-8 h-8 text-red-600" />
              </motion.div>
              <CardTitle className="text-red-800">{t('guest.invalidLink.title')}</CardTitle>
              <CardDescription className="text-red-600">
                {t('guest.invalidLink.desc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-red-600">
                Veuillez contacter votre hôte pour obtenir un nouveau lien.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  const handleNextStep = () => {
    if (!checkInDate || !checkOutDate) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner les dates d'arrivée et de départ",
        variant: "destructive"
      });
      return;
    }

    const validation = validateDates(checkInDate, checkOutDate);
    if (!validation.isValid) {
      toast({
        title: t('validation.error.title'),
        description: validation.error!,
        variant: "destructive"
      });
      return;
    }

    setCurrentStep('documents');
  };

  const handlePrevStep = () => {
    setCurrentStep('booking');
  };

  if (submissionComplete) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          <Card className="p-8 max-w-md border-green-200 shadow-2xl">
            <CardContent className="text-center space-y-6">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 300 }}
              >
                <CheckCircle className="w-20 h-20 text-green-500 mx-auto" />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <h2 className="text-3xl font-bold text-green-800">Merci!</h2>
                <p className="text-green-600 mt-2">
                  Vos informations ont été soumises avec succès. Vous pouvez maintenant procéder à la signature du contrat.
                </p>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
              >
                <Button 
                  onClick={() => {
                    const baseUrl = `/contract-signing/${propertyId}/${token}`;
                    const url = airbnbBookingId ? `${baseUrl}/${airbnbBookingId}` : baseUrl;
                    navigate(url);
                  }}
                  className="w-full bg-green-600 hover:bg-green-700"
                  size="lg"
                >
                  <FileText className="w-5 h-5 mr-2" />
                  {t('contractSignature.signContract')}
                </Button>
              </motion.div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  const currentStepIndex = ['booking', 'documents', 'signature'].indexOf(currentStep);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-brand-turquoise/10 py-8">
      <div className="container mx-auto px-4 max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Card className="shadow-2xl border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-brand-cyan/5 to-brand-turquoise/5 border-b border-gray-100">
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <CardTitle className="text-3xl font-bold text-center text-gray-900">
                  {t('guest.verification.title')}
                </CardTitle>
                <CardDescription className="text-center text-lg mt-2 text-gray-600">
                  {t('guest.verification.subtitle', { propertyName })}
                </CardDescription>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 }}
                className="mt-8"
              >
                <AnimatedStepper
                  steps={steps}
                  currentStep={currentStepIndex}
                  size="md"
                />
              </motion.div>
            </CardHeader>
            
            <CardContent className="p-8">
              <AnimatePresence mode="wait">
                {currentStep === 'booking' && (
                  <motion.div
                    key="booking"
                    variants={fadeInUp}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={{ duration: 0.5 }}
                  >
                    <motion.div variants={stagger} className="space-y-8">
                      <motion.div variants={fadeInUp}>
                        <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                          <CalendarLucide className="w-6 h-6 text-primary" />
                          {t('guest.booking.title')}
                        </h3>
                      </motion.div>
                      
                      <motion.div variants={fadeInUp} className="flex justify-center">
                        <IntuitiveBookingPicker
                          checkInDate={checkInDate}
                          checkOutDate={checkOutDate}
                          onDatesChange={(checkIn, checkOut) => {
                            setCheckInDate(checkIn);
                            setCheckOutDate(checkOut);
                          }}
                          numberOfGuests={numberOfGuests}
                          onGuestsChange={(newGuestCount) => {
                            setNumberOfGuests(newGuestCount);
                            
                            const currentGuests = [...guests];
                            
                            if (newGuestCount > currentGuests.length) {
                              for (let i = currentGuests.length; i < newGuestCount; i++) {
                                currentGuests.push({
                                  fullName: '',
                                  dateOfBirth: undefined,
                                  nationality: '',
                                  documentNumber: '',
                                  documentType: 'passport'
                                });
                              }
                            } else if (newGuestCount < currentGuests.length) {
                              currentGuests.splice(newGuestCount);
                            }
                            
                            setGuests(currentGuests);
                          }}
                          propertyName={propertyName}
                        />
                      </motion.div>
                    </motion.div>

                    <motion.div 
                      variants={fadeInUp}
                      className="flex justify-end pt-8"
                    >
                      <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                        <Button onClick={handleNextStep} size="lg" className="px-8 py-3 bg-brand-teal hover:bg-brand-teal/90">
                          {t('guest.navigation.next')}
                          <ArrowRight className="w-5 h-5 ml-2" />
                        </Button>
                      </motion.div>
                    </motion.div>
                  </motion.div>
                )}

                {currentStep === 'documents' && (
                  <motion.div
                    key="documents"
                    variants={slideInRight}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={{ duration: 0.5 }}
                  >
                    <motion.div variants={stagger} className="space-y-8">
                      <motion.div variants={fadeInUp}>
                        <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                          <FileText className="w-6 h-6 text-primary" />
                          {t('guest.documents.title')}
                        </h3>
                      </motion.div>
                      
                      <motion.div variants={fadeInUp}>
                        <EnhancedFileUpload
                          onFilesUploaded={handleFileUpload}
                          uploadedFiles={uploadedDocuments}
                          onRemoveFile={removeDocument}
                          maxFiles={numberOfGuests}
                          acceptedTypes="image/*"
                          maxSizeMB={5}
                          showPreview={true}
                        />
                      </motion.div>

                      <motion.div variants={fadeInUp} className="space-y-6">
                        <div className="flex items-center gap-3 mb-4">
                          <Users className="w-6 h-6 text-primary" />
                          <h4 className="text-xl font-bold text-gray-900">{t('guest.clients.title')}</h4>
                          <div className="flex-1 h-px bg-gradient-to-r from-primary/30 to-transparent"></div>
                        </div>

                        <motion.div variants={stagger} className="space-y-6">
                          {guests.map((guest, index) => (
                            <motion.div
                              key={index}
                              variants={fadeInUp}
                              whileHover={{ y: -2 }}
                              transition={{ type: "spring", stiffness: 300 }}
                            >
                              <Card className="p-6 border-2 border-gray-100 hover:border-primary/30 transition-all duration-300 shadow-lg hover:shadow-xl bg-gradient-to-r from-white to-gray-50/50">
                                <div className="flex items-center justify-between mb-6">
                                  <h4 className="font-bold text-lg text-gray-900 flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-brand-teal flex items-center justify-center text-white font-bold text-sm">
                                      {index + 1}
                                    </div>
                                    {t('guest.clients.clientNumber', { number: index + 1 })}
                                  </h4>
                                  {guests.length > 1 && (
                                    <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                                      <Button 
                                        onClick={() => removeGuest(index)} 
                                        variant="destructive" 
                                        size="sm"
                                        className="rounded-full"
                                      >
                                        <X className="w-4 h-4" />
                                      </Button>
                                    </motion.div>
                                  )}
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  <EnhancedInput
                                    label={t('guest.clients.fullName')}
                                    value={guest.fullName}
                                    onChange={(e) => updateGuest(index, 'fullName', e.target.value)}
                                    placeholder={t('guest.clients.fullNamePlaceholder')}
                                    validation={{
                                      required: true,
                                      minLength: 2,
                                      validator: (value) => {
                                        if (value.trim().split(' ').length < 2) {
                                          return "Veuillez saisir le nom et prénom";
                                        }
                                        return null;
                                      }
                                    }}
                                  />
                                  
                                  <div className="space-y-2">
                                    <Label className="text-sm font-medium text-gray-700">
                                      {t('guest.clients.dateOfBirth')} *
                                    </Label>
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                                          <Button variant="outline" className="w-full justify-start text-left h-12 border-2 hover:border-primary/50">
                                            <CalendarIcon className="mr-3 h-5 w-5 text-primary" />
                                            {guest.dateOfBirth ? format(guest.dateOfBirth, 'dd/MM/yyyy') : t('guest.booking.selectDate')}
                                          </Button>
                                        </motion.div>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-auto p-0 border-2 shadow-xl">
                                        <Calendar
                                          mode="single"
                                          selected={guest.dateOfBirth}
                                          onSelect={(date) => updateGuest(index, 'dateOfBirth', date)}
                                          initialFocus
                                        />
                                      </PopoverContent>
                                    </Popover>
                                  </div>
                                  
                                  <div className="space-y-2">
                                    <Label className="text-sm font-medium text-gray-700">
                                      {t('guest.clients.nationality')} *
                                    </Label>
                                    {uploadedDocuments.length > 0 && !guest.nationality ? (
                                      <Select 
                                        value={guest.nationality || ''} 
                                        onValueChange={(value) => updateGuest(index, 'nationality', value)}
                                      >
                                        <SelectTrigger className="h-12 border-2 hover:border-primary/50">
                                          <SelectValue placeholder="Sélectionner la nationalité" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-card border border-border shadow-lg z-50 max-h-60 overflow-y-auto">
                                          {NATIONALITIES.map((nationality, idx) => (
                                            nationality === '---' ? (
                                              <div key={idx} className="mx-2 my-1 border-t border-border"></div>
                                            ) : (
                                              <SelectItem key={nationality} value={nationality}>
                                                {nationality}
                                              </SelectItem>
                                            )
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    ) : (
                                      <EnhancedInput
                                        value={guest.nationality}
                                        onChange={(e) => updateGuest(index, 'nationality', e.target.value)}
                                        placeholder={uploadedDocuments.length === 0 ? "Uploadez d'abord votre document" : "Nationalité"}
                                        disabled={uploadedDocuments.length === 0}
                                        validation={{ required: true }}
                                      />
                                    )}
                                  </div>
                                  
                                  <div className="space-y-2">
                                    <Label className="text-sm font-medium text-gray-700">
                                      {t('guest.clients.documentType')} *
                                    </Label>
                                    <Select 
                                      value={guest.documentType} 
                                      onValueChange={(value) => updateGuest(index, 'documentType', value)}
                                    >
                                      <SelectTrigger className="h-12 border-2 hover:border-primary/50">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="passport">{t('guest.clients.passport')}</SelectItem>
                                        <SelectItem value="national_id">{t('guest.clients.nationalId')}</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  
                                  <EnhancedInput
                                    label={t('guest.clients.documentNumber')}
                                    value={guest.documentNumber}
                                    onChange={(e) => updateGuest(index, 'documentNumber', e.target.value)}
                                    placeholder={t('guest.clients.documentNumberPlaceholder')}
                                    validation={{
                                      required: true,
                                      minLength: 5,
                                      validator: (value) => {
                                        if (!/^[A-Z0-9]+$/i.test(value.replace(/\s/g, ''))) {
                                          return "Format de document invalide";
                                        }
                                        return null;
                                      }
                                    }}
                                  />
                                </div>
                              </Card>
                            </motion.div>
                          ))}
                        </motion.div>
                      </motion.div>
                    </motion.div>

                    <motion.div 
                      variants={fadeInUp}
                      className="flex justify-between pt-8"
                    >
                      <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                        <Button variant="outline" onClick={handlePrevStep} size="lg" className="px-8 py-3 border-2">
                          <ArrowLeft className="w-5 h-5 mr-2" />
                          {t('guest.navigation.previous')}
                        </Button>
                      </motion.div>
                      
                      <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                        <Button 
                          onClick={handleSubmit} 
                          disabled={isLoading}
                          size="lg"
                          className="px-8 py-3 bg-brand-teal hover:bg-brand-teal/90"
                        >
                          {isLoading ? (
                            <>
                              <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                className="w-5 h-5 mr-2 border-2 border-white border-t-transparent rounded-full"
                              />
                              Envoi en cours...
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-5 h-5 mr-2" />
                              {t('guest.cta.sendInfo')}
                            </>
                          )}
                        </Button>
                      </motion.div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};
