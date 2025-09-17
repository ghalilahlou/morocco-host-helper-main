# Structure de la Base de Données - Morocco Host Helper

## Vue d'ensemble

Cette documentation détaille la structure complète de la base de données Supabase pour l'application Morocco Host Helper. Le système gère les propriétés, réservations, invités, documents et signatures électroniques.

## Tables Principales

### 1. Table `properties`
**Description**: Stocke les informations des propriétés disponibles à la location.

| Colonne | Type | Description | Relations |
|---------|------|-------------|-----------|
| `id` | PK | Identifiant unique de la propriété | - |
| `address` | TEXT | Adresse complète de la propriété | - |
| `name` | TEXT | Nom de la propriété | - |
| `description` | TEXT | Description détaillée | - |
| `country` | TEXT | Pays | - |
| `city` | TEXT | Ville | - |
| `zip_code` | TEXT | Code postal | - |
| `street_name` | TEXT | Nom de la rue | - |
| `street_number` | TEXT | Numéro de rue | - |
| `price_per_night` | DECIMAL | Prix par nuit | - |
| `currency` | TEXT | Devise | - |
| `user_id` | FK | Propriétaire de la propriété | → `auth.users.id` |
| `guest_id` | FK | Invité principal de contact | → `guests.id` |
| `created_at` | TIMESTAMP | Date de création | - |
| `updated_at` | TIMESTAMP | Date de mise à jour | - |
| `deleted_at` | TIMESTAMP | Date de suppression (soft delete) | - |

### 2. Table `bookings`
**Description**: Gère les réservations des propriétés.

| Colonne | Type | Description | Relations |
|---------|------|-------------|-----------|
| `id` | PK | Identifiant unique de la réservation | - |
| `property_id` | FK | Propriété réservée | → `properties.id` |
| `guest_id` | FK | Invité qui fait la réservation | → `guests.id` |
| `check_in_date` | DATE | Date d'arrivée | - |
| `check_out_date` | DATE | Date de départ | - |
| `guest_name` | TEXT | Nom de l'invité | - |
| `guest_email` | TEXT | Email de l'invité | - |
| `guest_phone` | TEXT | Téléphone de l'invité | - |
| `notes` | TEXT | Notes de réservation | - |
| `total_amount` | DECIMAL | Montant total | - |
| `documents_generated` | BOOLEAN | Documents générés | - |
| `is_signed` | BOOLEAN | Contrat signé | - |
| `signed_at` | TIMESTAMP | Date de signature | - |
| `signed_document_url` | TEXT | URL du document signé | - |
| `created_at` | TIMESTAMP | Date de création | - |
| `updated_at` | TIMESTAMP | Date de mise à jour | - |
| `deleted_at` | TIMESTAMP | Date de suppression (soft delete) | - |

### 3. Table `guests`
**Description**: Informations des invités.

| Colonne | Type | Description | Relations |
|---------|------|-------------|-----------|
| `id` | PK | Identifiant unique de l'invité | - |
| `booking_id` | FK | Réservation associée | → `bookings.id` |
| `community_id` | TEXT | ID de la communauté | - |
| `full_name` | TEXT | Nom complet | - |
| `email` | TEXT | Adresse email | - |
| `phone` | TEXT | Numéro de téléphone | - |
| `place_of_birth` | TEXT | Lieu de naissance | - |
| `created_at` | TIMESTAMP | Date de création | - |
| `updated_at` | TIMESTAMP | Date de mise à jour | - |
| `deleted_at` | TIMESTAMP | Date de suppression (soft delete) | - |

## Tables de Gestion des Documents

### 4. Table `generated_documents`
**Description**: Documents générés pour les réservations.

