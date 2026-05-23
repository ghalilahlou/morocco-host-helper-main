/**
 * Audit cohérence noms : bookings.guest_name vs guests vs guest_submissions vs fichiers police
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
  console.error('Missing SUPABASE_URL or service role in .env');
  process.exit(1);
}

const supabase = createClient(url, key);

function namesFromSubmission(gs) {
  const gd = gs?.guest_data;
  if (!gd) return [];
  const arr = gd.guests || (Array.isArray(gd) ? gd : []);
  return arr.map((g) => (g.fullName || g.full_name || '').trim()).filter(Boolean);
}

const { data: bookings } = await supabase
  .from('bookings')
  .select('id, guest_name, check_in_date, check_out_date, property_id')
  .in('status', ['pending', 'confirmed', 'completed'])
  .order('updated_at', { ascending: false })
  .limit(80);

const issues = [];

for (const b of bookings || []) {
  const { data: guests } = await supabase
    .from('guests')
    .select('full_name, updated_at')
    .eq('booking_id', b.id)
    .order('created_at');

  const guestNames = (guests || []).map((g) => g.full_name).filter(Boolean);
  const primaryGuest = guestNames[0] || null;

  const { data: subs } = await supabase
    .from('guest_submissions')
    .select('id, guest_data, updated_at, token_id')
    .eq('booking_id', b.id)
    .order('updated_at', { ascending: false })
    .limit(1);

  const subNames = subs?.[0] ? namesFromSubmission(subs[0]) : [];

  const { data: policeDocs } = await supabase
    .from('uploaded_documents')
    .select('file_name, created_at')
    .eq('booking_id', b.id)
    .eq('document_type', 'police');

  const policeNames = (policeDocs || [])
    .map((d) => {
      const m = /^Police_(.+)\.pdf$/i.exec(d.file_name || '');
      return m ? m[1].trim() : d.file_name;
    })
    .filter(Boolean);

  const { data: contracts } = await supabase
    .from('generated_documents')
    .select('created_at')
    .eq('booking_id', b.id)
    .eq('document_type', 'contract')
    .order('created_at', { ascending: false })
    .limit(1);

  const flags = [];
  const bn = (b.guest_name || '').trim().toLowerCase();
  const pg = (primaryGuest || '').trim().toLowerCase();

  if (bn === 'guest' && primaryGuest) flags.push('PLACEHOLDER_BOOKING_NAME');
  if (primaryGuest && bn && bn !== pg && !bn.includes(pg.split(' ')[0])) flags.push('BOOKING_VS_GUEST_MISMATCH');
  if (subNames.length && primaryGuest) {
    const sn = subNames[0].toLowerCase();
    if (sn !== pg) flags.push('SUBMISSION_VS_GUESTS_MISMATCH');
  }
  if (policeNames.length && primaryGuest) {
    const missing = policeNames.filter(
      (p) => !guestNames.some((g) => g.toLowerCase() === p.toLowerCase())
    );
    if (missing.length) flags.push('POLICE_FILE_VS_GUESTS_MISMATCH');
  }
  if (guests?.length && contracts?.[0]) {
    const maxGuestUpd = guests.reduce((m, g) => (g.updated_at > m ? g.updated_at : m), '');
    if (maxGuestUpd > contracts[0].created_at) flags.push('CONTRACT_OLDER_THAN_GUESTS');
  }

  if (flags.length) {
    issues.push({
      booking_id: b.id,
      check_in: b.check_in_date,
      booking_guest_name: b.guest_name,
      guests_table: guestNames.join(' | '),
      submission_names: subNames.join(' | '),
      police_files: policeNames.join(' | '),
      flags,
    });
  }
}

console.log('=== RÉSUMÉ AUDIT NOMS ===');
console.log('Réservations analysées:', bookings?.length || 0);
console.log('Avec anomalies:', issues.length);
const byFlag = {};
for (const i of issues) {
  for (const f of i.flags) byFlag[f] = (byFlag[f] || 0) + 1;
}
console.log('Par type:', JSON.stringify(byFlag, null, 2));
console.log('\n=== TOP 15 CAS ===');
console.log(JSON.stringify(issues.slice(0, 15), null, 2));
