# 🔍 DIAGNOSTIC - Nom de la Propriété dans le Récapitulatif

## 🎯 Problème

Le récapitulatif affiche "Propriété" deux fois au lieu d'afficher le vrai nom de la propriété (ex: "studio casa").

## ✅ Code Vérifié

### 1. Affichage dans le Récapitulatif

**Fichier**: `src/components/WelcomingContractSignature.tsx`

**Ligne 1011**: Le code utilise bien la variable

```typescript
<p style={{ 
  fontFamily: 'SF Pro, sans-serif',
  fontWeight: 400,
  fontSize: '14px',
  lineHeight: '17px',
  color: '#717171'
}}>{propertyName || 'Votre hébergement'}</p>
```

✅ **Le code est correct** - il utilise bien `{propertyName}`

### 2. Définition de propertyName

**Ligne 229**: La variable est bien définie

```typescript
const propertyName = propertyData?.name || bookingData?.property?.name || 'Notre magnifique propriété';
```

✅ **Le code est correct** - il récupère bien `propertyData?.name`

### 3. Passage de propertyData

**Fichier**: `src/pages/ContractSigning.tsx`

**Ligne 741**: propertyData est bien passé en props

```typescript
<WelcomingContractSignature
  bookingData={submissionData.booking_data}
  propertyData={propertyData}  // ✅ Passé en props
  guestData={submissionData.guest_data || submissionData.guestData}
  ...
/>
```

✅ **Le code est correct** - propertyData est bien passé

## 🔍 Diagnostic à Faire

### Étape 1: Vérifier les Logs

**Ouvrez la console du navigateur** et cherchez ces logs:

#### Log 1: PropertyData récupéré
```
🏠 [CONTRACT SIGNING] PropertyData récupéré: {
  propertyData: { ... },
  propertyName: "???",  // ← Quelle valeur?
  propertyId: "..."
}
```

#### Log 2: Nom de la propriété
```
🏠 [RÉCAPITULATIF] Nom de la propriété: {
  propertyDataName: "???",  // ← Quelle valeur?
  bookingPropertyName: "???",  // ← Quelle valeur?
  finalPropertyName: "???"  // ← Quelle valeur?
}
```

### Étape 2: Analyser les Résultats

#### Cas 1: propertyName est "studio casa"

Si les logs montrent:
```
propertyDataName: "studio casa"
finalPropertyName: "studio casa"
```

**Problème**: Le cache du navigateur affiche l'ancienne version

**Solution**: 
1. **Hard Refresh**: `Ctrl + Shift + R` (Windows) ou `Cmd + Shift + R` (Mac)
2. Vider le cache du navigateur
3. Recharger la page

#### Cas 2: propertyName est undefined ou null

Si les logs montrent:
```
propertyDataName: undefined
bookingPropertyName: undefined
finalPropertyName: "Notre magnifique propriété"
```

**Problème**: `propertyData` ne contient pas de `name`

**Solution**: Vérifier la base de données

```sql
SELECT id, name 
FROM properties 
WHERE id = 'VOTRE_PROPERTY_ID';
```

Si `name` est NULL ou vide, mettre à jour:

```sql
UPDATE properties 
SET name = 'studio casa'
WHERE id = 'VOTRE_PROPERTY_ID';
```

#### Cas 3: propertyData est undefined

Si les logs montrent:
```
propertyData: undefined
```

**Problème**: L'API ne retourne pas les données de la property

**Solution**: Vérifier l'Edge Function `verify-guest-token`

## 📝 Actions Immédiates

### 1. Ouvrir la Console

1. Appuyez sur `F12` (Windows) ou `Cmd + Option + I` (Mac)
2. Allez dans l'onglet "Console"

### 2. Recharger la Page

1. **Hard Refresh**: `Ctrl + Shift + R`
2. Cherchez les logs `🏠 [CONTRACT SIGNING]` et `🏠 [RÉCAPITULATIF]`

### 3. Copier les Logs

Copiez-moi les logs complets pour que je puisse diagnostiquer le problème exact.

## 🎯 Résultat Attendu

**Logs attendus**:
```
🏠 [CONTRACT SIGNING] PropertyData récupéré: {
  propertyData: { id: "...", name: "studio casa", ... },
  propertyName: "studio casa",
  propertyId: "..."
}

🏠 [RÉCAPITULATIF] Nom de la propriété: {
  propertyDataName: "studio casa",
  bookingPropertyName: "studio casa",
  finalPropertyName: "studio casa"
}
```

**Récapitulatif attendu**:
```
Propriété
studio casa  ← Nom réel de la propriété
```

## 💡 Note Importante

Le fait que "studio casa" s'affiche correctement dans la section "HÉBERGEMENT" (première image) mais pas dans le "Récapitulatif" (deuxième image) suggère que:

1. **Soit** les deux sections utilisent des sources de données différentes
2. **Soit** il y a un problème de cache/refresh
3. **Soit** `propertyData` est différent entre les deux rendus

**Vérifiez les logs pour confirmer!** 🔍
