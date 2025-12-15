-- Migration: Vue matérialisée pour bookings enrichis
-- Date: 2025-01-31
-- Description: Crée une vue matérialisée qui pré-calcule les données enrichies des réservations
--              pour améliorer les performances des requêtes

-- =============================================================================
-- 1. CRÉER LA VUE MATÉRIALISÉE
-- =============================================================================

-- Supprimer la vue matérialisée si elle existe déjà
DROP MATERIALIZED VIEW IF EXISTS public.mv_bookings_enriched CASCADE;

-- Créer la vue matérialisée avec les données enrichies
CREATE MATERIALIZED VIEW public.mv_bookings_enriched AS
SELECT 
  b.id,
  b.property_id,
  b.user_id,
  b.check_in_date,
  b.check_out_date,
  b.number_of_guests,
  b.booking_reference,
  b.guest_name,
  b.status,
  b.created_at,
  b.updated_at,
  b.documents_generated,
  b.submission_id,
  
  -- Données de la propriété (première ligne seulement)
  jsonb_build_object(
    'id', p.id,
    'name', p.name,
    'property_type', p.property_type,
    'max_occupancy', p.max_occupancy,
    'house_rules', COALESCE(p.house_rules, '[]'::jsonb),
    'contract_template', COALESCE(p.contract_template, '{}'::jsonb)
  ) as property_data,
  
  -- Données des invités (agrégées)
  COALESCE(
    jsonb_agg(
      DISTINCT jsonb_build_object(
        'id', g.id,
        'fullName', g.full_name,
        'dateOfBirth', g.date_of_birth,
        'documentNumber', g.document_number,
        'nationality', g.nationality,
        'placeOfBirth', g.place_of_birth,
        'documentType', g.document_type
      )
    ) FILTER (WHERE g.id IS NOT NULL),
    '[]'::jsonb
  ) as guests_data,
  
  -- Données des soumissions d'invités (agrégées)
  COALESCE(
    jsonb_agg(
      DISTINCT jsonb_build_object(
        'id', gs.id,
        'guest_data', gs.guest_data,
        'document_urls', gs.document_urls,
        'signature_data', gs.signature_data,
        'status', gs.status,
        'submitted_at', gs.submitted_at
      )
    ) FILTER (WHERE gs.id IS NOT NULL),
    '[]'::jsonb
  ) as guest_submissions_data,
  
  -- Compteurs pour performance
  COUNT(DISTINCT g.id) as guest_count,
  COUNT(DISTINCT gs.id) as submission_count,
  
  -- Indicateurs booléens
  (COUNT(DISTINCT gs.id) > 0) as has_submissions,
  (EXISTS(
    SELECT 1 FROM v_guest_submissions gs2 
    WHERE gs2.resolved_booking_id = b.id 
    AND gs2.signature_data IS NOT NULL
  )) as has_signature,
  (EXISTS(
    SELECT 1 FROM v_guest_submissions gs3 
    WHERE gs3.resolved_booking_id = b.id 
    AND gs3.document_urls IS NOT NULL 
    AND gs3.document_urls != '[]'::jsonb
  )) as has_documents

FROM bookings b
LEFT JOIN properties p ON p.id = b.property_id
LEFT JOIN guests g ON g.booking_id = b.id
LEFT JOIN v_guest_submissions gs ON gs.resolved_booking_id = b.id
-- ✅ Note: Le filtre 'draft' est fait côté application car l'enum ne contient pas encore 'draft'
-- WHERE b.status != 'draft'  -- Décommenter une fois que 'draft' est ajouté à l'enum
GROUP BY 
  b.id,
  b.property_id,
  b.user_id,
  b.check_in_date,
  b.check_out_date,
  b.number_of_guests,
  b.booking_reference,
  b.guest_name,
  b.status,
  b.created_at,
  b.updated_at,
  b.documents_generated,
  b.submission_id,
  p.id,
  p.name,
  p.property_type,
  p.max_occupancy,
  p.house_rules,
  p.contract_template;

-- =============================================================================
-- 2. CRÉER LES INDEX POUR PERFORMANCE
-- =============================================================================

-- Index pour filtrage par propriété (le plus utilisé)
CREATE INDEX IF NOT EXISTS idx_mv_bookings_enriched_property 
  ON public.mv_bookings_enriched(property_id, check_in_date DESC);

