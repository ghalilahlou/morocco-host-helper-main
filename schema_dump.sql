

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."booking_status" AS ENUM (
    'pending',
    'confirmed',
    'cancelled',
    'completed'
);


ALTER TYPE "public"."booking_status" OWNER TO "postgres";


CREATE TYPE "public"."document_type" AS ENUM (
    'passport',
    'national_id'
);


ALTER TYPE "public"."document_type" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_contract_signature"("p_submission_id" "uuid") RETURNS TABLE("signature_data" "text", "signer_name" "text", "signed_at" timestamp with time zone, "booking_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Récupérer la signature basée sur le booking_id de la soumission
  RETURN QUERY
  SELECT 
    cs.signature_data,
    cs.signer_name,
    cs.signed_at,
    cs.booking_id
  FROM contract_signatures cs
  INNER JOIN guest_submissions gs ON cs.booking_id = gs.booking_id
  WHERE gs.id = p_submission_id
  ORDER BY cs.created_at DESC
  LIMIT 1;
END;
$$;


ALTER FUNCTION "public"."check_contract_signature"("p_submission_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."check_contract_signature"("p_submission_id" "uuid") IS 'Vérifie si un contrat est signé pour une soumission d''invité';



CREATE OR REPLACE FUNCTION "public"."delete_property_with_reservations"("p_property_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  property_exists boolean;
BEGIN
  -- Check if the property exists and belongs to the user
  SELECT EXISTS(
    SELECT 1 FROM public.properties 
    WHERE id = p_property_id AND user_id = p_user_id
  ) INTO property_exists;
  
  IF NOT property_exists THEN
    RETURN false;
  END IF;
  
  -- Delete in the correct order to respect foreign key constraints
  
  -- Delete contract signatures for bookings of this property
  DELETE FROM public.contract_signatures 
  WHERE booking_id IN (
    SELECT id FROM public.bookings WHERE property_id = p_property_id
  );
  
  -- Delete guest submissions for bookings of this property
  DELETE FROM public.guest_submissions 
  WHERE booking_data->>'property_id' = p_property_id::text;
  
  -- Delete guests for bookings of this property
  DELETE FROM public.guests 
  WHERE booking_id IN (
    SELECT id FROM public.bookings WHERE property_id = p_property_id
  );
  
  -- Delete bookings for this property
  DELETE FROM public.bookings 
  WHERE property_id = p_property_id;
  
  -- Finally delete the property
  DELETE FROM public.properties 
  WHERE id = p_property_id AND user_id = p_user_id;
  
  RETURN true;
END;
$$;


ALTER FUNCTION "public"."delete_property_with_reservations"("p_property_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_admin_user_by_id"("user_id_param" "uuid") RETURNS TABLE("role" "text", "is_active" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    -- Retourner les informations admin de l'utilisateur spécifié
    RETURN QUERY
    SELECT
        au.role::TEXT,
        au.is_active
    FROM public.admin_users au
    WHERE au.user_id = user_id_param
    AND au.is_active = true
    LIMIT 1;
END;
$$;


ALTER FUNCTION "public"."get_admin_user_by_id"("user_id_param" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_all_users_for_admin"() RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'users', json_agg(
      json_build_object(
        'id', au.id,
        'email', au.email,
        'created_at', au.created_at,
        'user_metadata', json_build_object(
          'full_name', hp.full_name
        )
      )
    )
  ) INTO result
  FROM auth.users au
  LEFT JOIN public.host_profiles hp ON hp.id = au.id;
  
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."get_all_users_for_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_booking_guest_count"("p_booking_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  guest_count INTEGER := 0;
BEGIN
  SELECT COUNT(*) INTO guest_count
  FROM public.guests
  WHERE booking_id = p_booking_id;
  
  -- Si aucun invité dans la table guests, prendre le nombre de la réservation
  IF guest_count = 0 THEN
    SELECT COALESCE(number_of_guests, 1) INTO guest_count
    FROM public.bookings
    WHERE id = p_booking_id;
  END IF;
  
  RETURN COALESCE(guest_count, 1);
END;
$$;


ALTER FUNCTION "public"."get_booking_guest_count"("p_booking_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_booking_guest_count"("p_booking_id" "uuid") IS 'Retourne le nombre d''invités pour une réservation';



CREATE OR REPLACE FUNCTION "public"."get_dashboard_stats_real"() RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'totalUsers', (SELECT count(*) FROM auth.users),
    'totalProperties', (SELECT count(*) FROM properties),
    'totalBookings', (SELECT count(*) FROM bookings),
    'totalRevenue', (SELECT COALESCE(sum(total_amount), 0) FROM bookings),
    'activeProperties', (SELECT count(*) FROM properties WHERE user_id IS NOT NULL),
    'pendingBookings', (SELECT count(*) FROM bookings WHERE status = 'pending'),
    'completedBookings', (SELECT count(*) FROM bookings WHERE status = 'completed'),
    'propertyOwners', (SELECT count(DISTINCT user_id) FROM properties WHERE user_id IS NOT NULL),
    'activeTokens', (SELECT COALESCE(sum(tokens_remaining), 0) FROM token_allocations WHERE is_active = true)
  ) INTO result;
  
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."get_dashboard_stats_real"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_property_for_verification"("p_property_id" "uuid") RETURNS TABLE("id" "uuid", "name" "text", "address" "text", "contact_info" "jsonb", "user_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.address,
    p.contact_info,
    p.user_id
  FROM public.properties p
  WHERE p.id = p_property_id;
END;
$$;


ALTER FUNCTION "public"."get_property_for_verification"("p_property_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_property_for_verification"("p_property_id" "uuid") IS 'Récupère les informations d''une propriété pour vérification';



CREATE OR REPLACE FUNCTION "public"."get_signed_contracts_for_user"("p_user_id" "uuid") RETURNS TABLE("id" "uuid", "booking_id" "uuid", "signature_data" "text", "signer_name" "text", "signed_at" timestamp with time zone, "created_at" timestamp with time zone, "guest_submission" "jsonb", "booking_reference" "text", "property_name" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cs.id,
    cs.booking_id,
    cs.signature_data,
    cs.signer_name,
    cs.signed_at,
    cs.created_at,
    COALESCE(gs.guest_data, '{}'::jsonb) as guest_submission,
    COALESCE(b.booking_reference, '') as booking_reference,
    COALESCE(p.name, '') as property_name
  FROM public.contract_signatures cs
  LEFT JOIN public.bookings b ON b.id = cs.booking_id
  LEFT JOIN public.properties p ON p.id = b.property_id
  LEFT JOIN public.guest_submissions gs ON gs.id = cs.submission_id
  WHERE b.user_id = p_user_id
  ORDER BY cs.created_at DESC;
END;
$$;


ALTER FUNCTION "public"."get_signed_contracts_for_user"("p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_signed_contracts_for_user"("p_user_id" "uuid") IS 'Récupère tous les contrats signés pour un utilisateur donné avec les informations associées';


SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."admin_users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'admin'::"text" NOT NULL,
    "permissions" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "is_active" boolean DEFAULT true,
    "email" "text",
    "full_name" "text",
    CONSTRAINT "admin_users_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"])))
);


ALTER TABLE "public"."admin_users" OWNER TO "postgres";


COMMENT ON TABLE "public"."admin_users" IS 'Admin user roles and permissions';



CREATE OR REPLACE FUNCTION "public"."get_users_for_admin"() RETURNS SETOF "public"."admin_users"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$ select * from public.admin_users $$;


ALTER FUNCTION "public"."get_users_for_admin"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_users_for_admin"() IS 'Returns all admin users for admin interface';



CREATE OR REPLACE FUNCTION "public"."handle_contract_signature_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  -- Mark the related booking as completed and set documents_generated.contract = true
  UPDATE public.bookings
  SET 
    status = 'completed',
    documents_generated = COALESCE(documents_generated, '{}'::jsonb) || jsonb_build_object('contract', true),
    updated_at = now()
  WHERE id = NEW.booking_id;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_contract_signature_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_reservation_count"("property_uuid" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  settings_record token_control_settings%ROWTYPE;
BEGIN
  -- Récupérer les paramètres de contrôle
  SELECT * INTO settings_record
  FROM token_control_settings
  WHERE property_id = property_uuid
  AND is_enabled = true;
  
  -- Si pas de paramètres, pas besoin d'incrémenter
  IF NOT FOUND THEN
    RETURN true;
  END IF;
  
  -- Incrémenter le compteur seulement si c'est limité
  IF settings_record.control_type = 'limited' THEN
    UPDATE token_control_settings
    SET current_reservations = current_reservations + 1,
        updated_at = NOW()
    WHERE property_id = property_uuid
    AND is_enabled = true;
  END IF;
  
  RETURN true;
END;
$$;


ALTER FUNCTION "public"."increment_reservation_count"("property_uuid" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."increment_reservation_count"("property_uuid" "uuid") IS 'Incrémente le compteur de réservations pour une propriété (optionnel)';



CREATE OR REPLACE FUNCTION "public"."insert_contract_signature"("p_booking_id" "uuid", "p_signature_data" "text", "p_contract_content" "text", "p_user_agent" "text" DEFAULT NULL::"text") RETURNS TABLE("id" "uuid", "booking_id" "uuid", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.insert_contract_signature_data(
    p_booking_id, p_signature_data, p_contract_content, p_user_agent
  );
END;
$$;


ALTER FUNCTION "public"."insert_contract_signature"("p_booking_id" "uuid", "p_signature_data" "text", "p_contract_content" "text", "p_user_agent" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."insert_contract_signature"("p_booking_id" "uuid", "p_signature_data" "text", "p_contract_content" "text", "p_ip_address" "text" DEFAULT 'unknown'::"text", "p_user_agent" "text" DEFAULT 'unknown'::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Insérer directement dans la table contract_signatures
  INSERT INTO public.contract_signatures (
    booking_id,
    signature_data,
    contract_content,
    signed_at
  ) VALUES (
    p_booking_id,
    p_signature_data,
    p_contract_content,
    now()
  );
  
  -- Pas besoin de retourner quoi que ce soit
END;
$$;


ALTER FUNCTION "public"."insert_contract_signature"("p_booking_id" "uuid", "p_signature_data" "text", "p_contract_content" "text", "p_ip_address" "text", "p_user_agent" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."insert_contract_signature_data"("p_booking_id" "uuid", "p_signature_data" "text", "p_contract_content" "text", "p_user_agent" "text" DEFAULT NULL::"text") RETURNS TABLE("id" "uuid", "booking_id" "uuid", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  INSERT INTO public.contract_signatures (booking_id, signature_data, contract_content)
  VALUES (p_booking_id, p_signature_data, p_contract_content)
  RETURNING id, booking_id, created_at;
END;
$$;


ALTER FUNCTION "public"."insert_contract_signature_data"("p_booking_id" "uuid", "p_signature_data" "text", "p_contract_content" "text", "p_user_agent" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_bookings_enriched"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_bookings_enriched;
END;
$$;


ALTER FUNCTION "public"."refresh_bookings_enriched"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."refresh_bookings_enriched"() IS 'Rafraîchit la vue matérialisée mv_bookings_enriched de manière concurrente.';



CREATE OR REPLACE FUNCTION "public"."sync_booking_guests"("p_booking_id" "uuid", "p_guests" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  guest_record JSONB;
  new_guest_id UUID;
BEGIN
  -- Validation des paramètres
  IF p_booking_id IS NULL THEN
    RAISE EXCEPTION 'booking_id cannot be null';
  END IF;

  IF p_guests IS NULL THEN
    p_guests := '[]'::JSONB;
  END IF;

  -- Début de la transaction atomique
  BEGIN
    -- 1. Supprimer tous les invités existants
    DELETE FROM public.guests 
    WHERE booking_id = p_booking_id;
    
    -- 2. Insérer les nouveaux invités
    FOR guest_record IN SELECT * FROM jsonb_array_elements(p_guests)
    LOOP
      INSERT INTO public.guests (
        booking_id,
        full_name,
        date_of_birth,
        document_number,
        nationality,
        place_of_birth,
        document_type,
        created_at,
        updated_at
      ) VALUES (
        p_booking_id,
        COALESCE(guest_record->>'full_name', ''),
        COALESCE((guest_record->>'date_of_birth')::DATE, CURRENT_DATE),
        COALESCE(guest_record->>'document_number', ''),
        COALESCE(guest_record->>'nationality', ''),
        COALESCE(guest_record->>'place_of_birth', ''),
        COALESCE((guest_record->>'document_type')::document_type, 'passport'),
        NOW(),
        NOW()
      );
    END LOOP;

    -- 3. Mettre à jour le timestamp de la réservation
    UPDATE public.bookings 
    SET updated_at = NOW() 
    WHERE id = p_booking_id;

  EXCEPTION
    WHEN OTHERS THEN
      -- En cas d'erreur, rollback automatique
      RAISE EXCEPTION 'Failed to sync guests for booking %: %', p_booking_id, SQLERRM;
  END;
END;
$$;


ALTER FUNCTION "public"."sync_booking_guests"("p_booking_id" "uuid", "p_guests" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."sync_booking_guests"("p_booking_id" "uuid", "p_guests" "jsonb") IS 'Synchronise atomiquement les invités d''une réservation. Supprime tous les invités existants et insère les nouveaux en une seule transaction.';



CREATE OR REPLACE FUNCTION "public"."trigger_refresh_bookings_enriched"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Rafraîchir la vue matérialisée de manière asynchrone
  -- Utiliser un job scheduler ou un trigger différé pour éviter les blocages
  PERFORM pg_notify('refresh_bookings_enriched', '');
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."trigger_refresh_bookings_enriched"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."trigger_refresh_bookings_enriched"() IS 'Trigger function qui notifie la nécessité de rafraîchir la vue matérialisée.';



CREATE OR REPLACE FUNCTION "public"."update_host_full_name"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Update full_name if first_name or last_name changed
  IF NEW.first_name IS NOT NULL OR NEW.last_name IS NOT NULL THEN
    NEW.full_name = TRIM(CONCAT_WS(' ', NEW.first_name, NEW.last_name));
  END IF;
  
  -- Update updated_at timestamp
  NEW.updated_at = now();
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_host_full_name"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_token_control_settings_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_token_control_settings_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_tokens_remaining"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.tokens_remaining = NEW.tokens_allocated - NEW.tokens_used;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_tokens_remaining"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_booking_id_format"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $_$
BEGIN
  -- Si booking_id est fourni, s'assurer qu'il s'agit d'un UUID valide
  IF NEW.booking_id IS NOT NULL THEN
    IF NOT (NEW.booking_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') THEN
      RAISE EXCEPTION 'booking_id doit être un UUID valide, pas un code Airbnb. Valeur reçue: %', NEW.booking_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$_$;


ALTER FUNCTION "public"."validate_booking_id_format"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_booking_user_id"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Vérifier que user_id n'est pas NULL
  IF NEW.user_id IS NULL THEN
    RAISE EXCEPTION 'user_id ne peut pas être NULL pour une réservation';
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_booking_user_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verify_property_token"("p_property_id" "uuid", "p_token" "text") RETURNS TABLE("id" "uuid", "property_id" "uuid", "token" "text", "expires_at" timestamp with time zone, "is_valid" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pvt.id,
    pvt.property_id,
    pvt.token,
    pvt.expires_at,
    (pvt.expires_at > NOW() OR pvt.expires_at IS NULL) as is_valid
  FROM public.property_verification_tokens pvt
  WHERE pvt.property_id = p_property_id 
    AND pvt.token = p_token
    AND pvt.is_active = true
  LIMIT 1;
END;
$$;


ALTER FUNCTION "public"."verify_property_token"("p_property_id" "uuid", "p_token" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."verify_property_token"("p_property_id" "uuid", "p_token" "text") IS 'Vérifie la validité d''un token pour une propriété en utilisant property_verification_tokens';



CREATE TABLE IF NOT EXISTS "public"."admin_activity_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "admin_user_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "resource_type" "text" NOT NULL,
    "resource_id" "uuid",
    "details" "jsonb" DEFAULT '{}'::"jsonb",
    "ip_address" "inet",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."admin_activity_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."admin_activity_logs" IS 'Table des logs d''activité des administrateurs';



CREATE TABLE IF NOT EXISTS "public"."admin_statistics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "date" "date" NOT NULL,
    "total_users" integer DEFAULT 0,
    "total_properties" integer DEFAULT 0,
    "total_bookings" integer DEFAULT 0,
    "total_revenue" numeric(10,2) DEFAULT 0,
    "active_tokens" integer DEFAULT 0,
    "pending_bookings" integer DEFAULT 0,
    "completed_bookings" integer DEFAULT 0,
    "cancelled_bookings" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."admin_statistics" OWNER TO "postgres";


COMMENT ON TABLE "public"."admin_statistics" IS 'Table des statistiques quotidiennes pour le dashboard administrateur';



CREATE TABLE IF NOT EXISTS "public"."airbnb_reservations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_id" "uuid" NOT NULL,
    "airbnb_booking_id" "text" NOT NULL,
    "summary" "text",
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "guest_name" "text",
    "number_of_guests" integer,
    "description" "text",
    "raw_event_data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."airbnb_reservations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."airbnb_sync_status" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_id" "uuid" NOT NULL,
    "last_sync_at" timestamp with time zone,
    "sync_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "last_error" "text",
    "reservations_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."airbnb_sync_status" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bookings" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "property_id" "uuid",
    "check_in_date" "date" NOT NULL,
    "check_out_date" "date" NOT NULL,
    "number_of_guests" integer DEFAULT 1 NOT NULL,
    "booking_reference" "text",
    "status" "public"."booking_status",
    "documents_generated" "jsonb" DEFAULT '{"contract": false, "policeForm": false}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "user_id" "uuid",
    "signed_contract_url" "text",
    "submission_id" "uuid",
    "guest_name" "text",
    "guest_email" "text",
    "guest_phone" "text",
    "total_price" numeric(10,2),
    "notes" "text",
    "documents_status" "jsonb" DEFAULT '{"id": false, "police": false, "contract": false}'::"jsonb",
    "total_amount" numeric(10,2),
    "is_preview" boolean DEFAULT false,
    CONSTRAINT "bookings_property_id_not_null" CHECK (("property_id" IS NOT NULL))
);


ALTER TABLE "public"."bookings" OWNER TO "postgres";


COMMENT ON COLUMN "public"."bookings"."is_preview" IS 'Indique si cette réservation est temporaire (créée pour un aperçu de document)';



CREATE TABLE IF NOT EXISTS "public"."bookings_backup_20250127" (
    "id" "uuid",
    "property_id" "uuid",
    "check_in_date" "date",
    "check_out_date" "date",
    "number_of_guests" integer,
    "booking_reference" "text",
    "status" "public"."booking_status",
    "documents_generated" "jsonb",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "user_id" "uuid",
    "signed_contract_url" "text",
    "submission_id" "uuid",
    "guest_name" "text",
    "guest_email" "text",
    "guest_phone" "text",
    "total_price" numeric(10,2),
    "notes" "text",
    "documents_status" "jsonb",
    "total_amount" numeric(10,2),
    "is_preview" boolean
);


ALTER TABLE "public"."bookings_backup_20250127" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contract_signatures" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "signature_data" "text" NOT NULL,
    "contract_content" "text" NOT NULL,
    "signed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "signer_name" "text",
    "signer_email" "text",
    "signer_phone" "text"
);


ALTER TABLE "public"."contract_signatures" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."generated_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid",
    "document_type" character varying(50) NOT NULL,
    "file_name" character varying(255) NOT NULL,
    "file_path" character varying(500),
    "document_url" "text",
    "is_signed" boolean DEFAULT false,
    "signature_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."generated_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."guest_submissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "token_id" "uuid" NOT NULL,
    "booking_data" "jsonb",
    "guest_data" "jsonb",
    "document_urls" "jsonb" DEFAULT '[]'::"jsonb",
    "signature_data" "text",
    "submitted_at" timestamp with time zone DEFAULT "now"(),
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "booking_id" "uuid"
);


ALTER TABLE "public"."guest_submissions" OWNER TO "postgres";


COMMENT ON COLUMN "public"."guest_submissions"."document_urls" IS 'DEPRECATED: Document URLs are now stored in uploaded_documents table only. This field should remain empty for new submissions to avoid duplication.';



CREATE TABLE IF NOT EXISTS "public"."guest_submissions_backup_20250127" (
    "id" "uuid",
    "token_id" "uuid",
    "booking_data" "jsonb",
    "guest_data" "jsonb",
    "document_urls" "jsonb",
    "signature_data" "text",
    "submitted_at" timestamp with time zone,
    "status" "text",
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "booking_id" "uuid"
);


ALTER TABLE "public"."guest_submissions_backup_20250127" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."guest_verification_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "token" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."guest_verification_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."guests" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "booking_id" "uuid",
    "nationality" "text" NOT NULL,
    "document_type" "public"."document_type" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "full_name" "text",
    "document_number" "text",
    "date_of_birth" "date",
    "place_of_birth" "text"
);


ALTER TABLE "public"."guests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."host_profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text",
    "phone" "text",
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "first_name" "text",
    "last_name" "text",
    "signature_svg" "text",
    "signature_image_url" "text",
    "company_name" "text",
    "tax_id" "text"
);


ALTER TABLE "public"."host_profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."host_profiles"."first_name" IS 'Host first name for document generation';



COMMENT ON COLUMN "public"."host_profiles"."last_name" IS 'Host last name for document generation';



COMMENT ON COLUMN "public"."host_profiles"."signature_svg" IS 'Host signature as SVG path data';



COMMENT ON COLUMN "public"."host_profiles"."signature_image_url" IS 'Host signature as image URL (fallback)';



COMMENT ON COLUMN "public"."host_profiles"."company_name" IS 'Host company name (optional)';



COMMENT ON COLUMN "public"."host_profiles"."tax_id" IS 'Host tax identification number (optional)';



CREATE TABLE IF NOT EXISTS "public"."properties" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "address" "text",
    "contact_info" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "user_id" "uuid",
    "property_type" "text" DEFAULT 'apartment'::"text",
    "max_occupancy" integer DEFAULT 4,
    "description" "text",
    "house_rules" "jsonb" DEFAULT '[]'::"jsonb",
    "contract_template" "jsonb" DEFAULT '{}'::"jsonb",
    "airbnb_ics_url" "text",
    "photo_url" "text",
    "remaining_actions_hidden" boolean DEFAULT false,
    "city" "text",
    "country" "text" DEFAULT 'Maroc'::"text",
    "price_per_night" numeric(10,2),
    "max_guests" integer,
    "is_active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."properties" OWNER TO "postgres";


COMMENT ON COLUMN "public"."properties"."is_active" IS 'Soft-enable property in admin lists';



CREATE OR REPLACE VIEW "public"."host_dashboard_view" WITH ("security_invoker"='true') AS
 SELECT "id",
    "first_name",
    "last_name",
    "full_name",
    "phone",
    "avatar_url",
    "signature_svg",
    "signature_image_url",
    "company_name",
    "tax_id",
    "created_at",
    "updated_at",
    ( SELECT "count"(*) AS "count"
           FROM "public"."properties" "p"
          WHERE ("p"."user_id" = "hp"."id")) AS "total_properties",
    ( SELECT "count"(*) AS "count"
           FROM "public"."properties" "p"
          WHERE (("p"."user_id" = "hp"."id") AND ("p"."is_active" = true))) AS "active_properties",
    ( SELECT "count"(*) AS "count"
           FROM ("public"."bookings" "b"
             JOIN "public"."properties" "p" ON (("p"."id" = "b"."property_id")))
          WHERE ("p"."user_id" = "hp"."id")) AS "total_bookings",
    ( SELECT "count"(*) AS "count"
           FROM ("public"."bookings" "b"
             JOIN "public"."properties" "p" ON (("p"."id" = "b"."property_id")))
          WHERE (("p"."user_id" = "hp"."id") AND ("b"."check_in_date" >= CURRENT_DATE) AND ("b"."check_in_date" <= (CURRENT_DATE + '30 days'::interval)))) AS "upcoming_bookings"
   FROM "public"."host_profiles" "hp";


ALTER VIEW "public"."host_dashboard_view" OWNER TO "postgres";


COMMENT ON VIEW "public"."host_dashboard_view" IS 'Read-only view for host dashboard with aggregated statistics';



CREATE TABLE IF NOT EXISTS "public"."property_verification_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_id" "uuid" NOT NULL,
    "token" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "booking_id" "text",
    "expires_at" timestamp with time zone,
    "max_uses" integer DEFAULT 1,
    "used_count" integer DEFAULT 0,
    "type" "text" DEFAULT 'guest'::"text",
    "airbnb_confirmation_code" "text",
    "access_code_hash" "text",
    "last_used_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."property_verification_tokens" OWNER TO "postgres";


COMMENT ON COLUMN "public"."property_verification_tokens"."booking_id" IS 'Associated booking ID (can be UUID or Airbnb code)';



COMMENT ON COLUMN "public"."property_verification_tokens"."expires_at" IS 'Timestamp when the token expires';



COMMENT ON COLUMN "public"."property_verification_tokens"."max_uses" IS 'Maximum number of times this token can be used';



COMMENT ON COLUMN "public"."property_verification_tokens"."used_count" IS 'Number of successful validations';



COMMENT ON COLUMN "public"."property_verification_tokens"."type" IS 'Type of verification token (guest, admin, etc.)';



COMMENT ON COLUMN "public"."property_verification_tokens"."airbnb_confirmation_code" IS 'Original Airbnb confirmation code (masked in app; uniqueness scoped per property)';



COMMENT ON COLUMN "public"."property_verification_tokens"."access_code_hash" IS 'SHA-256 hash of (code + ACCESS_CODE_PEPPER), never store cleartext';



COMMENT ON COLUMN "public"."property_verification_tokens"."last_used_at" IS 'Timestamp of last successful validation';



COMMENT ON COLUMN "public"."property_verification_tokens"."metadata" IS 'Free-form JSON for auxiliary info (e.g., provenance)';



CREATE OR REPLACE VIEW "public"."v_guest_submissions" AS
 SELECT "gs"."id",
    "gs"."token_id",
    "gs"."booking_data",
    "gs"."guest_data",
    "gs"."document_urls",
    "gs"."signature_data",
    "gs"."submitted_at",
    "gs"."status",
    "gs"."reviewed_by",
    "gs"."reviewed_at",
    "gs"."created_at",
    "gs"."updated_at",
    "pvt"."property_id",
        CASE
            WHEN (("pvt"."booking_id" IS NOT NULL) AND ("pvt"."booking_id" <> ''::"text") AND ("pvt"."booking_id" ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'::"text")) THEN ("pvt"."booking_id")::"uuid"
            ELSE ( SELECT "b"."id"
               FROM "public"."bookings" "b"
              WHERE (("b"."property_id" = "pvt"."property_id") AND (("b"."check_in_date")::"text" = ("gs"."booking_data" ->> 'checkInDate'::"text")) AND (("b"."check_out_date")::"text" = ("gs"."booking_data" ->> 'checkOutDate'::"text")))
             LIMIT 1)
        END AS "resolved_booking_id"
   FROM ("public"."guest_submissions" "gs"
     JOIN "public"."property_verification_tokens" "pvt" ON (("gs"."token_id" = "pvt"."id")));


ALTER VIEW "public"."v_guest_submissions" OWNER TO "postgres";


CREATE MATERIALIZED VIEW "public"."mv_bookings_enriched" AS
 SELECT "b"."id",
    "b"."property_id",
    "b"."user_id",
    "b"."check_in_date",
    "b"."check_out_date",
    "b"."number_of_guests",
    "b"."booking_reference",
    "b"."guest_name",
    "b"."status",
    "b"."created_at",
    "b"."updated_at",
    "b"."documents_generated",
    "b"."submission_id",
    "jsonb_build_object"('id', "p"."id", 'name', "p"."name", 'property_type', "p"."property_type", 'max_occupancy', "p"."max_occupancy", 'house_rules', COALESCE("p"."house_rules", '[]'::"jsonb"), 'contract_template', COALESCE("p"."contract_template", '{}'::"jsonb")) AS "property_data",
    COALESCE("jsonb_agg"(DISTINCT "jsonb_build_object"('id', "g"."id", 'fullName', "g"."full_name", 'dateOfBirth', "g"."date_of_birth", 'documentNumber', "g"."document_number", 'nationality', "g"."nationality", 'placeOfBirth', "g"."place_of_birth", 'documentType', "g"."document_type")) FILTER (WHERE ("g"."id" IS NOT NULL)), '[]'::"jsonb") AS "guests_data",
    COALESCE("jsonb_agg"(DISTINCT "jsonb_build_object"('id', "gs"."id", 'guest_data', "gs"."guest_data", 'document_urls', "gs"."document_urls", 'signature_data', "gs"."signature_data", 'status', "gs"."status", 'submitted_at', "gs"."submitted_at")) FILTER (WHERE ("gs"."id" IS NOT NULL)), '[]'::"jsonb") AS "guest_submissions_data",
    "count"(DISTINCT "g"."id") AS "guest_count",
    "count"(DISTINCT "gs"."id") AS "submission_count",
    ("count"(DISTINCT "gs"."id") > 0) AS "has_submissions",
    (EXISTS ( SELECT 1
           FROM "public"."v_guest_submissions" "gs2"
          WHERE (("gs2"."resolved_booking_id" = "b"."id") AND ("gs2"."signature_data" IS NOT NULL)))) AS "has_signature",
    (EXISTS ( SELECT 1
           FROM "public"."v_guest_submissions" "gs3"
          WHERE (("gs3"."resolved_booking_id" = "b"."id") AND ("gs3"."document_urls" IS NOT NULL) AND ("gs3"."document_urls" <> '[]'::"jsonb")))) AS "has_documents"
   FROM ((("public"."bookings" "b"
     LEFT JOIN "public"."properties" "p" ON (("p"."id" = "b"."property_id")))
     LEFT JOIN "public"."guests" "g" ON (("g"."booking_id" = "b"."id")))
     LEFT JOIN "public"."v_guest_submissions" "gs" ON (("gs"."resolved_booking_id" = "b"."id")))
  GROUP BY "b"."id", "b"."property_id", "b"."user_id", "b"."check_in_date", "b"."check_out_date", "b"."number_of_guests", "b"."booking_reference", "b"."guest_name", "b"."status", "b"."created_at", "b"."updated_at", "b"."documents_generated", "b"."submission_id", "p"."id", "p"."name", "p"."property_type", "p"."max_occupancy", "p"."house_rules", "p"."contract_template"
  WITH NO DATA;


ALTER MATERIALIZED VIEW "public"."mv_bookings_enriched" OWNER TO "postgres";


COMMENT ON MATERIALIZED VIEW "public"."mv_bookings_enriched" IS 'Vue matérialisée pour les réservations enrichies avec données des invités et soumissions. 
Rafraîchissement automatique via triggers. Utilisée pour améliorer les performances des requêtes.';



CREATE OR REPLACE VIEW "public"."profiles" AS
 SELECT "hp"."id",
    "au"."email",
    "hp"."full_name",
    "hp"."avatar_url",
    "hp"."phone",
    "hp"."created_at",
    "hp"."updated_at"
   FROM ("public"."host_profiles" "hp"
     JOIN "auth"."users" "au" ON (("au"."id" = "hp"."id")));


ALTER VIEW "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."system_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "action" "text" NOT NULL,
    "user_id" "uuid",
    "details" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."system_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."token_allocations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "tokens_allocated" integer DEFAULT 0 NOT NULL,
    "tokens_used" integer DEFAULT 0 NOT NULL,
    "tokens_remaining" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "allocated_by" "uuid",
    "notes" "text"
);


ALTER TABLE "public"."token_allocations" OWNER TO "postgres";


COMMENT ON TABLE "public"."token_allocations" IS 'Table des allocations de tokens pour la génération de liens de réservation';



CREATE TABLE IF NOT EXISTS "public"."token_control_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_id" "uuid" NOT NULL,
    "control_type" "text" DEFAULT 'unlimited'::"text" NOT NULL,
    "max_reservations" integer,
    "current_reservations" integer DEFAULT 0,
    "is_enabled" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "token_control_settings_control_type_check" CHECK (("control_type" = ANY (ARRAY['unlimited'::"text", 'limited'::"text", 'blocked'::"text"])))
);


ALTER TABLE "public"."token_control_settings" OWNER TO "postgres";


COMMENT ON TABLE "public"."token_control_settings" IS 'Controls token generation and usage policies';



CREATE TABLE IF NOT EXISTS "public"."uploaded_documents" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "booking_id" "uuid",
    "guest_id" "uuid",
    "file_name" "text" NOT NULL,
    "file_path" "text",
    "processing_status" "text" DEFAULT 'uploading'::"text",
    "extracted_data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "document_url" "text",
    "contract_url" "text",
    "police_form_url" "text",
    "document_type" "text",
    "is_signed" boolean DEFAULT false,
    "signature_data" "text",
    "signed_at" timestamp with time zone
);


ALTER TABLE "public"."uploaded_documents" OWNER TO "postgres";


COMMENT ON TABLE "public"."uploaded_documents" IS 'Unified storage for all guest document records. This is the single source of truth for document URLs, eliminating duplication with guest_submissions.';



CREATE OR REPLACE VIEW "public"."v_booking_health" AS
 SELECT "date"("created_at") AS "date",
    "count"(*) AS "total_bookings",
    "count"("property_id") AS "bookings_with_property",
    ("count"(*) - "count"("property_id")) AS "orphaned_bookings",
    "round"(((100.0 * ("count"("property_id"))::numeric) / ("count"(*))::numeric), 2) AS "health_percentage"
   FROM "public"."bookings"
  GROUP BY ("date"("created_at"))
  ORDER BY ("date"("created_at")) DESC;


ALTER VIEW "public"."v_booking_health" OWNER TO "postgres";


ALTER TABLE ONLY "public"."admin_activity_logs"
    ADD CONSTRAINT "admin_activity_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_statistics"
    ADD CONSTRAINT "admin_statistics_date_key" UNIQUE ("date");



ALTER TABLE ONLY "public"."admin_statistics"
    ADD CONSTRAINT "admin_statistics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_users"
    ADD CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_users"
    ADD CONSTRAINT "admin_users_user_id_unique" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."airbnb_reservations"
    ADD CONSTRAINT "airbnb_reservations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."airbnb_reservations"
    ADD CONSTRAINT "airbnb_reservations_property_id_airbnb_booking_id_key" UNIQUE ("property_id", "airbnb_booking_id");



ALTER TABLE ONLY "public"."airbnb_sync_status"
    ADD CONSTRAINT "airbnb_sync_status_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."airbnb_sync_status"
    ADD CONSTRAINT "airbnb_sync_status_property_id_key" UNIQUE ("property_id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contract_signatures"
    ADD CONSTRAINT "contract_signatures_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."generated_documents"
    ADD CONSTRAINT "generated_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."guest_submissions"
    ADD CONSTRAINT "guest_submissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."guest_verification_tokens"
    ADD CONSTRAINT "guest_verification_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."guest_verification_tokens"
    ADD CONSTRAINT "guest_verification_tokens_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."guests"
    ADD CONSTRAINT "guests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."host_profiles"
    ADD CONSTRAINT "host_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."properties"
    ADD CONSTRAINT "properties_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."property_verification_tokens"
    ADD CONSTRAINT "property_verification_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."property_verification_tokens"
    ADD CONSTRAINT "property_verification_tokens_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."property_verification_tokens"
    ADD CONSTRAINT "pvt_property_airbnb_code_unique" UNIQUE ("property_id", "airbnb_confirmation_code");



ALTER TABLE ONLY "public"."system_logs"
    ADD CONSTRAINT "system_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."token_allocations"
    ADD CONSTRAINT "token_allocations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."token_control_settings"
    ADD CONSTRAINT "token_control_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."uploaded_documents"
    ADD CONSTRAINT "uploaded_documents_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_admin_activity_logs_admin_user_id" ON "public"."admin_activity_logs" USING "btree" ("admin_user_id");



CREATE INDEX "idx_admin_activity_logs_created_at" ON "public"."admin_activity_logs" USING "btree" ("created_at");



CREATE INDEX "idx_admin_statistics_date" ON "public"."admin_statistics" USING "btree" ("date");



CREATE INDEX "idx_admin_users_is_active" ON "public"."admin_users" USING "btree" ("is_active");



CREATE INDEX "idx_admin_users_role" ON "public"."admin_users" USING "btree" ("role");



CREATE INDEX "idx_admin_users_user_id" ON "public"."admin_users" USING "btree" ("user_id");



CREATE INDEX "idx_airbnb_reservations_property_id" ON "public"."airbnb_reservations" USING "btree" ("property_id");



CREATE INDEX "idx_bookings_dates" ON "public"."bookings" USING "btree" ("check_in_date", "check_out_date");



CREATE INDEX "idx_bookings_guest_name" ON "public"."bookings" USING "btree" ("guest_name");



CREATE INDEX "idx_bookings_is_preview" ON "public"."bookings" USING "btree" ("is_preview") WHERE ("is_preview" = true);



CREATE INDEX "idx_bookings_non_draft" ON "public"."bookings" USING "btree" ("property_id", "check_in_date", "check_out_date");



COMMENT ON INDEX "public"."idx_bookings_non_draft" IS 'Index pour les réservations (sera mis à jour avec filtre draft une fois la valeur ajoutée)';



CREATE INDEX "idx_bookings_property_id" ON "public"."bookings" USING "btree" ("property_id");



CREATE INDEX "idx_bookings_property_user" ON "public"."bookings" USING "btree" ("property_id") WHERE ("property_id" IS NOT NULL);



CREATE INDEX "idx_bookings_status" ON "public"."bookings" USING "btree" ("status");



CREATE INDEX "idx_bookings_submission_id" ON "public"."bookings" USING "btree" ("submission_id");



CREATE INDEX "idx_bookings_user_id" ON "public"."bookings" USING "btree" ("user_id");



CREATE INDEX "idx_contract_signatures_booking_id" ON "public"."contract_signatures" USING "btree" ("booking_id");



CREATE INDEX "idx_contract_signatures_signed_at" ON "public"."contract_signatures" USING "btree" ("signed_at");



CREATE INDEX "idx_guest_submissions_booking_id" ON "public"."guest_submissions" USING "btree" ("booking_id");



CREATE INDEX "idx_guest_submissions_property_token_id" ON "public"."guest_submissions" USING "btree" ("token_id");



CREATE INDEX "idx_guest_submissions_status" ON "public"."guest_submissions" USING "btree" ("status");



CREATE INDEX "idx_guest_submissions_token_id" ON "public"."guest_submissions" USING "btree" ("token_id");



CREATE INDEX "idx_host_profiles_company_name" ON "public"."host_profiles" USING "btree" ("company_name") WHERE ("company_name" IS NOT NULL);



CREATE INDEX "idx_host_profiles_full_name" ON "public"."host_profiles" USING "btree" ("full_name") WHERE ("full_name" IS NOT NULL);



CREATE INDEX "idx_host_profiles_user_id" ON "public"."host_profiles" USING "btree" ("id");



CREATE INDEX "idx_mv_bookings_enriched_dates" ON "public"."mv_bookings_enriched" USING "btree" ("check_in_date", "check_out_date") WHERE ("check_in_date" IS NOT NULL);



CREATE INDEX "idx_mv_bookings_enriched_property" ON "public"."mv_bookings_enriched" USING "btree" ("property_id", "check_in_date" DESC);



CREATE INDEX "idx_mv_bookings_enriched_property_dates" ON "public"."mv_bookings_enriched" USING "btree" ("property_id", "check_in_date", "check_out_date");



CREATE INDEX "idx_mv_bookings_enriched_status" ON "public"."mv_bookings_enriched" USING "btree" ("status", "check_in_date" DESC);



CREATE INDEX "idx_mv_bookings_enriched_user" ON "public"."mv_bookings_enriched" USING "btree" ("user_id", "check_in_date" DESC);



CREATE INDEX "idx_properties_city" ON "public"."properties" USING "btree" ("city");



CREATE INDEX "idx_properties_is_active" ON "public"."properties" USING "btree" ("is_active");



CREATE INDEX "idx_properties_price" ON "public"."properties" USING "btree" ("price_per_night");



CREATE INDEX "idx_properties_user_id" ON "public"."properties" USING "btree" ("user_id");



CREATE INDEX "idx_property_verification_tokens_booking_id" ON "public"."property_verification_tokens" USING "btree" ("booking_id");



CREATE INDEX "idx_property_verification_tokens_expires_at" ON "public"."property_verification_tokens" USING "btree" ("expires_at");



CREATE INDEX "idx_property_verification_tokens_property_id" ON "public"."property_verification_tokens" USING "btree" ("property_id");



CREATE INDEX "idx_property_verification_tokens_token" ON "public"."property_verification_tokens" USING "btree" ("token");



CREATE INDEX "idx_pvt_access_code_hash" ON "public"."property_verification_tokens" USING "btree" ("access_code_hash") WHERE ("access_code_hash" IS NOT NULL);



CREATE INDEX "idx_system_logs_action" ON "public"."system_logs" USING "btree" ("action");



CREATE INDEX "idx_system_logs_created_at" ON "public"."system_logs" USING "btree" ("created_at");



CREATE INDEX "idx_system_logs_user_id" ON "public"."system_logs" USING "btree" ("user_id");



CREATE INDEX "idx_token_allocations_active" ON "public"."token_allocations" USING "btree" ("is_active");



CREATE INDEX "idx_token_allocations_user_id" ON "public"."token_allocations" USING "btree" ("user_id");



CREATE INDEX "idx_token_control_settings_control_type" ON "public"."token_control_settings" USING "btree" ("control_type");



CREATE INDEX "idx_token_control_settings_created_at" ON "public"."token_control_settings" USING "btree" ("created_at");



CREATE UNIQUE INDEX "idx_token_control_settings_property_id" ON "public"."token_control_settings" USING "btree" ("property_id");



CREATE INDEX "idx_uploaded_documents_booking_id" ON "public"."uploaded_documents" USING "btree" ("booking_id");



CREATE INDEX "idx_uploaded_documents_booking_type" ON "public"."uploaded_documents" USING "btree" ("booking_id", "document_type");



CREATE INDEX "idx_uploaded_documents_document_type" ON "public"."uploaded_documents" USING "btree" ("document_type");



CREATE INDEX "idx_uploaded_documents_is_signed" ON "public"."uploaded_documents" USING "btree" ("is_signed");



CREATE INDEX "idx_uploaded_documents_url_not_null" ON "public"."uploaded_documents" USING "btree" ("booking_id") WHERE ("document_url" IS NOT NULL);



CREATE OR REPLACE TRIGGER "ensure_booking_has_user_id" BEFORE INSERT OR UPDATE ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."validate_booking_user_id"();



CREATE OR REPLACE TRIGGER "refresh_bookings_enriched_on_booking_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."bookings" FOR EACH STATEMENT EXECUTE FUNCTION "public"."trigger_refresh_bookings_enriched"();



CREATE OR REPLACE TRIGGER "refresh_bookings_enriched_on_guest_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."guests" FOR EACH STATEMENT EXECUTE FUNCTION "public"."trigger_refresh_bookings_enriched"();



CREATE OR REPLACE TRIGGER "refresh_bookings_enriched_on_submission_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."guest_submissions" FOR EACH STATEMENT EXECUTE FUNCTION "public"."trigger_refresh_bookings_enriched"();



CREATE OR REPLACE TRIGGER "trg_after_contract_signature_insert" AFTER INSERT ON "public"."contract_signatures" FOR EACH ROW EXECUTE FUNCTION "public"."handle_contract_signature_insert"();



CREATE OR REPLACE TRIGGER "trg_airbnb_reservations_updated_at" BEFORE UPDATE ON "public"."airbnb_reservations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_airbnb_sync_status_updated_at" BEFORE UPDATE ON "public"."airbnb_sync_status" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_guest_submissions_updated_at" BEFORE UPDATE ON "public"."guest_submissions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_guest_verification_tokens_updated_at" BEFORE UPDATE ON "public"."guest_verification_tokens" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trigger_contract_signature_insert" AFTER INSERT ON "public"."contract_signatures" FOR EACH ROW EXECUTE FUNCTION "public"."handle_contract_signature_insert"();



CREATE OR REPLACE TRIGGER "trigger_update_admin_users_updated_at" BEFORE UPDATE ON "public"."admin_users" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trigger_update_host_full_name" BEFORE INSERT OR UPDATE ON "public"."host_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_host_full_name"();



CREATE OR REPLACE TRIGGER "trigger_update_token_allocations_updated_at" BEFORE UPDATE ON "public"."token_allocations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trigger_update_token_control_settings_updated_at" BEFORE UPDATE ON "public"."token_control_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_token_control_settings_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_tokens_remaining" BEFORE INSERT OR UPDATE ON "public"."token_allocations" FOR EACH ROW EXECUTE FUNCTION "public"."update_tokens_remaining"();



CREATE OR REPLACE TRIGGER "validate_token_booking_id" BEFORE INSERT OR UPDATE ON "public"."property_verification_tokens" FOR EACH ROW EXECUTE FUNCTION "public"."validate_booking_id_format"();



ALTER TABLE ONLY "public"."admin_activity_logs"
    ADD CONSTRAINT "admin_activity_logs_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."admin_users"
    ADD CONSTRAINT "admin_users_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."admin_users"
    ADD CONSTRAINT "admin_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."contract_signatures"
    ADD CONSTRAINT "contract_signatures_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."guest_submissions"
    ADD CONSTRAINT "fk_guest_submissions_property_token_id" FOREIGN KEY ("token_id") REFERENCES "public"."property_verification_tokens"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."guest_submissions"
    ADD CONSTRAINT "fk_guest_submissions_token_id" FOREIGN KEY ("token_id") REFERENCES "public"."property_verification_tokens"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."property_verification_tokens"
    ADD CONSTRAINT "fk_property_verification_tokens_property_id" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."token_control_settings"
    ADD CONSTRAINT "fk_token_control_settings_property_id" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."generated_documents"
    ADD CONSTRAINT "generated_documents_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."generated_documents"
    ADD CONSTRAINT "generated_documents_signature_id_fkey" FOREIGN KEY ("signature_id") REFERENCES "public"."contract_signatures"("id");



ALTER TABLE ONLY "public"."guest_submissions"
    ADD CONSTRAINT "guest_submissions_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id");



ALTER TABLE ONLY "public"."guests"
    ADD CONSTRAINT "guests_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."host_profiles"
    ADD CONSTRAINT "host_profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."properties"
    ADD CONSTRAINT "properties_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."system_logs"
    ADD CONSTRAINT "system_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."token_allocations"
    ADD CONSTRAINT "token_allocations_allocated_by_fkey" FOREIGN KEY ("allocated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."token_allocations"
    ADD CONSTRAINT "token_allocations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."uploaded_documents"
    ADD CONSTRAINT "uploaded_documents_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."uploaded_documents"
    ADD CONSTRAINT "uploaded_documents_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE CASCADE;



CREATE POLICY "Admins can create logs" ON "public"."system_logs" FOR INSERT WITH CHECK (true);



CREATE POLICY "Admins can delete logs" ON "public"."system_logs" FOR DELETE USING (true);



CREATE POLICY "Admins can update logs" ON "public"."system_logs" FOR UPDATE USING (true);



CREATE POLICY "Admins can view all admin records" ON "public"."admin_users" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."admin_users" "au"
  WHERE (("au"."user_id" = "auth"."uid"()) AND ("au"."role" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"])) AND ("au"."is_active" = true)))));



CREATE POLICY "Admins can view all logs" ON "public"."system_logs" FOR SELECT USING (true);



CREATE POLICY "Admins can view all token allocations" ON "public"."token_allocations" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."admin_users" "au"
  WHERE (("au"."user_id" = "auth"."uid"()) AND ("au"."role" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"]))))));



CREATE POLICY "Allow unauthenticated token verification" ON "public"."property_verification_tokens" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Anyone can create submissions with valid token" ON "public"."guest_submissions" FOR INSERT WITH CHECK (("token_id" IN ( SELECT "property_verification_tokens"."id"
   FROM "public"."property_verification_tokens"
  WHERE ("property_verification_tokens"."is_active" = true))));



CREATE POLICY "Authenticated users can manage their bookings" ON "public"."bookings" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Authenticated users can manage their properties" ON "public"."properties" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Guest submissions can be created via tokens" ON "public"."guest_submissions" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."property_verification_tokens"
  WHERE (("property_verification_tokens"."id" = "guest_submissions"."token_id") AND ("property_verification_tokens"."is_active" = true)))));



CREATE POLICY "Host can insert own profile" ON "public"."host_profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Host can update own profile" ON "public"."host_profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Host can view own profile" ON "public"."host_profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Manage contract signatures" ON "public"."contract_signatures" USING (("booking_id" IN ( SELECT "b"."id"
   FROM ("public"."bookings" "b"
     JOIN "public"."properties" "p" ON (("b"."property_id" = "p"."id")))
  WHERE ("p"."user_id" = "auth"."uid"()))));



CREATE POLICY "Property owners can manage their tokens" ON "public"."property_verification_tokens" USING (("property_id" IN ( SELECT "properties"."id"
   FROM "public"."properties"
  WHERE ("properties"."user_id" = "auth"."uid"()))));



CREATE POLICY "Public can create submissions for active tokens" ON "public"."guest_submissions" FOR INSERT WITH CHECK (("token_id" IN ( SELECT "property_verification_tokens"."id"
   FROM "public"."property_verification_tokens"
  WHERE ("property_verification_tokens"."is_active" = true))));



CREATE POLICY "Public can update submissions for active tokens" ON "public"."guest_submissions" FOR UPDATE USING (("token_id" IN ( SELECT "property_verification_tokens"."id"
   FROM "public"."property_verification_tokens"
  WHERE ("property_verification_tokens"."is_active" = true))));



CREATE POLICY "Public can view active tokens" ON "public"."property_verification_tokens" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Public can view contract signatures" ON "public"."contract_signatures" FOR SELECT USING (true);



CREATE POLICY "Public can view properties" ON "public"."properties" FOR SELECT USING (true);



CREATE POLICY "Public can view submissions for active tokens" ON "public"."guest_submissions" FOR SELECT USING (("token_id" IN ( SELECT "property_verification_tokens"."id"
   FROM "public"."property_verification_tokens"
  WHERE ("property_verification_tokens"."is_active" = true))));



CREATE POLICY "Super admins can insert admin users" ON "public"."admin_users" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."admin_users" "au"
  WHERE (("au"."user_id" = "auth"."uid"()) AND ("au"."role" = 'super_admin'::"text") AND ("au"."is_active" = true)))));



CREATE POLICY "Super admins can manage admin users" ON "public"."admin_users" USING ((EXISTS ( SELECT 1
   FROM "public"."admin_users" "au"
  WHERE (("au"."user_id" = "auth"."uid"()) AND ("au"."role" = 'super_admin'::"text") AND ("au"."is_active" = true)))));



CREATE POLICY "Users can create documents for their bookings" ON "public"."uploaded_documents" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."bookings"
  WHERE (("bookings"."id" = "uploaded_documents"."booking_id") AND (("bookings"."user_id" = "auth"."uid"()) OR ("bookings"."property_id" IN ( SELECT "properties"."id"
           FROM "public"."properties"
          WHERE ("properties"."user_id" = "auth"."uid"()))))))));



