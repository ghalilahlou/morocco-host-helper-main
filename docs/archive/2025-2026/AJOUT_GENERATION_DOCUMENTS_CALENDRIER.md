# ✅ Ajout Génération Documents dans le Calendrier

## 🎯 Problème Résolu

**Avant** : Quand on crée une réservation via "Nouvelle réservation", les documents (contrat et police) ne se génèrent pas automatiquement. Pourtant, quand on consulte la même réservation dans la vue "Cartes", on peut générer les documents à la demande.

**Solution** : Ajouter la même fonctionnalité de génération de documents dans le modal du calendrier (`UnifiedBookingModal`), en s'inspirant de la logique déjà présente dans `BookingCard`.

## 🔍 Analyse

### Différence entre les vues

| Vue | Composant | Génération Documents | Status Affichés |
|-----|-----------|----------------------|-----------------|
| **Cartes** | `BookingCard.tsx` | ✅ Boutons "Générer" disponibles | Tous |
| **Calendrier** | `UnifiedBookingModal.tsx` | ❌ Uniquement affichage pour `completed` | Uniquement `completed` |

### Workflow de Génération dans BookingCard

1. **Contrat** (lignes 142-169) :
   - Utilise `ContractService.generateAndDownloadContract(booking)`
   - Génère et télécharge le contrat
   - Met à jour `documentsGenerated.contract = true`

2. **Fiche Police** (lignes 90-114) :
   - Utilise `UnifiedDocumentService.downloadPoliceFormsForAllGuests(booking)`
   - Génère une fiche par guest
   - Met à jour `documentsGenerated.policeForm = true`

3. **Affichage** :
   - Si document existe → Boutons "Voir" et "Télécharger"
   - Si document n'existe pas → Bouton "Générer"

## ✅ Modifications Appliquées

### 1. Ajout des imports nécessaires

**Fichier** : `src/components/UnifiedBookingModal.tsx`

```typescript
import { UnifiedDocumentService } from '@/services/unifiedDocumentService';
import { ContractService } from '@/services/contractService';
```

### 2. Ajout des états de chargement

```typescript
const [isGeneratingContract, setIsGeneratingContract] = useState(false);
const [isGeneratingPolice, setIsGeneratingPolice] = useState(false);
```

### 3. Ajout des fonctions de génération

#### `handleGenerateContract`

Copié depuis `BookingCard.tsx` (lignes 142-169), adapté pour le modal :

```typescript
const handleGenerateContract = async () => {
  if (!booking || isAirbnb) return;
  
  setIsGeneratingContract(true);
  try {
    const bookingTyped = booking as Booking;
    const result = await ContractService.generateAndDownloadContract(bookingTyped);
    
    if (result.success) {
      toast({ title: "Contrat généré", description: result.message });
      
      // Recharger les documents depuis uploaded_documents
      const { data: uploadedDocs } = await supabase
        .from('uploaded_documents')
        .select('document_url, document_type, id')
        .eq('booking_id', bookingTyped.id)
        .eq('document_type', 'contract')
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (uploadedDocs && uploadedDocs.length > 0) {
        setDocuments(prev => ({
          ...prev,
          contractUrl: uploadedDocs[0].document_url,
          contractId: uploadedDocs[0].id
        }));
      }
      
      await refreshBookings();
    }
  } catch (error: any) {
    toast({
      title: "Erreur",
      description: error.message || "Impossible de générer le contrat",
      variant: "destructive",
    });
  } finally {
    setIsGeneratingContract(false);
  }
};
```

#### `handleGeneratePolice`

Copié depuis `BookingCard.tsx` (lignes 90-114), adapté pour le modal :

