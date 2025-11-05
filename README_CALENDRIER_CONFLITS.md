# 📅 Guide de Résolution des Conflits de Calendrier

## 🎯 Problème Résolu

Votre calendrier montrait des **réservations qui se chevauchent** (badges +2, +3, etc.). Ce guide vous montre comment :

1. **Empêcher** les nouveaux conflits
2. **Détecter** les conflits existants
3. **Nettoyer** les doublons

---

## 🚀 Solution Rapide (3 Étapes)

### Étape 1 : Appliquer les Migrations

```bash
cd "C:\Users\ghali\Videos\morocco-host-helper-main-main"
npx supabase db push
```

**Résultat attendu :**
```
Applying migration 20250131000001_improve_conflict_prevention.sql...
✅ Migration applied successfully
```

### Étape 2 : Vérifier les Doublons

Via Supabase SQL Editor (https://supabase.com/dashboard) ou en local :

```sql
-- Copier-coller dans Supabase SQL Editor
SELECT * FROM identify_duplicate_bookings();
```

**Interprétation :**
- **0 lignes** = Pas de doublons ✅
- **N lignes** = N doublons à nettoyer ⚠️

### Étape 3 : Tester la Validation

1. **Ouvrir** votre application : http://localhost:3000
2. **Aller** dans le calendrier d'une propriété
3. **Essayer** de créer une réservation avec des dates qui chevauchent une réservation existante
4. **Vous devriez voir** : ❌ "Conflit de réservation détecté"

**Si ça marche** : ✅ La validation fonctionne !

---

## 🔧 Commandes Utiles

### Identifier TOUS les Doublons

```bash
# Via terminal
cd "C:\Users\ghali\Videos\morocco-host-helper-main-main"
npx supabase db execute --file scripts/check-duplicates.sql
```

**OU** via Supabase SQL Editor :

```sql
-- Rapport complet en JSON
SELECT cleanup_duplicate_bookings(TRUE, 1000);
```

### Nettoyer les Doublons (⚠️ ATTENTION)

**AVANT :**
1. ⚠️ **Faire une sauvegarde** de votre base de données
2. Vérifier les doublons avec `check-duplicates.sql`
3. Confirmer que vous voulez les supprimer

**PUIS :**

```bash
npx supabase db execute --file scripts/cleanup-duplicates.sql
```

**OU** via Supabase SQL Editor :

```sql
-- Nettoyer (IRRÉVERSIBLE)
SELECT * FROM cleanup_duplicate_bookings(FALSE, 1000);
```

---

## 📊 Comprendre Votre Calendrier

### Avant la Correction

```
🔴 +3  5 novembre  → 4 réservations qui se chevauchent
🔴 +2  6 novembre  → 3 réservations qui se chevauchent
```

### Après la Correction

```
🟢  5 novembre  → 1 réservation (doublons supprimés)
🔵  6 novembre  → 1 réservation
```

### Code Couleur

| Couleur | Signification |
|---------|---------------|
| 🔴 **Rouge** | Conflit détecté |
| 🟢 **Vert** | Réservation Airbnb |
| 🔵 **Bleu** | Réservation manuelle |

---

## 🔍 Diagnostic des Problèmes

### Problème 1 : "La validation ne fonctionne pas"

**Symptôme :** Je peux créer des réservations en conflit

**Solution :**

1. Vérifier que les migrations sont appliquées :
```bash
npx supabase migration list
```

Chercher `20250131000001_improve_conflict_prevention.sql` dans la liste.

2. Si absent, appliquer :
```bash
npx supabase db push
```

3. Redémarrer l'application :
```bash
# Arrêter (Ctrl+C)
# Puis relancer
npm run dev
```

### Problème 2 : "J'ai encore des doublons"

**Symptôme :** Le calendrier affiche encore des badges +2, +3

**Solution :**

1. **Identifier** les doublons :
```sql
SELECT * FROM identify_duplicate_bookings();
```

2. **Vérifier** manuellement que ce sont bien des doublons (mêmes dates, même propriété)

3. **Nettoyer** :
```sql
SELECT * FROM cleanup_duplicate_bookings(FALSE, 100);
```

4. **Recharger** la page du calendrier

### Problème 3 : "Erreur 'function does not exist'"

**Symptôme :** `ERROR: function check_booking_conflicts does not exist`

**Solution :**

Les migrations ne sont pas appliquées. Exécuter :

```bash
npx supabase db push
```

---

## 📝 Workflow Recommandé

### Pour les Nouvelles Réservations

1. ✅ **Automatique** : Le système vérifie automatiquement les conflits
2. ✅ Si conflit → Message d'erreur affiché
3. ✅ L'utilisateur choisit d'autres dates

### Pour les Réservations Existantes

1. 📊 **Ouvrir** le calendrier
2. 🔍 **Observer** les badges rouges (+2, +3)
3. 🧹 **Exécuter** `check-duplicates.sql` pour identifier
4. 🗑️ **Nettoyer** avec `cleanup-duplicates.sql`
5. 🔄 **Recharger** la page

### Maintenance Régulière

**Hebdomadaire :**
```sql
SELECT * FROM identify_duplicate_bookings();
```

**Si doublons détectés :**
```sql
SELECT * FROM cleanup_duplicate_bookings(FALSE, 1000);
```

---

## 🆘 FAQ

### Q: Puis-je avoir plusieurs réservations sur les mêmes dates ?

**R:** Non, par défaut le système bloque les chevauchements. Si vous avez plusieurs chambres dans la même propriété :
1. Créer des propriétés séparées pour chaque chambre
2. OU : Désactiver la validation (non recommandé)

### Q: Comment désactiver temporairement la validation ?

**R:** Dans `src/components/BookingWizard.tsx`, commenter les lignes 145-152 :

```typescript
// if (conflictingBookings && conflictingBookings.length > 0) {
//   toast({ ... });
//   return;
// }
```

### Q: La validation fonctionne-t-elle pour les réservations Airbnb ?

**R:** Oui ! Le système vérifie TOUS les types de réservations (manuelles + Airbnb).

### Q: Que se passe-t-il si je modifie une réservation existante ?

**R:** La validation ignore la réservation en cours de modification pour éviter les faux positifs.

---

## 📚 Documentation Complète

Pour plus de détails, consulter :
- **Guide complet** : [`docs/CALENDRIER_GESTION_CONFLITS.md`](docs/CALENDRIER_GESTION_CONFLITS.md)
- **Scripts SQL** : Dossier `scripts/`
- **Migrations** : Dossier `supabase/migrations/`

---

## ✅ Checklist de Validation

Avant de déployer en production :

- [ ] Migrations appliquées (`npx supabase db push`)
- [ ] Aucun doublon dans `identify_duplicate_bookings()`
- [ ] Validation fonctionne (tester manuellement)
- [ ] Calendrier affiche correctement les couleurs
- [ ] Console ne montre plus de warnings de conflits
- [ ] Sauvegarde de la base de données effectuée

---

**Besoin d'aide ?** Consulter les logs :
- **Frontend** : Console navigateur (F12)
- **Backend** : Logs Supabase (`npx supabase logs`)

---

**Dernière mise à jour :** 31 janvier 2025
**Version :** 1.0.0

