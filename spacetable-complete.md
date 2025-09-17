# Structure Complète de la Base de Données - Morocco Host Helper

## Vue d'ensemble

Cette documentation détaille la structure complète de la base de données Supabase pour l'application Morocco Host Helper, basée sur le schéma réel de la base de données.

## Tables Principales

### 1. Table `properties`
**Description**: Stocke les informations des propriétés disponibles à la location.

| Colonne | Type | Description | Relations |
|---------|------|-------------|-----------|
| `id` | PK | Identifiant unique de la propriété | - |
| `name` | TEXT | Nom de la propriété | - |
| `address` | TEXT | Adresse de la propriété | - |
| `contact_info` | JSONB | Informations de contact | - |
| `user_id` | FK | Propriétaire de la propriété | → `auth.users.id` |
| `property_type` | TEXT | Type de propriété (défaut: 'apartment') | - |
| `max_occupancy` | INTEGER | Capacité maximale (défaut: 4) | - |
| `description` | TEXT | Description de la propriété | - |
| `house_rules` | JSONB | Règles de la maison | - |
| `contract_template` | JSONB | Modèle de contrat | - |
| `airbnb_ics_url` | TEXT | URL du calendrier Airbnb | - |
| `photo_url` | TEXT | URL de la photo | - |
| `remaining_actions_hidden` | BOOLEAN | Actions restantes cachées | - |
| `city` | TEXT | Ville | - |
| `country` | TEXT | Pays (défaut: 'Maroc') | - |
| `price_per_night` | NUMERIC | Prix par nuit | - |
| `max_guests` | INTEGER | Nombre maximum d'invités | - |
| `created_at` | TIMESTAMP | Date de création | - |
| `updated_at` | TIMESTAMP | Date de mise à jour | - |

### 2. Table `bookings`
**Description**: Gère les réservations des propriétés.

| Colonne | Type | Description | Relations |
|---------|------|-------------|-----------|
| `id` | PK | Identifiant unique de la réservation | - |
| `property_id` | FK | Propriété réservée | → `properties.id` |
| `check_in_date` | DATE | Date d'arrivée | - |
| `check_out_date` | DATE | Date de départ | - |
| `number_of_guests` | INTEGER | Nombre d'invités | - |
| `booking_reference` | TEXT | Référence de réservation | - |
| `status` | ENUM | Statut de la réservation | - |
| `documents_generated` | JSONB | Documents générés | - |
| `user_id` | FK | Utilisateur | → `auth.users.id` |
| `signed_contract_url` | TEXT | URL du contrat signé | - |
| `submission_id` | UUID | ID de soumission | - |
| `guest_name` | TEXT | Nom de l'invité | - |
| `guest_email` | TEXT | Email de l'invité | - |
| `guest_phone` | TEXT | Téléphone de l'invité | - |
| `total_price` | NUMERIC | Prix total | - |
| `notes` | TEXT | Notes | - |
| `documents_status` | JSONB | Statut des documents | - |
| `total_amount` | NUMERIC | Montant total | - |
| `created_at` | TIMESTAMP | Date de création | - |
| `updated_at` | TIMESTAMP | Date de mise à jour | - |

### 3. Table `guests`
**Description**: Informations des invités.

| Colonne | Type | Description | Relations |
|---------|------|-------------|-----------|
| `id` | PK | Identifiant unique de l'invité | - |
| `booking_id` | FK | Réservation associée | → `bookings.id` |
| `nationality` | TEXT | Nationalité | - |
| `document_type` | ENUM | Type de document | - |
| `full_name` | TEXT | Nom complet | - |
| `document_number` | TEXT | Numéro de document | - |
| `date_of_birth` | DATE | Date de naissance | - |
| `place_of_birth` | TEXT | Lieu de naissance | - |
| `created_at` | TIMESTAMP | Date de création | - |
| `updated_at` | TIMESTAMP | Date de mise à jour | - |

## Tables de Gestion des Documents

### 4. Table `uploaded_documents`
**Description**: Documents uploadés par les invités.

