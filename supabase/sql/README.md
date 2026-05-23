# Scripts SQL one-shot

Scripts exécutés manuellement via le SQL Editor Supabase.  
**Ne pas exécuter en production sans vérification préalable.**

## Index

| Fichier | Objet | Statut |
|---|---|---|
| `EXECUTER_SQL_EDITOR_phase2_et_3.sql` | Phases 2 et 3 du plan chirurgical tokens/noms | À appliquer |
| `EXECUTER_SQL_EDITOR_v2_corrige.sql` | Version corrigée v2 du plan chirurgical | À appliquer |
| `audit_contract_guest_names.sql` | Audit noms guests vs contrats | Audit |
| `audit_multi_tenant.sql` | Audit isolation multi-hôte | Audit |
| `contraintes_isolation_hote.sql` | Contraintes RLS isolation hôte | À appliquer |
| `diagnostic_guest_links.sql` | Diagnostic liens invités orphelins | Audit |
| `fix_date_conflicts_audit.sql` | Audit conflits de dates | Audit |
| `fix_magno_tokens_and_july_stay.sql` | Correction tokens Magno + séjour juillet | ✅ Appliqué |
| `fix_saima_sakara_apply.sql` | Correction séjour Saima/Sakara | ✅ Appliqué |
| `fix_saima_sakara_dates.sql` | Correction dates Saima/Sakara | ✅ Appliqué |
| `fix_shared_tokens_deactivate.sql` | Désactivation tokens partagés (1 token = N bookings) | ✅ Appliqué |
| `prevention_guest_name_sync_trigger.sql` | Trigger sync guest_name bookings | À appliquer |
| `restitution_bloc_D_ready_to_paste.sql` | Restitution bloc D (guests fantômes) | À appliquer |
| `restitution_contrats_v1.sql` | Restitution contrats v1 | Audit |
| `rls_step5_property_verification_tokens.sql` | RLS property_verification_tokens | À appliquer |
| `storage_hardening_step4.sql` | Sécurisation Storage étape 4 | À appliquer |

## Convention pour les futurs scripts

```
supabase/sql/YYYY-MM-DD_description_courte.sql
```

Ajouter dans ce README : objet, statut (À appliquer / ✅ Appliqué / Audit), date d'exécution.