CREATE POLICY "Users can create guests for their bookings" ON "public"."guests" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."bookings"
  WHERE (("bookings"."id" = "guests"."booking_id") AND ("bookings"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can create own profile" ON "public"."host_profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can create properties" ON "public"."properties" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can create their own properties" ON "public"."properties" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create tokens for their properties" ON "public"."property_verification_tokens" FOR INSERT WITH CHECK (("property_id" IN ( SELECT "properties"."id"
   FROM "public"."properties"
  WHERE ("properties"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can delete documents for their bookings" ON "public"."uploaded_documents" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."bookings"
  WHERE (("bookings"."id" = "uploaded_documents"."booking_id") AND (("bookings"."user_id" = "auth"."uid"()) OR ("bookings"."property_id" IN ( SELECT "properties"."id"
           FROM "public"."properties"
          WHERE ("properties"."user_id" = "auth"."uid"()))))))));



CREATE POLICY "Users can delete guests for their bookings" ON "public"."guests" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."bookings"
  WHERE (("bookings"."id" = "guests"."booking_id") AND (("bookings"."user_id" = "auth"."uid"()) OR ("bookings"."property_id" IN ( SELECT "properties"."id"
           FROM "public"."properties"
          WHERE ("properties"."user_id" = "auth"."uid"()))))))));



