import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { copyToClipboardSimple } from '@/lib/clipboardSimple';
import { Copy, Check, X, AlertCircle } from 'lucide-react';

export const TestVerification = () => {
  const { toast } = useToast();
  const [testUrl, setTestUrl] = useState('http://localhost:3000/guest-verification/test-property/test-token?startDate=2025-11-14&endDate=2025-11-17&guests=2');
  const [testResults, setTestResults] = useState<{
    success: boolean;
    method?: string;
    duration?: number;
    verified?: boolean;
    error?: string;
    clipboardContent?: string;
  } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const testCopy = async () => {
    setIsTesting(true);
    setTestResults(null);

    console.log('🧪 === TEST DE COPIE DÉMARRÉ ===');
    console.log('🧪 URL à copier:', testUrl);
    
    const startTime = Date.now();

    try {
      // Diagnostic du contexte
      const context = {
        isSecureContext: window.isSecureContext,
        hasClipboard: !!navigator.clipboard,
        userAgent: navigator.userAgent,
        url: window.location.href,
        timestamp: new Date().toISOString()
      };

      console.log('🔍 Contexte:', context);

      // Test de copie
      console.log('🔵 Début de la copie...');
      // ✅ Utiliser copyToClipboardSimple avec un événement simulé pour mobile
      const mockEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
      const success = await copyToClipboardSimple(testUrl, mockEvent);
      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log('📊 Résultat brut:', { success, duration });

      let verified = false;
      let clipboardContent = '';
      let method = '';

      // Déterminer la méthode utilisée
      if (navigator.clipboard && window.isSecureContext) {
        method = 'Clipboard API';
      } else {
        method = 'execCommand (fallback)';
      }

      // Vérifier le presse-papier si possible
      if (success && navigator.clipboard && window.isSecureContext) {
        try {
          await new Promise(resolve => setTimeout(resolve, 100));
          clipboardContent = await navigator.clipboard.readText();
          verified = clipboardContent === testUrl;
          
          console.log('✅ Vérification presse-papier:', {
            verified,
            clipboardLength: clipboardContent.length,
            expectedLength: testUrl.length,
            match: verified ? '✅ CORRESPOND' : '❌ DIFFÉRENT',
            clipboardContent: clipboardContent.substring(0, 100) + '...'
          });
        } catch (verifyError) {
          console.warn('⚠️ Impossible de vérifier (permission):', verifyError);
        }
      }

      const result = {
        success,
        method,
        duration,
        verified: verified || undefined,
        clipboardContent: clipboardContent || undefined
      };

      setTestResults(result);
      console.log('📋 Résultat final:', result);

      if (success && verified) {
        toast({
          title: "✅ Test réussi !",
          description: `Le lien a été copié et vérifié avec ${method} en ${duration}ms`,
          duration: 5000
        });
      } else if (success) {
        toast({
          title: "⚠️ Copie réussie mais non vérifiée",
          description: `La copie a réussi avec ${method} mais la vérification n'a pas pu être effectuée`,
          duration: 5000
        });
      } else {
        toast({
          title: "❌ Test échoué",
          description: "La copie n'a pas fonctionné",
          variant: "destructive",
          duration: 5000
        });
      }

    } catch (err) {
      console.error('❌ ERREUR lors du test:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
      
      setTestResults({
        success: false,
        error: errorMessage,
        duration: Date.now() - startTime
      });

      toast({
        title: "❌ Erreur lors du test",
        description: errorMessage,
        variant: "destructive",
        duration: 5000
      });
    } finally {
      setIsTesting(false);
    }
  };

  const testManualPaste = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        const text = await navigator.clipboard.readText();
        toast({
          title: "📋 Contenu du presse-papier",
          description: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
          duration: 5000
        });
      } else {
        toast({
          title: "⚠️ Lecture impossible",
          description: "La lecture du presse-papier n'est pas disponible dans ce contexte",
          duration: 5000
        });
      }
    } catch (err) {
      toast({
        title: "❌ Erreur de lecture",
        description: err instanceof Error ? err.message : 'Erreur inconnue',
        variant: "destructive",
        duration: 5000
      });
    }
  };

  return (
    <div className="container mx-auto p-3 sm:p-4 md:p-6 max-w-4xl">
      <Card>
        <CardHeader className="px-4 sm:px-6 pt-4 sm:pt-6">
          <CardTitle className="text-lg sm:text-xl">🧪 Test de Copie-Coller</CardTitle>
          <CardDescription className="text-sm sm:text-base">
            Testez la fonctionnalité de copie de lien dans le presse-papier
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 sm:space-y-6 px-4 sm:px-6 pb-4 sm:pb-6">
          {/* URL de test */}
          <div className="space-y-2">
            <Label htmlFor="test-url">URL à tester</Label>
            <Input
              id="test-url"
              value={testUrl}
              onChange={(e) => setTestUrl(e.target.value)}
              placeholder="Entrez l'URL à copier"
              className="font-mono text-sm"
            />
          </div>

          {/* Informations du contexte */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Contexte du navigateur</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Contexte sécurisé:</span>
                <span className={window.isSecureContext ? 'text-green-600' : 'text-red-600'}>
                  {window.isSecureContext ? '✅ Oui' : '❌ Non (HTTP)'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Clipboard API:</span>
                <span className={navigator.clipboard ? 'text-green-600' : 'text-red-600'}>
                  {navigator.clipboard ? '✅ Disponible' : '❌ Non disponible'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">URL:</span>
                <span className="text-xs font-mono">{window.location.href}</span>
              </div>
            </CardContent>
          </Card>

          {/* Boutons de test */}
          <div className="flex gap-3">
            <Button
              onClick={testCopy}
              disabled={isTesting || !testUrl}
              className="flex-1"
            >
              <span className="flex items-center">
                {isTesting ? (
                  <>
                    <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Test en cours...</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    <span>Tester la copie</span>
                  </>
                )}
              </span>
            </Button>

            <Button
              onClick={testManualPaste}
              variant="outline"
              disabled={!navigator.clipboard || !window.isSecureContext}
            >
              <span className="flex items-center">
                <Check className="w-4 h-4 mr-2" />
                <span>Vérifier le presse-papier</span>
              </span>
            </Button>
          </div>

          {/* Résultats du test */}
          {testResults && (
            <Card className={testResults.success ? 'border-green-500' : 'border-red-500'} key="test-results">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <span className="flex items-center gap-2">
                    {testResults.success ? (
                      <Check className="w-5 h-5 text-green-600" />
                    ) : (
                      <X className="w-5 h-5 text-red-600" />
                    )}
                    <span>Résultats du test</span>
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-muted-foreground">Statut:</span>
                    <span className={`ml-2 font-semibold ${testResults.success ? 'text-green-600' : 'text-red-600'}`}>
                      {testResults.success ? '✅ Succès' : '❌ Échec'}
                    </span>
                  </div>
                  {testResults.method && (
                    <div>
                      <span className="text-muted-foreground">Méthode:</span>
                      <span className="ml-2 font-semibold">{testResults.method}</span>
                    </div>
                  )}
                  {testResults.duration !== undefined && (
                    <div>
                      <span className="text-muted-foreground">Durée:</span>
                      <span className="ml-2 font-semibold">{testResults.duration}ms</span>
                    </div>
                  )}
                  {testResults.verified !== undefined && (
                    <div>
                      <span className="text-muted-foreground">Vérifié:</span>
                      <span className={`ml-2 font-semibold ${testResults.verified ? 'text-green-600' : 'text-yellow-600'}`}>
                        {testResults.verified ? '✅ Oui' : '⚠️ Non'}
                      </span>
                    </div>
                  )}
                </div>

                {testResults.error && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-red-600 mt-0.5" />
                      <div>
                        <span className="font-semibold text-red-600">Erreur:</span>
                        <p className="text-red-700 dark:text-red-400 mt-1">{testResults.error}</p>
                      </div>
                    </div>
                  </div>
                )}

                {testResults.clipboardContent && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                    <span className="font-semibold text-blue-600">Contenu du presse-papier:</span>
                    <p className="text-xs font-mono mt-1 break-all text-blue-700 dark:text-blue-400">
                      {testResults.clipboardContent}
                    </p>
                  </div>
                )}

                {testResults.verified === false && (
                  <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-200 dark:border-yellow-800">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5" />
                      <div>
                        <span className="font-semibold text-yellow-600">Avertissement:</span>
                        <p className="text-yellow-700 dark:text-yellow-400 mt-1 text-xs">
                          La copie a réussi mais le contenu du presse-papier ne correspond pas exactement.
                          Cela peut être dû à une restriction de permission du navigateur.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Instructions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Instructions</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2 text-muted-foreground">
              <p>1. Entrez ou modifiez l'URL à tester</p>
              <p>2. Cliquez sur "Tester la copie"</p>
              <p>3. Vérifiez les résultats ci-dessus</p>
              <p>4. Vous pouvez aussi tester manuellement en collant (Ctrl+V) dans un champ texte</p>
              <p>5. Utilisez "Vérifier le presse-papier" pour lire directement le contenu</p>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
};

