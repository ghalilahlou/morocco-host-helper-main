# Guide de Migration - Pipeline Unifié

## 🎯 Objectif
Ce guide documente la migration vers un pipeline de données unifié et fiable pour la gestion des documents guest (pièce d'identité, contrat, police) et la synchronisation Airbnb.

## 🔧 Changements Apportés

### 1. **Suppression des Edge-Functions Redondantes**
- ❌ `list-guest-docs` (remplacé par `get-guest-documents-unified`)
- ❌ `sync-airbnb-reservations` (remplacé par `sync-airbnb-unified`)

### 2. **Nouvelles Edge-Functions Unifiées**
- ✅ `get-guest-documents-unified` - Récupération unifiée de tous les documents
- ✅ `sync-airbnb-unified` - Synchronisation Airbnb améliorée et fiable

### 3. **Services Frontend Unifiés**
- ✅ `UnifiedDocumentService` - Gestion unifiée des documents
- ✅ `AirbnbUnifiedService` - Synchronisation Airbnb simplifiée

## 📋 Pipeline de Données Unifié

### **Flux Principal :**
```
1. Guest soumet ses informations → submit-guest-info
2. Données sauvegardées dans :
   - Table `guests` (données structurées)
   - Table `uploaded_documents` (documents avec type 'identity')
3. Génération automatique des documents :
   - generate-id-documents → type 'identity'
   - generate-contract → type 'contract'  
   - generate-police-forms → type 'police'
4. Récupération unifiée via get-guest-documents-unified
```

### **Types de Documents Standardisés :**
- `identity` - Documents d'identité (pièces d'identité, passeports)
- `contract` - Contrats de location
- `police` - Formulaires de police

## 🔄 Synchronisation Airbnb Unifiée

### **Améliorations :**
- ✅ Parsing ICS robuste avec fallback CORS
- ✅ Extraction améliorée des codes de réservation
- ✅ Gestion d'erreurs complète
- ✅ Statut de synchronisation en temps réel
- ✅ Protection contre les synchronisations trop fréquentes

### **Nouveaux Patterns de Recherche :**
- Codes de réservation 8-12 caractères alphanumériques
- Recherche dans description ET summary
- Recherche dans raw event data
- Patterns multiples pour différents formats Airbnb

## 🛠️ Migration des Services Frontend

### **Ancien Code :**
```typescript
// ❌ Ancien - Services fragmentés
import { guestSubmissionService } from './guestSubmissionService';
import { airbnbSyncService } from './airbnbSyncService';
import { documentSynchronizationService } from './documentSynchronizationService';
```

### **Nouveau Code :**
```typescript
// ✅ Nouveau - Services unifiés
import { UnifiedDocumentService } from './unifiedDocumentService';
import { AirbnbUnifiedService } from './airbnbUnifiedService';

// Récupération des documents
const documents = await UnifiedDocumentService.getBookingDocuments(bookingId);

// Synchronisation Airbnb
const syncResult = await AirbnbUnifiedService.syncReservations(propertyId);
```

## 📊 Structure de Données Unifiée

### **GuestDocumentSummary :**
```typescript
interface GuestDocumentSummary {
  bookingId: string;
  guestCount: number;
  documents: {
    identity: DocumentInfo[];
    contract: DocumentInfo[];
    police: DocumentInfo[];
  };
  summary: {
    totalDocuments: number;
    hasAllRequired: boolean;
    missingTypes: string[];
  };
}
```

### **DocumentInfo :**
```typescript
interface DocumentInfo {
  id: string;
  type: 'identity' | 'contract' | 'police';
  fileName: string;
  url: string;
  guestName?: string;
  createdAt: string;
  isSigned?: boolean;
  signedAt?: string;
}
```

## 🧪 Tests de Validation

