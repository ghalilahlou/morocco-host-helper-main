import { useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Shield, CheckCircle, Lock, Clock, ArrowRight, IdCard, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AirbnbSyncService } from '@/services/airbnbSyncService';
import checkyLogo from '/lovable-uploads/350a73a3-7335-4676-9ce0-4f747b7c0a93.png';
import { useT } from '@/i18n/GuestLocaleProvider';

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

        // Verify token and get property info using edge function
        const { data, error } = await supabase.functions.invoke('resolve-guest-link', {
          body: { propertyId, token, airbnbCode: airbnbBookingId }
        });

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
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isValidToken) {
    console.log('🎯 Invalid token, showing error page');
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center p-4">
        <div className="max-w-md mx-auto text-center">
          <div className="bg-destructive/10 text-destructive p-6 rounded-lg">
            <h1 className="text-xl font-semibold mb-2">{t('guest.invalidLink.title')}</h1>
            <p>{t('guest.invalidLink.desc')}</p>
          </div>
        </div>
      </div>
    );
  }

  console.log('🎯 Token valid, rendering welcome page');

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Decorative background elements */}
      
      {/* Header */}
      <header className="relative z-20 bg-card/90 backdrop-blur-xl border-b border-border/30 shadow-medium">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="flex flex-col items-center text-center space-y-6 animate-fade-in">
            <div className="relative group">
              <div className="absolute inset-0 rounded-full blur-3xl opacity-15 group-hover:opacity-25 transition-all duration-700 scale-150 bg-primary"></div>
              <div className="absolute inset-0 rounded-full blur-xl opacity-10 animate-pulse bg-primary"></div>
              <div className="relative w-32 h-32 rounded-full p-1 shadow-strong bg-primary">
                <div className="w-full h-full bg-card rounded-full p-4 flex items-center justify-center">
                  <img src={checkyLogo} alt="Checky Logo" className="w-20 h-20 object-contain" />
                </div>
              </div>
            </div>
            <div className="space-y-3 max-w-3xl">
              <h1 className="text-3xl md:text-4xl font-bold text-foreground leading-tight">
                {t('guest.welcome.title')}
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed">
                {t('guest.welcome.subtitle')}
              </p>
              <div className="flex items-center justify-center space-x-6 pt-2">
                <div className="flex items-center space-x-2 text-success">
                  <CheckCircle className="w-5 h-5" />
                  <span className="text-sm font-medium">{t('guest.welcome.secure')}</span>
                </div>
                <div className="w-1 h-1 bg-border rounded-full"></div>
                <div className="flex items-center space-x-2 text-muted-foreground">
                  <Clock className="w-5 h-5" />
                  <span className="text-sm font-medium">{t('guest.welcome.duration')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10">
        {/* Hero Section */}
        <section className="max-w-4xl mx-auto px-6 py-8">
          <div className="text-center space-y-6 animate-slide-up">
            <div className="space-y-4">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground leading-tight">
                {t('guest.checkin.title', { propertyName })}
              </h2>
            </div>

            <div className="space-y-6">
              <div className="relative inline-block">
                <div className="absolute inset-0 rounded-xl blur-xl opacity-30 bg-primary/30"></div>
                <Button 
                  onClick={handleStartCheckin}
                  className="relative inline-flex items-center justify-center px-6 sm:px-16 py-4 sm:py-6 text-lg sm:text-xl font-bold rounded-xl shadow-medium hover:shadow-strong transition-all duration-300 hover:scale-105 group min-w-0 sm:min-w-[300px] lg:min-w-[400px] bg-[hsl(var(--teal-hover))] text-white"
                >
                  {t('guest.cta.startCheckin')}
                  <ArrowRight className="w-6 h-6 ml-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Steps Section */}
        <section className="max-w-6xl mx-auto px-6 pt-8 pb-16">
          <div className="text-center mb-12">
            <h3 className="text-2xl font-bold text-foreground mb-4">{t('guest.steps.title')}</h3>
            <p className="text-muted-foreground text-lg">{t('guest.steps.subtitle')}</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[ 
              {
                icon: IdCard,
                title: t('guest.steps.step1.title'),
                description: t('guest.steps.step1.desc')
              },
              {
                icon: CheckCircle,
                title: t('guest.steps.step2.title'),
                description: t('guest.steps.step2.desc')
              },
              {
                icon: FileText,
                title: t('guest.steps.step3.title'),
                description: t('guest.steps.step3.desc')
              }
            ].map((step, index) => (
              <article 
                key={index}
                className="p-8 rounded-2xl bg-card/60 backdrop-blur-sm border border-border/50 shadow-soft hover:shadow-medium transition-all duration-500 hover:-translate-y-1 animate-scale-in"
              >
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="relative">
                    <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center bg-white border border-primary/20 shadow-soft">
                      <step.icon className="w-8 h-8 text-primary" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-lg font-semibold text-foreground">{step.title}</h4>
                    <p className="text-muted-foreground leading-relaxed">{step.description}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>


      {/* Footer */}
      <footer className="relative border-t border-border/30 bg-[hsl(var(--brand-2))] text-white">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="text-center space-y-6">
              <div>
                <span className="text-lg">{t('guest.footer.needHelp')} </span>
                <a 
                  href="mailto:support@checky.fr" 
                  className="font-semibold underline decoration-2 underline-offset-4 text-white/90 hover:text-white transition-colors"
                >
                  {t('guest.footer.contactSupport')}
                </a>
              </div>
              <div className="max-w-2xl mx-auto">
                <p className="text-white/80">
                  En continuant, vous acceptez nos{' '}
                  <a href="#" className="font-medium underline decoration-1 underline-offset-2 text-white/90 hover:text-white">
                    {t('guest.footer.terms')}
                  </a>
                  {' '}et notre{' '}
                  <a href="#" className="font-medium underline decoration-1 underline-offset-2 text-white/90 hover:text-white">
                    {t('guest.footer.privacy')}
                  </a>
                </p>
              </div>
          </div>
        </div>
      </footer>
    </div>
  );
};