```typescript
const handleGeneratePolice = async () => {
  if (!booking || isAirbnb) return;
  
  setIsGeneratingPolice(true);
  try {
    const bookingTyped = booking as Booking;
    await UnifiedDocumentService.downloadPoliceFormsForAllGuests(bookingTyped);
    
    toast({
      title: "Fiches police générées",
      description: `${bookingTyped.guests?.length || 1} fiche(s) police téléchargée(s)`,
    });
    
    // Recharger les documents depuis uploaded_documents
    const { data: uploadedDocs } = await supabase
      .from('uploaded_documents')
      .select('document_url, document_type, id')
      .eq('booking_id', bookingTyped.id)
      .eq('document_type', 'police')
      .order('created_at', { ascending: false })
        .limit(1);
      
      if (uploadedDocs && uploadedDocs.length > 0) {
        setDocuments(prev => ({
          ...prev,
          policeUrl: uploadedDocs[0].document_url,
          policeId: uploadedDocs[0].id
        }));
      }
      
      await refreshBookings();
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de générer les fiches de police",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingPolice(false);
    }
  };
  ```

### 4. Ajout de la section de génération pour status 'pending'

**Emplacement** : Juste avant la section "Documents enregistrés" (qui est pour status 'completed')

```tsx
{/* ✅ GÉNÉRATION DOCUMENTS : Section pour les réservations en attente (nouveau) */}
{status === 'pending' && !isAirbnb && (booking as Booking)?.guests?.length > 0 && (
  <Card>
    <CardHeader>
      <CardTitle className="text-lg flex items-center gap-2">
        <FileText className="w-5 h-5 text-brand-teal" />
        Générer les documents
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">
      {/* Contrat */}
      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-brand-teal/10 flex items-center justify-center">
            <FileText className="w-5 h-5 text-brand-teal" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Contrat</p>
            <p className="text-sm text-gray-600">Contrat de location à signer physiquement</p>
          </div>
        </div>
        {documents.contractUrl ? (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => window.open(documents.contractUrl!, '_blank')}>
              <FileText className="w-4 h-4 mr-2" />
              Voir
            </Button>
            <Button variant="outline" size="sm" onClick={/* télécharger */}>
              Télécharger
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerateContract}
            disabled={isGeneratingContract}
          >
            {isGeneratingContract ? "Génération..." : "Générer"}
          </Button>
        )}
      </div>

      {/* Police - même structure */}
      {/* ... */}

      {/* Pièces d'identité uploadées */}
      {/* ... */}

      <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
        <p className="text-xs text-gray-600">
          💡 Les documents sont générés à la demande. Cliquez sur "Générer" pour créer le contrat et les fiches de police.
        </p>
      </div>
    </CardContent>
  </Card>
)}
```

### 5. Modification du chargement des documents

**Avant** :
```typescript
if (!booking || status !== 'completed' || isAirbnb || !booking.id) {
  // Ne charger que pour status 'completed'
}
```

**Après** :
```typescript
if (!booking || (status !== 'completed' && status !== 'pending') || isAirbnb || !booking.id) {
  // Charger aussi pour status 'pending' (nouvelles réservations)
}
```

## 🎨 Interface Utilisateur

### Réservations en Attente (status 'pending')

```
┌─────────────────────────────────────────┐
│ 📄 Générer les documents               │
├─────────────────────────────────────────┤
│                                         │
│ ┌─────────────────────────────────┐   │
│ │ 📄 Contrat                       │   │
│ │ Contrat de location à signer... │   │
│ │                    [Générer] ──────► Génère + télécharge
│ └─────────────────────────────────┘   │
│                                         │
│ ┌─────────────────────────────────┐   │
│ │ 🛡️ Fiche de police               │   │
│ │ 2 fiche(s) - Une par client     │   │
│ │                    [Générer] ──────► Génère + télécharge
│ └─────────────────────────────────┘   │
│                                         │
│ 💡 Les documents sont générés à la     │
│    demande...                           │
└─────────────────────────────────────────┘
```

### Après Génération

