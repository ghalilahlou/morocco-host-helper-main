# 🚀 Guide de Résolution - Problèmes de Contrats et Documents

## ❌ **Problèmes Identifiés**

### 1. **Erreur 404 - storage-sign-url**
- **Erreur** : `POST https://csopyblkfyofwkeqqegd.supabase.co/functions/v1/storage-sign-url 404 (Not Found)`
- **Cause** : Fonction Edge manquante ou mal déployée

### 2. **Erreur 500 - generate-contract**
- **Erreur** : `POST https://csopyblkfyofwkeqqegd.supabase.co/functions/v1/generate-contract 500 (Internal Server Error)`
- **Cause** : Problème avec les dépendances `_shared/serverClient.ts`

### 3. **Signature de l'hôte manquante**
- **Problème** : Les contrats générés n'incluent pas la signature de l'hôte
- **Cause** : Signature non stockée dans `properties.contract_template`

## ✅ **Solutions Fournies**

### **1. Corriger storage-sign-url**

**Fichier** : `storage-sign-url-FIXED.ts`

```typescript
// Fonction autonome sans dépendance _shared/
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Code complet fourni...
```

**Déploiement** :
1. Copiez le contenu de `storage-sign-url-FIXED.ts`
2. Allez sur Supabase Dashboard > Edge Functions > `storage-sign-url`
3. Remplacez tout le code par le nouveau code
4. Déployez la fonction

### **2. Corriger generate-contract**

**Fichier** : `generate-contract-WITH-HOST-SIGNATURE.ts`

**Améliorations** :
- ✅ Fonction autonome (pas de dépendance `_shared/`)
- ✅ Récupération de la signature de l'hôte depuis `properties.contract_template`
- ✅ Intégration automatique de la signature dans les contrats
- ✅ Gestion robuste des erreurs

**Déploiement** :
1. Copiez le contenu de `generate-contract-WITH-HOST-SIGNATURE.ts`
2. Allez sur Supabase Dashboard > Edge Functions > `generate-contract`
3. Remplacez tout le code par le nouveau code
4. Déployez la fonction

### **3. Ajouter la signature de l'hôte**

**Fichier** : `add-host-signature-to-property.ts`

**Fonctionnalité** :
- Permet d'ajouter/mettre à jour la signature de l'hôte pour une propriété
- Stocke la signature dans `properties.contract_template.landlord_signature`
- Utilisable depuis le dashboard d'administration

**Déploiement** :
1. Créez une nouvelle Edge Function `add-host-signature-to-property`
2. Copiez le contenu de `add-host-signature-to-property.ts`
3. Déployez la fonction

### **4. Corriger save-contract-signature**

**Fichier** : `save-contract-signature-FINAL.ts`

**Corrections** :
- ✅ Champ `contract_content` obligatoire ajouté
- ✅ Validation robuste
- ✅ Gestion des signatures existantes

**Déploiement** :
1. Copiez le contenu de `save-contract-signature-FINAL.ts`
2. Allez sur Supabase Dashboard > Edge Functions > `save-contract-signature`
3. Remplacez tout le code par le nouveau code
4. Déployez la fonction

## 🔧 **Instructions de Déploiement**

### **Étape 1 : Déployer les Edge Functions**

```bash
# 1. storage-sign-url
supabase functions deploy storage-sign-url

# 2. generate-contract  
supabase functions deploy generate-contract

# 3. save-contract-signature
supabase functions deploy save-contract-signature

# 4. add-host-signature-to-property (nouvelle)
supabase functions deploy add-host-signature-to-property
```

### **Étape 2 : Ajouter la signature de l'hôte**

Utilisez cette requête pour ajouter la signature de l'hôte à une propriété :

```javascript
// Exemple d'ajout de signature d'hôte
const { data, error } = await supabase.functions.invoke('add-host-signature-to-property', {
  body: {
    propertyId: 'YOUR_PROPERTY_ID',
    hostSignature: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...', // Signature en base64
    hostName: 'Nom de l\'hôte'
  }
});
```

### **Étape 3 : Tester le système**

1. **Test de génération de contrat** :
   ```javascript
   const { data, error } = await supabase.functions.invoke('generate-contract', {
     body: { bookingId: 'YOUR_BOOKING_ID' }
   });
   ```

2. **Test de signature de contrat** :
   ```javascript
   const { data, error } = await supabase.functions.invoke('save-contract-signature', {
     body: {
       bookingId: 'YOUR_BOOKING_ID',
       signerName: 'Nom du signataire',
       signatureDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...'
     }
   });
   ```

3. **Test de visualisation** :
   - Ouvrez le dashboard
   - Allez dans la section réservations
   - Cliquez sur "Voir les documents"
   - Vérifiez que les contrats et fiches de police s'affichent

## 🎯 **Résultats Attendus**

Après déploiement :

- ✅ **Plus d'erreur 404** sur `storage-sign-url`
- ✅ **Plus d'erreur 500** sur `generate-contract`
- ✅ **Signature de l'hôte** visible sur tous les contrats générés
- ✅ **Validation d'inscription** fonctionnelle
- ✅ **Visualisation des documents** opérationnelle

## 📋 **Checklist de Vérification**

- [ ] `storage-sign-url` déployé et fonctionnel
- [ ] `generate-contract` déployé avec signature d'hôte
- [ ] `save-contract-signature` déployé avec correction
- [ ] `add-host-signature-to-property` déployé (optionnel)
- [ ] Signature d'hôte ajoutée aux propriétés
- [ ] Tests de génération de contrat réussis
- [ ] Tests de signature de contrat réussis
- [ ] Visualisation des documents fonctionnelle

## 🆘 **En Cas de Problème**

Si vous rencontrez encore des erreurs :

1. **Vérifiez les logs** des Edge Functions dans Supabase Dashboard
2. **Confirmez le déploiement** de toutes les fonctions
3. **Testez individuellement** chaque fonction
4. **Vérifiez les variables d'environnement** Supabase

---

**📧 Contact** : Si les problèmes persistent, partagez les nouveaux logs d'erreur pour un diagnostic approfondi.
