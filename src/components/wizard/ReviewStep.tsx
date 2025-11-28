import { Calendar, Users, MapPin, FileText, Download, Eye, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BookingFormData, BookingFormUpdate } from '../BookingWizard';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { DocumentPreviewDialog } from './DocumentPreviewDialog';

interface ReviewStepProps {
  formData: BookingFormData;
  updateFormData: (updates: BookingFormUpdate) => void;
  bookingId?: string; // ✅ NOUVEAU : ID de la réservation si elle est déjà créée (mode édition)
  propertyId: string; // ✅ REQUIS pour générer les documents via Edge Function
}

export const ReviewStep = ({ formData, bookingId, propertyId }: ReviewStepProps) => {
  useEffect(() => {
    console.log('✨ [ReviewStep] Mounted');
    return () => console.log('🗑️ [ReviewStep] Unmounted');
  }, []);
  console.log('🔄 [ReviewStep] Rendered - Version du ' + new Date().toISOString());
  const { toast } = useToast();
  const [previewDocument, setPreviewDocument] = useState<'police' | 'contract' | null>(null);
  const calculateNights = () => {
    if (!formData.checkInDate || !formData.checkOutDate) return 0;
    const checkIn = new Date(formData.checkInDate);
    const checkOut = new Date(formData.checkOutDate);
    return Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Date non renseignée';
    
    const date = new Date(dateString);
    // Check if the date is valid
    if (isNaN(date.getTime())) {
      return 'Date invalide';
    }
    
    try {
      return format(date, "dd MMMM yyyy", { locale: fr });
    } catch (error) {
      console.error('Date formatting error:', error, 'for date:', dateString);
      return 'Date invalide';
    }
  };

  // ✅ NOUVEAU : Fonction pour visualiser les documents AVANT création
  const handlePreviewDocument = (documentType: 'police' | 'contract') => {
    // Vérifier que nous avons les données nécessaires
    if (!formData.checkInDate || !formData.checkOutDate || formData.guests.length === 0) {
      toast({
        title: "Données incomplètes",
        description: "Veuillez renseigner les dates et ajouter au moins un client pour prévisualiser les documents.",
        variant: "destructive"
      });
      return;
    }

    setPreviewDocument(documentType);
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-xl sm:text-2xl font-semibold text-foreground mb-2">
          Vérification et finalisation
        </h2>
        <p className="text-muted-foreground">
          Vérifiez toutes les informations avant de créer la réservation
        </p>
      </div>

      {/* Booking Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Calendar className="w-5 h-5" />
            <span>Détails de la réservation</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Arrivée</p>
              <p className="font-medium">{formatDate(formData.checkInDate)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Départ</p>
              <p className="font-medium">{formatDate(formData.checkOutDate)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Durée</p>
              <p className="font-medium">{calculateNights()} nuit(s)</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Clients</p>
              <p className="font-medium">{formData.numberOfGuests}</p>
            </div>
          </div>
          
          {formData.bookingReference && (
            <div>
              <p className="text-sm text-muted-foreground">Référence</p>
              <p className="font-medium">{formData.bookingReference}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Property Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <MapPin className="w-5 h-5" />
            <span>Propriété</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-2">Adresse de la propriété</p>
          <p className="font-medium">
            Résidence Myramar, étage 4, appartement 21, rue Abda, angle Sidi Mohamed Ben Abdellah, Casablanca
          </p>
        </CardContent>
      </Card>

      {/* Guests Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="w-5 h-5" />
            <span>Clients ({formData.guests.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {formData.guests.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              Aucun client enregistré
            </p>
          ) : (
            <div className="space-y-3">
              {formData.guests.map((guest, index) => (
                <div key={guest.id} className="border border-border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center space-x-2">
                        <h4 className="font-medium">Client {index + 1}</h4>
                        <Badge variant="outline" className="text-xs">
                          {guest.documentType === 'passport' ? 'Passeport' : 'Carte d\'identité'}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-muted-foreground">Nom complet</p>
                          <p className="font-medium">{guest.fullName}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Nationalité</p>
                          <p className="font-medium">{guest.nationality}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Date de naissance</p>
                          <p className="font-medium">
                            {guest.dateOfBirth ? formatDate(guest.dateOfBirth) : 'Non renseignée'}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Numéro de document</p>
                          <p className="font-medium">{guest.documentNumber}</p>
                        </div>
                        {guest.placeOfBirth && (
                          <div className="md:col-span-2">
                            <p className="text-muted-foreground">Lieu de naissance</p>
                            <p className="font-medium">{guest.placeOfBirth}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Documents to Generate */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="w-5 h-5" />
            <span>Documents à générer</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Fiche de Police */}
            <div className="flex items-center justify-between p-3 border border-border rounded-lg bg-gradient-to-r from-blue-50/50 to-transparent hover:from-blue-50 transition-colors">
              <div className="flex-1">
                <p className="font-medium">Fiches d'arrivée (Police)</p>
                <p className="text-sm text-muted-foreground">
                  {formData.guests.length} fiche(s) - Une par client
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePreviewDocument('police')}
                  disabled={formData.guests.length === 0}
                  className="border-blue-200 hover:border-blue-300 hover:bg-blue-50"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Aperçu
                </Button>
                <Badge variant="outline" className="bg-white">
                  <Download className="w-3 h-3 mr-1" />
                  PDF
                </Badge>
              </div>
            </div>
            
            {/* Contrat de Location */}
            <div className="flex items-center justify-between p-3 border border-border rounded-lg bg-gradient-to-r from-green-50/50 to-transparent hover:from-green-50 transition-colors">
              <div className="flex-1">
                <p className="font-medium">Contrat de location</p>
                <p className="text-sm text-muted-foreground">
                  Contrat standard pour location meublée
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePreviewDocument('contract')}
                  disabled={formData.guests.length === 0}
                  className="border-green-200 hover:border-green-300 hover:bg-green-50"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Aperçu
                </Button>
                <Badge variant="outline" className="bg-white">
                  <Download className="w-3 h-3 mr-1" />
                  PDF
                </Badge>
              </div>
            </div>
          </div>
          
          <div className="mt-4 p-4 bg-muted/50 rounded-lg">
            <h4 className="font-medium mb-2">Informations importantes</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Les documents seront générés immédiatement après la création</li>
              <li>• Les fiches police doivent être remises aux autorités locales</li>
              <li>• Le contrat doit être signé par les clients à l'arrivée</li>
              <li>• Tous les documents respectent la réglementation marocaine</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Validation Messages */}
      {formData.guests.length === 0 && (
        <div className="bg-warning/10 border border-warning/20 rounded-lg p-4">
          <p className="text-warning font-medium">Attention</p>
          <p className="text-sm text-warning/80">
            Aucun client n'a été enregistré. Vous pourrez ajouter les clients plus tard et générer les documents.
          </p>
        </div>
      )}

      {formData.guests.length > 0 && formData.guests.length !== formData.numberOfGuests && (
        <div className="bg-warning/10 border border-warning/20 rounded-lg p-4">
          <p className="text-warning font-medium">Nombre de clients incomplet</p>
          <p className="text-sm text-warning/80">
            {formData.guests.length} client(s) enregistré(s) sur {formData.numberOfGuests} attendu(s).
            Vous pourrez compléter les informations plus tard.
          </p>
        </div>
      )}

      {/* Document Preview Dialog */}
      {previewDocument && (
        <DocumentPreviewDialog
          isOpen={!!previewDocument}
          onClose={() => setPreviewDocument(null)}
          documentType={previewDocument}
          formData={formData}
          propertyId={propertyId}
        />
      )}
    </div>
  );
};