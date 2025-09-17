import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface TestDocument {
  id: string;
  fileName: string;
  url: string;
  type: 'pdf' | 'image';
}

export const DocumentAccessTest: React.FC = () => {
  const [isTesting, setIsTesting] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const [testDocuments, setTestDocuments] = useState<TestDocument[]>([]);
  const { toast } = useToast();

  const addResult = (result: string) => {
    setResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${result}`]);
  };

  // Récupérer les documents de test depuis la base
  const fetchTestDocuments = async () => {
    try {
      addResult('🔍 Récupération des documents de test...');
      
      // Récupérer les soumissions avec documents
      const { data: submissions, error } = await supabase
        .from('guest_submissions')
        .select('id, document_urls, guest_data')
        .not('document_urls', 'is', null)
        .not('document_urls', 'eq', '[]')
        .limit(5);

      if (error) {
        addResult(`❌ Erreur récupération: ${error.message}`);
        return;
      }

      if (!submissions || submissions.length === 0) {
        addResult('⚠️ Aucune soumission avec documents trouvée');
        return;
      }

      addResult(`✅ ${submissions.length} soumissions avec documents trouvées`);

      // Créer des documents de test
      const docs: TestDocument[] = [];
      submissions.forEach((submission, index) => {
        if (submission.document_urls && Array.isArray(submission.document_urls)) {
          submission.document_urls.forEach((url: string, docIndex: number) => {
            const isImage = url.match(/\.(jpg|jpeg|png|gif|webp)$/i);
            const isPdf = url.match(/\.pdf$/i);
            
            if (isImage || isPdf) {
              docs.push({
                id: `${submission.id}-${docIndex}`,
                fileName: `Document_${index + 1}_${docIndex + 1}`,
                url: url,
                type: isPdf ? 'pdf' : 'image'
              });
            }
          });
        }
      });

      setTestDocuments(docs);
      addResult(`📄 ${docs.length} documents de test préparés`);

    } catch (error) {
      addResult(`❌ Erreur: ${error}`);
    }
  };

  // Tester l'accès à un document
  const testDocumentAccess = async (doc: TestDocument) => {
    try {
      addResult(`🔍 Test d'accès: ${doc.fileName} (${doc.type})`);
      
      // Test 1: Vérifier que l'URL est accessible
      addResult(`📡 Test URL: ${doc.url.substring(0, 50)}...`);
      
      const response = await fetch(doc.url);
      
      if (!response.ok) {
        addResult(`❌ URL inaccessible: ${response.status} ${response.statusText}`);
        return;
      }

      addResult(`✅ URL accessible: ${response.status}`);
      
      // Test 2: Vérifier le type de contenu
      const contentType = response.headers.get('content-type');
      addResult(`📋 Content-Type: ${contentType}`);
      
      // Test 3: Tester l'affichage selon le type
      if (doc.type === 'image') {
        await testImageDisplay(doc);
      } else if (doc.type === 'pdf') {
        await testPdfDisplay(doc);
      }

    } catch (error) {
      addResult(`❌ Erreur test ${doc.fileName}: ${error}`);
    }
  };

  // Tester l'affichage d'une image
  const testImageDisplay = async (doc: TestDocument) => {
    try {
      addResult(`🖼️ Test affichage image: ${doc.fileName}`);
      
      // Créer un élément img pour tester
      const img = new Image();
      
      img.onload = () => {
        addResult(`✅ Image chargée: ${img.width}x${img.height}px`);
      };
      
      img.onerror = () => {
        addResult(`❌ Erreur chargement image: ${doc.fileName}`);
      };
      
      img.src = doc.url;
      
    } catch (error) {
      addResult(`❌ Erreur test image: ${error}`);
    }
  };

  // Tester l'affichage d'un PDF
  const testPdfDisplay = async (doc: TestDocument) => {
    try {
      addResult(`📄 Test affichage PDF: ${doc.fileName}`);
      
      // Tester si le PDF peut être ouvert dans un nouvel onglet
      const newWindow = window.open(doc.url, '_blank');
      
      if (newWindow) {
        addResult(`✅ PDF ouvert dans nouvel onglet`);
        // Fermer après 2 secondes
        setTimeout(() => newWindow.close(), 2000);
      } else {
        addResult(`❌ Impossible d'ouvrir le PDF (bloqueur de popup)`);
      }
      
    } catch (error) {
      addResult(`❌ Erreur test PDF: ${error}`);
    }
  };

  // Test complet
  const runCompleteTest = async () => {
    setIsTesting(true);
    setResults([]);
    
    try {
      addResult('🚀 Début du test d\'accès aux documents...');
      
      // 1. Récupérer les documents
      await fetchTestDocuments();
      
      // 2. Tester chaque document
      if (testDocuments.length > 0) {
        addResult('🧪 Test d\'accès aux documents...');
        
        for (const doc of testDocuments) {
          await testDocumentAccess(doc);
          // Pause entre les tests
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      addResult('🎉 Test terminé !');
      
    } catch (error) {
      addResult(`❌ Erreur critique: ${error}`);
    } finally {
      setIsTesting(false);
    }
  };

  const clearResults = () => {
    setResults([]);
    setTestDocuments([]);
  };

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🧪 Test d'Accès aux Documents d'Identité
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button 
            onClick={runCompleteTest} 
            disabled={isTesting}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isTesting ? '🔄 Test en cours...' : '🚀 Lancer le test complet'}
          </Button>
          <Button onClick={clearResults} variant="outline">
            🗑️ Effacer les résultats
          </Button>
        </div>

        {/* Documents de test disponibles */}
        {testDocuments.length > 0 && (
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-semibold mb-2">📄 Documents de test disponibles:</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {testDocuments.map((doc) => (
                <div key={doc.id} className="bg-white p-3 rounded border">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{doc.fileName}</p>
                      <p className="text-sm text-gray-600">Type: {doc.type.toUpperCase()}</p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => testDocumentAccess(doc)}
                      disabled={isTesting}
                    >
                      Tester
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Résultats du test */}
        <div className="bg-gray-50 p-4 rounded-lg max-h-96 overflow-y-auto">
          <h4 className="font-semibold mb-2">📊 Résultats du test :</h4>
          {results.length === 0 ? (
            <p className="text-gray-500">Aucun test exécuté. Cliquez sur "Lancer le test complet" pour commencer.</p>
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
          <p><strong>ℹ️ Ce test vérifie :</strong></p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li>Accessibilité des URLs des documents</li>
            <li>Types de contenu (images/PDFs)</li>
            <li>Affichage des images</li>
            <li>Ouverture des PDFs</li>
            <li>Gestion des erreurs de sécurité</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};
