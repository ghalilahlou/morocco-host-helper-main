import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Check, Eye, EyeOff, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import imgLogin from '@/assets/service-apartment.jpg';
import imgRegister from '@/assets/hero-riad.jpg';
import checkyLogo from '@/assets/logo.png';
import { urls } from '@/config/runtime';
import { useT, useGuestLocale } from '@/i18n/GuestLocaleProvider';
import type { Locale } from '@/i18n';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (r: { credential: string }) => void }) => void;
          renderButton: (element: HTMLElement, options: object) => void;
        };
      };
    };
  }
}

const LANGUAGES: { code: Locale; label: string }[] = [
  { code: 'fr', label: 'FR' },
  { code: 'en', label: 'EN' },
  { code: 'es', label: 'ES' },
];

type AuthTab = 'signin' | 'signup';

function passwordStrength(password: string): 0 | 1 | 2 | 3 {
  if (!password.length) return 0;
  if (password.length < 6) return 1;
  const hasComplex = /[A-Z]/.test(password) && /[0-9]/.test(password) && password.length >= 10;
  if (hasComplex) return 3;
  return 2;
}

const GOOGLE_CLIENT_ID =
  (import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ||
    import.meta.env.VITE_GOOGLEqu_CLIENT_ID?.trim()) as string | undefined;

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const [authTab, setAuthTab] = useState<AuthTab>(() => {
    const t = searchParams.get('tab');
    return t === 'signup' || t === 'register' ? 'signup' : 'signin';
  });
  const navigate = useNavigate();
  const hasCheckedSession = useRef(false);
  const { toast } = useToast();
  const t = useT();
  const { locale, setLocale } = useGuestLocale();

  const strength = useMemo(() => passwordStrength(password), [password]);
  const strengthLabel = useMemo(() => {
    if (strength === 0) return '';
    const keys = ['', 'auth.password.weak', 'auth.password.medium', 'auth.password.strong'] as const;
    return t(keys[strength]);
  }, [strength, t, locale]);

  const signupBullets = useMemo(
    () => [t('auth.panel.bullet1'), t('auth.panel.bullet2'), t('auth.panel.bullet3')],
    [t, locale]
  );

  const panelImageSrc = authTab === 'signup' ? imgRegister : imgLogin;

  // Ref to always call the latest version of the callback (avoids stale closure in GIS)
  const credentialCallbackRef = useRef<((r: { credential: string }) => void) | undefined>(undefined);
  credentialCallbackRef.current = async (response: { credential: string }) => {
    try {
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: response.credential,
      });
      if (error) throw error;
      navigate('/dashboard/');
    } catch (err: any) {
      toast({
        title: t('auth.toast.googleError'),
        description: (err as Error).message || t('auth.toast.googleErrorDesc'),
        variant: 'destructive',
      });
    }
  };

  // Load Google Identity Services after the real auth layout is mounted (not the session splash),
  // otherwise getElementById finds nothing and the buttons never render.
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || isCheckingSession) return;

    const stableCallback = (r: { credential: string }) => credentialCallbackRef.current?.(r);

    const renderButtons = () => {
      if (!window.google) return;
      const opts = { theme: 'outline', size: 'large', width: 340, text: 'continue_with' };
      const siEl = document.getElementById('google-signin-btn');
      const suEl = document.getElementById('google-signup-btn');
      if (siEl) window.google.accounts.id.renderButton(siEl, opts);
      if (suEl) window.google.accounts.id.renderButton(suEl, opts);
    };

    const initGoogle = () => {
      if (!window.google) return;
      window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: stableCallback });
      // Wait until Radix Tabs (and forceMount panels) have painted
      requestAnimationFrame(() => requestAnimationFrame(renderButtons));
    };

    let script: HTMLScriptElement | null = null;
    if (window.google) {
      initGoogle();
    } else {
      script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = initGoogle;
      document.body.appendChild(script);
    }

    return () => {
      if (script && document.body.contains(script)) document.body.removeChild(script);
    };
  }, [isCheckingSession]);

  // Sync tab with URL params
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'signup' || tabParam === 'register') setAuthTab('signup');
    else if (tabParam === null || tabParam === 'signin') setAuthTab('signin');
  }, [searchParams]);

  const setTab = (v: AuthTab) => {
    setAuthTab(v);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (v === 'signup') next.set('tab', 'signup');
        else next.delete('tab');
        return next;
      },
      { replace: true }
    );
  };

  useEffect(() => {
    if (hasCheckedSession.current) return;
    hasCheckedSession.current = true;

    const checkUser = async () => {
      try {
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000));
        const sessionPromise = supabase.auth.getSession();
        const result = (await Promise.race([sessionPromise, timeoutPromise])) as any;
        if (result?.data?.session) {
          navigate('/dashboard/');
          return;
        }
      } catch {
        // ignore
      } finally {
        setIsCheckingSession(false);
      }
    };

    checkUser();
  }, [navigate]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({
        title: t('auth.toast.errorTitle'),
        description: t('auth.toast.fillFields'),
        variant: 'destructive',
      });
      return;
    }
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${urls.app.base}/auth/callback`,
          data: { email_confirm: false },
        },
      });
      if (error) throw error;

      if (data.user && !data.session) {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError && (signInError.message.includes('email_not_confirmed') || signInError.message.includes('Email not confirmed'))) {
          toast({
            title: t('auth.toast.accountCreated'),
            description: t('auth.toast.confirmEmail'),
            variant: 'success',
          });
        } else if (signInError) {
          throw signInError;
        } else {
          toast({ title: t('auth.toast.successTitle'), description: t('auth.toast.signupSuccess') });
          navigate('/dashboard/');
        }
      } else if (data.session) {
        toast({ title: t('auth.toast.successTitle'), description: t('auth.toast.signupSuccess') });
        navigate('/dashboard/');
      }
    } catch (error: any) {
      if (error.message?.includes('429') || error.message?.includes('rate limit')) {
        toast({
          title: t('auth.toast.rateLimit'),
          description: t('auth.toast.rateLimitDesc'),
          variant: 'destructive',
        });
      } else {
        toast({
          title: t('auth.toast.signupError'),
          description: error.message || t('auth.toast.signupErrorDesc'),
          variant: 'destructive',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({
        title: t('auth.toast.errorTitle'),
        description: t('auth.toast.fillFields'),
        variant: 'destructive',
      });
      return;
    }
    setIsLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setIsLoading(false);
    if (error) {
      toast({ title: t('auth.toast.signinError'), description: error.message, variant: 'destructive' });
    } else {
      if (window.innerWidth >= 768) {
        toast({ title: t('auth.toast.successTitle'), description: t('auth.toast.welcomeBack') });
      }
      navigate('/dashboard/');
    }
  };

  if (isCheckingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <img src={checkyLogo} alt="Checky" className="h-20 w-20 animate-pulse object-contain" />
          <Loader2 className="h-6 w-6 animate-spin text-checky-teal" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-white lg:flex-row">
      {/* Panneau gauche : image + voile — caché sur mobile */}
      <div className="relative hidden min-h-[40vh] w-full lg:flex lg:min-h-screen lg:w-1/2">
        <img
          key={authTab}
          src={panelImageSrc}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        <div
          className="absolute inset-0 bg-gradient-to-b from-[rgba(26,26,46,0.88)] to-[rgba(26,26,46,0.78)]"
          aria-hidden
        />
        <div className="relative z-10 flex h-full min-h-[min(100vh,720px)] flex-col justify-between p-8 lg:p-12">
          <Link to="/" className="w-fit">
            <img
              src={checkyLogo}
              alt="Checky"
              className="h-8 w-auto object-contain brightness-0 invert"
            />
          </Link>

          <div className="flex flex-1 flex-col justify-center py-8">
            {authTab === 'signin' ? (
              <>
                <h2 className="text-4xl font-bold tracking-tight text-white lg:text-[2.25rem]">
                  {t('auth.panel.welcomeTitle')}
                </h2>
                <p className="mt-4 text-lg text-white/60">{t('auth.panel.welcomeSubtitle')}</p>
              </>
            ) : (
              <>
                <h2 className="text-4xl font-bold tracking-tight text-white lg:text-[2.25rem]">
                  {t('auth.panel.signupTitle')}
                </h2>
                <ul className="mt-8 space-y-4">
                  {signupBullets.map((line) => (
                    <li key={line} className="flex items-start gap-3 text-sm text-white/70">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-checky-teal/30">
                        <Check className="h-[11px] w-[11px] text-checky-teal" strokeWidth={3} />
                      </span>
                      {line}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          <p className="text-xs text-white/30">{t('auth.panel.copyright', { year: new Date().getFullYear() })}</p>
        </div>
      </div>

      {/* Panneau droit : formulaire */}
      <div className="flex flex-1 flex-col justify-center px-4 py-10 sm:px-8 lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 lg:justify-end">
            <Link to="/" className="inline-block lg:hidden">
              <img src={checkyLogo} alt="Checky" className="h-8 w-auto object-contain" />
            </Link>
            <div className="flex items-center gap-0.5 rounded-full border border-gray-200 bg-gray-50/90 p-0.5 sm:ml-auto">
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
          </div>

          <Tabs value={authTab} onValueChange={(v) => setTab(v as AuthTab)} className="w-full">
            <TabsList className="grid h-12 w-full grid-cols-2 rounded-full border border-gray-200 bg-gray-50 p-1">
              <TabsTrigger
                value="signin"
                className="rounded-full text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-checky-dark data-[state=active]:shadow-sm"
              >
                {t('auth.tab.signin')}
              </TabsTrigger>
              <TabsTrigger
                value="signup"
                className="rounded-full text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-checky-dark data-[state=active]:shadow-sm"
              >
                {t('auth.tab.signup')}
              </TabsTrigger>
            </TabsList>

            <TabsContent
              value="signin"
              forceMount
              className="mt-8 space-y-6 outline-none data-[state=inactive]:hidden"
            >
              <div>
                <h1 className="text-[1.875rem] font-extrabold tracking-tight text-[#1A1A2E]">{t('auth.signin.title')}</h1>
                <p className="mt-1 text-sm text-gray-500">
                  {t('auth.signin.noAccount')}{' '}
                  <button
                    type="button"
                    className="font-semibold text-checky-teal transition-colors hover:text-[#22A8A2]"
                    onClick={() => setTab('signup')}
                  >
                    {t('auth.signin.createAccount')}
                  </button>
                </p>
              </div>

              {/* Google Identity Services injects the official button here */}
              <div className="flex justify-center">
                <div id="google-signin-btn" />
              </div>

              <div className="relative">
                <Separator className="bg-gray-200" />
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-3 text-xs text-gray-400">
                  {t('auth.signin.or')}
                </span>
              </div>

              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email" className="text-sm font-medium text-[#1A1A2E]">
                    {t('auth.signin.email')}
                  </Label>
                  <Input
                    id="signin-email"
                    type="email"
                    autoComplete="email"
                    placeholder={t('auth.signin.placeholderEmail')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    className="rounded-xl border-gray-200 focus-visible:border-checky-teal focus-visible:ring-checky-teal/40"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password" className="text-sm font-medium text-[#1A1A2E]">
                    {t('auth.signin.password')}
                  </Label>
                  <div className="relative">
                    <Input
                      id="signin-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder={t('auth.signin.placeholderPassword')}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isLoading}
                      className="rounded-xl border-gray-200 pr-11 focus-visible:border-checky-teal focus-visible:ring-checky-teal/40"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                      aria-label={showPassword ? t('auth.signin.hidePassword') : t('auth.signin.showPassword')}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="h-12 w-full rounded-full bg-checky-teal text-base font-semibold text-white hover:bg-[#22A8A2] active:bg-[#1A9690]"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('auth.signin.submitting')}
                    </>
                  ) : (
                    t('auth.signin.submit')
                  )}
                </Button>
              </form>

              <p className="text-center text-xs text-gray-400">{t('auth.signin.demoNote')}</p>
            </TabsContent>

            <TabsContent
              value="signup"
              forceMount
              className="mt-8 space-y-6 outline-none data-[state=inactive]:hidden"
            >
              <div>
                <h1 className="text-[1.875rem] font-extrabold tracking-tight text-[#1A1A2E]">{t('auth.signup.title')}</h1>
                <p className="mt-1 text-sm text-gray-500">
                  {t('auth.signup.hasAccount')}{' '}
                  <button
                    type="button"
                    className="font-semibold text-checky-teal transition-colors hover:text-[#22A8A2]"
                    onClick={() => setTab('signin')}
                  >
                    {t('auth.signup.signInLink')}
                  </button>
                </p>
              </div>

              {/* Google Identity Services injects the official button here */}
              <div className="flex justify-center">
                <div id="google-signup-btn" />
              </div>

              <div className="relative">
                <Separator className="bg-gray-200" />
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-3 text-xs text-gray-400">
                  {t('auth.signup.or')}
                </span>
              </div>

              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-email" className="text-sm font-medium text-[#1A1A2E]">
                    {t('auth.signin.email')}
                  </Label>
                  <Input
                    id="signup-email"
                    type="email"
                    autoComplete="email"
                    placeholder={t('auth.signin.placeholderEmail')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    className="rounded-xl border-gray-200 focus-visible:border-checky-teal focus-visible:ring-checky-teal/40"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password" className="text-sm font-medium text-[#1A1A2E]">
                    {t('auth.signin.password')}
                  </Label>
                  <div className="relative">
                    <Input
                      id="signup-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder={t('auth.signup.passwordPlaceholder')}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isLoading}
                      className="rounded-xl border-gray-200 pr-11 focus-visible:border-checky-teal focus-visible:ring-checky-teal/40"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                      aria-label={showPassword ? t('auth.signin.hidePassword') : t('auth.signin.showPassword')}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {password.length > 0 && (
                    <div className="flex items-center gap-2 pt-1">
                      <div className="flex flex-1 gap-1">
                        {([1, 2, 3] as const).map((i) => {
                          let fill = 'bg-gray-200';
                          if (strength === 1 && i === 1) fill = 'bg-red-400';
                          else if (strength === 2 && i <= 2) fill = 'bg-yellow-400';
                          else if (strength === 3) fill = 'bg-green-500';
                          return <div key={i} className={cn('h-1 flex-1 rounded-full', fill)} />;
                        })}
                      </div>
                      {strength > 0 && (
                        <span className="text-[10px] text-gray-400">{strengthLabel}</span>
                      )}
                    </div>
                  )}
                </div>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="h-12 w-full rounded-full bg-checky-teal text-base font-semibold text-white hover:bg-[#22A8A2] active:bg-[#1A9690]"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('auth.signup.submitting')}
                    </>
                  ) : (
                    t('auth.signup.submit')
                  )}
                </Button>
              </form>

              <p className="text-center text-xs text-gray-400">
                {t('auth.signup.legalBefore')}{' '}
                <a href="#" className="font-medium text-checky-teal underline hover:text-[#22A8A2]">
                  {t('auth.signup.legalCgu')}
                </a>{' '}
                {t('auth.signup.legalAnd')}{' '}
                <a href="#" className="font-medium text-checky-teal underline hover:text-[#22A8A2]">
                  {t('auth.signup.legalPrivacy')}
                </a>
                .
              </p>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
