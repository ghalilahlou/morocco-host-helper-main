import { useState } from 'react';
import { Home, Plus, Edit, MapPin, Users, MoreVertical, Calendar, FileText, Trash2, Grid3X3, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Property } from '@/types/booking';
import { useProperties } from '@/hooks/useProperties';
import { useBookings } from '@/hooks/useBookings';
import { CreatePropertyDialog } from './CreatePropertyDialog';
import { useToast } from '@/hooks/use-toast';
interface PropertyListProps {
  onPropertySelect: (property: Property) => void;
}
export const PropertyList = ({
  onPropertySelect
}: PropertyListProps) => {
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
  const getPropertyStats = (propertyId: string, property: Property) => {
    const propertyBookings = bookings.filter(booking => booking.propertyId === propertyId);
    return {
      total: propertyBookings.length,
      pending: propertyBookings.filter(b => b.status === 'pending').length,
      completed: propertyBookings.filter(b => b.status === 'completed').length,
      hasAirbnbSync: !!property.airbnb_ics_url
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold">Mes annonces</h1>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={() => setShowCreateDialog(true)} size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              <span className="hidden md:inline">Ajouter</span>
            </Button>
          </div>
        </div>

        <div className="bg-white rounded-lg border shadow-sm">
          <div className="w-full">
            <Table className="w-full">
              <TableHeader>
                <TableRow className="border-b bg-gray-50/50">
                  <TableHead className="font-semibold text-gray-900 py-2 sm:py-4 px-2 sm:px-3 md:px-6 text-xs sm:text-sm">Annonce</TableHead>
                  <TableHead className="font-semibold text-gray-900 py-2 sm:py-4 px-2 sm:px-3 md:px-6 hidden sm:table-cell"></TableHead>
                  <TableHead className="font-semibold text-gray-900 py-2 sm:py-4 px-2 sm:px-3 md:px-6 text-xs sm:text-sm">Lieu</TableHead>
                  <TableHead className="font-semibold text-gray-900 py-2 sm:py-4 px-2 sm:px-3 md:px-6 text-xs sm:text-sm hidden md:table-cell">Capacité</TableHead>
                  <TableHead className="py-2 sm:py-4 px-2 sm:px-3 md:px-6 w-20"></TableHead>
                </TableRow>
              </TableHeader>
            <TableBody>
              {properties.map(property => {
              const stats = getPropertyStats(property.id, property);
              const isActive = stats.total > 0 || stats.hasAirbnbSync;
              return <TableRow key={property.id} className="hover:bg-gray-50/50 transition-colors cursor-pointer relative" onClick={() => onPropertySelect(property)}>
                    <TableCell className="py-2 sm:py-4 md:py-6 px-2 sm:px-3 md:px-6">
                      <div className="flex items-center gap-1 sm:gap-2 md:gap-4">
                         {property.photo_url ? <div className="w-8 h-6 sm:w-12 sm:h-8 md:w-16 md:h-12 bg-gradient-to-br from-primary/20 to-primary/10 rounded-lg overflow-hidden flex-shrink-0">
                              <img src={property.photo_url} alt={property.name} className="w-full h-full object-cover" />
                            </div> : <div className="w-8 h-6 sm:w-12 sm:h-8 md:w-16 md:h-12 bg-gradient-to-br from-primary/20 to-primary/10 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                              <Home className="w-3 h-3 sm:w-4 sm:h-4 md:w-6 md:h-6 text-primary" />
                            </div>}
                         <div className="min-w-0 flex-1">
                           <div className="font-semibold text-gray-900 text-xs sm:text-sm md:text-base truncate">{property.name}</div>
                           <div className="sm:hidden flex items-center gap-1 text-xs text-gray-600 mt-1">
                             <MapPin className="w-3 h-3 text-gray-400 flex-shrink-0" />
                             <span className="truncate">{property.address?.split(',')[0]?.trim() || 'Non spécifié'}</span>
                           </div>
                         </div>
                       </div>
                     </TableCell>
                     
                     <TableCell className="py-2 sm:py-4 md:py-6 px-2 sm:px-3 md:px-6 hidden sm:table-cell">
                     </TableCell>
                     
                     <TableCell className="py-2 sm:py-4 md:py-6 px-2 sm:px-3 md:px-6 hidden sm:table-cell">
                       <div className="flex items-center gap-1 md:gap-2">
                         <MapPin className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 text-gray-400 flex-shrink-0" />
                         <span className="text-gray-600 text-xs sm:text-sm md:text-base truncate">{property.address?.split(',')[0]?.trim() || 'Non spécifié'}</span>
                       </div>
                     </TableCell>
                     
                     <TableCell className="py-2 sm:py-4 md:py-6 px-2 sm:px-3 md:px-6 hidden md:table-cell">
                       <div className="flex items-center gap-1 md:gap-2">
                         <Users className="w-3 h-3 md:w-4 md:h-4 text-gray-400 flex-shrink-0" />
                         <span className="text-gray-600 font-medium text-xs sm:text-sm md:text-base">{property.max_occupancy}</span>
                       </div>
                     </TableCell>
                     
                     <TableCell className="py-2 sm:py-4 md:py-6 px-2 sm:px-3 md:px-6 relative">
                       <div className="absolute top-1 sm:top-2 right-1 sm:right-2">
                         <DropdownMenu>
                           <DropdownMenuTrigger asChild>
                             <Button variant="ghost" size="sm" onClick={e => e.stopPropagation()} className="w-5 h-5 sm:w-6 sm:h-6 p-0 hover:bg-gray-100">
                               <MoreVertical className="w-3 h-3 sm:w-3 sm:h-3 md:w-4 md:h-4" />
                             </Button>
                           </DropdownMenuTrigger>
                           <DropdownMenuContent align="end" className="w-40 sm:w-48 bg-white z-50">
                             <DropdownMenuItem onClick={e => {
                           e.stopPropagation();
                           setEditingProperty(property);
                           setShowCreateDialog(true);
                         }} className="gap-2 hover:bg-[hsl(var(--teal-hover))] hover:text-white focus:bg-[hsl(var(--teal-hover))] focus:text-white text-xs sm:text-sm">
                               <Edit className="w-3 h-3 sm:w-4 sm:h-4" />
                               Modifier
                             </DropdownMenuItem>
                             <DropdownMenuItem onClick={e => {
                           e.stopPropagation();
                           setPropertyToDelete(property);
                           setDeleteConfirmOpen(true);
                         }} className="gap-2 text-red-600 focus:text-red-600 text-xs sm:text-sm">
                               <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                               Supprimer
                             </DropdownMenuItem>
                           </DropdownMenuContent>
                         </DropdownMenu>
                       </div>
                       <div className="flex items-center justify-end pr-8 sm:pr-12 md:pr-20">
                         <Button variant="outline" size="sm" onClick={e => {
                       e.stopPropagation();
                       onPropertySelect(property);
                     }} className="gap-1 text-foreground hover:bg-[hsl(var(--teal-hover))] hover:text-white text-xs px-2 py-1">
                           <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
                           <span className="hidden sm:inline text-xs">Accéder</span>
                         </Button>
                         <div className="sm:hidden flex items-center ml-2 text-xs text-gray-600">
                           <Users className="w-3 h-3 text-gray-400 mr-1" />
                           {property.max_occupancy}
                         </div>
                       </div>
                     </TableCell>
                  </TableRow>;
            })}
            </TableBody>
            </Table>
          </div>
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