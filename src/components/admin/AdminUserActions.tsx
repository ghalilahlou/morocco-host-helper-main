import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Eye, Edit, Trash2, Save, X, User, Mail, Calendar, Shield, UserCheck, UserX } from 'lucide-react';

interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'super_admin';
  created_at: string;
  last_login?: string;
  is_active: boolean;
}

interface AdminUserActionsProps {
  user: AdminUser;
  onUpdate: () => void;
}

export const AdminUserActions: React.FC<AdminUserActionsProps> = ({ user, onUpdate }) => {
  const { toast } = useToast();
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // État pour l'édition
  const [editData, setEditData] = useState({
    role: user.role,
    is_active: user.is_active,
    notes: ''
  });

  const handleView = () => {
    setIsViewDialogOpen(true);
  };

  const handleEdit = () => {
    setEditData({
      role: user.role,
      is_active: user.is_active,
      notes: ''
    });
    setIsEditDialogOpen(true);
  };

  const handleDelete = () => {
    setIsDeleteDialogOpen(true);
  };

  const saveEdit = async () => {
    setIsLoading(true);
    try {
      // Mettre à jour le rôle dans admin_users
      const { error: adminError } = await supabase
        .from('admin_users')
        .update({
          role: editData.role,
          is_active: editData.is_active,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);

      if (adminError) throw adminError;

      toast({
        title: "Utilisateur mis à jour",
        description: "Les modifications ont été enregistrées avec succès."
      });

      setIsEditDialogOpen(false);
      onUpdate();
    } catch (error) {
      console.error('Error updating user:', error);
      toast({
        title: "Erreur",
        description: "Une erreur s'est produite lors de la mise à jour.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const confirmDelete = async () => {
    setIsLoading(true);
    try {
      // Supprimer de admin_users
      const { error: adminError } = await supabase
        .from('admin_users')
        .delete()
        .eq('user_id', user.id);

      if (adminError) throw adminError;

      toast({
        title: "Utilisateur supprimé",
        description: "L'utilisateur a été supprimé avec succès."
      });

      setIsDeleteDialogOpen(false);
      onUpdate();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast({
        title: "Erreur",
        description: "Une erreur s'est produite lors de la suppression.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getRoleBadge = (role: string) => {
    if (role === 'super_admin') {
      return <Badge className="bg-purple-100 text-purple-800">Super Admin</Badge>;
    }
    if (role === 'admin') {
      return <Badge className="bg-blue-100 text-blue-800">Admin</Badge>;
    }
    return <Badge variant="outline">Utilisateur</Badge>;
  };

  const getStatusBadge = (isActive: boolean) => {
    if (isActive) {
      return <Badge className="bg-green-100 text-green-800">Actif</Badge>;
    }
    return <Badge variant="secondary">Inactif</Badge>;
  };

  return (
    <>
      {/* Boutons d'action */}
      <div className="flex space-x-2">
        <Button variant="outline" size="sm" onClick={handleView}>
          <Eye className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={handleEdit}>
          <Edit className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={handleDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Dialog de visualisation */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Détails de l'utilisateur</DialogTitle>
            <DialogDescription>
              Informations complètes sur {user.full_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nom complet</Label>
                <div className="font-medium flex items-center">
                  <User className="h-4 w-4 mr-2 text-gray-400" />
                  {user.full_name}
                </div>
              </div>
              <div>
                <Label>Email</Label>
                <div className="font-medium flex items-center">
                  <Mail className="h-4 w-4 mr-2 text-gray-400" />
                  {user.email}
                </div>
              </div>
              <div>
                <Label>Rôle</Label>
                <div className="font-medium flex items-center">
                  <Shield className="h-4 w-4 mr-2 text-gray-400" />
                  {getRoleBadge(user.role)}
                </div>
              </div>
              <div>
                <Label>Statut</Label>
                <div className="font-medium flex items-center">
                  {user.is_active ? (
                    <UserCheck className="h-4 w-4 mr-2 text-green-400" />
                  ) : (
                    <UserX className="h-4 w-4 mr-2 text-red-400" />
                  )}
                  {getStatusBadge(user.is_active)}
                </div>
              </div>
              <div>
                <Label>Date d'inscription</Label>
                <div className="font-medium flex items-center">
                  <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                  {new Date(user.created_at).toLocaleDateString('fr-FR')}
                </div>
              </div>
              <div>
                <Label>Dernière connexion</Label>
                <div className="font-medium">
                  {user.last_login 
                    ? new Date(user.last_login).toLocaleDateString('fr-FR')
                    : 'Jamais connecté'
                  }
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsViewDialogOpen(false)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog d'édition */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Modifier l'utilisateur</DialogTitle>
            <DialogDescription>
              Modifiez les permissions de {user.full_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nom complet</Label>
                <div className="font-medium">{user.full_name}</div>
              </div>
              <div>
                <Label>Email</Label>
                <div className="font-medium">{user.email}</div>
              </div>
            </div>
            <div>
              <Label htmlFor="role">Rôle</Label>
              <select
                id="role"
                value={editData.role}
                onChange={(e) => setEditData({...editData, role: e.target.value as 'admin' | 'super_admin'})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="admin">Admin</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={editData.is_active}
                onCheckedChange={(checked) => setEditData({...editData, is_active: checked})}
              />
              <Label htmlFor="is_active">Utilisateur actif</Label>
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Input
                id="notes"
                value={editData.notes}
                onChange={(e) => setEditData({...editData, notes: e.target.value})}
                placeholder="Notes sur l'utilisateur..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              <X className="h-4 w-4 mr-2" />
              Annuler
            </Button>
            <Button onClick={saveEdit} disabled={isLoading}>
              <Save className="h-4 w-4 mr-2" />
              {isLoading ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmation de suppression */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Êtes-vous sûr ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action ne peut pas être annulée. Cela supprimera définitivement les droits administrateur de 
              "{user.full_name}" ({user.email}).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={isLoading}>
              {isLoading ? 'Suppression...' : 'Supprimer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
