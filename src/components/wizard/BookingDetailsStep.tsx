import { Calendar, Users, Hash } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { SafePopover, SafePopoverContent, SafePopoverTrigger } from '@/components/ui/safe-popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { BookingFormData, BookingFormUpdate } from '../BookingWizard';

interface BookingDetailsStepProps {
  formData: BookingFormData;
  updateFormData: (updates: BookingFormUpdate) => void;
  propertyId?: string; // Optionnel pour compatibilité avec BookingWizard
  bookingId?: string; // Optionnel pour compatibilité avec BookingWizard
}

export const BookingDetailsStep = ({ formData, updateFormData }: BookingDetailsStepProps) => {
  console.log('🟣 [PORTAL FIX] BookingDetailsStep chargé avec SafePopover (sans Portal) - Version du ' + new Date().toISOString());
  
  const handleCheckInChange = (date: Date | undefined) => {
    if (date) {
      // Utiliser le fuseau horaire local pour éviter les décalages
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      updateFormData({ checkInDate: `${year}-${month}-${day}` });
    }
  };

  const handleCheckOutChange = (date: Date | undefined) => {
    if (date) {
      // Utiliser le fuseau horaire local pour éviter les décalages
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      updateFormData({ checkOutDate: `${year}-${month}-${day}` });
    }
  };

  // ✅ CORRECTION : Ajout de l'heure pour éviter les problèmes de fuseau horaire
  const checkInDate = formData.checkInDate ? new Date(formData.checkInDate + 'T00:00:00') : undefined;
  const checkOutDate = formData.checkOutDate ? new Date(formData.checkOutDate + 'T00:00:00') : undefined;

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-xl sm:text-2xl font-semibold text-foreground mb-2">
          Informations de la réservation
        </h2>
        <p className="text-muted-foreground">
          Renseignez les détails de base de la réservation
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Check-in Date */}
        <div className="space-y-2">
          <Label htmlFor="checkin" className="text-sm font-medium">
            Date d'arrivée *
          </Label>
          <SafePopover key={`checkin-${formData.checkInDate}`}>
            <SafePopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !checkInDate && "text-muted-foreground"
                )}
              >
                <Calendar className="mr-2 h-4 w-4" />
                {checkInDate ? (
                  format(checkInDate, "dd MMMM yyyy", { locale: fr })
                ) : (
                  <span>Sélectionner une date</span>
                )}
              </Button>
            </SafePopoverTrigger>
            <SafePopoverContent className="w-auto p-0 z-[1500]" align="start">
              <CalendarComponent
                mode="single"
                selected={checkInDate}
                onSelect={handleCheckInChange}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </SafePopoverContent>
          </SafePopover>
        </div>

        {/* Check-out Date */}
        <div className="space-y-2">
          <Label htmlFor="checkout" className="text-sm font-medium">
            Date de départ *
          </Label>
          <SafePopover key={`checkout-${formData.checkOutDate}`}>
            <SafePopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !checkOutDate && "text-muted-foreground"
                )}
              >
                <Calendar className="mr-2 h-4 w-4" />
                {checkOutDate ? (
                  format(checkOutDate, "dd MMMM yyyy", { locale: fr })
                ) : (
                  <span>Sélectionner une date</span>
                )}
              </Button>
            </SafePopoverTrigger>
            <SafePopoverContent className="w-auto p-0 z-[1500]" align="start">
              <CalendarComponent
                mode="single"
                selected={checkOutDate}
                onSelect={handleCheckOutChange}
                disabled={(date) => 
                  checkInDate && date <= checkInDate
                }
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </SafePopoverContent>
          </SafePopover>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Number of Guests */}
        <div className="space-y-2">
          <Label htmlFor="guests" className="text-sm font-medium">
            Nombre de clients *
          </Label>
          <div className="relative">
            <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              id="guests"
              type="text"
              value={formData.numberOfGuests === 0 ? '' : formData.numberOfGuests.toString()}
              onChange={(e) => {
                const value = e.target.value;
                if (value === '') {
                  // Allow temporary 0 state for empty input
                  updateFormData({ numberOfGuests: 0 });
                  return;
                }
                const newCount = parseInt(value);
                if (!isNaN(newCount) && newCount >= 1 && newCount <= 10) {
                  updateFormData({ numberOfGuests: newCount });
                }
              }}
              onBlur={(e) => {
                // Ensure we have at least 1 when user leaves the field
                if (e.target.value === '' || parseInt(e.target.value) < 1) {
                  updateFormData({ numberOfGuests: 1 });
                }
              }}
              className="pl-10"
              placeholder="Nombre de clients"
            />
          </div>
        </div>

        {/* Booking Reference */}
        <div className="space-y-2">
          <Label htmlFor="reference" className="text-sm font-medium">
            Référence de réservation
          </Label>
          <div className="relative">
            <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              id="reference"
              value={formData.bookingReference}
              onChange={(e) => updateFormData({ bookingReference: e.target.value })}
              className="pl-10"
              placeholder="Ex: AIR123456 (optionnel)"
            />
          </div>
        </div>
      </div>

      {/* Summary */}
      {formData.checkInDate && formData.checkOutDate && (
        <div className="bg-muted/50 rounded-lg p-4 mt-6">
          <h3 className="font-medium text-foreground mb-2">Résumé de la réservation</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Arrivée:</span>
              <p className="font-medium">{format(new Date(formData.checkInDate), "dd/MM/yyyy")}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Départ:</span>
              <p className="font-medium">{format(new Date(formData.checkOutDate), "dd/MM/yyyy")}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Durée:</span>
              <p className="font-medium">
                {Math.ceil((new Date(formData.checkOutDate).getTime() - new Date(formData.checkInDate).getTime()) / (1000 * 60 * 60 * 24))} nuit(s)
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Clients:</span>
              <p className="font-medium">{formData.numberOfGuests}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};