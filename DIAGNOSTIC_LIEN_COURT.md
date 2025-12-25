# 🔍 DIAGNOSTIC - Lien Court au lieu de Lien Complet

## 📋 Problème Rapporté

**Symptôme :** Le bouton "Copier le lien" génère un lien court au lieu d'un lien complet avec dates

**Attendu :**
```
https://checky.ma/guest-verification/488d5074.../xuPzZaby...?startDate=2025-12-26&endDate=2025-12-28&guests=1&airbnbCode=HM2593WSY4&guestName=ZAINEB+EL+ALAMI
```

**Obtenu :**
```
https://checky.ma/v/xuPzZaby...
```

## 🔧 Logs Ajoutés pour Diagnostic

### Fichier : `src/hooks/useGuestVerification.ts`

**Lignes 271-283 :** Logs de diagnostic ajoutés

```typescript
// ✅ DIAGNOSTIC : Logger les données reçues
console.log('🔍 [GENERATE LINK] Données reçues:', {
  hasReservationData: !!reservationData,
  reservationData: reservationData,
  airbnbBookingId: airbnbBookingId
});

// ✅ DIAGNOSTIC : Logger la détection
console.log('🔍 [GENERATE LINK] Détection type de réservation:', {
  isIndependentBooking,
  hasReservationData: !!reservationData,
  airbnbCode: reservationData?.airbnbCode,
  hasStartDate: !!reservationData?.startDate,
  hasEndDate: !!reservationData?.endDate,
  startDate: reservationData?.startDate,
  endDate: reservationData?.endDate
});
```

## 🎯 Étapes de Diagnostic

### 1. Ouvrir la Console du Navigateur
- Appuyez sur **F12**
- Allez dans l'onglet **Console**

### 2. Cliquer sur "Copier le lien"
- Depuis une réservation Airbnb dans le calendrier
- Ou depuis le modal de détails d'une réservation

### 3. Chercher les Logs
Vous devriez voir :
```
🔍 [GENERATE LINK] Données reçues: { ... }
🔍 [GENERATE LINK] Détection type de réservation: { ... }
```

### 4. Analyser les Valeurs

**Si `isIndependentBooking = true` (PROBLÈME) :**
- Vérifier `hasReservationData` → devrait être `true`
- Vérifier `airbnbCode` → ne devrait PAS être `'INDEPENDENT_BOOKING'`
- Vérifier `hasStartDate` → devrait être `true`
- Vérifier `hasEndDate` → devrait être `true`

**Si `isIndependentBooking = false` (CORRECT) :**
- Vous devriez voir `✅ [GENERATE LINK] Génération lien ICS/AIRBNB avec dates`
- Le lien devrait être complet

## 🔍 Causes Possibles

### Cause 1 : `reservationData` est `undefined`
**Symptôme :** `hasReservationData: false`

**Solution :** Vérifier que `UnifiedBookingModal` envoie bien `reservationData`

### Cause 2 : `airbnbCode === 'INDEPENDENT_BOOKING'`
**Symptôme :** `airbnbCode: "INDEPENDENT_BOOKING"`

**Solution :** Vérifier que le code Airbnb réel est passé (ex: `HM2593WSY4`)

### Cause 3 : `startDate` ou `endDate` manquant
**Symptôme :** `hasStartDate: false` ou `hasEndDate: false`

**Solution :** Vérifier que les dates sont bien passées depuis `UnifiedBookingModal`

### Cause 4 : `startDate`/`endDate` sont des chaînes vides
**Symptôme :** `startDate: ""` ou `endDate: ""`

**Solution :** Vérifier le parsing des dates dans `UnifiedBookingModal`

## 📝 Informations à Fournir

Pour résoudre le problème, envoyez-moi :

1. **Les logs complets** de `🔍 [GENERATE LINK]`
2. **Le type de réservation** (Airbnb, manuelle, ICS)
3. **D'où vous cliquez** (calendrier, modal, dashboard)

## 🛠️ Solution Temporaire

En attendant le diagnostic, vous pouvez utiliser le **lien court** :
- Il redirige vers la même page
- Les dates seront récupérées depuis le token en base de données
- Le guest verra quand même les dates pré-remplies

**Mais** : Le lien court ne contient pas les paramètres visibles dans l'URL, ce qui est moins pratique pour le débogage.

---

**En attente des logs pour diagnostic précis ! 🔍**
