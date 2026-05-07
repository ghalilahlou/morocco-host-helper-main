import React, { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  DiscrepancyFlag,
  DiscrepantBooking,
  GuestRecord,
  PendingCorrections,
} from '@/types/admin';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Download,
  ExternalLink,
  Eye,
  FileText,
  ImageIcon,
  Loader2,
  Pencil,
  RefreshCw,
  RotateCcw,
  Save,
  X,
} from 'lucide-react';

// ---- Types ----

interface BookingDocument {
  id: string;
  document_type: string;
  document_url: string | null;
  file_name?: string | null;
  is_signed?: boolean;
  created_at: string;
}

// ---- Helpers ----

const FLAG_LABELS: Record<DiscrepancyFlag, { label: string; critical: boolean }> = {
  date_checkin_mismatch:   { label: 'Check-in divergent',       critical: true },
  date_checkout_mismatch:  { label: 'Check-out divergent',      critical: true },
  dob_suspicious:          { label: 'Date naissance suspecte',  critical: true },
  document_number_suspect: { label: 'N° document trop court',   critical: true },
  missing_document_number: { label: 'N° document manquant',     critical: true },
  missing_dob:             { label: 'Date naissance manquante', critical: true },
  missing_required_fields: { label: 'Champs fiche police vides',critical: false },
};

const MOTIF_OPTIONS = ['TOURISME', 'AFFAIRES', 'FAMILLE', 'ETUDES', 'SANTE', 'TRANSIT', 'AUTRE'];
const DOCUMENT_TYPE_OPTIONS = [
  { value: 'passport',    label: 'Passeport' },
  { value: 'national_id', label: 'Carte nationale' },
];

function flagBadge(flag: DiscrepancyFlag) {
  const { label, critical } = FLAG_LABELS[flag] ?? { label: flag, critical: false };
  return (
    <Badge key={flag} className={critical ? 'bg-red-100 text-red-800 text-xs' : 'bg-yellow-100 text-yellow-800 text-xs'}>
      {label}
    </Badge>
  );
}

function fmt(date: string | null | undefined) {
  if (!date) return '—';
  try { return new Date(date).toLocaleDateString('fr-FR'); } catch { return date; }
}

function isImageUrl(url: string) {
  const lower = url.toLowerCase();
  return lower.includes('.jpg') || lower.includes('.jpeg') || lower.includes('.png') ||
    lower.includes('.webp') || lower.includes('image/');
}

function docTypeLabel(type: string) {
  const map: Record<string, string> = {
    contract: 'Contrat',
    police: 'Fiche de police',
    identity: "Pièce d'identité",
    id: "Pièce d'identité",
  };
  return map[type] ?? type;
}

// ---- Documents Section Sub-component ----

interface DocumentsSectionProps {
  bookingId: string;
  onRegenerate: (type: 'police' | 'contract') => Promise<void>;
  regenerating: 'police' | 'contract' | null;
  refreshKey?: number;
  guestsHaveCriticalIssues?: boolean;
}

