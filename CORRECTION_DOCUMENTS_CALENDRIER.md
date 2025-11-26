# 🔧 Correction - Génération des Documents dans le Calendrier

## ❌ Problème Identifié

Lors de la création d'une nouvelle réservation via "Nouvelle réservation", les documents (contrat et fiche de police) ne sont pas générés automatiquement. De plus, il n'est pas possible de les générer à la demande depuis la vue calendrier, contrairement à la vue "Cartes" où les boutons "Générer" fonctionnent correctement.

## 🔍 Analyse de la Situation

### Vue "Cartes" (BookingCard.tsx)
- ✅ Affiche les boutons "Générer" pour le contrat et la fiche de police
- ✅ Appelle `submit-guest-info-unified` avec les actions :
  - `generate_police_only` pour la fiche de police
  - Les fonctions de génération sont fonctionnelles

### Vue "Calendrier" (UnifiedBookingModal.tsx)
- ❌ N'affichait PAS les boutons "Générer" pour les réservations en attente (`status: 'pending'`)
- ❌ Les documents n'étaient affichés que pour les réservations terminées (`status: 'completed'`)
- ⚠️ Les fonctions `handleGenerateContract` et `handleGeneratePolice` existent déjà mais ne sont pas utilisées pour les réservations `pending`

## ✅ Solution Appliquée

### Modification de `UnifiedBookingModal.tsx`

**Fichier** : `src/components/UnifiedBookingModal.tsx`

**Lignes modifiées** : 749-850

#### Changement 1 : Affichage de la section "Documents enregistrés" pour les réservations `pending`

**Avant** :
```typescript
{/* ✅ DOCUMENTS : Section pour les réservations terminées */}
{status === 'completed' && !isAirbnb && (
  <Card>
    <CardHeader>
      <CardTitle className="text-lg flex items-center gap-2">
        <FileText className="w-5 h-5 text-brand-teal" />
        Documents enregistrés
      </CardTitle>
    </CardHeader>
```

**Après** :
```typescript
{/* ✅ DOCUMENTS : Section pour les réservations terminées ET pending (nouvelles réservations host) */}
{(status === 'completed' || status === 'pending') && !isAirbnb && (
  <Card>
    <CardHeader>
      <CardTitle className="text-lg flex items-center gap-2">
        <FileText className="w-5 h-5 text-brand-teal" />
        Documents enregistrés
      </CardTitle>
    </CardHeader>
```

#### Changement 2 : Ajout des boutons "Générer" pour les documents manquants

**Pour le Contrat** :

**Avant** :
```typescript
{documents.contractUrl ? (
  <div className="flex gap-2">
    <Button>Voir</Button>
    <Button>Télécharger</Button>
  </div>
) : (
  <span className="text-sm text-gray-400">Non disponible</span>
)}
```

**Après** :
```typescript
{documents.contractUrl ? (
  <div className="flex gap-2">
    <Button onClick={() => window.open(documents.contractUrl!, '_blank')}>
      Voir
    </Button>
    <Button onClick={() => {/* télécharger */}}>
      Télécharger
    </Button>
  </div>
) : (
  <Button
    onClick={handleGenerateContract}
    disabled={isGeneratingContract}
  >
    {isGeneratingContract ? 'Génération...' : 'Générer'}
  </Button>
)}
```

**Pour la Fiche de Police** :

**Avant** :
```typescript
{documents.policeUrl ? (
  <div className="flex gap-2">
    <Button>Voir</Button>
    <Button>Télécharger</Button>
  </div>
) : (
  <span className="text-sm text-gray-400">Non disponible</span>
)}
```

**Après** :
```typescript
{documents.policeUrl ? (
  <div className="flex gap-2">
    <Button onClick={() => window.open(documents.policeUrl!, '_blank')}>
      Voir
    </Button>
    <Button onClick={() => {/* télécharger */}}>
      Télécharger
    </Button>
  </div>
) : (
  <Button
    onClick={handleGeneratePolice}
    disabled={isGeneratingPolice}
  >
    {isGeneratingPolice ? 'Génération...' : 'Générer'}
  </Button>
)}
```

#### Changement 3 : Adaptation des textes selon le statut

**Pour le Contrat** :
```typescript
<p className="font-semibold text-gray-900">
  Contrat {status === 'completed' ? 'signé' : ''}
</p>
<p className="text-sm text-gray-600">
  Document contractuel {status === 'completed' ? 'signé' : 'à signer physiquement'}
</p>
```

Cela indique clairement que :
- Si `completed` : "Contrat signé" (signé électroniquement par le guest)
- Si `pending` : "Contrat" (à signer physiquement par le guest)

#### Changement 4 : Suppression de la section dupliquée

Il y avait une section "Générer les documents" séparée pour les réservations `pending` (lignes 586-747). Cette section a été supprimée car elle faisait doublon avec la logique fusionnée dans "Documents enregistrés".

## 📊 Workflow de Génération

### 1. Création d'une Nouvelle Réservation

```
Host crée une réservation
  → Wizard : Dates, Guests, Documents d'identité
  → Soumission : Création booking + guests + documents
  → Edge Function : action='host_direct'
    ⚠️ Documents générés MAIS pas sauvegardés dans documents_generated
  → Réservation créée avec status='pending'
```

### 2. Affichage dans le Calendrier

