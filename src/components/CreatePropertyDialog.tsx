import { useState, useEffect, useRef, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Minus, Pen, Upload, Image as ImageIcon, X, Home, FileText, Eye } from 'lucide-react';
import { Property } from '@/types/booking';
import { useProperties } from '@/hooks/useProperties';
import { useAuth } from '@/hooks/useAuth';
import { usePropertyPhotoUpload } from '@/hooks/usePropertyPhotoUpload';
import { DocumentPreview } from './DocumentPreview';
import { SignaturePad } from './SignaturePad';
import { useT } from '@/i18n/GuestLocaleProvider';
import '@/styles/CreatePropertyDialog.css';
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
  const t = useT();
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
  const getDefaultHouseRules = useCallback(() => [
    t('property.defaultRule.noParties'),
    t('property.defaultRule.noSmoking'),
    t('property.defaultRule.respectNeighbors'),
    t('property.defaultRule.reportDamage'),
    t('property.defaultRule.checkoutTime')
  ], [t]);
  const defaultHouseRulesRef = useRef<string[]>([]);
  defaultHouseRulesRef.current = getDefaultHouseRules();
  const [houseRules, setHouseRules] = useState<string[]>(() =>
    property?.house_rules?.length ? property.house_rules : getDefaultHouseRules()
  );
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
      setHouseRules(property.house_rules.length > 0 ? property.house_rules : defaultHouseRulesRef.current);
    } else {
      // Reset form for new property and pre-fill email with user's email
      reset();
      setLandlordSignature(null); // Reset signature for new property
      setPropertyPhoto(null); // Reset photo for new property
      if (user?.email) {
        setValue('landlord_email', user.email);
      }
      setHouseRules(defaultHouseRulesRef.current);
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
  
  // Signature is now handled by SignaturePad component

  const clearSignature = () => {
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
    label: t('property.types.apartment')
  }, {
    value: 'house',
    label: t('property.types.house')
  }, {
    value: 'room',
    label: t('property.types.room')
  }, {
    value: 'other',
    label: t('property.types.other')
  }];
  return <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="create-property-dialog sm:max-w-[889px] p-0" 
        style={{ 
          background: '#FDFDF9', 
          borderRadius: '24px', 
          overflow: 'hidden',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <DialogHeader className="px-6 pt-6 pb-0 flex-shrink-0">
            <DialogTitle className="dialog-title" style={{ fontFamily: "'Fira Sans Condensed', sans-serif", fontWeight: 400, fontSize: '24px', color: '#040404' }}>
              {property ? t('property.dialog.editTitle') : t('property.dialog.addTitle')}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {property ? t('property.dialog.editTitle') : t('property.dialog.addTitle')}
            </DialogDescription>
        </DialogHeader>
        
        {/* Scrollable content area with custom scrollbar */}
        <div 
          className="property-dialog-scroll flex-1 overflow-y-auto px-6 pb-6"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(85, 186, 159, 0.5) transparent'
          }}
        >
        <form onSubmit={handleSubmit(onSubmit)}>
          <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full">
            <div className="property-tabs w-full mt-4" style={{ background: '#FFFFFF', boxShadow: 'inset 0px -1px 0px #EBEBEB' }}>
              <TabsList className="property-tabs-list inline-flex w-max min-w-full sm:grid sm:w-full sm:grid-cols-4 gap-6 bg-transparent h-auto p-0">
                <TabsTrigger 
                  value="basic" 
                  className="property-tabs-trigger flex-shrink-0 text-sm px-0 py-3 data-[state=active]:text-[#222222] data-[state=inactive]:text-[#717171] bg-transparent border-0 rounded-none relative data-[state=active]:shadow-none"
                  style={{ fontFamily: "'Inter', sans-serif" }}
                >
                  {t('property.tabs.basic')}
                  <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#222222] transition-opacity" style={{ opacity: currentTab === 'basic' ? 1 : 0 }} />
                </TabsTrigger>
                <TabsTrigger 
                  value="landlord" 
                  className="property-tabs-trigger flex-shrink-0 text-sm px-0 py-3 data-[state=active]:text-[#222222] data-[state=inactive]:text-[#717171] bg-transparent border-0 rounded-none relative data-[state=active]:shadow-none"
                  style={{ fontFamily: "'Inter', sans-serif" }}
                >
                  {t('property.tabs.landlord')}
                  <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#222222] transition-opacity" style={{ opacity: currentTab === 'landlord' ? 1 : 0 }} />
                </TabsTrigger>
                <TabsTrigger 
                  value="contract" 
                  className="property-tabs-trigger flex-shrink-0 text-sm px-0 py-3 data-[state=active]:text-[#222222] data-[state=inactive]:text-[#717171] bg-transparent border-0 rounded-none relative data-[state=active]:shadow-none"
                  style={{ fontFamily: "'Inter', sans-serif" }}
                >
                  {t('property.tabs.contract')}
                  <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#222222] transition-opacity" style={{ opacity: currentTab === 'contract' ? 1 : 0 }} />
                </TabsTrigger>
                <TabsTrigger 
                  value="preview" 
                  className="property-tabs-trigger flex-shrink-0 text-sm px-0 py-3 data-[state=active]:text-[#222222] data-[state=inactive]:text-[#717171] bg-transparent border-0 rounded-none relative data-[state=active]:shadow-none"
                  style={{ fontFamily: "'Inter', sans-serif" }}
                >
                  {t('property.tabs.preview')}
                  <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#222222] transition-opacity" style={{ opacity: currentTab === 'preview' ? 1 : 0 }} />
                </TabsTrigger>
              </TabsList>
            </div>
            
            <TabsContent value="basic" className="space-y-4 mt-6">
              <Card className="property-form-card border-0" style={{ background: '#FFFFFF', boxShadow: '0px 4px 4px rgba(0, 0, 0, 0.25)', borderRadius: '12px' }}>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Home className="w-5 h-5 text-[#040404]" />
                    <CardTitle className="property-section-title" style={{ fontFamily: "'Fira Sans Condensed', sans-serif", fontWeight: 400, fontSize: '16px', color: '#040404' }}>
                      {t('property.basic.title')}
                    </CardTitle>
                  </div>
                  <CardDescription className="property-section-description" style={{ fontFamily: "'Fira Sans Condensed', sans-serif", fontWeight: 400, fontSize: '12px', color: '#4B5563' }}>
                    {t('property.basic.subtitle')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">{t('property.basic.nameLabel')}</Label>
                      <Input id="name" placeholder={t('property.basic.namePlaceholder')} {...register('name', {
                      required: 'Property name is required'
                    })} />
                      {errors.name && <span className="text-sm text-destructive">{errors.name.message}</span>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="property_type">{t('property.basic.typeLabel')}</Label>
                      <Controller name="property_type" control={control} rules={{
                      required: 'Property type is required'
                    }} render={({
                      field
                    }) => <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder={t('property.basic.typePlaceholder')} />
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
                    <Label htmlFor="address">{t('property.basic.addressLabel')}</Label>
                    <Input id="address" placeholder={t('property.basic.addressPlaceholder')} {...register('address', { required: 'L\'adresse est obligatoire' })} />
                    {errors.address && <span className="text-sm text-destructive">{errors.address.message}</span>}
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="postal_code">{t('property.basic.postalCodeLabel')}</Label>
                      <Input id="postal_code" placeholder={t('property.basic.postalCodePlaceholder')} {...register('postal_code', { required: 'Le code postal est obligatoire' })} />
                      {errors.postal_code && <span className="text-sm text-destructive">{errors.postal_code.message}</span>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="city">{t('property.basic.cityLabel')}</Label>
                      <Input id="city" placeholder={t('property.basic.cityPlaceholder')} {...register('city', { required: 'La ville est obligatoire' })} />
                      {errors.city && <span className="text-sm text-destructive">{errors.city.message}</span>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="country">{t('property.basic.countryLabel')}</Label>
                      <Input id="country" {...register('country', { required: 'Le pays est obligatoire' })} />
                      {errors.country && <span className="text-sm text-destructive">{errors.country.message}</span>}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="max_occupancy">{t('property.basic.maxOccupancyLabel')}</Label>
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
                    <Label htmlFor="description">{t('property.basic.descriptionLabel')}</Label>
                    <Textarea id="description" placeholder={t('property.basic.descriptionPlaceholder')} rows={3} {...register('description')} />
                  </div>

                  <div className="space-y-2">
                    <Label className="property-form-label" style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500, fontSize: '12px', color: '#040404' }}>
                      {t('property.basic.photoLabel')}
                    </Label>
                    {!propertyPhoto ? (
                      <div className="property-upload-zone rounded-xl p-4" style={{ background: '#2D2F39' }}>
                        <div className="property-upload-zone-inner flex flex-col items-center justify-center gap-3 p-6 rounded-md" style={{ background: '#1E1E1E', border: '1px dashed #5A5B62' }}>
                          <Upload className="w-6 h-6 text-[#B0B2BC]" />
                          <div className="text-center">
                            <p className="property-upload-zone-text text-sm font-medium" style={{ color: '#B0B2BC' }}>
                              {t('property.basic.photoDropTitle')}
                            </p>
                            <p className="property-upload-zone-subtext text-xs mt-1" style={{ color: 'rgba(176, 178, 188, 0.5)' }}>
                              {t('property.basic.photoDropSubtitle')}
                            </p>
                          </div>
                        </div>
                        <div className="flex justify-center mt-4">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handlePropertyPhotoUpload}
                            className="hidden"
                            id="property-photo-upload"
                            disabled={uploading}
                          />
                          <button
                            type="button"
                            onClick={() => document.getElementById('property-photo-upload')?.click()}
                            disabled={uploading}
                            className="property-upload-button px-4 py-2 rounded-xl text-sm font-medium"
                            style={{ background: '#2D2F39', border: '1px solid #FFFFFF', color: '#FFFFFF' }}
                          >
                            {uploading ? t('property.basic.photoUploading') : t('property.basic.photoUpload')}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="border rounded-lg p-4 bg-muted/5">
                        <p className="text-sm text-muted-foreground mb-3">{t('property.basic.photoCurrent')}</p>
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
                            {t('property.basic.photoRemove')}
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
                              {uploading ? t('property.basic.photoUploading') : t('property.basic.photoChange')}
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
              <Card className="property-form-card border-0" style={{ background: '#FFFFFF', boxShadow: '0px 4px 4px rgba(0, 0, 0, 0.25)', borderRadius: '12px' }}>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-[#040404]" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10 10a4 4 0 100-8 4 4 0 000 8zM10 12c-5.33 0-8 2.67-8 4v2h16v-2c0-1.33-2.67-4-8-4z"/>
                    </svg>
                    <CardTitle className="property-section-title" style={{ fontFamily: "'Fira Sans Condensed', sans-serif", fontWeight: 400, fontSize: '16px', color: '#040404' }}>
                      {t('property.landlord.title')}
                    </CardTitle>
                  </div>
                  <CardDescription className="property-section-description" style={{ fontFamily: "'Fira Sans Condensed', sans-serif", fontWeight: 400, fontSize: '12px', color: '#4B5563' }}>
                    {t('property.landlord.subtitle')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="landlord_status">{t('property.landlord.statusLabel')}</Label>
                    <Controller 
                      name="landlord_status" 
                      control={control} 
                      rules={{ required: 'Le statut est obligatoire' }} 
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder={t('property.landlord.statusPlaceholder')} />
                          </SelectTrigger>
                          <SelectContent className="z-[1120] bg-background border shadow-lg">
                            <SelectItem value="particulier">{t('property.landlord.statusIndividual')}</SelectItem>
                            <SelectItem value="entreprise">{t('property.landlord.statusCompany')}</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {errors.landlord_status && <span className="text-sm text-destructive">{errors.landlord_status.message}</span>}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="landlord_name">{t('property.landlord.nameLabel')}</Label>
                      <Input id="landlord_name" placeholder="ex: Mohamed Flane" {...register('landlord_name', { required: 'Le nom complet est obligatoire' })} />
                      {errors.landlord_name && <span className="text-sm text-destructive">{errors.landlord_name.message}</span>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="landlord_company">{t('property.landlord.companyLabel')} {watchedLandlordStatus === 'entreprise' && '*'}</Label>
                      <Input id="landlord_company" placeholder="ex: Casablanca Properties SARL" {...register('landlord_company', watchedLandlordStatus === 'entreprise' ? { required: 'La raison sociale est obligatoire' } : {})} />
                      {errors.landlord_company && <span className="text-sm text-destructive">{errors.landlord_company.message}</span>}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="landlord_registration">{t('property.landlord.registrationLabel')} {watchedLandlordStatus === 'entreprise' && '*'}</Label>
                    <Input id="landlord_registration" placeholder="ex: 10101010101010101" {...register('landlord_registration', watchedLandlordStatus === 'entreprise' ? { required: 'Le numéro d’immatriculation est obligatoire' } : {})} />
                    {errors.landlord_registration && <span className="text-sm text-destructive">{errors.landlord_registration.message}</span>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="landlord_address">{t('property.landlord.addressLabel')}</Label>
                    <Textarea id="landlord_address" placeholder="ex: 45 Boulevard Mohammed V, 4ème étage, Maarif, Casablanca" rows={3} {...register('landlord_address', { required: 'L’adresse est obligatoire' })} />
                    {errors.landlord_address && <span className="text-sm text-destructive">{errors.landlord_address.message}</span>}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                    <Label htmlFor="landlord_phone">{t('property.landlord.phoneLabel')}</Label>
                      <Input id="landlord_phone" placeholder="ex: +212 6 61 10 10 10" {...register('landlord_phone', { required: 'Le numéro de téléphone est obligatoire' })} />
                      {errors.landlord_phone && <span className="text-sm text-destructive">{errors.landlord_phone.message}</span>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="landlord_email">{t('property.landlord.emailLabel')}</Label>
                      <Input id="landlord_email" type="email" placeholder="ex: contact@casablancaproperties.ma" {...register('landlord_email', { required: 'L’adresse e‑mail est obligatoire' })} />
                      {errors.landlord_email && <span className="text-sm text-destructive">{errors.landlord_email.message}</span>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="contract" className="space-y-4 mt-6">
              <Card className="property-form-card border-0" style={{ background: '#FFFFFF', boxShadow: '0px 4px 4px rgba(0, 0, 0, 0.25)', borderRadius: '12px' }}>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-[#040404]" />
                    <CardTitle className="property-section-title" style={{ fontFamily: "'Fira Sans Condensed', sans-serif", fontWeight: 400, fontSize: '16px', color: '#040404' }}>
                      {t('property.contract.title')}
                    </CardTitle>
                  </div>
                  <CardDescription className="property-section-description" style={{ fontFamily: "'Fira Sans Condensed', sans-serif", fontWeight: 400, fontSize: '12px', color: '#4B5563' }}>
                    {t('property.contract.subtitle')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="property-form-label" style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500, fontSize: '12px', color: '#040404' }}>
                        {t('property.contract.rulesLabel')}
                      </Label>
                      <button 
                        type="button" 
                        onClick={addHouseRule} 
                        className="property-btn-add flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium"
                        style={{ background: 'rgba(85, 186, 159, 0.76)', color: '#040404' }}
                      >
                        <Plus className="h-3 w-3" />
                        {t('property.contract.addRule')}
                      </button>
                    </div>
                    <div className="text-xs" style={{ fontFamily: "'Fira Sans Condensed', sans-serif", color: '#4B5563' }}>
                      {t('property.contract.rulesHelp')}
                    </div>
                    
                    <div className="space-y-3">
                      {houseRules.map((rule, index) => <div key={index} className="flex gap-2">
                          <Input value={rule} onChange={e => updateHouseRule(index, e.target.value)} placeholder={t('property.contract.rulePlaceholder')} className="flex-1" />
                          {houseRules.length > 1 && <Button type="button" variant="outline" size="sm" onClick={() => removeHouseRule(index)} className="px-2">
                              <Minus className="h-3 w-3" />
                            </Button>}
                        </div>)}
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="property-form-card border-0" style={{ background: '#F3F3F3', boxShadow: '0px 4px 4px rgba(0, 0, 0, 0.25)', borderRadius: '12px' }}>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Pen className="w-5 h-5 text-[#040404]" />
                    <CardTitle className="property-section-title" style={{ fontFamily: "'Fira Sans Condensed', sans-serif", fontWeight: 400, fontSize: '16px', color: '#040404' }}>
                      {t('property.contract.signatureTitle')}
                    </CardTitle>
                  </div>
                  <CardDescription className="property-section-description" style={{ fontFamily: "'Fira Sans Condensed', sans-serif", fontWeight: 400, fontSize: '12px', color: '#4B5563' }}>
                    {t('property.contract.signatureSubtitle')}
                  </CardDescription>
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
                        {t('property.contract.signManually')}
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
                          {t('property.contract.uploadSignature')}
                        </Button>
                      </div>
                      
                      <p className="text-xs text-muted-foreground text-center">
                        {t('property.contract.signatureHint')}
                      </p>
                    </div>
                  )}
                  
                  {isSignatureModeActive && (
                    <div className="space-y-4">
                      <SignaturePad 
                        onSignature={(data) => {
                          setLandlordSignature(data);
                          setIsSignatureModeActive(false);
                        }}
                      />
                      <Button 
                        type="button"
                        onClick={() => setIsSignatureModeActive(false)}
                        variant="ghost"
                        size="sm"
                        className="w-full text-gray-500 hover:text-gray-700"
                      >
                        {t('dashboard.cancel')}
                      </Button>
                    </div>
                  )}
                  
                  {landlordSignature && !isSignatureModeActive && (
                    <div className="border rounded-lg p-4 bg-muted/5">
                      <p className="text-sm text-muted-foreground mb-2">{t('property.contract.currentSignature')}</p>
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
                          {t('property.contract.editSignature')}
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
                            {t('property.contract.changeImage')}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="preview" className="space-y-4 mt-6">
              <Card className="property-form-card border-0" style={{ background: '#FFFFFF', boxShadow: '0px 4px 4px rgba(0, 0, 0, 0.25)', borderRadius: '12px' }}>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Eye className="w-5 h-5 text-[#040404]" />
                    <CardTitle className="property-section-title" style={{ fontFamily: "'Fira Sans Condensed', sans-serif", fontWeight: 400, fontSize: '16px', color: '#040404' }}>
                      {t('property.preview.title')}
                    </CardTitle>
                  </div>
                  <CardDescription className="property-section-description" style={{ fontFamily: "'Fira Sans Condensed', sans-serif", fontWeight: 400, fontSize: '12px', color: '#4B5563' }}>
                    {t('property.preview.subtitle')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <DocumentPreview 
                    property={property || {} as Property} 
                    formData={{
                      ...watch(),
                      house_rules: houseRules,
                      landlord_signature: landlordSignature || undefined,
                    }} 
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
            <button 
              type="button" 
              onClick={() => onOpenChange(false)}
              className="property-btn-secondary px-6 py-2 rounded-md text-base font-medium"
              style={{ background: '#FFFFFF', boxShadow: '0px 4px 6px -4px rgba(0, 0, 0, 0.1), 0px 10px 15px -3px rgba(0, 0, 0, 0.1)', color: '#040404' }}
            >
              {t('dashboard.cancel')}
            </button>
            {currentTab === 'basic' && (
              <button 
                type="button" 
                onClick={() => {
                  if (validateBasicTab()) {
                    setCurrentTab('landlord');
                  } else {
                    alert('Veuillez remplir tous les champs obligatoires de cet onglet.');
                  }
                }}
                disabled={!validateBasicTab()}
                className="property-btn-primary px-6 py-2 rounded-md text-base font-medium disabled:opacity-60"
                style={{ background: 'rgba(85, 186, 159, 0.76)', boxShadow: '0px 4px 6px -4px rgba(0, 0, 0, 0.1), 0px 10px 15px -3px rgba(0, 0, 0, 0.1)', color: '#040404' }}
              >
                {t('guest.navigation.next')}
              </button>
            )}
            {currentTab === 'landlord' && (
              <>
                <button 
                  type="button" 
                  onClick={() => setCurrentTab('basic')}
                  className="property-btn-secondary px-6 py-2 rounded-md text-base font-medium"
                  style={{ background: '#FFFFFF', boxShadow: '0px 4px 6px -4px rgba(0, 0, 0, 0.1), 0px 10px 15px -3px rgba(0, 0, 0, 0.1)', color: '#040404' }}
                >
                  {t('guest.navigation.previous')}
                </button>
                <button 
                  type="button" 
                  onClick={() => {
                    if (validateLandlordTab()) {
                      setCurrentTab('contract');
                    } else {
                      alert('Veuillez remplir tous les champs obligatoires de cet onglet.');
                    }
                  }}
                  disabled={!validateLandlordTab()}
                  className="property-btn-primary px-6 py-2 rounded-md text-base font-medium disabled:opacity-60"
                  style={{ background: 'rgba(85, 186, 159, 0.76)', boxShadow: '0px 4px 6px -4px rgba(0, 0, 0, 0.1), 0px 10px 15px -3px rgba(0, 0, 0, 0.1)', color: '#040404' }}
                >
                  {t('guest.navigation.next')}
                </button>
              </>
            )}
            {currentTab === 'contract' && (
              <>
                <button 
                  type="button" 
                  onClick={() => setCurrentTab('landlord')}
                  className="property-btn-secondary px-6 py-2 rounded-md text-base font-medium"
                  style={{ background: '#FFFFFF', boxShadow: '0px 4px 6px -4px rgba(0, 0, 0, 0.1), 0px 10px 15px -3px rgba(0, 0, 0, 0.1)', color: '#040404' }}
                >
                  {t('guest.navigation.previous')}
                </button>
                <button 
                  type="button" 
                  onClick={() => {
                    if (validateContractTab()) {
                      setCurrentTab('preview');
                    } else {
                      alert('Veuillez ajouter votre signature avant de continuer.');
                    }
                  }}
                  disabled={!validateContractTab()}
                  className="property-btn-primary px-6 py-2 rounded-md text-base font-medium disabled:opacity-60"
                  style={{ background: 'rgba(85, 186, 159, 0.76)', boxShadow: '0px 4px 6px -4px rgba(0, 0, 0, 0.1), 0px 10px 15px -3px rgba(0, 0, 0, 0.1)', color: '#040404' }}
                >
                  {t('guest.navigation.next')}
                </button>
              </>
            )}
            {currentTab === 'preview' && (
              <>
                <button 
                  type="button" 
                  onClick={() => setCurrentTab('contract')}
                  className="property-btn-secondary px-6 py-2 rounded-md text-base font-medium"
                  style={{ background: '#FFFFFF', boxShadow: '0px 4px 6px -4px rgba(0, 0, 0, 0.1), 0px 10px 15px -3px rgba(0, 0, 0, 0.1)', color: '#040404' }}
                >
                  {t('guest.navigation.previous')}
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  onClick={() => {
                    handleSubmit(onSubmit)();
                  }}
                  className="property-btn-primary px-6 py-2 rounded-md text-base font-medium disabled:opacity-60"
                  style={{ background: 'rgba(85, 186, 159, 0.76)', boxShadow: '0px 4px 6px -4px rgba(0, 0, 0, 0.1), 0px 10px 15px -3px rgba(0, 0, 0, 0.1)', color: '#040404' }}
                >
                  {isSubmitting ? t('property.actions.saving') : t('property.actions.save')}
                </button>
              </>
            )}
          </div>
        </form>
        </div>
      </DialogContent>
    </Dialog>;
};
