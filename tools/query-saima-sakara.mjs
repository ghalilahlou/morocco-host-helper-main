import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SB_SERVICE_ROLE_KEY;
const s = createClient(url, key);
const pid = 'a0ae5d83-41a7-49e4-8939-d1850ab3c61c';
const { data: bookings } = await s
  .from('bookings')
  .select('id,check_in_date,check_out_date,guest_name,number_of_guests')
  .eq('property_id', pid)
  .or('and(check_in_date.eq.2026-05-21,check_out_date.eq.2026-05-23),and(check_in_date.eq.2026-05-23,check_out_date.eq.2026-05-28)')
  .order('check_in_date');
console.log('BOOKINGS', JSON.stringify(bookings, null, 2));
for (const b of bookings || []) {
  const { data: g } = await s.from('guests').select('*').eq('booking_id', b.id);
  const { data: gs } = await s
    .from('guest_submissions')
    .select('id,booking_data,guest_data,updated_at')
    .eq('booking_id', b.id)
    .order('updated_at', { ascending: false })
    .limit(1);
  const { data: docs } = await s
    .from('generated_documents')
    .select('document_type,is_signed,created_at')
    .eq('booking_id', b.id)
    .order('created_at', { ascending: false })
    .limit(6);
  console.log('---', b.id, b.guest_name);
  console.log('guests', JSON.stringify(g, null, 2));
  console.log(
    'submission',
    gs?.[0]?.guest_data?.guests?.map((x) => x.fullName),
    gs?.[0]?.booking_data
  );
  console.log('docs', docs);
  const { data: ud } = await s.from('uploaded_documents').select('*').eq('booking_id', b.id);
  console.log('uploaded_documents', ud?.length, ud);
}
const { data: sub } = await s
  .from('guest_submissions')
  .select('guest_data')
  .eq('booking_id', 'e6113444-9e48-4cef-8d45-e797478d7bf7')
  .single();
console.log('FULL SUBMISSION', JSON.stringify(sub?.guest_data?.guests, null, 2));
