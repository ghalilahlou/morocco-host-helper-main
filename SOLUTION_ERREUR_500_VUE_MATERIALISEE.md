# Solution - Erreur 500 Vue Matérialisée et Appels Automatiques

## 🔍 Problèmes Identifiés

### 1. Erreur 500 sur `mv_bookings_enriched`
```
GET https://csopyblkfyofwkeqqegd.supabase.co/rest/v1/mv_bookings_enriched?... 500 (Internal Server Error)
```

**Cause** : La vue matérialisée `mv_bookings_enriched` retourne une erreur 500, probablement due à :
- Vue non rafraîchie
- Problème avec `v_guest_submissions` (utilisée dans la vue)
- Timeout de la requête

### 2. Appels Automatiques à `submit-guest-info-unified`
La fonction `get-guest-documents-unified` appelait automatiquement `submit-guest-info-unified` pour générer les documents manquants, causant :
- Erreurs 401 (Invalid JWT)
- Appels inutiles
- Logique incorrecte (cette fonction doit seulement RÉCUPÉRER les documents, pas les générer)

## ✅ Solutions Appliquées

### 1. Amélioration de la Détection d'Erreur 500

**Fichier : `src/hooks/useBookings.ts`**

Ajout d'une détection immédiate de l'erreur 500 dans la réponse :

```typescript
// ✅ CORRECTION CRITIQUE : Vérifier immédiatement si la réponse contient une erreur 500
if (result?.error) {
  const errorStatus = result.error.status || result.error.statusCode || result.error.code;
  if (errorStatus === 500 || errorStatus === '500' || result.error.message?.includes('500')) {
    console.warn('⚠️ [BOOKINGS] Erreur 500 détectée dans la réponse, passage immédiat au fallback');
    error = result.error;
    bookingsData = null;
    shouldUseFallback = true;
    throw new Error('500 Internal Server Error from mv_bookings_enriched');
  }
}
```

**Résultat** : Le fallback se déclenche immédiatement en cas d'erreur 500, sans attendre le timeout.

### 2. Suppression des Appels Automatiques à `submit-guest-info-unified`

**Fichier : `supabase/functions/get-guest-documents-unified/index.ts`**

**AVANT** :
```typescript
// Générer automatiquement le contrat s'il n'existe pas
const { data: generateResult, error: generateError } = await supabase.functions.invoke('submit-guest-info-unified', {
  action: 'generate_contract_only',
  bookingId: booking.id
});
```

**APRÈS** :
```typescript
// ✅ CORRIGÉ : Ne pas générer automatiquement, juste logger qu'il est manquant
console.log(`ℹ️ No contract found in Storage for booking ${booking.id}`);
// La génération doit être faite explicitement par l'utilisateur
```

**Résultat** :
- Plus d'erreurs 401 (Invalid JWT)
- Plus d'appels inutiles
- Logique correcte : `get-guest-documents-unified` récupère seulement les documents existants

## 📋 Comportement Attendu

### Chargement des Réservations

1. **Tentative sur la vue matérialisée** : `mv_bookings_enriched`
2. **Si erreur 500 détectée** : Passage immédiat au fallback
3. **Fallback** : Requête directe sur la table `bookings` avec JOINs

### Récupération des Documents

1. **Recherche dans la base de données** : `uploaded_documents` et `generated_documents`
2. **Recherche dans le Storage** : Bucket `guest-documents`
3. **Si document manquant** : Log uniquement, pas de génération automatique
4. **Génération** : Doit être faite explicitement par l'utilisateur via l'interface

## 🔧 Actions Recommandées

### 1. Rafraîchir la Vue Matérialisée

```sql
-- Via Supabase Dashboard → SQL Editor
REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_bookings_enriched;
```

### 2. Vérifier `v_guest_submissions`

Si la vue matérialisée utilise `v_guest_submissions`, vérifier qu'elle fonctionne :

```sql
SELECT * FROM v_guest_submissions LIMIT 10;
```

### 3. Désactiver Temporairement la Vue Matérialisée (si nécessaire)

Si le problème persiste, désactiver temporairement la vue dans `useBookings.ts` :

```typescript
// Commenter cette ligne :
// .from('mv_bookings_enriched')

// Utiliser directement :
.from('bookings')
.select(`*, guests (*), property:properties (*)`)
```

## ✅ Résultat

- ✅ Les réservations se chargent correctement via le fallback si la vue matérialisée retourne 500
- ✅ Plus d'erreurs 401 lors de la récupération des documents
- ✅ Logique correcte : génération explicite des documents par l'utilisateur
- ✅ Performance améliorée : moins d'appels inutiles

