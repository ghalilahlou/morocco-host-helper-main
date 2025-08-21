import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Upload, FileText, X, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { OpenAIDocumentService } from '@/services/openaiDocumentService';
import { useT } from '@/i18n/GuestLocaleProvider';

// Liste complète des nationalités (noms de pays en anglais)
const NATIONALITIES = [
  'Morocco',
  // Séparateur visuel après Morocco
  '---',
  'France', 'Spain', 'Italy', 'Germany', 'United Kingdom', 'Belgium', 'Netherlands', 'Portugal',
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
  'Taiwan', 'Hong Kong', 'Macao', 'Myanmar', 'Laos', 'Cambodia', 'Brunei', 'Timor-Leste',
  'Other'
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

export const GuestVerification = () => {
  const { propertyId, token, airbnbBookingId } = useParams<{
    propertyId: string;
    token: string;
    airbnbBookingId?: string;
  }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const t = useT();
  const [isLoading, setIsLoading] = useState(false);
  const [submissionComplete, _setSubmissionComplete] = useState(false);
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
            airbnbCode: airbnbBookingId // Use the router param
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
      // Check if we have basic required data
      if (!isValidToken || !propertyId || !airbnbBookingId) {
        return;
      }

        try {
          const { data: searchResult, error: searchError } = await supabase.functions.invoke('get-airbnb-reservation', {
            body: { propertyId, bookingId: airbnbBookingId }
          });

          if (searchError) {
            console.error('❌ Edge function error:', searchError);
            // Toast removed - silent error handling
            return;
          }

          if (searchResult?.reservation) {
            {
              const matchedReservation = searchResult.reservation;

              // Found a matching reservation - auto-fill dates
              const foundCheckInDate = new Date(matchedReservation.start_date);
              const foundCheckOutDate = new Date(matchedReservation.end_date);

              setCheckInDate(foundCheckInDate);
              setCheckOutDate(foundCheckOutDate);
            }

            if (searchResult.reservation.number_of_guests) {
              setNumberOfGuests(searchResult.reservation.number_of_guests);
            }

            if (searchResult.reservation.guest_name) {
              setGuests(prevGuests => {
                const updatedGuests = [...prevGuests];
                updatedGuests[0] = { ...updatedGuests[0], fullName: searchResult.reservation.guest_name };
                return updatedGuests;
              });
            }

            // Silent success - dates auto-filled without notification
          } else {
            // No exact match found - silent handling
          }
      } catch (error) {
        console.error('❌ Error matching Airbnb booking:', error);
        // Silent error handling - no toast notification
      }
    };

    matchAirbnbBooking();
  }, [airbnbBookingId, isValidToken, propertyId]);

  const _addGuest = () => {
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

    // Process each file
    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast({
          title: t('upload.error.notImage.title'),
          description: t('upload.error.notImage.desc', { filename: file.name }),
          variant: "destructive"
        });
        continue;
      }

      {
        const url = URL.createObjectURL(file);
        const newDoc: UploadedDocument = {
          file,
          url,
          processing: true,
          extractedData: null
        };

        setUploadedDocuments(prev => [...prev, newDoc]);
      }

    try {
      // Process with OpenAI document extraction
      const extractedData = await OpenAIDocumentService.extractDocumentData(file);

      // Update document with extracted data
      setUploadedDocuments(prev =>
        prev.map(doc =>
          doc.url === url
            ? { ...doc, processing: false, extractedData }
            : doc
        )
      );

      // Check if document is a valid ID document
      if (extractedData && Object.keys(extractedData).length > 0) {
        {
          // Validate that essential ID fields are present
          const hasRequiredIdFields = extractedData.fullName &&
                                    extractedData.documentNumber &&
                                    extractedData.nationality &&
                                    extractedData.documentType;

          if (!hasRequiredIdFields) {
            // Document is not a valid ID - alert user
            toast({
              title: t('upload.docInvalid.title'),
              description: t('upload.docInvalid.desc'),
              variant: "destructive",
            });

            // Mark document as invalid but keep it for manual review
            setUploadedDocuments(prev =>
              prev.map(doc =>
                doc.url === url
                  ? { ...doc, processing: false, extractedData: null, isInvalid: true }
                  : doc
              )
            );
            return;
          }
        }

        // Document is valid - proceed with auto-fill
        {
          const updatedGuests = [...guests];
          const emptyGuestIndex = updatedGuests.findIndex(guest =>
            !guest.fullName && !guest.documentNumber
          );

          if (emptyGuestIndex !== -1) {
            {
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
            }
          } else {
            // Add new guest if all existing guests are filled
            {
              const newGuest: Guest = {
                fullName: extractedData.fullName ?? '',
                dateOfBirth: extractedData.dateOfBirth ? new Date(extractedData.dateOfBirth) : undefined,
                nationality: extractedData.nationality ?? '',
                documentNumber: extractedData.documentNumber ?? '',
                documentType: (extractedData.documentType as 'passport' | 'national_id') ?? 'passport'
              };
              setGuests([...updatedGuests, newGuest]);
            }
          }
        }

        toast({
          title: "Document traité",
          description: "Document d'identité valide. Informations extraites automatiquement.",
        });
      } else {
        // No data extracted - could be invalid document
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

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileUpload(files);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const removeDocument = (url: string) => {
    console.log('🗑️ Removing document:', url);

    // Find the document being removed
    const docToRemove = uploadedDocuments.find(doc => doc.url === url);

    if (docToRemove?.extractedData) {
      console.log('📄 Document had extracted data, finding associated guest...');

      // Find and clear the guest that was auto-filled from this document
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

    // Remove the document
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

    // Validation: Check if check-in date is in the future
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of day for comparison
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

    // Validation: Check if checkout date is after checkin date
    if (checkOutDate <= checkInDate) {
      toast({
        title: t('validation.error.title'),
        description: t('validation.checkoutAfterCheckin.desc'),
        variant: "destructive"
      });
      return;
    }

    // Validation: Check if number of uploaded documents matches number of guests
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
      // Property validation is handled by the edge function with service-role access

      // Prepare guest data
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

      // Upload documents to storage first
      const finalDocumentUrls: string[] = [];
      for (const doc of uploadedDocuments) {
        try {
          const fileName = `${Date.now()}_${doc.file.name}`;

          const { error: uploadError } = await supabase.storage
            .from('guest-documents')
            .upload(fileName, doc.file);

          if (uploadError) {
            console.error('Upload error for', fileName, ':', uploadError);
          } else {
            // Create signed URL for immediate use in submission
            const { data: signedData } = await supabase.functions.invoke('storage-sign-url', {
              body: { bucket: 'guest-documents', path: fileName, expiresIn: 3600 }
            });

            if (signedData?.signedUrl) {
              finalDocumentUrls.push(signedData.signedUrl);
            }
          }
        } catch (error) {
          console.error('Error uploading document:', error);
        }
      }

      // Add document URLs to guest data
      const finalGuestData = {
        ...guestData,
        documentUrls: finalDocumentUrls
      };

      // Call edge function to submit guest info and create booking
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

      // Navigate to signing page with bookingId and pass data via state to avoid RLS reads
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
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Vérification du lien...</p>
        </div>
      </div>
    );
  }

  if (!isValidToken) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-destructive">{t('guest.invalidLink.title')}</CardTitle>
            <CardDescription className="text-center">
              {t('guest.invalidLink.desc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground">
              Veuillez contacter votre hôte pour obtenir un nouveau lien.
            </p>
          </CardContent>
        </Card>
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

    // Validation: Check if check-in date is in the future
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of day for comparison
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

    // Validation: Check if checkout date is after checkin date
    if (checkOutDate <= checkInDate) {
      toast({
        title: t('validation.error.title'),
        description: t('validation.checkoutAfterCheckin.desc'),
        variant: "destructive"
      });
      return;
    }

    setCurrentStep('documents');
  };

  const handlePrevStep = () => {
    setCurrentStep('booking');
  };

  // Show completion screen with contract signing option
  if (submissionComplete) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 flex items-center justify-center">
        <Card className="p-8 max-w-md">
          <CardContent className="text-center space-y-4">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
            <h2 className="text-2xl font-bold text-foreground">Merci!</h2>
            <p className="text-muted-foreground">
              Vos informations ont été soumises avec succès. Vous pouvez maintenant procéder à la signature du contrat.
            </p>
            <Button
              onClick={() => {
                const baseUrl = `/contract-signing/${propertyId}/${token}`;
                const url = airbnbBookingId ? `${baseUrl}/${airbnbBookingId}` : baseUrl;
                navigate(url);
              }}
              className="w-full"
              size="lg"
            >
              <FileText className="w-4 h-4 mr-2" />
              {t('contractSignature.signContract')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{t('guest.verification.title')}</CardTitle>
          <CardDescription>
            {t('guest.verification.subtitle', { propertyName })}
          </CardDescription>
          <div className="flex items-center space-x-2 text-sm text-muted-foreground mt-4">
            <div className={`flex items-center space-x-2 ${currentStep === 'booking' ? 'text-primary' : ''}`}>
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${currentStep === 'booking' ? 'border-primary bg-primary text-white' : 'border-muted-foreground'}`}>
                1
              </div>
              <span>{t('guest.booking.title')}</span>
            </div>
            <div className="w-8 h-px bg-border"></div>
            <div className={`flex items-center space-x-2 ${currentStep === 'documents' ? 'text-primary' : ''}`}>
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${currentStep === 'documents' ? 'border-primary bg-primary text-white' : 'border-muted-foreground'}`}>
                2
              </div>
              <span>{t('guest.documents.title')}</span>
            </div>
            <div className="w-8 h-px bg-border"></div>
            <div className={`flex items-center space-x-2 ${currentStep === 'signature' ? 'text-primary' : ''}`}>
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${currentStep === 'signature' ? 'border-primary bg-primary text-white' : 'border-muted-foreground'}`}>
                3
              </div>
              <span>{t('contractSignature.pill')}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {currentStep === 'booking' && (
            <>
              {/* Booking Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">{t('guest.booking.title')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>{t('guest.booking.checkIn')}</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {checkInDate ? format(checkInDate, 'dd/MM/yyyy') : t('guest.booking.selectDate')}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={checkInDate}
                          onSelect={setCheckInDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('guest.booking.checkOut')}</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {checkOutDate ? format(checkOutDate, 'dd/MM/yyyy') : t('guest.booking.selectDate')}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={checkOutDate}
                          onSelect={setCheckOutDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                   <div className="space-y-2">
                     <Label>{t('guest.booking.numberOfGuests')}</Label>
                     <div className="flex items-center space-x-2">
                       <Button
                         type="button"
                         variant="outline"
                         size="sm"
                         onClick={() => {
                           if (numberOfGuests > 1) {
                             const newCount = numberOfGuests - 1;
                             setNumberOfGuests(newCount);
                             const currentGuests = [...guests];
                             currentGuests.splice(newCount);
                             setGuests(currentGuests);
                           }
                         }}
                         disabled={numberOfGuests <= 1}
                       >
                         -
                       </Button>
                       <Input
                         type="text"
                         value={numberOfGuests === 0 ? '' : numberOfGuests.toString()}
                         onChange={(e) => {
                           const value = e.target.value;

                           // Allow empty input or digits only
                           if (value === '' || /^\d+$/.test(value)) {
                             const newCount = value === '' ? 0 : parseInt(value);

                             // Allow temporary 0 state for empty input
                             if (newCount === 0) {
                               setNumberOfGuests(0);
                               return;
                             }

                             if (newCount >= 1 && newCount <= 20) {
                               setNumberOfGuests(newCount);

                               // Adjust guests array to match the number
                               const currentGuests = [...guests];

                               if (newCount > currentGuests.length) {
                                 // Add more guests
                                 for (let i = currentGuests.length; i < newCount; i++) {
                                   currentGuests.push({
                                     fullName: '',
                                     dateOfBirth: undefined,
                                     nationality: '',
                                     documentNumber: '',
                                     documentType: 'passport'
                                   });
                                 }
                               } else if (newCount < currentGuests.length) {
                                 // Remove excess guests
                                 currentGuests.splice(newCount);
                               }

                               setGuests(currentGuests);
                             }
                           }
                         }}
                         onBlur={(e) => {
                           // Ensure we have at least 1 when user leaves the field
                           if (e.target.value === '' || parseInt(e.target.value) < 1) {
                             setNumberOfGuests(1);
                             // Reset guests array to have at least 1 guest
                             if (guests.length === 0) {
                               setGuests([{
                                 fullName: '',
                                 dateOfBirth: undefined,
                                 nationality: '',
                                 documentNumber: '',
                                 documentType: 'passport'
                               }]);
                             }
                           }
                         }}
                         className="w-20 text-center"
                       />
                       <Button
                         type="button"
                         variant="outline"
                         size="sm"
                         onClick={() => {
                           if (numberOfGuests < 20) {
                             const newCount = numberOfGuests + 1;
                             setNumberOfGuests(newCount);
                             const currentGuests = [...guests];

                             // Add new guest
                             currentGuests.push({
                               fullName: '',
                               dateOfBirth: undefined,
                               nationality: '',
                               documentNumber: '',
                               documentType: 'passport'
                             });

                             setGuests(currentGuests);
                           }
                         }}
                         disabled={numberOfGuests >= 20}
                       >
                         +
                       </Button>
                     </div>
                   </div>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button onClick={handleNextStep}>
                  {t('guest.navigation.next')}
                </Button>
              </div>
            </>
          )}

          {currentStep === 'documents' && (
            <>
              {/* Document Upload */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">{t('guest.documents.title')}</h3>
                <div
                  className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6"
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                >
                  <div className="text-center">
                    <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        {t('guest.documents.dropzone')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t('guest.documents.autoExtract')}
                      </p>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      id="document-upload"
                      onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                    />
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => document.getElementById('document-upload')?.click()}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {t('guest.documents.selectFiles')}
                    </Button>
                  </div>
                </div>

                {/* Uploaded Documents */}
                {uploadedDocuments.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium">{t('guest.documents.uploaded')}</h4>
                    {uploadedDocuments.map((doc, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <FileText className="w-5 h-5 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">{doc.file.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {doc.processing ? 'Traitement en cours...' :
                               doc.extractedData ? 'Traité avec succès' : 'Prêt'}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeDocument(doc.url)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Guest Information */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold">{t('guest.clients.title')}</h3>
                </div>

                {guests.map((guest, index) => (
                  <Card key={index} className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-medium">{t('guest.clients.clientNumber', { number: index + 1 })}</h4>
                      {guests.length > 1 && (
                        <Button
                          onClick={() => removeGuest(index)}
                          variant="destructive"
                          size="sm"
                        >
                          Supprimer
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>{t('guest.clients.fullName')} *</Label>
                        <Input
                          value={guest.fullName}
                          onChange={(e) => updateGuest(index, 'fullName', e.target.value)}
                          placeholder={t('guest.clients.fullNamePlaceholder')}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{t('guest.clients.dateOfBirth')} *</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-start text-left">
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {guest.dateOfBirth ? format(guest.dateOfBirth, 'dd/MM/yyyy') : t('guest.booking.selectDate')}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
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
                        <Label>{t('guest.clients.nationality')} *</Label>
                        {/* Only show nationality dropdown if document uploaded and nationality not detected */}
                        {uploadedDocuments.length > 0 && !guest.nationality ? (
                          <Select
                            value={guest.nationality || ''}
                            onValueChange={(value) => updateGuest(index, 'nationality', value)}
                          >
                            <SelectTrigger>
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
                          <Input
                            value={guest.nationality}
                            onChange={(e) => updateGuest(index, 'nationality', e.target.value)}
                            placeholder={uploadedDocuments.length === 0 ? "Uploadez d'abord votre document" : "Nationalité"}
                            disabled={uploadedDocuments.length === 0}
                          />
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>{t('guest.clients.documentType')} *</Label>
                        <Select
                          value={guest.documentType}
                          onValueChange={(value) => updateGuest(index, 'documentType', value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                        <SelectItem value="passport">{t('guest.clients.passport')}</SelectItem>
                        <SelectItem value="national_id">{t('guest.clients.nationalId')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>{t('guest.clients.documentNumber')} *</Label>
                        <Input
                          value={guest.documentNumber}
                          onChange={(e) => updateGuest(index, 'documentNumber', e.target.value)}
                          placeholder={t('guest.clients.documentNumberPlaceholder')}
                        />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={handlePrevStep}>
                  {t('guest.navigation.previous')}
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={isLoading}
                >
                  {isLoading ? 'Envoi en cours...' : t('guest.cta.sendInfo')}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
