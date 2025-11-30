import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, Camera } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export const Profile: React.FC = () => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    avatarUrl: '',
  });

  // Load profile data from host_profiles table
  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return;
      
      setProfileLoading(true);
      try {
        const { data, error } = await supabase
          .from('host_profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          console.error('Error loading profile:', error);
          return;
        }

        if (data) {
          setFormData({
            fullName: data.full_name || '',
            phone: data.phone || '',
            avatarUrl: data.avatar_url || '',
          });
        } else {
          // Fallback to user metadata if no profile exists
          setFormData({
            fullName: user.user_metadata?.full_name || '',
            phone: user.user_metadata?.phone || '',
            avatarUrl: user.user_metadata?.avatar_url || '',
          });
        }
      } finally {
        setProfileLoading(false);
      }
    };

    loadProfile();
  }, [user]);

  const userInitials = user?.email
    ? user.email.substring(0, 2).toUpperCase()
    : 'U';

  const userName = formData.fullName || user?.email?.split('@')[0] || 'Utilisateur';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setIsLoading(true);
    
    try {
      const profileData = {
        id: user.id,
        full_name: formData.fullName,
        phone: formData.phone,
        avatar_url: formData.avatarUrl,
      };

      const { error } = await supabase
        .from('host_profiles')
        .upsert(profileData, { onConflict: 'id' });

      if (error) {
        throw error;
      }

      toast.success('Profil mis à jour avec succès');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Erreur lors de la mise à jour du profil');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4 sm:space-y-6 px-3 sm:px-4 py-4 sm:py-6">
      <div className="flex items-center space-x-2 sm:space-x-3">
        <User className="h-6 w-6 sm:h-8 sm:w-8" />
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Mon Profil</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Gérez vos informations personnelles</p>
        </div>
      </div>

      <Card>
        <CardHeader className="px-4 sm:px-6 pt-4 sm:pt-6">
          <CardTitle className="text-lg sm:text-xl">Informations personnelles</CardTitle>
          <CardDescription className="text-sm sm:text-base">
            Mettez à jour vos informations de profil
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 sm:space-y-6 px-4 sm:px-6 pb-4 sm:pb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
            <Avatar className="h-16 w-16 sm:h-20 sm:w-20">
              <AvatarImage src={formData.avatarUrl} alt={userName} />
              <AvatarFallback className="bg-primary text-primary-foreground text-xl sm:text-2xl">
                {userInitials}
              </AvatarFallback>
            </Avatar>
            <Button variant="outline" className="flex items-center space-x-2 w-full sm:w-auto">
              <Camera className="h-4 w-4" />
              <span className="text-sm sm:text-base">Changer la photo</span>
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fullName">Nom complet</Label>
                <Input
                  id="fullName"
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => handleInputChange('fullName', e.target.value)}
                  placeholder="Votre nom complet"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Téléphone</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                placeholder="Votre numéro de téléphone"
              />
            </div>

            <Button type="submit" disabled={isLoading || profileLoading}>
              {isLoading ? 'Mise à jour...' : <><span className="hidden sm:inline">Sauvegarder les modifications</span><span className="sm:hidden">Sauvegarder</span></>}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};