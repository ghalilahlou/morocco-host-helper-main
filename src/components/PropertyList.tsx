import { useState } from 'react';
import { Home, Plus, Edit, MapPin, Users, MoreVertical, Calendar, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Property } from '@/types/booking';
import { useProperties } from '@/hooks/useProperties';
import { useBookings } from '@/hooks/useBookings';
import { CreatePropertyDialog } from './CreatePropertyDialog';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { useT } from '@/i18n/GuestLocaleProvider';
interface PropertyListProps {
  onPropertySelect: (property: Property) => void;
}
export const PropertyList = ({
  onPropertySelect
}: PropertyListProps) => {
  const t = useT();
  const {
    properties,
    isLoading,
    deleteProperty,
    refreshProperties
  } = useProperties();
  const {
    bookings
  } = useBookings();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [propertyToDelete, setPropertyToDelete] = useState<Property | null>(null);
  const {
    toast
  } = useToast();
  const isMobile = useIsMobile();
  const getPropertyStats = (propertyId: string, property: Property) => {
    const propertyBookings = bookings.filter(booking => booking.property_id === propertyId);
    return {
      total: propertyBookings.length,
      pending: propertyBookings.filter(b => b.status === 'pending').length,
      completed: propertyBookings.filter(b => b.status === 'completed').length,
      hasAirbnbSync: false // TODO: Ajouter le champ airbnb_ics_url au type Property si nécessaire
    };
  };
  const handleDeleteProperty = async () => {
    if (!propertyToDelete) return;
    console.log('Attempting to delete property:', propertyToDelete.id);
    await deleteProperty(propertyToDelete.id);
    setDeleteConfirmOpen(false);
    setPropertyToDelete(null);
  };
  if (isLoading) {
    return <div className="space-y-4">
        {[1, 2, 3].map(i => <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                  <div className="h-12 w-12 bg-muted rounded-lg" />
                  <div className="space-y-2">
                    <div className="h-5 bg-muted rounded w-32" />
                    <div className="h-4 bg-muted rounded w-24" />
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="h-4 bg-muted rounded w-16" />
                  <div className="h-4 bg-muted rounded w-16" />
                  <div className="h-4 bg-muted rounded w-16" />
                  <div className="h-8 bg-muted rounded w-8" />
                </div>
              </div>
            </CardContent>
          </Card>)}
      </div>;
  }
  if (properties.length === 0) {
    return <>
        <div className="flex flex-col items-center gap-8 p-12 text-center">
          <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center">
            <Home className="h-10 w-10 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl sm:text-2xl font-semibold">Aucune propriété</h2>
            <p className="text-muted-foreground max-w-md">
              Créez votre première propriété pour commencer à gérer vos réservations et documents de conformité.
            </p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)} size="lg" className="gap-2">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Ajouter une propriété</span>
            <span className="sm:hidden">Ajouter</span>
          </Button>
        </div>
        
        <CreatePropertyDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} onSuccess={refreshProperties} />
      </>;
  }
  return <>
      <div className="space-y-6">
        {/* Header selon modèle Figma */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl font-bold text-black">{t('properties.title')}</h1>
            {isMobile ? (
              <Button 
                onClick={() => setShowCreateDialog(true)} 
                className="h-12 w-12 p-0 rounded-xl bg-[#0BD9D0] hover:bg-[#0BD9D0]/90 text-white shadow-lg"
                aria-label={t('properties.addPropertyAria')}
              >
              <Plus className="h-6 w-6" />
              </Button>
            ) : (
              <Button 
                onClick={() => setShowCreateDialog(true)} 
                size="sm" 
                className="gap-2 h-10 px-4 bg-[#0BD9D0] hover:bg-[#0BD9D0]/90 text-white rounded-full"
              >
              <Plus className="h-4 w-4" />
              <span>{t('properties.add')}</span>
              </Button>
            )}
        </div>

        {/* Liste des propriétés en cartes selon modèle Figma */}
        <div className="space-y-4">
              {properties.map(property => {
              const stats = getPropertyStats(property.id, property);
            return (
              <div
                key={property.id}
                onClick={() => onPropertySelect(property)}
                className="bg-white rounded-2xl shadow-sm border border-gray-200/50 p-4 md:p-6 hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="flex items-center justify-between gap-4">
                  {/* Partie gauche : Icône + Nom + Localisation */}
                  <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0">
                    {/* Icône propriété */}
                    {property.photo_url ? (
                      <div className="w-12 h-12 md:w-16 md:h-16 bg-[#E0F2F7] rounded-xl overflow-hidden flex-shrink-0">
                              <img src={property.photo_url} alt={property.name} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-12 h-12 md:w-16 md:h-16 bg-[#E0F2F7] rounded-xl flex items-center justify-center flex-shrink-0">
                        <Home className="w-6 h-6 md:w-8 md:h-8 text-white" />
                      </div>
                    )}
                    
                    {/* Nom et localisation */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-black text-base md:text-lg truncate">{property.name}</h3>
                      <div className="flex items-center gap-1.5 mt-1">
                        <MapPin className="w-4 h-4 text-gray-600 flex-shrink-0" />
                        <span className="text-sm text-gray-600 truncate">
                          {property.address?.split(',')[0]?.trim() || t('properties.addressUnspecified')}
                        </span>
                           </div>
                         </div>
                       </div>

                  {/* Partie droite : Bouton Accéder + Menu */}
                  <div className="flex items-center gap-2 md:gap-3 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    {isMobile ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onPropertySelect(property);
                        }}
                        className="h-9 w-9 p-0"
                        aria-label={t('properties.accessCalendarAria')}
                      >
                        <Calendar className="w-5 h-5 text-gray-700" />
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onPropertySelect(property);
                        }}
                        className="gap-2 rounded-full border-gray-300 bg-white hover:bg-gray-50 text-gray-900 h-9 px-4"
                        aria-label={t('properties.accessCalendarAria')}
                      >
                        <Calendar className="w-4 h-4 text-gray-700" />
                        <span className="text-sm font-medium">{t('properties.access')}</span>
                      </Button>
                    )}
                    
                    {/* Menu trois points */}
                         <DropdownMenu>
                           <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={(e) => e.stopPropagation()} 
                          className="h-9 w-9 p-0 hover:bg-gray-100"
                        >
                          <MoreVertical className="w-5 h-5 text-gray-700" />
                             </Button>
                           </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 bg-white z-50">
                        <DropdownMenuItem 
                          onClick={(e) => {
                           e.stopPropagation();
                           setEditingProperty(property);
                           setShowCreateDialog(true);
                          }} 
                          className="gap-2 hover:bg-[#0BD9D0] hover:text-white focus:bg-[#0BD9D0] focus:text-white"
                        >
                          <Edit className="w-4 h-4" />
                               {t('properties.edit')}
                             </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={(e) => {
                           e.stopPropagation();
                           setPropertyToDelete(property);
                           setDeleteConfirmOpen(true);
                          }} 
                          className="gap-2 text-red-600 focus:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                               {t('properties.delete')}
                             </DropdownMenuItem>
                           </DropdownMenuContent>
                         </DropdownMenu>
                       </div>
                         </div>
                       </div>
            );
            })}
        </div>
      </div>

      <CreatePropertyDialog open={showCreateDialog || !!editingProperty} onOpenChange={open => {
      setShowCreateDialog(open);
      if (!open) setEditingProperty(null);
    }} property={editingProperty || undefined} onSuccess={refreshProperties} />

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Êtes-vous sûr ?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                Voulez-vous vraiment supprimer la propriété "{propertyToDelete?.name}" ?
              </p>
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-red-800 text-sm font-medium">
                  ⚠️ ATTENTION : Cette action supprimera définitivement :
                </p>
                <ul className="text-red-700 text-sm mt-2 space-y-1">
                  <li>• La propriété et toutes ses informations</li>
                  <li>• Toutes les réservations associées</li>
                  <li>• Tous les invités et leurs documents</li>
                  <li>• Les contrats signés et formulaires de police</li>
                  <li>• L'historique Airbnb synchronisé</li>
                </ul>
                <p className="text-red-800 text-sm font-medium mt-2">
                  Cette action ne peut pas être annulée !
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteProperty} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>;
};