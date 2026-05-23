# 🧪 Guide de Test - Solution de Nettoyage Intelligent des Liens ICS

## 📋 Objectif

Tester que la solution de nettoyage intelligent fonctionne correctement et résout le problème de persistance des anciennes dates lors du changement de lien ICS.

---

## ✅ Pré-requis

1. **Accès à Supabase Dashboard** pour voir les logs de l'Edge Function
2. **Accès à la base de données** pour vérifier les données
3. **Deux liens ICS différents** pour tester le changement
   - Lien A (ancien) : Votre lien actuel
   - Lien B (nouveau) : `https://www.airbnb.com/calendar/ical/1443787715795572441.ics?s=bb6ae14e907a21abef5295b2f51e2af8&locale=fr-CA`

---

## 🚀 Scénario de Test 1 : Changement de Lien ICS

### Étape 1 : État Initial

**Action :** Vérifier l'état actuel de la base de données

```sql
-- Compter les réservations actuelles
SELECT COUNT(*) as total_reservations
FROM public.airbnb_reservations
WHERE property_id = 'VOTRE_PROPERTY_ID';

-- Voir les détails
SELECT 
  airbnb_booking_id,
  summary,
  start_date,
  end_date,
  created_at
FROM public.airbnb_reservations
WHERE property_id = 'VOTRE_PROPERTY_ID'
ORDER BY start_date;
```

**Résultat attendu :** Noter le nombre de réservations et leurs IDs

---

### Étape 2 : Synchronisation avec le Lien A (Ancien)

**Action :** Synchroniser avec votre lien actuel

1. Aller dans l'application → Synchronisation Airbnb
2. Vérifier que le lien actuel est configuré
3. Cliquer sur "Synchroniser maintenant"
4. Noter le message de succès

**Résultat attendu :**
```
✅ Synchronisation réussie ! X réservations importées, Y anciennes réservations supprimées
```

**Vérification en base :**
```sql
SELECT COUNT(*) as total_after_sync_a
FROM public.airbnb_reservations
WHERE property_id = 'VOTRE_PROPERTY_ID';
```

---

### Étape 3 : Changement vers le Lien B (Nouveau)

**Action :** Remplacer le lien ICS

1. Aller dans l'application → Synchronisation Airbnb
2. Cliquer sur "Modifier"
3. Supprimer l'ancien lien
4. Coller le nouveau lien : `https://www.airbnb.com/calendar/ical/1443787715795572441.ics?s=bb6ae14e907a21abef5295b2f51e2af8&locale=fr-CA`
5. Cliquer sur "Sauvegarder et Synchroniser"

**Résultat attendu :**
```
✅ URL du calendrier sauvegardée
🔄 Synchronisation des réservations en cours...
✅ Synchronisation réussie ! X réservations importées, Y anciennes réservations supprimées
```

**⚠️ IMPORTANT :** Le nombre Y (anciennes réservations supprimées) devrait être > 0

---

### Étape 4 : Vérification Post-Changement

**Action :** Vérifier que les anciennes réservations ont été supprimées

```sql
-- Compter les réservations après changement
SELECT COUNT(*) as total_after_sync_b
FROM public.airbnb_reservations
WHERE property_id = 'VOTRE_PROPERTY_ID';

-- Voir les nouvelles réservations
SELECT 
  airbnb_booking_id,
  summary,
  start_date,
  end_date,
  created_at,
  updated_at
FROM public.airbnb_reservations
WHERE property_id = 'VOTRE_PROPERTY_ID'
ORDER BY start_date;
```

**Résultat attendu :**
- ✅ Le nombre de réservations a changé
- ✅ Les anciennes réservations (du Lien A) ont disparu
- ✅ Seules les nouvelles réservations (du Lien B) sont présentes
- ✅ Les dates correspondent au nouveau fichier ICS

---

### Étape 5 : Vérification dans l'Application

**Action :** Vérifier l'affichage dans l'interface

1. Aller dans le Dashboard
2. Ouvrir le calendrier de la propriété
3. Vérifier que seules les nouvelles réservations apparaissent

**Résultat attendu :**
- ✅ Calendrier affiche uniquement les réservations du nouveau lien
- ✅ Aucune ancienne réservation visible
- ✅ Les dates sont correctes

---

## 🧪 Scénario de Test 2 : Retour au Lien A

### Objectif
Vérifier que le système fonctionne aussi dans l'autre sens (retour au lien précédent)

### Étape 1 : Retour au Lien A

**Action :** Remettre le lien original

1. Aller dans l'application → Synchronisation Airbnb
2. Cliquer sur "Modifier"
3. Remplacer par le Lien A (original)
4. Cliquer sur "Sauvegarder et Synchroniser"

**Résultat attendu :**
- ✅ Les réservations du Lien B sont supprimées
- ✅ Les réservations du Lien A sont recréées
- ✅ Message indique X réservations supprimées

---

## 🧪 Scénario de Test 3 : Fichier ICS Vide

### Objectif
Tester le comportement avec un lien ICS vide ou invalide

### Étape 1 : Lien ICS Vide

**Action :** Utiliser un lien ICS qui ne contient aucune réservation

**Résultat attendu :**
```
✅ Synchronisation réussie ! 0 réservations importées, X anciennes réservations supprimées
```

**Vérification :**
```sql
SELECT COUNT(*) FROM public.airbnb_reservations WHERE property_id = 'VOTRE_PROPERTY_ID';
-- Devrait retourner 0
```

---

## 📊 Vérification des Logs

### Logs Supabase Edge Function

**Action :** Consulter les logs de l'Edge Function

1. Aller dans Supabase Dashboard
2. Edge Functions → sync-airbnb-unified → Logs
3. Chercher les messages suivants :

