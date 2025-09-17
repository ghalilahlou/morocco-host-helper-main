# 🔍 Diagnostic Frontend ↔ Edge Functions

## 📊 Résumé des Incohérences Identifiées

### 🚨 **PROBLÈMES CRITIQUES**

#### 1. **Incohérence dans `resolve-guest-link`**
**Frontend attend :**
```typescript
// GuestWelcome.tsx & ContractSigning.tsx
const response = await supabase.functions.invoke('resolve-guest-link', {
  body: { propertyId, token, airbnbCode: airbnbBookingId }
});
```

**Edge Function retourne :**
```typescript
// resolve-guest-link/index.ts
return {
  property,
  booking  // ❌ Pas de format attendu par le frontend
}
```

**Frontend attend :**
```typescript
data = {
  ok: true,
  propertyId: propertyId,
  bookingId: airbnbBookingId || null,
  token: token,
  property: propertyData
}
```

#### 2. **Contournement de Fallback Incohérent**
Le frontend a des **contournements de fallback** qui créent des données artificielles :
```typescript
// GuestWelcome.tsx ligne 107-113
data = {
  ok: true,
  propertyId: propertyId,
  bookingId: airbnbBookingId || null,
  token: token,
  property: propertyData
};
```

#### 3. **Gestion des Erreurs Incohérente**
- **Frontend** : Gère les erreurs avec des messages génériques
- **Edge Functions** : Retournent des erreurs structurées différentes

### 🔧 **PROBLÈMES DE LOGIQUE MÉTIER**

#### 4. **Logique de Réservation Dupliquée**
**submit-guest-info** a une logique complexe de "find or create" :
```typescript
// Ligne 112-203 : Logique de recherche/mise à jour/création
// Mais le frontend ne gère pas ces cas différemment
```

#### 5. **Gestion des Tokens Incohérente**
- **Frontend** : Utilise `property_verification_tokens`
- **Edge Functions** : Certaines utilisent `verification_tokens` (table manquante)

#### 6. **Structure de Données Incohérente**
**Frontend attend :**
```typescript
interface ExpectedResponse {
  ok: boolean;
  propertyId: string;
  bookingId: string | null;
  token: string;
  property: PropertyData;
}
```

**Edge Functions retournent :**
```typescript
// Différents formats selon la fonction
{ property, booking }           // resolve-guest-link
{ success: boolean, ... }       // submit-guest-info
{ success: boolean, ... }       // save-contract-signature
```

## 🎯 **PLAN DE COORDINATION**

### Phase 1: Standardisation des Interfaces

#### A. Créer des Types Communs
```typescript
// types/api.ts
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface GuestLinkResponse {
  success: boolean;
  propertyId: string;
  bookingId: string | null;
  token: string;
  property: PropertyData;
  booking?: BookingData;
}
```

#### B. Standardiser les Edge Functions
- Toutes les fonctions doivent retourner le même format
- Gestion d'erreurs uniforme
- Validation des paramètres d'entrée

### Phase 2: Correction des Edge Functions

#### A. Corriger `resolve-guest-link`
```typescript
// Doit retourner le format attendu par le frontend
return {
  success: true,
  propertyId,
  bookingId: booking?.id || null,
  token,
  property,
  booking
}
```

#### B. Créer la Table Manquante
```sql
CREATE TABLE verification_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token VARCHAR(255) UNIQUE NOT NULL,
  property_id UUID REFERENCES properties(id),
  booking_id UUID REFERENCES bookings(id),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Phase 3: Simplification du Frontend

#### A. Supprimer les Contournements
- Remplacer les fallbacks par une vraie gestion d'erreurs
- Utiliser un service centralisé pour les appels API

#### B. Créer un Service API Unifié
```typescript
// services/apiService.ts
export class ApiService {
  static async resolveGuestLink(params: GuestLinkParams): Promise<GuestLinkResponse> {
    // Logique centralisée avec retry et fallback
  }
  
  static async submitGuestInfo(params: GuestInfoParams): Promise<ApiResponse> {
    // Logique centralisée
  }
}
```

## 🚀 **ACTIONS IMMÉDIATES**

### 1. Créer la Table Manquante
```sql
-- Exécuter dans Supabase SQL Editor
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
```

### 2. Corriger `resolve-guest-link`
- Modifier le format de retour
- Ajouter la gestion d'erreurs standardisée

### 3. Créer un Service API Unifié
- Centraliser tous les appels aux edge functions
- Standardiser la gestion d'erreurs
- Supprimer les contournements

### 4. Tests de Validation
- Tester chaque edge function individuellement
- Valider la cohérence des données
- Vérifier la gestion d'erreurs

## 📈 **MÉTRIQUES DE SUCCÈS**

- ✅ Toutes les edge functions retournent le même format
- ✅ Plus de contournements de fallback dans le frontend
- ✅ Gestion d'erreurs cohérente
- ✅ Tests passent pour toutes les fonctions
- ✅ Logs clairs et structurés

## 🔄 **PROCHAINES ÉTAPES**

1. **Créer la table manquante** (5 min)
2. **Corriger resolve-guest-link** (15 min)
3. **Créer le service API unifié** (30 min)
4. **Tester et valider** (15 min)
5. **Déployer les corrections** (10 min)

**Total estimé : 75 minutes**
