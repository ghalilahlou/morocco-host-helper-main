-- Fix bookings that were incorrectly set to 'completed' without having
-- both contract and police form generated. Downgrade them to 'confirmed'
-- (reservation matched/verified but documents still pending).

UPDATE public.bookings
SET status = 'confirmed',
    updated_at = now()
WHERE status = 'completed'
  AND (
    documents_generated IS NULL
    OR (documents_generated->>'contract')::boolean IS NOT TRUE
    OR (documents_generated->>'policeForm')::boolean IS NOT TRUE
  );