**Messages attendus :**
```
🧹 Nettoyage des anciennes réservations...
✅ X anciennes réservations supprimées
📋 Réservations supprimées:
   - HM12345678: Airbnb – John Doe
   - HM87654321: Airbnb – Jane Smith
```

---

## ✅ Critères de Succès

### Test Réussi Si :

1. ✅ **Changement de lien fonctionne**
   - Les anciennes réservations sont supprimées
   - Les nouvelles réservations sont créées
   - Aucune duplication

2. ✅ **Nettoyage automatique**
   - Le message indique le nombre de réservations supprimées
   - Les logs montrent les détails des suppressions

3. ✅ **Cohérence des données**
   - Base de données contient uniquement les réservations du lien actuel
   - Calendrier affiche uniquement les réservations actuelles

4. ✅ **Pas de régression**
   - Les réservations validées (avec guests) ne sont pas supprimées par erreur
   - Les tokens de sécurité sont toujours créés

---

## ❌ Problèmes Potentiels et Solutions

### Problème 1 : Anciennes réservations persistent

**Symptôme :** Après changement de lien, les anciennes réservations sont toujours là

**Diagnostic :**
```sql
-- Vérifier si le nettoyage a été exécuté
SELECT * FROM public.airbnb_reservations 
WHERE property_id = 'VOTRE_PROPERTY_ID'
AND updated_at < NOW() - INTERVAL '1 hour';
```

**Solution :**
1. Vérifier les logs de l'Edge Function
2. Vérifier que la modification du code a été déployée
3. Re-synchroniser manuellement

---

### Problème 2 : Toutes les réservations supprimées

**Symptôme :** Après synchronisation, aucune réservation n'apparaît

**Diagnostic :**
```sql
-- Vérifier si le fichier ICS a été correctement parsé
SELECT * FROM public.airbnb_sync_status 
WHERE property_id = 'VOTRE_PROPERTY_ID';
```

**Solution :**
1. Vérifier que le lien ICS est valide
2. Tester le lien dans un navigateur
3. Vérifier les logs pour voir si des erreurs de parsing

---

### Problème 3 : Erreur lors du nettoyage

**Symptôme :** Message d'erreur lors de la synchronisation

**Diagnostic :**
Consulter les logs Supabase pour voir l'erreur exacte

**Solutions possibles :**
1. Problème de permissions RLS → Vérifier les policies
2. Contrainte de clé étrangère → Vérifier les relations
3. Timeout → Réduire le nombre de réservations à supprimer

---

## 🔍 Requêtes SQL Utiles

### Voir l'historique des synchronisations
```sql
SELECT 
  property_id,
  sync_status,
  last_sync_at,
  reservations_count,
  last_error
FROM public.airbnb_sync_status
WHERE property_id = 'VOTRE_PROPERTY_ID'
ORDER BY last_sync_at DESC;
```

### Voir les réservations récemment modifiées
```sql
SELECT 
  airbnb_booking_id,
  summary,
  start_date,
  end_date,
  created_at,
  updated_at
FROM public.airbnb_reservations
WHERE property_id = 'VOTRE_PROPERTY_ID'
AND updated_at > NOW() - INTERVAL '1 hour'
ORDER BY updated_at DESC;
```

### Comparer avant/après
```sql
-- Créer un snapshot AVANT
CREATE TEMP TABLE snapshot_before AS
SELECT * FROM public.airbnb_reservations 
WHERE property_id = 'VOTRE_PROPERTY_ID';

-- Après synchronisation, comparer
SELECT 
  'Supprimées' as action,
  COUNT(*) as count
FROM snapshot_before sb
WHERE NOT EXISTS (
  SELECT 1 FROM public.airbnb_reservations ar
  WHERE ar.airbnb_booking_id = sb.airbnb_booking_id
)
UNION ALL
SELECT 
  'Ajoutées' as action,
  COUNT(*) as count
FROM public.airbnb_reservations ar
WHERE ar.property_id = 'VOTRE_PROPERTY_ID'
AND NOT EXISTS (
  SELECT 1 FROM snapshot_before sb
  WHERE sb.airbnb_booking_id = ar.airbnb_booking_id
);
```

---

## 📝 Rapport de Test

### Template de Rapport

```markdown
# Rapport de Test - Nettoyage Intelligent ICS

**Date :** [DATE]
**Testeur :** [NOM]
**Property ID :** [ID]

## Résultats

### Test 1 : Changement de Lien
- [ ] ✅ Anciennes réservations supprimées
- [ ] ✅ Nouvelles réservations créées
- [ ] ✅ Message de succès affiché
- [ ] ✅ Logs corrects

**Nombre de réservations supprimées :** [X]
**Nombre de réservations ajoutées :** [Y]

### Test 2 : Retour au Lien Original
- [ ] ✅ Réservations restaurées
- [ ] ✅ Cohérence des données

### Test 3 : Fichier ICS Vide
- [ ] ✅ Toutes les réservations supprimées
- [ ] ✅ Pas d'erreur

## Problèmes Rencontrés
[DESCRIPTION]

## Conclusion
- [ ] ✅ Tous les tests passent
- [ ] ⚠️ Tests partiellement réussis
- [ ] ❌ Tests échoués

**Recommandations :**
[RECOMMANDATIONS]
```

---

## 🚀 Prochaines Étapes

Si tous les tests passent :
1. ✅ Déployer en production
2. ✅ Documenter le comportement
3. ✅ Former les utilisateurs

Si des tests échouent :
1. ❌ Analyser les logs
2. ❌ Corriger les bugs
3. ❌ Re-tester

---

**Prêt à tester ? Commencez par le Scénario 1 ! 🧪**
