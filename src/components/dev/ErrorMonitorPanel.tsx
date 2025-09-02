// ✅ COMPOSANT DE MONITORING DES ERREURS (MODE DEV)
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { getErrorReport, errorMonitor } from '@/utils/errorMonitoring';

export const ErrorMonitorPanel: React.FC = () => {
  const [errorReport, setErrorReport] = useState(getErrorReport());
  const [isVisible, setIsVisible] = useState(false);

  // Rafraîchir le rapport toutes les 10 secondes
  useEffect(() => {
    const interval = setInterval(() => {
      setErrorReport(getErrorReport());
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  // N'afficher qu'en mode développement
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  const getErrorTypeColor = (type: string) => {
    if (type.includes('missing_property_id')) return 'destructive';
    if (type.includes('invalid_data')) return 'secondary';
    if (type.includes('transformation_error')) return 'outline';
    return 'default';
  };

  const getErrorTypeIcon = (type: string) => {
    if (type.includes('missing_property_id')) return <XCircle className="h-4 w-4" />;
    if (type.includes('invalid_data')) return <AlertTriangle className="h-4 w-4" />;
    return <AlertTriangle className="h-4 w-4" />;
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Bouton toggle */}
      <Button
        onClick={() => setIsVisible(!isVisible)}
        variant={errorReport.totalErrors > 0 ? "destructive" : "secondary"}
        size="sm"
        className="mb-2"
      >
        {errorReport.totalErrors > 0 ? (
          <XCircle className="h-4 w-4 mr-2" />
        ) : (
          <CheckCircle className="h-4 w-4 mr-2" />
        )}
        Erreurs: {errorReport.totalErrors}
      </Button>

      {/* Panel d'erreurs */}
      {isVisible && (
        <Card className="w-96 max-h-96 overflow-auto">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm">Monitoring des Erreurs</CardTitle>
                <CardDescription>
                  État de l'intégrité des données
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  errorMonitor.clearErrors();
                  setErrorReport(getErrorReport());
                }}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-3">
            {/* Résumé */}
            <div className="flex items-center gap-2">
              {errorReport.totalErrors === 0 ? (
                <>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-green-600">Aucune erreur détectée</span>
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span className="text-sm text-red-600">
                    {errorReport.totalErrors} erreur(s) détectée(s)
                  </span>
                </>
              )}
            </div>

            {/* Erreurs par type */}
            {Object.entries(errorReport.byType).length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-gray-700">Par type:</h4>
                {Object.entries(errorReport.byType).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getErrorTypeIcon(type)}
                      <span className="text-xs">{type}</span>
                    </div>
                    <Badge variant={getErrorTypeColor(type)} className="text-xs">
                      {count}
                    </Badge>
                  </div>
                ))}
              </div>
            )}

            {/* Erreurs récentes */}
            {errorReport.recentErrors.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-gray-700">Récentes:</h4>
                <div className="space-y-1 max-h-32 overflow-auto">
                  {errorReport.recentErrors.slice(-5).map((error, index) => (
                    <div key={index} className="text-xs p-2 bg-gray-50 rounded border">
                      <div className="flex items-center gap-1 mb-1">
                        <Badge variant={getErrorTypeColor(error.type)} className="text-xs">
                          {error.type}
                        </Badge>
                        <span className="text-gray-500">{error.context}</span>
                      </div>
                      <div className="text-gray-600 text-xs">
                        {new Date(error.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
