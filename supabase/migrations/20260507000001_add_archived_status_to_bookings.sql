-- Add 'archived' value to the booking_status enum so hosts can archive completed bookings.
-- ALTER TYPE … ADD VALUE is transactional-safe with IF NOT EXISTS.

ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'archived';

COMMENT ON TYPE booking_status IS
  'Booking statuses: draft (unvalidated), pending (awaiting docs), completed (all docs done), confirmed, archived (manually archived by host)';