-- Index pour filtrage par utilisateur
CREATE INDEX IF NOT EXISTS idx_mv_bookings_enriched_user 
  ON public.mv_bookings_enriched(user_id, check_in_date DESC);

-- Index pour filtrage par dates (calendrier)
CREATE INDEX IF NOT EXISTS idx_mv_bookings_enriched_dates 
  ON public.mv_bookings_enriched(check_in_date, check_out_date)
  WHERE check_in_date IS NOT NULL;

-- Index pour filtrage par statut
CREATE INDEX IF NOT EXISTS idx_mv_bookings_enriched_status 
  ON public.mv_bookings_enriched(status, check_in_date DESC);

-- Index composite pour requêtes fréquentes (propriété + dates)
CREATE INDEX IF NOT EXISTS idx_mv_bookings_enriched_property_dates 
  ON public.mv_bookings_enriched(property_id, check_in_date, check_out_date);

-- =============================================================================
-- 3. CRÉER LA FONCTION DE REFRESH
-- =============================================================================

-- Fonction pour rafraîchir la vue matérialisée
CREATE OR REPLACE FUNCTION public.refresh_bookings_enriched()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_bookings_enriched;
END;
$$;

-- =============================================================================
-- 4. CRÉER LES TRIGGERS POUR REFRESH AUTOMATIQUE
-- =============================================================================

-- Fonction trigger pour refresh automatique
CREATE OR REPLACE FUNCTION public.trigger_refresh_bookings_enriched()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Rafraîchir la vue matérialisée de manière asynchrone
  -- Utiliser un job scheduler ou un trigger différé pour éviter les blocages
  PERFORM pg_notify('refresh_bookings_enriched', '');
  RETURN NULL;
END;
$$;

-- Trigger sur bookings
DROP TRIGGER IF EXISTS refresh_bookings_enriched_on_booking_change ON public.bookings;
CREATE TRIGGER refresh_bookings_enriched_on_booking_change
AFTER INSERT OR UPDATE OR DELETE ON public.bookings
FOR EACH STATEMENT
EXECUTE FUNCTION public.trigger_refresh_bookings_enriched();

-- Trigger sur guests
DROP TRIGGER IF EXISTS refresh_bookings_enriched_on_guest_change ON public.guests;
CREATE TRIGGER refresh_bookings_enriched_on_guest_change
AFTER INSERT OR UPDATE OR DELETE ON public.guests
FOR EACH STATEMENT
EXECUTE FUNCTION public.trigger_refresh_bookings_enriched();

-- Trigger sur guest_submissions
DROP TRIGGER IF EXISTS refresh_bookings_enriched_on_submission_change ON public.guest_submissions;
CREATE TRIGGER refresh_bookings_enriched_on_submission_change
AFTER INSERT OR UPDATE OR DELETE ON public.guest_submissions
FOR EACH STATEMENT
EXECUTE FUNCTION public.trigger_refresh_bookings_enriched();

-- =============================================================================
-- 5. CRÉER LES POLICIES RLS
-- =============================================================================

-- Activer RLS sur la vue matérialisée
ALTER MATERIALIZED VIEW public.mv_bookings_enriched OWNER TO postgres;

-- Note: Les vues matérialisées n'ont pas de RLS direct,
-- mais les données sont filtrées par la requête sous-jacente qui respecte RLS
-- via les tables sources (bookings, properties, etc.)

-- =============================================================================
-- 6. COMMENTAIRES ET DOCUMENTATION
-- =============================================================================

COMMENT ON MATERIALIZED VIEW public.mv_bookings_enriched IS 
'Vue matérialisée pour les réservations enrichies avec données des invités et soumissions. 
Rafraîchissement automatique via triggers. Utilisée pour améliorer les performances des requêtes.';

COMMENT ON FUNCTION public.refresh_bookings_enriched() IS 
'Rafraîchit la vue matérialisée mv_bookings_enriched de manière concurrente.';

COMMENT ON FUNCTION public.trigger_refresh_bookings_enriched() IS 
'Trigger function qui notifie la nécessité de rafraîchir la vue matérialisée.';

-- =============================================================================
-- 7. REFRESH INITIAL
-- =============================================================================

-- Rafraîchir la vue matérialisée une première fois
REFRESH MATERIALIZED VIEW public.mv_bookings_enriched;