```
Host clique sur la réservation dans le calendrier
  → UnifiedBookingModal s'ouvre
  → Charge les documents depuis uploaded_documents
  → Si documents manquants :
    → Affiche bouton "Générer" pour contrat
    → Affiche bouton "Générer" pour fiche de police
```

### 3. Génération à la Demande

```
Host clique sur "Générer" (contrat ou police)
  → handleGenerateContract() ou handleGeneratePolice()
  → Appelle submit-guest-info-unified avec:
    - action='generate_contract_only' OU 'generate_police_only'
    - bookingId
  → Edge Function génère le document
  → Document sauvegardé dans uploaded_documents ET generated_documents
  → documents_generated mis à jour dans la table bookings
  → Interface rafraîchie, document disponible
```

## 🧪 Tests à Effectuer

### Test 1 : Vérifier l'affichage pour une nouvelle réservation `pending`

1. Créer une nouvelle réservation via "Nouvelle réservation"
2. Aller dans le calendrier
3. Cliquer sur la réservation créée
4. **Vérifier** : La section "Documents enregistrés" est visible
5. **Vérifier** : Les boutons "Générer" sont présents pour le contrat et la police

### Test 2 : Générer le contrat à la demande

1. Dans le modal de la réservation, cliquer sur "Générer" pour le contrat
2. **Vérifier** : Le bouton affiche "Génération..."
3. **Vérifier** : Après quelques secondes, le bouton "Générer" devient "Voir" + "Télécharger"
4. **Vérifier** : Cliquer sur "Voir" ouvre le PDF du contrat dans un nouvel onglet
5. **Vérifier** : Le contrat contient les bonnes informations (dates, guest, propriété)

### Test 3 : Générer la fiche de police à la demande

1. Dans le même modal, cliquer sur "Générer" pour la fiche de police
2. **Vérifier** : Le bouton affiche "Génération..."
3. **Vérifier** : Après quelques secondes, le bouton "Générer" devient "Voir" + "Télécharger"
4. **Vérifier** : Cliquer sur "Voir" ouvre le PDF de la fiche de police
5. **Vérifier** : La fiche de police contient les bonnes informations du guest

### Test 4 : Vérifier la persistance

1. Fermer le modal
2. Actualiser la page
3. Rouvrir le modal de la réservation
4. **Vérifier** : Les documents précédemment générés sont toujours disponibles
5. **Vérifier** : Les boutons "Voir" et "Télécharger" sont affichés (pas "Générer")

### Test 5 : Vérifier pour une réservation `completed`

1. Trouver une réservation avec `status='completed'` dans le calendrier
2. Cliquer dessus pour ouvrir le modal
3. **Vérifier** : La section "Documents enregistrés" est visible
4. **Vérifier** : Le texte affiche "Contrat signé" (et non juste "Contrat")
5. **Vérifier** : Si documents présents, boutons "Voir" et "Télécharger" sont affichés
6. **Vérifier** : Si documents absents, boutons "Générer" sont affichés

## 🎯 Résultat Attendu

Après ces modifications :

| Vue | Statut | Contrat | Police | Identité |
|-----|--------|---------|--------|----------|
| Cartes | completed | ✅ Voir/Télécharger ou Générer | ✅ Voir/Télécharger ou Générer | ✅ Affichée |
| Cartes | pending | ✅ Voir/Télécharger ou Générer | ✅ Voir/Télécharger ou Générer | ✅ Affichée |
| Calendrier | completed | ✅ Voir/Télécharger ou Générer | ✅ Voir/Télécharger ou Générer | ✅ Affichée |
| Calendrier | pending | ✅ Voir/Télécharger ou Générer | ✅ Voir/Télécharger ou Générer | ✅ Affichée |

**Comportement unifié** : Que ce soit dans la vue Cartes ou la vue Calendrier, le host peut toujours générer les documents à la demande en cliquant sur "Générer".

## 📝 Notes Importantes

1. **Contrat non signé pour `pending`** : C'est normal. Ces réservations sont créées par le host pour être signées physiquement par le guest.

2. **Edge Function `updateFinalStatus`** : La correction précédente (CORRECTION_DOCUMENTS_GENERATED.md) doit être déployée pour que `documents_generated` soit correctement mis à jour avec les URLs.

3. **Déploiement Edge Function** : Si ce n'est pas encore fait, déployer :
   ```bash
   supabase functions deploy submit-guest-info-unified
   ```

4. **Actions supportées** par `submit-guest-info-unified` :
   - `host_direct` : Création de réservation par le host (appelé automatiquement)
   - `generate_contract_only` : Génération du contrat uniquement (appelé par le bouton "Générer")
   - `generate_police_only` : Génération de la fiche de police uniquement (appelé par le bouton "Générer")
   - `generate_all_documents` : Génération de tous les documents (non utilisé actuellement)

5. **Rafraîchissement automatique** : Après la génération, `refreshBookings()` est appelé pour recharger les données et mettre à jour l'interface.

## 🔗 Fichiers Modifiés

- ✅ `src/components/UnifiedBookingModal.tsx` : Ajout des boutons "Générer" pour les réservations `pending`
- ✅ `supabase/functions/submit-guest-info-unified/index.ts` : Correction de `updateFinalStatus` (déjà fait dans CORRECTION_DOCUMENTS_GENERATED.md)

## 🚀 Prochaine Étape

**Tester immédiatement** la génération des documents dans le calendrier pour une nouvelle réservation !

