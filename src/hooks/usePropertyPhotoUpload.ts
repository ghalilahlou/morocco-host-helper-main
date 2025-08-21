import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export const usePropertyPhotoUpload = () => {
  const [uploading, setUploading] = useState(false);
  const { user } = useAuth();

  const uploadPhoto = async (file: File): Promise<string | null> => {
    if (!user) {
      toast.error('User not authenticated');
      return null;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Veuillez sélectionner un fichier image');
      return null;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Le fichier est trop volumineux. Taille maximum: 5MB');
      return null;
    }

    setUploading(true);

    try {
      // Create unique file path
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('property-photos')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('Upload error:', error);
        toast.error('Erreur lors de l\'upload de la photo');
        return null;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('property-photos')
        .getPublicUrl(data.path);

      toast.success('Photo uploadée avec succès');
      return publicUrl;
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Erreur lors de l\'upload de la photo');
      return null;
    } finally {
      setUploading(false);
    }
  };

  const deletePhoto = async (photoUrl: string): Promise<boolean> => {
    if (!user || !photoUrl) return false;

    try {
      // Extract path from URL
      const url = new URL(photoUrl);
      const pathParts = url.pathname.split('/');
      const filePath = pathParts.slice(-2).join('/'); // user_id/filename

      const { error } = await supabase.storage
        .from('property-photos')
        .remove([filePath]);

      if (error) {
        console.error('Delete error:', error);
        toast.error('Erreur lors de la suppression de la photo');
        return false;
      }

      toast.success('Photo supprimée');
      return true;
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Erreur lors de la suppression de la photo');
      return false;
    }
  };

  return {
    uploadPhoto,
    deletePhoto,
    uploading
  };
};