const DocumentsSection: React.FC<DocumentsSectionProps> = ({
  bookingId, onRegenerate, regenerating, refreshKey = 0, guestsHaveCriticalIssues = false,
}) => {
  const { toast } = useToast();
  const [docs, setDocs] = useState<BookingDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Pièces d'identité uploadées
      const { data: idDocs } = await supabase
        .from('uploaded_documents')
        .select('id, document_type, document_url, file_name, created_at')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: false });

      // 2. Documents générés (contrat + fiche de police)
      const { data: genDocs } = await supabase
        .from('generated_documents')
        .select('id, document_type, document_url, is_signed, created_at')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: false });

      const all: BookingDocument[] = [
        ...(idDocs ?? []).map(d => ({ ...d, document_type: d.document_type ?? 'identity' })),
        ...(genDocs ?? []).map(d => ({ ...d, document_type: d.document_type ?? 'unknown' })),
      ];
      setDocs(all);
    } catch (e) {
      if (import.meta.env.DEV) console.error('[DocumentsSection] load error:', e);
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const idDocs   = docs.filter(d => ['identity', 'id'].includes(d.document_type));
  const genDocs  = docs.filter(d => ['contract', 'police'].includes(d.document_type));
  const hasDocs  = docs.length > 0;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <FileText className="h-4 w-4 text-blue-500" />
          Documents & Pièces d'identité
        </h3>
        <Button variant="ghost" size="sm" onClick={load} disabled={loading} className="h-6 px-2">
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
          <Loader2 className="h-3 w-3 animate-spin" />
          Chargement des documents…
        </div>
      )}

      {!loading && !hasDocs && (
        <div className="text-xs text-gray-400 italic py-2">Aucun document trouvé pour cette réservation.</div>
      )}

      {/* Pièces d'identité */}
      {idDocs.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Pièces d'identité uploadées</p>
          <div className="flex flex-wrap gap-2">
            {idDocs.map(doc => {
              const url = doc.document_url;
              if (!url) return null;
              const isImg = isImageUrl(url);
              return (
                <div key={doc.id} className="relative group">
                  {isImg ? (
                    <button
                      onClick={() => setLightbox(url)}
                      className="block w-20 h-20 rounded-lg border border-gray-200 overflow-hidden hover:border-blue-400 transition-colors"
                      title={doc.file_name ?? "Voir l'image"}
                    >
                      <img
                        src={url}
                        alt={doc.file_name ?? "pièce d'identité"}
                        className="w-full h-full object-cover"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <Eye className="h-5 w-5 text-white" />
                      </div>
                    </button>
                  ) : (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-col items-center justify-center w-20 h-20 rounded-lg border border-gray-200 hover:border-blue-400 transition-colors bg-gray-50 gap-1"
                      title={doc.file_name ?? 'Ouvrir'}
                    >
                      <FileText className="h-6 w-6 text-gray-400" />
                      <span className="text-xs text-gray-400 truncate w-full text-center px-1">
                        {doc.file_name?.split('.').pop()?.toUpperCase() ?? 'DOC'}
                      </span>
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Documents générés */}
      {genDocs.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Documents générés</p>
          <div className="space-y-1">
            {genDocs.map(doc => (
              <div key={doc.id} className="flex items-center justify-between py-1.5 px-2 bg-gray-50 rounded">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-4 w-4 text-gray-400 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-sm font-medium">{docTypeLabel(doc.document_type)}</span>
                    {doc.is_signed && (
                      <Badge className="ml-2 bg-green-100 text-green-700 text-xs">Signé</Badge>
                    )}
                    <p className="text-xs text-gray-400">{fmt(doc.created_at)}</p>
                  </div>
                </div>
                {doc.document_url && (
                  <div className="flex gap-1 shrink-0">
                    <a
                      href={doc.document_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 rounded hover:bg-gray-200 transition-colors"
                      title="Ouvrir"
                    >
                      <ExternalLink className="h-4 w-4 text-gray-500" />
                    </a>
                    <a
                      href={doc.document_url}
                      download
                      className="p-1 rounded hover:bg-gray-200 transition-colors"
                      title="Télécharger"
                    >
                      <Download className="h-4 w-4 text-gray-500" />
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Boutons régénération */}
      <div className="border-t pt-3 space-y-2">
        <p className="text-xs text-gray-500 font-medium">Régénérer depuis les données corrigées :</p>
        {guestsHaveCriticalIssues && (
          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
            Des champs critiques sont encore manquants (N° document, Nom). Corrigez et sauvegardez avant de régénérer.
          </div>
        )}
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            disabled={regenerating !== null || guestsHaveCriticalIssues}
            onClick={() => onRegenerate('police')}
            className="text-xs"
          >
            {regenerating === 'police' ? (
              <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Génération…</>
            ) : (
              <><RefreshCw className="h-3 w-3 mr-1" />Régénérer fiche de police</>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={regenerating !== null}
            onClick={() => onRegenerate('contract')}
            className="text-xs"
          >
            {regenerating === 'contract' ? (
              <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Génération…</>
            ) : (
              <><RefreshCw className="h-3 w-3 mr-1" />Régénérer contrat</>
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={load}
            className="text-xs text-gray-500"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Rafraîchir
          </Button>
        </div>
      </div>

      {/* Lightbox image */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <div className="relative max-w-3xl max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <img src={lightbox} alt="Document identité" className="max-w-full max-h-[85vh] object-contain rounded-lg" />
            <button
              onClick={() => setLightbox(null)}
              className="absolute -top-3 -right-3 bg-white rounded-full p-1 shadow-lg"
            >
              <X className="h-5 w-5" />
            </button>
            <a
              href={lightbox}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-white rounded-full px-3 py-1 shadow-lg text-sm flex items-center gap-1"
              onClick={e => e.stopPropagation()}
            >
              <Download className="h-4 w-4" />
              Télécharger
            </a>
          </div>
        </div>
      )}
    </section>
  );
};

// ---- FieldRow ----

interface FieldRowProps {
  label: string;
  fieldKey: string;
  currentValue: string | null;
  suggestedValue?: string | null;
  pendingValue?: string;
  type?: 'text' | 'date' | 'select-motif' | 'select-doctype';
  isMissing?: boolean;
  onEdit: (key: string, value: string) => void;
  onReset: (key: string) => void;
}

const FieldRow: React.FC<FieldRowProps> = ({
  label, fieldKey, currentValue, suggestedValue, pendingValue,
  type = 'text', isMissing, onEdit, onReset,
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState('');

  const hasPending   = pendingValue !== undefined;
  const displayValue = hasPending ? pendingValue : (currentValue ?? '');
  const hasSuggestion = suggestedValue && suggestedValue !== currentValue;

  const startEdit = () => { setDraft(displayValue); setEditing(true); };
  const confirm   = () => { onEdit(fieldKey, draft); setEditing(false); };
  const cancel    = () => setEditing(false);
  const useSug    = () => { onEdit(fieldKey, suggestedValue!); setEditing(false); };

  return (
    <div className={`flex flex-col gap-1 py-2 border-b last:border-0 ${isMissing && !hasPending ? 'bg-red-50 rounded px-2' : ''}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
        <div className="flex items-center gap-1">
          {hasSuggestion && !hasPending && (
            <Button variant="ghost" size="sm" className="h-6 text-xs text-blue-600 px-2" onClick={useSug} title={`Utiliser: ${suggestedValue}`}>
              Utiliser suggestion
            </Button>
          )}
          {hasPending && (
            <Button variant="ghost" size="sm" className="h-6 px-1" onClick={() => onReset(fieldKey)}>
              <RotateCcw className="h-3 w-3 text-gray-400" />
            </Button>
          )}
          {!editing && (
            <Button variant="ghost" size="sm" className="h-6 px-1" onClick={startEdit}>
              <Pencil className="h-3 w-3 text-gray-400" />
            </Button>
          )}
        </div>
      </div>

      {editing ? (
        <div className="flex items-center gap-2">
          {type === 'select-motif' ? (
            <Select value={draft} onValueChange={setDraft}>
              <SelectTrigger className="h-7 text-sm flex-1"><SelectValue /></SelectTrigger>
              <SelectContent>{MOTIF_OPTIONS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
          ) : type === 'select-doctype' ? (
            <Select value={draft} onValueChange={setDraft}>
              <SelectTrigger className="h-7 text-sm flex-1"><SelectValue /></SelectTrigger>
              <SelectContent>{DOCUMENT_TYPE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
          ) : (
            <Input type={type === 'date' ? 'date' : 'text'} value={draft} onChange={e => setDraft(e.target.value)} className="h-7 text-sm flex-1" autoFocus />
          )}
          <Button size="sm" className="h-7 px-2" onClick={confirm}><CheckCircle2 className="h-3 w-3" /></Button>
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={cancel}><X className="h-3 w-3" /></Button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <span className={`text-sm ${!displayValue ? 'text-red-500 italic' : hasPending ? 'text-blue-700 font-medium' : ''}`}>
            {displayValue || 'Vide'}
          </span>
          {hasPending && <Badge className="bg-blue-100 text-blue-700 text-xs">Modifié</Badge>}
          {hasSuggestion && !hasPending && (
            <span className="text-xs text-gray-400">Suggéré: <span className="text-orange-600">{suggestedValue}</span></span>
          )}
        </div>
      )}
    </div>
  );
};

// ---- Main Component ----

export const AdminDataReconciliation: React.FC = () => {
  const { toast } = useToast();
  const [bookings, setBookings]       = useState<DiscrepantBooking[]>([]);
  const [loading, setLoading]         = useState(false);
  const [selected, setSelected]       = useState<DiscrepantBooking | null>(null);
  const [corrections, setCorrections] = useState<PendingCorrections>({ guests: {} });
  const [saving, setSaving]           = useState(false);
  const [savedBookingId, setSavedBookingId] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<'all' | 'critical' | 'warning'>('all');
  const [regenerating, setRegenerating]     = useState<'police' | 'contract' | null>(null);
  const [docsRefreshKey, setDocsRefreshKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('admin_get_discrepant_bookings');
      if (error) {
        if (import.meta.env.DEV) {
          console.error('[AdminDataReconciliation] RPC error:', error);
          console.error('[AdminDataReconciliation] code:', (error as any).code, 'message:', error.message);
        }
        throw error;
      }
      setBookings((data as DiscrepantBooking[]) ?? []);
    } catch (e: unknown) {
      const supaErr = e as any;
      toast({ title: 'Erreur de chargement', description: supaErr?.message ?? String(e), variant: 'destructive', duration: 10000 });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setCorrections({ guests: {} }); setSavedBookingId(null); }, [selected?.booking_id]);

  const visible = bookings.filter(b => severityFilter === 'all' || b.severity === severityFilter);
  const criticalCount = bookings.filter(b => b.severity === 'critical').length;
  const warningCount  = bookings.filter(b => b.severity === 'warning').length;

  const getSuggested = (guest: GuestRecord, field: string): string | null => {
    if (!selected?.submission_guest_data?.length) return null;
    const sub = selected.submission_guest_data[0] as Record<string, unknown>;
    const camelMap: Record<string, string> = {
      full_name: 'fullName', date_of_birth: 'dateOfBirth', document_number: 'documentNumber',
      document_type: 'documentType', document_issue_date: 'documentIssueDate',
      nationality: 'nationality', place_of_birth: 'placeOfBirth',
      profession: 'profession', motif_sejour: 'motifSejour',
      adresse_personnelle: 'adressePersonnelle', email: 'email',
    };
    const val = sub[camelMap[field]] ?? sub[field];
    return val ? String(val) : null;
  };

  const setGuestField = (guestId: string, field: string, value: string) => {
    setCorrections(prev => ({
      ...prev,
      guests: { ...prev.guests, [guestId]: { ...prev.guests[guestId], [field]: value } },
    }));
  };

  const resetGuestField = (guestId: string, field: string) => {
    setCorrections(prev => {
      const g = { ...prev.guests[guestId] };
      delete g[field];
      return { ...prev, guests: { ...prev.guests, [guestId]: g } };
    });
  };

  const setBookingField = (field: 'check_in_date' | 'check_out_date', value: string) =>
    setCorrections(prev => ({ ...prev, booking: { ...prev.booking, [field]: value } }));

  const resetBookingField = (field: 'check_in_date' | 'check_out_date') =>
    setCorrections(prev => {
      const b = { ...prev.booking }; delete b[field];
      return { ...prev, booking: Object.keys(b).length ? b : undefined };
    });

  const hasPendingCorrections = () => {
    if (corrections.booking && Object.keys(corrections.booking).length) return true;
    return Object.values(corrections.guests).some(g => Object.keys(g).length > 0);
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      if (corrections.booking && Object.keys(corrections.booking).length) {
        const { error } = await supabase.rpc('admin_correct_booking_dates', {
          p_booking_id: selected.booking_id,
          p_check_in_date: corrections.booking.check_in_date ?? null,
          p_check_out_date: corrections.booking.check_out_date ?? null,
          p_reason: 'Correction manuelle admin',
        });
        if (error) throw error;
      }
      for (const [guestId, fields] of Object.entries(corrections.guests)) {
        for (const [field, value] of Object.entries(fields)) {
          const { error } = await supabase.rpc('admin_correct_guest_field', {
            p_guest_id: guestId, p_field: field, p_value: value, p_reason: 'Correction manuelle admin',
          });
          if (error) throw error;
        }
      }
      toast({ title: 'Corrections enregistrées', description: 'Les données ont été mises à jour avec succès.' });
      setSavedBookingId(selected.booking_id);
      await load();
    } catch (e: unknown) {
      toast({ title: 'Erreur lors de la sauvegarde', description: (e as any)?.message ?? String(e), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerate = async (type: 'police' | 'contract') => {
    if (!selected) return;

    if (type === 'contract') {
      toast({
        title: 'Régénération contrat',
        description:
          "La régénération du contrat n'est pas disponible depuis l'interface admin. " +
          "Une fois les données corrigées et sauvegardées, demandez à l'hôte de " +
          "régénérer le contrat depuis son tableau de bord.",
        duration: 10000,
      });
      return;
    }

    // Pré-validation: vérifier que les champs obligatoires sont présents
    const guestsToCheck = selected.guests;
    const incomplete = guestsToCheck.filter(
      g => !g.full_name?.trim() || !g.document_number?.trim()
    );
    if (incomplete.length > 0) {
      const names = incomplete.map(g => g.full_name ?? 'Invité inconnu').join(', ');
      toast({
        title: 'Données incomplètes — régénération impossible',
        description: `${incomplete.length} invité(s) manquent de données obligatoires (Nom ou N° document) : ${names}. Corrigez et sauvegardez ces champs d'abord.`,
        variant: 'destructive',
        duration: 10000,
      });
      return;
    }

    setRegenerating('police');
    try {
      const { data, error } = await supabase.functions.invoke('generate-police-forms', {
        body: { bookingId: selected.booking_id },
      });

      if (error) {
        // Extraire le message réel depuis le body JSON de la fonction
        const body = data as any;
        const detail  = body?.error ?? body?.message ?? error.message;
        const code    = body?.code ? ` [${body.code}]` : '';
        throw new Error(`${code} ${detail}`.trim());
      }

      toast({
        title: 'Fiche de police régénérée',
        description: 'Le document PDF a été mis à jour avec les données corrigées.',
      });
      setDocsRefreshKey(k => k + 1);
    } catch (e: unknown) {
      toast({
        title: 'Erreur régénération fiche de police',
        description: (e as Error).message,
        variant: 'destructive',
        duration: 10000,
      });
    } finally {
      setRegenerating(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Contrôle Qualité — Fiches & Contrats</h2>
          <p className="text-gray-600">Détecte les champs vides ou incohérents et permet leur correction manuelle avant régénération des documents.</p>
        </div>
        <Button onClick={load} disabled={loading} variant="outline">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      {/* Counters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="cursor-pointer border-2 hover:border-gray-300" onClick={() => setSeverityFilter('all')}>
          <CardContent className="pt-4">
            <div className="text-3xl font-bold">{bookings.length}</div>
            <p className="text-sm text-gray-500">Réservations avec anomalies</p>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer border-2 ${severityFilter === 'critical' ? 'border-red-400 bg-red-50' : 'hover:border-red-200'}`}
          onClick={() => setSeverityFilter(severityFilter === 'critical' ? 'all' : 'critical')}
        >
          <CardContent className="pt-4">
            <div className="text-3xl font-bold text-red-600">{criticalCount}</div>
            <p className="text-sm text-gray-500">Critiques (dates / document)</p>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer border-2 ${severityFilter === 'warning' ? 'border-yellow-400 bg-yellow-50' : 'hover:border-yellow-200'}`}
          onClick={() => setSeverityFilter(severityFilter === 'warning' ? 'all' : 'warning')}
        >
          <CardContent className="pt-4">
            <div className="text-3xl font-bold text-yellow-600">{warningCount}</div>
            <p className="text-sm text-gray-500">Avertissements (champs manquants)</p>
          </CardContent>
        </Card>
      </div>

      {/* Split layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* LEFT: booking list */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{visible.length} réservation{visible.length > 1 ? 's' : ''}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            )}
            {!loading && visible.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-green-400" />
                <p className="text-sm">Aucune anomalie détectée</p>
              </div>
            )}
            <div className="divide-y max-h-[600px] overflow-y-auto">
              {visible.map(b => (
                <button
                  key={b.booking_id}
                  onClick={() => setSelected(b)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex items-start justify-between gap-2
                    ${selected?.booking_id === b.booking_id ? 'bg-blue-50 border-l-2 border-blue-500' : ''}`}
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge className={b.severity === 'critical' ? 'bg-red-100 text-red-800 text-xs' : 'bg-yellow-100 text-yellow-800 text-xs'}>
                        {b.severity === 'critical' ? 'Critique' : 'Avertissement'}
                      </Badge>
                      <span className="text-sm font-medium truncate">{b.booking_reference ?? b.booking_id.slice(0, 8)}</span>
                    </div>
                    <p className="text-xs text-gray-500 truncate">{b.property_name ?? '—'}</p>
                    <p className="text-xs text-gray-400">{fmt(b.check_in_date)} → {fmt(b.check_out_date)}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {b.flags.slice(0, 3).map(f => flagBadge(f))}
                      {b.flags.length > 3 && <Badge variant="outline" className="text-xs">+{b.flags.length - 3}</Badge>}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-300 shrink-0 mt-1" />
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* RIGHT: detail panel */}
        <div className="lg:col-span-3">
          {!selected ? (
            <Card className="h-full flex items-center justify-center">
              <CardContent className="text-center py-16 text-gray-400">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Sélectionnez une réservation pour inspecter et corriger ses données</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{selected.booking_reference ?? selected.booking_id.slice(0, 8)}</CardTitle>
                    <CardDescription>{selected.property_name} · {fmt(selected.check_in_date)} → {fmt(selected.check_out_date)}</CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-1 justify-end max-w-[200px]">
                    {selected.flags.map(f => flagBadge(f))}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-6 max-h-[75vh] overflow-y-auto">

                {/* Documents + Régénération */}
                <DocumentsSection
                  bookingId={selected.booking_id}
                  onRegenerate={handleRegenerate}
                  regenerating={regenerating}
                  refreshKey={docsRefreshKey}
                  guestsHaveCriticalIssues={selected.guests.some(
                    g => !g.full_name?.trim() || !g.document_number?.trim()
                  )}
                />

                <div className="border-t" />

                {/* Dates réservation */}
                {(selected.flags.includes('date_checkin_mismatch') || selected.flags.includes('date_checkout_mismatch')) && (
                  <section>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      Dates de séjour (réservation)
                    </h3>
                    <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                      <FieldRow
                        label="Check-in" fieldKey="check_in_date"
                        currentValue={selected.check_in_date}
                        suggestedValue={selected.submission_booking_data?.checkInDate ?? null}
                        pendingValue={corrections.booking?.check_in_date}
                        type="date" isMissing={false}
                        onEdit={(_, v) => setBookingField('check_in_date', v)}
                        onReset={() => resetBookingField('check_in_date')}
                      />
                      <FieldRow
                        label="Check-out" fieldKey="check_out_date"
                        currentValue={selected.check_out_date}
                        suggestedValue={selected.submission_booking_data?.checkOutDate ?? null}
                        pendingValue={corrections.booking?.check_out_date}
                        type="date" isMissing={false}
                        onEdit={(_, v) => setBookingField('check_out_date', v)}
                        onReset={() => resetBookingField('check_out_date')}
                      />
                    </div>
                  </section>
                )}

                {/* Invités */}
                {selected.guests.map((guest, idx) => (
                  <section key={guest.id}>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">
                      Invité {idx + 1} — {guest.full_name ?? 'Nom inconnu'}
                    </h3>
                    <div className="bg-gray-50 rounded-lg p-3 space-y-0">
                      {([
                        { key: 'full_name',           label: 'Nom complet',         type: 'text' },
                        { key: 'date_of_birth',        label: 'Date de naissance',   type: 'date' },
                        { key: 'document_type',        label: 'Type de document',    type: 'select-doctype' },
                        { key: 'document_number',      label: 'N° document',         type: 'text' },
                        { key: 'document_issue_date',  label: 'Date délivrance doc', type: 'date' },
                        { key: 'nationality',          label: 'Nationalité',         type: 'text' },
                        { key: 'place_of_birth',       label: 'Lieu de naissance',   type: 'text' },
                        { key: 'profession',           label: 'Profession',          type: 'text' },
                        { key: 'motif_sejour',         label: 'Motif du séjour',     type: 'select-motif' },
                        { key: 'adresse_personnelle',  label: 'Adresse personnelle', type: 'text' },
                        { key: 'email',                label: 'Email',               type: 'text' },
                      ] as const).map(({ key, label, type }) => {
                        const currentVal = guest[key as keyof GuestRecord] as string | null;
                        const isMissing  = !currentVal || (currentVal as string).trim() === '';
                        return (
                          <FieldRow
                            key={key} label={label} fieldKey={key}
                            currentValue={currentVal}
                            suggestedValue={getSuggested(guest, key)}
                            pendingValue={corrections.guests[guest.id]?.[key]}
                            type={type as FieldRowProps['type']}
                            isMissing={isMissing}
                            onEdit={(k, v) => setGuestField(guest.id, k, v)}
                            onReset={k => resetGuestField(guest.id, k)}
                          />
                        );
                      })}
                    </div>
                  </section>
                ))}

                {/* Sauvegarder */}
                <div className="flex flex-col gap-3 pt-2 border-t sticky bottom-0 bg-white py-3">
                  <Button onClick={handleSave} disabled={saving || !hasPendingCorrections()} className="w-full">
                    {saving ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sauvegarde...</>
                    ) : (
                      <><Save className="h-4 w-4 mr-2" />Sauvegarder les corrections</>
                    )}
                  </Button>

                  {savedBookingId === selected.booking_id && (
                    <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-800">
                      <p className="font-medium">Corrections enregistrées.</p>
                      <p className="text-xs mt-1">Utilisez les boutons "Régénérer" ci-dessus pour mettre à jour les documents PDF.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
