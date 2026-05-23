/**
 * Audit exhaustif conflits de dates : bookings vs submissions vs tokens
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SB_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_KEY;

if (!url || !key) {
  console.error('Missing SUPABASE_URL or service role');
  process.exit(1);
}

const supabase = createClient(url, key);

function extractDates(obj) {
  if (!obj) return { in: null, out: null };
  const bd = obj.booking_data || obj;
  return {
    in: bd.checkIn || bd.check_in_date || bd.startDate || null,
    out: bd.checkOut || bd.check_out_date || bd.endDate || null,
  };
}

function norm(d) {
  if (!d) return null;
  return String(d).slice(0, 10);
}

// --- Samia / Sakara search ---
for (const term of ['samia', 'sakara', 'sakura']) {
  const { data: guests } = await supabase
    .from('guests')
    .select('id, booking_id, full_name, created_at')
    .ilike('full_name', `%${term}%`);

  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, guest_name, check_in_date, check_out_date, property_id, booking_reference, created_at, updated_at')
    .ilike('guest_name', `%${term}%`);

  console.log(`\n=== SEARCH: ${term} ===`);
  console.log('guests:', guests?.length || 0, JSON.stringify(guests, null, 2));
  console.log('bookings:', bookings?.length || 0, JSON.stringify(bookings, null, 2));
}

// --- Mass audit: submission dates vs booking dates ---
const { data: subs } = await supabase
  .from('guest_submissions')
  .select('id, booking_id, token_id, booking_data, guest_data, updated_at')
  .not('booking_id', 'is', null)
  .order('updated_at', { ascending: false })
  .limit(200);

const dateConflicts = [];
const tokenConflicts = [];

for (const s of subs || []) {
  const { data: b } = await supabase
    .from('bookings')
    .select('id, guest_name, check_in_date, check_out_date, property_id')
    .eq('id', s.booking_id)
    .maybeSingle();
  if (!b) continue;

  const subDates = extractDates(s);
  const bookIn = norm(b.check_in_date);
  const bookOut = norm(b.check_out_date);
  const subIn = norm(subDates.in);
  const subOut = norm(subDates.out);

  if (subIn && subOut && bookIn && bookOut && (subIn !== bookIn || subOut !== bookOut)) {
    const names = (s.guest_data?.guests || [])
      .map((g) => g.fullName || g.full_name)
      .filter(Boolean)
      .join(' | ');
    dateConflicts.push({
      booking_id: b.id,
      booking_guest_name: b.guest_name,
      submission_guests: names,
      booking_dates: `${bookIn} → ${bookOut}`,
      submission_dates: `${subIn} → ${subOut}`,
      submission_updated: s.updated_at,
    });
  }

  if (s.token_id) {
    const { data: tok } = await supabase
      .from('property_verification_tokens')
      .select('id, booking_id, metadata, created_at')
      .eq('id', s.token_id)
      .maybeSingle();
    if (tok?.metadata?.reservationData) {
      const meta = tok.metadata.reservationData;
      const metaIn = norm(meta.startDate);
      const metaOut = norm(meta.endDate);
      if (metaIn && metaOut && (metaIn !== bookIn || metaOut !== bookOut)) {
        tokenConflicts.push({
          booking_id: b.id,
          guest_name: b.guest_name,
          booking_dates: `${bookIn} → ${bookOut}`,
          token_dates: `${metaIn} → ${metaOut}`,
          token_booking_id: tok.booking_id,
          token_id: tok.id,
        });
      }
    }
  }
}

// INDEPENDENT: same property overlapping stays with wrong guest on booking
const { data: independent } = await supabase
  .from('bookings')
  .select('id, property_id, guest_name, check_in_date, check_out_date, updated_at')
  .eq('booking_reference', 'INDEPENDENT_BOOKING')
  .gte('check_in_date', '2026-05-01')
  .lte('check_in_date', '2026-05-31')
  .order('property_id')
  .order('check_in_date');

console.log('\n=== MAY 2026 INDEPENDENT BOOKINGS (sample) ===');
const may21_23 = (independent || []).filter(
  (b) =>
    b.check_in_date === '2026-05-21' ||
    b.check_out_date === '2026-05-23' ||
    b.check_in_date === '2026-05-23' ||
    b.check_out_date === '2026-05-28'
);
console.log(JSON.stringify(may21_23, null, 2));

console.log('\n=== DATE CONFLICTS submission vs booking ===');
console.log('count:', dateConflicts.length);
console.log(JSON.stringify(dateConflicts.slice(0, 25), null, 2));

console.log('\n=== TOKEN metadata dates vs booking ===');
console.log('count:', tokenConflicts.length);
console.log(JSON.stringify(tokenConflicts.slice(0, 15), null, 2));
