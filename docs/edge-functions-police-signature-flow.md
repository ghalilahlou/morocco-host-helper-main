# Flux des Edge Functions – Fiche de police et signature

## 1. Edge Functions appelées par le FRONTEND

### Fiche de police (génération / régénération)
| Edge Function | Appel direct frontend ? | Fichiers concernés |
|---------------|-------------------------|---------------------|
| **generate-police-form** | **OUI** | `BookingWizard.tsx` (L779), `unifiedDocumentService.ts` (L341), `DocumentsViewer.tsx` (L1087), `DocumentPreview.tsx` (L371), `BookingDetailsModal.tsx` (L166) |

→ **C’est la seule Edge Function “police” appelée par le frontend.** C’est donc celle à modifier pour que la signature apparaisse dans la fiche de police.

### Signature du contrat
| Edge Function | Appel direct frontend ? | Fichiers concernés |
|---------------|-------------------------|---------------------|
| **save-contract-signature** | **OUI** | `WelcomingContractSignature.tsx` (via `ApiService.saveContractSignature`), `ContractSignature.tsx` (L379), `apiService.ts` (L257) |

→ Le frontend envoie la signature (data URL) à **save-contract-signature** uniquement. Il n’appelle jamais **regenerate-police-with-signature** ni **generate-police-forms**.

---

## 2. Chaîne côté backend (après signature)

1. **Frontend** appelle `save-contract-signature` avec `{ bookingId, signerName, signatureDataUrl }`.
2. **save-contract-signature** :
   - enregistre la signature dans `contract_signatures`;
   - appelle en interne **regenerate-police-with-signature** avec `{ action: 'regenerate_police_with_signature', bookingId }`.
3. **regenerate-police-with-signature** :
   - lit la signature dans `contract_signatures`;
   - appelle **generate-police-form** avec `{ bookingId }`.
4. **generate-police-form** :
   - relit la signature dans `contract_signatures`;
   - génère le PDF avec la signature;
   - upload en Storage et met à jour `documents_generated.policeUrl` sur le booking.

---

## 3. Config `runtime.ts`

- `generatePoliceForms` pointe vers **generate-police-forms** (pluriel).
- Aucun appel frontend n’utilise cette URL pour la police : tous passent par `supabase.functions.invoke('generate-police-form', ...)`.
- Donc en pratique, la fonction utilisée pour la police est **generate-police-form** (singulier).

---

## 4. Conclusion

- **Fonction à modifier pour que la signature soit dans la fiche de police :**  
  **generate-police-form**  
  (récupération de la signature depuis `contract_signatures` + intégration dans le PDF).
- **save-contract-signature** et **regenerate-police-with-signature** déclenchent la régénération après signature ; la logique d’affichage de la signature dans le PDF reste dans **generate-police-form**.
