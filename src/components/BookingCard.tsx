import { Calendar, Users, FileCheck, Download, Edit, Trash2, Clock, FileText, UserCheck } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Booking } from '@/types/booking';
import { UnifiedDocumentService } from '@/services/unifiedDocumentService';
import { ContractService } from '@/services/contractService';
import { BookingVerificationService } from '@/services/bookingVerificationService';
import { useBookings } from '@/hooks/useBookings';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

import { DocumentsViewer } from './DocumentsViewer';
import { TestDocumentUpload } from './TestDocumentUpload';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface BookingCardProps {
  booking: Booking;
  onEdit: (booking: Booking) => void;
  onDelete: (id: string) => void;
  onGenerateDocuments: (booking: Booking) => void;
}

export const BookingCard = ({ booking, onEdit, onDelete, onGenerateDocuments }: BookingCardProps) => {
  const { updateBooking } = useBookings();
  const { toast } = useToast();
  
  // Documents status check
  const hasPoliceForm = booking.documentsGenerated?.policeForm === true;
  const hasContract = booking.documentsGenerated?.contract === true;
  const { user } = useAuth();
  const [showDocuments, setShowDocuments] = useState<'id-documents' | 'contract' | 'police-form' | null>(null);
  const [signedContract, setSignedContract] = useState<any>(null);
  const [verificationCounts, setVerificationCounts] = useState({
    guestSubmissions: 0,
    uploadedDocuments: 0,
    hasSignature: false
  });

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

  const canGenerateDocuments = booking.guests.length > 0;

  // Load verification counts
  useEffect(() => {
    const loadVerificationCounts = async () => {
      try {
        const summary = await BookingVerificationService.getVerificationSummary(booking.id);
        if (summary) {
          setVerificationCounts({
            guestSubmissions: summary.guestSubmissionsCount,
            uploadedDocuments: summary.uploadedDocumentsCount,
            hasSignature: summary.hasSignature
          });
        }
      } catch (error) {
        console.error('❌ Error loading verification counts:', error);
      }
    };
    
    loadVerificationCounts();
  }, [booking.id]);

  const handleDownloadPolice = async () => {
    try {
      await UnifiedDocumentService.downloadPoliceFormsForAllGuests(booking);
      
      // Mark police forms as generated
      updateBooking(booking.id, {
        documentsGenerated: {
          ...booking.documentsGenerated,
          policeForm: true
        }
      });

      toast({
        title: "Fiches police générées",
        description: `${booking.guests.length} fiche(s) police téléchargée(s) et sauvegardée(s) (une par client)`,
      });
    } catch (error) {
      console.error('Error generating police forms:', error);
      toast({
        title: "Erreur",
        description: "Erreur lors de la génération des fiches police",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    const checkForSignedContract = async () => {
      if (!user?.id) return;
      
      try {
        const { data, error } = await supabase
          .from('contract_signatures')
          .select('booking_id')
          .eq('booking_id', booking.id);
        
        if (error) {
          console.error('Error fetching signed contracts:', error);
          return;
        }
        
        // Find signed contract for this booking
        const contract = data ? (data as any[]).find((c: any) => c.booking_id === booking.id) : null;
        setSignedContract(contract);
      } catch (error) {
        console.error('Error checking for signed contract:', error);
      }
    };
    
    checkForSignedContract();
  }, [booking.id, user?.id]);

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
        description: result.message,
      });
    } else {
      toast({
        title: "Erreur",
        description: result.message,
        variant: result.variant,
      });
    }
  };


  return (
    <Card className="rounded-2xl border shadow-[var(--shadow-soft)] hover:shadow-[var(--shadow-medium)] transition-all duration-300 group">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <h3 className="font-semibold text-foreground">{booking.guests?.[0]?.fullName || `Réservation #${booking.id.slice(-6)}`}</h3>
                {getStatusBadge()}
              </div>
          </div>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex space-x-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEdit(booking)}
              className="h-8 w-8"
            >
              <Edit className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(booking.id)}
              className="h-8 w-8 text-destructive hover:text-destructive"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <div>
              <p className="font-medium">Arrivée</p>
              <p className="text-muted-foreground">{formatDate(booking.checkInDate)}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <div>
              <p className="font-medium">Départ</p>
              <p className="text-muted-foreground">{formatDate(booking.checkOutDate)}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
          <div className="flex items-center space-x-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">{booking.numberOfGuests} client(s)</span>
          </div>
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{calculateNights()} nuit(s)</span>
          </div>
        </div>

        {booking.guests.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Clients enregistrés:</p>
            <div className="space-y-1">
              {booking.guests.map((guest, index) => (
                <div key={guest.id} className="text-sm text-muted-foreground bg-muted/50 px-2 py-1 rounded">
                  {guest.fullName} ({guest.nationality})
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <div className="flex items-center space-x-1">
            <FileCheck className={`w-3 h-3 flex-shrink-0 ${booking.documentsGenerated.policeForm ? 'text-success' : 'text-muted-foreground'}`} />
            <span className={`truncate ${booking.documentsGenerated.policeForm ? 'text-success' : 'text-muted-foreground'}`}>
              Fiches de police
            </span>
          </div>
          <div className="flex items-center space-x-1">
            <FileCheck className={`w-3 h-3 flex-shrink-0 ${verificationCounts.hasSignature ? 'text-success' : booking.documentsGenerated.contract ? 'text-warning' : 'text-muted-foreground'}`} />
            <span className={`truncate ${verificationCounts.hasSignature ? 'text-success' : booking.documentsGenerated.contract ? 'text-warning' : 'text-muted-foreground'}`}>
              {verificationCounts.hasSignature ? 'Contrat signé' : 'Contrat'}
            </span>
          </div>
        </div>

        {/* Verification Status */}
        {(verificationCounts.guestSubmissions > 0 || verificationCounts.uploadedDocuments > 0) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="flex items-center space-x-1">
              <UserCheck className={`w-3 h-3 flex-shrink-0 ${verificationCounts.guestSubmissions > 0 ? 'text-success' : 'text-muted-foreground'}`} />
              <span className={`truncate ${verificationCounts.guestSubmissions > 0 ? 'text-success' : 'text-muted-foreground'}`}>
                Soumissions: {verificationCounts.guestSubmissions}
              </span>
            </div>
            <div className="flex items-center space-x-1">
              <FileText className={`w-3 h-3 flex-shrink-0 ${verificationCounts.uploadedDocuments > 0 ? 'text-success' : 'text-muted-foreground'}`} />
              <span className={`truncate ${verificationCounts.uploadedDocuments > 0 ? 'text-success' : 'text-muted-foreground'}`}>
                Documents: {verificationCounts.uploadedDocuments}
              </span>
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-3">
        <div className="w-full space-y-2">
          {/* ALWAYS show document buttons - contracts can be generated even without guests */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  console.log('🚨 Generating police forms for booking:', booking.id);
                  
                  // ✅ CORRECTION: Validation avant génération
                  if (!booking.guests || booking.guests.length === 0) {
                    toast({
                      title: "Impossible de générer",
                      description: "Aucun invité trouvé pour cette réservation",
                      variant: "destructive"
                    });
                    return;
                  }

                  console.log('🔍 AVANT APPEL generate-documents:', {
                    bookingId: booking.id,
                    documentType: 'police',
                    supabaseUrl: supabase.supabaseUrl,
                    timestamp: new Date().toISOString()
                  });

                  const { data, error } = await supabase.functions.invoke('generate-documents', {
                    body: { bookingId: booking.id, documentType: 'police' }
                  });

                  console.log('🔍 APRÈS APPEL generate-documents:', {
                    data,
                    error,
                    hasData: !!data,
                    hasError: !!error,
                    errorDetails: error ? JSON.stringify(error) : null
                  });

                  if (error) {
                    console.error('❌ Police generation error:', error);
                    throw new Error(error.message || 'Erreur lors de la génération');
                  }

                  // ✅ CORRECTION: Mise à jour sécurisée du statut
                  await updateBooking(booking.id, {
                    documentsGenerated: {
                      ...booking.documentsGenerated,
                      policeForm: true,
                    },
                  });

                  toast({
                    title: "Fiches de police générées",
                    description: `${booking.guests.length} fiche(s) de police générée(s) avec succès`,
                  });

                  setShowDocuments('police-form');
                } catch (error: any) {
                  console.error('❌ Error generating police forms:', error);
                  toast({
                    title: "Erreur de génération",
                    description: error.message || "Impossible de générer les fiches de police",
                    variant: "destructive"
                  });
                }
              }}
              disabled={!canGenerateDocuments}
              className="text-xs"
            >
              <Download className="w-3 h-3 sm:mr-1" />
              <span className="hidden sm:inline">Police</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  console.log('📄 Generating contract for booking:', booking.id);
                  
                  const { data, error } = await supabase.functions.invoke('generate-documents', {
                    body: { bookingId: booking.id, documentType: 'contract' }
                  });

                  if (error) {
                    console.error('❌ Contract generation error:', error);
                    throw new Error(error.message || 'Erreur lors de la génération du contrat');
                  }

                  // ✅ CORRECTION: Mise à jour sécurisée du statut
                  await updateBooking(booking.id, {
                    documentsGenerated: {
                      ...booking.documentsGenerated,
                      contract: true,
                    },
                  });

                  toast({
                    title: "Contrat généré",
                    description: "Le contrat a été généré avec succès",
                  });

                  setShowDocuments('contract');
                } catch (error: any) {
                  console.error('❌ Error generating contract:', error);
                  toast({
                    title: "Erreur de génération",
                    description: error.message || "Impossible de générer le contrat",
                    variant: "destructive"
                  });
                }
              }}
              className="text-xs"
            >
              <Download className="w-3 h-3 sm:mr-1" />
              <span className="hidden sm:inline">Contrat</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDocuments('id-documents')}
              className="text-xs col-span-2 sm:col-span-1 relative"
            >
              <FileText className="w-3 h-3 sm:mr-1" />
              <span className="hidden sm:inline">ID Docs</span>
              {(verificationCounts.guestSubmissions > 0 || verificationCounts.uploadedDocuments > 0) && (
                <Badge variant="secondary" className="ml-1 h-4 text-xs px-1">
                  {verificationCounts.guestSubmissions + verificationCounts.uploadedDocuments}
                </Badge>
              )}
            </Button>
          </div>
          
          {/* Show add guests button only if no guests */}
          {!canGenerateDocuments && (
            <Button
              variant="professional"
              size="sm"
              onClick={() => onGenerateDocuments(booking)}
              className="w-full"
            >
              Ajouter les clients
            </Button>
          )}
          
          {/* Guest self-service link generation */}
        </div>
        
        {showDocuments && (
          <DocumentsViewer
            booking={booking}
            documentType={showDocuments}
            onClose={() => setShowDocuments(null)}
          />
        )}
      </CardFooter>
    </Card>
  );
};
