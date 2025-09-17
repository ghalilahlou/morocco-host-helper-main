import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const SimpleUploadTest: React.FC = () => {
  const [isTesting, setIsTesting] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const { toast } = useToast();

  const addResult = (result: string) => {
    setResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${result}`]);
  };

  const testUpload = async () => {
    setIsTesting(true);
    setResults([]);
    
    try {
      addResult('🚀 Test d\'upload démarré...');
      
      // 1. Test de connexion Supabase
      addResult('📡 Test connexion Supabase...');
      const { data, error } = await supabase
        .from('guest_submissions')
        .select('count')
        .limit(1);
      
      if (error) {
        addResult(`❌ Erreur connexion: ${error.message}`);
        return;
      }
      addResult('✅ Connexion Supabase OK');
      
      // 2. Test du bucket storage
      addResult('📦 Test bucket guest-documents...');
      try {
        const { data: bucketData, error: bucketError } = await supabase.storage
          .from('guest-documents')
          .list('', { limit: 1 });
        
        if (bucketError) {
          addResult(`❌ Erreur bucket: ${bucketError.message}`);
        } else {
          addResult('✅ Bucket accessible');
        }
      } catch (bucketErr) {
        addResult(`❌ Erreur bucket: ${bucketErr}`);
      }
      
      // 3. Test de l'Edge Function
      addResult('🔗 Test Edge Function storage-sign-url...');
      try {
        const { data: edgeData, error: edgeError } = await supabase.functions.invoke('storage-sign-url', {
          body: { bucket: 'guest-documents', path: 'test.txt', expiresIn: 3600 }
        });
        
        if (edgeError) {
          addResult(`❌ Erreur Edge Function: ${edgeError.message}`);
        } else {
          addResult('✅ Edge Function OK');
        }
      } catch (edgeErr) {
        addResult(`❌ Erreur Edge Function: ${edgeErr}`);
      }
      
      // 4. Test d'upload réel
      addResult('📝 Test upload fichier...');
      try {
        const testFile = new File(['Test content'], 'test.txt', { type: 'text/plain' });
        const fileName = `test_${Date.now()}.txt`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('guest-documents')
          .upload(fileName, testFile);
        
        if (uploadError) {
          addResult(`❌ Erreur upload: ${uploadError.message}`);
        } else {
          addResult('✅ Upload réussi');
          
          // 5. Test URL signée
          addResult('🔐 Test URL signée...');
          try {
            const { data: signedData, error: signedError } = await supabase.functions.invoke('storage-sign-url', {
              body: { bucket: 'guest-documents', path: fileName, expiresIn: 3600 }
            });
            
            if (signedError) {
              addResult(`❌ Erreur URL: ${signedError.message}`);
            } else if (signedData?.signedUrl) {
              addResult('✅ URL signée OK');
              addResult(`🔗 URL: ${signedData.signedUrl.substring(0, 50)}...`);
            } else {
              addResult('❌ Pas d\'URL retournée');
            }
          } catch (signedErr) {
            addResult(`❌ Erreur URL: ${signedErr}`);
          }
          
          // 6. Nettoyage
          addResult('🧹 Nettoyage...');
          try {
            await supabase.storage.from('guest-documents').remove([fileName]);
            addResult('✅ Fichier supprimé');
          } catch (cleanupErr) {
            addResult(`⚠️ Erreur nettoyage: ${cleanupErr}`);
          }
        }
      } catch (fileErr) {
        addResult(`❌ Erreur fichier: ${fileErr}`);
      }
      
      addResult('🎉 Test terminé !');
      
    } catch (error) {
      addResult(`❌ Erreur critique: ${error}`);
    } finally {
      setIsTesting(false);
    }
  };

  const clearResults = () => setResults([]);

  return (
    <Card className="w-full max-w-3xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🧪 Test Upload Simple
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button 
            onClick={testUpload} 
            disabled={isTesting}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isTesting ? '🔄 Test...' : '🚀 Tester Upload'}
          </Button>
          <Button onClick={clearResults} variant="outline">
            🗑️ Effacer
          </Button>
        </div>
        
        <div className="bg-gray-50 p-3 rounded max-h-80 overflow-y-auto">
          <h4 className="font-semibold mb-2">📊 Résultats :</h4>
          {results.length === 0 ? (
            <p className="text-gray-500">Cliquez sur "Tester Upload" pour commencer.</p>
          ) : (
            <div className="space-y-1">
              {results.map((result, index) => (
                <div key={index} className="text-xs font-mono bg-white p-2 rounded border">
                  {result}
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
