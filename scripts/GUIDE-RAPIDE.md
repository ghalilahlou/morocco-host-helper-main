# 🚀 Guide Rapide - Correction des Problèmes de Sécurité

## 📋 Vue d'ensemble

Ce guide t'aide à comprendre et corriger les problèmes de sécurité identifiés par le linter Supabase.

## 🔍 Étape 1 : Diagnostic (Comprendre les problèmes)

### Via Supabase Dashboard (Recommandé)
1. Ouvre ton projet Supabase
2. Va dans **SQL Editor**
3. Copie-colle et exécute **dans l'ordre** :

```sql
-- 1. Diagnostiquer les vues
-- (Copier le contenu de scripts/diagnostic-01-check-views.sql)

-- 2. Diagnostiquer RLS
-- (Copier le contenu de scripts/diagnostic-02-check-rls-tables.sql)

-- 3. Diagnostiquer SECURITY DEFINER
-- (Copier le contenu de scripts/diagnostic-03-check-security-definer.sql)
```

### Via PowerShell (Windows)
```powershell
# Si tu as psql installé
$conn = "postgresql://postgres:TON_MOT_DE_PASSE@localhost:5432/postgres"

psql $conn -f scripts/diagnostic-01-check-views.sql
psql $conn -f scripts/diagnostic-02-check-rls-tables.sql
psql $conn -f scripts/diagnostic-03-check-security-definer.sql
```

## 🔧 Étape 2 : Correction (Résoudre les problèmes)

### Via Supabase Dashboard
1. Dans **SQL Editor**, copie-colle et exécute **dans l'ordre** :

```sql
-- 1. Supprimer la vue profiles
-- (Copier le contenu de scripts/correction-01-drop-profiles-view.sql)

-- 2. Activer RLS
-- (Copier le contenu de scripts/correction-02-enable-rls.sql)

-- 3. Ajouter policy generated_documents
-- (Copier le contenu de scripts/correction-03-add-policy-generated-documents.sql)

-- 4. Recréer les vues
-- (Copier le contenu de scripts/correction-04-recreate-views.sql)
```

### Via Migration Unique (Plus Simple) ⭐
**Option recommandée** : Utiliser la migration complète :

```bash
# Si tu utilises Supabase CLI
supabase migration up

# Ou directement dans SQL Editor
# Copier le contenu de: supabase/migrations/20251031_fix_linter_security.sql
```

## ✅ Étape 3 : Vérification (Confirmer que tout est OK)

### Via Supabase Dashboard
1. Dans **SQL Editor**, copie-colle :
```sql
-- (Copier le contenu de scripts/verification-finale.sql)
```

### Résultats attendus
- ✅ Vue `profiles` supprimée
- ✅ RLS activé sur 4 tables
- ✅ Policies présentes
- ✅ Vues recréées correctement

## 📊 Résumé des Problèmes

| Problème | Impact | Solution |
|----------|--------|----------|
| Vue `profiles` expose `auth.users` | 🔴 Critique | Supprimer la vue |
| RLS désactivé sur `properties` | 🔴 Critique | Activer RLS |
| RLS désactivé sur `guests` | 🔴 Critique | Activer RLS |
| RLS désactivé sur `guest_submissions` | 🔴 Critique | Activer RLS |
| RLS désactivé sur `generated_documents` | 🔴 Critique | Activer RLS + ajouter policy |
| Vues avec SECURITY DEFINER | 🟡 Moyen | Recréer sans SECURITY DEFINER |

## ⚠️ Avant de Commencer

1. **Faire une sauvegarde** de ta base de données
2. **Tester en dev** si possible
3. **Vérifier les dépendances** si tu utilises la vue `profiles`

## 🐛 Dépannage

### Erreur : "relation does not exist"
✅ **Normal** - Le script utilise `IF EXISTS` pour éviter les erreurs

### Erreur : "permission denied"
- Vérifie que tu utilises un compte avec droits admin
- Utilise le **service role key** si nécessaire

### Erreur : "syntax error"
- Vérifie que tu utilises PostgreSQL 12+
- Certaines fonctions nécessitent PostgreSQL 15+

## 📞 Besoin d'aide ?

1. Vérifie le fichier `scripts/README-DIAGNOSTIC.md` pour plus de détails
2. Examine les résultats des scripts de diagnostic
3. Chaque script contient des commentaires explicatifs

## 🎯 Ordre d'exécution recommandé

```
1. diagnostic-01-check-views.sql          ← Comprendre les vues
2. diagnostic-02-check-rls-tables.sql     ← Comprendre RLS
3. diagnostic-03-check-security-definer.sql ← Comprendre SECURITY DEFINER

4. correction-01-drop-profiles-view.sql   ← Corriger vue profiles
5. correction-02-enable-rls.sql           ← Activer RLS
6. correction-03-add-policy-generated-documents.sql ← Ajouter policy
7. correction-04-recreate-views.sql       ← Recréer vues

8. verification-finale.sql                ← Vérifier tout
```

Ou utilise directement :
**`supabase/migrations/20251031_fix_linter_security.sql`** ⭐

