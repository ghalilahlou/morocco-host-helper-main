-- =============================================================================
-- Diagnostic liens invités Checky (property_verification_tokens + métadonnées)
-- À exécuter dans Supabase SQL Editor (rôle service / bypass RLS si besoin).
--
-- 1) Section 0 : chercher par token (colle le token complet depuis l’URL /v/...).
-- 2) Sections 1 et 5 : remplace l’UUID exemple par celui de ta propriété.
-- 3) Section 4 : remplace l’email exemple par le tien (syntaxe texte valide).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0) Un lien /v/{token} précis — même logique que resolve_guest_token
-- ---------------------------------------------------------------------------
-- Exemple : remplace COLLE_ICI_LE_TOKEN_COMPLET par la partie après /v/ dans l’URL.

SELECT
  pvt.id,
  pvt.token,
  pvt.property_id,
  pvt.is_active,
  pvt.expires_at,
  pvt.booking_id,
  pvt.airbnb_confirmation_code,
  pvt.metadata
FROM public.property_verification_tokens pvt
WHERE pvt.token = 'COLLE_ICI_LE_TOKEN_COMPLET';

-- ---------------------------------------------------------------------------
-- 1) Tous les tokens d’une propriété (actifs et inactifs), métadonnées résa
-- ---------------------------------------------------------------------------
-- Remplace l’UUID ci-dessous (format valide obligatoire, sinon erreur 22P02).

SELECT
  pvt.id,
  left(pvt.token, 14) || '…' AS token_prefix,
  pvt.is_active,
  pvt.created_at,
  pvt.updated_at,
  pvt.expires_at,
  pvt.booking_id,
  pvt.airbnb_confirmation_code,
  pvt.metadata ->> 'linkType' AS link_type,
  pvt.metadata -> 'reservationData' AS reservation_data_json
FROM public.property_verification_tokens pvt
WHERE pvt.property_id = '11111111-1111-1111-1111-111111111111'::uuid
ORDER BY pvt.created_at DESC;

-- ---------------------------------------------------------------------------
-- 2) Propriétés avec PLUS d’un token actif (souvent ambigu pour l’idempotence)
-- ---------------------------------------------------------------------------
SELECT
  property_id,
  count(*) AS active_tokens
FROM public.property_verification_tokens
WHERE is_active = true
GROUP BY property_id
HAVING count(*) > 1
ORDER BY active_tokens DESC;

-- ---------------------------------------------------------------------------
-- 3) Même métadonnées (hash) sur plusieurs lignes actives = copie / bug
-- ---------------------------------------------------------------------------
SELECT
  md5(pvt.metadata::text) AS metadata_hash,
  count(*) AS n,
  array_agg(left(pvt.token, 12) ORDER BY pvt.created_at) AS token_prefixes
FROM public.property_verification_tokens pvt
WHERE pvt.is_active = true
GROUP BY md5(pvt.metadata::text)
HAVING count(*) > 1;

-- ---------------------------------------------------------------------------
-- 4) Propriétés d’un hôte (email) + dernier token actif par propriété
-- ---------------------------------------------------------------------------
-- Remplace l’email :
-- WHERE u.email = 'ton@email.com'

SELECT
  p.id AS property_id,
  p.name AS property_name,
  pvt.id AS token_row_id,
  left(pvt.token, 14) || '…' AS token_prefix,
  pvt.is_active,
  pvt.created_at,
  pvt.metadata -> 'reservationData' AS reservation_data
FROM public.properties p
JOIN auth.users u ON u.id = p.user_id
LEFT JOIN LATERAL (
  SELECT *
  FROM public.property_verification_tokens t
  WHERE t.property_id = p.id AND t.is_active = true
  ORDER BY t.created_at DESC
  LIMIT 1
) pvt ON true
WHERE u.email = 'ton-email@example.com'
ORDER BY p.name;

-- ---------------------------------------------------------------------------
-- 5) Réservations liées au booking_id du token (cohérence dates vs metadata)
-- ---------------------------------------------------------------------------
SELECT
  pvt.id AS token_id,
  left(pvt.token, 12) AS token_prefix,
  pvt.booking_id,
  b.booking_reference,
  b.check_in_date,
  b.check_out_date,
  b.guest_name,
  pvt.metadata -> 'reservationData' AS meta_reservation
FROM public.property_verification_tokens pvt
-- booking_id est TEXT en base (UUID ou autre ref.) ; bookings.id est UUID
LEFT JOIN public.bookings b ON b.id::text = pvt.booking_id
WHERE pvt.property_id = '11111111-1111-1111-1111-111111111111'::uuid
  AND pvt.is_active = true
ORDER BY pvt.created_at DESC;
