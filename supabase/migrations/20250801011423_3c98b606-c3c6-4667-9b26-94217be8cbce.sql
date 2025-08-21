-- Fix existing bookings with null property_id
-- Get the first property ID for assignment
WITH first_property AS (
  SELECT id FROM properties ORDER BY created_at LIMIT 1
),
second_property AS (
  SELECT id FROM properties ORDER BY created_at OFFSET 1 LIMIT 1
),
bookings_to_fix AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) as row_num
  FROM bookings 
  WHERE property_id IS NULL
)
UPDATE bookings 
SET property_id = CASE 
  WHEN bookings_to_fix.row_num = 1 THEN (SELECT id FROM first_property)
  ELSE (SELECT id FROM second_property)
END
FROM bookings_to_fix
WHERE bookings.id = bookings_to_fix.id;