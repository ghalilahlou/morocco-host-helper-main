import { useState } from 'react';
import { Plus, Building2, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Property } from '@/types/booking';
import { CreatePropertyDialog } from './CreatePropertyDialog';

interface PropertySelectorProps {
  properties: Property[];
  selectedProperty: Property | null;
  onPropertySelect: (property: Property) => void;
  isLoading?: boolean;
}

export const PropertySelector = ({
  properties,
  selectedProperty,
  onPropertySelect,
  isLoading = false
}: PropertySelectorProps) => {
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center gap-3">
        <div className="h-10 w-48 bg-muted animate-pulse rounded-md" />
        <div className="h-10 w-32 bg-muted animate-pulse rounded-md" />
      </div>
    );
  }

  if (properties.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 p-8 text-center">
        <Building2 className="h-12 w-12 text-muted-foreground" />
        <div>
          <h3 className="text-lg font-semibold">Aucun bien trouvé</h3>
          <p className="text-muted-foreground">Créez votre première propriété pour commencer à gérer les réservations.</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Your First Property
        </Button>
        <CreatePropertyDialog 
          open={showCreateDialog} 
          onOpenChange={setShowCreateDialog}
        />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <Select 
        value={selectedProperty?.id || ''} 
        onValueChange={(value) => {
          const property = properties.find(p => p.id === value);
          if (property) onPropertySelect(property);
        }}
      >
        <SelectTrigger className="w-64">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            <SelectValue placeholder="Select a property" />
            {selectedProperty && (
              <Badge variant="secondary" className="ml-auto">
                {selectedProperty.property_type}
              </Badge>
            )}
          </div>
        </SelectTrigger>
        <SelectContent>
          {properties.map((property) => (
            <SelectItem key={property.id} value={property.id}>
              <div className="flex flex-col gap-1">
                <span className="font-medium">{property.name}</span>
                {property.address && (
                  <span className="text-sm text-muted-foreground">{property.address}</span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button variant="outline" size="sm" onClick={() => setShowCreateDialog(true)} className="gap-1">
        <Plus className="h-3 w-3" />
        Ajouter un bien
      </Button>

      <CreatePropertyDialog 
        open={showCreateDialog} 
        onOpenChange={setShowCreateDialog}
      />
    </div>
  );
};