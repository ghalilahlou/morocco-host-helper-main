# 📅 Gestion des Conflits de Réservation - Guide Complet

## 🎯 Vue d'ensemble

Le système dispose de **3 niveaux de protection** contre les réservations qui se chevauchent :

### 1️⃣ **Validation Frontend** (Temps réel)
- ✅ Vérifie les conflits AVANT de créer une réservation
- ✅ Affiche un message d'erreur clair à l'utilisateur
- ✅ Empêche l'envoi de réservations en conflit

### 2️⃣ **Validation Base de Données** (Trigger SQL)
- ✅ Vérifie les conflits lors de l'insertion
- ✅ Log un WARNING si conflit détecté
- ✅ Peut bloquer l'insertion (optionnel)

### 3️⃣ **Détection Visuelle** (Calendrier)
- ✅ Affiche les conflits en ROUGE dans le calendrier
- ✅ Détecte les chevauchements entre réservations manuelles et Airbnb
- ✅ Logger les conflits dans la console

---

## 🔧 Commandes Utiles

### Identifier les Doublons (MODE SÉCURISÉ)

```sql
-- Voir tous les doublons sans rien modifier
SELECT * FROM identify_duplicate_bookings();

-- Obtenir un rapport complet (JSON)
SELECT * FROM cleanup_duplicate_bookings(TRUE, 100);
```

**Résultat exemple :**
```json
{
  "dryRun": true,
  "totalDuplicatesFound": 15,
  "deletedCount": 0,
  "duplicates": [
    {
      "duplicate_id": "uuid-here",
      "property_id": "property-uuid",
      "check_in_date": "2025-11-05",
      "check_out_date": "2025-11-07",
      "reason": "Doublon détecté - 2ème occurrence"
    }
  ]
}
```

### Nettoyer les Doublons (⚠️ ATTENTION)

```sql
-- ⚠️ SUPPRIMER les doublons (IRRÉVERSIBLE)
SELECT * FROM cleanup_duplicate_bookings(FALSE, 100);
```

### Vérifier les Conflits pour une Nouvelle Réservation

```sql
-- Vérifier réservations manuelles
SELECT * FROM check_booking_conflicts(
  'property-uuid-here'::UUID,
  '2025-11-05'::DATE,
  '2025-11-07'::DATE,
  NULL
);

-- Vérifier réservations Airbnb
SELECT * FROM check_airbnb_conflicts(
  'property-uuid-here'::UUID,
  '2025-11-05'::DATE,
  '2025-11-07'::DATE
);

-- Vérifier TOUS les conflits (manuels + Airbnb)
SELECT * FROM check_all_booking_conflicts(
  'property-uuid-here'::UUID,
  '2025-11-05'::DATE,
  '2025-11-07'::DATE,
  NULL
);
```

**Résultat exemple :**
```json
{
  "hasConflicts": true,
  "bookingConflicts": [
    {
      "conflict_booking_id": "uuid",
      "conflict_guest_name": "Jean Dupont",
      "conflict_check_in": "2025-11-05",
      "conflict_check_out": "2025-11-08"
    }
  ],
  "airbnbConflicts": [
    {
      "conflict_airbnb_id": "HMCDQTMBP2",
      "conflict_guest_name": "Michael",
      "conflict_start_date": "2025-11-04",
      "conflict_end_date": "2025-11-06"
    }
  ],
  "totalConflicts": 2
}
```

---

## 🛠️ Configuration

### Activer le Blocage Strict des Conflits

Par défaut, le trigger SQL **log un WARNING** mais **n'empêche PAS** l'insertion.

Pour **BLOQUER** les insertions en conflit :

1. Ouvrir `supabase/migrations/20250131000001_improve_conflict_prevention.sql`
2. Décommenter la ligne :
```sql
RAISE EXCEPTION 'Conflit de réservation détecté. % conflit(s) pour ces dates.', conflict_count;
```
3. Appliquer la migration :
```bash
npx supabase db push
```

### Désactiver la Validation Frontend

Si vous voulez permettre les doublons temporairement :

Dans `src/components/BookingWizard.tsx`, commenter le bloc :
```typescript
// if (conflictingBookings && conflictingBookings.length > 0) {
//   toast({ ... });
//   return;
// }
```

