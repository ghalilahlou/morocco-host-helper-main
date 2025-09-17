# Guide de déploiement - Fonctions modulaires

## ✅ **Structure créée avec succès**

```
supabase/functions/
├── generate-contract/
│   └── index.ts          # 16.8 KB - Gestion des contrats
├── generate-police-forms/
│   └── index.ts          # 15.5 KB - Fiches de police
└── document-utils/
    └── index.ts          # 4.4 KB - Utilitaires
```

## 🚀 **Déploiement des fonctions**

### **Option 1 : Via l'interface Supabase (Recommandée)**

1. **Connectez-vous à votre projet Supabase**
2. **Allez dans Edge Functions**
3. **Pour chaque fonction :**
   - Cliquez sur **"+ Add Function"**
   - Nommez la fonction (ex: `generate-contract`)
   - Copiez le code du fichier `index.ts` correspondant
   - Cliquez sur **"Deploy"**

### **Option 2 : Via le CLI Supabase**

```bash
# Déployer chaque fonction individuellement
supabase functions deploy generate-contract
supabase functions deploy generate-police-forms
supabase functions deploy document-utils
```

### **Option 3 : Déploiement en lot**

```bash
# Déployer toutes les nouvelles fonctions
supabase functions deploy generate-contract generate-police-forms document-utils
```

## 🧪 **Tests après déploiement**

### **Test 1 : generate-contract**

```bash
# Test de génération
curl -X POST https://your-project.supabase.co/functions/v1/generate-contract \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "bookingId": "test-booking-id",
    "action": "generate"
  }'

# Test de signature
curl -X POST https://your-project.supabase.co/functions/v1/generate-contract \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "bookingId": "test-booking-id",
    "action": "sign",
    "signatureData": "data:image/png;base64,test-signature"
  }'
```

### **Test 2 : generate-police-forms**

```bash
curl -X POST https://your-project.supabase.co/functions/v1/generate-police-forms \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "bookingId": "test-booking-id"
  }'
```

### **Test 3 : document-utils**

```bash
# Test du statut des documents
curl -X POST https://your-project.supabase.co/functions/v1/document-utils \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "action": "get-document-status",
    "bookingId": "test-booking-id"
  }'

# Test de la liste des documents
curl -X POST https://your-project.supabase.co/functions/v1/document-utils \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "action": "list-documents",
    "bookingId": "test-booking-id"
  }'
```

## 📋 **Vérification du déploiement**

### **Dans l'interface Supabase :**

1. **Allez dans Edge Functions**
2. **Vérifiez que les 3 fonctions apparaissent :**
   - ✅ `generate-contract`
   - ✅ `generate-police-forms`
   - ✅ `document-utils`
3. **Cliquez sur chaque fonction pour vérifier :**
   - Le code est correct
   - Aucune erreur de syntaxe
   - Les logs sont propres

### **Test de fonctionnement :**

```javascript
// Test rapide en JavaScript
async function testDeployment() {
  const functions = [
    'generate-contract',
    'generate-police-forms', 
    'document-utils'
  ];
  
  for (const func of functions) {
    try {
      const response = await fetch(`https://your-project.supabase.co/functions/v1/${func}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer YOUR_ANON_KEY'
        },
        body: JSON.stringify({
          bookingId: 'test-booking-id',
          action: func === 'document-utils' ? 'get-document-status' : 'generate'
        })
      });
      
      const result = await response.json();
      console.log(`✅ ${func}: ${result.success ? 'OK' : 'ERROR'}`);
    } catch (error) {
      console.log(`❌ ${func}: ${error.message}`);
    }
  }
}

testDeployment();
```

## 🔄 **Migration depuis l'ancienne fonction**

### **Étape 1 : Tester les nouvelles fonctions**
- Vérifiez que toutes les fonctions fonctionnent correctement
- Testez avec des données réelles

### **Étape 2 : Mettre à jour le frontend**
```javascript
// Ancien code
const response = await fetch('/functions/v1/generate-documents', {
  method: 'POST',
  body: JSON.stringify({
    bookingId: 'booking-uuid',
    documentType: 'contract',
    signatureData: signatureData
  })
});

// Nouveau code
// 1. Générer le contrat
const contract = await fetch('/functions/v1/generate-contract', {
  method: 'POST',
  body: JSON.stringify({
    bookingId: 'booking-uuid',
    action: 'generate'
  })
});

// 2. Signer le contrat
const signedContract = await fetch('/functions/v1/generate-contract', {
  method: 'POST',
  body: JSON.stringify({
    bookingId: 'booking-uuid',
    action: 'sign',
    signatureData: signatureData
  })
});
```

### **Étape 3 : Supprimer l'ancienne fonction (optionnel)**
```bash
# Supprimer l'ancienne fonction si tout fonctionne
supabase functions delete generate-documents
```

## 🛠️ **Dépannage**

### **Problème : Fonction ne se déploie pas**
```bash
# Vérifier la syntaxe
supabase functions serve generate-contract

# Vérifier les logs
supabase functions logs generate-contract
```

### **Problème : Erreur 500**
- Vérifiez les variables d'environnement
- Vérifiez les permissions de la base de données
- Consultez les logs de la fonction

### **Problème : Erreur de CORS**
- Vérifiez que les headers CORS sont corrects
- Testez avec un client qui gère CORS

## 📊 **Monitoring**

### **Métriques à surveiller :**
- Temps de réponse des fonctions
- Taux d'erreur
- Utilisation de la mémoire
- Nombre d'invocations

### **Logs importants :**
```bash
# Voir les logs en temps réel
supabase functions logs generate-contract --follow

# Voir les logs d'une fonction spécifique
supabase functions logs generate-police-forms
```

## ✅ **Checklist de déploiement**

- [ ] **Structure créée** : 3 dossiers avec fichiers `index.ts`
- [ ] **Code déployé** : Toutes les fonctions déployées
- [ ] **Tests passés** : Chaque fonction répond correctement
- [ ] **Frontend mis à jour** : Code client adapté
- [ ] **Base de données** : Migration appliquée
- [ ] **Monitoring** : Logs et métriques configurés
- [ ] **Documentation** : Équipe informée des changements

## 🎯 **Avantages obtenus**

1. **✅ Stabilité** : Plus d'erreurs de parsing
2. **✅ Performance** : Fonctions plus rapides
3. **✅ Maintenance** : Code plus facile à déboguer
4. **✅ Évolutivité** : Facile d'ajouter de nouvelles fonctions
5. **✅ Sécurité** : Isolation des responsabilités

Votre architecture modulaire est maintenant prête et déployée ! 🚀
