import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  CreditCard, 
  Plus, 
  Users, 
  Target, 
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { useAdmin } from '@/hooks/useAdmin';
import { useToast } from '@/hooks/use-toast';
import { TokenAllocation } from '@/types/admin';

export const AdminTokens = () => {
  const { tokenAllocations, users, allocateTokens, loadUsers, loadDashboardData } = useAdmin();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState('');
  const [tokenAmount, setTokenAmount] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleAllocateTokens = async () => {
    if (!selectedUser || !tokenAmount) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner un utilisateur et spécifier un nombre de tokens.",
        variant: "destructive"
      });
      return;
    }

    const tokens = parseInt(tokenAmount);
    if (isNaN(tokens) || tokens <= 0) {
      toast({
        title: "Erreur",
        description: "Le nombre de tokens doit être un nombre positif.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      await allocateTokens(selectedUser, tokens);
      toast({
        title: "Succès",
        description: `${tokens} tokens ont été alloués avec succès.`
      });
      setIsDialogOpen(false);
      setSelectedUser('');
      setTokenAmount('');
      loadDashboardData(); // Recharger les données
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Une erreur s'est produite lors de l'allocation des tokens.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (allocation: TokenAllocation) => {
    if (allocation.tokens_remaining > 0) {
      return <Badge className="bg-green-100 text-green-800">Actif</Badge>;
    }
    return <Badge variant="secondary">Épuisé</Badge>;
  };

  const getUsagePercentage = (allocation: TokenAllocation) => {
    if (allocation.tokens_allocated === 0) return 0;
    return Math.round((allocation.tokens_used / allocation.tokens_allocated) * 100);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gestion des Tokens</h2>
          <p className="text-gray-600">
            Allouez des tokens aux utilisateurs pour générer des liens de réservation
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Allouer des tokens
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Allouer des tokens</DialogTitle>
              <DialogDescription>
                Sélectionnez un utilisateur et spécifiez le nombre de tokens à allouer.
                Chaque token permet de générer un lien de réservation.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="user">Utilisateur</Label>
                <Select value={selectedUser} onValueChange={setSelectedUser}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un utilisateur" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="tokens">Nombre de tokens</Label>
                <Input
                  id="tokens"
                  type="number"
                  placeholder="Ex: 10"
                  value={tokenAmount}
                  onChange={(e) => setTokenAmount(e.target.value)}
                  min="1"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Annuler
              </Button>
              <Button onClick={handleAllocateTokens} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Allocation...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Allouer
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tokens alloués</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {tokenAllocations.reduce((sum, allocation) => sum + allocation.tokens_allocated, 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Total des tokens distribués
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tokens utilisés</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {tokenAllocations.reduce((sum, allocation) => sum + allocation.tokens_used, 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Liens de réservation générés
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tokens restants</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {tokenAllocations.reduce((sum, allocation) => sum + allocation.tokens_remaining, 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Liens disponibles
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Table des allocations */}
      <Card>
        <CardHeader>
          <CardTitle>Allocations de tokens</CardTitle>
          <CardDescription>
            Vue d'ensemble des tokens alloués aux utilisateurs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Utilisateur</TableHead>
                <TableHead>Tokens alloués</TableHead>
                <TableHead>Tokens utilisés</TableHead>
                <TableHead>Tokens restants</TableHead>
                <TableHead>Utilisation</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Date d'allocation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tokenAllocations.map((allocation) => (
                <TableRow key={allocation.id}>
                  <TableCell className="font-medium">
                    {allocation.user_email}
                  </TableCell>
                  <TableCell>{allocation.tokens_allocated}</TableCell>
                  <TableCell>{allocation.tokens_used}</TableCell>
                  <TableCell>{allocation.tokens_remaining}</TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <div className="w-20 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-primary h-2 rounded-full"
                          style={{ width: `${getUsagePercentage(allocation)}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-500">
                        {getUsagePercentage(allocation)}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(allocation)}
                  </TableCell>
                  <TableCell>
                    {new Date(allocation.created_at).toLocaleDateString('fr-FR')}
                  </TableCell>
                </TableRow>
              ))}
              {tokenAllocations.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    Aucune allocation de tokens trouvée
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Informations */}
      <Card>
        <CardHeader>
          <CardTitle>Comment fonctionnent les tokens ?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-semibold flex items-center">
                <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                Allocation
              </h4>
              <p className="text-sm text-gray-600">
                Les administrateurs peuvent allouer un nombre spécifique de tokens à chaque utilisateur.
                Chaque token permet de générer un lien de réservation unique.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold flex items-center">
                <Target className="h-4 w-4 mr-2 text-blue-600" />
                Utilisation
              </h4>
              <p className="text-sm text-gray-600">
                Quand un utilisateur génère un lien de réservation, un token est consommé.
                Les tokens restants déterminent combien de liens peuvent encore être générés.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold flex items-center">
                <Users className="h-4 w-4 mr-2 text-purple-600" />
                Gestion
              </h4>
              <p className="text-sm text-gray-600">
                Les administrateurs peuvent voir l'utilisation des tokens en temps réel
                et allouer de nouveaux tokens selon les besoins.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold flex items-center">
                <XCircle className="h-4 w-4 mr-2 text-red-600" />
                Limitation
              </h4>
              <p className="text-sm text-gray-600">
                Une fois les tokens épuisés, l'utilisateur ne peut plus générer de nouveaux liens
                jusqu'à ce que de nouveaux tokens soient alloués.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