| Colonne | Type | Description | Relations |
|---------|------|-------------|-----------|
| `id` | PK | Identifiant unique du document | - |
| `booking_id` | FK | Réservation associée | → `bookings.id` |
| `document_type` | TEXT | Type de document | - |
| `file_name` | TEXT | Nom du fichier | - |
| `file_path` | TEXT | Chemin du fichier | - |
| `is_signed` | BOOLEAN | Document signé | - |
| `signed_at` | TIMESTAMP | Date de signature | - |
| `signature_data` | JSONB | Données de signature | - |
| `created_at` | TIMESTAMP | Date de création | - |
| `updated_at` | TIMESTAMP | Date de mise à jour | - |
| `deleted_at` | TIMESTAMP | Date de suppression (soft delete) | - |

### 5. Table `contract_signatures`
**Description**: Signatures des contrats.

| Colonne | Type | Description | Relations |
|---------|------|-------------|-----------|
| `id` | PK | Identifiant unique de la signature | - |
| `document_id` | FK | Document signé | → `generated_documents.id` |
| `signer_name` | TEXT | Nom du signataire | - |
| `signer_email` | TEXT | Email du signataire | - |
| `signed_at` | TIMESTAMP | Date de signature | - |
| `signature_data` | JSONB | Données de signature | - |
| `signer_ip_address` | TEXT | Adresse IP du signataire | - |

### 6. Table `uploaded_documents`
**Description**: Documents uploadés par les invités.

| Colonne | Type | Description | Relations |
|---------|------|-------------|-----------|
| `id` | PK | Identifiant unique | - |
| `booking_id` | FK | Réservation associée | → `bookings.id` |
| `guest_id` | FK | Invité qui a uploadé | → `guests.id` |
| `property_id` | FK | Propriété concernée | → `properties.id` |
| `file_path` | TEXT | Chemin du fichier | - |
| `document_url` | TEXT | URL du document | - |
| `document_id` | TEXT | ID du document | - |
| `processing_status` | TEXT | Statut de traitement | - |
| `is_signed` | BOOLEAN | Document signé | - |
| `signature_data` | JSONB | Données de signature | - |
| `created_at` | TIMESTAMP | Date de création | - |
| `updated_at` | TIMESTAMP | Date de mise à jour | - |
| `deleted_at` | TIMESTAMP | Date de suppression (soft delete) | - |

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

### 8. Table `guest_confirmations_template`
**Description**: Modèles de confirmation pour les invités.

| Colonne | Type | Description | Relations |
|---------|------|-------------|-----------|
| `id` | PK | Identifiant unique | - |
| `booking_id` | FK | Réservation associée | → `bookings.id` |
| `is_signed` | BOOLEAN | Template signé | - |
| `created_at` | TIMESTAMP | Date de création | - |
| `updated_at` | TIMESTAMP | Date de mise à jour | - |
| `deleted_at` | TIMESTAMP | Date de suppression (soft delete) | - |

## Tables de Gestion Utilisateur

### 9. Table `user_properties`
**Description**: Association utilisateurs-propriétés.

| Colonne | Type | Description | Relations |
|---------|------|-------------|-----------|
| `id` | PK | Identifiant unique | - |
| `user_id` | FK | Utilisateur | → `auth.users.id` |
| `property_id` | FK | Propriété | → `properties.id` |
| `created_at` | TIMESTAMP | Date de création | - |
| `updated_at` | TIMESTAMP | Date de mise à jour | - |
| `deleted_at` | TIMESTAMP | Date de suppression (soft delete) | - |

### 10. Table `user_bookings`
**Description**: Association utilisateurs-réservations.

| Colonne | Type | Description | Relations |
|---------|------|-------------|-----------|
| `id` | PK | Identifiant unique | - |
| `user_id` | FK | Utilisateur | → `auth.users.id` |
| `booking_id` | FK | Réservation | → `bookings.id` |
| `created_at` | TIMESTAMP | Date de création | - |
| `updated_at` | TIMESTAMP | Date de mise à jour | - |
| `deleted_at` | TIMESTAMP | Date de suppression (soft delete) | - |

### 11. Table `user_documents`
**Description**: Association utilisateurs-documents.

