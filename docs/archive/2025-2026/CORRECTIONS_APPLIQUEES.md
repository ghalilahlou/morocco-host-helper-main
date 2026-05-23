# ✅ CORRECTIONS APPLIQUÉES - RÉSERVATIONS INDÉPENDANTES

**Date** : 30 janvier 2026  
**Statut** : ✅ Phase 1 complétée

---

## 🎯 PROBLÈME RÉSOLU

### Symptôme
Les réservations indépendantes ne s'enregistraient pas correctement quand un même guest avait plusieurs réservations. Le système bloquait avec le message "Un workflow est déjà en cours".

### Cause identifiée
Un **garde global** (`isUnifiedWorkflowRunning`) bloquait TOUTES les soumissions en parallèle, même pour des réservations différentes.

---

## ✅ CORRECTION APPLIQUÉE (Phase 1)

### Fichier modifié
`src/services/documentServiceUnified.ts`

### Changement
**AVANT** : Garde global qui bloque tout
```typescript
let isUnifiedWorkflowRunning = false;

if (isUnifiedWorkflowRunning) {
  throw new Error('Un workflow est déjà en cours. Veuillez patienter.');
}
isUnifiedWorkflowRunning = true;
```

**APRÈS** : Garde par réservation
```typescript
const runningWorkflows = new Map<string, boolean>();

const workflowKey = `${request.token}-${request.airbnbCode}`;

if (runningWorkflows.get(workflowKey)) {
  throw new Error('Cette réservation est déjà en cours de traitement.');
}
runningWorkflows.set(workflowKey, true);

// ... traitement ...

finally {
  runningWorkflows.delete(workflowKey);
}
```

### Impact
✅ **Un guest peut maintenant remplir plusieurs réservations en parallèle**
- Réservation A (15-17 fév) → En cours
- Réservation B (20-22 fév) → Peut démarrer immédiatement

✅ **Chaque réservation est protégée individuellement**
- Pas de soumission double pour la même réservation
- Pas de blocage entre réservations différentes

---

## 🧪 TESTS RECOMMANDÉS

### Test 1 : Même guest, 2 réservations différentes
1. Créer 2 liens ICS pour "John Doe"
   - Lien A : 15-17 février
   - Lien B : 20-22 février
2. Ouvrir les 2 liens dans 2 onglets différents
3. Remplir les 2 formulaires en même temps
4. ✅ **Résultat attendu** : Les 2 réservations se créent sans blocage

### Test 2 : Protection contre double soumission
1. Créer 1 lien ICS
2. Remplir le formulaire
3. Cliquer 2 fois rapidement sur "Soumettre"
4. ✅ **Résultat attendu** : Message "Cette réservation est déjà en cours de traitement"

---

## 📋 PROCHAINES ÉTAPES (Optionnel)

### Phase 2 : Amélioration de la détection de doublon (30 min)
**Fichier** : `supabase/functions/submit-guest-info-unified/index.ts`

Améliorer la vérification pour `INDEPENDENT_BOOKING` en ajoutant `guest_name + check_in_date` à la requête de détection de doublon.

**Bénéfice** : Évite les confusions entre réservations de guests différents.

### Phase 3 : Contraintes en base de données (1 heure)
Ajouter des contraintes uniques en base de données pour garantir l'unicité :
- Pour Airbnb : `property_id + booking_reference`
- Pour INDEPENDENT : `property_id + guest_name + check_in_date`

**Bénéfice** : Protection absolue contre les doublons, même en cas de race condition.

---

## 📊 RÉSUMÉ

| Aspect | Avant | Après |
|--------|-------|-------|
| **Guest avec 2 réservations** | ❌ Bloqué | ✅ Fonctionne |
| **Soumissions parallèles** | ❌ Impossible | ✅ Possible |
| **Protection double soumission** | ✅ Oui | ✅ Oui (amélioré) |
| **Message d'erreur** | "Un workflow est déjà en cours" | "Cette réservation est déjà en cours" |

---

## 🚀 DÉPLOIEMENT

Pour déployer cette correction :

```bash
# 1. Build
npm run build

# 2. Commit
git add src/services/documentServiceUnified.ts
git commit -m "Fix: Garde par réservation pour permettre soumissions parallèles

- Remplace le garde global par une Map de gardes par réservation
- Permet à un guest de remplir plusieurs réservations en parallèle
- Améliore le message d'erreur pour être plus spécifique"

# 3. Push
git push origin main
```

---

## ✅ CONCLUSION

La correction de Phase 1 est **appliquée et prête à être testée**.

Le problème principal (blocage des soumissions parallèles) est **résolu**.

Les Phases 2 et 3 sont **optionnelles** et peuvent être appliquées ultérieurement pour renforcer la robustesse.
