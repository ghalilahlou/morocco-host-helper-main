import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface DebugDocVarsProps {
  bookingId: string;
  onClose?: () => void;
}

interface HostDocVariables {
  host?: {
    full_name?: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
    signature_url?: string;
    signature_image_url?: string;
    signature_svg?: string;
  };
  property?: {
    id?: string;
    name?: string;
    address?: string;
    city?: string;
    contact_info?: any;
    contract_template?: any;
    owner_names?: string[];
  };
  booking?: {
    id?: string;
    check_in_date?: string;
    check_out_date?: string;
    guests?: any[];
  };
}

export const DebugDocVars: React.FC<DebugDocVarsProps> = ({
  bookingId,
  onClose
}) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<HostDocVariables | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rawResponse, setRawResponse] = useState<any>(null);
  const { toast } = useToast();

  const fetchHostDocVariables = async () => {
    if (!bookingId) {
      setError('Booking ID manquant');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      console.log('🔍 DebugDocVars - Fetching host doc variables for booking:', bookingId);
      
      // Test direct avec l'edge function generate-contract
      const { data: response, error: edgeError } = await supabase.functions.invoke('generate-contract', {
        body: { 
          bookingId, 
          action: 'generate'
        }
      });

      console.log('🔍 DebugDocVars - Edge function response:', { response, edgeError });
      setRawResponse({ response, edgeError });

      if (edgeError) {
        throw new Error(`Edge function error: ${edgeError.message}`);
      }

      // Récupérer les données enrichies directement depuis la base
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .select(`
          *,
          property:properties(*),
          guests(*)
        `)
        .eq('id', bookingId)
        .maybeSingle();

      if (bookingError) {
        throw new Error(`Booking query error: ${bookingError.message}`);
      }

      if (!booking) {
        throw new Error('Booking not found');
      }

      // Récupérer le profil hôte si disponible
      let hostProfile = null;
      if (booking.property?.user_id) {
        const { data: host, error: hostError } = await supabase
          .from('host_profiles')
          .select('full_name, first_name, last_name, phone, signature_url, signature_image_url')
          .eq('user_id', booking.property.user_id)
          .maybeSingle();

        if (!hostError && host) {
          hostProfile = host;
        }
      }

      const debugData: HostDocVariables = {
        host: hostProfile || undefined,
        property: booking.property || undefined,
        booking: {
          id: booking.id,
          check_in_date: booking.check_in_date,
          check_out_date: booking.check_out_date,
          guests: booking.guests || []
        }
      };

      console.log('🔍 DebugDocVars - Processed data:', debugData);
      setData(debugData);

      toast({
        title: "Données récupérées",
        description: "Les variables de document ont été chargées avec succès",
      });

    } catch (err: any) {
      console.error('❌ DebugDocVars - Error:', err);
      setError(err.message);
      toast({
        title: "Erreur",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHostDocVariables();
  }, [bookingId]);

  const renderSignaturePreview = (signatureData: string | undefined, label: string) => {
    if (!signatureData) {
      return (
        <div className="text-sm text-muted-foreground">
          {label}: <Badge variant="secondary">Aucune signature</Badge>
        </div>
      );
    }

    const isSvg = signatureData.startsWith('data:image/svg') || signatureData.includes('<svg');
    const isDataUrl = signatureData.startsWith('data:image/');
    const isUrl = signatureData.startsWith('http');

    return (
      <div className="space-y-2">
        <div className="text-sm font-medium">{label}:</div>
        <div className="flex items-center gap-2">
          <Badge variant={isDataUrl ? "default" : isUrl ? "outline" : "secondary"}>
            {isSvg ? 'SVG' : isDataUrl ? 'Data URL' : isUrl ? 'HTTP URL' : 'Autre'}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {signatureData.length} chars
          </span>
        </div>
        
        {/* Aperçu de la signature */}
        {(isDataUrl || isUrl) && (
          <div className="border rounded p-2 bg-gray-50">
            <img 
              src={signatureData} 
              alt={`${label} preview`}
              className="max-w-[200px] max-h-[100px] object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        )}
        
        {/* Affichage SVG inline */}
        {isSvg && (
          <div className="border rounded p-2 bg-gray-50">
            <div 
              className="max-w-[200px] max-h-[100px]"
              dangerouslySetInnerHTML={{ 
                __html: signatureData.includes('<svg') 
                  ? signatureData 
                  : atob(signatureData.split(',')[1] || '') 
              }}
            />
          </div>
        )}
      </div>
    );
  };

  const getHostDisplayName = () => {
    if (!data?.host) return 'Aucune donnée hôte';
    
    const { full_name, first_name, last_name } = data.host;
    
    if (full_name) return full_name;
    if (first_name && last_name) return `${first_name} ${last_name}`;
    if (first_name) return first_name;
    if (last_name) return last_name;
    
    return 'Nom non défini';
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Debug - Variables de Document
            {onClose && (
              <Button variant="outline" size="sm" onClick={onClose}>
                Fermer
              </Button>
            )}
          </CardTitle>
          <CardDescription>
            Booking ID: <code className="bg-gray-100 px-1 rounded">{bookingId}</code>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Button 
              onClick={fetchHostDocVariables}
              disabled={loading}
              size="sm"
            >
              {loading ? 'Chargement...' : 'Actualiser'}
            </Button>
            <Badge variant={data ? "default" : error ? "destructive" : "secondary"}>
              {loading ? 'Chargement...' : data ? 'Données chargées' : error ? 'Erreur' : 'Pas de données'}
            </Badge>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-3 mb-4">
              <div className="text-red-800 font-medium">Erreur:</div>
              <div className="text-red-600 text-sm">{error}</div>
            </div>
          )}

          {data && (
            <div className="space-y-6">
              {/* Données Hôte */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Données Hôte</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <strong>Nom affiché:</strong> {getHostDisplayName()}
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <strong>full_name:</strong> {data.host?.full_name || <Badge variant="secondary">Non défini</Badge>}
                    </div>
                    <div>
                      <strong>first_name:</strong> {data.host?.first_name || <Badge variant="secondary">Non défini</Badge>}
                    </div>
                    <div>
                      <strong>last_name:</strong> {data.host?.last_name || <Badge variant="secondary">Non défini</Badge>}
                    </div>
                    <div>
                      <strong>phone:</strong> {data.host?.phone || <Badge variant="secondary">Non défini</Badge>}
                    </div>
                  </div>
                  
                  <Separator />
                  
                  {/* Signatures */}
                  <div className="space-y-4">
                    {renderSignaturePreview(data.host?.signature_url, 'signature_url')}
                    {renderSignaturePreview(data.host?.signature_image_url, 'signature_image_url')}
                    {renderSignaturePreview(data.host?.signature_svg, 'signature_svg')}
                  </div>
                </CardContent>
              </Card>

              {/* Données Propriété */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Données Propriété</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <strong>name:</strong> {data.property?.name || <Badge variant="secondary">Non défini</Badge>}
                    </div>
                    <div>
                      <strong>address:</strong> {data.property?.address || <Badge variant="secondary">Non défini</Badge>}
                    </div>
                    <div>
                      <strong>city:</strong> {data.property?.city || <Badge variant="secondary">Non défini</Badge>}
                    </div>
                    <div>
                      <strong>contact_info.name:</strong> {data.property?.contact_info?.name || <Badge variant="secondary">Non défini</Badge>}
                    </div>
                  </div>
                  
                  {data.property?.owner_names && (
                    <div>
                      <strong>owner_names:</strong> {data.property.owner_names.join(', ')}
                    </div>
                  )}

                  {data.property?.contract_template && (
                    <div>
                      <strong>Template contrat:</strong>
                      <div className="text-xs bg-gray-50 p-2 rounded mt-1">
                        <div>landlord_name: {data.property.contract_template.landlord_name || 'Non défini'}</div>
                        <div>landlord_signature: {data.property.contract_template.landlord_signature ? 'Présente' : 'Absente'}</div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Données Réservation */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Données Réservation</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <strong>check_in_date:</strong> {data.booking?.check_in_date || <Badge variant="secondary">Non défini</Badge>}
                    </div>
                    <div>
                      <strong>check_out_date:</strong> {data.booking?.check_out_date || <Badge variant="secondary">Non défini</Badge>}
                    </div>
                  </div>
                  
                  <div>
                    <strong>Invités:</strong> {data.booking?.guests?.length || 0} trouvé(s)
                    {data.booking?.guests?.map((guest, index) => (
                      <div key={index} className="text-xs bg-gray-50 p-2 rounded mt-1">
                        <div>Nom: {guest.full_name || 'Non défini'}</div>
                        <div>Document: {guest.document_number || 'Non défini'}</div>
                        <div>Nationalité: {guest.nationality || 'Non défini'}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Réponse brute */}
              {rawResponse && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Réponse Edge Function</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xs bg-gray-900 text-gray-100 p-3 rounded overflow-auto max-h-64">
                      <pre>{JSON.stringify(rawResponse, null, 2)}</pre>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
