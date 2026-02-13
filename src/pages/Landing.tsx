import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle, FileText, Shield, Mail, User, MessageSquare, Send } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useT, useGuestLocale } from '@/i18n/GuestLocaleProvider';
import type { Locale } from '@/i18n';
import checkyLogo from '/lovable-uploads/350a73a3-7335-4676-9ce0-4f747b7c0a93.png';
import heroLaptop from '@/assets/hero-laptop.jpg';

const LANGUAGES: { code: Locale; label: string }[] = [
  { code: 'fr', label: 'FR' },
  { code: 'en', label: 'EN' },
  { code: 'es', label: 'ES' },
];

export const Landing = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const t = useT();
  const { locale, setLocale } = useGuestLocale();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    toast({
      title: t('landing.contact.toastTitle'),
      description: t('landing.contact.toastDesc')
    });
    setFormData({ name: '', email: '', subject: '', message: '' });
    setIsSubmitting(false);
  };
  const handleGetStarted = () => {
    if (isAuthenticated) navigate('/dashboard');
    else navigate('/auth');
  };
  return <div className="min-h-screen" style={{ backgroundColor: 'hsl(var(--home-bg))' }}>
      <header className="fixed top-0 w-full bg-white/95 backdrop-blur-sm border-b border-gray-200 z-50">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            <div className="flex items-center">
              <button onClick={() => navigate('/')} className="focus:outline-none transition-transform hover:scale-105" aria-label={t('landing.aria.home')}>
                <img src={checkyLogo} alt="Checky Logo" className="w-24 h-24 sm:w-32 sm:h-32 md:w-40 md:h-40 lg:w-48 lg:h-48 object-contain cursor-pointer" />
              </button>
            </div>

            <nav className="hidden md:flex items-center space-x-8">
              <a href="#services" className="text-gray-600 hover:text-gray-900 transition-colors font-medium">{t('landing.nav.services')}</a>
              <button onClick={() => navigate('/pricing')} className="text-gray-600 hover:text-gray-900 transition-colors font-medium">{t('landing.nav.pricing')}</button>
              <a href="#faq" className="text-gray-600 hover:text-gray-900 transition-colors font-medium">{t('landing.nav.faq')}</a>
              <a href="#contact" className="text-gray-600 hover:text-gray-900 transition-colors font-medium">{t('landing.nav.contact')}</a>
            </nav>

            {/* Sélecteur de langue FR | EN | ES */}
            <div className="flex items-center gap-0.5 rounded-lg border border-gray-200 bg-gray-50/80 p-0.5">
              {LANGUAGES.map(({ code, label }) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLocale(code)}
                  className={`min-w-[2.25rem] py-1.5 px-2 text-sm font-medium rounded-md transition-colors ${
                    locale === code
                      ? 'bg-white text-primary shadow-sm'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'
                  }`}
                  aria-label={code === 'fr' ? 'Français' : code === 'en' ? 'English' : 'Español'}
                  aria-current={locale === code ? 'true' : undefined}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex items-center space-x-2 sm:space-x-3">
              {isAuthenticated ? (
                <Button onClick={() => navigate('/dashboard')} variant="default" className="bg-primary hover:bg-primary/90">{t('landing.nav.dashboard')}</Button>
              ) : (
                <>
                  <Button onClick={() => navigate('/auth')} size="sm" className="bg-[hsl(var(--cta-basic))] text-gray-900 hover:opacity-90 border-0 text-xs sm:text-sm px-3 sm:px-4">{t('landing.nav.login')}</Button>
                  <Button onClick={() => navigate('/auth')} size="sm" className="bg-primary hover:bg-primary/90 text-white text-xs sm:text-sm px-3 sm:px-4">{t('landing.nav.signup')}</Button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="pt-20 sm:pt-24 md:pt-28 pb-12 sm:pb-16 md:pb-20 px-3 sm:px-4 md:px-6 lg:px-8 relative overflow-hidden">
          {/* Background Image */}
          <div className="absolute inset-0 z-0">
            <img src={heroLaptop} alt="Hero Background" className="w-full h-full object-cover opacity-20" />
            <div className="absolute inset-0 bg-gradient-to-r from-white/80 to-white/60"></div>
          </div>
          
          <div className="max-w-4xl mx-auto text-center relative z-10 px-2">
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-4 sm:mb-6">
              {t('landing.hero.title')}
              <span className="block text-primary">{t('landing.hero.titleHighlight')}</span>
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-gray-600 mb-6 sm:mb-8 max-w-2xl mx-auto leading-relaxed px-2">{t('landing.hero.subtitle')}</p>
            <Button onClick={handleGetStarted} size="lg" className="text-base sm:text-lg px-6 sm:px-8 py-2.5 sm:py-3 bg-primary hover:bg-primary/90 shadow-lg hover:shadow-xl transition-all duration-300">
              {t('landing.hero.cta')}
            </Button>
          </div>
        </section>

        {/* Services Section */}
        <section id="services" className="py-12 sm:py-16 md:py-20 relative overflow-hidden">
          {/* Background decoration */}
          
          <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 relative z-10">
            <div className="text-center mb-8 sm:mb-12 md:mb-16">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 sm:mb-4">{t('landing.services.heading')}</h2>
              <p className="text-base sm:text-lg md:text-xl text-gray-600 max-w-2xl mx-auto px-2">{t('landing.services.subtitle')}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
              <Card className="group hover:shadow-xl transition-all duration-300 border-0 shadow-lg bg-white/80 backdrop-blur-sm">
                <CardHeader className="text-center pb-4">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 transition-colors" style={{ backgroundColor: "hsl(var(--cta-pay) / 0.12)" }}>
                    <CheckCircle className="w-8 h-8 text-[hsl(var(--cta-pay))]" />
                  </div>
                  <CardTitle className="text-xl font-semibold text-gray-900">{t('landing.services.checkin.title')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-gray-600 text-center leading-relaxed">{t('landing.services.checkin.desc')}</CardDescription>
                </CardContent>
              </Card>
              <Card className="group hover:shadow-xl transition-all duration-300 border-0 shadow-lg bg-white/80 backdrop-blur-sm">
                <CardHeader className="text-center pb-4">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 transition-colors" style={{ backgroundColor: "hsl(var(--brand-2) / 0.12)" }}>
                    <Shield className="w-8 h-8 text-[hsl(var(--brand-2))]" />
                  </div>
                  <CardTitle className="text-xl font-semibold text-gray-900">{t('landing.services.id.title')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-gray-600 text-center leading-relaxed">{t('landing.services.id.desc')}</CardDescription>
                </CardContent>
              </Card>
              <Card className="group hover:shadow-xl transition-all duration-300 border-0 shadow-lg bg-white/80 backdrop-blur-sm">
                <CardHeader className="text-center pb-4">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 transition-colors" style={{ backgroundColor: "hsl(var(--brand-3) / 0.18)" }}>
                    <FileText className="w-8 h-8 text-[hsl(var(--brand-3))]" />
                  </div>
                  <CardTitle className="text-xl font-semibold text-gray-900">{t('landing.services.legal.title')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-gray-600 text-center leading-relaxed">{t('landing.services.legal.desc')}</CardDescription>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section id="faq" className="py-20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">{t('landing.faq.heading')}</h2>
              <p className="text-xl text-gray-600">{t('landing.faq.subtitle')}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-8">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">{t('landing.faq.q1')}</h3>
                  <p className="text-gray-600 leading-relaxed">{t('landing.faq.a1')}</p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">{t('landing.faq.q2')}</h3>
                  <p className="text-gray-600 leading-relaxed">{t('landing.faq.a2')}</p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">{t('landing.faq.q3')}</h3>
                  <p className="text-gray-600 leading-relaxed">{t('landing.faq.a3')}</p>
                </div>
              </div>
              <div className="space-y-8">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">{t('landing.faq.q4')}</h3>
                  <p className="text-gray-600 leading-relaxed">{t('landing.faq.a4')}</p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">{t('landing.faq.q5')}</h3>
                  <p className="text-gray-600 leading-relaxed">{t('landing.faq.a5')}</p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">{t('landing.faq.q6')}</h3>
                  <p className="text-gray-600 leading-relaxed">{t('landing.faq.a6')}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="contact" className="py-20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">{t('landing.contact.heading')}</h2>
              <p className="text-xl text-gray-600">{t('landing.contact.subtitle')}</p>
            </div>
            <Card className="shadow-lg border-0 bg-white">
              <CardContent className="p-8">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 flex items-center">
                        <User className="w-4 h-4 mr-2" />
                        {t('landing.contact.name')}
                      </label>
                      <Input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required className="border-gray-300 focus:border-primary bg-white" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 flex items-center">
                        <Mail className="w-4 h-4 mr-2" />
                        {t('landing.contact.email')}
                      </label>
                      <Input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} required className="border-gray-300 focus:border-primary bg-white" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 flex items-center">
                      <MessageSquare className="w-4 h-4 mr-2" />
                      {t('landing.contact.subject')}
                    </label>
                    <Input type="text" value={formData.subject} onChange={e => setFormData({ ...formData, subject: e.target.value })} required className="border-gray-300 focus:border-primary bg-white" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">{t('landing.contact.message')}</label>
                    <Textarea value={formData.message} onChange={e => setFormData({ ...formData, message: e.target.value })} required rows={5} className="border-gray-300 focus:border-primary resize-none bg-white" />
                  </div>
                  <Button type="submit" className="w-full md:w-auto bg-primary hover:bg-primary/90" disabled={isSubmitting}>
                    {isSubmitting ? t('landing.contact.sending') : <><Send className="w-4 h-4 mr-2" />{t('landing.contact.send')}</>}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <button onClick={() => navigate('/')} className="flex items-center space-x-3 mb-4 md:mb-0 focus:outline-none transition-transform hover:scale-105" aria-label={t('landing.aria.home')}>
              <img src={checkyLogo} alt="Checky Logo" className="w-12 h-12 object-contain cursor-pointer" />
              <span className="text-xl font-bold">Checky</span>
            </button>
            <div className="text-gray-400 text-sm">{t('landing.footer.copyright')}</div>
          </div>
        </div>
      </footer>
    </div>;
};