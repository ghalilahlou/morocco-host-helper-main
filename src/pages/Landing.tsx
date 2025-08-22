import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Building2, CheckCircle, FileText, Shield, Mail, User, MessageSquare, Send } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import checkyLogo from '/lovable-uploads/350a73a3-7335-4676-9ce0-4f747b7c0a93.png';
import heroLaptop from '@/assets/hero-laptop.jpg';
export const Landing = () => {
  const navigate = useNavigate();
  const {
    isAuthenticated
  } = useAuth();
  const {
    toast
  } = useToast();
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

    // Simulate form submission
    await new Promise(resolve => setTimeout(resolve, 1000));
    toast({
      title: "Message envoyé",
      description: "Nous vous répondrons dans les plus brefs délais."
    });
    setFormData({
      name: '',
      email: '',
      subject: '',
      message: ''
    });
    setIsSubmitting(false);
  };
  const handleGetStarted = () => {
    if (isAuthenticated) {
      navigate('/dashboard');
    } else {
      navigate('/auth');
    }
  };
  return <div className="min-h-screen" style={{ backgroundColor: 'hsl(var(--home-bg))' }}>
      {/* Header/Navigation */}
      <header className="fixed top-0 w-full bg-white/95 backdrop-blur-sm border-b border-gray-200 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Logo */}
            <div className="flex items-center">
              <button onClick={() => navigate('/')} className="focus:outline-none transition-transform hover:scale-105" aria-label="Retour à l'accueil">
                <img src={checkyLogo} alt="Checky Logo" className="w-48 h-48 object-contain cursor-pointer" />
              </button>
            </div>

            {/* Navigation */}
            <nav className="hidden md:flex items-center space-x-8">
              <a href="#services" className="text-gray-600 hover:text-gray-900 transition-colors font-medium">
                Services
              </a>
              <button onClick={() => navigate('/pricing')} className="text-gray-600 hover:text-gray-900 transition-colors font-medium">
                Tarifs
              </button>
              <a href="#faq" className="text-gray-600 hover:text-gray-900 transition-colors font-medium">
                FAQ
              </a>
              <a href="#contact" className="text-gray-600 hover:text-gray-900 transition-colors font-medium">
                Contact
              </a>
            </nav>

            {/* Auth Buttons */}
            <div className="flex items-center space-x-2 sm:space-x-3">
              {isAuthenticated ? <Button onClick={() => navigate('/dashboard')} variant="default" className="bg-primary hover:bg-primary/90">
                  Dashboard
                </Button> : <>
                  <Button onClick={() => navigate('/auth')} size="sm" className="bg-[hsl(var(--cta-basic))] text-gray-900 hover:opacity-90 border-0 text-xs sm:text-sm px-3 sm:px-4">
                    Se connecter
                  </Button>
                  <Button onClick={() => navigate('/auth')} size="sm" className="bg-primary hover:bg-primary/90 text-white text-xs sm:text-sm px-3 sm:px-4">
                    S'inscrire
                  </Button>
                </>}
            </div>
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="pt-28 pb-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
          {/* Background Image */}
          <div className="absolute inset-0 z-0">
            <img src={heroLaptop} alt="Hero Background" className="w-full h-full object-cover opacity-20" />
            <div className="absolute inset-0 bg-gradient-to-r from-white/80 to-white/60"></div>
          </div>
          
          <div className="max-w-4xl mx-auto text-center relative z-10">
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
              Votre Assistant
              <span className="block text-primary">Check-in</span>
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto leading-relaxed">Simplifiez la conformité de vos locations Airbnb au Maroc. Automatisez la collecte de pièces d'identité et la génération des documents légaux.</p>
            <Button onClick={handleGetStarted} size="lg" className="text-lg px-8 py-3 bg-primary hover:bg-primary/90 shadow-lg hover:shadow-xl transition-all duration-300">
              Commencer maintenant
            </Button>
          </div>
        </section>

        {/* Services Section */}
        <section id="services" className="py-20 relative overflow-hidden">
          {/* Background decoration */}
          
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                Nos Services
              </h2>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto">Une solution complète pour la gestion de vos obligations légales de loueur Airbnb</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Service 1 */}
              <Card className="group hover:shadow-xl transition-all duration-300 border-0 shadow-lg bg-white/80 backdrop-blur-sm">
                <CardHeader className="text-center pb-4">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 transition-colors" style={{ backgroundColor: "hsl(var(--cta-pay) / 0.12)" }}>
                    <CheckCircle className="w-8 h-8 text-[hsl(var(--cta-pay))]" />
                  </div>
                  <CardTitle className="text-xl font-semibold text-gray-900">
                    Check-in Simplifié
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-gray-600 text-center leading-relaxed">
                    Automatisez le processus d'arrivée de vos invités avec des liens personnalisés 
                    et une interface moderne.
                  </CardDescription>
                </CardContent>
              </Card>

              {/* Service 2 */}
              <Card className="group hover:shadow-xl transition-all duration-300 border-0 shadow-lg bg-white/80 backdrop-blur-sm">
                <CardHeader className="text-center pb-4">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 transition-colors" style={{ backgroundColor: "hsl(var(--brand-2) / 0.12)" }}>
                    <Shield className="w-8 h-8 text-[hsl(var(--brand-2))]" />
                  </div>
                  <CardTitle className="text-xl font-semibold text-gray-900">
                    Collecte d'ID
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-gray-600 text-center leading-relaxed">
                    Vos invités téléchargent leurs pièces d'identité en toute sécurité 
                    depuis leur mobile.
                  </CardDescription>
                </CardContent>
              </Card>

              {/* Service 3 */}
              <Card className="group hover:shadow-xl transition-all duration-300 border-0 shadow-lg bg-white/80 backdrop-blur-sm">
                <CardHeader className="text-center pb-4">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 transition-colors" style={{ backgroundColor: "hsl(var(--brand-3) / 0.18)" }}>
                    <FileText className="w-8 h-8 text-[hsl(var(--brand-3))]" />
                  </div>
                  <CardTitle className="text-xl font-semibold text-gray-900">
                    Documents Légaux
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-gray-600 text-center leading-relaxed">Générez automatiquement des fiches de police et contrats de location conformes à la réglementation marocaine.</CardDescription>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section id="faq" className="py-20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                Questions Fréquentes
              </h2>
              <p className="text-xl text-gray-600">
                Tout ce que vous devez savoir sur Checky
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-8">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Comment fonctionne Checky ?</h3>
                  <p className="text-gray-600 leading-relaxed">
                    Checky automatise le processus de check-in de vos invités Airbnb. Vos invités reçoivent un lien personnalisé pour télécharger leurs documents d'identité et signer le contrat de location.
                  </p>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Les documents sont-ils conformes à la loi marocaine ?</h3>
                  <p className="text-gray-600 leading-relaxed">
                    Oui, tous nos documents (fiches de police, contrats) respectent scrupuleusement la réglementation marocaine en vigueur pour les locations courte durée.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Puis-je essayer gratuitement ?</h3>
                  <p className="text-gray-600 leading-relaxed">
                    Absolument ! Vous bénéficiez de 3 vérifications gratuites dès votre inscription, sans engagement et sans carte bancaire.
                  </p>
                </div>
              </div>
              
              <div className="space-y-8">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Mes données sont-elles sécurisées ?</h3>
                  <p className="text-gray-600 leading-relaxed">
                    La sécurité est notre priorité. Toutes les données sont chiffrées et stockées sur des serveurs sécurisés. Nous respectons le RGPD et la confidentialité de vos invités.
                  </p>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Combien de temps prend le processus ?</h3>
                  <p className="text-gray-600 leading-relaxed">
                    Le processus complet (upload des documents, génération des fiches de police et signature du contrat) prend généralement 5-10 minutes pour vos invités.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Support client disponible ?</h3>
                  <p className="text-gray-600 leading-relaxed">
                    Nous offrons un support par email pour tous les plans. Les utilisateurs Premium bénéficient également d'un support téléphonique prioritaire.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Contact Section */}
        <section id="contact" className="py-20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                Nous Contacter
              </h2>
              <p className="text-xl text-gray-600">
                Une question ? Besoin d'aide ? Contactez notre équipe
              </p>
            </div>

            <Card className="shadow-lg border-0 bg-white">
              <CardContent className="p-8">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 flex items-center">
                        <User className="w-4 h-4 mr-2" />
                        Nom complet
                      </label>
                      <Input type="text" value={formData.name} onChange={e => setFormData({
                      ...formData,
                      name: e.target.value
                    })} required className="border-gray-300 focus:border-primary bg-white" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 flex items-center">
                        <Mail className="w-4 h-4 mr-2" />
                        Email
                      </label>
                      <Input type="email" value={formData.email} onChange={e => setFormData({
                      ...formData,
                      email: e.target.value
                    })} required className="border-gray-300 focus:border-primary bg-white" />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 flex items-center">
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Sujet
                    </label>
                    <Input type="text" value={formData.subject} onChange={e => setFormData({
                    ...formData,
                    subject: e.target.value
                  })} required className="border-gray-300 focus:border-primary bg-white" />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Message
                    </label>
                    <Textarea value={formData.message} onChange={e => setFormData({
                    ...formData,
                    message: e.target.value
                  })} required rows={5} className="border-gray-300 focus:border-primary resize-none bg-white" />
                  </div>
                  
                  <Button type="submit" className="w-full md:w-auto bg-primary hover:bg-primary/90" disabled={isSubmitting}>
                    {isSubmitting ? "Envoi en cours..." : <>
                        <Send className="w-4 h-4 mr-2" />
                        Envoyer le message
                      </>}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <button onClick={() => navigate('/')} className="flex items-center space-x-3 mb-4 md:mb-0 focus:outline-none transition-transform hover:scale-105" aria-label="Retour à l'accueil">
              <img src={checkyLogo} alt="Checky Logo" className="w-12 h-12 object-contain cursor-pointer" />
              <span className="text-xl font-bold">Checky</span>
            </button>
            <div className="text-gray-400 text-sm">
              © 2025 Checky. Conformité Airbnb Maroc simplifiée.
            </div>
          </div>
        </div>
      </footer>
    </div>;
};