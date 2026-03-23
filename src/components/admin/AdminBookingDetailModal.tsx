import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Shield, Image, ExternalLink, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Document {
  id: string;
  document_type: string;
  document_url: string | null;
  file_path: string | null;
  guests?: { full_name?: string; document_number?: string } | null;
}

interface AdminBookingDetailModalProps {
  bookingId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking?: {
    id: string;
    booking_reference?: string;
    check_in_date?: string;
    check_out_date?: string;
    guest_name?: string;
    guest_email?: string;
    properties?: { name: string };
  };
}

export const AdminBookingDetailModal: React.FC<AdminBookingDetailModalProps> = ({
  bookingId,
  open,
  onOpenChange,
  booking,
}) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !bookingId) return;
    setLoading(true);
    supabase
      .from('uploaded_documents')
      .select('id, document_type, document_url, file_path, guests(full_name, document_number)')
      .eq('booking_id', bookingId)
      .then(({ data, error }) => {
        setLoading(false);
        if (error) {
          console.error('Erreur chargement documents admin:', error);
          setDocuments([]);
          return;
        }
        const relevant = (data || []).filter((d) =>
          ['contract', 'police', 'identity', 'identity_upload', 'id-document', 'passport'].includes(d.document_type || '')
        );
        setDocuments(relevant);
      });
  }, [open, bookingId]);

  const identityDocs = documents.filter((d) =>
    ['identity', 'identity_upload', 'id-document', 'passport'].includes(d.document_type)
  );
  const contractDoc = documents.find((d) => d.document_type === 'contract');
  const policeDoc = documents.find((d) => d.document_type === 'police');

  const getDocLabel = (doc: Document) => {
    switch (doc.document_type) {
      case 'contract':
        return 'Contrat';
      case 'police':
        return 'Fiche de police';
      case 'identity':
      case 'identity_upload':
      case 'id-document':
      case 'passport':
        return 'Pièce d\'identité';
      default:
        return doc.document_type;
    }
  };

  const getDocUrl = (doc: Document): string | null => {
    if (doc.document_url && (doc.document_url.startsWith('http') || doc.document_url.startsWith('data:'))) {
      return doc.document_url;
    }
    if (doc.file_path) {
      const { data } = supabase.storage.from('guest-documents').getPublicUrl(doc.file_path);
      return data?.publicUrl || null;
    }
    return null;
  };

  if (!booking) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Réservation {booking.booking_reference || booking.id.slice(0, 8)}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-6 text-sm">
            <div>
              <p className="font-medium text-gray-500">ID Réservation</p>
              <p className="font-mono text-xs break-all">{booking.id}</p>
            </div>
            <div>
              <p className="font-medium text-gray-500">Propriété</p>
              <p>{booking.properties?.name || '—'}</p>
            </div>
            <div>
              <p className="font-medium text-gray-500">Client</p>
              <p>{booking.guest_name || '—'}</p>
              {booking.guest_email && (
                <p className="text-sm text-muted-foreground">{booking.guest_email}</p>
              )}
            </div>
            <div>
              <p className="font-medium text-gray-500">Dates</p>
              <p>
                {booking.check_in_date ? new Date(booking.check_in_date).toLocaleDateString('fr-FR') : '—'} →{' '}
                {booking.check_out_date ? new Date(booking.check_out_date).toLocaleDateString('fr-FR') : '—'}
              </p>
            </div>
          </div>

          <div className="border-t pt-4">
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Documents (ID, Contrat, Police)
            </h4>
            {loading ? (
              <p className="text-sm text-gray-500">Chargement...</p>
            ) : documents.length === 0 ? (
              <p className="text-sm text-amber-600">Aucun document trouvé pour cette réservation.</p>
            ) : (
              <div className="space-y-3">
                {identityDocs.map((doc, i) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
                  >
                    <div className="flex items-center gap-2">
                      <Image className="h-4 w-4 text-gray-500" />
                      <span className="font-medium">
                        {getDocLabel(doc)} {identityDocs.length > 1 ? `#${i + 1}` : ''}
                      </span>
                      {doc.guests?.full_name && (
                        <Badge variant="outline" className="text-xs">
                          {doc.guests.full_name}
                        </Badge>
                      )}
                    </div>
                    {getDocUrl(doc) && (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(getDocUrl(doc)!, '_blank')}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = getDocUrl(doc)!;
                            link.download = `doc-${doc.document_type}-${i + 1}.pdf`;
                            link.click();
                          }}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
                {contractDoc && (
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-gray-500" />
                      <span className="font-medium">Contrat</span>
                    </div>
                    {getDocUrl(contractDoc) && (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(getDocUrl(contractDoc)!, '_blank')}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = getDocUrl(contractDoc)!;
                            link.download = 'contrat.pdf';
                            link.click();
                          }}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                )}
                {policeDoc && (
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-gray-500" />
                      <span className="font-medium">Fiche de police</span>
                    </div>
                    {getDocUrl(policeDoc) && (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(getDocUrl(policeDoc)!, '_blank')}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = getDocUrl(policeDoc)!;
                            link.download = 'fiche-police.pdf';
                            link.click();
                          }}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