| Colonne | Type | Description | Relations |
|---------|------|-------------|-----------|
| `id` | PK | Identifiant unique | - |
| `user_id` | FK | Utilisateur | → `auth.users.id` |
| `document_id` | FK | Document | → `generated_documents.id` |
| `created_at` | TIMESTAMP | Date de création | - |
| `updated_at` | TIMESTAMP | Date de mise à jour | - |
| `deleted_at` | TIMESTAMP | Date de suppression (soft delete) | - |

### 12. Table `user_allocations`
**Description**: Allocation de ressources aux utilisateurs.

| Colonne | Type | Description | Relations |
|---------|------|-------------|-----------|
| `id` | PK | Identifiant unique | - |
| `user_id` | FK | Utilisateur | → `auth.users.id` |
| `resource_type` | TEXT | Type de ressource | - |
| `resource_id` | TEXT | ID de la ressource | - |
| `created_at` | TIMESTAMP | Date de création | - |
| `updated_at` | TIMESTAMP | Date de mise à jour | - |
| `deleted_at` | TIMESTAMP | Date de suppression (soft delete) | - |

## Tables d'Administration

### 13. Table `admin_users`
**Description**: Utilisateurs administrateurs.

| Colonne | Type | Description | Relations |
|---------|------|-------------|-----------|
| `id` | PK | Identifiant unique | - |
| `user_id` | FK | Utilisateur | → `auth.users.id` |
| `permissions` | JSONB | Permissions administrateur | - |
| `is_active` | BOOLEAN | Statut actif | - |
| `created_at` | TIMESTAMP | Date de création | - |
| `updated_at` | TIMESTAMP | Date de mise à jour | - |
| `deleted_at` | TIMESTAMP | Date de suppression (soft delete) | - |

### 14. Table `team_profiles`
**Description**: Profils de l'équipe.

| Colonne | Type | Description | Relations |
|---------|------|-------------|-----------|
| `id` | PK | Identifiant unique | - |
| `user_id` | FK | Utilisateur | → `auth.users.id` |
| `full_name` | TEXT | Nom complet | - |
| `email` | TEXT | Adresse email | - |
| `phone` | TEXT | Numéro de téléphone | - |
| `avatar_url` | TEXT | URL de l'avatar | - |
| `created_at` | TIMESTAMP | Date de création | - |
| `updated_at` | TIMESTAMP | Date de mise à jour | - |
| `deleted_at` | TIMESTAMP | Date de suppression (soft delete) | - |

## Tables de Logging et Audit

### 15. Table `auth_activity_logs`
**Description**: Logs d'activité d'authentification.

| Colonne | Type | Description | Relations |
|---------|------|-------------|-----------|
| `id` | PK | Identifiant unique | - |
| `event` | TEXT | Type d'événement | - |
| `resource_type` | TEXT | Type de ressource | - |
| `resource_id` | TEXT | ID de la ressource | - |
| `user_id` | FK | Utilisateur concerné | → `auth.users.id` |
| `created_at` | TIMESTAMP | Date de création | - |
| `updated_at` | TIMESTAMP | Date de mise à jour | - |
| `deleted_at` | TIMESTAMP | Date de suppression (soft delete) | - |

### 16. Table `system_logs`
**Description**: Logs système.

| Colonne | Type | Description | Relations |
|---------|------|-------------|-----------|
| `id` | PK | Identifiant unique | - |
| `event` | TEXT | Type d'événement | - |
| `details` | JSONB | Détails de l'événement | - |
| `user_id` | FK | Utilisateur concerné | → `auth.users.id` |
| `created_at` | TIMESTAMP | Date de création | - |
| `updated_at` | TIMESTAMP | Date de mise à jour | - |
| `deleted_at` | TIMESTAMP | Date de suppression (soft delete) | - |

## Tables de Configuration

### 17. Table `property_notification_settings`
**Description**: Paramètres de notification pour les propriétés.

| Colonne | Type | Description | Relations |
|---------|------|-------------|-----------|
| `id` | PK | Identifiant unique | - |
| `property_id` | FK | Propriété concernée | → `properties.id` |
| `notification_type` | TEXT | Type de notification | - |
| `is_enabled` | BOOLEAN | Notification activée | - |
| `created_at` | TIMESTAMP | Date de création | - |
| `updated_at` | TIMESTAMP | Date de mise à jour | - |
| `deleted_at` | TIMESTAMP | Date de suppression (soft delete) | - |

