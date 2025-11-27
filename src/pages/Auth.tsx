import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import authImage from '@/assets/hero-laptop.jpg';
export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const navigate = useNavigate();
  const {
    toast
  } = useToast();
  useEffect(() => {
    // Check if user is already logged in
    const checkUser = async () => {
      const {
        data: {
          session
        }
      } = await supabase.auth.getSession();
      if (session) {
        navigate('/dashboard/');
      }
    };
    checkUser();
  }, [navigate]);

  // ✅ NOUVEAU : Authentification Google OAuth
  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          }
        }
      });

      if (error) {
        throw error;
      }

      // OAuth redirect will happen automatically
      // No need to show toast here as user will be redirected
    } catch (error: any) {
      console.error('Google sign in error:', error);
      toast({
        title: "Erreur de connexion Google",
        description: error.message || "Impossible de se connecter avec Google",
        variant: "destructive"
      });
      setIsGoogleLoading(false);
    }
  };
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive"
      });
      return;
    }
    setIsLoading(true);
    try {
      // Create account via Supabase Admin API to bypass email confirmation
      const {
        data,
        error
      } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `https://morocco-host-helper-main.vercel.app/auth/callback`,
          data: {
            email_confirm: false
          }
        }
      });
      if (error) {
        throw error;
      }

      // If account was created but requires confirmation, try direct sign-in
      if (data.user && !data.session) {
        const {
          data: signInData,
          error: signInError
        } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        if (signInError && signInError.message.includes('email_not_confirmed')) {
          toast({
            title: "Compte créé avec succès",
            description: "Confirmez la création de votre compte en cliquant sur le lien de l'email que vous venez de recevoir",
            variant: "success"
          });
        } else if (signInError && signInError.message.includes('Email not confirmed')) {
          toast({
            title: "Compte créé avec succès",
            description: "Confirmez la création de votre compte en cliquant sur le lien de l'email que vous venez de recevoir",
            variant: "success"
          });
        } else if (signInError) {
          throw signInError;
        } else {
          toast({
            title: "Success!",
            description: "Account created and signed in successfully!"
          });
          navigate('/dashboard/');
        }
      } else if (data.session) {
        toast({
          title: "Success!",
          description: "Account created and signed in successfully!"
        });
        navigate('/dashboard/');
      }
    } catch (error: any) {
      if (error.message.includes('429') || error.message.includes('rate limit')) {
        toast({
          title: "Limite atteinte",
          description: "Trop de tentatives. Veuillez attendre avant de réessayer.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Erreur de création de compte",
          description: error.message || "Une erreur inattendue s'est produite",
          variant: "destructive"
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
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive"
      });
      return;
    }
    setIsLoading(true);
    const {
      error
    } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    setIsLoading(false);
    if (error) {
      toast({
        title: "Sign In Error",
        description: error.message,
        variant: "destructive"
      });
    } else {
      // Only show welcome toast on desktop
      if (window.innerWidth >= 768) {
        toast({
          title: "Success!",
          description: "Welcome back!"
        });
      }
      navigate('/dashboard/');
    }
  };
  return <div className="min-h-screen bg-white">
      <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-6 p-4 md:p-8">
        {/* Left: Auth form */}
        <div className="bg-white border rounded-xl shadow-sm p-8 md:p-10 flex flex-col">
          <Link to="/" className="mb-6 w-fit">
            <img
              src="/lovable-uploads/350a73a3-7335-4676-9ce0-4f747b7c0a93.png"
              alt="Checky Logo"
              className="w-28 h-28 object-contain hover:opacity-80 transition-opacity cursor-pointer"
            />
          </Link>

          <h1 className="text-3xl font-bold mb-6">Accédez à votre compte</h1>

          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2 rounded-lg bg-[hsl(var(--cta-basic)/0.2)] border border-[hsl(var(--cta-basic))] text-[hsl(var(--cta-basic))]">
              <TabsTrigger value="signin" className="rounded-md data-[state=active]:bg-[hsl(var(--cta-basic))] data-[state=active]:text-gray-900">Se connecter</TabsTrigger>
              <TabsTrigger value="signup" className="rounded-md data-[state=active]:bg-[hsl(var(--cta-basic))] data-[state=active]:text-gray-900">S’inscrire</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              {/* ✅ NOUVEAU : Bouton Google OAuth */}
              <div className="space-y-4 mt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full flex items-center justify-center gap-3 hover:bg-gray-50 border-2 border-gray-300 h-11"
                  onClick={handleGoogleSignIn}
                  disabled={isGoogleLoading || isLoading}
                >
                  {isGoogleLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <svg className="h-5 w-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                  )}
                  <span className="font-medium text-gray-700">
                    {isGoogleLoading ? "Connexion..." : "Continuer avec Google"}
                  </span>
                </Button>

                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <Separator className="w-full" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-2 text-gray-500">Ou</span>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                    <Input id="signin-email" type="email" autoComplete="email" placeholder="Enter your email" value={email} onChange={e => setEmail(e.target.value)} disabled={isLoading || isGoogleLoading} className="bg-[hsl(var(--home-bg))] text-gray-900 placeholder-gray-700 border-gray-300" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password">Password</Label>
                    <Input id="signin-password" type="password" autoComplete="current-password" placeholder="Enter your password" value={password} onChange={e => setPassword(e.target.value)} disabled={isLoading || isGoogleLoading} className="bg-[hsl(var(--home-bg))] text-gray-900 placeholder-gray-700 border-gray-300" />
                </div>
                <Button type="submit" className="w-full hover:opacity-90" disabled={isLoading || isGoogleLoading}>
                  {isLoading ? "Signing in..." : "Se connecter"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              {/* ✅ NOUVEAU : Bouton Google OAuth pour inscription */}
              <div className="space-y-4 mt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full flex items-center justify-center gap-3 hover:bg-gray-50 border-2 border-gray-300 h-11"
                  onClick={handleGoogleSignIn}
                  disabled={isGoogleLoading || isLoading}
                >
                  {isGoogleLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <svg className="h-5 w-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                  )}
                  <span className="font-medium text-gray-700">
                    {isGoogleLoading ? "Inscription..." : "S'inscrire avec Google"}
                  </span>
                </Button>

                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <Separator className="w-full" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-2 text-gray-500">Ou</span>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                    <Input id="signup-email" type="email" autoComplete="email" placeholder="Enter your email" value={email} onChange={e => setEmail(e.target.value)} disabled={isLoading || isGoogleLoading} className="bg-[hsl(var(--home-bg))] text-gray-900 placeholder-gray-700 border-gray-300" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                    <Input id="signup-password" type="password" autoComplete="new-password" placeholder="Create a password" value={password} onChange={e => setPassword(e.target.value)} disabled={isLoading || isGoogleLoading} className="bg-[hsl(var(--home-bg))] text-gray-900 placeholder-gray-700 border-gray-300" />
                </div>
                <Button type="submit" className="w-full hover:opacity-90" disabled={isLoading || isGoogleLoading}>
                  {isLoading ? "Creating account..." : "S'inscrire"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right: Brand image */}
        <div className="hidden md:block relative rounded-xl overflow-hidden border shadow-sm">
          <img src={authImage} alt="Espace de travail moderne correspondant aux couleurs Checky" className="w-full h-full object-cover" />
        </div>
      </div>
    </div>;
}