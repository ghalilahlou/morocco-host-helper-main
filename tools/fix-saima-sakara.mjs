/**
 * Saima 21–23 mai vs Sakara 23–28 mai — 7ème ciel
 * - Déplace données Saima (ex. SAUNA RAB) + scans ID vers booking 6f160405
 * - Libère e6113444 pour Sakara (vide guests/submission, supprime vieux PDF)
 * - Régénère contrat + police pour Saima aux dates actuelles
 *
 * Usage: node tools/fix-saima-sakara.mjs
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
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(url, key);

const BOOKING_SAIMA = '6f160405-0bf9-44be-b156-42b95f570994';
const BOOKING_SAKARA = 'e6113444-9e48-4cef-8d45-e797478d7bf7';
const GUEST_SAIMA_ID = '315d84a6-4768-4d0a-9cce-eb06f08483c1';

const saimaFromSubmission = {
  fullName: 'SAIMA RADYAH RAB',
  documentNumber: '558769636',
  dateOfBirth: '1999-09-22',
  documentIssueDate: '2027-03-12',
  nationality: 'UNITED STATES OF AMERICA',
  profession: 'Administrator',
  motifSejour: 'TOURISME',
  adressePersonnelle: '1955 Lardner Street, Philadelphia, PA',
};

function log(step, msg, extra) {
  console.log(`\n[${step}] ${msg}`);
  if (extra) console.log(JSON.stringify(extra, null, 2));
}

async function main() {
  log('1', 'Mise à jour guest Saima (21–23) avec pièce d’identité');
  const { error: guestErr } = await supabase
    .from('guests')
    .update({
      full_name: saimaFromSubmission.fullName,
      document_number: saimaFromSubmission.documentNumber,
      date_of_birth: saimaFromSubmission.dateOfBirth,
      nationality: saimaFromSubmission.nationality,
      document_type: 'passport',
      updated_at: new Date().toISOString(),
    })
    .eq('id', GUEST_SAIMA_ID);

  if (guestErr) throw guestErr;

  await supabase
    .from('bookings')
    .update({
      guest_name: saimaFromSubmission.fullName,
      number_of_guests: 1,
      check_in_date: '2026-05-21',
      check_out_date: '2026-05-23',
      updated_at: new Date().toISOString(),
    })
    .eq('id', BOOKING_SAIMA);

  log('2', 'Soumission Saima sur 21–23 (depuis données ex-SAUNA)');
  const saimaSubmissionPayload = {
    guests: [
      {
        fullName: saimaFromSubmission.fullName,
        firstName: 'Saima',
        lastName: 'Radyah Rab',
        idType: 'passport',
        idNumber: saimaFromSubmission.documentNumber,
        documentNumber: saimaFromSubmission.documentNumber,
        dateOfBirth: saimaFromSubmission.dateOfBirth,
        documentIssueDate: saimaFromSubmission.documentIssueDate,
        nationality: 'United States of America',
        profession: saimaFromSubmission.profession,
        motifSejour: saimaFromSubmission.motifSejour,
        adressePersonnelle: saimaFromSubmission.adressePersonnelle,
        email: '',
      },
    ],
    fullName: saimaFromSubmission.fullName,
    documentNumber: saimaFromSubmission.documentNumber,
  };

  const { data: existingSaimaSub } = await supabase
    .from('guest_submissions')
    .select('id')
    .eq('booking_id', BOOKING_SAIMA)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: tokenForSub } = await supabase
    .from('guest_submissions')
    .select('token_id')
    .eq('booking_id', BOOKING_SAKARA)
    .limit(1)
    .maybeSingle();

  const saimaSubRow = {
    booking_id: BOOKING_SAIMA,
    token_id: tokenForSub?.token_id,
    booking_data: {
      checkIn: '2026-05-21',
      checkOut: '2026-05-23',
      numberOfGuests: 1,
      nightsCount: 2,
      propertyName: "7ème ciel – Vue sur l'océan - 2 chambres",
      airbnbCode: 'INDEPENDENT_BOOKING',
    },
    guest_data: saimaSubmissionPayload,
    status: 'completed',
    updated_at: new Date().toISOString(),
  };

  if (existingSaimaSub?.id) {
    const { error: subUpdErr } = await supabase
      .from('guest_submissions')
      .update(saimaSubRow)
      .eq('id', existingSaimaSub.id);
    if (subUpdErr) log('2', 'warn update submission', subUpdErr);
  } else if (tokenForSub?.token_id) {
    const { error: subInsErr } = await supabase.from('guest_submissions').insert(saimaSubRow);
    if (subInsErr) log('2', 'warn insert submission', subInsErr);
  } else {
    log('2', 'skip guest_submissions Saima (pas de token_id FK)');
  }

  log('3', 'Déplacer scans pièce d’identité vers résa Saima');
  const { error: moveIdErr } = await supabase
    .from('uploaded_documents')
    .update({
      booking_id: BOOKING_SAIMA,
      guest_id: GUEST_SAIMA_ID,
      updated_at: new Date().toISOString(),
    })
    .eq('booking_id', BOOKING_SAKARA)
    .eq('document_type', 'identity');

  if (moveIdErr) log('3', 'warn move identity', moveIdErr);

  log('4', 'Nettoyer résa Sakara 23–28 (plus de SAUNA/RAFID)');
  await supabase.from('guests').delete().eq('booking_id', BOOKING_SAKARA);

  await supabase
    .from('bookings')
    .update({
      guest_name: 'SAKARA (à compléter)',
      number_of_guests: 2,
      check_in_date: '2026-05-23',
      check_out_date: '2026-05-28',
      updated_at: new Date().toISOString(),
    })
    .eq('id', BOOKING_SAKARA);

  const { data: sakaraSub } = await supabase
    .from('guest_submissions')
    .select('id')
    .eq('booking_id', BOOKING_SAKARA)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const sakaraSubRow = {
    booking_id: BOOKING_SAKARA,
    booking_data: {
      checkIn: '2026-05-23',
      checkOut: '2026-05-28',
      numberOfGuests: 2,
      nightsCount: 5,
      propertyName: "7ème ciel – Vue sur l'océan - 2 chambres",
      airbnbCode: 'INDEPENDENT_BOOKING',
    },
    guest_data: { guests: [] },
    status: 'pending',
    updated_at: new Date().toISOString(),
  };

  if (sakaraSub?.id) {
    await supabase.from('guest_submissions').update(sakaraSubRow).eq('id', sakaraSub.id);
  }

  log('5', 'Supprimer anciens contrats/police erronés sur Sakara');
  await supabase.from('generated_documents').delete().eq('booking_id', BOOKING_SAKARA);
  await supabase
    .from('uploaded_documents')
    .delete()
    .eq('booking_id', BOOKING_SAKARA)
    .in('document_type', ['contract', 'police']);

  log('6', 'Supprimer anciens PDF Saima (régénération)');
  await supabase.from('generated_documents').delete().eq('booking_id', BOOKING_SAIMA);
  await supabase
    .from('uploaded_documents')
    .delete()
    .eq('booking_id', BOOKING_SAIMA)
    .in('document_type', ['contract', 'police']);

  log('7', 'Régénérer contrat + police Saima (21–23)');
  const { data: genData, error: genErr } = await supabase.functions.invoke(
    'submit-guest-info-unified',
    {
      body: {
        action: 'generate_all_documents',
        bookingId: BOOKING_SAIMA,
        documentTypes: ['contract', 'police'],
      },
    }
  );

  if (genErr) {
    console.error('generate_all_documents error:', genErr);
  } else {
    console.log('generate_all_documents:', genData);
  }

  log('8', 'État final');
  const { data: final } = await supabase
    .from('bookings')
    .select('id,check_in_date,check_out_date,guest_name')
    .in('id', [BOOKING_SAIMA, BOOKING_SAKARA])
    .order('check_in_date');

  for (const b of final || []) {
    const { data: g } = await supabase.from('guests').select('full_name,document_number').eq('booking_id', b.id);
    const { data: gs } = await supabase
      .from('guest_submissions')
      .select('guest_data')
      .eq('booking_id', b.id)
      .limit(1)
      .maybeSingle();
    const names = gs?.guest_data?.guests?.map((x) => x.fullName) || [];
    console.log(b.id, b.check_in_date, b.check_out_date, b.guest_name, 'guests:', g, 'submission:', names);
  }

  console.log('\n✅ Terminé. Sakara : envoyer un nouveau lien invité pour compléter 23–28.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
