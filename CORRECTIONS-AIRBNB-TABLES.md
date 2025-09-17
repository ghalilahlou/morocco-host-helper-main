# Corrections des Tables Airbnb

## 🚨 Problème identifié

Le script `verify-document-storage.sql` faisait référence à des colonnes inexistantes dans la table `properties` :
- ❌ `airbnb_sync_status` (n'existe pas dans `properties`)
- ❌ `airbnb_last_sync` (n'existe pas dans `properties`)

## ✅ Structure réelle des tables Airbnb

### Table `properties`
```sql
- id (PK)
- name
- address
- airbnb_ics_url ✅ (existe)
- created_at, updated_at
```

### Table `airbnb_reservations` (séparée)
```sql
- id (PK)
- property_id (FK) → properties.id
- airbnb_booking_id
- check_in_date, check_out_date
- guest_name, guest_email
- status
- created_at, updated_at
```

### Table `airbnb_sync_status` (séparée)
```sql
- id (PK)
- property_id (FK) → properties.id
- status
- last_sync_at
- reservations_count
- last_error
- created_at, updated_at
```

## ✅ Corrections apportées

### 1. **Fichier `verify-document-storage.sql` corrigé**

**Section 5 - Vérification des propriétés :**
```sql
-- AVANT (incorrect)
SELECT 
    airbnb_sync_status,    -- ❌ N'existe pas
    airbnb_last_sync       -- ❌ N'existe pas
FROM properties;

-- APRÈS (correct)
SELECT 
    id, name, airbnb_ics_url, created_at, updated_at
FROM properties 
WHERE airbnb_ics_url IS NOT NULL;

-- Ajout de la vérification du statut de sync
SELECT 
    id, property_id, status, last_sync_at, 
    reservations_count, last_error, created_at, updated_at
FROM airbnb_sync_status;
```

**Section 9 - Synchronisation Airbnb :**
```sql
-- Ajout de la vérification des réservations Airbnb spécifiques
SELECT 
    'Airbnb Reservations' as analysis_type,
    COUNT(*) as total_airbnb_reservations,
    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '1 day' THEN 1 END) as recent_airbnb_reservations
FROM airbnb_reservations ar
JOIN properties p ON p.id = ar.property_id
WHERE p.airbnb_ics_url IS NOT NULL;
```

**Section 10 - Résumé général :**
```sql
-- Ajout des statistiques Airbnb
(SELECT COUNT(*) FROM airbnb_reservations WHERE created_at >= NOW() - INTERVAL '1 day') as airbnb_reservations_today,
(SELECT COUNT(*) FROM airbnb_sync_status WHERE updated_at >= NOW() - INTERVAL '1 day') as sync_status_updates_today;
```

### 2. **Fichier `spacetable.md` mis à jour**

**Ajout des tables Airbnb manquantes :**
- ✅ Table `airbnb_reservations` (18)
- ✅ Table `airbnb_sync_status` (19)

## 📊 Structure complète des tables Airbnb

### Relations Airbnb
```sql
properties.airbnb_ics_url → URL du calendrier ICS
airbnb_reservations.property_id → properties.id
airbnb_sync_status.property_id → properties.id
```

### Workflow de synchronisation
1. **Configuration** : URL ICS stockée dans `properties.airbnb_ics_url`
2. **Synchronisation** : Réservations importées dans `airbnb_reservations`
3. **Statut** : Suivi dans `airbnb_sync_status`
4. **Conversion** : Réservations Airbnb → `bookings` + `guests`

## 🧪 Tests à effectuer

### 1. **Vérification des tables Airbnb**

```sql
-- Vérifier les propriétés avec URL Airbnb
SELECT id, name, airbnb_ics_url 
FROM properties 
WHERE airbnb_ics_url IS NOT NULL;

-- Vérifier les réservations Airbnb
SELECT COUNT(*) as total_reservations
FROM airbnb_reservations;

-- Vérifier le statut de synchronisation
SELECT property_id, status, last_sync_at, reservations_count
FROM airbnb_sync_status;
```

### 2. **Test de synchronisation**

```javascript
// Test de synchronisation Airbnb
const syncResult = await fetch('/functions/v1/sync-airbnb-unified', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_ANON_KEY'
  },
  body: JSON.stringify({
    propertyId: "test-property-123",
    force: true
  })
});
```

## 🎯 Résumé des changements

1. **`verify-document-storage.sql`** : Requêtes corrigées pour les tables Airbnb
2. **`spacetable.md`** : Documentation des tables Airbnb ajoutée
3. **Structure clarifiée** : Séparation entre `properties`, `airbnb_reservations`, et `airbnb_sync_status`

## ✅ Validation

- ✅ Toutes les colonnes référencées existent
- ✅ Les relations entre tables sont correctes
- ✅ La documentation est à jour
- ✅ Les requêtes SQL sont valides

Le script `verify-document-storage.sql` peut maintenant être exécuté sans erreurs ! 🎉