### **1. Test du Pipeline de Documents :**
```typescript
// Test récupération documents
const documents = await UnifiedDocumentService.getBookingDocuments(bookingId);
console.assert(documents?.summary.totalDocuments > 0, 'Documents should be found');

// Test génération documents manquants
const result = await UnifiedDocumentService.generateMissingDocuments(
  bookingId, 
  ['contract', 'police']
);
console.assert(result.success, 'Missing documents should be generated');
```

### **2. Test Synchronisation Airbnb :**
```typescript
// Test synchronisation
const syncResult = await AirbnbUnifiedService.syncReservations(propertyId);
console.assert(syncResult.success, 'Sync should succeed');

// Test recherche réservation
const reservation = await AirbnbUnifiedService.findReservationByCode(
  propertyId, 
  'ABC1234567'
);
console.assert(reservation !== null, 'Reservation should be found');
```

## 🚀 Déploiement

### **1. Déployer les nouvelles Edge-Functions :**
```bash
# Déployer les nouvelles fonctions
supabase functions deploy get-guest-documents-unified
supabase functions deploy sync-airbnb-unified
```

### **2. Mettre à jour le Frontend :**
```typescript
// Remplacer les imports dans les composants
import { UnifiedDocumentService } from '@/services/unifiedDocumentService';
import { AirbnbUnifiedService } from '@/services/airbnbUnifiedService';
```

### **3. Nettoyer les anciennes fonctions :**
```bash
# Supprimer les anciennes fonctions (optionnel)
supabase functions delete list-guest-docs
supabase functions delete sync-airbnb-reservations
```

## ✅ Vérifications Post-Migration

### **1. Vérifier la Récupération des Documents :**
- [ ] Les documents d'identité sont correctement récupérés
- [ ] Les contrats sont générés et signés
- [ ] Les formulaires de police sont créés
- [ ] Les URLs signées fonctionnent

### **2. Vérifier la Synchronisation Airbnb :**
- [ ] Les réservations sont synchronisées correctement
- [ ] Les codes de réservation sont extraits
- [ ] La recherche par code fonctionne
- [ ] Le statut de synchronisation est mis à jour

### **3. Vérifier l'Intégrité des Données :**
- [ ] Pas de documents orphelins
- [ ] Cohérence entre tables `guests` et `uploaded_documents`
- [ ] Types de documents standardisés
- [ ] Liens booking_id corrects

## 🐛 Résolution des Problèmes

### **Problème : Documents non trouvés**
```typescript
// Vérifier l'intégrité
const integrity = await UnifiedDocumentService.verifyDocumentIntegrity(bookingId);
console.log('Issues:', integrity.issues);
```

### **Problème : Synchronisation Airbnb échoue**
```typescript
// Vérifier le statut
const status = await AirbnbUnifiedService.getSyncStatus(propertyId);
console.log('Sync status:', status);
```

### **Problème : Types de documents incorrects**
```sql
-- Vérifier les types dans la base
SELECT document_type, COUNT(*) 
FROM uploaded_documents 
GROUP BY document_type;
```

## 📈 Avantages de la Migration

1. **Pipeline Unifié** : Une seule logique pour tous les documents
2. **Synchronisation Fiable** : Parsing ICS robuste avec fallback
3. **Types Standardisés** : Cohérence dans la base de données
4. **Gestion d'Erreurs** : Logs détaillés et récupération d'erreurs
5. **Performance** : Moins de requêtes, plus d'efficacité
6. **Maintenabilité** : Code simplifié et centralisé

## 🔄 Rollback (si nécessaire)

Si des problèmes surviennent, il est possible de revenir aux anciennes fonctions :

1. Garder les anciennes fonctions en commentaire
2. Revertir les imports dans le frontend
3. Utiliser les anciens services temporairement
4. Débugger les nouvelles fonctions en parallèle

---

**Note :** Cette migration résout les problèmes de double logique, de documents orphelins, et de synchronisation Airbnb défaillante. Le pipeline est maintenant unifié, fiable et maintenable.