---

## 📊 Comprendre l'Affichage du Calendrier

### Codes Couleurs

| Couleur | Signification |
|---------|---------------|
| 🔴 **Rouge** | Conflit détecté (réservations qui se chevauchent) |
| 🟢 **Vert** | Réservation Airbnb synchronisée |
| 🔵 **Bleu** | Réservation manuelle normale |
| 🟡 **Jaune** | Réservation en attente |

### Badges Numérotés (+2, +3, etc.)

Indiquent le **nombre de réservations supplémentaires** sur cette date au-delà de celle affichée.

**Exemple :**
- Badge `+3` sur le 5 novembre = **4 réservations au total** ce jour-là
- Cliquer sur la date pour voir la liste complète

---

## 🚨 Scénarios Courants

### Scénario 1 : Double Réservation Airbnb

**Symptôme :** Même code Airbnb apparaît 2 fois dans le calendrier

**Cause :** Synchronisation multiple ou import manuel + automatique

**Solution :**
```sql
-- Identifier
SELECT * FROM identify_duplicate_airbnb_reservations();

-- Supprimer (si confirmé)
DELETE FROM airbnb_reservations 
WHERE id IN (
  SELECT duplicate_id FROM identify_duplicate_airbnb_reservations()
);
```

### Scénario 2 : Réservation Manuel + Airbnb sur Mêmes Dates

**Symptôme :** Deux réservations différentes (une rouge "MY" et une verte "CL") sur les mêmes dates

**Cause :** Réservation créée manuellement puis synchronisée depuis Airbnb

**Solution :**
1. Vérifier si les noms correspondent
2. Si c'est la même personne : supprimer la réservation manuelle
3. Laisser seulement la réservation Airbnb

### Scénario 3 : Chevauchement Partiel

**Symptôme :** Réservation A du 5-7 nov, Réservation B du 6-8 nov (en rouge)

**Cause :** Dates qui se chevauchent d'un jour

**Solution :**
- Ajuster les dates pour qu'elles ne se chevauchent pas
- OU : Si c'est intentionnel (multi-chambres), désactiver la validation

---

## 🔍 Déboguer les Conflits

### Logs Console (Frontend)

Ouvrir la console du navigateur et chercher :
```
⚠️ CONFLIT DÉTECTÉ: { res1: {...}, res2: {...} }
✅ Total conflits détectés: 2 [uuid1, uuid2]
```

### Logs Base de Données

```sql
-- Activer les logs
SET client_min_messages TO WARNING;

-- Essayer d'insérer une réservation
INSERT INTO bookings (...) VALUES (...);

-- Voir le warning si conflit
```

---

## 📝 Checklist Avant Production

- [ ] Tester la création de réservation avec dates valides
- [ ] Tester la création avec dates en conflit (doit bloquer)
- [ ] Vérifier que les conflits sont en rouge dans le calendrier
- [ ] Exécuter `identify_duplicate_bookings()` et vérifier qu'il n'y a pas de doublons
- [ ] Nettoyer les doublons si nécessaire avec `cleanup_duplicate_bookings(FALSE, 100)`
- [ ] Synchroniser Airbnb et vérifier qu'il n'y a pas de duplications

---

## ⚙️ Maintenance Régulière

### Hebdomadaire

```sql
-- Vérifier les conflits
SELECT * FROM identify_duplicate_bookings();
SELECT * FROM identify_duplicate_airbnb_reservations();
```

### Mensuel

```sql
-- Nettoyer les doublons (après vérification manuelle)
SELECT * FROM cleanup_duplicate_bookings(FALSE, 1000);

-- Vérifier l'intégrité
SELECT 
  property_id,
  check_in_date,
  check_out_date,
  COUNT(*) as count
FROM bookings
WHERE status NOT IN ('cancelled', 'rejected')
GROUP BY property_id, check_in_date, check_out_date
HAVING COUNT(*) > 1;
```

---

## 🆘 Support

En cas de problème :
1. Consulter les logs console (frontend)
2. Consulter les logs Supabase (backend)
3. Exécuter les fonctions de diagnostic SQL
4. Vérifier que les migrations sont appliquées : `npx supabase migration list`

---

**Dernière mise à jour :** 31 janvier 2025

