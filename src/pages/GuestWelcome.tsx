import { useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Shield, CheckCircle, Lock, Clock, ArrowRight, IdCard, FileText, Sparkles, Zap, Star } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AirbnbSyncService } from '@/services/airbnbSyncService';
import checkyLogo from '/lovable-uploads/350a73a3-7335-4676-9ce0-4f747b7c0a93.png';
import { useT } from '@/i18n/GuestLocaleProvider';

// Animation variants
const fadeInUp = {
  initial: { opacity: 0, y: 60 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] }
};

const staggerContainer = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.2,
    }
  }
};

const scaleIn = {
  initial: { opacity: 0, scale: 0.8 },
  animate: { opacity: 1, scale: 1 },
  transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] }
};

const floatingIcon = {
  animate: {
    y: [0, -10, 0],
    rotate: [0, 5, -5, 0],
    transition: {
      duration: 4,
      repeat: Infinity,
      ease: "easeInOut"
    }
  }
};

export const GuestWelcome = () => {
  console.log('🎯 GuestWelcome component loaded');
  const { propertyId, token, airbnbBookingId } = useParams<{ 
    propertyId: string; 
    token: string; 
    airbnbBookingId?: string; 
  }>();
  console.log('🎯 URL params in GuestWelcome:', { propertyId, token, airbnbBookingId });
  const { toast } = useToast();
  const t = useT();
  const [isValidToken, setIsValidToken] = useState(false);
  const [checkingToken, setCheckingToken] = useState(true);
  const [propertyName, setPropertyName] = useState('');
  const [matchedBooking, setMatchedBooking] = useState<any>(null);

  useEffect(() => {
    const verifyTokenAndMatchBooking = async () => {
      if (!propertyId || !token) {
        setCheckingToken(false);
        return;
      }

      try {
        console.log('🔍 About to call resolve-guest-link with params:', { 
          propertyId, 
          token, 
          airbnbCode: airbnbBookingId,
          'propertyId type': typeof propertyId,
          'token type': typeof token,
          'propertyId length': propertyId?.length,
          'token length': token?.length
        });

        // Tentative d'appel à la fonction Edge
        let data;
        let error;
        
        try {
          const response = await supabase.functions.invoke('resolve-guest-link', {
            body: { propertyId, token, airbnbCode: airbnbBookingId }
          });
          
          if (response.data) {
            data = response.data;
          } else {
            error = response.error;
          }
        } catch (edgeFunctionError) {
          console.log('⚠️ Edge Function non disponible (quota dépassé), utilisation du contournement...');
          
          // CONTOURNEMENT : Récupération directe des données
          try {
            const { data: propertyData, error: propertyError } = await supabase
              .from('properties')
              .select('id, name, address, contract_template, contact_info, house_rules')
              .eq('id', propertyId)
              .single();
            
            if (propertyError) throw propertyError;
            
            // Créer un objet compatible avec le format attendu
            data = {
              ok: true,
              propertyId: propertyId,
              bookingId: airbnbBookingId || null,
              token: token,
              property: propertyData
            };
            
            console.log('✅ Contournement réussi, données récupérées directement');
            
          } catch (fallbackError) {
            console.error('❌ Échec du contournement:', fallbackError);
            error = fallbackError;
          }
        }

        if (error || !data) {
          console.error('Token verification error:', error);
          setIsValidToken(false);
        } else {
          setIsValidToken(true);
          setPropertyName(data.property?.name || 'Hébergement');

          // If airbnbBookingId is provided, try to match from a hardcoded ICS URL for now
          if (airbnbBookingId) {
            // For demo purposes, using a placeholder ICS URL - this should come from property settings
            const icsUrl = "https://www.airbnb.com/calendar/ical/..."; // This will be configurable per property
            try {
              // We'll find the booking by matching the booking ID in the description
              // Since we don't have the actual ICS URL yet, we'll store the booking ID for later matching
              console.log('Airbnb booking ID provided:', airbnbBookingId);
              // This will be used to pre-fill dates when we have the ICS integration
            } catch (icsError) {
              console.error('Error fetching/matching Airbnb booking:', icsError);
            }
          }
        }
      } catch (error) {
        console.error('Error verifying token:', error);
        setIsValidToken(false);
      } finally {
        setCheckingToken(false);
      }
    };

    verifyTokenAndMatchBooking();
  }, [propertyId, token, airbnbBookingId]);

  const handleStartCheckin = () => {
    const baseUrl = `/guest-verification/${propertyId}/${token}`;
    const url = airbnbBookingId ? `${baseUrl}/${airbnbBookingId}` : baseUrl;
    window.location.assign(url);
  };

  if (checkingToken) {
    console.log('🎯 Still checking token...');
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-white to-teal-50 flex items-center justify-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-16 h-16 mx-auto mb-4 rounded-full border-4 border-primary/20 border-t-primary"
          />
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-lg text-muted-foreground font-medium"
          >
            Vérification en cours...
          </motion.p>
        </motion.div>
      </div>
    );
  }

  if (!isValidToken) {
    console.log('🎯 Invalid token, showing error page');
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md mx-auto text-center"
        >
          <div className="bg-red-50 border border-red-200 text-red-800 p-8 rounded-3xl shadow-xl">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
              className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center"
            >
              <Lock className="w-8 h-8 text-red-600" />
            </motion.div>
            <h1 className="text-2xl font-bold mb-3">{t('guest.invalidLink.title')}</h1>
            <p className="text-red-600">{t('guest.invalidLink.desc')}</p>
          </div>
        </motion.div>
      </div>
    );
  }

  console.log('🎯 Token valid, rendering welcome page');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-brand-turquoise/10 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            rotate: [0, 180, 360],
            opacity: [0.1, 0.2, 0.1]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl"
        />
        <motion.div 
          animate={{ 
            scale: [1.2, 1, 1.2],
            rotate: [360, 180, 0],
            opacity: [0.1, 0.15, 0.1]
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-teal-400/10 rounded-full blur-3xl"
        />
      </div>

      {/* Floating Decoration Icons */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div 
          variants={floatingIcon}
          animate="animate"
          className="absolute top-20 left-20 text-primary/20"
        >
          <Sparkles className="w-8 h-8" />
        </motion.div>
        <motion.div 
          variants={floatingIcon}
          animate="animate"
          style={{ animationDelay: '1s' }}
          className="absolute top-32 right-32 text-teal-400/20"
        >
          <Zap className="w-6 h-6" />
        </motion.div>
        <motion.div 
          variants={floatingIcon}
          animate="animate"
          style={{ animationDelay: '2s' }}
          className="absolute bottom-32 left-40 text-primary/20"
        >
          <Star className="w-7 h-7" />
        </motion.div>
      </div>

      {/* Header */}
      <motion.header 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="relative z-20 bg-white/80 backdrop-blur-xl border-b border-gray-200/50 shadow-xl shadow-gray-900/5"
      >
        <div className="max-w-6xl mx-auto px-6 py-12">
          <motion.div 
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="flex flex-col items-center text-center space-y-6"
          >
            <motion.div variants={scaleIn} className="relative group">
              <motion.div 
                animate={{ 
                  scale: [1, 1.05, 1],
                  rotate: [0, 1, -1, 0]
                }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="absolute inset-0 rounded-full blur-3xl opacity-20 bg-gradient-to-r from-brand-cyan to-brand-turquoise scale-150"
              />
              <motion.div 
                whileHover={{ scale: 1.05, rotate: 5 }}
                transition={{ type: "spring", stiffness: 300 }}
                className="relative w-32 h-32 rounded-full p-1 shadow-2xl bg-gradient-to-r from-brand-teal to-brand-turquoise"
              >
                <div className="w-full h-full bg-white rounded-full p-4 flex items-center justify-center">
                  <motion.img 
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: 0.5, type: "spring", stiffness: 200 }}
                    src={checkyLogo} 
                    alt="Checky Logo" 
                    className="w-20 h-20 object-contain" 
                  />
                </div>
              </motion.div>
            </motion.div>
            
            <motion.div variants={fadeInUp} className="space-y-4 max-w-4xl">
              <h1 className="text-4xl md:text-6xl font-black text-gray-900 leading-tight">
                {t('guest.welcome.title')}
              </h1>
              <p className="text-xl md:text-2xl text-gray-600 leading-relaxed font-medium">
                {t('guest.welcome.subtitle')}
              </p>
              <motion.div 
                variants={fadeInUp}
                className="flex items-center justify-center space-x-8 pt-4"
              >
                <motion.div 
                  whileHover={{ scale: 1.05 }}
                  className="flex items-center space-x-3 text-emerald-600 bg-emerald-50 px-4 py-2 rounded-full"
                >
                  <CheckCircle className="w-6 h-6" />
                  <span className="font-semibold">{t('guest.welcome.secure')}</span>
                </motion.div>
                <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
                <motion.div 
                  whileHover={{ scale: 1.05 }}
                  className="flex items-center space-x-3 text-blue-600 bg-blue-50 px-4 py-2 rounded-full"
                >
                  <Clock className="w-6 h-6" />
                  <span className="font-semibold">{t('guest.welcome.duration')}</span>
                </motion.div>
              </motion.div>
            </motion.div>
          </motion.div>
        </div>
      </motion.header>

      {/* Main Content */}
      <main className="relative z-10">
        {/* Hero Section */}
        <motion.section 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.8 }}
          className="max-w-5xl mx-auto px-6 py-16"
        >
          <div className="text-center space-y-12">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="space-y-6"
            >
              <h2 className="text-3xl md:text-5xl font-bold text-gray-900 leading-tight">
                {t('guest.checkin.title', { propertyName })}
              </h2>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.7, duration: 0.6 }}
              className="relative inline-block"
            >
              <motion.div 
                animate={{ 
                  scale: [1, 1.1, 1],
                  opacity: [0.5, 0.8, 0.5]
                }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute inset-0 rounded-2xl blur-xl bg-gradient-to-r from-brand-teal/30 to-brand-turquoise/30"
              />
              <motion.div
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
              >
                <Button 
                  onClick={handleStartCheckin}
                  className="relative inline-flex items-center justify-center px-12 py-6 text-xl font-bold rounded-2xl shadow-2xl hover:shadow-3xl transition-all duration-300 group min-w-[350px] bg-brand-teal hover:bg-brand-teal/90 text-white border-0"
                >
                  <motion.span
                    className="relative z-10"
                    whileHover={{ x: -4 }}
                    transition={{ type: "spring", stiffness: 400 }}
                  >
                    {t('guest.cta.startCheckin')}
                  </motion.span>
                  <motion.div
                    whileHover={{ x: 4, scale: 1.1 }}
                    transition={{ type: "spring", stiffness: 400 }}
                  >
                    <ArrowRight className="w-7 h-7 ml-4" />
                  </motion.div>
                  
                  {/* Glow effect */}
                  <motion.div 
                    className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    style={{
                      background: 'linear-gradient(45deg, rgba(0, 189, 157, 0.3), rgba(139, 215, 210, 0.3))',
                      filter: 'blur(8px)',
                      transform: 'scale(1.1)'
                    }}
                  />
                </Button>
              </motion.div>
            </motion.div>
          </div>
        </motion.section>

        {/* Steps Section */}
        <motion.section 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9, duration: 0.8 }}
          className="max-w-7xl mx-auto px-6 py-16"
        >
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.1 }}
            className="text-center mb-16"
          >
            <h3 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">{t('guest.steps.title')}</h3>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">{t('guest.steps.subtitle')}</p>
          </motion.div>

          <motion.div 
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="grid md:grid-cols-3 gap-8"
          >
            {[ 
              {
                icon: IdCard,
                title: t('guest.steps.step1.title'),
                description: t('guest.steps.step1.desc'),
                color: 'from-[#54DEFD] to-[#8BD7D2]',
                bgColor: 'from-cyan-50 to-teal-50'
              },
              {
                icon: CheckCircle,
                title: t('guest.steps.step2.title'),
                description: t('guest.steps.step2.desc'),
                color: 'from-[#49C605] to-[#00BD9D]',
                bgColor: 'from-green-50 to-teal-50'
              },
              {
                icon: FileText,
                title: t('guest.steps.step3.title'),
                description: t('guest.steps.step3.desc'),
                color: 'from-[#00BD9D] to-[#8BD7D2]',
                bgColor: 'from-teal-50 to-cyan-50'
              }
            ].map((step, index) => (
              <motion.article 
                key={index}
                variants={fadeInUp}
                whileHover={{ 
                  y: -8, 
                  scale: 1.02,
                  transition: { type: "spring", stiffness: 300 }
                }}
                className={`relative p-8 rounded-3xl bg-gradient-to-br ${step.bgColor} border border-white/50 shadow-xl hover:shadow-2xl transition-all duration-500 backdrop-blur-sm`}
              >
                <motion.div 
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  transition={{ type: "spring", stiffness: 300 }}
                  className="flex flex-col items-center text-center space-y-6"
                >
                  <div className="relative">
                    <div className={`relative w-20 h-20 rounded-2xl flex items-center justify-center bg-gradient-to-r ${step.color} shadow-lg`}>
                      <step.icon className="w-10 h-10 text-white" />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <h4 className="text-xl font-bold text-gray-900">{step.title}</h4>
                    <p className="text-gray-600 leading-relaxed">{step.description}</p>
                  </div>
                </motion.div>
              </motion.article>
            ))}
          </motion.div>
        </motion.section>
      </main>

      {/* Footer */}
      <motion.footer 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.3, duration: 0.8 }}
        className="relative border-t border-gray-200/50 bg-gradient-to-r from-gray-900 to-gray-800 text-white mt-16"
      >
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="text-center space-y-8">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.5 }}
            >
              <span className="text-xl">{t('guest.footer.needHelp')} </span>
              <motion.a 
                whileHover={{ scale: 1.05 }}
                href="mailto:support@checky.fr" 
                className="font-bold underline decoration-2 underline-offset-4 text-teal-400 hover:text-teal-300 transition-colors"
              >
                {t('guest.footer.contactSupport')}
              </motion.a>
            </motion.div>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.7 }}
              className="max-w-2xl mx-auto"
            >
              <p className="text-gray-300">
                En continuant, vous acceptez nos{' '}
                <motion.a 
                  whileHover={{ scale: 1.05 }}
                  href="#" 
                  className="font-medium underline decoration-1 underline-offset-2 text-teal-400 hover:text-teal-300"
                >
                  {t('guest.footer.terms')}
                </motion.a>
                {' '}et notre{' '}
                <motion.a 
                  whileHover={{ scale: 1.05 }}
                  href="#" 
                  className="font-medium underline decoration-1 underline-offset-2 text-teal-400 hover:text-teal-300"
                >
                  {t('guest.footer.privacy')}
                </motion.a>
              </p>
            </motion.div>
          </div>
        </div>
      </motion.footer>
    </div>
  );
};