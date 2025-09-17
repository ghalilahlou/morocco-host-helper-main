# Corrections de la Structure des Tables

## 🚨 Problème identifié

Il y avait une **incohérence** entre la documentation (`spacetable.md`) et la structure réelle de la base de données pour la table `guest_submissions`.

## ✅ Corrections apportées

### 1. **Fichier `spacetable.md` corrigé**

**Structure incorrecte (avant) :**
```sql
guest_submissions:
- id (PK)
- booking_id (FK)
- guest_id (FK) ❌ N'existe pas
- property_id (FK) ❌ N'existe pas
- date (DATE) ❌ N'existe pas
- signature_data (JSONB)
- is_signed (BOOLEAN) ❌ N'existe pas
- created_at, updated_at, deleted_at
```

**Structure correcte (après) :**
```sql
guest_submissions:
- id (PK)
- token_id (FK) → property_verification_tokens.id
- booking_id (FK) → bookings.id
- booking_data (JSONB)
- guest_data (JSONB)
- document_urls (JSONB)
- signature_data (TEXT)
- submitted_at (TIMESTAMP)
- status (TEXT)
- reviewed_by (UUID) → auth.users.id
- reviewed_at (TIMESTAMP)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

### 2. **Fichier `verify-document-storage.sql` corrigé**

**Erreurs corrigées :**
- ❌ `property_id` dans guest_submissions → ✅ Supprimé
- ❌ `is_signed` dans guest_submissions → ✅ Remplacé par `status`
- ✅ Ajout de `status` et `submitted_at` dans les requêtes

### 3. **Fichier `submit-guest-info/index.ts` corrigé**

**Erreurs corrigées :**
- ❌ `property_id: propertyId` → ✅ Supprimé
- ❌ `is_signed: false` → ✅ Remplacé par `status: 'submitted'`
- ✅ Ajout de `submitted_at: new Date().toISOString()`

## 📊 Structure réelle confirmée

### Table `guest_submissions` (structure actuelle)

```sql
CREATE TABLE public.guest_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token_id UUID NOT NULL,                    -- FK vers property_verification_tokens
  booking_id UUID REFERENCES public.bookings(id), -- Ajouté par migration
  booking_data JSONB,                        -- Données de réservation
  guest_data JSONB,                          -- Données des invités
  document_urls JSONB DEFAULT '[]'::jsonb,   -- URLs des documents
  signature_data TEXT,                       -- Données de signature
  submitted_at TIMESTAMP WITH TIME ZONE,     -- Date de soumission
  status TEXT NOT NULL DEFAULT 'pending',    -- Statut (pending, submitted, reviewed)
  reviewed_by UUID,                          -- Utilisateur qui a révisé
  reviewed_at TIMESTAMP WITH TIME ZONE,      -- Date de révision
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
```

### Relations correctes

```sql
-- Relations directes
guest_submissions.token_id → property_verification_tokens.id
guest_submissions.booking_id → bookings.id
guest_submissions.reviewed_by → auth.users.id

-- Relations via property_verification_tokens
property_verification_tokens.property_id → properties.id
```

## 🧪 Tests à effectuer

### 1. **Test de la fonction submit-guest-info**

```javascript
// Données de test
const testData = {
  propertyId: "test-property-123",
  token: "test-token-456",
  bookingData: {
    checkInDate: "2024-02-15",
    checkOutDate: "2024-02-20",
    numberOfGuests: 2
  },
  guestData: {
    guests: [...],
    documentUrls: [...]
  }
};
```

**Résultat attendu :**
- ✅ Enregistrement créé dans `guest_submissions` avec `status: 'submitted'`
- ✅ `booking_id` correctement rempli
- ✅ `token_id` correctement rempli
- ✅ `booking_data` et `guest_data` en JSON

### 2. **Vérification SQL**

```sql
-- Vérifier les soumissions récentes
SELECT 
    id,
    booking_id,
    token_id,
    status,
    submitted_at,
    created_at
FROM guest_submissions 
WHERE created_at >= NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

## 🎯 Résumé des changements

1. **`spacetable.md`** : Structure de `guest_submissions` corrigée
2. **`verify-document-storage.sql`** : Requêtes SQL corrigées
3. **`submit-guest-info/index.ts`** : Fonction corrigée pour utiliser la bonne structure
4. **Relations** : Documentation des relations mise à jour

## ✅ Validation

Tous les fichiers sont maintenant **cohérents** avec la structure réelle de la base de données. Les tests peuvent être effectués sans erreurs de colonnes manquantes.

## 🚀 Prochaines étapes

1. **Tester** la fonction `submit-guest-info` avec les corrections
2. **Vérifier** les enregistrements dans `guest_submissions`
3. **Valider** que toutes les relations fonctionnent correctement
4. **Mettre à jour** la documentation si nécessaire
