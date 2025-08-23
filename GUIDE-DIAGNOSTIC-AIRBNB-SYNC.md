# 🔍 Guide de Diagnostic : Synchronisation Airbnb

## 🚨 Problèmes courants de synchronisation Airbnb

### **1. Vérifier l'Edge Function**

**Allez sur** : https://supabase.com/dashboard/project/csopyblkfyofwkeqqegd/functions
**Vérifiez** que `sync-airbnb-reservations` est "Deployed"

### **2. Vérifier les logs de l'Edge Function**

1. **Cliquez sur** `sync-airbnb-reservations`
2. **Cliquez sur "Logs"**
3. **Cherchez** les erreurs récentes

### **3. Vérifier la base de données**

**Exécutez ce script dans Supabase SQL Editor :**

```sql
-- Diagnostic de la synchronisation Airbnb
-- Vérifier les tables et données

-- 1. Vérifier si les tables existent
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_name IN ('airbnb_reservations', 'airbnb_sync_status', 'properties')
ORDER BY table_name;

-- 2. Vérifier les propriétés avec URL Airbnb
SELECT 
    id,
    name,
    airbnb_ics_url,
    user_id
FROM properties 
WHERE airbnb_ics_url IS NOT NULL AND airbnb_ics_url != '';

-- 3. Vérifier le statut de synchronisation
SELECT 
    property_id,
    sync_status,
    last_sync_at,
    last_error,
    reservations_count,
    created_at
FROM airbnb_sync_status
ORDER BY updated_at DESC;
```

### **4. Vérifier l'URL Airbnb**

1. **Allez sur** votre propriété dans l'application
2. **Vérifiez** que l'URL Airbnb est correcte
3. **Testez** l'URL dans un navigateur

### **5. Vérifier les politiques RLS**

**Exécutez ce script :**

```sql
-- Vérifier les politiques RLS sur airbnb_reservations
SELECT 
    policyname,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'airbnb_reservations';

-- Vérifier les politiques RLS sur airbnb_sync_status
SELECT 
    policyname,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'airbnb_sync_status';
```

## 🔧 Solutions courantes

### **Problème 1 : Edge Function non déployée**
**Solution :** Redéployer l'Edge Function

### **Problème 2 : URL Airbnb invalide**
**Solution :** Vérifier et corriger l'URL dans les propriétés

### **Problème 3 : Politiques RLS bloquantes**
**Solution :** Créer les politiques RLS appropriées

### **Problème 4 : Erreur d'authentification**
**Solution :** Vérifier que l'utilisateur est connecté

## 🎯 Actions à effectuer

1. **Vérifiez** l'Edge Function dans Supabase
2. **Exécutez** le script de diagnostic SQL
3. **Vérifiez** les logs de l'Edge Function
4. **Testez** l'URL Airbnb manuellement

**Commencez par vérifier l'Edge Function !** 🚀
