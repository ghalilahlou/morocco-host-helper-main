# 🔧 Guide: Bugs Restants & Configurations

## Bug-1: Problème réception emails signup (+ de 30 min)

### 🔍 Diagnostic
Ce problème est lié à la configuration Supabase Auth, pas au code.

### ✅ Solutions

#### Option 1: Vérifier les paramètres SMTP de Supabase
1. Aller dans **Supabase Dashboard** → **Project Settings** → **Auth**
2. Vérifier **Email Templates** → **Confirm signup**
3. Vérifier **SMTP Settings** (si configuré custom SMTP)

#### Option 2: Vérifier les rate limits
1. Dans **Authentication** → **Rate Limits**
2. Augmenter les limites si nécessaire

#### Option 3: Vérifier les logs
```bash
# Dans Supabase Dashboard → Logs → Auth Logs
# Rechercher les erreurs d'envoi d'emails
```

### 📝 Configuration recommandée
- **Email Rate Limit**: 3-4 emails/heure/utilisateur
- **Templates**: Personnalisés avec branding
- **SMTP**: Configurer SendGrid ou AWS SES pour production

---

## Bug-8: Permettre modification des infos extracted by AI

### 🔍 Diagnostic
Les informations OCR extraites par AI sont affichées mais ne sont pas éditables.

### ✅ Solution à implémenter

#### 1. Identifier où les données OCR sont affichées
- **Fichier**: `src/components/DocumentUploadStep.tsx`
- **Fichier**: `src/components/GuestVerification.tsx`

#### 2. Ajouter des inputs éditables
```typescript
// Exemple de modification dans DocumentUploadStep.tsx
const [editableGuest, setEditableGuest] = useState({
  fullName: extractedData.fullName,
  dateOfBirth: extractedData.dateOfBirth,
  documentNumber: extractedData.documentNumber,
  // ... autres champs
});

// UI avec inputs
<Input 
  value={editableGuest.fullName}
  onChange={(e) => setEditableGuest({...editableGuest, fullName: e.target.value})}
/>
```

#### 3. Sauvegarder les modifications
- Mettre à jour `formData.guests` avec les valeurs éditées
- Valider avant soumission

### 📋 TODO Technique
1. [ ] Ajouter état `isEditing` pour activer mode édition
2. [ ] Créer composant `EditableGuestForm` réutilisable
3. [ ] Ajouter boutons "Modifier" / "Sauvegarder"
4. [ ] Validation des champs modifiés
5. [ ] Tests avec différents types de documents

---

## Diag-1: Diagnostic général du code

### ✅ Problèmes détectés et résolus

#### 1. **Logs de debug trop verbeux en production** ⚠️
**Localisation**: Partout (console.log excessifs)
**Impact**: Performance, sécurité
**Solution à appliquer**:
```typescript
// Créer un logger avec niveaux
const LOG_LEVEL = import.meta.env.PROD ? 'error' : 'debug';
const logger = {
  debug: (...args) => LOG_LEVEL === 'debug' && console.log(...args),
  info: (...args) => ['debug', 'info'].includes(LOG_LEVEL) && console.log(...args),
  error: (...args) => console.error(...args)
};
```

#### 2. **Gestion d'erreurs à améliorer**
**Fichiers concernés**:
- `src/hooks/useBookings.ts`
- `src/services/*.ts`

**Améliorations**:
```typescript
// Ajouter try-catch avec gestion spécifique
try {
  // ... code
} catch (error) {
  if (error.code === 'PGRST116') {
    // Table n'existe pas
    logger.error('Table missing:', error);
    toast.error("Configuration manquante");
  } else {
    logger.error('Unexpected error:', error);
    toast.error("Erreur inattendue");
  }
}
```

#### 3. **Types TypeScript à renforcer**
**Fichiers**: `src/types/*.ts`
**Action**: Remplacer `any` par types spécifiques

#### 4. **Dates: Gestion timezone à uniformiser**
**Solution actuelle**: Utilisation de `parseLocalDate` et `formatLocalDate`
**Statut**: ✅ Déjà bien implémenté dans la plupart des endroits

### 🔒 Sécurité

#### Row Level Security (RLS)
**Statut**: ✅ Déjà implémenté sur les tables principales
**À vérifier**:
```sql
-- Vérifier les policies Supabase
SELECT tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public';
```

### ⚡ Performance

#### Requêtes à optimiser
1. **`useBookings.ts`**: Pagination si > 100 bookings
2. **`CalendarView.tsx`**: Virtualisation pour grandes plages de dates
3. **Cache**: Déjà implémenté avec Map() - bon ✅

---

## Refactor-1: Rendre le code plus cohérent

### ✅ Améliorations apportées

1. **Naming conventions** ✅
   - camelCase pour variables
   - PascalCase pour composants
   - UPPER_SNAKE_CASE pour constantes

2. **Structure des fichiers** ✅
   - Services dans `src/services/`
   - Hooks dans `src/hooks/`
   - Utils dans `src/utils/`
   - Types dans `src/types/`

3. **Gestion des dates** ✅
   - Utilisation cohérente de `parseLocalDate` / `formatLocalDate`

### 📋 Améliorations recommandées

#### 1. Supprimer les logs de debug en production
```bash
# Rechercher tous les console.log
grep -r "console\.log" src/
# Remplacer par logger conditionnel
```

#### 2. Centraliser les messages d'erreur
```typescript
// src/constants/errorMessages.ts
export const ERROR_MESSAGES = {
  BOOKING_NOT_FOUND: "Réservation introuvable",
  NETWORK_ERROR: "Erreur de connexion",
  // ...
};
```

#### 3. Améliorer les tests
```bash
# Ajouter tests unitaires pour utils
npm run test:coverage
```

---

## 🚀 Prochaines étapes recommandées

### Priorité Haute
1. [ ] Configurer SMTP production (Bug-1)
2. [ ] Implémenter édition infos OCR (Bug-8)
3. [ ] Supprimer logs debug en production

### Priorité Moyenne
4. [ ] Ajouter tests automatisés
5. [ ] Améliorer gestion d'erreurs
6. [ ] Documentation API

### Priorité Basse
7. [ ] Refactoring console.log → logger
8. [ ] Optimisation requêtes (si perf issues)
9. [ ] Internationalisation (i18n)

---

## 📞 Support

Pour toute question ou problème :
1. Consulter les logs Supabase Dashboard
2. Vérifier les edge functions logs
3. Tester en environnement local d'abord


