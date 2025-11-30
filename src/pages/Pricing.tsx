import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Building2, Users, Shield } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export const Pricing = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const handleGetStarted = (plan: string) => {
    if (isAuthenticated) {
      navigate('/dashboard');
    } else {
      navigate('/auth');
    }
  };

  const plans = [
    {
      name: "Pay per Check",
      price: "15",
      currency: "DHS",
      period: "par vérification",
      description: "Payez uniquement pour ce que vous utilisez",
      features: [
        "15 DHS par vérification",
        "Pas d'abonnement",
        "Idéal pour usage occasionnel",
        "Support par email"
      ],
      icon: <Shield className="w-6 h-6" />,
      popular: false,
      color: "border-gray-200"
    },
    {
      name: "Basic",
      price: "200",
      currency: "DHS",
      period: "par mois",
      description: "Parfait pour les propriétaires avec une propriété",
      features: [
        "15 vérifications incluses",
        "1 propriété",
        "Génération automatique des documents",
        "Support prioritaire",
        "Tableau de bord complet"
      ],
      icon: <Building2 className="w-6 h-6" />,
      popular: true,
      color: "border-primary"
    },
    {
      name: "Premium",
      price: "300",
      currency: "DHS",
      period: "par mois",
      description: "Pour les gestionnaires avec plusieurs propriétés",
      features: [
        "50 vérifications incluses",
        "Propriétés illimitées",
        "Gestion multi-propriétés",
        "Analytics avancés",
        "Support téléphonique",
        "API access"
      ],
      icon: <Users className="w-6 h-6" />,
      popular: false,
      color: "border-purple-500"
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Header/Navigation */}
      <header className="fixed top-0 w-full bg-white/95 backdrop-blur-sm border-b border-gray-200 z-50">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            {/* Logo */}
            <div className="flex items-center space-x-2 sm:space-x-3">
              <button 
                onClick={() => navigate('/')} 
                className="focus:outline-none transition-transform hover:scale-105"
                aria-label="Retour à l'accueil"
              >
                <img 
                  src="/lovable-uploads/350a73a3-7335-4676-9ce0-4f747b7c0a93.png" 
                  alt="Checky Logo" 
                  className="w-24 h-24 sm:w-32 sm:h-32 md:w-40 md:h-40 lg:w-48 lg:h-48 object-contain cursor-pointer" 
                />
              </button>
            </div>

            {/* Navigation */}
            <nav className="hidden md:flex items-center space-x-8">
              <button onClick={() => navigate('/')} className="text-gray-600 hover:text-gray-900 transition-colors font-medium">
                Accueil
              </button>
              <a href="/#services" className="text-gray-600 hover:text-gray-900 transition-colors font-medium">
                Services
              </a>
              <span className="text-primary font-medium">Tarifs</span>
              <a href="/#contact" className="text-gray-600 hover:text-gray-900 transition-colors font-medium">
                Contact
              </a>
            </nav>

            {/* Auth Buttons */}
            <div className="flex items-center space-x-3">
              {isAuthenticated ? (
                <Button onClick={() => navigate('/dashboard')} variant="default" className="bg-primary hover:bg-primary/90">
                  Dashboard
                </Button>
              ) : (
                <>
                  <Button onClick={() => navigate('/auth')} className="bg-[hsl(var(--cta-basic))] text-gray-900 hover:opacity-90 border-0">
                    Se connecter
                  </Button>
                  <Button onClick={() => navigate('/auth')} className="bg-primary hover:bg-primary/90 text-white">
                    S'inscrire
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="pt-28 pb-20">
        {/* Header Section */}
        <section className="px-4 sm:px-6 lg:px-8 mb-16">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              Choisissez Votre
              <span className="block text-primary">Formule</span>
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
              Des tarifs transparents adaptés à vos besoins. Commencez avec 3 vérifications gratuites.
            </p>
            
            {/* Free Trial Banner */}
            <div className="inline-flex items-center rounded-full px-4 py-2 mb-8 border bg-white border-[hsl(var(--cta-pay)/0.5)]">
              <Check className="w-4 h-4 mr-2 text-[hsl(var(--cta-pay))]" />
              <span className="font-medium text-black">Essai gratuit : 3 vérifications offertes</span>
            </div>
          </div>
        </section>

        {/* Pricing Cards */}
        <section className="px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
              {plans.map((plan, index) => {
                const isPay = plan.name === 'Pay per Check';
                const isBasic = plan.name === 'Basic';
                const borderClass = isPay
                  ? 'border-[hsl(var(--cta-pay))]'
                  : isBasic
                  ? 'border-[hsl(var(--cta-basic))]'
                  : 'border-[hsl(var(--cta-premium))]';
                const btnClass = isPay
                  ? 'bg-[hsl(var(--cta-pay))]'
                  : isBasic
                  ? 'bg-[hsl(var(--cta-basic))]'
                  : 'bg-[hsl(var(--cta-premium))]';
                const iconBg = isPay
                  ? 'bg-[hsl(var(--cta-pay)/0.12)]'
                  : isBasic
                  ? 'bg-[hsl(var(--cta-basic)/0.12)]'
                  : 'bg-[hsl(var(--cta-premium)/0.12)]';
                const iconColor = isPay
                  ? 'text-[hsl(var(--cta-pay))]'
                  : isBasic
                  ? 'text-[hsl(var(--cta-basic))]'
                  : 'text-[hsl(var(--cta-premium))]';
                return (
                  <Card key={index} className={`relative group hover:shadow-xl transition-all duration-300 ${plan.popular ? 'shadow-lg scale-105' : 'shadow-md'} ${borderClass} border-2 bg-white flex flex-col h-full`}>
                    {plan.popular && (
                      <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                        <Badge className="bg-primary text-white px-4 py-1">Plus Populaire</Badge>
                      </div>
                    )}
                    
                    <CardHeader className="text-center pb-4 min-h-56">
                      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform ${iconBg}`}>
                        <div className={iconColor}>
                          {plan.icon}
                        </div>
                      </div>
                      <CardTitle className="text-2xl font-bold text-gray-900">{plan.name}</CardTitle>
                      <div className="flex items-baseline justify-center mt-4">
                        <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                        <span className="text-lg text-gray-600 ml-1">{plan.currency}</span>
                        <span className="text-sm text-gray-500 ml-2">{plan.period}</span>
                      </div>
                      <CardDescription className="text-gray-600 mt-2">
                        {plan.description}
                      </CardDescription>
                    </CardHeader>
                    
                    <CardContent className="space-y-4 flex-1 flex flex-col">
                      <ul className="space-y-3">
                        {plan.features.map((feature, featureIndex) => (
                          <li key={featureIndex} className="flex items-start">
                            <Check className="w-5 h-5 text-green-600 mr-3 mt-0.5 flex-shrink-0" />
                            <span className="text-gray-700">{feature}</span>
                          </li>
                        ))}
                      </ul>
                      
                      <div className="pt-6 mt-auto">
                        <Button 
                          onClick={() => handleGetStarted(plan.name)}
                          className={`w-full ${btnClass} hover:opacity-90 text-gray-900`}
                        >
                          {isAuthenticated ? 'Choisir ce plan' : 'Commencer'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="px-4 sm:px-6 lg:px-8 mt-20">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Questions Fréquentes</h2>
              <p className="text-xl text-gray-600">Tout ce que vous devez savoir sur nos tarifs</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Comment fonctionne l'essai gratuit ?</h3>
                  <p className="text-gray-600">Vous bénéficiez de 3 vérifications gratuites dès votre inscription, sans engagement.</p>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Puis-je changer de formule ?</h3>
                  <p className="text-gray-600">Oui, vous pouvez upgrader ou downgrader votre plan à tout moment depuis votre dashboard.</p>
                </div>
              </div>
              
              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Les documents sont-ils conformes ?</h3>
                  <p className="text-gray-600">Oui, tous nos documents respectent la réglementation marocaine en vigueur.</p>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Support client inclus ?</h3>
                  <p className="text-gray-600">Support email pour tous les plans, support téléphonique pour le plan Premium.</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <button 
              onClick={() => navigate('/')} 
              className="flex items-center space-x-3 mb-4 md:mb-0 focus:outline-none transition-transform hover:scale-105"
              aria-label="Retour à l'accueil"
            >
              <img src="/lovable-uploads/350a73a3-7335-4676-9ce0-4f747b7c0a93.png" alt="Checky Logo" className="w-12 h-12 object-contain cursor-pointer" />
              <span className="text-xl font-bold">Checky</span>
            </button>
            <div className="text-gray-400 text-sm">
              © 2025 Checky. Conformité Airbnb Maroc simplifiée.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};