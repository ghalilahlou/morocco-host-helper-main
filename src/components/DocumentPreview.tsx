import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Property } from '@/types/booking';
import { FileText, Eye, ArrowLeft, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { getContractPdfUrl } from '@/services/contractService';
// @ts-ignore - PDF.js types optional for inline viewer
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
// @ts-ignore - Vite ?url provides a string URL for the worker
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
(GlobalWorkerOptions as any).workerSrc = workerSrc as any;
interface DocumentPreviewProps {
  property: Property;
  formData: any;
}

export const DocumentPreview = ({ property, formData }: DocumentPreviewProps) => {
  const [selectedDocument, setSelectedDocument] = useState<'police' | 'contract' | null>(null);
  const [contractPdfUrl, setContractPdfUrl] = useState<string | null>(null);
  const [loadingContract, setLoadingContract] = useState<boolean>(false);

  // Police form preview state
  const [policeLoading, setPoliceLoading] = useState(false);
  const [policeError, setPoliceError] = useState<string | null>(null);
  const [policeIframeUrls, setPoliceIframeUrls] = useState<string[]>([]);
  // Keep references to blob URLs to revoke them on cleanup
  const policeBlobRefs = useRef<string[]>([]);

  // Normalize PDF URLs for iframe display (data: -> blob:, add cache-buster for http)
  const normalizePdfUrl = async (u: string): Promise<string> => {
    try {
      if (typeof u !== 'string') return u as any;
      // Add simple cache buster for http(s) URLs
      if (u.startsWith('http://') || u.startsWith('https://')) {
        const sep = u.includes('?') ? '&' : '?';
        return `${u}${sep}v=${Date.now()}`;
      }
      if (u.startsWith('data:application/pdf')) {
        const res = await fetch(u);
        const blob = await res.blob();
        return URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      }
      // blob: or other schemes returned as-is
      return u;
    } catch (e) {
      console.warn('normalizePdfUrl failed, using original URL', e);
      return u as any;
    }
  };

  // Simple PDF.js canvas renderer to avoid Chrome PDF plugin restrictions in nested iframes
  const PdfCanvas = ({ url }: { url: string }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    
    useEffect(() => {
      let destroyed = false;
      setError(null);
      setLoading(true);
      
      (async () => {
        try {
          if (!url) {
            throw new Error('URL non fournie');
          }
          
          let arrayBuffer: ArrayBuffer;
          
          // ✅ AMÉLIORATION : Gestion des différents types d'URL
          if (url.startsWith('data:application/pdf;base64,')) {
            // Convertir base64 en ArrayBuffer directement
            const base64Data = url.split(',')[1];
            const binaryString = atob(base64Data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            arrayBuffer = bytes.buffer;
          } else if (url.startsWith('blob:') || url.startsWith('http')) {
            const res = await fetch(url);
            if (!res.ok) {
              throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }
            arrayBuffer = await res.arrayBuffer();
          } else {
            throw new Error('Format URL non supporté');
          }
          
          if (destroyed) return;
          
          const loadingTask = (getDocument as any)({ data: arrayBuffer });
          const pdf = await loadingTask.promise;
          
          if (destroyed) return;
          
          // Effacer le contenu précédent
          if (containerRef.current) {
            containerRef.current.innerHTML = '';
          }
          
          for (let pageNum = 1; pageNum <= pdf.numPages && !destroyed; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const viewport = page.getViewport({ scale: 1.2 });
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d')!;
            // @ts-ignore - pdfjs types
            canvas.width = viewport.width;
            // @ts-ignore
            canvas.height = viewport.height;
            canvas.style.marginBottom = '10px';
            containerRef.current?.appendChild(canvas);
            await page.render({ canvasContext: ctx, viewport }).promise;
          }
          
          setLoading(false);
        } catch (e: any) {
          console.error('PDF render error', e);
          if (!destroyed) {
            setError(e?.message || 'Erreur lors du chargement du PDF');
            setLoading(false);
          }
        }
      })();
      
      return () => {
        destroyed = true;
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
        }
      };
    }, [url]);
    
    if (error) {
      return (
        <div className="border rounded-lg p-4 bg-red-50 text-red-700 text-sm">
          <p className="font-medium">Erreur de chargement du PDF</p>
          <p className="text-xs mt-1">{error}</p>
        </div>
      );
    }
    
    return (
      <div className="relative">
        {loading && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Chargement du PDF...
          </div>
        )}
        <div ref={containerRef} className="w-full rounded border overflow-auto" />
      </div>
    );
  };

  useEffect(() => {
    // Convert data: URLs to blob: URLs to avoid Chrome blocking PDFs in iframes
    let createdObjectUrl: string | null = null;

    const run = async () => {
      if (selectedDocument !== 'contract') return;
      setLoadingContract(true);
      setContractPdfUrl(null);
      const isValidDate = (v: any) => v && !isNaN(new Date(v).getTime());
      if (!isValidDate(formData?.checkInDate) || !isValidDate(formData?.checkOutDate)) {
        // Missing dates -> avoid server PDF to prevent 'Invalid Date'
        setLoadingContract(false);
        setContractPdfUrl(null);
        return;
      }
      try {
        const firstGuest = formData?.guests?.[0] || {};
        // Merge live form values with saved property template for preview accuracy
        const mergedContractTemplate = {
          ...(property as any)?.contract_template,
          ...(formData ? {
            landlord_company: formData.landlord_company ?? (property as any)?.contract_template?.landlord_company,
            landlord_registration: formData.landlord_registration ?? (property as any)?.contract_template?.landlord_registration,
            landlord_address: formData.landlord_address ?? (property as any)?.contract_template?.landlord_address,
            landlord_name: formData.landlord_name ?? (property as any)?.contract_template?.landlord_name,
            landlord_phone: formData.landlord_phone ?? (property as any)?.contract_template?.landlord_phone,
            landlord_email: formData.landlord_email ?? (property as any)?.contract_template?.landlord_email,
            landlord_status: formData.landlord_status ?? (property as any)?.contract_template?.landlord_status,
            statut: formData.landlord_status ?? (property as any)?.contract_template?.landlord_status ?? (property as any)?.contract_template?.statut,
            landlord_signature: (property as any)?.contract_template?.landlord_signature,
          } : undefined)
        } as any;
        
        console.log('🔍 Merged contract template (contract):', mergedContractTemplate);
        // Create bookingLike object matching ContractSignature structure
        const bookingLike = {
          property: {
            id: property.id,
            name: formData?.name || property.name,
            address: formData?.address || property.address,
            contract_template: mergedContractTemplate,
            contact_info: (property as any)?.contact_info,
            house_rules: Array.isArray(formData?.house_rules) ? formData.house_rules : ((property as any)?.house_rules || []),
          },
          checkInDate: formData?.checkInDate ? new Date(formData?.checkInDate).toISOString() : null,
          checkOutDate: formData?.checkOutDate ? new Date(formData?.checkOutDate).toISOString() : null,
          numberOfGuests: formData?.numberOfGuests ?? formData?.guests?.length ?? 1,
          guests: formData?.guests?.map((guest: any) => ({
            fullName: guest.fullName,
            dateOfBirth: guest.dateOfBirth,
            documentNumber: guest.documentNumber,
            nationality: guest.nationality,
            documentType: guest.documentType,
          })) || [{
            fullName: firstGuest.fullName,
            dateOfBirth: firstGuest.dateOfBirth,
            documentNumber: firstGuest.documentNumber,
            nationality: firstGuest.nationality,
          }],
        };

        console.log('🔍 Contract preview - bookingLike data:', bookingLike);
        console.log('🔍 Contract preview - merged contract template:', mergedContractTemplate);

        // Use the same getContractPdfUrl function as ContractSignature
        const url = await getContractPdfUrl({ supabase, bookingLike, isPreview: true });
        
        let finalUrl: string = url as string;
        try {
          if (typeof url === 'string' && url.startsWith('data:application/pdf')) {
            // Convert to blob URL for better browser compatibility
            const res = await fetch(url);
            const blob = await res.blob();
            const objectUrl = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
            createdObjectUrl = objectUrl;
            finalUrl = objectUrl;
          }
        } catch (e) {
          console.warn('PDF data URL to blob conversion failed, using original URL', e);
        }
        setContractPdfUrl(finalUrl);
      } catch (err: any) {
        console.error('Failed to generate contract preview:', err);
        toast({
          title: 'Erreur lors de la génération du contrat',
          description: err?.message || 'Veuillez réessayer plus tard.',
          variant: 'destructive',
        } as any);
      } finally {
        setLoadingContract(false);
      }
    };

    run();

    return () => {
      if (createdObjectUrl) {
        URL.revokeObjectURL(createdObjectUrl);
      }
    };
  }, [selectedDocument, property, formData]);
  // Load police form PDFs via edge function when selected
  useEffect(() => {
    if (selectedDocument !== 'police') return;

    // Cleanup any previous blob URLs before generating new ones
    for (const url of policeBlobRefs.current) {
      try { URL.revokeObjectURL(url); } catch {}
    }
    policeBlobRefs.current = [];

    setPoliceLoading(true);
    setPoliceError(null);
    setPoliceIframeUrls([]);

    const run = async () => {
      try {
        // ✅ Helper pour convertir les dates de naissance en string si nécessaire
        const formatBirthDateForAPI = (date: any): string | null => {
          if (!date) return null;
          if (date instanceof Date) return date.toISOString().split('T')[0]; // Format YYYY-MM-DD
          if (typeof date === 'string') return date;
          return null;
        };

        let guests = (formData?.guests || []).map((g: any) => ({
          fullName: g.fullName,
          full_name: g.fullName,
          dateOfBirth: formatBirthDateForAPI(g.dateOfBirth),
          date_of_birth: formatBirthDateForAPI(g.dateOfBirth),
          documentNumber: g.documentNumber,
          document_number: g.documentNumber,
          nationality: g.nationality,
          placeOfBirth: g.placeOfBirth,
          place_of_birth: g.placeOfBirth,
          documentType: g.documentType,
          document_type: g.documentType,
          profession: g.profession || '',
          motif_sejour: g.motifSejour || g.motif_sejour || 'TOURISME',
          adresse_personnelle: g.adressePersonnelle || g.adresse_personnelle || '',
        }));

        if (!guests.length) {
          guests = [{
            fullName: '_________________',
            full_name: '_________________',
            dateOfBirth: '_________________',
            date_of_birth: '_________________',
            documentNumber: '_______________',
            document_number: '_______________',
            nationality: '',
            placeOfBirth: '',
            place_of_birth: '',
            documentType: 'passport',
            document_type: 'passport',
            profession: '',
            motif_sejour: 'TOURISME',
            adresse_personnelle: '',
          }];
        }

        // Merge live form values for preview (company, address, etc.)
        const mergedContractTemplate = {
          ...(property as any)?.contract_template,
          ...(formData ? {
            landlord_company: formData.landlord_company ?? (property as any)?.contract_template?.landlord_company,
            landlord_registration: formData.landlord_registration ?? (property as any)?.contract_template?.landlord_registration,
            landlord_address: formData.landlord_address ?? (property as any)?.contract_template?.landlord_address,
            landlord_name: formData.landlord_name ?? (property as any)?.contract_template?.landlord_name,
            landlord_phone: formData.landlord_phone ?? (property as any)?.contract_template?.landlord_phone,
            landlord_email: formData.landlord_email ?? (property as any)?.contract_template?.landlord_email,
            landlord_status: formData.landlord_status ?? (property as any)?.contract_template?.landlord_status,
            statut: formData.landlord_status ?? (property as any)?.contract_template?.landlord_status ?? (property as any)?.contract_template?.statut,
            landlord_signature: formData.landlord_signature ?? (property as any)?.contract_template?.landlord_signature,
          } : undefined)
        } as any;
        
        console.log('🔍 Merged contract template (police):', mergedContractTemplate);
        const fullAddress = [formData?.address, formData?.postal_code, formData?.city, formData?.country]
          .filter(Boolean)
          .join(', ') || property.address;

        // ✅ Helper pour convertir les dates en string si nécessaire
        const formatDateForAPI = (date: any): string | null => {
          if (!date) return null;
          if (date instanceof Date) return date.toISOString();
          if (typeof date === 'string') return date;
          return null;
        };

        const booking: any = {
          id: formData?.id || formData?.bookingId || null,
          checkInDate: formatDateForAPI(formData?.checkInDate),
          check_in_date: formatDateForAPI(formData?.checkInDate),
          checkOutDate: formatDateForAPI(formData?.checkOutDate),
          check_out_date: formatDateForAPI(formData?.checkOutDate),
          number_of_guests: formData?.numberOfGuests || guests.length || 1,
          source: formData?.source || 'host',
          property: {
            id: property.id,
            name: formData?.name || property.name,
            address: fullAddress,
            contract_template: mergedContractTemplate,
            contact_info: (property as any)?.contact_info || null,
            house_rules: Array.isArray(formData?.house_rules) ? formData.house_rules : ((property as any)?.house_rules || []),
          },
          guests,
        };

        console.log('🔍 Police booking data being sent:', booking);
        console.log('🔍 Police contract template:', booking.property.contract_template);

        // ✅ NOUVEAU: Utiliser la nouvelle Edge Function dédiée
        const { data, error } = await supabase.functions.invoke('generate-police-form', {
          body: { 
            bookingId: booking.id
          }
        });
        if (error) throw error as any;

        // La fonction retourne policeUrl, documentUrl (singular) ou documentUrls (plural)
        const urls = (data as any)?.documentUrls || 
                     ((data as any)?.documentUrl ? [(data as any).documentUrl] : []) ||
                     ((data as any)?.policeUrl ? [(data as any).policeUrl] : []);
        const normalized: string[] = [];
        for (const u of urls) {
          const final = await normalizePdfUrl(u);
          normalized.push(final);
          if (typeof final === 'string' && final.startsWith('blob:')) {
            policeBlobRefs.current.push(final);
          }
        }
        setPoliceIframeUrls(normalized);
      } catch (err: any) {
        console.error('Failed to generate police form preview:', err);
        setPoliceError(err?.message || "Erreur lors de la génération des fiches de police.");
      } finally {
        setPoliceLoading(false);
      }
    };

    run();

    // Cleanup on unmount or when switching away
    return () => {
      for (const url of policeBlobRefs.current) {
        try { URL.revokeObjectURL(url); } catch {}
      }
      policeBlobRefs.current = [];
    };
  }, [selectedDocument, property, formData]);

  const generateContractPreview = (): string => {
    const contractTemplate = {
      ...(property as any)?.contract_template,
      ...(formData ? {
        landlord_company: formData.landlord_company ?? (property as any)?.contract_template?.landlord_company,
        landlord_registration: formData.landlord_registration ?? (property as any)?.contract_template?.landlord_registration,
        landlord_address: formData.landlord_address ?? (property as any)?.contract_template?.landlord_address,
        landlord_name: formData.landlord_name ?? (property as any)?.contract_template?.landlord_name,
        landlord_signature: formData.landlord_signature ?? (property as any)?.contract_template?.landlord_signature,
        landlord_status: formData.landlord_status ?? (property as any)?.contract_template?.landlord_status,
      } : undefined),
    } as any;
    const firstGuest = formData?.guests?.[0] || {};
    // Extract company information
    const companyName = contractTemplate.landlord_company || 'Société';
    const companyRegistration = contractTemplate.landlord_registration || 'N/A';
    const companyAddress = contractTemplate.landlord_address || 'Adresse non renseignée';
    // ✅ CORRECTION: Ne plus forcer "Propriétaire" - laisser vide si pas de données
    const landlordName = contractTemplate.landlord_name || '';
    const landlordStatus = String(formData?.landlord_status ?? contractTemplate.landlord_status ?? (property as any)?.status ?? '').toLowerCase();
    const landlordText = landlordStatus === 'particulier'
      ? `${landlordName}, Gestionnaire et/ou propriétaire du bien, ci-après dénommée "Le Bailleur"`
      : `${(companyName || 'Société').toUpperCase()}, société enregistrée sous le numéro ${companyRegistration}, ayant son siège social situé ${companyAddress}, représentée par ${landlordName}, ci-après dénommée "Le Bailleur"`;
    
    // Booking information
    const formatDateSafe = (v: any, placeholder = '......................') => {
      if (!v) return placeholder;
      const d = new Date(v);
      return isNaN(d.getTime()) ? placeholder : d.toLocaleDateString('fr-FR');
    };
    const checkInDate = formatDateSafe(formData?.checkInDate);
    const checkOutDate = formatDateSafe(formData?.checkOutDate);
    const currentDate = new Date().toLocaleDateString('fr-FR');
    
    const guestCount = formData?.numberOfGuests || formData?.guests?.length || 1;
    const guestName = firstGuest?.fullName || '_________________';
    const guestBirthDate = formatDateSafe(firstGuest?.dateOfBirth, '__/__/____');
    const guestDocNumber = firstGuest?.documentNumber || '_________________';
    const guestNationality = firstGuest?.nationality || '_________________';

    return `
    <div style="max-width: 800px; margin: 0 auto; padding: 40px; font-family: Arial, sans-serif; line-height: 1.8; background: white;">
      
      <div style="text-align: center; margin-bottom: 40px;">
        <h1 style="font-size: 24px; font-weight: bold; margin-bottom: 20px; text-decoration: underline;">CONTRAT DE LOCATION MEUBLEE DE COURTE DUREE</h1>
      </div>

      <div style="margin-bottom: 30px;">
        <h3 style="font-size: 16px; font-weight: bold; margin-bottom: 15px;">ENTRE LES SOUSSIGNÉS :</h3>
      </div>

      <div style="margin-bottom: 25px;">
        <h4 style="font-size: 14px; font-weight: bold;">LE BAILLEUR :</h4>
        <p style="margin-left: 20px; text-align: justify;">
          ${landlordText}
        </p>
      </div>

      <div style="margin-bottom: 25px;">
        <h4 style="font-size: 14px; font-weight: bold;">LE LOCATAIRE :</h4>
        <p style="margin-left: 20px; text-align: justify;">
          <strong>${guestName}</strong>, né(e) le <strong>${guestBirthDate}</strong>, de nationalité <strong>${guestNationality}</strong>, titulaire du document d'identité n° <strong>${guestDocNumber}</strong>, ci-après dénommé(e) "Le Locataire"
        </p>
      </div>

      <hr style="margin: 30px 0; border: 1px solid #333;">

      <div style="margin-bottom: 25px;">
        <h4 style="font-size: 14px; font-weight: bold; border-left: 4px solid #333; padding-left: 10px;">ARTICLE 1 - OBJET DE LA LOCATION</h4>
        <p style="text-align: justify;">
          Le présent contrat a pour objet la location meublée de courte durée du bien immobilier suivant : <strong>${formData?.name || property.name}</strong>, situé <strong>${formData?.address || property.address}</strong>. Le logement est loué entièrement meublé et équipé pour un usage d'habitation temporaire.
        </p>
      </div>

      <div style="margin-bottom: 25px;">
        <h4 style="font-size: 14px; font-weight: bold; border-left: 4px solid #333; padding-left: 10px;">ARTICLE 2 - DURÉE ET PÉRIODE</h4>
        <p style="text-align: justify;">
          La location est consentie pour une durée déterminée du <strong>${checkInDate}</strong> à 16h00 au <strong>${checkOutDate}</strong> à 11h00. Cette période ne pourra être prolongée qu'avec l'accord écrit préalable du Bailleur.
        </p>
      </div>

      <div style="margin-bottom: 25px;">
        <h4 style="font-size: 14px; font-weight: bold; border-left: 4px solid #333; padding-left: 10px;">ARTICLE 3 - OCCUPANTS AUTORISÉS</h4>
        <p style="text-align: justify;">
          Le logement sera occupé par <strong>${guestCount}</strong> personne(s) maximum. Liste des occupants autorisés :
        </p>
        <ul style="margin-left: 40px; margin-top: 10px;">
          ${formData?.guests?.slice(0, 6).map((guest, index) => 
            `<li><strong>${guest.fullName || '_______________'}</strong> - Né(e) le <strong>${guest.dateOfBirth ? new Date(guest.dateOfBirth).toLocaleDateString('fr-FR') : '__/__/____'}</strong> - Document n° <strong>${guest.documentNumber || '_______________'}</strong></li>`
          ).join('') || 
          Array.from({length: Math.max(2, guestCount)}, (_, i) => 
            `<li><strong>_______________</strong> - Né(e) le <strong>__/__/____</strong> - Document n° <strong>_______________</strong></li>`
          ).join('')}
        </ul>
        <p style="text-align: justify; margin-top: 15px; font-style: italic;">
          Toute personne non mentionnée ci-dessus est strictement interdite dans le logement.
        </p>
      </div>

      <div style="margin-bottom: 25px;">
        <h4 style="font-size: 14px; font-weight: bold; border-left: 4px solid #333; padding-left: 10px;">ARTICLE 4 - REGLEMENT INTERIEUR ET OBLIGATIONS</h4>
        <p style="text-align: justify; margin-bottom: 10px;">Le locataire s'engage à respecter les règles suivantes :</p>
        <ul style="margin-left: 40px;">
          ${(Array.isArray(formData?.house_rules) && formData.house_rules.length > 0 ? 
            formData.house_rules : (property.house_rules && property.house_rules.length > 0 ? property.house_rules : [
              "Respect absolu du voisinage et des parties communes de l'immeuble",
              "Interdiction formelle d'organiser des fêtes, événements ou de faire du bruit excessif",
              "Interdiction de fumer à l'intérieur du logement (balcons et terrasses autorisés)",
              "Interdiction d'inviter des personnes non déclarées sans autorisation écrite préalable",
              "Obligation de maintenir le logement en parfait état de propreté",
              "Signalement immédiat de tout dommage ou dysfonctionnement",
              "Respect des équipements et du mobilier mis à disposition",
              "Tri et évacuation des déchets selon les règles locales"
            ])).map(rule => `<li>${rule}</li>`).join('')}
         
        </ul>
        <p style="text-align: justify; margin-top: 15px;">
          Tout manquement à ces règles pourra entraîner la résiliation immédiate du contrat aux torts exclusifs du Locataire.
        </p>
      </div>

      <div style="margin-bottom: 25px;">
        <h4 style="font-size: 14px; font-weight: bold; border-left: 4px solid #333; padding-left: 10px;">ARTICLE 5 - RESPONSABILITÉS ET ASSURANCES</h4>
        <p style="text-align: justify;">
          Le Locataire est entièrement responsable de tout dommage causé au logement, aux équipements et au mobilier. Il s'engage à restituer le bien dans l'état où il l'a trouvé. Le Bailleur décline toute responsabilité en cas de vol, perte ou dommage aux effets personnels du Locataire.
        </p>
      </div>

      <div style="margin-bottom: 25px;">
        <h4 style="font-size: 14px; font-weight: bold; border-left: 4px solid #333; padding-left: 10px;">ARTICLE 6 - RÉSILIATION</h4>
        <p style="text-align: justify;">
          En cas de non-respect des présentes conditions, le Bailleur se réserve le droit de procéder à la résiliation immédiate du contrat et d'exiger la libération des lieux sans délai ni indemnité.
        </p>
      </div>

      <div style="margin-bottom: 30px;">
        <h4 style="font-size: 14px; font-weight: bold; border-left: 4px solid #333; padding-left: 10px;">ARTICLE 7 - DROIT APPLICABLE</h4>
        <p style="text-align: justify;">
          Le présent contrat est régi par le droit marocain. Tout litige sera de la compétence exclusive des tribunaux de Casablanca.
        </p>
      </div>

      <div style="margin-top: 50px;">
        <p style="text-align: left; margin-bottom: 30px;">
          <strong>Fait à Casablanca, le ${currentDate}</strong>
        </p>
        
        <div style="display: flex; justify-content: space-between; margin-top: 40px;">
          <div style="text-align: center; width: 45%;">
            <h4 style="font-weight: bold;">LE BAILLEUR</h4>
            <p style="margin-bottom: 20px;">${companyName}</p>
            <div style="border: 1px solid #333; height: 60px; width: 200px; margin: 0 auto; display: flex; align-items: center; justify-content: center;">
              ${contractTemplate?.landlord_signature ? 
                `<img src="${contractTemplate.landlord_signature}" alt="Signature du bailleur" style="max-height:55px; max-width:190px; object-fit: contain;" />` :
                `<div style=\"font-family: cursive; font-size: 20px; color: #333;\">${property?.contact_info?.ownerName || landlordName}</div>`
              }
            </div>
            <div style="border-top: 1px solid #333; width: 200px; margin: 10px auto 0;"></div>
          </div>
          
          <div style="text-align: center; width: 45%;">
            <h4 style="font-weight: bold;">LE LOCATAIRE</h4>
            <p style="margin-bottom: 60px;">${guestName}</p>
            <div style="border-top: 1px solid #333; width: 200px; margin: 0 auto;"></div>
          </div>
        </div>
      </div>
    </div>
    `;
  };

  // Si un document est sélectionné, afficher sa prévisualisation
  if (selectedDocument) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedDocument(null)}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour à la liste
          </Button>
          <h3 className="text-lg font-semibold">
            {selectedDocument === 'police' ? "Fiche de Police - Déclaration d'Arrivée" : 'Contrat de Location Courte Durée'}
          </h3>
        </div>
        
        <Card>
          <CardContent className="p-0">
            {selectedDocument === 'police' ? (
              <div className="p-4">
                {policeLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Génération de la fiche de police...
                  </div>
                ) : policeIframeUrls.length > 0 ? (
                  <div className="space-y-4">
                    {policeIframeUrls.map((url, idx) => (
                      <div key={idx} className="space-y-2">
                        <PdfCanvas url={url} />
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs underline text-primary"
                        >
                          Ouvrir dans un onglet
                        </a>
                      </div>
                    ))}
                  </div>
                ) : policeError ? (
                  <div className="border rounded-lg p-4 text-sm">
                    <div className="text-destructive mb-2">{policeError}</div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedDocument('police')}
                      className="gap-2"
                    >
                      Réessayer
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="p-4">
                {loadingContract ? (
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Génération du contrat...
                  </div>
                ) : contractPdfUrl ? (
                  <div className="space-y-2">
                    <PdfCanvas url={contractPdfUrl} />
                    <a
                      href={contractPdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs underline text-primary"
                    >
                      Ouvrir dans un onglet
                    </a>
                  </div>
                ) : (
                  <div
                    className="border rounded-lg p-4 bg-white text-black overflow-auto max-h-[600px] text-sm"
                    dangerouslySetInnerHTML={{ __html: generateContractPreview() }}
                  />
                )}
              </div>
            )}
          </CardContent>
        </Card>
        
        <p className="text-xs text-muted-foreground">
          {selectedDocument === 'police' 
            ? 'Aperçu généré par le serveur. Vous pouvez ouvrir chaque PDF dans un onglet pour le vérifier.'
            : 'Le contrat sera personnalisé avec les informations spécifiques de chaque réservation'
          }
        </p>
      </div>
    );
  }

  // Vue par défaut : liste des documents
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {/* Fiche de Police */}
        <div 
          className="flex items-center justify-between p-4 rounded-lg"
          style={{ background: '#E5E7EB' }}
        >
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-[#040404]" />
            <div>
              <h4 style={{ fontFamily: "'Inter', sans-serif", fontWeight: 400, fontSize: '12px', color: '#000000' }}>
                Fiche de police
              </h4>
              <p style={{ fontFamily: "'Inter', sans-serif", fontWeight: 400, fontSize: '10px', color: '#4B5563' }}>
                Déclaration d'arrivée pour voyageurs étrangers
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSelectedDocument('police')}
            className="flex items-center gap-2 text-sm"
            style={{ fontFamily: "'Inter', sans-serif", fontWeight: 400, fontSize: '12px', color: '#040404' }}
          >
            <Eye className="w-4 h-4" />
            Voir l'aperçu
          </button>
        </div>

        {/* Contrat de location */}
        <div 
          className="flex items-center justify-between p-4 rounded-lg"
          style={{ background: '#E5E7EB' }}
        >
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-[#040404]" />
            <div>
              <h4 style={{ fontFamily: "'Inter', sans-serif", fontWeight: 400, fontSize: '12px', color: '#000000' }}>
                Contrat de location
              </h4>
              <p style={{ fontFamily: "'Inter', sans-serif", fontWeight: 400, fontSize: '10px', color: '#4B5563' }}>
                Contrat de location courte durée personnalisé
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSelectedDocument('contract')}
            className="flex items-center gap-2 text-sm"
            style={{ fontFamily: "'Inter', sans-serif", fontWeight: 400, fontSize: '12px', color: '#040404' }}
          >
            <Eye className="w-4 h-4" />
            Voir l'aperçu
          </button>
        </div>
      </div>

      <div className="p-3 rounded-lg" style={{ background: 'rgba(85, 186, 159, 0.1)', border: '1px solid rgba(85, 186, 159, 0.3)' }}>
        <p style={{ fontFamily: "'Fira Sans Condensed', sans-serif", fontWeight: 400, fontSize: '12px', color: '#4B5563' }}>
          💡 Ces documents sont des modèles qui seront personnalisés automatiquement avec les informations de chaque réservation.
        </p>
      </div>
    </div>
  );
};