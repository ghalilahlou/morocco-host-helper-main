# 🔧 Correction - Documents Non Affichés dans la Réservation

## ❌ Problème Identifié

La réservation s'affiche bien dans le calendrier mais **les documents ne sont pas visibles** :
- ❌ Contrat : Non disponible
- ❌ Fiche de police : Non disponible
- ❌ Pièce d'identité : Non disponible

## 🔍 Analyse de la Cause

### Vérification 1 : Edge Function appelée ?
✅ **OUI** - Les logs montrent que l'Edge Function `submit-guest-info-unified` est bien appelée avec `action: 'host_direct'`

### Vérification 2 : Documents générés ?
✅ **OUI** - Les fonctions `generateContractInternal` et `generatePoliceFormsInternal` sont bien exécutées (lignes 3151-3159)

### Vérification 3 : Documents sauvegardés dans les tables ?
✅ **OUI** - Les documents sont sauvegardés dans :
- `generated_documents` (table principale)
- `uploaded_documents` (compatibilité interface host)

### Vérification 4 : Champ `documents_generated` mis à jour dans `bookings` ?
❌ **NON** - **C'EST LE PROBLÈME !**

La fonction `updateFinalStatus` (ligne 1979) ne mettait **PAS À JOUR** le champ `documents_generated` dans la table `bookings`. Elle mettait uniquement à jour le `status`.

### Conséquence

Le front-end affiche les documents à partir du champ `documents_generated` de la table `bookings`. Si ce champ n'est pas rempli avec les URLs des documents, ils apparaissent comme "Non disponible".

```typescript
// Ancien code de updateFinalStatus (ligne 2000-2008)
const updateData = {
  status: hasSignature ? 'completed' : 'pending',
  updated_at: new Date().toISOString()
  // ❌ MANQUANT : documents_generated avec les URLs !
};
```

## ✅ Solution Appliquée

### Modification 1 : Mise à jour de `updateFinalStatus`

**Fichier** : `supabase/functions/submit-guest-info-unified/index.ts`

**Ligne** : 1979-2050

**Changements** :

1. **Récupération de `documents_generated` existant** :
```typescript
const { data: existingBooking } = await supabase
  .from('bookings')
  .select('documents_generated')
  .eq('id', bookingId)
  .single();

const currentDocumentsGenerated = existingBooking?.documents_generated || {};
```

2. **Construction du nouvel objet `documents_generated` avec les URLs** :
```typescript
const documentsGenerated = {
  ...currentDocumentsGenerated,
  contract: !!contractUrl,
  policeForm: !!policeUrl,
  identity: !!identityUrl,
  contractUrl: contractUrl || currentDocumentsGenerated.contractUrl,
  policeUrl: policeUrl || currentDocumentsGenerated.policeUrl,
  identityUrl: identityUrl || currentDocumentsGenerated.identityUrl,
  generatedAt: new Date().toISOString()
};
```

3. **Mise à jour de la table `bookings` avec `documents_generated`** :
```typescript
const updateData = {
  status: hasSignature ? 'completed' : 'pending',
  documents_generated: documentsGenerated,  // ✅ AJOUTÉ
  updated_at: new Date().toISOString()
};
```

4. **Ajout du paramètre `identityUrl`** :
```typescript
async function updateFinalStatus(
  bookingId: string,
  contractUrl: string,
  policeUrl: string,
  identityUrl: string,  // ✅ AJOUTÉ
  emailSent: boolean,
  hasSignature: boolean,
  processingTime: number
): Promise<void>
```

### Modification 2 : Récupération de l'URL du document d'identité pour `host_direct`

**Ligne** : 3123-3145

**Changement** :

Pour les réservations créées par le host (`action: 'host_direct'`), les documents d'identité sont déjà uploadés par le front-end. Il faut récupérer leur URL depuis la table `uploaded_documents` :

```typescript
if (requestBody.action === 'host_direct') {
  log('info', '🔄 [HOST_DIRECT] Skipping saveGuestDataInternal - guests et documents déjà créés par le front-end');
  log('info', '🔄 [HOST_DIRECT] BookingId déjà défini:', { bookingId });
  
  // ✅ Récupérer les URLs des documents d'identité déjà uploadés
  const supabase = await getServerClient();
  const { data: uploadedDocs } = await supabase
    .from('uploaded_documents')
    .select('document_url, document_type')
    .eq('booking_id', bookingId)
    .eq('document_type', 'identity');
  
  if (uploadedDocs && uploadedDocs.length > 0) {
    identityUrl = uploadedDocs[0].document_url;
    log('info', '📄 [HOST_DIRECT] Document d\'identité récupéré', { identityUrl });
  }
}
```

