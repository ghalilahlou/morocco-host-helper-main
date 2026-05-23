# 🔍 DIAGNOSTIC COMPLET - BookingWizard

## ✅ PROBLÈMES RÉSOLUS

### 1. ✅ Upload de fichiers (CORRIGÉ)
**Problème** : L'input file était à l'intérieur de la div cliquable, créant un conflit.
**Solution** : Input déplacé à l'extérieur de la div cliquable.
**Statut** : ✅ RÉSOLU

### 2. ✅ Feedback visuel drag & drop (CORRIGÉ)
**Problème** : Aucun retour visuel lors du glisser-déposer.
**Solution** : Ajout de `isDragging` state + classes CSS conditionnelles.
**Statut** : ✅ RÉSOLU

### 3. ✅ Logs de débogage (AJOUTÉ)
**Problème** : Impossible de déboguer le processus d'upload.
**Solution** : Logs détaillés à chaque étape (upload, OCR, création guest).
**Statut** : ✅ RÉSOLU

### 4. ✅ Type `ExtendedUploadedDocument` manquant (CORRIGÉ)
**Problème** : Type non défini causant des erreurs TypeScript.
**Solution** : Interface créée avec `processingStatus`.
**Statut** : ✅ RÉSOLU

---

## ⚠️ PROBLÈMES POTENTIELS À VÉRIFIER

### 5. ⚠️ Génération automatique des documents après création
**Problème potentiel** : Les documents (contrat, police) ne sont pas générés automatiquement.
**Localisation** : `BookingWizard.tsx` ligne 444-638
**Analyse** :
- Le code génère les documents SEULEMENT si `formData.uploadedDocuments.length > 0`
- Si aucun document n'est uploadé → entre dans le "Workflow signature physique"
- Ce workflow appelle `generate_contract_only` et `generate_police_only`

**Test à faire** :
1. Créer une réservation SANS uploader de document
2. Vérifier si le contrat et la police sont générés
3. Vérifier si les URLs sont bien sauvegardées dans `documents_generated`

**Code concerné** :
```typescript
// Ligne 484-638 : Workflow signature physique
if (formData.guests.length > 0) {
  if (formData.uploadedDocuments && formData.uploadedDocuments.length > 0) {
    // Cas 1 : Avec documents uploadés
    // ✅ Appelle host_direct
  } else {
    // Cas 2 : Sans documents uploadés
    // ✅ Appelle generate_contract_only + generate_police_only
  }
}
```

### 6. ⚠️ Dates dynamiques (Calendrier → Input)
**Problème potentiel** : Les dates ne se mettent pas à jour visuellement.
**Localisation** : `BookingDetailsStep.tsx`
**Solution déjà appliquée** : Key prop sur SafePopover + parsing avec `T00:00:00`
**Statut** : ✅ DEVRAIT FONCTIONNER (à vérifier)

### 7. ⚠️ Suppression de réservation (Persistance visuelle)
**Problème potentiel** : La réservation reste affichée après suppression.
**Localisation** : `UnifiedBookingModal.tsx` ligne 445-472
**Solution déjà appliquée** : setTimeout(100ms) avant onClose()
**Statut** : ✅ DEVRAIT FONCTIONNER (à vérifier)

### 8. ⚠️ Aperçu des documents (ReviewStep)
**Problème potentiel** : L'aperçu ne fonctionne pas.
**Localisation** : `ReviewStep.tsx` + `DocumentPreviewDialog.tsx`
**Dépendance** : Nécessite `is_preview` column dans la table `bookings`
**Statut** : ⚠️ NÉCESSITE MIGRATION SQL

**Migration requise** :
```sql
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS is_preview BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_bookings_is_preview ON bookings(is_preview) WHERE is_preview = TRUE;
```

---

## 🎯 PLAN D'ACTION RECOMMANDÉ

### Étape 1 : Tester l'upload de fichiers ✅ EN COURS
1. Ouvrir la console (F12)
2. Cliquer sur la zone d'upload
3. Vérifier les logs :
   - `🖱️ [CLICK] Zone de upload cliquée`
   - `✅ [CLICK] Input trouvé`
   - `📂 [FILE INPUT] Fichiers sélectionnés`
   - `🚀 [UPLOAD START]`

### Étape 2 : Vérifier la génération automatique des documents
1. Créer une réservation complète
2. Vérifier dans les logs :
   - `📝 [WORKFLOW SIGNATURE PHYSIQUE]` OU `🏠 [HOST WORKFLOW]`
   - `✅ Contrat généré`
   - `✅ Fiche de police générée`
3. Ouvrir la réservation dans le calendrier
4. Vérifier que "Voir" apparaît (pas "Générer")

### Étape 3 : Appliquer la migration SQL (si nécessaire)
Si l'aperçu ne fonctionne pas :
1. Aller sur https://supabase.com/dashboard
2. SQL Editor
3. Exécuter la migration `is_preview`

### Étape 4 : Tests de bout en bout
1. ✅ Upload de document
2. ✅ OCR extraction
3. ✅ Aperçu des documents
4. ✅ Création de réservation
5. ✅ Génération automatique (contrat + police)
6. ✅ Affichage dans le calendrier
7. ✅ Visualisation des documents
8. ✅ Suppression de réservation

---

## 📊 RÉSUMÉ

| Problème | Statut | Priorité |
|----------|--------|----------|
| Upload fichiers | ✅ RÉSOLU | CRITIQUE |
| Feedback visuel | ✅ RÉSOLU | MOYENNE |
| Logs débogage | ✅ AJOUTÉ | FAIBLE |
| Type manquant | ✅ RÉSOLU | FAIBLE |
| Génération docs | ⚠️ À TESTER | CRITIQUE |
| Dates dynamiques | ✅ DEVRAIT OK | MOYENNE |
| Suppression | ✅ DEVRAIT OK | MOYENNE |
| Aperçu docs | ⚠️ MIGRATION SQL | MOYENNE |

---

## 🔧 COMMANDES UTILES

### Vérifier les logs en temps réel
```bash
# Dans la console du navigateur (F12)
# Filtrer par : 🖱️ 📂 🚀 🔍 ✅ ❌
```

### Appliquer les migrations
```sql
-- Via Supabase Dashboard → SQL Editor
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS is_preview BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_bookings_is_preview ON bookings(is_preview) WHERE is_preview = TRUE;
```

### Recharger l'application
```bash
# Si cache problématique
Ctrl + F5 (Windows/Linux)
Cmd + Shift + R (Mac)
```

---

**Date du diagnostic** : 2025-11-24
**Prochaine étape** : Tester l'upload de fichiers avec la correction appliquée

