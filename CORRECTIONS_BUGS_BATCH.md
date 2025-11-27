# 🐛 Corrections de Bugs - Batch Session

## État des lieux

### ✅ Bugs déjà analysés

1. **[BUG-3] Signature host croppée sur la fiche de police**
   - **Localisation**: `supabase/functions/submit-guest-info-unified/index.ts` ligne 5403-5425
   - **Cause**: Dimensions trop petites (maxWidth: 180, maxHeight: 60)
   - **Solution**: Augmenter les dimensions et améliorer le calcul de scale

2. **[BUG-7] Afficher le nom du guest au lieu du numéro de résa**
   - **Localisation**: `src/utils/bookingDisplay.ts` ligne 141-225
   - **Statut**: Code existe déjà mais priorité mal configurée
   - **Solution**: S'assurer que la logique de priorité fonctionne correctement

3. **[BUG-4] Synchronisation Airbnb: 20 réservations importées mais 1 seule affichée**
   - **Localisation**: `supabase/functions/sync-airbnb-unified/index.ts` ligne 424-452
   - **Cause probable**: Filtrage trop strict (`.filter(/* conditions */)`)
   - **Solution**: Analyser les conditions de filtrage

4. **[BUG-2] Règlement intérieur en anglais -> Français**
   - **Localisation**: Multiple (contrats, documents)
   - **Statut**: Semble déjà être en français dans la plupart des endroits
   - **Solution**: Vérifier tous les emplacements

5. **[BUG-6] Barres des réservations ne dépassent plus vers le next day**
   - **Localisation**: `src/components/calendar/CalendarGrid.tsx`
   - **Statut**: Calcul de span à vérifier
   - **Solution**: Ajuster la logique de calcul

### 🔍 Bugs à analyser

6. **[BUG-1] Sign up: Problème de réception de mails de confirmation (+30 min)**
   - **Type**: Configuration Supabase Auth
   - **Action**: Vérifier les settings Auth de Supabase

7. **[BUG-5] Contrat entreprise: Infos pro manquantes (numéro RC)**
   - **Type**: Données de template
   - **Action**: Ajouter les champs entreprise au contract_template

8. **[BUG-8] Réservations host: Permettre modification des infos extracted by AI**
   - **Type**: Feature manquante
   - **Action**: Ajouter une UI d'édition pour les données OCR

---

## Plan d'action

### Phase 1: Corrections critiques visibles (UI/UX)
1. ✅ Déployer les améliorations mobiles déjà faites
2. 🔄 Corriger la signature croppée (BUG-3)
3. 🔄 Corriger l'affichage du nom vs code (BUG-7)
4. 🔄 Corriger les barres de réservation (BUG-6)

### Phase 2: Corrections fonctionnelles
5. 🔄 Analyse synchronisation Airbnb (BUG-4)
6. 🔄 Règlement intérieur en français (BUG-2)
7. 🔄 Infos entreprise contrat (BUG-5)

### Phase 3: Feature & Configuration
8. 🔄 Modification infos AI (BUG-8)
9. 🔄 Configuration email Supabase (BUG-1)

### Phase 4: Diagnostic & Refactoring
10. 🔄 Diagnostic général
11. 🔄 Refactoring cohérence

---

## Corrections en cours


