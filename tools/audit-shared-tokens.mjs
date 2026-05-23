/**
 * Audit tokens partagés (1 token_id → plusieurs booking_id dans guest_submissions)
 * Usage: node tools/audit-shared-tokens.mjs
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
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key);

const KNOWN_BAD = [
  '50d51c12-127c-4a93-9cd3-5d988175e47a',
  '5cc9acf4-c299-48e7-8ada-084e9932c7ab',
  '73a33917-1a1e-4c27-a4c0-b4b8c7441945',
  'aee301ed-6505-46f0-9d4f-4222634b8fe5',
  'f6309bc8-0c51-4856-b8b8-de7370c65470',
];

async function main() {
  // Agrégation depuis guest_submissions
  const { data: subs, error: subErr } = await supabase
    .from('guest_submissions')
    .select('token_id, booking_id, updated_at')
    .not('token_id', 'is', null);

  if (subErr) throw subErr;

  const byToken = new Map();
  for (const s of subs || []) {
    if (!byToken.has(s.token_id)) byToken.set(s.token_id, new Set());
    byToken.get(s.token_id).add(s.booking_id);
  }

  const shared = [...byToken.entries()]
    .filter(([, bids]) => bids.size > 1)
    .map(([token_id, bids]) => ({ token_id, nb_bookings: bids.size, booking_ids: [...bids] }))
    .sort((a, b) => b.nb_bookings - a.nb_bookings);

  console.log('\n=== TOKENS PARTAGÉS (guest_submissions) ===');
  console.log('count:', shared.length);
  for (const t of shared) {
    console.log(`\n${t.token_id} → ${t.nb_bookings} bookings`);
    const { data: tok } = await supabase
      .from('property_verification_tokens')
      .select('id, token, property_id, booking_id, is_active, created_at, metadata')
      .eq('id', t.token_id)
      .maybeSingle();

    console.log('  token row:', {
      token: tok?.token?.slice(0, 12) + '...',
      is_active: tok?.is_active,
      booking_id_col: tok?.booking_id,
      property_id: tok?.property_id,
      linkType: tok?.metadata?.linkType,
      hasReservationData: !!tok?.metadata?.reservationData,
    });

    for (const bid of t.booking_ids.slice(0, 5)) {
      const { data: b } = await supabase
        .from('bookings')
        .select('guest_name, check_in_date, check_out_date, property_id')
        .eq('id', bid)
        .maybeSingle();
      console.log('   ', bid, b?.check_in_date, '→', b?.check_out_date, b?.guest_name);
    }
    if (t.booking_ids.length > 5) console.log('    ... +' + (t.booking_ids.length - 5));
  }

  console.log('\n=== VÉRIF LISTE UTILISATEUR ===');
  for (const id of KNOWN_BAD) {
    const found = shared.find((x) => x.token_id === id);
    console.log(id, found ? `${found.nb_bookings} bookings` : 'pas dans audit actuel');
  }

  // Tokens actifs sans booking_id (liens génériques dangereux)
  const { data: genericActive } = await supabase
    .from('property_verification_tokens')
    .select('id, token, property_id, created_at')
    .eq('is_active', true)
    .is('booking_id', null)
    .is('metadata->reservationData', null);

  console.log('\n=== TOKENS ACTIFS SANS booking_id (risque) ===');
  console.log('count:', genericActive?.length ?? 0);
  if (genericActive?.length) console.log(genericActive.slice(0, 10));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
