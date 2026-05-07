import {
  Calendar,
  Users,
  Download,
  Edit,
  Trash2,
  Clock,
  FileText,
  AlertTriangle,
  GripVertical,
  ArrowRight,
  MoreHorizontal,
  File,
  Archive,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Booking } from '@/types/booking';
import { UnifiedDocumentService } from '@/services/unifiedDocumentService';
import { ContractService } from '@/services/contractService';
import { BookingVerificationService } from '@/services/bookingVerificationService';
import { useBookings } from '@/hooks/useBookings';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { DocumentsViewer } from './DocumentsViewer';
import { useState, useEffect, memo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getBookingDisplayTitle, isAirbnbCode } from '@/utils/bookingDisplay';
import { useT } from '@/i18n/GuestLocaleProvider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface BookingCardProps {
  booking: Booking;
  onEdit: (booking: Booking) => void;
  onDelete: (id: string) => void;
  onGenerateDocuments: (booking: Booking) => void;
}

const TEAL = '#55BA9F';

export const BookingCard = memo(({ booking, onEdit, onDelete, onGenerateDocuments }: BookingCardProps) => {
  const { updateBooking } = useBookings();
  const { toast } = useToast();
  const { isOverLimit } = useSubscription();
  const t = useT();
  const { user } = useAuth();

  const hasPoliceForm = booking.documentsGenerated?.policeForm === true;
  const hasContract = booking.documentsGenerated?.contract === true;
  const [showDocuments, setShowDocuments] = useState<'id-documents' | 'contract' | 'police-form' | null>(null);
  const [verificationCounts, setVerificationCounts] = useState({
    guestSubmissions: 0,
    uploadedDocuments: 0,
    hasSignature: false,
  });
  const [hasAnyDocuments, setHasAnyDocuments] = useState(false);
  const [signerName, setSignerName] = useState<string | null>(null);

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

  const calculateNights = () => {
    const checkIn = new Date(booking.checkInDate);
    const checkOut = new Date(booking.checkOutDate);
    return Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
  };

  const nights = calculateNights();
  const isCompletedWithoutDocuments = booking.status === 'completed' && !hasAnyDocuments;
  const totalDocs = verificationCounts.guestSubmissions + verificationCounts.uploadedDocuments;

  useEffect(() => {
    const load = async () => {
      try {
        const summary = await BookingVerificationService.getVerificationSummary(booking.id);
        if (summary) {
          setVerificationCounts({
            guestSubmissions: summary.guestSubmissionsCount,
            uploadedDocuments: summary.uploadedDocumentsCount,
            hasSignature: summary.hasSignature,
          });
        }

        const [uploadedRes, generatedRes] = await Promise.allSettled([
          supabase
            .from('uploaded_documents')
            .select('id')
            .eq('booking_id', booking.id)
            .in('document_type', ['contract', 'police', 'identity']),
          supabase
            .from('generated_documents')
            .select('id')
            .eq('booking_id', booking.id)
            .in('document_type', ['contract', 'police', 'identity'])
            .then((r) => r)
            .catch(() => ({ data: [], error: null })),
        ]);

        const uploaded =
          uploadedRes.status === 'fulfilled' && !uploadedRes.value.error ? uploadedRes.value.data || [] : [];
        const generated =
          generatedRes.status === 'fulfilled' && !generatedRes.value.error ? generatedRes.value.data || [] : [];

        const hasDocsGenerated =
          booking.documentsGenerated &&
          (booking.documentsGenerated.contract === true ||
            booking.documentsGenerated.policeForm === true ||
            booking.documentsGenerated.police === true ||
            (booking.documentsGenerated as any)?.contractUrl ||
            (booking.documentsGenerated as any)?.policeUrl);

        setHasAnyDocuments(
          hasDocsGenerated ||
            uploaded.length > 0 ||
            generated.length > 0 ||
            (summary?.guestSubmissionsCount ?? 0) > 0 ||
            (summary?.uploadedDocumentsCount ?? 0) > 0,
        );

        const gn = booking.guest_name?.trim() || '';
        const needsName =
          !gn ||
          ['guest', 'réservation', 'reservation'].includes(gn.toLowerCase()) ||
          isAirbnbCode(gn);
        if (needsName) {
          const { data: sig } = await supabase
            .from('contract_signatures')
            .select('signer_name')
            .eq('booking_id', booking.id)
            .not('signer_name', 'is', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (sig?.signer_name) setSignerName(sig.signer_name);
        }
      } catch {}
    };
    load();
  }, [booking.id, booking.documentsGenerated, booking.guest_name]);

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from('contract_signatures')
      .select('booking_id')
      .eq('booking_id', booking.id)
      .then(({ data }) => {
        /* just pre-fetching */
      });
  }, [booking.id, user?.id]);

  const handleDownloadPolice = async () => {
    try {
      await UnifiedDocumentService.downloadPoliceFormsForAllGuests(booking);
      updateBooking(booking.id, {
        documentsGenerated: { ...booking.documentsGenerated, policeForm: true },
      });
      toast({ title: 'Fiches police générées', description: `${booking.guests.length} fiche(s) téléchargée(s)` });
    } catch {
      toast({ title: 'Erreur', description: 'Erreur lors de la génération', variant: 'destructive' });
    }
  };

  const handleDownloadContract = async () => {
    const result = await ContractService.generateAndDownloadContract(booking);
    if (result.success) {
      const sc = await ContractService.getSignedContract(booking.id);
      if (!sc) {
        updateBooking(booking.id, {
          documentsGenerated: { ...booking.documentsGenerated, contract: true },
        });
      }
      toast({ title: sc ? 'Contrat signé téléchargé' : 'Contrat généré', description: result.message });
    } else {
      toast({ title: 'Erreur', description: result.message, variant: result.variant });
    }
  };

  const title = getBookingDisplayTitle(booking, { signerNameFallback: signerName });

  // Guest subtitle (e.g. "VIACHESLAV V. KLYUCHE...")
  const guestSubtitle = (() => {
    if (booking.guests.length > 0) {
      const first = booking.guests[0].fullName?.toUpperCase() || '';
      return first.length > 22 ? first.slice(0, 22) + '...' : first;
    }
    return null;
  })();

  return (
    <>
      <div
        className={`bg-white rounded-2xl border flex items-center gap-0 overflow-hidden transition-shadow duration-200 hover:shadow-md ${
          isCompletedWithoutDocuments ? 'border-red-400 border-2' : 'border-gray-200'
        }`}
      >
        {/* ── Drag handle ── */}
        <div className="hidden md:flex items-center justify-center px-3 self-stretch text-gray-300 cursor-grab hover:text-gray-400 border-r border-gray-100">
          <GripVertical className="w-4 h-4" />
        </div>

        {/* ── Main content ── */}
        <div className="flex flex-col md:flex-row md:items-center flex-1 gap-4 px-4 py-4">

          {/* 1. Name + subtitle + badge */}
          <div className="flex-shrink-0 md:w-48">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-[15px] text-gray-900 leading-tight">{title}</span>
              {isCompletedWithoutDocuments && (
                <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
              )}
            </div>
            {guestSubtitle && (
              <p className="text-[11px] text-gray-400 mt-0.5 font-medium tracking-wide truncate">{guestSubtitle}</p>
            )}
            {!guestSubtitle && (
              <p className="text-[11px] text-gray-400 mt-0.5">
                — {booking.numberOfGuests} {t('card.client')}{booking.numberOfGuests > 1 ? 's' : ''}
              </p>
            )}
          </div>

          {/* 2. Dates + duration + clients */}
          <div className="flex flex-wrap items-center gap-5 flex-1">
            {/* ARRIVÉE */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: TEAL }}>
                {t('card.arrival')}
              </p>
              <div className="flex items-center gap-1.5 mt-1">
                <Calendar className="w-3.5 h-3.5 flex-shrink-0" style={{ color: TEAL }} />
                <span className="font-semibold text-sm text-gray-900">{formatDate(booking.checkInDate)}</span>
              </div>
            </div>

            <ArrowRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />

            {/* DÉPART */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: TEAL }}>
                {t('card.departure')}
              </p>
              <div className="flex items-center gap-1.5 mt-1">
                <Calendar className="w-3.5 h-3.5 flex-shrink-0" style={{ color: TEAL }} />
                <span className="font-semibold text-sm text-gray-900">{formatDate(booking.checkOutDate)}</span>
              </div>
            </div>

            {/* DURÉE */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: TEAL }}>
                {t('card.duration')}
              </p>
              <div className="flex items-center gap-1.5 mt-1">
                <Clock className="w-3.5 h-3.5 flex-shrink-0" style={{ color: TEAL }} />
                <span className="text-sm text-gray-700">
                  {nights} {nights > 1 ? t('card.nights') : t('card.night')}
                </span>
              </div>
            </div>

            {/* CLIENTS */}
            {booking.guests.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: TEAL }}>
                  {t('card.clients')}
                </p>
                <div className="flex items-center gap-1.5 mt-1">
                  <Users className="w-3.5 h-3.5 flex-shrink-0" style={{ color: TEAL }} />
                  <span className="text-sm text-gray-700">
                    {booking.guests.length < booking.numberOfGuests
                      ? `${booking.guests.length} / ${booking.numberOfGuests}`
                      : `${booking.guests.length} ${t('card.client')}${booking.guests.length > 1 ? 's' : ''}`}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 3. Documents — single row, left-aligned */}
          <div className="flex-shrink-0 flex items-center gap-4">
            {/* Police */}
            <button
              onClick={() => setShowDocuments('police-form')}
              className="flex items-center gap-1.5 text-[12px] font-medium hover:opacity-80 transition-opacity whitespace-nowrap"
            >
              {hasPoliceForm ? (
                <Download className="w-3.5 h-3.5 flex-shrink-0" style={{ color: TEAL }} />
              ) : (
                <File className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
              )}
              <span className={hasPoliceForm ? 'text-gray-700' : 'text-gray-400'}>
                {t('card.policeForm')}
              </span>
            </button>

            {/* Contrat */}
            <button
              onClick={() => setShowDocuments('contract')}
              className="flex items-center gap-1.5 text-[12px] font-medium hover:opacity-80 transition-opacity whitespace-nowrap"
            >
              {hasContract || verificationCounts.hasSignature ? (
                <Download className="w-3.5 h-3.5 flex-shrink-0" style={{ color: TEAL }} />
              ) : (
                <File className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
              )}
              <span className={hasContract || verificationCounts.hasSignature ? 'text-gray-700' : 'text-gray-400'}>
                {verificationCounts.hasSignature ? t('card.signedContract') : t('card.contract')}
              </span>
            </button>

            {/* ID Docs */}
            <button
              onClick={() => setShowDocuments('id-documents')}
              className="flex items-center gap-1.5 text-[12px] font-medium hover:opacity-80 transition-opacity whitespace-nowrap"
            >
              <FileText className={`w-3.5 h-3.5 flex-shrink-0 ${totalDocs > 0 ? '' : 'text-gray-400'}`}
                style={totalDocs > 0 ? { color: TEAL } : undefined}
              />
              <span className={totalDocs > 0 ? 'text-gray-700' : 'text-gray-400'}>
                {t('card.idDocs')}
              </span>
              {totalDocs > 0 && (
                <span
                  className="ml-0.5 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none flex-shrink-0"
                  style={{ backgroundColor: TEAL }}
                >
                  {totalDocs}
                </span>
              )}
            </button>
          </div>

          {/* 4. Action button */}
          <div className="flex-shrink-0">
            <button
              onClick={() => onEdit(booking)}
              className="flex items-center gap-1.5 text-gray-700 text-[13px] font-semibold px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition-colors whitespace-nowrap"
            >
              <FileText className="w-4 h-4 text-gray-500" />
              {t('card.details')}
            </button>
          </div>
        </div>

        {/* ── Three-dot menu ── */}
        <div className="flex-shrink-0 pr-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(booking)}>
                <Edit className="w-4 h-4 mr-2" />
                Modifier
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  updateBooking(booking.id, { status: 'archived' });
                  toast({ title: 'Réservation archivée', description: 'La réservation a été déplacée dans les archives.' });
                }}
              >
                <Archive className="w-4 h-4 mr-2" />
                Archiver
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => onDelete(booking.id)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {showDocuments && (
        <DocumentsViewer
          booking={booking}
          documentType={showDocuments}
          onClose={() => setShowDocuments(null)}
          isOverLimit={isOverLimit}
        />
      )}
    </>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.booking.id === nextProps.booking.id &&
    prevProps.booking.status === nextProps.booking.status &&
    prevProps.booking.documents_generated === nextProps.booking.documents_generated &&
    prevProps.booking.updated_at === nextProps.booking.updated_at
  );
});

BookingCard.displayName = 'BookingCard';
