import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Users,
  RefreshCw,
  Shield,
  ShieldOff,
  AlertCircle,
  Building2,
  CreditCard,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface HostAccount {
  user_id: string;
  email: string;
  full_name: string;
  user_name?: string;
  plan: string;
  check_in_count: number;
  plan_limit: number | null;
  is_paused: boolean;
  created_at: string;
  properties_count: number;
}

export const AdminHostAccounts = () => {
  const [accounts, setAccounts] = useState<HostAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const { toast } = useToast();

  const loadAccounts = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_host_accounts_for_admin');
      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      console.error('Erreur chargement comptes hosts:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les comptes hosts',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  const handleTogglePause = async (userId: string, currentPaused: boolean) => {
    setTogglingId(userId);
    try {
      const { data, error } = await supabase.rpc('admin_set_host_account_paused', {
        p_user_id: userId,
        p_is_paused: !currentPaused,
      });
      if (error) throw error;
      toast({
        title: currentPaused ? 'Compte activé' : 'Compte mis en pause',
        description: currentPaused
          ? "L'utilisateur peut à nouveau accéder à son espace."
          : "L'accès de l'utilisateur est bloqué.",
      });
      loadAccounts();
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de modifier le statut du compte',
        variant: 'destructive',
      });
    } finally {
      setTogglingId(null);
    }
  };

  const pausedCount = accounts.filter((a) => a.is_paused).length;
  const activeCount = accounts.length - pausedCount;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Comptes Hosts & Consommation</h2>
          <p className="text-gray-600">
            Gérez l'activation des comptes et consultez la consommation des vérifications
          </p>
        </div>
        <Button onClick={loadAccounts} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total comptes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{accounts.length}</div>
            <p className="text-xs text-muted-foreground">Comptes hosts</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Actifs</CardTitle>
            <Shield className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeCount}</div>
            <p className="text-xs text-muted-foreground">Accès autorisé</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En pause</CardTitle>
            <ShieldOff className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{pausedCount}</div>
            <p className="text-xs text-muted-foreground">Consommation épuisée ou bloqué</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Logique tokens</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Auto-pause quand consommation ≥ limite plan. Admin peut réactiver.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Liste des comptes hosts</CardTitle>
          <CardDescription>
            Cliquez sur Activer / Bloquer pour gérer l'accès. Les comptes sont automatiquement mis en pause lorsque la consommation est épuisée.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Utilisateur</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Consommation</TableHead>
                <TableHead>Propriétés</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((acc) => (
                <TableRow key={acc.user_id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{acc.user_name || acc.full_name || acc.email}</span>
                      <span className="text-sm text-gray-500">{acc.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{acc.plan}</Badge>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono">
                      {acc.check_in_count}
                      {acc.plan_limit != null ? ` / ${acc.plan_limit}` : ' (illimité)'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Building2 className="h-4 w-4 text-gray-400" />
                      {acc.properties_count}
                    </div>
                  </TableCell>
                  <TableCell>
                    {acc.is_paused ? (
                      <Badge variant="destructive">En pause</Badge>
                    ) : (
                      <Badge className="bg-green-100 text-green-800">Actif</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={togglingId === acc.user_id}
                      onClick={() => handleTogglePause(acc.user_id, acc.is_paused)}
                    >
                      {togglingId === acc.user_id ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : acc.is_paused ? (
                        <>
                          <Shield className="h-4 w-4 mr-1" />
                          Activer
                        </>
                      ) : (
                        <>
                          <ShieldOff className="h-4 w-4 mr-1" />
                          Bloquer
                        </>
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {accounts.length === 0 && !isLoading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    Aucun compte host trouvé (les comptes sont créés à la première connexion)
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
