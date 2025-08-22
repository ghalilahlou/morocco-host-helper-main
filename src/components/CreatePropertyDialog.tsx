import { useState, useEffect, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Minus, Pen, Upload, Image as ImageIcon, X } from 'lucide-react';
import { Property } from '@/types/booking';
import { useProperties } from '@/hooks/useProperties';
import { useAuth } from '@/hooks/useAuth';
import { usePropertyPhotoUpload } from '@/hooks/usePropertyPhotoUpload';
import { DocumentPreview } from './DocumentPreview';
interface CreatePropertyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  property?: Property;
  onSuccess?: () => void;
}
interface PropertyFormData {
  name: string;
  address: string;
  postal_code: string;
  city: string;
  country: string;
  property_type: string;
  max_occupancy: number;
  description: string;
  // Contract template fields
  landlord_status: string;
  landlord_name: string;
  landlord_company: string;
  landlord_registration: string;
  landlord_address: string;
  landlord_phone: string;
  landlord_email: string;
  house_rules: string[];
  landlord_signature?: string;
}
export const CreatePropertyDialog = ({
  open,
  onOpenChange,
  property,
  onSuccess
}: CreatePropertyDialogProps) => {
  const {
    addProperty,
    updateProperty
  } = useProperties();
  const { user } = useAuth();
  const { uploadPhoto, deletePhoto, uploading } = usePropertyPhotoUpload();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentTab, setCurrentTab] = useState('basic');
  const [landlordSignature, setLandlordSignature] = useState<string | null>(null);
  const [isSignatureModeActive, setIsSignatureModeActive] = useState(false);
  const [propertyPhoto, setPropertyPhoto] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [houseRules, setHouseRules] = useState<string[]>(property?.house_rules || ['No unauthorized guests or parties', 'No smoking inside the property', 'Respect neighbors and building rules', 'Report any damage immediately', 'Check-out by agreed time']);
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    control,
    formState: {
      errors
    }
  } = useForm<PropertyFormData>({
    defaultValues: {
      property_type: '',
      name: '',
      address: '',
      postal_code: '',
      city: '',
      country: 'Maroc',
      max_occupancy: 1,
      description: '',
      landlord_status: '',
      landlord_name: '',
      landlord_company: '',
      landlord_registration: '',
      landlord_address: '',
      landlord_phone: '',
      landlord_email: ''
    }
  });
  const watchedLandlordStatus = watch('landlord_status');

  // Validation functions for each tab
  const validateBasicTab = () => {
    const name = watch('name');
    const address = watch('address');
    const postal_code = watch('postal_code');
    const city = watch('city');
    const country = watch('country');
    const property_type = watch('property_type');
    const max_occupancy = watch('max_occupancy');
    
    return !!(name && address && postal_code && city && country && property_type && max_occupancy);
  };

  const validateLandlordTab = () => {
    const landlord_status = watch('landlord_status');
    const landlord_name = watch('landlord_name');
    const landlord_address = watch('landlord_address');
    const landlord_phone = watch('landlord_phone');
    const landlord_email = watch('landlord_email');
    
    let isValid = !!(landlord_status && landlord_name && landlord_address && landlord_phone && landlord_email);
    
    // If status is "entreprise", company name is also required
    if (landlord_status === 'entreprise') {
      const landlord_company = watch('landlord_company');
      isValid = isValid && !!landlord_company;
    }
    
    return isValid;
  };

  const validateContractTab = () => {
    // Contract tab validation - signature is required
    return !!landlordSignature;
  };

  // Update form and house rules when property prop changes
  useEffect(() => {
    if (property) {
      setValue('name', property.name);
      const addressParts = property.address?.split(', ') || [];
      setValue('address', addressParts[0] || '');
      setValue('postal_code', addressParts[1] || '');
      setValue('city', addressParts[2] || '');
      setValue('country', addressParts[3] || 'Maroc');
      setValue('property_type', property.property_type);
      setValue('max_occupancy', property.max_occupancy);
      setValue('description', property.description || '');
      setValue('landlord_status', property.contract_template?.landlord_status || '');
      setValue('landlord_name', property.contract_template?.landlord_name || '');
      setValue('landlord_company', property.contract_template?.landlord_company || '');
      setValue('landlord_registration', property.contract_template?.landlord_registration || '');
      setValue('landlord_address', property.contract_template?.landlord_address || '');
      setValue('landlord_phone', property.contract_template?.landlord_phone || '');
      setValue('landlord_email', property.contract_template?.landlord_email || '');
      setPropertyPhoto(property.photo_url || null);
      setHouseRules(property.house_rules.length > 0 ? property.house_rules : ['No unauthorized guests or parties', 'No smoking inside the property', 'Respect neighbors and building rules', 'Report any damage immediately', 'Check-out by agreed time']);
    } else {
      // Reset form for new property and pre-fill email with user's email
      reset();
      setLandlordSignature(null); // Reset signature for new property
      setPropertyPhoto(null); // Reset photo for new property
      if (user?.email) {
        setValue('landlord_email', user.email);
      }
      setHouseRules(['No unauthorized guests or parties', 'No smoking inside the property', 'Respect neighbors and building rules', 'Report any damage immediately', 'Check-out by agreed time']);
    }
  }, [property, setValue, reset, user?.email]);

  // Initialize signature from existing property
  useEffect(() => {
    if (property?.contract_template?.landlord_signature) {
      setLandlordSignature(property.contract_template.landlord_signature);
    }
  }, [property]);
  const onSubmit = async (data: PropertyFormData) => {
    
    setIsSubmitting(true);
    try {
      const fullAddress = [data.address, data.postal_code, data.city, data.country].filter(Boolean).join(', ');
      
      const propertyData = {
        name: data.name,
        address: fullAddress,
        property_type: data.property_type,
        max_occupancy: data.max_occupancy,
        description: data.description,
        photo_url: propertyPhoto,
        house_rules: houseRules,
        contract_template: {
          landlord_name: data.landlord_name,
          landlord_company: data.landlord_company,
          landlord_registration: data.landlord_registration,
          landlord_address: data.landlord_address,
          landlord_phone: data.landlord_phone,
          landlord_email: data.landlord_email,
          landlord_signature: landlordSignature,
          landlord_status: data.landlord_status
        }
      };
      if (property) {
        await updateProperty(property.id, propertyData);
      } else {
        await addProperty(propertyData);
      }

      // Call onSuccess callback to refresh parent component and close dialog
      onSuccess?.();
      reset();
      setCurrentTab('basic'); // Reset to first tab
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving property:', error);
      // Show user-friendly error message
      alert('Erreur lors de la sauvegarde. Veuillez réessayer.');
    } finally {
      setIsSubmitting(false);
    }
  };
  const addHouseRule = () => {
    setHouseRules([...houseRules, '']);
  };
  const removeHouseRule = (index: number) => {
    setHouseRules(houseRules.filter((_, i) => i !== index));
  };
  const updateHouseRule = (index: number, value: string) => {
    const updated = [...houseRules];
    updated[index] = value;
    setHouseRules(updated);
  };
  
  // Signature canvas logic
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isSignatureModeActive) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Setup canvas for better quality
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    
    ctx.scale(dpr, dpr);
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';

    // Anti-aliasing and smooth lines
    ctx.imageSmoothingEnabled = true;
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    let isDrawing = false;

    const startDrawing = (e: MouseEvent | TouchEvent) => {
      isDrawing = true;
      const rect = canvas.getBoundingClientRect();
      let x, y;
      
      if (e instanceof MouseEvent) {
        x = e.clientX - rect.left;
        y = e.clientY - rect.top;
      } else {
        e.preventDefault();
        x = e.touches[0].clientX - rect.left;
        y = e.touches[0].clientY - rect.top;
      }

      ctx.beginPath();
      ctx.moveTo(x, y);
    };

    const draw = (e: MouseEvent | TouchEvent) => {
      if (!isDrawing) return;
      
      const rect = canvas.getBoundingClientRect();
      let x, y;
      
      if (e instanceof MouseEvent) {
        x = e.clientX - rect.left;
        y = e.clientY - rect.top;
      } else {
        e.preventDefault();
        x = e.touches[0].clientX - rect.left;
        y = e.touches[0].clientY - rect.top;
      }

      ctx.lineTo(x, y);
      ctx.stroke();
    };

    const stopDrawing = () => {
      isDrawing = false;
      setLandlordSignature(canvas.toDataURL());
    };

    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('touchstart', startDrawing);
    canvas.addEventListener('touchmove', draw);
    canvas.addEventListener('touchend', stopDrawing);

    // Setup canvas
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';

    return () => {
      canvas.removeEventListener('mousedown', startDrawing);
      canvas.removeEventListener('mousemove', draw);
      canvas.removeEventListener('mouseup', stopDrawing);
      canvas.removeEventListener('touchstart', startDrawing);
      canvas.removeEventListener('touchmove', draw);
      canvas.removeEventListener('touchend', stopDrawing);
    };
  }, [isSignatureModeActive]);

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setLandlordSignature(null);
  };
  
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // Check file type
    if (!file.type.startsWith('image/')) {
      alert('Veuillez sélectionner un fichier image');
      return;
    }
    
    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Le fichier est trop volumineux. Taille maximum: 5MB');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setLandlordSignature(result);
      
    };
    reader.readAsDataURL(file);
  };

  const handlePropertyPhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const photoUrl = await uploadPhoto(file);
    if (photoUrl) {
      setPropertyPhoto(photoUrl);
    }
  };

  const handleRemovePropertyPhoto = async () => {
    if (propertyPhoto) {
      const success = await deletePhoto(propertyPhoto);
      if (success) {
        setPropertyPhoto(null);
      }
    }
  };
  
  const propertyTypes = [{
    value: 'apartment',
    label: 'Appartement'
  }, {
    value: 'house',
    label: 'Maison'
  }, {
    value: 'room',
    label: 'Chambre'
  }, {
    value: 'other',
    label: 'Autre'
  }];
  return <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
            <DialogTitle>
              {property ? 'Modifier le bien' : 'Ajouter un bien'}
            </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit(onSubmit)}>
          <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full">
            <div className="w-full overflow-x-auto">
              <TabsList className="inline-flex w-max min-w-full sm:grid sm:w-full sm:grid-cols-4">
                <TabsTrigger value="basic" className="flex-shrink-0 text-xs sm:text-sm px-2 sm:px-4">1. Infos de base</TabsTrigger>
                <TabsTrigger value="landlord" className="flex-shrink-0 text-xs sm:text-sm px-2 sm:px-4">2. Infos Loueur</TabsTrigger>
                <TabsTrigger value="contract" className="flex-shrink-0 text-xs sm:text-sm px-2 sm:px-4">3. Configuration</TabsTrigger>
                <TabsTrigger value="preview" className="flex-shrink-0 text-xs sm:text-sm px-2 sm:px-4">4. Aperçu</TabsTrigger>
              </TabsList>
            </div>
            
            <TabsContent value="basic" className="space-y-4 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Propriété Information</CardTitle>
                  <CardDescription>Détails de base sur votre propriété — ils doivent correspondre à ceux affichés sur votre page Airbnb.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Titre de votre Annonce *</Label>
                      <Input id="name" placeholder="e.g. Downtown Apartment" {...register('name', {
                      required: 'Property name is required'
                    })} />
                      {errors.name && <span className="text-sm text-destructive">{errors.name.message}</span>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="property_type">Type de logement *</Label>
                      <Controller name="property_type" control={control} rules={{
                      required: 'Property type is required'
                    }} render={({
                      field
                    }) => <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Sélectionnez le type de logement" />
                            </SelectTrigger>
                            <SelectContent className="z-[1120]">
                              {propertyTypes.map(type => <SelectItem key={type.value} value={type.value}>
                                  {type.label}
                                </SelectItem>)}
                            </SelectContent>
                          </Select>} />
                      {errors.property_type && <span className="text-sm text-destructive">{errors.property_type.message}</span>}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address">Adresse *</Label>
                    <Input id="address" placeholder="ex: 123 Rue Mohammed V" {...register('address', { required: 'L\'adresse est obligatoire' })} />
                    {errors.address && <span className="text-sm text-destructive">{errors.address.message}</span>}
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="postal_code">Code postal *</Label>
                      <Input id="postal_code" placeholder="ex: 20000" {...register('postal_code', { required: 'Le code postal est obligatoire' })} />
                      {errors.postal_code && <span className="text-sm text-destructive">{errors.postal_code.message}</span>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="city">Ville *</Label>
                      <Input id="city" placeholder="ex: Casablanca" {...register('city', { required: 'La ville est obligatoire' })} />
                      {errors.city && <span className="text-sm text-destructive">{errors.city.message}</span>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="country">Pays *</Label>
                      <Input id="country" {...register('country', { required: 'Le pays est obligatoire' })} />
                      {errors.country && <span className="text-sm text-destructive">{errors.country.message}</span>}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="max_occupancy">Capacité maximale *</Label>
                      <Input id="max_occupancy" type="number" min="1" max="20" {...register('max_occupancy', {
                      required: 'Maximum occupancy is required',
                      min: {
                        value: 1,
                        message: 'Must be at least 1'
                      },
                      max: {
                        value: 20,
                        message: 'Must be 20 or less'
                      }
                    })} />
                      {errors.max_occupancy && <span className="text-sm text-destructive">{errors.max_occupancy.message}</span>}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description (Optionnel)</Label>
                    <Textarea id="description" placeholder="Brève description de votre propriété…" rows={3} {...register('description')} />
                  </div>

                  <div className="space-y-2">
                    <Label>Photo de la propriété (Optionnel)</Label>
                    {!propertyPhoto ? (
                      <div className="border-2 border-dashed border-muted-foreground/20 rounded-lg p-6 text-center bg-muted/5">
                        <ImageIcon className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                        <p className="text-sm text-muted-foreground mb-3">
                          Ajoutez une photo de votre propriété pour la rendre plus attrayante
                        </p>
                        <div className="relative">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handlePropertyPhotoUpload}
                            className="hidden"
                            id="property-photo-upload"
                            disabled={uploading}
                          />
                          <Button 
                            type="button"
                            onClick={() => document.getElementById('property-photo-upload')?.click()}
                            variant="outline"
                            disabled={uploading}
                            className="gap-2"
                          >
                            <Upload className="w-4 h-4" />
                            {uploading ? 'Upload en cours...' : 'Choisir une photo'}
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          JPG, PNG ou GIF. Taille max: 5MB
                        </p>
                      </div>
                    ) : (
                      <div className="border rounded-lg p-4 bg-muted/5">
                        <p className="text-sm text-muted-foreground mb-3">Photo actuelle:</p>
                        <div className="relative">
                          <img 
                            src={propertyPhoto} 
                            alt="Property" 
                            className="w-full h-48 object-cover rounded-lg border"
                          />
                          <Button
                            type="button"
                            onClick={handleRemovePropertyPhoto}
                            variant="destructive"
                            size="sm"
                            className="absolute top-2 right-2 gap-1"
                          >
                            <X className="w-3 h-3" />
                            Supprimer
                          </Button>
                        </div>
                        <div className="mt-3">
                          <div className="relative">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handlePropertyPhotoUpload}
                              className="hidden"
                              id="property-photo-change"
                              disabled={uploading}
                            />
                            <Button 
                              type="button"
                              onClick={() => document.getElementById('property-photo-change')?.click()}
                              variant="outline"
                              size="sm"
                              disabled={uploading}
                              className="gap-1"
                            >
                              <ImageIcon className="w-3 h-3" />
                              {uploading ? 'Upload en cours...' : 'Changer la photo'}
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="landlord" className="space-y-4 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Informations du loueur / de l’entreprise</CardTitle>
                  <CardDescription>Informations qui apparaîtront comme « Le Loueur » dans les contrats.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="landlord_status">Statut *</Label>
                    <Controller 
                      name="landlord_status" 
                      control={control} 
                      rules={{ required: 'Le statut est obligatoire' }} 
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Sélectionnez votre statut" />
                          </SelectTrigger>
                          <SelectContent className="z-[1120] bg-background border shadow-lg">
                            <SelectItem value="particulier">Particulier</SelectItem>
                            <SelectItem value="entreprise">Entreprise</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {errors.landlord_status && <span className="text-sm text-destructive">{errors.landlord_status.message}</span>}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="landlord_name">Nom complet ou personne de contact *</Label>
                      <Input id="landlord_name" placeholder="ex: Mohamed Flane" {...register('landlord_name', { required: 'Le nom complet est obligatoire' })} />
                      {errors.landlord_name && <span className="text-sm text-destructive">{errors.landlord_name.message}</span>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="landlord_company">Raison sociale (Nom de l’entreprise) {watchedLandlordStatus === 'entreprise' && '*'}</Label>
                      <Input id="landlord_company" placeholder="ex: Casablanca Properties SARL" {...register('landlord_company', watchedLandlordStatus === 'entreprise' ? { required: 'La raison sociale est obligatoire' } : {})} />
                      {errors.landlord_company && <span className="text-sm text-destructive">{errors.landlord_company.message}</span>}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="landlord_registration">Numéro d’immatriculation {watchedLandlordStatus === 'entreprise' && '*'}</Label>
                    <Input id="landlord_registration" placeholder="ex: 10101010101010101" {...register('landlord_registration', watchedLandlordStatus === 'entreprise' ? { required: 'Le numéro d’immatriculation est obligatoire' } : {})} />
                    {errors.landlord_registration && <span className="text-sm text-destructive">{errors.landlord_registration.message}</span>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="landlord_address">Adresse *</Label>
                    <Textarea id="landlord_address" placeholder="ex: 45 Boulevard Mohammed V, 4ème étage, Maarif, Casablanca" rows={3} {...register('landlord_address', { required: 'L’adresse est obligatoire' })} />
                    {errors.landlord_address && <span className="text-sm text-destructive">{errors.landlord_address.message}</span>}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="landlord_phone">Numéro de téléphone *</Label>
                      <Input id="landlord_phone" placeholder="ex: +212 6 61 10 10 10" {...register('landlord_phone', { required: 'Le numéro de téléphone est obligatoire' })} />
                      {errors.landlord_phone && <span className="text-sm text-destructive">{errors.landlord_phone.message}</span>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="landlord_email">Adresse e‑mail *</Label>
                      <Input id="landlord_email" type="email" placeholder="ex: contact@casablancaproperties.ma" {...register('landlord_email', { required: 'L’adresse e‑mail est obligatoire' })} />
                      {errors.landlord_email && <span className="text-sm text-destructive">{errors.landlord_email.message}</span>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="contract" className="space-y-4 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Paramètres du contrat</CardTitle>
                  <CardDescription>Personnalisez votre modèle de contrat de location.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label>Règlement intérieur</Label>
                      <Button type="button" variant="outline" size="sm" onClick={addHouseRule} className="gap-1">
                        <Plus className="h-3 w-3" />
                        Ajouter une règle
                      </Button>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Personnalisez les règles qui apparaîtront dans vos contrats de location.
                    </div>
                    
                    <div className="space-y-3">
                      {houseRules.map((rule, index) => <div key={index} className="flex gap-2">
                          <Input value={rule} onChange={e => updateHouseRule(index, e.target.value)} placeholder="Saisissez une règle du logement…" className="flex-1" />
                          {houseRules.length > 1 && <Button type="button" variant="outline" size="sm" onClick={() => removeHouseRule(index)} className="px-2">
                              <Minus className="h-3 w-3" />
                            </Button>}
                        </div>)}
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Pen className="w-5 h-5" />
                    Signature du Propriétaire
                  </CardTitle>
                  <CardDescription>Ajoutez votre signature qui apparaîtra dans les contrats</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!isSignatureModeActive && !landlordSignature && (
                    <div className="space-y-3">
                      <Button 
                        type="button"
                        onClick={() => setIsSignatureModeActive(true)}
                        variant="outline"
                        className="w-full"
                      >
                        <Pen className="w-4 h-4 mr-2" />
                        Signer à la main
                      </Button>
                      
                      <div className="relative">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                          id="signature-upload"
                        />
                        <Button 
                          type="button"
                          onClick={() => document.getElementById('signature-upload')?.click()}
                          variant="outline"
                          className="w-full"
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          Uploader signature/cachet
                        </Button>
                      </div>
                      
                      <p className="text-xs text-muted-foreground text-center">
                        Vous pouvez signer directement ou uploader une image de votre signature avec cachet d'entreprise
                      </p>
                    </div>
                  )}
                  
                  {isSignatureModeActive && (
                    <div className="space-y-4">
                      <div className="border-2 border-dashed border-muted-foreground/20 rounded-lg p-4 bg-muted/5">
                        <p className="text-sm text-muted-foreground mb-2">
                          Signez dans la zone ci-dessous:
                        </p>
                        <canvas
                          ref={canvasRef}
                          width={400}
                          height={150}
                          className="w-full border rounded bg-background cursor-crosshair"
                        />
                      </div>
                      
                      <div className="flex gap-2">
                        <Button 
                          type="button"
                          onClick={clearSignature}
                          variant="outline"
                          className="flex-1"
                        >
                          Effacer
                        </Button>
                        <Button 
                          type="button"
                          onClick={() => setIsSignatureModeActive(false)}
                          variant="outline"
                          className="flex-1"
                        >
                          Terminer
                        </Button>
                      </div>
                      
                      {landlordSignature && (
                        <div className="text-center">
                          <p className="text-sm text-green-600 font-medium">✓ Signature ajoutée</p>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {landlordSignature && !isSignatureModeActive && (
                    <div className="border rounded-lg p-4 bg-muted/5">
                      <p className="text-sm text-muted-foreground mb-2">Signature actuelle:</p>
                      <img src={landlordSignature} alt="Signature" className="border rounded max-h-20 max-w-full object-contain" />
                      <div className="flex gap-2 mt-3">
                        <Button 
                          type="button"
                          onClick={() => setIsSignatureModeActive(true)}
                          variant="outline"
                          size="sm"
                          className="flex-1"
                        >
                          <Pen className="w-3 h-3 mr-1" />
                          Modifier signature
                        </Button>
                        <div className="relative flex-1">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
                            className="hidden"
                            id="signature-upload-modify"
                          />
                          <Button 
                            type="button"
                            onClick={() => document.getElementById('signature-upload-modify')?.click()}
                            variant="outline"
                            size="sm"
                            className="w-full"
                          >
                            <ImageIcon className="w-3 h-3 mr-1" />
                            Changer image
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="preview" className="space-y-4 mt-6">
              <DocumentPreview 
                property={property || {} as Property} 
                formData={{
                  ...watch(),
                  house_rules: houseRules,
                  landlord_signature: landlordSignature || undefined,
                }} 
              />
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            {currentTab === 'basic' && (
              <Button 
                type="button" 
                onClick={() => {
                  if (validateBasicTab()) {
                    setCurrentTab('landlord');
                  } else {
                    alert('Veuillez remplir tous les champs obligatoires de cet onglet.');
                  }
                }}
                disabled={!validateBasicTab()}
              >
                Suivant
              </Button>
            )}
            {currentTab === 'landlord' && (
              <>
                <Button 
                  type="button" 
                  onClick={() => setCurrentTab('basic')}
                  variant="outline"
                >
                  Précédent
                </Button>
                <Button 
                  type="button" 
                  onClick={() => {
                    if (validateLandlordTab()) {
                      setCurrentTab('contract');
                    } else {
                      alert('Veuillez remplir tous les champs obligatoires de cet onglet.');
                    }
                  }}
                  disabled={!validateLandlordTab()}
                >
                  Suivant
                </Button>
              </>
            )}
            {currentTab === 'contract' && (
              <>
                <Button 
                  type="button" 
                  onClick={() => setCurrentTab('landlord')}
                  variant="outline"
                >
                  Précédent
                </Button>
                <Button 
                  type="button" 
                  onClick={() => {
                    if (validateContractTab()) {
                      setCurrentTab('preview');
                    } else {
                      alert('Veuillez ajouter votre signature avant de continuer.');
                    }
                  }}
                  disabled={!validateContractTab()}
                >
                  Aperçu Documents
                </Button>
              </>
            )}
            {currentTab === 'preview' && (
              <>
                <Button 
                  type="button" 
                  onClick={() => setCurrentTab('contract')}
                  variant="outline"
                >
                  Précédent
                </Button>
                <Button 
                  type="submit" 
                  disabled={isSubmitting}
                  onClick={() => {
                    // Ensure form validation and submission
                    handleSubmit(onSubmit)();
                  }}
                >
                  {isSubmitting ? 'Enregistrement...' : property ? 'Mettre à jour' : 'Créer la propriété'}
                </Button>
              </>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>;
};