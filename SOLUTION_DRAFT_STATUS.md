# Solution pour le statut 'draft' des réservations

## Problème identifié

L'erreur `invalid input value for enum booking_status: "draft"` se produit car :
1. La migration pour ajouter `'draft'` à l'ENUM n'a pas encore été appliquée dans la base de données
2. Le code essaie d'utiliser `'draft'` avant que la migration soit exécutée

## Solution temporaire (appliquée)

Le code a été modifié pour être **défensif** et fonctionner même si la migration n'est pas encore appliquée :

### 1. `useBookings.ts`
- ✅ Suppression du filtre `.neq('status', 'draft')` côté base de données
- ✅ Filtrage côté application pour exclure les réservations avec `status === 'draft'`
- ✅ Le code fonctionne même si `'draft'` n'existe pas encore dans l'ENUM

### 2. `BookingWizard.tsx`
- ✅ Utilisation temporaire de `'pending'` au lieu de `'draft'` pour la création
- ✅ TODO ajouté pour changer en `'draft'` une fois la migration appliquée

## Étapes pour activer complètement le statut 'draft'

### Étape 1 : Appliquer les migrations SQL

Exécuter dans l'ordre sur Supabase :

1. **`add_draft_status_to_bookings.sql`**
   ```sql
   ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'draft';
   COMMENT ON TYPE booking_status IS 'Statuts des réservations: draft (brouillon, non validé), pending (en attente), completed (complétée), archived (archivée)';
   ```

2. **`add_index_for_draft_bookings.sql`** (après commit de la première)
   ```sql
   CREATE INDEX IF NOT EXISTS idx_bookings_non_draft 
   ON public.bookings (property_id, check_in_date, check_out_date) 
   WHERE status != 'draft';
   ```

### Étape 2 : Mettre à jour le code

Une fois les migrations appliquées, modifier `BookingWizard.tsx` :

```typescript
// Ligne 278 - Remplacer :
status: 'pending' as any,

// Par :
status: 'draft' as any, // ✅ Statut draft : réservation non validée
```

### Étape 3 : Optionnel - Réactiver le filtre DB

Dans `useBookings.ts`, vous pouvez réactiver le filtre côté base de données :

```typescript
// Ligne 117 - Remplacer :
const { data: bookingsData, error } = await supabase
  .from('bookings')
  .select(...)
  .order('created_at', { ascending: false });

// Par :
const { data: bookingsData, error } = await supabase
  .from('bookings')
  .select(...)
  .neq('status', 'draft') // ✅ Exclure les réservations draft
  .order('created_at', { ascending: false });
```

## Comportement actuel

- ✅ Les réservations sont créées avec le statut `'pending'` temporairement
- ✅ Le code fonctionne même sans la migration
- ✅ Les réservations sont validées après génération complète des documents
- ✅ Le filtrage côté application exclut déjà les réservations `'draft'` si elles existent

## Comportement après migration

Une fois les migrations appliquées et le code mis à jour :

- ✅ Les réservations sont créées avec le statut `'draft'` initialement
- ✅ Elles ne sont **pas affichées** dans le calendrier (filtrées)
- ✅ Après génération complète des documents, passage à `'pending'` ou `'completed'`
- ✅ Les réservations incomplètes restent en `'draft'` et ne polluent pas le calendrier

## Vérification

Pour vérifier que la migration a été appliquée :

```sql
SELECT unnest(enum_range(NULL::booking_status)) AS status;
```

Vous devriez voir : `pending`, `completed`, `archived`, `draft`

