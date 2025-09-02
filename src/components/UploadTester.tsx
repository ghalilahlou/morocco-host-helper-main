import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const UploadTester: React.FC = () => {
  const [isTesting, setIsTesting] = useState(false);
  const [testResults, setTestResults] = useState<string[]>([]);
  const { toast } = useToast();

  const addResult = (result: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${result}`]);
  };

  const testUpload = async () => {
    setIsTesting(true);
    setTestResults([]);
    
    try {
      addResult('🚀 Début du test d\'upload...');
      
      // 1. Test de connexion Supabase
      addResult('📡 Test de connexion Supabase...');
      const { data: testData, error: testError } = await supabase
        .from('guest_submissions')
        .select('count')
        .limit(1);
      
      if (testError) {
        addResult(`❌ Erreur connexion: ${testError.message}`);
        return;
      }
      addResult('✅ Connexion Supabase OK');
      
      // 2. Test du bucket storage
      addResult('📦 Test du bucket guest-documents...');
      try {
        const { data: bucketData, error: bucketError } = await supabase.storage
          .from('guest-documents')
          .list('', { limit: 1 });
        
        if (bucketError) {
          addResult(`❌ Erreur bucket: ${bucketError.message}`);
        } else {
          addResult('✅ Bucket guest-documents accessible');
        }
      } catch (bucketErr) {
        addResult(`❌ Erreur bucket: ${bucketErr}`);
      }
      
      // 3. Test de l'Edge Function storage-sign-url
      addResult('🔗 Test de l\'Edge Function storage-sign-url...');
      try {
        const { data: edgeData, error: edgeError } = await supabase.functions.invoke('storage-sign-url', {
          body: { bucket: 'guest-documents', path: 'test.txt', expiresIn: 3600 }
        });
        
        if (edgeError) {
          addResult(`❌ Erreur Edge Function: ${edgeError.message}`);
        } else {
          addResult('✅ Edge Function storage-sign-url accessible');
        }
      } catch (edgeErr) {
        addResult(`❌ Erreur Edge Function: ${edgeErr}`);
      }
      
      // 4. Test de création d'un fichier de test
      addResult('📝 Test de création d\'un fichier de test...');
      try {
        const testFile = new File(['Test content'], 'test.txt', { type: 'text/plain' });
        const fileName = `test_${Date.now()}.txt`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('guest-documents')
          .upload(fileName, testFile);
        
        if (uploadError) {
          addResult(`❌ Erreur upload: ${uploadError.message}`);
        } else {
          addResult('✅ Upload de test réussi');
          
          // 5. Test de génération d'URL signée
          addResult('🔐 Test de génération d\'URL signée...');
          try {
            const { data: signedData, error: signedError } = await supabase.functions.invoke('storage-sign-url', {
              body: { bucket: 'guest-documents', path: fileName, expiresIn: 3600 }
            });
            
            if (signedError) {
              addResult(`❌ Erreur URL signée: ${signedError.message}`);
            } else if (signedData?.signedUrl) {
              addResult('✅ URL signée générée avec succès');
              addResult(`🔗 URL: ${signedData.signedUrl.substring(0, 50)}...`);
            } else {
              addResult('❌ Pas d\'URL signée retournée');
            }
          } catch (signedErr) {
            addResult(`❌ Erreur URL signée: ${signedErr}`);
          }
          
          // 6. Nettoyage du fichier de test
          addResult('🧹 Nettoyage du fichier de test...');
          try {
            await supabase.storage.from('guest-documents').remove([fileName]);
            addResult('✅ Fichier de test supprimé');
          } catch (cleanupErr) {
            addResult(`⚠️ Erreur nettoyage: ${cleanupErr}`);
          }
        }
      } catch (fileErr) {
        addResult(`❌ Erreur création fichier: ${fileErr}`);
      }
      
      addResult('🎉 Test terminé !');
      
    } catch (error) {
      addResult(`❌ Erreur critique: ${error}`);
    } finally {
      setIsTesting(false);
    }
  };

  const clearResults = () => {
    setTestResults([]);
  };

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🧪 Testeur d'Upload de Documents
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button 
            onClick={testUpload} 
            disabled={isTesting}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isTesting ? '🔄 Test en cours...' : '🚀 Lancer le test'}
          </Button>
          <Button onClick={clearResults} variant="outline">
            🗑️ Effacer les résultats
          </Button>
        </div>
        
        <div className="bg-gray-50 p-4 rounded-lg max-h-96 overflow-y-auto">
          <h4 className="font-semibold mb-2">📊 Résultats du test :</h4>
          {testResults.length === 0 ? (
            <p className="text-gray-500">Aucun test exécuté. Cliquez sur "Lancer le test" pour commencer.</p>
          ) : (
            <div className="space-y-1">
              {testResults.map((result, index) => (
                <div key={index} className="text-sm font-mono bg-white p-2 rounded border">
                  {result}
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="text-sm text-gray-600">
          <p><strong>ℹ️ Ce test vérifie :</strong></p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li>Connexion à Supabase</li>
            <li>Accès au bucket guest-documents</li>
            <li>Fonctionnement de l'Edge Function storage-sign-url</li>
            <li>Upload et suppression de fichiers</li>
            <li>Génération d'URLs signées</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};
