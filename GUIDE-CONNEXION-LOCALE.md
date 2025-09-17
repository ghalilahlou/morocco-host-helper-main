# 🎯 Guide de Connexion Locale - Morocco Host Helper

## ✅ État Actuel de la Connexion

**Votre connexion Supabase est fonctionnelle !** 

### 📊 Résultats des Tests
- ✅ **Connexion Supabase**: Opérationnelle
- ✅ **Tables principales**: Accessibles
  - `properties`: 23 enregistrements
  - `bookings`: 46 enregistrements  
  - `guest_submissions`: 27 enregistrements
  - `property_verification_tokens`: 34 enregistrements
- ❌ **Table manquante**: `verification_tokens` (à créer)
- ⚠️ **Edge Functions**: Accessibles mais retournent des erreurs (normal sans Docker)

## 🔧 Configuration Actuelle

Votre projet utilise les informations de connexion de l'image :
- **Project ID**: `csopyblkfyofwkeqqegd`
- **URL**: `https://csopyblkfyofwkeqqegd.supabase.co`
- **Connexion**: Directe (recommandée pour le développement)

## 🚀 Prochaines Étapes pour Corriger la Logique

### 1. Créer la Table Manquante

Exécutez ce SQL dans votre dashboard Supabase :

```sql
-- Créer la table verification_tokens manquante
CREATE TABLE IF NOT EXISTS verification_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token VARCHAR(255) UNIQUE NOT NULL,
  property_id UUID REFERENCES properties(id),
  booking_id UUID REFERENCES bookings(id),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_verification_tokens_token ON verification_tokens(token);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_property_id ON verification_tokens(property_id);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_booking_id ON verification_tokens(booking_id);
```

### 2. Développement Local Complet

Pour un développement local complet avec les edge functions :

1. **Installer Docker Desktop**:
   - Téléchargez depuis [docker.com](https://docker.com)
   - Redémarrez votre ordinateur après installation

2. **Démarrer Supabase localement**:
   ```bash
   npx supabase start
   ```

3. **Tester les edge functions**:
   ```bash
   npx supabase functions serve
   ```

### 3. Scripts de Test Disponibles

Vous avez maintenant 3 scripts de test :

```bash
# Test de connexion basique
node test-connection.js

# Test des edge functions et tables
node test-edge-functions.js

# Test spécifique (si vous en créez d'autres)
node check-current-token.js
```

### 4. Correction de la Logique des Tables

D'après vos fichiers SQL, voici les corrections à appliquer :

#### A. Exécuter les Corrections de Token
```bash
# Dans votre dashboard Supabase SQL Editor
psql -f fix-token-control-settings.sql
psql -f fix-verify-property-token.sql
psql -f fix-token-migration.sql
```

#### B. Créer les Tables de Test
```bash
psql -f create-test-token.sql
psql -f create-guest-submissions-table.sql
```

### 5. Structure de Connexion Recommandée

Pour le développement, utilisez cette configuration dans votre `.env` :

```env
# Connexion directe (recommandée pour le développement)
SUPABASE_DB_URL=postgresql://postgres:[YOUR-PASSWORD]@db.csopyblkfyofwkeqqegd.supabase.co:5432/postgres

# Pour les edge functions en production
# SUPABASE_DB_URL=postgresql://postgres.csopyblkfyofwkeqqegd:[YOUR-PASSWORD]@aws-0-eu-west-1.pooler.supabase.com:6543/postgres
```

## 🎯 Actions Immédiates

1. **Créer la table `verification_tokens`** (SQL ci-dessus)
2. **Exécuter les scripts de correction** dans l'ordre :
   - `fix-token-migration.sql`
   - `fix-token-control-settings.sql` 
   - `fix-verify-property-token.sql`
3. **Installer Docker Desktop** pour le développement local complet
4. **Tester avec** `node test-edge-functions.js`

## 📞 Support

Si vous rencontrez des problèmes :
1. Vérifiez que votre `.env` contient les bonnes clés
2. Exécutez `node test-connection.js` pour diagnostiquer
3. Consultez les logs dans votre dashboard Supabase

**Votre connexion est prête ! Vous pouvez maintenant corriger la logique de vos tables et edge functions.** 🚀
