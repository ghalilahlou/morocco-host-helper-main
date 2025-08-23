# 🔧 Guide de Redéploiement Manuel - Edge Function save-contract-signature

## 🚨 Problème
GitHub Actions a échoué car les secrets Supabase ne sont pas configurés. Redéployons manuellement l'Edge Function.

## 🔧 Solution Manuelle

### **Étape 1 : Redéployer l'Edge Function**

1. **Allez sur** : https://supabase.com/dashboard/project/csopyblkfyofwkeqqegd/functions
2. **Cliquez sur** `save-contract-signature`
3. **Cliquez sur "Deploy updates"**
4. **Attendez** que le déploiement soit terminé (status "Deployed")

### **Étape 2 : Vérifier le déploiement**

1. **Cliquez sur** `save-contract-signature` dans la liste
2. **Vérifiez** que le status est "Deployed"
3. **Cliquez sur "Logs"** pour voir les logs récents

### **Étape 3 : Tester la signature**

1. **Allez sur** : https://morocco-host-helper-main.vercel.app
2. **Connectez-vous** avec `ghlilahlou26@gmail.com`
3. **Générez un lien client** depuis votre propriété
4. **Ouvrez le lien** dans un nouvel onglet
5. **Remplissez le formulaire** et signez le contrat
6. **Vérifiez** qu'il n'y a plus d'erreur 500

## 🔍 Diagnostic si problème persiste

### **Vérifier les logs Supabase :**
1. **Dashboard → Edge Functions → `save-contract-signature` → Logs**
2. **Cherchez** les erreurs récentes
3. **Vérifiez** que la fonction est bien déployée

### **Vérifier la console du navigateur :**
1. **Ouvrez les outils de développement (F12)**
2. **Allez dans l'onglet "Console"**
3. **Cherchez** les erreurs lors de la signature

## ✅ Résultat attendu

Après le redéploiement manuel :
- ✅ **Edge Function déployée** avec les corrections
- ✅ **Signature fonctionne** sans erreur 500
- ✅ **Message de succès** dans l'interface
- ✅ **Signature visible** dans la base de données

---

**🎯 Objectif :** Permettre aux clients de signer électroniquement leurs contrats sans erreur.
