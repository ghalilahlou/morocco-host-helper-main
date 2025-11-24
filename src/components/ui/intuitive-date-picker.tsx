import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion'; // ✅ AnimatePresence retiré
import { MapPin, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { format, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { EnhancedCalendar } from './enhanced-calendar';

interface IntuitiveBookingPickerProps {
  checkInDate?: Date;
  checkOutDate?: Date;
  onDatesChange?: (checkIn: Date, checkOut: Date) => void;
  numberOfGuests?: number;
  onGuestsChange?: (guests: number) => void;
  propertyName?: string;
  className?: string;
}

type PickerStep = 'dates' | 'guests';

export const IntuitiveBookingPicker: React.FC<IntuitiveBookingPickerProps> = ({
  checkInDate,
  checkOutDate,
  onDatesChange,
  numberOfGuests = 1,
  onGuestsChange,
  propertyName = "Hébergement",
  className
}) => {
  const [step, setStep] = useState<PickerStep>('dates');
  const [tempCheckIn, setTempCheckIn] = useState<Date | undefined>(checkInDate);
  const [tempCheckOut, setTempCheckOut] = useState<Date | undefined>(checkOutDate);
  const [tempGuests, setTempGuests] = useState(numberOfGuests);
  const [showCalendar, setShowCalendar] = useState(true); // Toujours affiché maintenant

  // ✅ NOUVEAU : Synchroniser les états internes avec les props quand elles changent
  useEffect(() => {
    if (checkInDate) {
      console.log('📅 IntuitiveBookingPicker: checkInDate reçu:', checkInDate.toISOString());
      setTempCheckIn(checkInDate);
    }
  }, [checkInDate]);

  useEffect(() => {
    if (checkOutDate) {
      console.log('📅 IntuitiveBookingPicker: checkOutDate reçu:', checkOutDate.toISOString());
      setTempCheckOut(checkOutDate);
    }
  }, [checkOutDate]);

  useEffect(() => {
    setTempGuests(numberOfGuests);
  }, [numberOfGuests]);

  const nights = tempCheckIn && tempCheckOut ? differenceInDays(tempCheckOut, tempCheckIn) : 0;

  // Gestion directe du calendrier unifié
  const handleCalendarSelect = (start: Date, end: Date) => {
    setTempCheckIn(start);
    setTempCheckOut(end);

    if (start && end) {
      // Avancer automatiquement à l'étape des invités
      setStep('guests');
    }
  };

  useEffect(() => {
    if (tempCheckIn && tempCheckOut) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const checkInStartOfDay = new Date(tempCheckIn);
      checkInStartOfDay.setHours(0, 0, 0, 0);
      const checkOutStartOfDay = new Date(tempCheckOut);
      checkOutStartOfDay.setHours(0, 0, 0, 0);

      if (checkInStartOfDay < today) return;
      if (checkOutStartOfDay <= checkInStartOfDay) return;

      onDatesChange?.(tempCheckIn, tempCheckOut);
    }
  }, [tempCheckIn, tempCheckOut, onDatesChange]);

  const updateGuests = (value: number) => {
    setTempGuests(value);
    onGuestsChange?.(value);
  };

  const progressSteps: PickerStep[] = ['dates', 'guests'];

  return (
    <div className={cn("max-w-md mx-auto", className)}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden"
      >
        {/* Header avec progression */}
        <div className="bg-brand-teal p-6 text-white">
          <motion.div className="flex items-center gap-3 mb-4">
            <MapPin className="w-5 h-5" />
            <span className="font-medium">{propertyName}</span>
          </motion.div>
          
          <div className="flex justify-between items-center">
            {progressSteps.map((stepName, index) => (
              <div key={stepName} className="flex items-center">
                <motion.div
                  animate={{
                    backgroundColor: 
                      step === stepName ? '#ffffff' :
                      progressSteps.indexOf(step) > index ? '#10b981' : 
                      'rgba(255,255,255,0.3)'
                  }}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                >
                  {progressSteps.indexOf(step) > index ? (
                    <Check className="w-4 h-4 text-white" />
                  ) : (
                    <span className={step === stepName ? 'text-primary' : 'text-white'}>
                      {index + 1}
                    </span>
                  )}
                </motion.div>
                {index < progressSteps.length - 1 && <div className="w-6 h-px bg-white/30 mx-2" />}
              </div>
            ))}
          </div>
        </div>

        {/* Contenu principal */}
        <div className="p-6">
          {/* ✅ CORRIGÉ : Retirer AnimatePresence qui cause des conflits */}
            {/* Étape 1: Sélection dates */}
            {step === 'dates' && (
              <div
                key="dates"
                className="space-y-6"
              >
                <div className="text-center">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    Quand souhaitez-vous séjourner ?
                  </h3>
                  <p className="text-gray-600">
                    Choisissez vos dates d'arrivée et de départ
                  </p>
                </div>

                {/* Résumé des dates sélectionnées */}
                {tempCheckIn && tempCheckOut && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-4 bg-gradient-to-r from-brand-green/10 to-brand-turquoise/10 rounded-xl border border-brand-green/20"
                  >
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="font-medium text-gray-900">
                          {format(tempCheckIn, 'dd MMMM yyyy', { locale: fr })} → {format(tempCheckOut, 'dd MMMM yyyy', { locale: fr })}
                        </div>
                        <div className="text-sm text-gray-600">
                          {nights} nuit{nights > 1 ? 's' : ''} à {propertyName}
                        </div>
                      </div>
                      <Check className="w-5 h-5 text-brand-green" />
                    </div>
                  </motion.div>
                )}

                {/* Calendrier direct intégré */}
                <div className="space-y-4">
                  <EnhancedCalendar
                    mode="range"
                    rangeStart={tempCheckIn}
                    rangeEnd={tempCheckOut}
                    onRangeSelect={handleCalendarSelect}
                    minDate={new Date()}
                    className="w-full"
                  />
                </div>
              </div>
            )}

            {/* Étape 2: Nombre d'invités */}
            {step === 'guests' && (
              <div
                key="guests"
                className="space-y-6"
              >
                <div className="text-center">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    Combien d'invités ?
                  </h3>
                  <p className="text-gray-600">
                    Indiquez le nombre total de personnes
                  </p>
                </div>

                {/* Résumé des dates sélectionnées */}
                {tempCheckIn && tempCheckOut && (
                  <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-blue-900">
                          {format(tempCheckIn, 'dd MMMM', { locale: fr })} → {format(tempCheckOut, 'dd MMMM', { locale: fr })}
                        </div>
                        <div className="text-sm text-blue-700">
                          {nights} nuit{nights > 1 ? 's' : ''}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setStep('dates')}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        Modifier
                      </Button>
                    </div>
                  </div>
                )}

                {/* Sélecteur d'invités */}
                <div className="flex items-center justify-center">
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => tempGuests > 1 && updateGuests(tempGuests - 1)}
                    disabled={tempGuests <= 1}
                    className="w-12 h-12 rounded-full bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-xl font-bold text-gray-700"
                  >
                    -
                  </motion.button>
                  
                  <motion.div
                    key={tempGuests}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="mx-8 text-center"
                  >
                    <div className="text-4xl font-bold text-gray-900">{tempGuests}</div>
                    <div className="text-sm text-gray-600">
                      {tempGuests === 1 ? 'invité' : 'invités'}
                    </div>
                  </motion.div>
                  
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => tempGuests < 20 && updateGuests(tempGuests + 1)}
                    disabled={tempGuests >= 20}
                    className="w-12 h-12 rounded-full bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-xl font-bold text-gray-700"
                  >
                    +
                  </motion.button>
                </div>
              </div>
            )}
        </div>
      </motion.div>


    </div>
  );
};
