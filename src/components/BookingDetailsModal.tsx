import { useState, useEffect } from 'react';
import { Calendar, Users, FileCheck, Download, Edit, Link, X, Shield, FileText, Trash2, Pen } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Booking } from '@/types/booking';
import { EnrichedBooking } from '@/services/guestSubmissionService';
import { UnifiedDocumentService } from '@/services/unifiedDocumentService';
import { ContractService } from '@/services/contractService';
import { useBookings } from '@/hooks/useBookings';
import { useToast } from '@/hooks/use-toast';
import { useGuestVerification } from '@/hooks/useGuestVerification';
import { DocumentsViewer } from './DocumentsViewer';
import { HostSignatureCapture } from './HostSignatureCapture';
import { ContractDebugPanel } from './ContractDebugPanel';
import { supabase } from '@/integrations/supabase/client';
import { copyToClipboard } from '@/lib/clipboardUtils';
import { ApiService } from '@/services/apiService';

interface BookingDetailsModalProps {
  booking: EnrichedBooking;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (booking: Booking) => void;
}

export const BookingDetailsModal = ({
  booking,
  isOpen,
  onClose,
  onEdit
}: BookingDetailsModalProps) => {
  const {
    updateBooking,
    deleteBooking
  } = useBookings();
  const {
    toast
  } = useToast();
  const {
    generatePropertyVerificationUrl,
    isLoading: isGeneratingLink
  } = useGuestVerification();
  const [showDocuments, setShowDocuments] = useState<'id-documents' | 'contract' | 'police-form' | null>(null);
  const [showHostSignature, setShowHostSignature] = useState(false);
  const [isSubmittingHostSignature, setIsSubmittingHostSignature] = useState(false);
  const [showDebugPanel, setShowDebugPanel] = useState(false);

  // Enhanced fallback: fetch guest name from multiple sources
  const [fallbackGuestName, setFallbackGuestName] = useState<string | null>(null);
  useEffect(() => {
    if (!isOpen) return;
    
    console.log('📋 BookingDetailsModal opened for booking:', {
      id: booking.id,
      hasGuests: booking.guests?.length > 0,
      guestsCount: booking.guests?.length || 0,
      submissionId: booking.submissionId,
      bookingReference: booking.bookingReference
    });
    
    if (booking.guests && booking.guests.length > 0) {
      console.log('✅ Booking has guests:', booking.guests);
      setFallbackGuestName(null);
      return;
    }
    
    // Try to get guest name from multiple sources
    (async () => {
      try {
        console.log('🔍 Trying to fetch guest data from fallback sources...');
        
        // 1. First try to get from guest submissions using submission_id
        if (booking.submissionId) {
          console.log('📝 Trying guest submissions with submissionId:', booking.submissionId);
          const { data: submissionData } = await supabase
            .from('guest_submissions')
            .select('guest_data')
            .eq('id', booking.submissionId)
            .maybeSingle();
          
          if (submissionData?.guest_data) {
            const guestData = Array.isArray(submissionData.guest_data) 
              ? submissionData.guest_data[0] 
              : submissionData.guest_data;
            
            if (typeof guestData === 'object' && guestData !== null) {
              const gd = guestData as any;
              if (gd.fullName || gd.full_name) {
                setFallbackGuestName(gd.fullName || gd.full_name);
                return;
              }
            }
          }
        }
        
        // 2. Try to get from contract signatures
        const { data } = await supabase
          .from('contract_signatures')
          .select('contract_content, signer_name')
          .eq('booking_id', booking.id)
          .order('signed_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (data) {
          // Use signer_name if available
          if (data.signer_name) {
            setFallbackGuestName(data.signer_name);
            return;
          }
          
          // Fallback to extracting from contract content
          const content = data.contract_content as string;
          if (content) {
            const match = content.match(/LOCATAIRE:\s*([^\n]+)/);
            if (match?.[1]) {
              setFallbackGuestName(match[1].trim());
              return;
            }
          }
        }
        
        // 3. If no other source, use booking reference as fallback
        if (booking.bookingReference) {
          setFallbackGuestName(booking.bookingReference);
        }
      } catch (e) {
        console.warn('Fallback guest name lookup failed', e);
        // Last fallback: use booking reference if available
        if (booking.bookingReference) {
          setFallbackGuestName(booking.bookingReference);
        }
      }
    })();
  }, [isOpen, booking.id, booking.guests?.length, booking.bookingReference, booking.submissionId]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const calculateNights = () => {
    const checkIn = new Date(booking.checkInDate);
    const checkOut = new Date(booking.checkOutDate);
    return Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
  };

  const getStatusBadge = () => {
    switch (booking.status) {
      case 'completed':
        return <Badge variant="default" className="bg-success text-success-foreground">Terminé</Badge>;
      case 'pending':
        return <Badge variant="secondary">En attente</Badge>;
      case 'archived':
        return <Badge variant="outline">Archivé</Badge>;
      default:
        return <Badge variant="secondary">En attente</Badge>;
    }
  };

  const handleGeneratePolice = async () => {
    try {
      console.log('👮 Generating police forms for booking:', booking.id);
      // ✅ CORRECTION : Utiliser submit-guest-info-unified au lieu de generate-police-forms
      const {
        data,
        error
      } = await supabase.functions.invoke('submit-guest-info-unified', {
        body: {
          bookingId: booking.id,
          action: 'generate_police_only'
        }
      });
      console.log('👮 Police generation response:', {
        data,
        error
      });
      if (error) {
        console.error('❌ Police generation error:', error);
        throw error;
      }
      if (data?.success && data?.policeUrl) {
        // ✅ CORRECTION : La nouvelle Edge Function retourne policeUrl (singulier)
        console.log('👮 Police form generated successfully:', data.policeUrl);
        
        // Pas besoin de re-uploader, l'URL est déjà publique
        console.log('✅ Police form ready for display');
        updateBooking(booking.id, {
          documentsGenerated: {
            ...booking.documentsGenerated,
            policeForm: true
          }
        });
        toast({
          title: "Fiche de police générée",
          description: "Fiche de police générée avec succès"
        });
      } else {
        throw new Error('Failed to generate police forms');
      }
    } catch (error) {
      console.error('❌ Error generating police forms:', error);
      toast({
        title: "Erreur",
        description: "Erreur lors de la génération des fiches police",
        variant: "destructive"
      });
    }
  };

  const handleDownloadPolice = async () => {
    try {
      await UnifiedDocumentService.downloadPoliceFormsForAllGuests(booking);
      updateBooking(booking.id, {
        documentsGenerated: {
          ...booking.documentsGenerated,
          policeForm: true
        }
      });
      toast({
        title: "Fiches police générées",
        description: `${booking.guests.length} fiche(s) police téléchargée(s) et sauvegardée(s)`
      });
    } catch (error) {
      console.error('Error generating police forms:', error);
      toast({
        title: "Erreur",
        description: "Erreur lors de la génération des fiches police",
        variant: "destructive"
      });
    }
  };

  const handleHostSignatureComplete = async (signatureData: string) => {
    try {
      setIsSubmittingHostSignature(true);
      console.log('🖊️ Submitting host signature for booking:', booking.id);

      const hostName = booking.property?.contact_info?.name || 'Host';
      const signedAt = new Date().toISOString();

      await ApiService.saveHostSignature({
        bookingId: booking.id,
        hostSignatureDataUrl: signatureData,
        hostSignerName: hostName,
        signedAt: signedAt
      });

      toast({
        title: "Signature enregistrée",
        description: "Votre signature a été enregistrée avec succès",
      });

      setShowHostSignature(false);
      
      // Refresh the booking data to show updated contract
      onEdit?.();
    } catch (error) {
      console.error('❌ Error submitting host signature:', error);
      toast({
        title: "Erreur",
        description: "Erreur lors de l'enregistrement de la signature",
        variant: "destructive"
      });
    } finally {
      setIsSubmittingHostSignature(false);
    }
  };

  const handleGenerateContract = async () => {
    try {
      console.log('📄 Generating contract for booking:', booking.id);

      // Check if there is a signed contract for this booking to include the guest signature
      const {
        data: signatures,
        error: sigError
      } = await supabase.from('contract_signatures').select('signature_data,signed_at').eq('booking_id', booking.id).limit(1);
      if (sigError) {
        console.warn('⚠️ Unable to check contract signatures:', sigError);
      }
      const signed = signatures && signatures.length > 0 ? signatures[0] : null;

      console.log('🔍 Contract generation request for booking:', booking.id);

      const {
        data,
        error
      } = await supabase.functions.invoke('submit-guest-info-unified', {
        body: {
          bookingId: booking.id,
          action: 'generate_contract_only',
          signature: signed?.signature_data ? {
            data: signed.signature_data,
            timestamp: signed.signed_at
          } : null
        }
      });

      console.log('📄 Contract generation response:', {
        data,
        error
      });

      if (error) {
        console.error('❌ Contract generation error:', error);
        throw error;
      }
      
      // ✅ CORRECTION : Vérifier la réponse correctement selon la structure backend
      if (data?.success && (data?.contractUrl || data?.documentUrls?.length > 0)) {
        // ✅ CORRECTION : Le contrat est déjà généré et stocké, pas besoin de re-uploader
        const contractUrl = data.contractUrl || data.documentUrls[0];
        console.log('✅ Contract already generated and stored:', contractUrl);
        
        // Mettre à jour l'état local seulement
        updateBooking(booking.id, {
          documentsGenerated: {
            ...booking.documentsGenerated,
            contract: true
          }
        });
        
        toast({
          title: signed ? 'Contrat signé généré' : 'Contrat généré',
          description: signed ? 'Le contrat signé a été généré et sauvegardé' : 'Le contrat a été généré avec succès'
        });
      } else {
        console.error('❌ Contract generation failed:', { data, error });
        throw new Error(`Contract generation failed: ${data?.error || error?.message || 'No success response'}`);
      }
    } catch (error) {
      console.error('❌ Error generating contract:', error);
      toast({
        title: 'Erreur',
        description: 'Erreur lors de la génération du contrat',
        variant: 'destructive'
      });
    }
  };

  const handleDownloadContract = async () => {
    const result = await ContractService.generateAndDownloadContract(booking);
    if (result.success) {
      // Mark contract as generated if it's a new contract
      const signedContract = await ContractService.getSignedContract(booking.id);
      if (!signedContract) {
        updateBooking(booking.id, {
          documentsGenerated: {
            ...booking.documentsGenerated,
            contract: true
          }
        });
      }
      toast({
        title: result.success && !signedContract ? "Contrat généré" : "Contrat signé téléchargé",
        description: result.message
      });
    } else {
      toast({
        title: "Erreur",
        description: result.message,
        variant: result.variant
      });
    }
  };

  const handleGenerateGuestLink = async () => {
    if (!booking.propertyId) {
      toast({
        title: "Erreur",
        description: "Aucune propriété associée à cette réservation",
        variant: "destructive"
      });
      return;
    }
    
    // Pass the booking ID to the verification URL generation
    const url = await generatePropertyVerificationUrl(booking.propertyId, booking.id);
    if (url) {
      const success = await copyToClipboard(url);
      if (success) {
        toast({
          title: "Lien généré et copié",
          description: "Lien de vérification copié dans le presse-papiers"
        });
      } else {
        toast({
          title: "Lien généré",
          description: `URL: ${url}`
        });
      }
    }
  };

  const confirmDeleteBookingAction = async () => {
    try {
      await deleteBooking(booking.id);
      toast({
        title: 'Réservation supprimée',
        description: 'La réservation a été supprimée avec succès.'
      });
      // Notify app to refresh lists/calendars immediately
      window.dispatchEvent(new CustomEvent('booking-deleted', {
        detail: {
          id: booking.id
        }
      }));
      onClose();
    } catch (error) {
      console.error('Error deleting booking:', error);
      toast({
        title: 'Erreur',
        description: "Impossible de supprimer la réservation.",
        variant: 'destructive'
      });
    }
  };

  return <>
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              {booking.realGuestNames.length > 0 
                ? booking.realGuestNames.join(', ')
                : booking.guests?.[0]?.fullName || fallbackGuestName || booking.bookingReference || `Réservation #${booking.id.slice(-6)}`}
              {getStatusBadge()}
            </DialogTitle>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center space-x-3">
              <Calendar className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Arrivée</p>
                <p className="text-muted-foreground">{formatDate(booking.checkInDate)}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Calendar className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Départ</p>
                <p className="text-muted-foreground">{formatDate(booking.checkOutDate)}</p>
              </div>
            </div>
          </div>

          {/* Guests Info */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Users className="w-5 h-5 text-muted-foreground" />
              <span className="font-medium">
                {booking.hasRealSubmissions 
                  ? `${booking.realGuestCount} client(s) enregistré(s) / ${booking.numberOfGuests} total`
                  : `${booking.numberOfGuests} client(s)`}
              </span>
            </div>
            <span className="text-muted-foreground">{calculateNights()} nuit(s)</span>
          </div>

          {/* Registered Guests */}
          {booking.guests.length > 0 && <div className="space-y-3">
              <p className="font-medium">Clients enregistrés:</p>
              <div className="space-y-2">
                {booking.guests.map((guest, index) => <div key={guest.id} className="bg-muted/50 px-3 py-2 rounded-md">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{guest.fullName}</p>
                        <p className="text-sm text-muted-foreground">
                          {guest.nationality} • {guest.documentType === 'passport' ? 'Passeport' : 'CNI'}: {guest.documentNumber}
                        </p>
                        {guest.placeOfBirth && <p className="text-sm text-muted-foreground">
                            Né(e) à: {guest.placeOfBirth}
                          </p>}
                      </div>
                    </div>
                  </div>)}
              </div>
            </div>}

          {/* Documents Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center space-x-2">
              <FileCheck className={`w-4 h-4 ${booking.documentsGenerated.policeForm || booking.submissionStatus.hasDocuments ? 'text-success' : 'text-muted-foreground'}`} />
              <span className={booking.documentsGenerated.policeForm || booking.submissionStatus.hasDocuments ? 'text-success' : 'text-muted-foreground'}>
                Fiches de police {booking.submissionStatus.hasDocuments && !booking.documentsGenerated.policeForm ? '(docs soumis)' : ''}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <FileCheck className={`w-4 h-4 ${booking.documentsGenerated.contract || booking.submissionStatus.hasSignature ? 'text-success' : 'text-muted-foreground'}`} />
              <span className={booking.documentsGenerated.contract || booking.submissionStatus.hasSignature ? 'text-success' : 'text-muted-foreground'}>
                Contrat {booking.submissionStatus.hasSignature && !booking.documentsGenerated.contract ? '(signé)' : ''}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => {
                onEdit(booking);
                onClose();
              }} className="flex-1">
                <Edit className="w-4 h-4 mr-2" />
                Modifier
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="flex-1">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Supprimer
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Êtes-vous sûr ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Voulez-vous vraiment supprimer cette réservation ? Cette action est irréversible.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="rounded-md border bg-destructive/10 p-4">
                    <p className="font-semibold">⚠️ ATTENTION : Cette action supprimera définitivement :</p>
                    <ul className="mt-2 list-disc pl-5 space-y-1 text-sm">
                      <li>La réservation et toutes ses informations</li>
                      <li>Toutes les fiches clients et leurs documents</li>
                      <li>Les contrats signés et formulaires de police associés</li>
                    </ul>
                    <p className="mt-2 font-medium">Cette action ne peut pas être annulée !</p>
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={confirmDeleteBookingAction} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Supprimer
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
            
            {(booking.guests.length > 0 || booking.hasRealSubmissions) && <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" onClick={async () => {
                await handleGeneratePolice();
                setShowDocuments('police-form');
              }}>
                  <Shield className="w-4 h-4 mr-1" />
                  Police
                </Button>
                <Button variant="outline" size="sm" onClick={async () => {
                await handleGenerateContract();
                setShowDocuments('contract');
              }}>
                  <FileText className="w-4 h-4 mr-1" />
                  Contrat
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowHostSignature(true)}>
                  <Pen className="w-4 h-4 mr-1" />
                  Signature Hôte
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowDocuments('id-documents')}>
                  <FileCheck className="w-4 h-4 mr-1" />
                  Pièces ID
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowDocuments('id-cards')}>
                  <Users className="w-4 h-4 mr-1" />
                  Fiches ID
                </Button>
              </div>}
            
            
          </div>
        </div>

        {/* Documents Viewer */}
        {showDocuments && <DocumentsViewer booking={booking} documentType={showDocuments} onClose={() => setShowDocuments(null)} />}
      </DialogContent>
    </Dialog>

    {/* Host Signature Modal */}
    {showHostSignature && (
      <Dialog open={showHostSignature} onOpenChange={setShowHostSignature}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Signature de l'hôte</DialogTitle>
            <DialogDescription>
              Signez le contrat pour cette réservation. Votre signature sera intégrée au document final.
            </DialogDescription>
          </DialogHeader>
          <HostSignatureCapture
            onSignatureComplete={handleHostSignatureComplete}
            onCancel={() => setShowHostSignature(false)}
            hostName={booking.property?.contact_info?.name || 'Host'}
          />
        </DialogContent>
      </Dialog>
    )}

    {/* Debug Panel */}
    <ContractDebugPanel 
      bookingId={booking.id}
      isVisible={showDebugPanel}
      onToggle={setShowDebugPanel}
    />

  </>;
};
