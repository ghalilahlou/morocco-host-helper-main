import React, { useState, useEffect, useRef } from 'react';
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
import { TokenControlService } from '@/services/tokenControlService';
import { selectActiveProperties } from '@/lib/properties';
import { TokenCreationService } from '@/services/tokenCreationService';
import { supabase } from '@/integrations/supabase/client';
import { 
  TokenControlSettings, 
  TokenControlType, 
  TOKEN_CONTROL_OPTIONS 
} from '@/types/tokenControl';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { 
  Settings, 
  Shield, 
  Building, 
  Trash2,
  AlertTriangle,
  UserCheck
} from 'lucide-react';
import { AdminHostAccounts } from './AdminHostAccounts';

export const AdminTokens = () => {
  const { tokenAllocations, users, allocateTokens, loadUsers, loadDashboardData } = useAdmin();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState('');
  const [tokenAmount, setTokenAmount] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // ✅ NOUVEAU : États pour le contrôle des tokens par propriété
  const [tokenControlSettings, setTokenControlSettings] = useState<TokenControlSettings[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<string>('');
  const [controlFormData, setControlFormData] = useState({
    control_type: 'unlimited' as TokenControlType,
    max_reservations: 10,
    is_enabled: true
  });
  const [loadingControl, setLoadingControl] = useState(false);
  const didRun = useRef(false);

  useEffect(() => {
    // Prevent React 18 dev double-invoke
    if (didRun.current) return;
    didRun.current = true;

    let cancelled = false;

    const loadData = async () => {
      if (isLoading || cancelled) return;
      
      setIsLoading(true);
      try {
        console.log('🔄 Loading admin data...');
        
        // Load data sequentially to avoid overwhelming the server
        await loadUsers();
        if (cancelled) return;
        
        await loadTokenControlSettings();
        if (cancelled) return;
        
        await loadProperties();
        if (cancelled) return;
        
        console.log('✅ Admin data loaded successfully');
      } catch (error) {
        if (!cancelled) {
          console.error('❌ Error loading admin data:', error);
          toast({
            title: "Erreur de chargement",
            description: "Impossible de charger les données administrateur",
            variant: "destructive"
          });
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };
    
    loadData();
    
    return () => {
      cancelled = true;
    };
  }, []); // Empty dependency array - run once only

  // ✅ NOUVEAU : Fonctions pour le contrôle des tokens par propriété
  const loadTokenControlSettings = async () => {
    try {
      console.log('🔍 Chargement des paramètres de contrôle des tokens...');
      
      // ✅ CORRECTION : Charger sans relation pour éviter l'erreur PGRST200
      const { data: settingsData, error: settingsError } = await supabase
        .from('token_control_settings')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (settingsError) {
        console.error('❌ Erreur lors du chargement des paramètres:', settingsError);
        throw settingsError;
      }
      
      console.log('✅ Paramètres de contrôle chargés:', settingsData?.length || 0);
      
      // ✅ CORRECTION : Enrichir les données avec les informations des propriétés
      if (settingsData && settingsData.length > 0) {
        const enrichedSettings = await Promise.all(
          settingsData.map(async (setting) => {
            try {
              const { data: propertyData } = await supabase
                .from('properties')
                .select('id, name, address')
                .eq('id', setting.property_id)
                .single();
              
              return {
                ...setting,
                property_name: propertyData?.name || 'Propriété inconnue',
                property_address: propertyData?.address || 'Adresse inconnue'
              };
            } catch (error) {
              console.error('❌ Erreur lors du chargement de la propriété:', setting.property_id, error);
              return {
                ...setting,
                property_name: 'Propriété inconnue',
                property_address: 'Adresse inconnue'
              };
            }
          })
        );
        
        setTokenControlSettings(enrichedSettings);
      } else {
        setTokenControlSettings([]);
      }
      
    } catch (error) {
      console.error('❌ Erreur lors du chargement des paramètres de contrôle:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les paramètres de contrôle",
        variant: "destructive"
      });
    }
  };

  const loadProperties = async () => {
    try {
      console.log('🔍 Chargement des propriétés pour la gestion des tokens...');
      
      // Use the defensive helper that handles missing is_active column
      const propertiesData = await selectActiveProperties(supabase);
      
      console.log('✅ Propriétés chargées:', propertiesData?.length || 0);
      setProperties(propertiesData || []);
      
    } catch (error) {
      console.error('❌ Erreur lors du chargement des propriétés:', error);
      // Don't show toast here - let the main error handler deal with it
      throw error;
    }
  };

  const handleSaveControlSettings = async () => {
    if (!selectedProperty) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner une propriété",
        variant: "destructive"
      });
      return;
    }

    setLoadingControl(true);
    try {
      console.log('🔍 Sauvegarde des paramètres de contrôle pour la propriété:', selectedProperty);
      console.log('🔍 Données du formulaire:', controlFormData);
      
      // ✅ CORRECTION : Créer ou mettre à jour les paramètres de contrôle directement
      const { data, error } = await supabase
        .from('token_control_settings')
        .upsert({
          property_id: selectedProperty,
          control_type: controlFormData.control_type,
          max_reservations: controlFormData.control_type === 'limited' ? controlFormData.max_reservations : null,
          is_enabled: controlFormData.is_enabled,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'property_id'
        })
        .select()
        .single();
      
      if (error) {
        console.error('❌ Erreur lors de la sauvegarde:', error);
        throw error;
      }
      
      console.log('✅ Paramètres sauvegardés avec succès:', data);
      
      toast({
        title: "Succès",
        description: "Paramètres de contrôle sauvegardés avec succès"
      });
      
      // Recharger les paramètres
      await loadTokenControlSettings();
      
      // Réinitialiser le formulaire
      setSelectedProperty('');
      setControlFormData({
        control_type: 'unlimited',
        max_reservations: 10,
        is_enabled: true
      });
      
    } catch (error) {
      console.error('❌ Erreur lors de la sauvegarde:', error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de sauvegarder les paramètres",
        variant: "destructive"
      });
    } finally {
      setLoadingControl(false);
    }
  };

  const handleResetCounter = async (propertyId: string) => {
    try {
      const success = await TokenControlService.resetReservationCount(propertyId);
      if (success) {
        toast({
          title: "Succès",
          description: "Compteur de réservations réinitialisé"
        });
        loadTokenControlSettings();
      }
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de réinitialiser le compteur",
        variant: "destructive"
      });
    }
  };

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
            Allouez des tokens aux utilisateurs et contrôlez la génération par propriété
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

      {/* Onglets : Allocation, Contrôle propriété, Comptes hosts */}
      <Tabs defaultValue="allocation" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="allocation" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Allocation Utilisateurs
          </TabsTrigger>
          <TabsTrigger value="control" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Contrôle par Propriété
          </TabsTrigger>
          <TabsTrigger value="hosts" className="flex items-center gap-2">
            <UserCheck className="h-4 w-4" />
            Comptes & Consommation
          </TabsTrigger>
        </TabsList>

        {/* Onglet Allocation Utilisateurs (existant) */}
        <TabsContent value="allocation" className="space-y-6">

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
        </TabsContent>

        {/* ✅ NOUVEAU : Onglet Contrôle par Propriété */}
        <TabsContent value="control" className="space-y-6">
          {/* Formulaire de configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Configuration du Contrôle des Tokens
              </CardTitle>
              <CardDescription>
                Définir les paramètres de génération de tokens pour chaque propriété
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="property">Propriété</Label>
                  <Select value={selectedProperty} onValueChange={setSelectedProperty}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner une propriété" />
                    </SelectTrigger>
                    <SelectContent>
                      {properties.map((property) => (
                        <SelectItem key={property.id} value={property.id}>
                          <div className="flex items-center gap-2">
                            <Building className="h-4 w-4" />
                            {property.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="control_type">Type de Contrôle</Label>
                  <Select 
                    value={controlFormData.control_type} 
                    onValueChange={(value: TokenControlType) => setControlFormData({...controlFormData, control_type: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TOKEN_CONTROL_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex items-center gap-2">
                            <span>{option.icon}</span>
                            <span>{option.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {controlFormData.control_type === 'limited' && (
                <div className="space-y-2">
                  <Label htmlFor="max_reservations">Nombre Maximum de Tokens</Label>
                  <Input
                    id="max_reservations"
                    type="number"
                    min="1"
                    value={controlFormData.max_reservations}
                    onChange={(e) => setControlFormData({...controlFormData, max_reservations: parseInt(e.target.value) || 1})}
                    placeholder="10"
                  />
                </div>
              )}

              <div className="flex items-center space-x-2">
                <Switch
                  id="is_enabled"
                  checked={controlFormData.is_enabled}
                  onCheckedChange={(checked) => setControlFormData({...controlFormData, is_enabled: checked})}
                />
                <Label htmlFor="is_enabled">Activer le contrôle</Label>
              </div>

              <Button 
                onClick={handleSaveControlSettings} 
                className="w-full"
                disabled={loadingControl}
              >
                {loadingControl ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Shield className="h-4 w-4 mr-2" />
                )}
                Sauvegarder les Paramètres
              </Button>
            </CardContent>
          </Card>

          {/* Liste des paramètres existants */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Paramètres Actuels
              </CardTitle>
              <CardDescription>
                Gérer les paramètres de contrôle des tokens par propriété
              </CardDescription>
            </CardHeader>
            <CardContent>
              {tokenControlSettings.length === 0 ? (
                <div className="text-center py-8">
                  <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">Aucun paramètre configuré</h3>
                  <p className="text-muted-foreground">
                    Les tokens sont générés sans restriction par défaut.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {tokenControlSettings.map((setting) => (
                    <div key={setting.id} className="border rounded-lg p-4 space-y-3">
                       <div className="flex items-center justify-between">
                         <div className="flex items-center gap-3">
                           <Building className="h-5 w-5 text-muted-foreground" />
                           <div>
                             <h3 className="font-medium">{setting.property_name || 'Propriété inconnue'}</h3>
                             <p className="text-sm text-muted-foreground">
                               {setting.property_address || setting.property_id}
                             </p>
                           </div>
                         </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={setting.control_type === 'blocked' ? 'destructive' : setting.control_type === 'limited' ? 'secondary' : 'default'}>
                            {TOKEN_CONTROL_OPTIONS.find(opt => opt.value === setting.control_type)?.icon} {setting.control_type}
                          </Badge>
                          {setting.is_enabled ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Statut:</span>
                          <span className={`ml-2 ${setting.is_enabled ? 'text-green-600' : 'text-red-600'}`}>
                            {setting.is_enabled ? 'Activé' : 'Désactivé'}
                          </span>
                        </div>
                        <div>
                          <span className="font-medium">Réservations:</span>
                          <span className="ml-2">
                            {setting.current_reservations}
                            {setting.max_reservations && ` / ${setting.max_reservations}`}
                          </span>
                        </div>
                        <div>
                          <span className="font-medium">Mis à jour:</span>
                          <span className="ml-2">
                            {new Date(setting.updated_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleResetCounter(setting.property_id)}
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Réinitialiser
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Comptes hosts : activation + consommation */}
        <TabsContent value="hosts" className="space-y-6">
          <AdminHostAccounts />
        </TabsContent>
      </Tabs>
    </div>
  );
};
