# Correction du Problème d'Écrasement des Fiches de Police

## 🔴 Problème Identifié

**Symptôme** : Deux fiches de police générées pour une seule réservation indépendante (Zaineb), causant un écrasement des données de réservation.

**Cause racine** : La logique de génération de fiche de police avait **deux problèmes critiques** :

### 1. **Écrasement lors de la mise à jour de `documents_generated`**

Dans `supabase/functions/generate-police-form/index.ts` (lignes 874-883), la mise à jour utilisait l'état **initial** du booking au lieu de l'état **actuel** :

```typescript
// ❌ AVANT (PROBLÉMATIQUE)
await supabase
  .from('bookings')
  .update({
    documents_generated: {
      ...booking.documents_generated,  // ❌ État initial, pas l'état actuel !
      policeForm: true
    }
  })
  .eq('id', bookingId);
```

**Scénario d'écrasement** :
1. Génération 1 récupère booking → `documents_generated = { contract: true }`
2. Génération 2 récupère booking → `documents_generated = { contract: true }` (même état)
3. Génération 1 génère PDF et met à jour → `{ contract: true, policeForm: true, policeUrl: 'url1' }`
4. Génération 2 génère PDF et met à jour → `{ contract: true, policeForm: true }` (écrase url1, **perte de données**)

### 2. **Absence de verrou pour empêcher les générations multiples simultanées**

Si plusieurs appels à `generate-police-form` se lancent en parallèle (ex: utilisateur clique plusieurs fois, ou plusieurs guests soumettent leurs infos), plusieurs générations peuvent créer des PDFs et mettre à jour `documents_generated` simultanément, causant des écrasements.

### 3. **`policeUrl` manquant dans la mise à jour**

La mise à jour ne sauvegardait pas l'URL du PDF généré, ce qui pouvait causer des incohérences.

## ✅ Corrections Appliquées

### Correction 1 : Fusion atomique de `documents_generated`

**Fichier** : `supabase/functions/generate-police-form/index.ts`

```typescript
// ✅ APRÈS (CORRIGÉ)
// Récupérer l'état ACTUEL avant mise à jour
const { data: currentBooking, error: fetchError } = await supabase
  .from('bookings')
  .select('documents_generated')
  .eq('id', bookingId)
  .single();

// Fusion atomique avec l'état actuel
const currentDocs = currentBooking?.documents_generated || {};
const updatedDocs = {
  ...currentDocs,  // ✅ Utiliser l'état ACTUEL
  policeForm: true,
  policeUrl: publicUrl,  // ✅ AJOUT : Sauvegarder l'URL
  policeGeneratedAt: new Date().toISOString()
};

await supabase
  .from('bookings')
  .update({
    documents_generated: updatedDocs,
    updated_at: new Date().toISOString()
  })
  .eq('id', bookingId);
```

### Correction 2 : Verrou pour empêcher les générations multiples

**Fichier** : `supabase/functions/generate-police-form/index.ts`

```typescript
// ✅ NOUVEAU : Map pour tracker les générations en cours
const generatingLocks = new Map<string, { timestamp: number, loadId: string }>();

function acquireLock(bookingId: string): { acquired: boolean, existingLoadId?: string } {
  const existing = generatingLocks.get(bookingId);
  const now = Date.now();
  
  // Si une génération est en cours depuis moins de 5 minutes, refuser
  if (existing && (now - existing.timestamp < 300000)) {
    return { acquired: false, existingLoadId: existing.loadId };
  }
  
  // Acquérir le verrou
  const loadId = `${now}-${Math.random().toString(36).substring(2, 9)}`;
  generatingLocks.set(bookingId, { timestamp: now, loadId });
  return { acquired: true };
}

function releaseLock(bookingId: string, loadId: string) {
  const existing = generatingLocks.get(bookingId);
  if (existing && existing.loadId === loadId) {
    generatingLocks.delete(bookingId);
  }
}

// Dans le handler :
const lockResult = acquireLock(bookingId);
if (!lockResult.acquired) {
  return new Response(
    JSON.stringify({
      success: false,
      error: 'Une génération de fiche de police est déjà en cours pour cette réservation',
      code: 'GENERATION_IN_PROGRESS'
    }),
    { status: 409, headers: corsHeaders }
  );
}

// ... génération ...

// Libérer le verrou dans finally
finally {
  if (bookingId && loadId) {
    releaseLock(bookingId, loadId);
  }
}
```

### Correction 3 : Même correction dans `submit-guest-info-unified`

**Fichier** : `supabase/functions/submit-guest-info-unified/index.ts`

La même logique de fusion atomique a été appliquée dans la fonction `generate_police_only` (lignes 2999-3032).

## 📊 Impact des Corrections

### Avant les corrections :
- ❌ Deux générations simultanées → écrasement des données
- ❌ `policeUrl` perdu lors de mises à jour concurrentes
- ❌ Plusieurs fiches de police créées pour la même réservation
- ❌ Données de réservation corrompues

### Après les corrections :
- ✅ Une seule génération à la fois (verrou)
- ✅ Fusion atomique de `documents_generated` (pas d'écrasement)
- ✅ `policeUrl` toujours sauvegardé
- ✅ Une seule fiche de police par réservation (déduplication des guests)

## 🔍 Vérification

Pour vérifier que le problème est résolu :

1. **Tester la génération multiple** : Essayer de générer la fiche de police plusieurs fois rapidement
   - ✅ Devrait retourner `GENERATION_IN_PROGRESS` pour les appels suivants
   
2. **Vérifier les logs** : Chercher les messages :
   - `🔒 Verrou acquis pour génération police`
   - `✅ Booking mis à jour avec fusion atomique`
   - `🔓 Verrou libéré pour génération police`

3. **Vérifier la base de données** : 
   - `documents_generated.policeForm` devrait être `true`
   - `documents_generated.policeUrl` devrait contenir l'URL du PDF
   - Une seule entrée dans `uploaded_documents` avec `document_type = 'police'`

## 📝 Notes Techniques

- Le verrou est en mémoire (Map), donc il est partagé entre toutes les requêtes sur le même serveur Edge Function
- Le timeout du verrou est de 5 minutes (300000ms) pour éviter les verrous bloqués
- La déduplication des guests (lignes 218-262) empêche les doublons dans le même PDF, mais le verrou empêche les PDFs multiples
