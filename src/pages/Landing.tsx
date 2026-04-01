import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Check,
  FileText,
  Menu,
  ScanLine,
  Send,
  ShieldCheck,
  Star,
  X,
  Zap,
} from 'lucide-react';
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
  'text-sm font-medium text-gray-500 hover:text-checky-teal transition-colors duration-200';

export const Landing = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const t = useT();
  const { locale, setLocale } = useGuestLocale();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [contactSuccess, setContactSuccess] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });

  const year = new Date().getFullYear();

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
    setContactSuccess(true);
  };

  const handleGetStarted = () => {
    if (isAuthenticated) navigate('/dashboard');
    else navigate('/auth?tab=signup');
  };

  const closeMobileNav = () => setMobileNavOpen(false);

  const faqIds = [1, 2, 3, 4] as const;
  const testimonialIds = [1, 2, 3, 4, 5] as const;

  const freeFeatures = ['f1', 'f2', 'f3', 'f4', 'f5', 'f6'] as const;
  const proFeatures = ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9'] as const;
  const agencyFeatures = ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7'] as const;

  return (
    <div className="min-h-screen bg-white font-checky antialiased text-checky-dark">
      <header className="fixed top-0 z-50 h-16 w-full border-b border-gray-100 bg-white shadow-sm">
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex shrink-0 items-center rounded-lg transition-transform hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-checky-teal focus-visible:ring-offset-2"
            aria-label={t('landing.aria.home')}
          >
            <img src={checkyLogo} alt="Checky" className="h-8 w-auto object-contain" />
          </button>

          <nav className="hidden items-center gap-8 md:flex" aria-label="Principal">
            <a href="#services" className={navLinkClass}>
              {t('landing.nav.services')}
            </a>
            <a href="#pricing" className={navLinkClass}>
              {t('landing.nav.pricing')}
            </a>
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
                className="rounded-full bg-checky-teal px-5 text-white shadow-sm hover:bg-checky-teal-hover active:bg-[#1A9690]"
              >
                {t('landing.nav.dashboard')}
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/auth')}
                  className="rounded-full border-checky-teal bg-transparent px-5 text-checky-teal hover:bg-checky-teal hover:text-white active:bg-[#1FA09A]"
                >
                  {t('landing.nav.login')}
                </Button>
                <Button
                  type="button"
                  onClick={() => navigate('/auth?tab=signup')}
                  className="rounded-full bg-checky-teal px-5 text-white shadow-sm hover:bg-checky-teal-hover active:bg-[#1A9690]"
                >
                  {t('landing.nav.signup')}
                </Button>
              </>
            )}
          </div>

          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-checky-dark hover:bg-gray-100 md:hidden"
            onClick={() => setMobileNavOpen((o) => !o)}
            aria-expanded={mobileNavOpen}
            aria-label={mobileNavOpen ? t('landing.aria.menuClose') : t('landing.aria.menuOpen')}
          >
            {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {mobileNavOpen && (
          <div className="border-t border-gray-100 bg-white px-4 py-4 shadow-inner md:hidden">
            <nav className="flex flex-col gap-1" aria-label="Mobile">
              <a
                href="#services"
                className="rounded-lg px-3 py-2.5 text-gray-500 hover:bg-gray-50 hover:text-checky-teal"
                onClick={closeMobileNav}
              >
                {t('landing.nav.services')}
              </a>
              <a
                href="#pricing"
                className="rounded-lg px-3 py-2.5 text-gray-500 hover:bg-gray-50 hover:text-checky-teal"
                onClick={closeMobileNav}
              >
                {t('landing.nav.pricing')}
              </a>
              <a
                href="#faq"
                className="rounded-lg px-3 py-2.5 text-gray-500 hover:bg-gray-50 hover:text-checky-teal"
                onClick={closeMobileNav}
              >
                {t('landing.nav.faq')}
              </a>
              <a
                href="#contact"
                className="rounded-lg px-3 py-2.5 text-gray-500 hover:bg-gray-50 hover:text-checky-teal"
                onClick={closeMobileNav}
              >
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
            <div className="mt-4 flex flex-col gap-2 border-t border-gray-100 pt-4">
              {isAuthenticated ? (
                <Button
                  className="w-full rounded-full bg-checky-teal text-white"
                  onClick={() => {
                    navigate('/dashboard');
                    closeMobileNav();
                  }}
                >
                  {t('landing.nav.dashboard')}
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    className="w-full rounded-full border-checky-teal text-checky-teal"
                    onClick={() => {
                      navigate('/auth');
                      closeMobileNav();
                    }}
                  >
                    {t('landing.nav.login')}
                  </Button>
                  <Button
                    className="w-full rounded-full bg-checky-teal text-white"
                    onClick={() => {
                      navigate('/auth?tab=signup');
                      closeMobileNav();
                    }}
                  >
                    {t('landing.nav.signup')}
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      <main>
        {/* Hero */}
        <section className="relative flex min-h-[520px] items-center overflow-hidden pt-16">
          <div className="absolute inset-0 z-0 bg-checky-hero-fallback" aria-hidden />
          <img
            src={heroBg}
            alt=""
            className="absolute inset-0 z-[1] h-full w-full object-cover object-center"
            fetchPriority="high"
          />
          <div
            className="absolute inset-0 z-[2] bg-gradient-to-r from-black/[0.42] to-black/10"
            aria-hidden
          />

          <div className="relative z-10 mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 md:px-8 lg:py-28">
            <div className="max-w-lg text-left">
              <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl">
                {t('landing.hero.title')}
              </h1>
              <p className="mt-5 max-w-md text-lg leading-relaxed text-white/85 sm:text-xl">
                {t('landing.hero.subtitle')}
              </p>
              <Button
                type="button"
                size="lg"
                onClick={handleGetStarted}
                className="mt-8 h-auto rounded-full bg-checky-teal px-8 py-3 text-base font-semibold text-white shadow-lg hover:bg-checky-teal/90 active:bg-[#1A9690]"
              >
                {t('landing.hero.cta')}
              </Button>
            </div>
          </div>
        </section>

        {/* Services */}
        <section id="services" className="scroll-mt-24 bg-white py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto mb-14 max-w-2xl text-center">
              <h2 className="mb-3 text-3xl font-bold tracking-tight text-checky-dark md:text-4xl">
                {t('landing.services.heading')}
              </h2>
              <p className="text-base text-gray-500">{t('landing.services.subtitle')}</p>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              {[
                {
                  Icon: ShieldCheck,
                  title: t('landing.services.checkin.title'),
                  desc: t('landing.services.checkin.desc'),
                },
                {
                  Icon: ScanLine,
                  title: t('landing.services.id.title'),
                  desc: t('landing.services.id.desc'),
                },
                {
                  Icon: FileText,
                  title: t('landing.services.legal.title'),
                  desc: t('landing.services.legal.desc'),
                },
              ].map(({ Icon, title, desc }) => (
                <Card
                  key={title}
                  className="group cursor-default rounded-xl border border-gray-100 bg-white p-8 text-center shadow-sm transition-shadow duration-200 hover:shadow-md"
                >
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-gray-100 transition-colors duration-200 group-hover:bg-checky-teal/10">
                    <Icon
                      className="h-[26px] w-[26px] text-gray-400 transition-colors duration-200 group-hover:text-checky-teal"
                      strokeWidth={1.5}
                    />
                  </div>
                  <h3 className="text-base font-semibold tracking-tight text-checky-dark">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-500">{desc}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Témoignages — scroll horizontal */}
        <section className="bg-[#F4F6F8] py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h2 className="mb-12 text-center text-3xl font-bold tracking-tight text-checky-dark md:text-4xl">
              {t('landing.testimonials.heading')}
            </h2>
            <div
              className="-mx-4 flex gap-5 overflow-x-auto scroll-smooth px-4 pb-4 [-ms-overflow-style:none] [scrollbar-width:none] snap-x snap-mandatory md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden"
            >
              {testimonialIds.map((i) => (
                <Card
                  key={i}
                  className="w-[220px] shrink-0 snap-start rounded-xl border border-gray-100/80 bg-white p-5 shadow-sm"
                >
                  <div className="mb-2 flex gap-0.5" aria-hidden>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <Star key={j} className="h-[13px] w-[13px] fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="mb-2 text-sm font-semibold text-checky-dark">{t(`landing.testimonials.${i}.hook`)}</p>
                  <p className="mb-4 text-xs italic leading-relaxed text-[#6B7280]">
                    « {t(`landing.testimonials.${i}.quote`)} »
                  </p>
                  <p className="text-xs font-semibold text-checky-dark">{t(`landing.testimonials.${i}.name`)}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Tarifs */}
        <section id="pricing" className="scroll-mt-24 bg-[#F8F9FA] py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto mb-16 max-w-2xl text-center">
              <span className="mb-3 inline-block text-sm font-medium text-checky-teal">{t('landing.pricing.badge')}</span>
              <h2 className="mb-4 text-3xl font-bold tracking-tight text-checky-dark md:text-4xl">
                {t('landing.pricing.heading')}
              </h2>
              <p className="text-lg text-gray-500">{t('landing.pricing.subtitle')}</p>
            </div>

            <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-3">
              {/* Gratuit */}
              <Card className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm transition-shadow hover:shadow-md">
                <h3 className="text-lg font-semibold text-checky-dark">{t('landing.pricing.free.name')}</h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-checky-dark">{t('landing.pricing.free.price')}</span>
                  <span className="text-sm text-gray-400">{t('landing.pricing.free.period')}</span>
                </div>
                <p className="mt-2 text-sm text-gray-500">{t('landing.pricing.free.desc')}</p>
                <Button
                  className="mb-8 mt-6 w-full rounded-full border border-checky-teal bg-transparent text-checky-teal hover:bg-checky-teal hover:text-white"
                  variant="outline"
                  onClick={handleGetStarted}
                >
                  {t('landing.pricing.free.cta')}
                </Button>
                <ul className="space-y-3">
                  {freeFeatures.map((fk) => (
                    <li key={fk} className="flex gap-2 text-sm text-gray-600">
                      <Check className="h-[15px] w-[15px] shrink-0 text-checky-teal" strokeWidth={2.5} />
                      {t(`landing.pricing.free.${fk}`)}
                    </li>
                  ))}
                </ul>
              </Card>

              {/* Pro — vedette */}
              <Card className="relative z-10 scale-[1.02] rounded-2xl border border-checky-dark bg-checky-dark p-8 shadow-xl">
                <div className="absolute -top-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-checky-teal px-3 py-1 text-xs font-medium text-white">
                  <Zap className="h-2.5 w-2.5" aria-hidden />
                  {t('landing.pricing.pro.popular')}
                </div>
                <h3 className="mt-2 text-lg font-semibold text-white">{t('landing.pricing.pro.name')}</h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-white">{t('landing.pricing.pro.price')}</span>
                  <span className="text-sm text-white/60">{t('landing.pricing.pro.period')}</span>
                </div>
                <p className="mt-2 text-sm text-white/70">{t('landing.pricing.pro.desc')}</p>
                <Button
                  className="mb-8 mt-6 w-full rounded-full bg-checky-teal text-white hover:bg-checky-teal-hover"
                  onClick={handleGetStarted}
                >
                  {t('landing.pricing.pro.cta')}
                </Button>
                <ul className="space-y-3">
                  {proFeatures.map((fk) => (
                    <li key={fk} className="flex gap-2 text-sm text-white/80">
                      <Check className="h-[15px] w-[15px] shrink-0 text-checky-teal" strokeWidth={2.5} />
                      {t(`landing.pricing.pro.${fk}`)}
                    </li>
                  ))}
                </ul>
              </Card>

              {/* Agence */}
              <Card className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm transition-shadow hover:shadow-md">
                <h3 className="text-lg font-semibold text-checky-dark">{t('landing.pricing.agency.name')}</h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-checky-dark">{t('landing.pricing.agency.price')}</span>
                  <span className="text-sm text-gray-400">{t('landing.pricing.agency.period')}</span>
                </div>
                <p className="mt-2 text-sm text-gray-500">{t('landing.pricing.agency.desc')}</p>
                <Button
                  className="mb-8 mt-6 w-full rounded-full border border-checky-teal bg-transparent text-checky-teal hover:bg-checky-teal hover:text-white"
                  variant="outline"
                  onClick={() => {
                    document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  {t('landing.pricing.agency.cta')}
                </Button>
                <ul className="space-y-3">
                  {agencyFeatures.map((fk) => (
                    <li key={fk} className="flex gap-2 text-sm text-gray-600">
                      <Check className="h-[15px] w-[15px] shrink-0 text-checky-teal" strokeWidth={2.5} />
                      {t(`landing.pricing.agency.${fk}`)}
                    </li>
                  ))}
                </ul>
              </Card>
            </div>

            <p className="mt-8 text-center text-sm text-gray-400">{t('landing.pricing.legal')}</p>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-24 bg-white py-20">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
            <div className="mb-12 text-center">
              <h2 className="mb-3 text-3xl font-bold tracking-tight text-checky-dark md:text-4xl">
                {t('landing.faq.heading')}
              </h2>
              <p className="text-lg text-[#6B7280]">{t('landing.faq.subtitle')}</p>
            </div>

            <div className="mb-10 space-y-3">
              <Accordion type="single" defaultValue="item-1" collapsible className="w-full">
                {faqIds.map((i) => (
                  <AccordionItem
                    key={i}
                    value={`item-${i}`}
                    className="overflow-hidden rounded-xl border border-gray-200 bg-white"
                  >
                    <AccordionTrigger className="px-5 py-4 text-left text-sm font-medium text-checky-dark hover:bg-gray-50 hover:no-underline [&[data-state=open]>svg]:rotate-180 [&>svg]:h-[18px] [&>svg]:w-[18px] [&>svg]:text-[#6B7280]">
                      {t(`landing.faq.q${i}`)}
                    </AccordionTrigger>
                    <AccordionContent className="px-5 pb-5 text-sm leading-relaxed text-[#6B7280]">
                      {t(`landing.faq.a${i}`)}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>

            <div className="flex justify-center">
              <Button
                asChild
                className="rounded-full bg-checky-teal px-8 text-white hover:bg-[#22A8A2] active:bg-[#1A9690]"
              >
                <a href="#contact">{t('landing.faq.discoverCta')}</a>
              </Button>
            </div>
          </div>
        </section>

        {/* Contact */}
        <section id="contact" className="scroll-mt-24 bg-[#F8F9FA] py-20">
          <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
            <div className="mb-12 text-center">
              <h2 className="mb-3 text-3xl font-bold tracking-tight text-checky-dark md:text-4xl">
                {t('landing.contact.heading')}
              </h2>
              <p className="text-lg text-[#6B7280]">{t('landing.contact.subtitle')}</p>
            </div>

            <Card className="rounded-2xl border border-gray-200 bg-white shadow-md">
              <CardContent className="p-6 sm:p-8">
                {contactSuccess ? (
                  <div className="flex flex-col items-center py-12 text-center">
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                      <Check className="h-7 w-7 text-gray-500" strokeWidth={2.5} />
                    </div>
                    <h3 className="text-xl font-bold text-checky-dark">{t('landing.contact.successTitle')}</h3>
                    <p className="mt-2 text-[#6B7280]">{t('landing.contact.successDesc')}</p>
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-6 rounded-full"
                      onClick={() => setContactSuccess(false)}
                    >
                      {t('landing.contact.successDismiss')}
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-checky-dark">{t('landing.contact.name')}</label>
                        <Input
                          required
                          placeholder={t('landing.contact.ph.name')}
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="rounded-lg border-gray-200 focus-visible:border-checky-teal focus-visible:ring-2 focus-visible:ring-checky-teal/40"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-checky-dark">{t('landing.contact.email')}</label>
                        <Input
                          type="email"
                          required
                          placeholder={t('landing.contact.ph.email')}
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className="rounded-lg border-gray-200 focus-visible:border-checky-teal focus-visible:ring-2 focus-visible:ring-checky-teal/40"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-checky-dark">{t('landing.contact.subject')}</label>
                      <Input
                        required
                        placeholder={t('landing.contact.ph.subject')}
                        value={formData.subject}
                        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                        className="rounded-lg border-gray-200 focus-visible:border-checky-teal focus-visible:ring-2 focus-visible:ring-checky-teal/40"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-checky-dark">{t('landing.contact.message')}</label>
                      <Textarea
                        required
                        rows={5}
                        placeholder={t('landing.contact.ph.message')}
                        value={formData.message}
                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                        className="resize-none rounded-lg border-gray-200 focus-visible:border-checky-teal focus-visible:ring-2 focus-visible:ring-checky-teal/40"
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full rounded-full bg-checky-teal py-3 text-base font-semibold text-white hover:bg-[#22A8A2] active:bg-[#1A9690]"
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
                )}
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      <footer className="bg-checky-dark py-16 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 grid grid-cols-1 gap-8 md:grid-cols-4">
            <div className="md:col-span-2">
              <button
                type="button"
                onClick={() => navigate('/')}
                className="mb-4 block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-checky-teal focus-visible:ring-offset-2 focus-visible:ring-offset-checky-dark"
                aria-label={t('landing.aria.home')}
              >
                <img
                  src={checkyLogo}
                  alt="Checky"
                  className="h-7 w-auto max-w-[200px] object-contain object-left"
                />
              </button>
              <p className="max-w-xs text-sm leading-relaxed text-white/60">{t('landing.footer.about')}</p>
              <div className="mt-4 flex flex-wrap gap-4 text-sm text-white/40">
                <a href="#" className="transition-colors hover:text-checky-teal">
                  {t('landing.footer.social.twitter')}
                </a>
                <a href="#" className="transition-colors hover:text-checky-teal">
                  {t('landing.footer.social.linkedin')}
                </a>
                <a href="#" className="transition-colors hover:text-checky-teal">
                  {t('landing.footer.social.instagram')}
                </a>
              </div>
            </div>
            <div>
              <h4 className="mb-4 text-sm font-semibold">{t('landing.footer.col.product')}</h4>
              <ul className="space-y-2 text-sm text-white/60">
                <li>
                  <a href="#services" className="transition-colors hover:text-white">
                    {t('landing.footer.link.services')}
                  </a>
                </li>
                <li>
                  <a href="#pricing" className="transition-colors hover:text-white">
                    {t('landing.footer.link.pricing')}
                  </a>
                </li>
                <li>
                  <a href="#faq" className="transition-colors hover:text-white">
                    {t('landing.footer.link.faq')}
                  </a>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => navigate('/dashboard')}
                    className="text-left transition-colors hover:text-white"
                  >
                    {t('landing.footer.link.dashboard')}
                  </button>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="mb-4 text-sm font-semibold">{t('landing.footer.col.legal')}</h4>
              <ul className="space-y-2 text-sm text-white/60">
                <li>
                  <a href="#" className="transition-colors hover:text-white">
                    {t('landing.footer.link.privacy')}
                  </a>
                </li>
                <li>
                  <a href="#" className="transition-colors hover:text-white">
                    {t('landing.footer.link.terms')}
                  </a>
                </li>
                <li>
                  <a href="#contact" className="transition-colors hover:text-white">
                    {t('landing.footer.link.contact')}
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="flex flex-col gap-4 border-t border-white/10 pt-8 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-white/40">{t('landing.footer.copyright', { year })}</p>
            <p className="text-xs text-white/40">{t('landing.footer.legalLine')}</p>
          </div>
        </div>
      </footer>
    </div>
  );
};