### Modification 3 : Passage de `identityUrl` à `updateFinalStatus`

**Ligne** : 3227

**Changement** :

```typescript
await updateFinalStatus(
  bookingId,
  contractUrl,
  policeUrl,
  identityUrl,  // ✅ AJOUTÉ
  emailSent,
  !!requestBody.signature,
  processingTime
);
```

## 📊 Structure du Champ `documents_generated`

Après ces modifications, le champ `documents_generated` dans la table `bookings` contiendra :

```json
{
  "contract": true,
  "policeForm": true,
  "identity": true,
  "contractUrl": "https://[...].supabase.co/storage/v1/object/public/contracts/contract-[...].pdf",
  "policeUrl": "https://[...].supabase.co/storage/v1/object/public/police-forms/police-[...].pdf",
  "identityUrl": "https://[...].supabase.co/storage/v1/object/public/identity-documents/identity-[...].jpg",
  "generatedAt": "2025-11-24T14:30:00.000Z"
}
```

## 🧪 Tests à Effectuer

### 1. Déployer la fonction Edge
```bash
supabase functions deploy submit-guest-info-unified
```

### 2. Créer une nouvelle réservation
1. Aller sur une propriété
2. Cliquer sur "Nouvelle réservation"
3. Remplir les dates et nombre de guests
4. Uploader un document d'identité
5. Cliquer sur "Créer la réservation"

### 3. Vérifier les logs dans Supabase
Chercher ces logs dans l'ordre :
```
✅ Validation réussie pour host_direct
🎯 ÉTAPE 1/5: Résolution de la réservation
Action host_direct détectée
Réservation host_direct récupérée avec succès
🎯 ÉTAPE 2/5: Sauvegarde des données invité
🔄 [HOST_DIRECT] Skipping saveGuestDataInternal
📄 [HOST_DIRECT] Document d'identité récupéré
🎯 ÉTAPE 3-5/5: Génération des documents en parallèle
✅ Documents générés
🎯 Finalisation du traitement
📝 Mise à jour documents_generated
✅ Statut final et documents_generated mis à jour avec succès
```

### 4. Vérifier dans le front-end
1. Ouvrir la réservation créée
2. Aller dans la section "Documents enregistrés"
3. **Vérifier** :
   - ✅ Contrat signé : **Doit être cliquable** (ou afficher "Générer" si pas encore généré)
   - ✅ Fiche de police : **Doit être cliquable**
   - ✅ Document d'identité : **Doit afficher l'image uploadée**

### 5. Vérifier directement dans la base de données

```sql
SELECT 
  id,
  booking_reference,
  documents_generated
FROM bookings
WHERE id = '[ID_DE_LA_RESERVATION]';
```

Le champ `documents_generated` doit contenir les URLs et les flags `contract: true`, `policeForm: true`, `identity: true`.

## 🎯 Résultat Attendu

Après déploiement et test :
- ✅ La réservation s'affiche dans le calendrier
- ✅ Le contrat est disponible et téléchargeable
- ✅ La fiche de police est disponible et téléchargeable  
- ✅ Le document d'identité est visible
- ✅ Le champ `documents_generated` dans `bookings` contient toutes les URLs

## 📝 Notes Importantes

1. **Contrat non signé** : C'est normal pour les réservations créées par le host. Le contrat est généré pour être signé physiquement par le guest.

2. **Déploiement requis** : Ces modifications sont dans l'Edge Function, il faut donc déployer :
   ```bash
   supabase functions deploy submit-guest-info-unified
   ```

3. **Réservations existantes** : Les réservations créées avant cette correction n'auront pas les URLs dans `documents_generated`. Il faudrait soit :
   - Les recréer
   - Ou exécuter un script de migration pour récupérer les URLs depuis `generated_documents` et les copier dans `documents_generated`

4. **Compatibilité** : Les documents sont sauvegardés dans :
   - `generated_documents` : Table principale pour tous les documents générés
   - `uploaded_documents` : Table pour les documents uploadés + compatibilité interface host
   - `bookings.documents_generated` : Champ JSON pour l'affichage rapide dans l'interface

