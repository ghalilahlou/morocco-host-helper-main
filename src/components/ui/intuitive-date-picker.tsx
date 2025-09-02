import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Clock, MapPin, Users, ArrowRight, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { format, differenceInDays, addDays, isSameDay } from 'date-fns';
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

export const IntuitiveBookingPicker: React.FC<IntuitiveBookingPickerProps> = ({
  checkInDate,
  checkOutDate,
  onDatesChange,
  numberOfGuests = 1,
  onGuestsChange,
  propertyName = "Hébergement",
  className
}) => {
  const [step, setStep] = useState<'dates' | 'guests' | 'summary'>('dates');
  const [tempCheckIn, setTempCheckIn] = useState<Date | undefined>(checkInDate);
  const [tempCheckOut, setTempCheckOut] = useState<Date | undefined>(checkOutDate);
  const [tempGuests, setTempGuests] = useState(numberOfGuests);
  const [showCalendar, setShowCalendar] = useState(true); // Toujours affiché maintenant

  const nights = tempCheckIn && tempCheckOut ? differenceInDays(tempCheckOut, tempCheckIn) : 0;

  // Gestion directe du calendrier unifié
  const handleCalendarSelect = (start: Date, end: Date) => {
    setTempCheckIn(start);
    setTempCheckOut(end);
    // Ne pas changer d'étape automatiquement, laisser l'utilisateur cliquer sur "Continuer"
  };

  const handleConfirm = () => {
    if (tempCheckIn && tempCheckOut) {
      // ✅ CORRECTION: Validation avant confirmation
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const checkInStartOfDay = new Date(tempCheckIn);
      checkInStartOfDay.setHours(0, 0, 0, 0);
      const checkOutStartOfDay = new Date(tempCheckOut);
      checkOutStartOfDay.setHours(0, 0, 0, 0);

      // Vérifications de base
      if (checkInStartOfDay < today) {
        return; // Date passée non autorisée
      }

      if (checkOutStartOfDay <= checkInStartOfDay) {
        return; // Date de départ doit être après l'arrivée
      }

      onDatesChange?.(tempCheckIn, tempCheckOut);
      onGuestsChange?.(tempGuests);
      setStep('summary');
    }
  };

  const handleEdit = () => {
    setStep('dates');
  };

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
            {['checkin', 'checkout', 'guests', 'summary'].map((stepName, index) => (
              <div key={stepName} className="flex items-center">
                <motion.div
                  animate={{
                    backgroundColor: 
                      step === stepName ? '#ffffff' :
                      ['checkin', 'checkout', 'guests', 'summary'].indexOf(step) > index ? '#10b981' : 
                      'rgba(255,255,255,0.3)'
                  }}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                >
                  {['checkin', 'checkout', 'guests', 'summary'].indexOf(step) > index ? (
                    <Check className="w-4 h-4 text-white" />
                  ) : (
                    <span className={step === stepName ? 'text-primary' : 'text-white'}>
                      {index + 1}
                    </span>
                  )}
                </motion.div>
                {index < 3 && <div className="w-6 h-px bg-white/30 mx-2" />}
              </div>
            ))}
          </div>
        </div>

        {/* Contenu principal */}
        <div className="p-6">
          <AnimatePresence mode="wait">
            {/* Étape 1: Sélection dates */}
            {step === 'dates' && (
              <motion.div
                key="dates"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
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
                  
                  {tempCheckIn && tempCheckOut && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex justify-center"
                    >
                      <Button 
                        onClick={() => setStep('guests')}
                        className="px-8 py-3 bg-brand-teal text-white rounded-xl font-medium hover:bg-brand-teal/90 transition-all duration-200"
                      >
                        Continuer
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Étape 2: Nombre d'invités */}
            {step === 'guests' && (
              <motion.div
                key="guests"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
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
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-blue-50 p-4 rounded-xl border border-blue-200"
                  >
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
                  </motion.div>
                )}

                {/* Sélecteur d'invités */}
                <div className="flex items-center justify-center">
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => tempGuests > 1 && setTempGuests(tempGuests - 1)}
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
                    onClick={() => tempGuests < 20 && setTempGuests(tempGuests + 1)}
                    disabled={tempGuests >= 20}
                    className="w-12 h-12 rounded-full bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-xl font-bold text-gray-700"
                  >
                    +
                  </motion.button>
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleConfirm}
                  className="w-full p-4 bg-brand-green text-white rounded-xl font-medium hover:bg-brand-green/90 transition-all duration-200"
                >
                  Confirmer la réservation
                </motion.button>
              </motion.div>
            )}

            {/* Étape 3: Résumé */}
            {step === 'summary' && (
              <motion.div
                key="summary"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: "spring" }}
                    className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4"
                  >
                    <Check className="w-8 h-8 text-emerald-600" />
                  </motion.div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    Parfait !
                  </h3>
                  <p className="text-gray-600">
                    Votre réservation est configurée
                  </p>
                </div>

                {/* Résumé de la réservation */}
                <div className="bg-gray-50 p-6 rounded-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Dates</span>
                    <span className="font-medium">
                      {tempCheckIn && tempCheckOut && (
                        <>
                          {format(tempCheckIn, 'dd MMM', { locale: fr })} → {format(tempCheckOut, 'dd MMM', { locale: fr })}
                        </>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Durée</span>
                    <span className="font-medium">{nights} nuit{nights > 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Invités</span>
                    <span className="font-medium">{tempGuests} personne{tempGuests > 1 ? 's' : ''}</span>
                  </div>
                </div>

                <Button
                  onClick={handleEdit}
                  variant="outline"
                  className="w-full"
                >
                  Modifier les détails
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>


    </div>
  );
};
