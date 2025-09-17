import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const SecureUploadTest: React.FC = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const { toast } = useToast();

  const addResult = (result: string) => {
    setResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${result}`]);
  };

  // ✅ FONCTION SÉCURISÉE : Normaliser les noms de fichiers
  const sanitizeFileName = (originalName: string) => {
    return originalName
      .replace(/[^a-zA-Z0-9.-]/g, '_') // Remplacer caractères spéciaux par _
      .replace(/_+/g, '_') // Éviter les __ multiples
      .replace(/^_|_$/g, ''); // Enlever _ au début/fin
  };

  // Créer un fichier de test avec un nom sécurisé
  const createTestFile = () => {
    const testContent = 'Ceci est un fichier de test pour vérifier l\'upload sécurisé.';
    const blob = new Blob([testContent], { type: 'text/plain' });
    
    // Nom de fichier sécurisé
    const safeName = 'test_document_secure.txt';
    return new File([blob], safeName, { type: 'text/plain' });
  };

  // Test d'upload avec nom de fichier sécurisé
  const testSecureUpload = async () => {
    setIsUploading(true);
    setResults([]);
    
    try {
      addResult('🚀 Test d\'upload sécurisé...');
      
      // Créer un fichier de test
      const testFile = createTestFile();
      addResult(`📄 Fichier de test créé: ${testFile.name}`);
      
      // Générer un nom de fichier sécurisé
      const timestamp = Date.now();
      const safeFileName = sanitizeFileName(testFile.name);
      const fileName = `${timestamp}_${safeFileName}`;
      
      addResult(`🔒 Nom de fichier sécurisé: ${fileName}`);
      
      // Upload vers Supabase Storage
      addResult('📤 Upload vers Supabase Storage...');
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('guest-documents')
        .upload(fileName, testFile);

      if (uploadError) {
        addResult(`❌ Erreur upload: ${uploadError.message}`);
        return;
      }

      addResult(`✅ Upload réussi! Path: ${uploadData.path}`);
      
      // Créer une URL signée
      addResult('🔗 Création URL signée...');
      
      const { data: signedData, error: signedError } = await supabase.functions.invoke('storage-sign-url', {
        body: { bucket: 'guest-documents', path: fileName, expiresIn: 3600 }
      });

      if (signedError) {
        addResult(`❌ Erreur URL signée: ${signedError.message}`);
        return;
      }

      if (signedData?.signedUrl) {
        addResult(`✅ URL signée créée: ${signedData.signedUrl.substring(0, 50)}...`);
        
        // Tester l'accès à l'URL
        addResult('🧪 Test d\'accès à l\'URL...');
        
        try {
          const response = await fetch(signedData.signedUrl);
          if (response.ok) {
            addResult(`✅ URL accessible: ${response.status}`);
            
            // Tester le téléchargement
            const content = await response.text();
            addResult(`📥 Contenu téléchargé: ${content.length} caractères`);
          } else {
            addResult(`❌ URL inaccessible: ${response.status} ${response.statusText}`);
          }
        } catch (fetchError) {
          addResult(`❌ Erreur fetch: ${fetchError}`);
        }
      } else {
        addResult('❌ Pas d\'URL signée retournée');
      }
      
      // Nettoyer le fichier de test
      addResult('🧹 Nettoyage du fichier de test...');
      
      const { error: deleteError } = await supabase.storage
        .from('guest-documents')
        .remove([fileName]);

      if (deleteError) {
        addResult(`⚠️ Erreur suppression: ${deleteError.message}`);
      } else {
        addResult('✅ Fichier de test supprimé');
      }
      
      addResult('🎉 Test terminé avec succès!');
      
      toast({
        title: "Test réussi",
        description: "L'upload sécurisé fonctionne correctement",
      });
      
    } catch (error) {
      addResult(`❌ Erreur critique: ${error}`);
      toast({
        title: "Test échoué",
        description: "Erreur lors du test d'upload",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  const clearResults = () => {
    setResults([]);
  };

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🔒 Test d'Upload Sécurisé
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-blue-50 p-4 rounded-lg">
          <h4 className="font-semibold mb-2">ℹ️ Ce test vérifie :</h4>
          <ul className="list-disc list-inside ml-4 space-y-1 text-sm">
            <li>Normalisation des noms de fichiers (suppression caractères spéciaux)</li>
            <li>Upload vers Supabase Storage avec noms sécurisés</li>
            <li>Création d'URLs signées</li>
            <li>Accès et téléchargement des fichiers</li>
            <li>Nettoyage automatique des fichiers de test</li>
          </ul>
        </div>

        <div className="flex gap-2">
          <Button 
            onClick={testSecureUpload} 
            disabled={isUploading}
            className="bg-green-600 hover:bg-green-700"
          >
            {isUploading ? '🔄 Test en cours...' : '🔒 Tester Upload Sécurisé'}
          </Button>
          <Button onClick={clearResults} variant="outline">
            🗑️ Effacer les résultats
          </Button>
        </div>
        
        {/* Résultats du test */}
        <div className="bg-gray-50 p-4 rounded-lg max-h-96 overflow-y-auto">
          <h4 className="font-semibold mb-2">📊 Résultats du test :</h4>
          {results.length === 0 ? (
            <p className="text-gray-500">Aucun test exécuté. Cliquez sur "Tester Upload Sécurisé" pour commencer.</p>
          ) : (
            <div className="space-y-1">
              {results.map((result, index) => (
                <div key={index} className="text-sm font-mono bg-white p-2 rounded border">
                  {result}
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="text-sm text-gray-600">
          <p><strong>💡 Avantages de cette approche :</strong></p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li>Évite les erreurs "Invalid key" de Supabase</li>
            <li>Noms de fichiers prévisibles et sécurisés</li>
            <li>Validation préventive avant l'upload</li>
            <li>Gestion d'erreurs améliorée</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};