| Colonne | Type | Description | Relations |
|---------|------|-------------|-----------|
| `id` | PK | Identifiant unique | - |
| `booking_id` | FK | Réservation associée | → `bookings.id` |
| `guest_id` | FK | Invité qui a uploadé | → `guests.id` |
| `file_name` | TEXT | Nom du fichier | - |
| `file_path` | TEXT | Chemin du fichier | - |
| `processing_status` | TEXT | Statut de traitement | - |
| `extracted_data` | JSONB | Données extraites | - |
| `document_url` | TEXT | URL du document | - |
| `contract_url` | TEXT | URL du contrat | - |
| `police_form_url` | TEXT | URL du formulaire de police | - |
| `document_type` | TEXT | Type de document | - |
| `is_signed` | BOOLEAN | Document signé | - |
| `signature_data` | TEXT | Données de signature | - |
| `signed_at` | TIMESTAMP | Date de signature | - |
| `created_at` | TIMESTAMP | Date de création | - |
| `updated_at` | TIMESTAMP | Date de mise à jour | - |

### 5. Table `generated_documents`
**Description**: Documents générés pour les réservations.

| Colonne | Type | Description | Relations |
|---------|------|-------------|-----------|
| `id` | PK | Identifiant unique du document | - |
| `booking_id` | FK | Réservation associée | → `bookings.id` |
| `document_type` | VARCHAR | Type de document | - |
| `file_name` | VARCHAR | Nom du fichier | - |
| `file_path` | VARCHAR | Chemin du fichier | - |
| `document_url` | TEXT | URL du document | - |
| `is_signed` | BOOLEAN | Document signé | - |
| `signature_id` | FK | ID de signature | → `contract_signatures.id` |
| `created_at` | TIMESTAMP | Date de création | - |
| `updated_at` | TIMESTAMP | Date de mise à jour | - |

### 6. Table `contract_signatures`
**Description**: Signatures des contrats.

| Colonne | Type | Description | Relations |
|---------|------|-------------|-----------|
| `id` | PK | Identifiant unique de la signature | - |
| `booking_id` | FK | Réservation associée | → `bookings.id` |
| `signature_data` | TEXT | Données de signature | - |
| `contract_content` | TEXT | Contenu du contrat | - |
| `signed_at` | TIMESTAMP | Date de signature | - |
| `signer_name` | TEXT | Nom du signataire | - |
| `signer_email` | TEXT | Email du signataire | - |
| `signer_phone` | TEXT | Téléphone du signataire | - |
| `created_at` | TIMESTAMP | Date de création | - |
| `updated_at` | TIMESTAMP | Date de mise à jour | - |

### 7. Table `guest_submissions`
**Description**: Soumissions des invités (formulaires, signatures).

| Colonne | Type | Description | Relations |
|---------|------|-------------|-----------|
| `id` | PK | Identifiant unique | - |
| `token_id` | FK | Token de vérification | → `property_verification_tokens.id` |
| `booking_id` | FK | Réservation associée | → `bookings.id` |
| `booking_data` | JSONB | Données de réservation | - |
| `guest_data` | JSONB | Données des invités | - |
| `document_urls` | JSONB | URLs des documents | - |
| `signature_data` | TEXT | Données de signature | - |
| `submitted_at` | TIMESTAMP | Date de soumission | - |
| `status` | TEXT | Statut de la soumission | - |
| `reviewed_by` | UUID | Utilisateur qui a révisé | → `auth.users.id` |
| `reviewed_at` | TIMESTAMP | Date de révision | - |
| `created_at` | TIMESTAMP | Date de création | - |
| `updated_at` | TIMESTAMP | Date de mise à jour | - |

## Tables de Gestion des Tokens

### 8. Table `property_verification_tokens`
**Description**: Tokens de vérification pour les propriétés.

| Colonne | Type | Description | Relations |
|---------|------|-------------|-----------|
| `id` | PK | Identifiant unique | - |
| `property_id` | FK | Propriété concernée | → `properties.id` |
| `token` | TEXT | Token unique | - |
| `is_active` | BOOLEAN | Token actif | - |
| `booking_id` | TEXT | ID de réservation | - |
| `created_at` | TIMESTAMP | Date de création | - |
| `updated_at` | TIMESTAMP | Date de mise à jour | - |

### 9. Table `guest_verification_tokens`
**Description**: Tokens de vérification pour les invités.

| Colonne | Type | Description | Relations |
|---------|------|-------------|-----------|
| `id` | PK | Identifiant unique | - |
| `booking_id` | FK | Réservation associée | → `bookings.id` |
| `token` | TEXT | Token unique | - |
| `expires_at` | TIMESTAMP | Date d'expiration | - |
| `is_active` | BOOLEAN | Token actif | - |
| `created_at` | TIMESTAMP | Date de création | - |
| `updated_at` | TIMESTAMP | Date de mise à jour | - |

## Tables Airbnb