```
┌─────────────────────────────────────────┐
│ 📄 Générer les documents               │
├─────────────────────────────────────────┤
│                                         │
│ ┌─────────────────────────────────┐   │
│ │ 📄 Contrat                       │   │
│ │ Contrat de location à signer... │   │
│ │            [Voir] [Télécharger] │   │
│ └─────────────────────────────────┘   │
│                                         │
│ ┌─────────────────────────────────┐   │
│ │ 🛡️ Fiche de police               │   │
│ │ 2 fiche(s) - Une par client     │   │
│ │            [Voir] [Télécharger] │   │
│ └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

## 🧪 Tests à Effectuer

### Test 1 : Créer une nouvelle réservation
1. Aller dans une propriété
2. Cliquer sur "Nouvelle réservation"
3. Remplir les informations et uploader un document d'identité
4. Créer la réservation
5. **Vérifier** : La réservation apparaît dans le calendrier

### Test 2 : Ouvrir la réservation depuis le calendrier
1. Cliquer sur la réservation dans le calendrier
2. Le modal `UnifiedBookingModal` s'ouvre
3. **Vérifier** : La section "Générer les documents" est visible
4. **Vérifier** : 2 boutons "Générer" sont présents (Contrat + Police)

### Test 3 : Générer le contrat
1. Cliquer sur "Générer" pour le Contrat
2. **Vérifier** : Un toast "Contrat généré" apparaît
3. **Vérifier** : Le PDF du contrat se télécharge automatiquement
4. **Vérifier** : Les boutons changent pour "Voir" et "Télécharger"

### Test 4 : Générer la fiche de police
1. Cliquer sur "Générer" pour la Fiche de police
2. **Vérifier** : Un toast "Fiches police générées - X fiche(s)" apparaît
3. **Vérifier** : Le PDF de la police se télécharge automatiquement
4. **Vérifier** : Les boutons changent pour "Voir" et "Télécharger"

### Test 5 : Consulter depuis la vue Cartes
1. Aller dans la vue "Cartes" (Dashboard)
2. Ouvrir la même réservation
3. **Vérifier** : Les documents sont aussi visibles dans cette vue
4. **Vérifier** : Les boutons "Voir" et "Télécharger" fonctionnent

## 📊 Cohérence entre les Vues

| Fonctionnalité | Vue Cartes | Vue Calendrier |
|----------------|------------|----------------|
| Afficher réservations 'pending' | ✅ | ✅ |
| Afficher réservations 'completed' | ✅ | ✅ |
| Générer contrat | ✅ | ✅ (NOUVEAU) |
| Générer fiche police | ✅ | ✅ (NOUVEAU) |
| Voir documents générés | ✅ | ✅ (NOUVEAU) |
| Télécharger documents | ✅ | ✅ (NOUVEAU) |

## 🎯 Résultat Final

**Avant** :
- ❌ Calendrier : Impossible de générer les documents pour les nouvelles réservations
- ✅ Cartes : Documents générables à la demande

**Après** :
- ✅ Calendrier : Documents générables à la demande (comme dans Cartes)
- ✅ Cartes : Fonctionnalité inchangée
- ✅ **Cohérence totale** entre les deux vues

## 📝 Notes Importantes

1. **Status 'pending'** : Les nouvelles réservations créées par le host ont ce status. C'est pourquoi nous affichons la section de génération pour ce status.

2. **Status 'completed'** : Section séparée "Documents enregistrés" qui affiche les documents déjà générés (pour les réservations terminées avec signature).

3. **Réservations Airbnb** : Exclues de cette fonctionnalité (pas de génération de documents pour Airbnb).

4. **Services utilisés** :
   - `ContractService.generateAndDownloadContract()` : Génération du contrat
   - `UnifiedDocumentService.downloadPoliceFormsForAllGuests()` : Génération des fiches de police

5. **Rechargement automatique** : Après génération, les documents sont automatiquement rechargés depuis `uploaded_documents` et affichés dans l'interface.

