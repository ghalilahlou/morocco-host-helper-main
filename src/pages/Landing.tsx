import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { CheckCircle, FileText, Shield, Mail, User, MessageSquare, Send, Menu, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useT, useGuestLocale } from '@/i18n/GuestLocaleProvider';
import type { Locale } from '@/i18n';
import { cn } from '@/lib/utils';
import checkyLogo from '@/assets/logo.png';
import heroBg from '@/assets/hero-bg.png';

const LANGUAGES: { code: Locale; label: string }[] = [
  { code: 'fr', label: 'FR' },
  { code: 'en', label: 'EN' },
  { code: 'es', label: 'ES' },
];

const navLinkClass =
  'text-[#6B7280] hover:text-checky-teal transition-colors duration-200 font-medium text-sm';

export const Landing = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const t = useT();
  const { locale, setLocale } = useGuestLocale();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    toast({
      title: t('landing.contact.toastTitle'),
      description: t('landing.contact.toastDesc'),
    });
    setFormData({ name: '', email: '', subject: '', message: '' });
    setIsSubmitting(false);
  };

  const handleGetStarted = () => {
    if (isAuthenticated) navigate('/dashboard');
    else navigate('/auth');
  };

  const closeMobileNav = () => setMobileNavOpen(false);

  const faqItems = [1, 2, 3, 4, 5, 6] as const;

  return (
    <div className="min-h-screen font-checky antialiased bg-white text-checky-dark">
      <header className="fixed top-0 z-50 w-full border-b border-gray-100 bg-white/95 shadow-[0_1px_3px_rgba(15,23,42,0.06)] backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex shrink-0 items-center transition-transform hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-checky-teal focus-visible:ring-offset-2 rounded-lg"
            aria-label={t('landing.aria.home')}
          >
            <img src={checkyLogo} alt="Checky" className="h-9 w-auto object-contain sm:h-10 md:h-11" />
          </button>

          <nav className="hidden items-center gap-8 md:flex" aria-label="Principal">
            <a href="#services" className={navLinkClass}>
              {t('landing.nav.services')}
            </a>
            <button type="button" onClick={() => navigate('/pricing')} className={navLinkClass}>
              {t('landing.nav.pricing')}
            </button>
            <a href="#faq" className={navLinkClass}>
              {t('landing.nav.faq')}
            </a>
            <a href="#contact" className={navLinkClass}>
              {t('landing.nav.contact')}
            </a>
          </nav>

          <div className="hidden items-center gap-2 sm:gap-3 md:flex">
            <div className="flex items-center gap-0.5 rounded-full border border-gray-200 bg-gray-50/90 p-0.5">
              {LANGUAGES.map(({ code, label }) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLocale(code)}
                  className={cn(
                    'min-w-[2.25rem] rounded-full px-2.5 py-1.5 text-xs font-medium transition-colors duration-200 sm:text-sm',
                    locale === code
                      ? 'bg-white text-checky-teal shadow-sm'
                      : 'text-gray-600 hover:bg-white/80 hover:text-checky-dark'
                  )}
                  aria-current={locale === code ? 'true' : undefined}
                >
                  {label}
                </button>
              ))}
            </div>
            {isAuthenticated ? (
              <Button
                onClick={() => navigate('/dashboard')}
                className="rounded-full bg-checky-teal px-4 text-white shadow-sm hover:bg-checky-teal-hover"
              >
                {t('landing.nav.dashboard')}
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/auth')}
                  className="rounded-full border-checky-teal bg-transparent text-checky-teal hover:bg-checky-teal hover:text-white"
                >
                  {t('landing.nav.login')}
                </Button>
                <Button
                  type="button"
                  onClick={() => navigate('/auth')}
                  className="rounded-full bg-checky-teal px-4 text-white shadow-sm hover:bg-checky-teal-hover"
                >
                  {t('landing.nav.signup')}
                </Button>
              </>
            )}
          </div>

          <button
            type="button"
            className="inline-flex items-center justify-center rounded-lg p-2 text-checky-dark md:hidden"
            onClick={() => setMobileNavOpen((o) => !o)}
            aria-expanded={mobileNavOpen}
            aria-label={mobileNavOpen ? t('landing.aria.menuClose') : t('landing.aria.menuOpen')}
          >
            {mobileNavOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {mobileNavOpen && (
          <div className="border-t border-gray-100 bg-white px-4 py-4 shadow-inner md:hidden">
            <nav className="flex flex-col gap-1" aria-label="Mobile">
              <a href="#services" className="rounded-lg px-3 py-2.5 text-[#6B7280] hover:bg-gray-50 hover:text-checky-teal" onClick={closeMobileNav}>
                {t('landing.nav.services')}
              </a>
              <button
                type="button"
                className="rounded-lg px-3 py-2.5 text-left text-[#6B7280] hover:bg-gray-50 hover:text-checky-teal"
                onClick={() => {
                  navigate('/pricing');
                  closeMobileNav();
                }}
              >
                {t('landing.nav.pricing')}
              </button>
              <a href="#faq" className="rounded-lg px-3 py-2.5 text-[#6B7280] hover:bg-gray-50 hover:text-checky-teal" onClick={closeMobileNav}>
                {t('landing.nav.faq')}
              </a>
              <a href="#contact" className="rounded-lg px-3 py-2.5 text-[#6B7280] hover:bg-gray-50 hover:text-checky-teal" onClick={closeMobileNav}>
                {t('landing.nav.contact')}
              </a>
            </nav>
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
              {LANGUAGES.map(({ code, label }) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLocale(code)}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-sm font-medium',
                    locale === code ? 'bg-checky-teal text-white' : 'bg-gray-100 text-gray-600'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="mt-4 flex flex-col gap-2">
              {isAuthenticated ? (
                <Button className="w-full rounded-full bg-checky-teal text-white" onClick={() => { navigate('/dashboard'); closeMobileNav(); }}>
                  {t('landing.nav.dashboard')}
                </Button>
              ) : (
                <>
                  <Button variant="outline" className="w-full rounded-full border-checky-teal text-checky-teal" onClick={() => { navigate('/auth'); closeMobileNav(); }}>
                    {t('landing.nav.login')}
                  </Button>
                  <Button className="w-full rounded-full bg-checky-teal text-white" onClick={() => { navigate('/auth'); closeMobileNav(); }}>
                    {t('landing.nav.signup')}
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      <main>
        {/* Hero — image cover + dégradé horizontal, texte blanc */}
        <section className="relative flex min-h-[min(88vh,920px)] items-center overflow-hidden pt-16">
          <div className="absolute inset-0 z-0 bg-checky-hero-fallback" aria-hidden />
          <img
            src={heroBg}
            alt=""
            className="absolute inset-0 z-[1] h-full w-full object-cover object-center"
            fetchPriority="high"
          />
          <div
            className="absolute inset-0 z-[2] bg-gradient-to-r from-[#1a2038]/95 via-[#1a2038]/65 to-transparent"
            aria-hidden
          />

          <div className="relative z-10 mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 md:px-8 lg:py-28">
            <div className="max-w-2xl text-left">
              <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl lg:text-[3.2rem] lg:leading-tight">
                {t('landing.hero.title')}
                <span className="mt-1 block text-checky-teal sm:mt-2">{t('landing.hero.titleHighlight')}</span>
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-white/85 sm:text-lg md:text-xl">
                {t('landing.hero.subtitle')}
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                <Button
                  type="button"
                  size="lg"
                  onClick={handleGetStarted}
                  className="h-12 rounded-full bg-checky-teal px-8 text-base font-semibold text-white shadow-[0_8px_24px_rgba(45,191,184,0.35)] transition hover:bg-checky-teal-hover active:bg-checky-teal-active"
                >
                  {t('landing.hero.cta')}
                </Button>
                <Button
                  type="button"
                  size="lg"
                  variant="outline"
                  onClick={() => navigate('/pricing')}
                  className="h-12 rounded-full border-2 border-white/90 bg-transparent px-8 text-base font-semibold text-white hover:bg-white hover:text-checky-dark"
                >
                  {t('landing.hero.ctaSecondary')}
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Services — fond blanc */}
        <section id="services" className="scroll-mt-24 py-16 md:py-24 lg:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-12 text-center md:mb-16">
              <h2 className="text-3xl font-bold tracking-tight text-checky-dark md:text-4xl">
                {t('landing.services.heading')}
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-base text-[#6B7280] md:text-lg">{t('landing.services.subtitle')}</p>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-8">
              {[
                {
                  icon: CheckCircle,
                  title: t('landing.services.checkin.title'),
                  desc: t('landing.services.checkin.desc'),
                },
                {
                  icon: Shield,
                  title: t('landing.services.id.title'),
                  desc: t('landing.services.id.desc'),
                },
                {
                  icon: FileText,
                  title: t('landing.services.legal.title'),
                  desc: t('landing.services.legal.desc'),
                },
              ].map(({ icon: Icon, title, desc }) => (
                <Card
                  key={title}
                  className="group border border-gray-100 bg-white shadow-sm transition-all duration-300 hover:shadow-md rounded-2xl"
                >
                  <CardHeader className="pb-2 text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-gray-100 transition-colors group-hover:bg-checky-teal/10">
                      <Icon className="h-7 w-7 text-gray-500 transition-colors group-hover:text-checky-teal" strokeWidth={1.5} />
                    </div>
                    <CardTitle className="text-lg font-semibold text-checky-dark">{title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-center text-sm leading-relaxed text-[#6B7280]">{desc}</CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Témoignages — fond gris bleuté */}
        <section className="bg-[#F4F6F8] py-16 md:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-10 text-center md:mb-14">
              <h2 className="text-3xl font-bold tracking-tight text-checky-dark md:text-4xl">{t('landing.testimonials.heading')}</h2>
              <p className="mx-auto mt-3 max-w-2xl text-[#6B7280]">{t('landing.testimonials.subtitle')}</p>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {([1, 2, 3] as const).map((i) => (
                <Card key={i} className="border border-gray-100/80 bg-white shadow-sm rounded-2xl">
                  <CardContent className="pt-6">
                    <div className="mb-3 text-amber-400" aria-hidden>
                      ★★★★★
                    </div>
                    <p className="text-sm font-semibold leading-relaxed text-checky-dark">{t(`landing.testimonials.${i}.quote`)}</p>
                    <p className="mt-4 text-xs font-semibold text-checky-dark">{t(`landing.testimonials.${i}.author`)}</p>
                    <p className="mt-0.5 text-xs italic text-[#6B7280]">{t(`landing.testimonials.${i}.role`)}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Teaser tarifs */}
        <section className="border-y border-gray-100 bg-[#F8F9FA] py-14 md:py-20">
          <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
            <h2 className="text-2xl font-bold tracking-tight text-checky-dark md:text-3xl">{t('landing.pricingTeaser.heading')}</h2>
            <p className="mt-3 text-[#6B7280]">{t('landing.pricingTeaser.subtitle')}</p>
            <Button
              type="button"
              onClick={() => navigate('/pricing')}
              className="mt-8 rounded-full bg-checky-teal px-8 text-white shadow-md hover:bg-checky-teal-hover"
            >
              {t('landing.pricingTeaser.cta')}
            </Button>
          </div>
        </section>

        {/* FAQ — blanc, accordéon */}
        <section id="faq" className="scroll-mt-24 py-16 md:py-24">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
            <div className="mb-10 text-center md:mb-14">
              <h2 className="text-3xl font-bold tracking-tight text-checky-dark md:text-4xl">{t('landing.faq.heading')}</h2>
              <p className="mt-3 text-[#6B7280]">{t('landing.faq.subtitle')}</p>
            </div>
            <Accordion type="single" collapsible className="w-full rounded-2xl border border-gray-200 bg-white px-2 shadow-sm">
              {faqItems.map((i) => (
                <AccordionItem key={i} value={`item-${i}`} className="border-gray-200 px-2">
                  <AccordionTrigger className="text-left text-base font-medium text-checky-dark hover:bg-gray-50/80 hover:no-underline rounded-lg px-2 py-1 -mx-2">
                    {t(`landing.faq.q${i}`)}
                  </AccordionTrigger>
                  <AccordionContent className="pb-4 pl-2 text-sm leading-relaxed text-[#6B7280]">
                    {t(`landing.faq.a${i}`)}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* Contact — fond gris */}
        <section id="contact" className="scroll-mt-24 bg-[#F4F6F8] py-16 md:py-24">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <div className="mb-10 text-center md:mb-14">
              <h2 className="text-3xl font-bold tracking-tight text-checky-dark md:text-4xl">{t('landing.contact.heading')}</h2>
              <p className="mt-3 text-[#6B7280]">{t('landing.contact.subtitle')}</p>
            </div>
            <Card className="rounded-2xl border border-gray-200/80 bg-white shadow-md">
              <CardContent className="p-6 sm:p-8">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="flex items-center text-sm font-semibold text-checky-dark">
                        <User className="mr-2 h-4 w-4 text-checky-teal" />
                        {t('landing.contact.name')}
                      </label>
                      <Input
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="rounded-[10px] border-gray-200 bg-white focus-visible:border-checky-teal focus-visible:ring-2 focus-visible:ring-checky-teal/40"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-center text-sm font-semibold text-checky-dark">
                        <Mail className="mr-2 h-4 w-4 text-checky-teal" />
                        {t('landing.contact.email')}
                      </label>
                      <Input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="rounded-[10px] border-gray-200 bg-white focus-visible:border-checky-teal focus-visible:ring-2 focus-visible:ring-checky-teal/40"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center text-sm font-semibold text-checky-dark">
                      <MessageSquare className="mr-2 h-4 w-4 text-checky-teal" />
                      {t('landing.contact.subject')}
                    </label>
                    <Input
                      required
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      className="rounded-[10px] border-gray-200 bg-white focus-visible:border-checky-teal focus-visible:ring-2 focus-visible:ring-checky-teal/40"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-checky-dark">{t('landing.contact.message')}</label>
                    <Textarea
                      required
                      rows={5}
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      className="resize-none rounded-[10px] border-gray-200 bg-white focus-visible:border-checky-teal focus-visible:ring-2 focus-visible:ring-checky-teal/40"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full rounded-full bg-checky-teal py-6 text-base font-semibold text-white hover:bg-checky-teal-hover md:w-auto md:px-10"
                  >
                    {isSubmitting ? (
                      t('landing.contact.sending')
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        {t('landing.contact.send')}
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      <footer className="bg-checky-dark text-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-6 border-b border-white/10 pb-8 md:flex-row md:items-start">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="flex items-center gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-checky-teal focus-visible:ring-offset-2 focus-visible:ring-offset-checky-dark rounded-lg"
              aria-label={t('landing.aria.home')}
            >
              <img src={checkyLogo} alt="" className="h-10 w-10 object-contain" />
              <span className="text-lg font-bold">Checky</span>
            </button>
            <p className="text-center text-sm text-white/50 md:text-right">{t('landing.footer.copyright')}</p>
          </div>
          <p className="pt-6 text-center text-xs text-white/40">{t('landing.footer.tagline')}</p>
        </div>
      </footer>
    </div>
  );
};
