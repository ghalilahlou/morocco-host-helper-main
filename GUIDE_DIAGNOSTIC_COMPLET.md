# 🔍 Guide de Diagnostic Complet - Origine du Problème

## 📋 Commandes SQL à Exécuter

### 1. **Script Principal** : `DIAGNOSTIC_COMPLET_TRIGGERS_FONCTIONS.sql`

Ce script analyse :
- ✅ Tous les triggers sur la table `bookings`
- ✅ Toutes les fonctions liées aux bookings
- ✅ Les fonctions qui modifient (UPDATE/DELETE) les bookings
- ✅ Les policies RLS qui peuvent filtrer
- ✅ Les contraintes qui peuvent bloquer
- ✅ Les index qui peuvent affecter les requêtes
- ✅ Les vues matérialisées

**Exécution** : Copiez-collez le contenu dans Supabase SQL Editor et exécutez.

---

## 🔍 Analyse des Résultats

### A. **Si des triggers sont actifs sur `bookings`**

Vérifiez :
1. **Timing** : `BEFORE` ou `AFTER` ?
2. **Events** : `INSERT`, `UPDATE`, `DELETE` ?
3. **Level** : `ROW` ou `STATEMENT` ?
4. **Status** : `ENABLED` ou `DISABLED` ?

**Problèmes possibles** :
- Un trigger `BEFORE INSERT` qui modifie les données
- Un trigger `AFTER UPDATE` qui supprime d'autres réservations
- Un trigger qui appelle une fonction de nettoyage

---

### B. **Si des fonctions modifient les bookings**

Vérifiez :
1. **Operation Type** : `UPDATE`, `DELETE`, ou `INSERT` ?
2. **Security** : `SECURITY DEFINER` peut avoir des permissions élevées
3. **Definition** : Lisez le code pour voir ce qu'elle fait

**Fonctions suspectes** :
- `cleanup_duplicate_bookings` - peut supprimer des réservations
- `prevent_duplicate_bookings` - peut bloquer des insertions
- `refresh_bookings_enriched` - peut affecter les vues matérialisées

---

### C. **Si des policies RLS filtrent**

Vérifiez :
1. **Command** : `SELECT`, `INSERT`, `UPDATE`, `DELETE` ?
2. **Using Expression** : Condition qui filtre les résultats
3. **With Check Expression** : Condition pour les insertions/mises à jour

**Problèmes possibles** :
- Une policy qui filtre par `status = 'completed'` seulement
- Une policy qui limite à une seule réservation par propriété

---

### D. **Si des contraintes UNIQUE bloquent**

Vérifiez :
1. **Constraint Type** : `UNIQUE` peut empêcher les insertions
2. **Definition** : Quelles colonnes sont concernées ?

**Problèmes possibles** :
- Contrainte `(property_id, check_in_date, check_out_date)` unique
- Contrainte `(property_id, booking_reference)` unique

---

## 🎯 Identification de l'Origine du Problème

### **1. Si le problème vient de la BASE DE DONNÉES** :

**Indicateurs** :
- ❌ Contrainte UNIQUE qui bloque les insertions
- ❌ Trigger qui supprime des réservations
- ❌ Fonction de nettoyage qui supprime des doublons
- ❌ Policy RLS qui filtre trop strictement

**Solution** : Modifier les contraintes/triggers/fonctions en base de données

---

### **2. Si le problème vient des EDGE FUNCTIONS** :

**Indicateurs** :
- ✅ Pas de contraintes/triggers problématiques en base
- ❌ Edge function qui met à jour au lieu de créer
- ❌ Edge function qui cherche mal les réservations existantes
- ❌ Edge function qui supprime des réservations

**Solution** : Corriger la logique dans les edge functions (déjà fait pour `create-booking-for-signature`)

---

### **3. Si le problème vient du FRONTEND/CACHE** :

**Indicateurs** :
- ✅ Pas de problèmes en base de données
- ✅ Edge functions fonctionnent correctement
- ❌ Cache qui ne filtre pas par `propertyId`
- ❌ `setBookings` qui remplace au lieu de fusionner

**Solution** : Corriger le cache et la logique de fusion (déjà fait dans `useBookings.ts`)

---

## 📊 Checklist de Diagnostic

### Étape 1 : Vérifier la Base de Données
- [ ] Exécuter `DIAGNOSTIC_COMPLET_TRIGGERS_FUNCTIONS.sql`
- [ ] Vérifier les triggers actifs
- [ ] Vérifier les fonctions qui modifient les bookings
- [ ] Vérifier les contraintes UNIQUE
- [ ] Vérifier les policies RLS

### Étape 2 : Vérifier les Edge Functions
- [ ] Vérifier les logs Supabase Edge Functions
- [ ] Vérifier si `create-booking-for-signature` est appelée
- [ ] Vérifier si `submit-guest-info-unified` est appelée
- [ ] Vérifier les erreurs dans les logs

### Étape 3 : Vérifier le Frontend
- [ ] Ouvrir la console du navigateur
- [ ] Vérifier les logs `[DIAGNOSTIC]` dans `useBookings.ts`
- [ ] Vérifier le nombre de réservations dans le cache
- [ ] Vérifier si le filtrage par `propertyId` fonctionne

---

## 🔧 Commandes Rapides

### Vérifier les triggers actifs uniquement :
```sql
SELECT tgname, tgenabled, pg_get_triggerdef(oid)
FROM pg_trigger
WHERE tgrelid = 'bookings'::regclass AND NOT tgisinternal;
```

### Vérifier les fonctions qui suppriment :
```sql
SELECT proname, pg_get_functiondef(oid)
FROM pg_proc
WHERE pg_get_functiondef(oid) ILIKE '%DELETE FROM bookings%';
```

### Vérifier les contraintes UNIQUE :
```sql
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'bookings'::regclass AND contype = 'u';
```

---

## 📝 Interprétation des Résultats

### Scénario 1 : Problème en Base de Données
**Si vous voyez** :
- Trigger `BEFORE INSERT` qui modifie les données
- Fonction `cleanup_duplicate_bookings` activée
- Contrainte UNIQUE sur `(property_id, check_in_date, check_out_date)`

**Action** : Désactiver/modifier le trigger ou la contrainte

---

### Scénario 2 : Problème dans Edge Functions
**Si vous voyez** :
- Pas de triggers/contraintes problématiques
- Edge function qui cherche mal les réservations
- Edge function qui met à jour au lieu de créer

**Action** : Corriger la logique dans les edge functions

---

### Scénario 3 : Problème dans Frontend/Cache
**Si vous voyez** :
- Tout est OK en base et dans les edge functions
- Cache qui contient toutes les réservations
- `setBookings` qui remplace au lieu de fusionner

**Action** : Les corrections dans `useBookings.ts` devraient résoudre le problème

---

## 🚀 Prochaines Étapes

1. **Exécutez** `DIAGNOSTIC_COMPLET_TRIGGERS_FONCTIONS.sql`
2. **Analysez** les résultats selon ce guide
3. **Identifiez** l'origine du problème (Base/Edge/Frontend)
4. **Appliquez** les corrections appropriées
5. **Testez** la création d'une nouvelle réservation
