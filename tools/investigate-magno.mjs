/**
 * Investigation Magno / tokens / dates — lecture seule
 * Usage: node tools/investigate-magno.mjs
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';

dotenv.config();

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SB_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_KEY;

if (!url || !key) {
  console.error('Missing SUPABASE_URL or service role key in .env');
  process.exit(1);
}

const supabase = createClient(url, key);

async function q(label, fn) {
  console.log('\n=== ' + label + ' ===');
  const r = await fn();
  if (r.error) {
    console.error('ERROR:', r.error.message, r.error.details || '');
    return null;
  }
  console.log(JSON.stringify(r.data, null, 2));
  return r.data;
}

// 1) Property La pépite / Gauthier
const props = await q('Properties (Gauthier / pépite)', () =>
  supabase
    .from('properties')
    .select('id, name, user_id')
    .or('name.ilike.%Gauthier%,name.ilike.%pépite%,name.ilike.%pepite%')
);

const propertyIds = (props || []).map((p) => p.id);

// 2) Bookings May 13-15 2026 on those properties
if (propertyIds.length) {
  await q('Bookings 2026-05-13..15 on property', () =>
    supabase
      .from('bookings')
      .select('id, property_id, booking_reference, guest_name, check_in_date, check_out_date, number_of_guests, status, created_at, updated_at')
      .in('property_id', propertyIds)
      .eq('check_in_date', '2026-05-13')
      .eq('check_out_date', '2026-05-15')
      .order('updated_at', { ascending: false })
  );

  await q('Bookings July 2026 on property (10-12)', () =>
    supabase
      .from('bookings')
      .select('id, property_id, booking_reference, guest_name, check_in_date, check_out_date, status')
      .in('property_id', propertyIds)
      .gte('check_in_date', '2026-07-01')
      .lte('check_in_date', '2026-07-31')
      .order('check_in_date')
  );
}

// 3) Search Magno everywhere
await q('guests full_name ilike Magno', () =>
  supabase.from('guests').select('id, booking_id, full_name, created_at, updated_at').ilike('full_name', '%Magno%')
);

await q('bookings guest_name ilike Magno', () =>
  supabase
    .from('bookings')
    .select('id, property_id, guest_name, check_in_date, check_out_date, booking_reference')
    .ilike('guest_name', '%Magno%')
);

// 4) Target booking Magno (May 13-15)
const MAGNO_BOOKING = '29168681-a9db-400d-b2ea-ca8f7ae7fa1d';

await q('guest_submissions for Magno booking', () =>
  supabase
    .from('guest_submissions')
    .select('id, booking_id, token_id, updated_at, guest_data, booking_data')
    .eq('booking_id', MAGNO_BOOKING)
    .order('updated_at', { ascending: false })
);

// Fallback: get tokens for May booking if we found one
const mayBookings = propertyIds.length
  ? (
      await supabase
        .from('bookings')
        .select('id')
        .in('property_id', propertyIds)
        .eq('check_in_date', '2026-05-13')
        .eq('check_out_date', '2026-05-15')
    ).data
  : [];

for (const b of mayBookings || []) {
  await q(`Tokens for booking ${b.id}`, () =>
    supabase
      .from('property_verification_tokens')
      .select('id, token, booking_id, created_at, is_active, metadata, airbnb_confirmation_code')
      .eq('booking_id', b.id)
      .order('created_at', { ascending: true })
  );

  await q(`guests for booking ${b.id}`, () =>
    supabase.from('guests').select('*').eq('booking_id', b.id)
  );

  await q(`submissions for booking ${b.id}`, () =>
    supabase
      .from('guest_submissions')
      .select('id, token_id, updated_at, guest_data, booking_data')
      .eq('booking_id', b.id)
      .order('updated_at', { ascending: false })
  );

  await q(`contracts for booking ${b.id}`, () =>
    supabase
      .from('generated_documents')
      .select('id, created_at, is_signed, document_type')
      .eq('booking_id', b.id)
      .order('created_at', { ascending: false })
  );
}

// 5) Count tokens per booking for this property (top offenders)
if (propertyIds.length) {
  const { data: allTokens } = await supabase
    .from('property_verification_tokens')
    .select('id, booking_id, created_at, metadata')
    .in(
      'booking_id',
      (
        await supabase.from('bookings').select('id').in('property_id', propertyIds)
      ).data?.map((x) => x.id) || []
    );

  const counts = {};
  for (const t of allTokens || []) {
    if (!t.booking_id) continue;
    counts[t.booking_id] = (counts[t.booking_id] || 0) + 1;
  }
  const top = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  console.log('\n=== Top bookings by token count (property) ===');
  console.log(JSON.stringify(top, null, 2));
}
