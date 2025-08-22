import { ArrowLeft, Copy, Share } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const ClientLinkHelp = () => {
  const { propertyId } = useParams<{ propertyId: string }>();
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Link to={`/dashboard/property/${propertyId}`}>
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Retour à la propriété
          </Button>
        </Link>
      </div>

      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Comment partager le lien de vérification à vos clients</h1>
          <p className="text-muted-foreground mt-2">
            Apprenez à utiliser et partager le lien de vérification pour vos invités
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Copy className="h-5 w-5" />
              Qu'est-ce que le lien de vérification ?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              Le lien de vérification permet à vos invités de remplir leurs informations personnelles 
              et de télécharger leurs documents d'identité avant leur arrivée.
            </p>
            <p>
              Cela vous fait gagner du temps lors du check-in et assure la conformité réglementaire.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Étape 1: Générer le lien</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>1. Sur la page de votre propriété, cliquez sur "Générer lien client"</p>
            <p>2. Le lien est automatiquement copié dans votre presse-papiers</p>
            <p>3. Ce lien est permanent et peut être réutilisé pour tous vos invités</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Share className="h-5 w-5" />
              Étape 2: Partager avec vos invités
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p><strong>Par email :</strong></p>
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm">
                "Bonjour, <br/>
                Pour faciliter votre arrivée, merci de remplir vos informations via ce lien : [LIEN]<br/>
                Cela ne vous prendra que quelques minutes.<br/>
                À bientôt !"
              </p>
            </div>
            <p><strong>Par SMS :</strong></p>
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm">
                "Bonjour, merci de remplir vos infos pour votre séjour : [LIEN] 
                Merci !"
              </p>
            </div>
            <p><strong>Via Airbnb :</strong></p>
            <p>Vous pouvez également envoyer le lien via la messagerie Airbnb après confirmation de réservation.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Étape 3: Suivi des soumissions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>1. Les invités qui auront rempli leurs informations apparaîtront dans votre tableau de bord</p>
            <p>2. Vous recevrez une notification quand un invité complète sa vérification</p>
            <p>3. Vous pourrez consulter et valider les documents soumis</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>💡 Conseils d'utilisation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p>• Envoyez le lien 2-3 jours avant l'arrivée des invités</p>
            <p>• Rappelez gentiment aux invités qui n'ont pas encore rempli</p>
            <p>• Le lien fonctionne sur mobile et ordinateur</p>
            <p>• Aucune inscription n'est requise pour vos invités</p>
            <p>• Les données sont sécurisées et conformes au RGPD</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};