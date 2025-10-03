import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Bug, Download } from 'lucide-react';
import { DebugDocVars } from './DebugDocVars';
import { ContractDebugLogger } from '@/utils/contractDebug';

interface ContractDebugPanelProps {
  bookingId: string;
  isVisible?: boolean;
  onToggle?: (visible: boolean) => void;
}

export const ContractDebugPanel: React.FC<ContractDebugPanelProps> = ({
  bookingId,
  isVisible = false,
  onToggle
}) => {
  const [showDebugVars, setShowDebugVars] = useState(false);
  const [debugReport, setDebugReport] = useState<any>(null);

  const handleToggle = () => {
    const newVisible = !isVisible;
    onToggle?.(newVisible);
  };

  const generateDebugReport = () => {
    const logger = ContractDebugLogger.getInstance();
    const report = logger.generateDebugReport(bookingId);
    setDebugReport(report);
  };

  const downloadDebugReport = () => {
    if (!debugReport) return;
    
    const dataStr = JSON.stringify(debugReport, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `contract-debug-${bookingId}-${Date.now()}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  if (!isVisible) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={handleToggle}
          variant="outline"
          size="sm"
          className="bg-yellow-50 border-yellow-200 text-yellow-800 hover:bg-yellow-100"
        >
          <Bug className="w-4 h-4 mr-1" />
          Debug Contract
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96 max-h-[80vh] overflow-auto">
      <Card className="bg-yellow-50 border-yellow-200">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Bug className="w-4 h-4" />
              Debug Contract
              <Badge variant="outline" className="text-xs">
                {bookingId.slice(-6)}
              </Badge>
            </div>
            <Button
              onClick={handleToggle}
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
            >
              ✕
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={() => setShowDebugVars(!showDebugVars)}
              variant="outline"
              size="sm"
              className="text-xs"
            >
              {showDebugVars ? <ChevronDown className="w-3 h-3 mr-1" /> : <ChevronRight className="w-3 h-3 mr-1" />}
              Variables API
            </Button>
            <Button
              onClick={generateDebugReport}
              variant="outline"
              size="sm"
              className="text-xs"
            >
              Générer Rapport
            </Button>
            {debugReport && (
              <Button
                onClick={downloadDebugReport}
                variant="outline"
                size="sm"
                className="text-xs"
              >
                <Download className="w-3 h-3 mr-1" />
                Télécharger
              </Button>
            )}
          </div>

          <Collapsible open={showDebugVars} onOpenChange={setShowDebugVars}>
            <CollapsibleContent>
              <div className="max-h-60 overflow-auto">
                <DebugDocVars 
                  bookingId={bookingId} 
                  onClose={() => setShowDebugVars(false)}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>

          {debugReport && (
            <div className="space-y-2">
              <div className="text-xs font-medium">Rapport Debug:</div>
              <div className="bg-white rounded p-2 text-xs max-h-32 overflow-auto">
                <div className="space-y-1">
                  <div>
                    <strong>Hôte:</strong> {debugReport.hostData ? 
                      (debugReport.hostData.full_name || `${debugReport.hostData.first_name || ''} ${debugReport.hostData.last_name || ''}`.trim() || 'Non défini')
                      : 'Aucune donnée'
                    }
                  </div>
                  <div>
                    <strong>Signature:</strong> {
                      debugReport.hostData?.signature_url ? 'URL' :
                      debugReport.hostData?.signature_image_url ? 'Image URL' :
                      debugReport.hostData?.signature_svg ? 'SVG' : 'Aucune'
                    }
                  </div>
                  <div>
                    <strong>Propriété:</strong> {debugReport.propertyData?.name || debugReport.propertyData?.address || 'Non définie'}
                  </div>
                  {debugReport.errors && debugReport.errors.length > 0 && (
                    <div className="text-red-600">
                      <strong>Erreurs:</strong> {debugReport.errors.join(', ')}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="text-xs text-muted-foreground">
            Ouvrez la console pour voir les logs détaillés
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