### 10. Table `airbnb_reservations`
**Description**: Réservations importées depuis Airbnb.

| Colonne | Type | Description | Relations |
|---------|------|-------------|-----------|
| `id` | PK | Identifiant unique | - |
| `property_id` | FK | Propriété concernée | → `properties.id` |
| `airbnb_booking_id` | TEXT | ID de réservation Airbnb | - |
| `summary` | TEXT | Résumé | - |
| `start_date` | DATE | Date de début | - |
| `end_date` | DATE | Date de fin | - |
| `guest_name` | TEXT | Nom de l'invité | - |
| `number_of_guests` | INTEGER | Nombre d'invités | - |
| `description` | TEXT | Description | - |
| `raw_event_data` | JSONB | Données brutes de l'événement | - |
| `created_at` | TIMESTAMP | Date de création | - |
| `updated_at` | TIMESTAMP | Date de mise à jour | - |

### 11. Table `airbnb_sync_status`
**Description**: Statut de synchronisation Airbnb pour chaque propriété.

| Colonne | Type | Description | Relations |
|---------|------|-------------|-----------|
| `id` | PK | Identifiant unique | - |
| `property_id` | FK | Propriété concernée | → `properties.id` |
| `last_sync_at` | TIMESTAMP | Dernière synchronisation | - |
| `sync_status` | TEXT | Statut de synchronisation | - |
| `last_error` | TEXT | Dernière erreur | - |
| `reservations_count` | INTEGER | Nombre de réservations | - |
| `created_at` | TIMESTAMP | Date de création | - |
| `updated_at` | TIMESTAMP | Date de mise à jour | - |

## Tables d'Administration

### 12. Table `admin_users`
**Description**: Utilisateurs administrateurs.

| Colonne | Type | Description | Relations |
|---------|------|-------------|-----------|
| `id` | PK | Identifiant unique | - |
| `user_id` | FK | Utilisateur | → `auth.users.id` |
| `role` | TEXT | Rôle (admin, super_admin) | - |
| `permissions` | JSONB | Permissions | - |
| `created_by` | FK | Créé par | → `auth.users.id` |
| `is_active` | BOOLEAN | Statut actif | - |
| `email` | TEXT | Email | - |
| `full_name` | TEXT | Nom complet | - |
| `created_at` | TIMESTAMP | Date de création | - |
| `updated_at` | TIMESTAMP | Date de mise à jour | - |

### 13. Table `admin_activity_logs`
**Description**: Logs d'activité des administrateurs.

| Colonne | Type | Description | Relations |
|---------|------|-------------|-----------|
| `id` | PK | Identifiant unique | - |
| `admin_user_id` | FK | Administrateur | → `auth.users.id` |
| `action` | TEXT | Action effectuée | - |
| `resource_type` | TEXT | Type de ressource | - |
| `resource_id` | UUID | ID de la ressource | - |
| `details` | JSONB | Détails | - |
| `ip_address` | INET | Adresse IP | - |
| `user_agent` | TEXT | User agent | - |
| `created_at` | TIMESTAMP | Date de création | - |

### 14. Table `admin_statistics`
**Description**: Statistiques administratives.

| Colonne | Type | Description | Relations |
|---------|------|-------------|-----------|
| `id` | PK | Identifiant unique | - |
| `date` | DATE | Date (unique) | - |
| `total_users` | INTEGER | Total utilisateurs | - |
| `total_properties` | INTEGER | Total propriétés | - |
| `total_bookings` | INTEGER | Total réservations | - |
| `total_revenue` | NUMERIC | Revenus totaux | - |
| `active_tokens` | INTEGER | Tokens actifs | - |
| `pending_bookings` | INTEGER | Réservations en attente | - |
| `completed_bookings` | INTEGER | Réservations terminées | - |
| `cancelled_bookings` | INTEGER | Réservations annulées | - |
| `created_at` | TIMESTAMP | Date de création | - |

## Tables de Gestion des Tokens et Contrôle

### 15. Table `token_allocations`
**Description**: Allocation de tokens aux utilisateurs.

| Colonne | Type | Description | Relations |
|---------|------|-------------|-----------|
| `id` | PK | Identifiant unique | - |
| `user_id` | FK | Utilisateur | → `auth.users.id` |
| `tokens_allocated` | INTEGER | Tokens alloués | - |
| `tokens_used` | INTEGER | Tokens utilisés | - |
| `tokens_remaining` | INTEGER | Tokens restants | - |
| `is_active` | BOOLEAN | Statut actif | - |
| `allocated_by` | FK | Alloué par | → `auth.users.id` |
| `notes` | TEXT | Notes | - |
| `created_at` | TIMESTAMP | Date de création | - |
| `updated_at` | TIMESTAMP | Date de mise à jour | - |

