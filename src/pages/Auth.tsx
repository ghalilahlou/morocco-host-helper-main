import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import authImage from '@/assets/hero-laptop.jpg';
export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const {
    toast
  } = useToast();
  useEffect(() => {
    // Check if user is already logged in
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate('/dashboard/');
      }
    };
    checkUser();
  }, [navigate]);
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
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
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
        data: _signInData,
        error: signInError
      } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        if (signInError?.message.includes('email_not_confirmed')) {
          toast({
            title: "Compte créé avec succès",
            description: "Confirmez la création de votre compte en cliquant sur le lien de l'email que vous venez de recevoir",
            variant: "success"
          });
        } else if (signInError?.message.includes('Email not confirmed')) {
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
              } else if (data?.session) {
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
              <form onSubmit={handleSignIn} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                    <Input id="signin-email" type="email" placeholder="Enter your email" value={email} onChange={e => setEmail(e.target.value)} disabled={isLoading} className="bg-[hsl(var(--home-bg))] text-gray-900 placeholder-gray-700 border-gray-300" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password">Password</Label>
                    <Input id="signin-password" type="password" placeholder="Enter your password" value={password} onChange={e => setPassword(e.target.value)} disabled={isLoading} className="bg-[hsl(var(--home-bg))] text-gray-900 placeholder-gray-700 border-gray-300" />
                </div>
                <Button type="submit" className="w-full hover:opacity-90" disabled={isLoading}>
                  {isLoading ? "Signing in..." : "Se connecter"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                    <Input id="signup-email" type="email" placeholder="Enter your email" value={email} onChange={e => setEmail(e.target.value)} disabled={isLoading} className="bg-[hsl(var(--home-bg))] text-gray-900 placeholder-gray-700 border-gray-300" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                    <Input id="signup-password" type="password" placeholder="Create a password" value={password} onChange={e => setPassword(e.target.value)} disabled={isLoading} className="bg-[hsl(var(--home-bg))] text-gray-900 placeholder-gray-700 border-gray-300" />
                </div>
                <Button type="submit" className="w-full hover:opacity-90" disabled={isLoading}>
                  {isLoading ? "Creating account..." : "S’inscrire"}
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
