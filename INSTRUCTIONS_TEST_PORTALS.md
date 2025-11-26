# 🧪 Instructions de Test - Solution Portals

## 📝 Préparation

### 1. Nettoyer le cache Vite
```powershell
Remove-Item -Recurse -Force node_modules\.vite
```

### 2. Redémarrer le serveur de développement
```powershell
# Si le serveur tourne, l'arrêter (Ctrl+C)
npm run dev
```

### 3. Faire un Hard Refresh du navigateur
- Chrome/Edge : `Ctrl + Shift + R`
- Ou : Ouvrir DevTools → onglet "Network" → Cocher "Disable cache" → Rafraîchir

## ✅ Vérification 1 : Logs de Chargement

Ouvrir la console (F12) et chercher ces 3 logs :

```
🔵 [TEST MODIFICATION] BookingWizard chargé avec modifications - Version du [timestamp]
🟣 [PORTAL FIX] BookingDetailsStep chargé avec SafePopover (sans Portal) - Version du [timestamp]
```

**Résultat attendu** : Les 2 logs apparaissent avec un timestamp récent (aujourd'hui)

**Si un log manque** :
- Le composant n'est pas rechargé
- Refaire le nettoyage du cache et le hard refresh
- Vérifier que le serveur de dev est bien redémarré

## ✅ Vérification 2 : Navigation Entre Étapes (TEST CRITIQUE)

1. Aller sur une propriété
2. Cliquer sur "Nouvelle réservation"
3. Le wizard s'ouvre → **Vérifier** : Pas d'erreur dans la console
4. Cliquer sur le champ "Date d'arrivée"
5. Le calendrier (Popover) s'ouvre → **Vérifier** : Pas d'erreur dans la console
6. Sélectionner une date
7. Le calendrier se ferme → **Vérifier** : Pas d'erreur `NotFoundError`
8. Cliquer sur le champ "Date de départ"
9. Le calendrier s'ouvre → **Vérifier** : Pas d'erreur
10. Sélectionner une date
11. Le calendrier se ferme → **Vérifier** : Pas d'erreur
12. Entrer le nombre de guests (par exemple : 2)
13. Cliquer sur "Suivant"
14. **POINT CRITIQUE** : Le passage à l'étape 2 → **Vérifier** : PAS D'ERREUR `NotFoundError`

**Si l'erreur `NotFoundError` apparaît ici** :
- Il reste un Portal quelque part
- Copier le stack trace complet et le partager

**Si pas d'erreur** : ✅ Le problème principal est résolu !

## ✅ Vérification 3 : Upload de Document

1. Dans l'étape 2, cliquer sur "Parcourir" ou glisser-déposer une image de document d'identité
2. Le document est uploadé et l'OCR se lance
3. Attendre que l'extraction se termine
4. Un guest apparaît dans la liste → **Vérifier** : Pas d'erreur dans la console
5. Le log suivant devrait apparaître :
   ```
   🟢 [PORTAL FIX] DocumentUploadStep chargé avec SimpleModal + SafeSelect (SANS PORTALS)
   ```

## ✅ Vérification 4 : Édition de Guest (TEST CRITIQUE)

1. Cliquer sur le bouton "Modifier" (icône Edit) sur le guest créé
2. Le modal d'édition s'ouvre → **Vérifier** : Pas d'erreur dans la console
3. Cliquer sur le dropdown "Type de document"
4. Le Select s'ouvre → **Vérifier** : Pas d'erreur `NotFoundError`
5. Sélectionner "Passeport" ou "Carte d'identité"
6. Le Select se ferme → **Vérifier** : Pas d'erreur
7. Cliquer sur "Annuler" pour fermer le modal
8. **POINT CRITIQUE** : Le modal se ferme → **Vérifier** : PAS D'ERREUR `NotFoundError`

**Si l'erreur apparaît ici** :
- Le SafeSelect n'est pas correctement chargé
- Vérifier que le log "PORTAL FIX" de DocumentUploadStep est apparu

## ✅ Vérification 5 : Création de Réservation (TEST COMPLET)

1. Revenir à l'étape 1 avec "Précédent" → **Vérifier** : Pas d'erreur
2. Aller à l'étape 2 avec "Suivant" → **Vérifier** : Pas d'erreur
3. Aller à l'étape 3 (Vérification) avec "Suivant"
4. Vérifier que toutes les informations sont correctes
5. Cliquer sur "Créer la réservation"
6. **Vérifier** : Les logs suivants apparaissent dans l'ordre :
   ```
   🟡🟡🟡 [TEST MODIFICATION] handleSubmit appelé - Version du [timestamp]
   📤 [HOST WORKFLOW] Appel submit-guest-info-unified (mode host_direct)...
   🚀 [HOST WORKFLOW] Invocation Edge Function...
   ⏱️ [HOST WORKFLOW] Edge Function répondue en Xms
   📥 [HOST WORKFLOW] Réponse Edge Function reçue
   ```
7. **Vérifier** : Un toast de succès apparaît
8. **Vérifier** : Le wizard se ferme
9. **Vérifier** : La réservation apparaît dans la liste

## 📊 Checklist Finale

- [ ] Les 2 logs de chargement (🔵 et 🟣) sont visibles avec timestamps récents
- [ ] Le log DocumentUploadStep (🟢) apparaît après upload de document
- [ ] Le calendrier (Popover) s'ouvre et se ferme sans erreur `NotFoundError`
- [ ] Le passage de l'étape 1 à l'étape 2 ne cause pas d'erreur
- [ ] L'upload de document fonctionne sans crash
- [ ] Le modal d'édition de guest s'ouvre sans erreur
- [ ] Le Select "Type de document" s'ouvre sans erreur `NotFoundError`
- [ ] La fermeture du modal d'édition ne cause pas d'erreur
- [ ] Le retour à l'étape précédente ne cause pas d'erreur
- [ ] Le clic sur "Créer la réservation" appelle `handleSubmit` (log 🟡 visible)
- [ ] L'Edge Function est invoquée (logs 📤 et 🚀 visibles)
- [ ] L'Edge Function répond (log ⏱️ visible)
- [ ] La réservation est créée avec succès

## 🔴 Si ça ne fonctionne toujours pas

### Problème : Les logs de chargement n'apparaissent pas
**Solution** :
```powershell
# Arrêter complètement le serveur
# Puis :
Remove-Item -Recurse -Force node_modules\.vite
npm run dev
```
Dans le navigateur : Fermer tous les onglets du site, puis rouvrir

### Problème : L'erreur `NotFoundError` persiste
**Action** :
1. Copier le **stack trace complet** de l'erreur
2. Noter **exactement à quel moment** l'erreur se produit :
   - À l'ouverture du wizard ?
   - À l'ouverture d'un calendrier ?
   - À la fermeture d'un calendrier ?
   - Au passage à l'étape suivante ?
   - À l'ouverture du modal d'édition ?
   - À la fermeture du modal d'édition ?
   - À l'ouverture du Select ?
   - À la fermeture du Select ?
3. Partager ces informations

### Problème : `handleSubmit` n'est pas appelé
**Vérification** :
1. Le log 🟡🟡🟡 devrait apparaître quand on clique sur "Créer la réservation"
2. Si le log n'apparaît pas, c'est que le wizard crash **avant** d'atteindre le `handleSubmit`
3. Chercher une erreur `NotFoundError` juste avant dans la console

## 🎯 Résultat Final Attendu

Si tous les tests passent :
- ✅ Plus d'erreur `NotFoundError` nulle part dans le workflow
- ✅ Le wizard reste stable du début à la fin
- ✅ `handleSubmit` est appelé avec succès
- ✅ L'Edge Function génère les documents
- ✅ La réservation est créée et visible

**C'est le comportement attendu après ces corrections !**


