import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Link2, ShieldOff, Infinity } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type Row = {
  id: string;
  token: string;
  is_active: boolean;
  expires_at: string | null;
  used_count: number | null;
  created_at: string | null;
};

interface Props {
  propertyId: string;
  visible: boolean;
}

/**
 * Contrôle admin des liens invités : désactivation (is_active) ou date illimitée (expires_at NULL).
 * Aligné sur la logique « pas d'expiration auto ; c'est l'admin qui coupe ou impose une date ».
 */
export const AdminGuestLinkSection: React.FC<Props> = ({ propertyId, visible }) => {
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('property_verification_tokens')
        .select('id, token, is_active, expires_at, used_count, created_at')
        .eq('property_id', propertyId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRows((data as Row[]) || []);
    } catch (e) {
      console.error(e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible && propertyId) load();
  }, [visible, propertyId]);

  const setUnlimited = async (id: string) => {
    setBusyId(id);
    try {
      const { error } = await supabase
        .from('property_verification_tokens')
        .update({ expires_at: null, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      toast({ title: 'Lien mis à jour', description: 'Expiration automatique désactivée (illimité tant que le lien reste actif).' });
      await load();
    } catch {
      toast({
        title: 'Erreur',
        description: 'Impossible de modifier le jeton (droits admin / migration appliquée ?).',
        variant: 'destructive',
      });
    } finally {
      setBusyId(null);
    }
  };

  const deactivate = async (id: string) => {
    setBusyId(id);
    try {
      const { error } = await supabase
        .from('property_verification_tokens')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      toast({ title: 'Lien désactivé', description: 'Les voyageurs ne pourront plus utiliser ce jeton.' });
      await load();
    } catch {
      toast({
        title: 'Erreur',
        description: 'Impossible de désactiver le jeton.',
        variant: 'destructive',
      });
    } finally {
      setBusyId(null);
    }
  };

  if (!visible) return null;

  return (
    <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
      <h4 className="font-semibold flex items-center gap-2">
        <Link2 className="h-4 w-4" />
        Liens invités (admin)
      </h4>
      <p className="text-xs text-muted-foreground">
        Par défaut, plus d&apos;expiration automatique après 7 jours : un lien reste valide tant qu&apos;il est{' '}
        <strong>actif</strong>. Vous pouvez désactiver un jeton ou retirer une date d&apos;expiration imposée.
      </p>
      {loading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun jeton pour cette propriété.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div
              key={r.id}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border rounded-md p-3 bg-background text-sm"
            >
              <div className="space-y-1 min-w-0">
                <div className="font-mono text-xs break-all">{r.token}</div>
                <div className="flex flex-wrap gap-2 items-center">
                  {r.is_active ? (
                    <Badge className="bg-green-100 text-green-800">Actif</Badge>
                  ) : (
                    <Badge variant="secondary">Désactivé</Badge>
                  )}
                  <span className="text-muted-foreground">
                    {r.expires_at == null ? (
                      <span className="inline-flex items-center gap-1">
                        <Infinity className="h-3 w-3" /> Pas d&apos;expiration auto
                      </span>
                    ) : (
                      <>Expire : {new Date(r.expires_at).toLocaleString('fr-FR')}</>
                    )}
                  </span>
                  {r.used_count != null && (
                    <span className="text-xs text-muted-foreground">Utilisations : {r.used_count}</span>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                {r.expires_at != null && r.is_active && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busyId === r.id}
                    onClick={() => setUnlimited(r.id)}
                  >
                    <Infinity className="h-3 w-3 mr-1" />
                    Illimité (retirer la date)
                  </Button>
                )}
                {r.is_active && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={busyId === r.id}
                    onClick={() => deactivate(r.id)}
                  >
                    <ShieldOff className="h-3 w-3 mr-1" />
                    Désactiver
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="text-xs text-muted-foreground">
        <Label className="text-xs">Pour imposer une date limite</Label> : mettre à jour{' '}
        <code className="bg-muted px-1 rounded">expires_at</code> en SQL ou via une future action admin dédiée.
      </div>
    </div>
  );
};
