import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Crown, Zap, Star } from 'lucide-react';

interface SubscriptionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({
  open,
  onOpenChange
}) => {
  // Mock current plan - will be replaced with real data later
  const currentPlan: string = "Pay per Check";
  const currentFeatures = ["15 DHS par vérification", "Support par email"];

  const plans = [
    {
      name: "Pay per Check",
      price: "15 DHS",
      period: "/vérification",
      description: "Payez uniquement pour ce que vous utilisez",
      features: [
        "15 DHS par vérification",
        "Pas d'abonnement",
        "Idéal pour usage occasionnel",
        "Support par email"
      ],
      popular: false,
      current: currentPlan === "Pay per Check"
    },
    {
      name: "Basic",
      price: "200 DHS",
      period: "/mois",
      description: "Parfait pour les propriétaires avec une propriété",
      features: [
        "15 vérifications incluses",
        "1 propriété",
        "Génération automatique des documents",
        "Support prioritaire",
        "Tableau de bord complet"
      ],
      popular: true,
      current: currentPlan === "Basic"
    },
    {
      name: "Premium",
      price: "300 DHS",
      period: "/mois",
      description: "Pour les gestionnaires avec plusieurs propriétés",
      features: [
        "50 vérifications incluses",
        "Propriétés illimitées",
        "Gestion multi-propriétés",
        "Analytics avancés",
        "Support téléphonique",
        "API access"
      ],
      popular: false,
      current: currentPlan === "Premium"
    }
  ];

  const handleUpgrade = (planName: string) => {
    // Will be implemented with Stripe later
    console.log(`Upgrade to ${planName}`);
  };

  const handleManageSubscription = () => {
    // Will be implemented with Stripe Customer Portal later
    console.log("Manage subscription");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl sm:text-2xl font-bold text-center">
            Gérer votre abonnement
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current Plan Status */}
          <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg p-6 border border-primary/20">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-primary">Plan actuel</h3>
                <div className="flex items-center space-x-2 mt-2">
                  <Badge variant="secondary" className="text-primary bg-primary/10">
                    {currentPlan}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    Actif jusqu'au 31 janvier 2025
                  </span>
                </div>
              </div>
              {currentPlan !== "Pay per Check" && (
                <Button 
                  variant="outline" 
                  onClick={handleManageSubscription}
                  className="border-primary text-primary hover:bg-primary hover:text-white"
                >
                  Gérer l'abonnement
                </Button>
              )}
            </div>
          </div>

          {/* Plans Grid */}
          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <Card 
                key={plan.name}
                className={`relative ${
                  plan.popular 
                    ? 'border-2 border-primary shadow-lg' 
                    : plan.current 
                      ? 'border-2 border-green-500 bg-green-50/50' 
                      : 'border border-gray-200'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-primary text-white">
                      <Star className="w-3 h-3 mr-1" />
                      Populaire
                    </Badge>
                  </div>
                )}
                
                {plan.current && (
                  <div className="absolute -top-3 right-4">
                    <Badge variant="secondary" className="bg-green-500 text-white">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Actuel
                    </Badge>
                  </div>
                )}

                <CardHeader className="text-center pb-2">
                  <CardTitle className="text-xl font-bold">
                    {plan.name}
                  </CardTitle>
                  <div className="mt-4">
                    <span className="text-3xl font-bold text-primary">
                      {plan.price}
                    </span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    {plan.description}
                  </p>
                </CardHeader>

                <CardContent className="space-y-4">
                  <ul className="space-y-2">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start space-x-2">
                        <CheckCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button 
                    className={`w-full ${
                      plan.current 
                        ? 'bg-green-500 hover:bg-green-600' 
                        : plan.popular 
                          ? 'bg-primary hover:bg-primary/90' 
                          : ''
                    }`}
                    variant={plan.current ? "default" : plan.popular ? "default" : "outline"}
                    onClick={() => handleUpgrade(plan.name)}
                    disabled={plan.current}
                  >
                    {plan.current ? (
                      <span className="flex items-center">
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Plan actuel
                      </span>
                    ) : plan.name === "Pay per Check" ? (
                      "Passer au paiement à l'usage"
                    ) : (
                      <span className="flex items-center">
                        <Crown className="w-4 h-4 mr-2" />
                        Passer à {plan.name}
                      </span>
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* FAQ Section */}
          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="font-semibold mb-4">Questions fréquentes</h3>
            <div className="space-y-3 text-sm">
              <div>
                <p className="font-medium">Puis-je annuler à tout moment ?</p>
                <p className="text-muted-foreground">Oui, vous pouvez annuler votre abonnement à tout moment sans frais cachés.</p>
              </div>
              <div>
                <p className="font-medium">Que se passe-t-il si je dépasse la limite ?</p>
                <p className="text-muted-foreground">Nous vous notifierons et vous pourrez upgrader facilement vers un plan supérieur.</p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};