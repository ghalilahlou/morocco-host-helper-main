import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { FileText, Download, Calendar, User, MapPin, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { ContractService } from '@/services/contractService';

interface SignedContract {
  id: string;
  booking_id: string;
  signature_data: string;
  contract_content: string;
  signed_at: string;
  booking: {
    check_in_date: string;
    check_out_date: string;
    number_of_guests: number;
    property: {
      name: string;
      address: string;
    };
  };
  guest_submission: {
    guest_data: any;
  };
}

export const SignedContractsView: React.FC = () => {
  const [contracts, setContracts] = useState<SignedContract[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      loadSignedContracts();
    }
  }, [user]);

  const loadSignedContracts = async () => {
    try {
      
      
      // Use RPC function since types aren't updated yet
      const { data, error } = await (supabase as any).rpc('get_signed_contracts_for_user', {
        p_user_id: user?.id
      });


      if (error) {
        console.error('❌ RPC error:', error);
        throw error;
      }

      
      setContracts(data || []);
    } catch (error) {
      console.error('Error loading signed contracts:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les contrats signés.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const downloadContract = async (contract: SignedContract) => {
    try {
      // Extract guest data
      const guests = contract.guest_submission?.guest_data?.guests || [];
      
      // Create booking data object compatible with Booking interface
      const bookingData = {
        id: contract.booking_id,
        checkInDate: contract.booking.check_in_date,
        checkOutDate: contract.booking.check_out_date,
        numberOfGuests: contract.booking.number_of_guests,
        guests: guests,
        status: 'completed' as const,
        createdAt: contract.signed_at,
        documentsGenerated: {
          policeForm: false,
          contract: true
        },
        property: {
          id: '',
          name: contract.booking.property.name,
          address: contract.booking.property.address,
          property_type: 'apartment',
          max_occupancy: contract.booking.number_of_guests,
          description: '',
          contact_info: {},
          house_rules: [],
          contract_template: {},
          user_id: '',
          created_at: '',
          updated_at: ''
        }
      };

      const result = await ContractService.downloadSignedContractPdf(contract, bookingData);

      if (result.success) {
        toast({
          title: "Contrat téléchargé",
          description: result.message,
        });
      } else {
        toast({
          title: "Erreur",
          description: result.message,
          variant: result.variant,
        });
      }
    } catch (error) {
      console.error('Error downloading contract:', error);
      toast({
        title: "Erreur",
        description: "Impossible de télécharger le contrat.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center">Chargement des contrats signés...</div>
        </CardContent>
      </Card>
    );
  }

  if (contracts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Contrats signés
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Aucun contrat signé pour le moment</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Contrats signés ({contracts.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-96">
          <div className="space-y-4">
            {contracts.map((contract, index) => (
              <div key={contract.id}>
                <div className="flex items-start justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground">
                        {contract.booking.property.name}
                      </h3>
                      <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
                        Signé
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        {contract.booking.property.address}
                      </div>
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        {contract.guest_submission?.guest_data?.guests?.[0]?.fullName || 'Nom non disponible'}
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        {new Date(contract.booking.check_in_date).toLocaleDateString('fr-FR')} - {new Date(contract.booking.check_out_date).toLocaleDateString('fr-FR')}
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Signé le {new Date(contract.signed_at).toLocaleDateString('fr-FR')}
                      </div>
                    </div>

                    <div className="text-xs text-muted-foreground">
                      {contract.booking.number_of_guests} invité(s)
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 ml-4">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => downloadContract(contract)}
                      className="w-full"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      <span className="hidden sm:inline">Télécharger</span>
                      <span className="sm:hidden">DL</span>
                    </Button>
                  </div>
                </div>
                
                {index < contracts.length - 1 && <Separator className="my-2" />}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};