## Relations Principales

### Relations Centrales
1. **auth.users** → Centre d'authentification
   - Lié à: `properties`, `admin_users`, `team_profiles`, `auth_activity_logs`, `system_logs`, `user_allocations`, `user_properties`, `user_bookings`, `user_documents`

2. **properties** → Entité centrale des propriétés
   - Lié à: `bookings`, `user_properties`, `property_notification_settings`, `guest_submissions`, `uploaded_documents`

3. **bookings** → Gestion des réservations
   - Lié à: `properties`, `guests`, `generated_documents`, `guest_submissions`, `uploaded_documents`, `guest_confirmations_template`, `user_bookings`

4. **guests** → Gestion des invités
   - Lié à: `bookings`, `uploaded_documents`

### Relations de Documents
- `generated_documents` → `contract_signatures`
- `generated_documents` → `user_documents`
- `bookings` → `generated_documents`

## Patterns et Conventions

### Soft Delete
Toutes les tables principales utilisent le pattern de soft delete avec les colonnes:
- `created_at`: Date de création
- `updated_at`: Date de dernière modification
- `deleted_at`: Date de suppression (NULL = actif)

### Gestion des Signatures
Plusieurs tables gèrent les signatures électroniques:
- `is_signed`: Boolean indiquant si signé
- `signed_at`: Timestamp de signature
- `signature_data`: JSONB contenant les données de signature

### Relations Many-to-Many
Tables de liaison pour les relations many-to-many:
- `user_properties`: Utilisateurs ↔ Propriétés
- `user_bookings`: Utilisateurs ↔ Réservations
- `user_documents`: Utilisateurs ↔ Documents

## Observations Architecture

1. **Séparation des responsabilités**: Chaque table a un rôle spécifique et bien défini
2. **Audit trail complet**: Logs d'activité et système pour traçabilité
3. **Flexibilité des permissions**: Système d'administration avec permissions JSONB
4. **Gestion documentaire robuste**: Workflow complet de génération, upload et signature
5. **Scalabilité**: Structure modulaire permettant l'ajout de nouvelles fonctionnalités

## Tables Airbnb

### 18. Table `airbnb_reservations`
**Description**: Réservations importées depuis Airbnb.

| Colonne | Type | Description | Relations |
|---------|------|-------------|-----------|
| `id` | PK | Identifiant unique | - |
| `property_id` | FK | Propriété concernée | → `properties.id` |
| `airbnb_booking_id` | TEXT | ID de réservation Airbnb | - |
| `check_in_date` | DATE | Date d'arrivée | - |
| `check_out_date` | DATE | Date de départ | - |
| `guest_name` | TEXT | Nom de l'invité | - |
| `guest_email` | TEXT | Email de l'invité | - |
| `status` | TEXT | Statut de la réservation | - |
| `created_at` | TIMESTAMP | Date de création | - |
| `updated_at` | TIMESTAMP | Date de mise à jour | - |

### 19. Table `airbnb_sync_status`
**Description**: Statut de synchronisation Airbnb pour chaque propriété.

| Colonne | Type | Description | Relations |
|---------|------|-------------|-----------|
| `id` | PK | Identifiant unique | - |
| `property_id` | FK | Propriété concernée | → `properties.id` |
| `status` | TEXT | Statut de synchronisation | - |
| `last_sync_at` | TIMESTAMP | Dernière synchronisation | - |
| `reservations_count` | INTEGER | Nombre de réservations | - |
| `last_error` | TEXT | Dernière erreur | - |
| `created_at` | TIMESTAMP | Date de création | - |
| `updated_at` | TIMESTAMP | Date de mise à jour | - |

## Tables Supabase Auth
- `auth.users`: Table d'authentification native Supabase (non modifiable)
- Utilisée comme référence pour tous les utilisateurs du système