### 16. Table `token_control_settings`
**Description**: Paramètres de contrôle des tokens par propriété.

| Colonne | Type | Description | Relations |
|---------|------|-------------|-----------|
| `id` | PK | Identifiant unique | - |
| `property_id` | FK | Propriété concernée | → `properties.id` |
| `control_type` | TEXT | Type de contrôle (unlimited, limited, blocked) | - |
| `max_reservations` | INTEGER | Réservations maximum | - |
| `current_reservations` | INTEGER | Réservations actuelles | - |
| `is_enabled` | BOOLEAN | Contrôle activé | - |
| `created_at` | TIMESTAMP | Date de création | - |
| `updated_at` | TIMESTAMP | Date de mise à jour | - |

## Tables de Profils et Logs

### 17. Table `host_profiles`
**Description**: Profils des hôtes.

| Colonne | Type | Description | Relations |
|---------|------|-------------|-----------|
| `id` | PK | Identifiant unique | → `auth.users.id` |
| `full_name` | TEXT | Nom complet | - |
| `phone` | TEXT | Téléphone | - |
| `avatar_url` | TEXT | URL de l'avatar | - |
| `created_at` | TIMESTAMP | Date de création | - |
| `updated_at` | TIMESTAMP | Date de mise à jour | - |

### 18. Table `system_logs`
**Description**: Logs système.

| Colonne | Type | Description | Relations |
|---------|------|-------------|-----------|
| `id` | PK | Identifiant unique | - |
| `action` | TEXT | Action effectuée | - |
| `user_id` | FK | Utilisateur concerné | → `auth.users.id` |
| `details` | JSONB | Détails de l'action | - |
| `created_at` | TIMESTAMP | Date de création | - |

## Relations Principales

### Relations Centrales
1. **auth.users** → Centre d'authentification
   - Lié à: `properties`, `bookings`, `admin_users`, `host_profiles`, `system_logs`, `token_allocations`

2. **properties** → Entité centrale des propriétés
   - Lié à: `bookings`, `property_verification_tokens`, `airbnb_reservations`, `airbnb_sync_status`, `token_control_settings`

3. **bookings** → Gestion des réservations
   - Lié à: `properties`, `guests`, `generated_documents`, `contract_signatures`, `guest_submissions`, `uploaded_documents`

4. **guests** → Gestion des invités
   - Lié à: `bookings`, `uploaded_documents`

### Relations de Documents
- `generated_documents` → `contract_signatures`
- `bookings` → `generated_documents`
- `bookings` → `contract_signatures`
- `bookings` → `uploaded_documents`

### Relations Airbnb
- `properties` → `airbnb_reservations`
- `properties` → `airbnb_sync_status`

### Relations de Tokens
- `properties` → `property_verification_tokens`
- `bookings` → `guest_verification_tokens`
- `property_verification_tokens` → `guest_submissions`

## Patterns et Conventions

### Soft Delete
Certaines tables utilisent le pattern de soft delete avec les colonnes:
- `created_at`: Date de création
- `updated_at`: Date de dernière modification

### Gestion des Signatures
Plusieurs tables gèrent les signatures électroniques:
- `is_signed`: Boolean indiquant si signé
- `signed_at`: Timestamp de signature
- `signature_data`: Données de signature

### Gestion des Tokens
- `is_active`: Boolean pour l'état actif/inactif
- `expires_at`: Date d'expiration pour les tokens temporaires

## Observations Architecture

1. **Séparation des responsabilités**: Chaque table a un rôle spécifique et bien défini
2. **Audit trail complet**: Logs d'activité et système pour traçabilité
3. **Flexibilité des permissions**: Système d'administration avec permissions JSONB
4. **Gestion documentaire robuste**: Workflow complet de génération, upload et signature
5. **Scalabilité**: Structure modulaire permettant l'ajout de nouvelles fonctionnalités
6. **Contrôle des tokens**: Système sophistiqué de gestion et allocation des tokens
7. **Intégration Airbnb**: Tables dédiées pour la synchronisation et le suivi

## Tables Supabase Auth
- `auth.users`: Table d'authentification native Supabase (non modifiable)
- Utilisée comme référence pour tous les utilisateurs du système
