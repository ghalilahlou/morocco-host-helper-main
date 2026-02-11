# Où trouver les logs des Edge Functions (Supabase)

## 1. Dans le Dashboard Supabase (en ligne)

### Accès direct aux logs Edge Functions
- **URL générique :**  
  `https://supabase.com/dashboard/project/VOTRE_PROJECT_REF/logs/edge-functions`
- **Pour votre projet** (d’après vos déploiements) :  
  `https://supabase.com/dashboard/project/csopyblkfyofwkeqqegd/logs/edge-functions`

### Étapes dans l’interface
1. Allez sur [supabase.com/dashboard](https://supabase.com/dashboard).
2. Cliquez sur votre projet (**csopyblkfyofwkeqqegd** ou le nom du projet).
3. Dans le menu de gauche : **Edge Functions** (icône ⚡).
4. Vous voyez la liste des fonctions (`save-contract-signature`, `regenerate-police-with-signature`, `generate-police-form`, etc.).
5. Cliquez sur une fonction (ex. **generate-police-form**).
6. Onglet **Logs** : `console.log`, `console.warn`, `console.error` et erreurs non gérées.
7. Onglet **Invocations** (si disponible) : requêtes/réponses, statut HTTP, durée.

### ⚠️ "No results found" sur une fonction
- **Changer la plage de temps** : passer de "Last hour" à **"Last 24 hours"** ou **"Last 7 days"**. Les logs peuvent être en dehors de la dernière heure (fuseau horaire ou délai d’affichage).
- **Vérifier l’onglet Invocations** : pour voir si la fonction a été appelée (statut 200, 500, etc.), même sans lignes dans Logs.
- **Regarder la fonction qui appelle** : après une signature, c’est **save-contract-signature** qui appelle **regenerate-police-with-signature**. Les logs utiles peuvent être dans **save-contract-signature** (messages du type "Appel regenerate-police-with-signature", "Réponse regenerate-police-with-signature").

---

## 2. Voir le résultat sans Dashboard : _debug dans les réponses API

Les réponses JSON des Edge Functions incluent des infos de debug. Vous pouvez les voir dans l’onglet **Réseau (Network)** du navigateur (DevTools → Network → clic sur la requête → Response).

### save-contract-signature (après signature du contrat)
Après avoir signé le contrat, la réponse de **save-contract-signature** contient maintenant un champ **`_debug.policeRegen`** :
- `called: true` — la régénération police a bien été lancée.
- `ok` / `status` — statut HTTP de l’appel à `regenerate-police-with-signature` (200 = OK).
- `success` — si la fiche de police a été régénérée avec succès.
- `error` — message d’erreur éventuel (si échec).

**Comment vérifier :** après avoir cliqué sur "Signer", ouvrez l’onglet Network, trouvez la requête vers **save-contract-signature**, ouvrez la Response et regardez `_debug.policeRegen`. Si `ok: false` ou `error` est renseigné, la régénération a échoué.

### generate-police-form
En cas de **succès**, la réponse contient :
- `hasGuestSignature: true/false` — signature trouvée et utilisée ou non.
- `_debug.signatureFound`, `_debug.signatureFormatOk`, `_debug.message` — détails sur la signature.

Pour une régénération manuelle (bouton "Régénérer la fiche de police") : même principe, regarder la requête **generate-police-form** dans Network → Response → `_debug`.

---

## 3. Tester en local (logs dans le terminal)

Si vous lancez Supabase en local :

```bash
npx supabase start
npx supabase functions serve generate-police-form save-contract-signature regenerate-police-with-signature
```

Les `console.log` / `console.error` de ces fonctions s’affichent **directement dans le terminal** où vous avez lancé `functions serve`.

---

## 4. Récapitulatif des URLs utiles (remplacez REF si besoin)

| Ce que vous voulez voir | URL (projet csopyblkfyofwkeqqegd) |
|-------------------------|------------------------------------|
| Liste des Edge Functions | https://supabase.com/dashboard/project/csopyblkfyofwkeqqegd/functions |
| Logs des Edge Functions  | https://supabase.com/dashboard/project/csopyblkfyofwkeqqegd/logs/edge-functions |
| Logs généraux du projet  | https://supabase.com/dashboard/project/csopyblkfyofwkeqqegd/logs |

Si une de ces URLs renvoie une 404 ou un menu différent, utilisez le menu de gauche du projet : **Edge Functions** puis la fonction, puis l’onglet **Logs** ou **Invocations**.