CREATE POLICY "Users can delete own profile" ON "public"."host_profiles" FOR DELETE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can delete submissions for their properties" ON "public"."guest_submissions" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM ("public"."property_verification_tokens" "pvt"
     JOIN "public"."properties" "p" ON (("p"."id" = "pvt"."property_id")))
  WHERE (("pvt"."id" = "guest_submissions"."token_id") AND ("p"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can delete their own bookings" ON "public"."bookings" FOR DELETE USING ((("user_id" = "auth"."uid"()) OR ("property_id" IN ( SELECT "properties"."id"
   FROM "public"."properties"
  WHERE ("properties"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can delete their own properties" ON "public"."properties" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can delete token control settings" ON "public"."token_control_settings" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Users can insert token control settings" ON "public"."token_control_settings" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Users can read their own admin record" ON "public"."admin_users" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update documents for their bookings" ON "public"."uploaded_documents" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."bookings"
  WHERE (("bookings"."id" = "uploaded_documents"."booking_id") AND (("bookings"."user_id" = "auth"."uid"()) OR ("bookings"."property_id" IN ( SELECT "properties"."id"
           FROM "public"."properties"
          WHERE ("properties"."user_id" = "auth"."uid"()))))))));



CREATE POLICY "Users can update guests for their bookings" ON "public"."guests" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."bookings"
  WHERE (("bookings"."id" = "guests"."booking_id") AND (("bookings"."user_id" = "auth"."uid"()) OR ("bookings"."property_id" IN ( SELECT "properties"."id"
           FROM "public"."properties"
          WHERE ("properties"."user_id" = "auth"."uid"()))))))));



CREATE POLICY "Users can update own profile" ON "public"."host_profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update submissions for their properties" ON "public"."guest_submissions" FOR UPDATE USING (("token_id" IN ( SELECT "property_verification_tokens"."id"
   FROM "public"."property_verification_tokens"
  WHERE ("property_verification_tokens"."property_id" IN ( SELECT "properties"."id"
           FROM "public"."properties"
          WHERE ("properties"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can update their own bookings" ON "public"."bookings" FOR UPDATE USING ((("user_id" = "auth"."uid"()) OR ("property_id" IN ( SELECT "properties"."id"
   FROM "public"."properties"
  WHERE ("properties"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can update their own properties" ON "public"."properties" FOR UPDATE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update token control settings" ON "public"."token_control_settings" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "Users can update tokens for their properties" ON "public"."property_verification_tokens" FOR UPDATE USING (("property_id" IN ( SELECT "properties"."id"
   FROM "public"."properties"
  WHERE ("properties"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view documents for their bookings" ON "public"."uploaded_documents" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."bookings"
  WHERE (("bookings"."id" = "uploaded_documents"."booking_id") AND (("bookings"."user_id" = "auth"."uid"()) OR ("bookings"."property_id" IN ( SELECT "properties"."id"
           FROM "public"."properties"
          WHERE ("properties"."user_id" = "auth"."uid"()))))))));



CREATE POLICY "Users can view guests for their bookings" ON "public"."guests" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."bookings"
  WHERE (("bookings"."id" = "guests"."booking_id") AND (("bookings"."user_id" = "auth"."uid"()) OR ("bookings"."property_id" IN ( SELECT "properties"."id"
           FROM "public"."properties"
          WHERE ("properties"."user_id" = "auth"."uid"()))))))));



CREATE POLICY "Users can view own profile" ON "public"."host_profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view submissions for their properties" ON "public"."guest_submissions" FOR SELECT USING (("token_id" IN ( SELECT "property_verification_tokens"."id"
   FROM "public"."property_verification_tokens"
  WHERE ("property_verification_tokens"."property_id" IN ( SELECT "properties"."id"
           FROM "public"."properties"
          WHERE ("properties"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can view their own bookings" ON "public"."bookings" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR ("property_id" IN ( SELECT "properties"."id"
   FROM "public"."properties"
  WHERE ("properties"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view their own properties" ON "public"."properties" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view token control settings" ON "public"."token_control_settings" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can view tokens for their properties" ON "public"."property_verification_tokens" FOR SELECT USING (("property_id" IN ( SELECT "properties"."id"
   FROM "public"."properties"
  WHERE ("properties"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users manage their property bookings" ON "public"."bookings" USING (("property_id" IN ( SELECT "properties"."id"
   FROM "public"."properties"
  WHERE ("properties"."user_id" = "auth"."uid"())))) WITH CHECK (("property_id" IN ( SELECT "properties"."id"
   FROM "public"."properties"
  WHERE ("properties"."user_id" = "auth"."uid"()))));



CREATE POLICY "admin_access_only" ON "public"."admin_users" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."admin_activity_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admin_activity_logs_access" ON "public"."admin_activity_logs" USING (("auth"."uid"() IN ( SELECT "admin_users"."user_id"
   FROM "public"."admin_users"
  WHERE ("admin_users"."is_active" = true))));



ALTER TABLE "public"."admin_statistics" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admin_statistics_access" ON "public"."admin_statistics" USING (("auth"."uid"() IN ( SELECT "admin_users"."user_id"
   FROM "public"."admin_users"
  WHERE ("admin_users"."is_active" = true))));



ALTER TABLE "public"."admin_users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."airbnb_reservations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."airbnb_sync_status" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contract_signatures" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "contract_signatures_delete_policy" ON "public"."contract_signatures" FOR DELETE USING (true);



CREATE POLICY "contract_signatures_select_own" ON "public"."contract_signatures" FOR SELECT USING (("booking_id" IN ( SELECT "bookings"."id"
   FROM "public"."bookings"
  WHERE ("bookings"."property_id" IN ( SELECT "properties"."id"
           FROM "public"."properties"
          WHERE ("properties"."user_id" = "auth"."uid"()))))));



CREATE POLICY "contract_signatures_select_policy" ON "public"."contract_signatures" FOR SELECT USING (true);



CREATE POLICY "contract_signatures_update_edge_functions" ON "public"."contract_signatures" FOR UPDATE USING (true) WITH CHECK (true);



CREATE POLICY "contract_signatures_update_policy" ON "public"."contract_signatures" FOR UPDATE USING (true);



ALTER TABLE "public"."guest_verification_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."host_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."property_verification_tokens" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "read_admin_users" ON "public"."admin_users" FOR SELECT USING (true);



CREATE POLICY "read_all_authenticated" ON "public"."token_control_settings" FOR SELECT USING (true);



CREATE POLICY "read_res_by_property_members" ON "public"."airbnb_reservations" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."properties"
  WHERE (("properties"."id" = "airbnb_reservations"."property_id") AND ("properties"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."system_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."token_allocations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "token_allocations_policy" ON "public"."token_allocations" USING ((EXISTS ( SELECT 1
   FROM "public"."admin_users" "au"
  WHERE (("au"."user_id" = "auth"."uid"()) AND ("au"."is_active" = true)))));



ALTER TABLE "public"."token_control_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."uploaded_documents" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."check_contract_signature"("p_submission_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_contract_signature"("p_submission_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_contract_signature"("p_submission_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_property_with_reservations"("p_property_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_property_with_reservations"("p_property_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_property_with_reservations"("p_property_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_admin_user_by_id"("user_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_admin_user_by_id"("user_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_admin_user_by_id"("user_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_all_users_for_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_all_users_for_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_all_users_for_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_booking_guest_count"("p_booking_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_booking_guest_count"("p_booking_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_booking_guest_count"("p_booking_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_dashboard_stats_real"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_dashboard_stats_real"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_dashboard_stats_real"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_property_for_verification"("p_property_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_property_for_verification"("p_property_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_property_for_verification"("p_property_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_signed_contracts_for_user"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_signed_contracts_for_user"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_signed_contracts_for_user"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."admin_users" TO "anon";
GRANT ALL ON TABLE "public"."admin_users" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_users" TO "service_role";



GRANT ALL ON FUNCTION "public"."get_users_for_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_users_for_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_users_for_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_contract_signature_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_contract_signature_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_contract_signature_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_reservation_count"("property_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_reservation_count"("property_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_reservation_count"("property_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."insert_contract_signature"("p_booking_id" "uuid", "p_signature_data" "text", "p_contract_content" "text", "p_user_agent" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."insert_contract_signature"("p_booking_id" "uuid", "p_signature_data" "text", "p_contract_content" "text", "p_user_agent" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."insert_contract_signature"("p_booking_id" "uuid", "p_signature_data" "text", "p_contract_content" "text", "p_user_agent" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."insert_contract_signature"("p_booking_id" "uuid", "p_signature_data" "text", "p_contract_content" "text", "p_ip_address" "text", "p_user_agent" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."insert_contract_signature"("p_booking_id" "uuid", "p_signature_data" "text", "p_contract_content" "text", "p_ip_address" "text", "p_user_agent" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."insert_contract_signature"("p_booking_id" "uuid", "p_signature_data" "text", "p_contract_content" "text", "p_ip_address" "text", "p_user_agent" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."insert_contract_signature_data"("p_booking_id" "uuid", "p_signature_data" "text", "p_contract_content" "text", "p_user_agent" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."insert_contract_signature_data"("p_booking_id" "uuid", "p_signature_data" "text", "p_contract_content" "text", "p_user_agent" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."insert_contract_signature_data"("p_booking_id" "uuid", "p_signature_data" "text", "p_contract_content" "text", "p_user_agent" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_bookings_enriched"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_bookings_enriched"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_bookings_enriched"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_booking_guests"("p_booking_id" "uuid", "p_guests" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."sync_booking_guests"("p_booking_id" "uuid", "p_guests" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_booking_guests"("p_booking_id" "uuid", "p_guests" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_refresh_bookings_enriched"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_refresh_bookings_enriched"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_refresh_bookings_enriched"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_host_full_name"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_host_full_name"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_host_full_name"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_token_control_settings_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_token_control_settings_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_token_control_settings_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_tokens_remaining"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_tokens_remaining"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_tokens_remaining"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_booking_id_format"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_booking_id_format"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_booking_id_format"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_booking_user_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_booking_user_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_booking_user_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."verify_property_token"("p_property_id" "uuid", "p_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."verify_property_token"("p_property_id" "uuid", "p_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."verify_property_token"("p_property_id" "uuid", "p_token" "text") TO "service_role";



GRANT ALL ON TABLE "public"."admin_activity_logs" TO "anon";
GRANT ALL ON TABLE "public"."admin_activity_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_activity_logs" TO "service_role";



GRANT ALL ON TABLE "public"."admin_statistics" TO "anon";
GRANT ALL ON TABLE "public"."admin_statistics" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_statistics" TO "service_role";



GRANT ALL ON TABLE "public"."airbnb_reservations" TO "anon";
GRANT ALL ON TABLE "public"."airbnb_reservations" TO "authenticated";
GRANT ALL ON TABLE "public"."airbnb_reservations" TO "service_role";



GRANT ALL ON TABLE "public"."airbnb_sync_status" TO "anon";
GRANT ALL ON TABLE "public"."airbnb_sync_status" TO "authenticated";
GRANT ALL ON TABLE "public"."airbnb_sync_status" TO "service_role";



GRANT ALL ON TABLE "public"."bookings" TO "anon";
GRANT ALL ON TABLE "public"."bookings" TO "authenticated";
GRANT ALL ON TABLE "public"."bookings" TO "service_role";



GRANT ALL ON TABLE "public"."bookings_backup_20250127" TO "anon";
GRANT ALL ON TABLE "public"."bookings_backup_20250127" TO "authenticated";
GRANT ALL ON TABLE "public"."bookings_backup_20250127" TO "service_role";



GRANT ALL ON TABLE "public"."contract_signatures" TO "anon";
GRANT ALL ON TABLE "public"."contract_signatures" TO "authenticated";
GRANT ALL ON TABLE "public"."contract_signatures" TO "service_role";



GRANT ALL ON TABLE "public"."generated_documents" TO "anon";
GRANT ALL ON TABLE "public"."generated_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."generated_documents" TO "service_role";



GRANT ALL ON TABLE "public"."guest_submissions" TO "anon";
GRANT ALL ON TABLE "public"."guest_submissions" TO "authenticated";
GRANT ALL ON TABLE "public"."guest_submissions" TO "service_role";



GRANT ALL ON TABLE "public"."guest_submissions_backup_20250127" TO "anon";
GRANT ALL ON TABLE "public"."guest_submissions_backup_20250127" TO "authenticated";
GRANT ALL ON TABLE "public"."guest_submissions_backup_20250127" TO "service_role";



GRANT ALL ON TABLE "public"."guest_verification_tokens" TO "anon";
GRANT ALL ON TABLE "public"."guest_verification_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."guest_verification_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."guests" TO "anon";
GRANT ALL ON TABLE "public"."guests" TO "authenticated";
GRANT ALL ON TABLE "public"."guests" TO "service_role";



GRANT ALL ON TABLE "public"."host_profiles" TO "anon";
GRANT ALL ON TABLE "public"."host_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."host_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."properties" TO "anon";
GRANT ALL ON TABLE "public"."properties" TO "authenticated";
GRANT ALL ON TABLE "public"."properties" TO "service_role";



GRANT ALL ON TABLE "public"."host_dashboard_view" TO "anon";
GRANT ALL ON TABLE "public"."host_dashboard_view" TO "authenticated";
GRANT ALL ON TABLE "public"."host_dashboard_view" TO "service_role";



GRANT ALL ON TABLE "public"."property_verification_tokens" TO "anon";
GRANT ALL ON TABLE "public"."property_verification_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."property_verification_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."v_guest_submissions" TO "anon";
GRANT ALL ON TABLE "public"."v_guest_submissions" TO "authenticated";
GRANT ALL ON TABLE "public"."v_guest_submissions" TO "service_role";



GRANT ALL ON TABLE "public"."mv_bookings_enriched" TO "anon";
GRANT ALL ON TABLE "public"."mv_bookings_enriched" TO "authenticated";
GRANT ALL ON TABLE "public"."mv_bookings_enriched" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."system_logs" TO "anon";
GRANT ALL ON TABLE "public"."system_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."system_logs" TO "service_role";



GRANT ALL ON TABLE "public"."token_allocations" TO "anon";
GRANT ALL ON TABLE "public"."token_allocations" TO "authenticated";
GRANT ALL ON TABLE "public"."token_allocations" TO "service_role";



GRANT ALL ON TABLE "public"."token_control_settings" TO "anon";
GRANT ALL ON TABLE "public"."token_control_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."token_control_settings" TO "service_role";



GRANT ALL ON TABLE "public"."uploaded_documents" TO "anon";
GRANT ALL ON TABLE "public"."uploaded_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."uploaded_documents" TO "service_role";



GRANT ALL ON TABLE "public"."v_booking_health" TO "anon";
GRANT ALL ON TABLE "public"."v_booking_health" TO "authenticated";
GRANT ALL ON TABLE "public"."v_booking_health" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






RESET ALL;
