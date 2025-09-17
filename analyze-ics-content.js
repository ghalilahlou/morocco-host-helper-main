// Analyser le contenu ICS pour comprendre pourquoi aucune réservation n'est trouvée
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://csopyblkfyofwkeqqegd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzb3B5YmxrZnlvZndrZXFxZWdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5OTkwNTQsImV4cCI6MjA2OTU3NTA1NH0.QcIqFLgD6Cg5hYu5Q4iQjvuckTVJyKo6wDd9AMEeakM';

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🔍 Analyse du contenu ICS');
console.log('=========================');

async function analyzeICSContent() {
  // Récupérer une propriété avec URL ICS
  const { data: properties } = await supabase
    .from('properties')
    .select('id, name, airbnb_ics_url')
    .not('airbnb_ics_url', 'is', null)
    .limit(1);
  
  if (!properties || properties.length === 0) {
    console.error('❌ Aucune propriété avec URL ICS trouvée');
    return;
  }
  
  const property = properties[0];
  console.log('📋 Propriété:', property.name);
  console.log('🔗 URL ICS:', property.airbnb_ics_url);
  
  // Récupérer le contenu ICS
  const response = await fetch(property.airbnb_ics_url, {
    method: 'GET',
    headers: { 
      'Accept': 'text/calendar, text/plain, */*',
      'User-Agent': 'Morocco-Host-Helper/1.0'
    }
  });
  
  const icsContent = await response.text();
  console.log('\n📄 Contenu ICS complet:');
  console.log('========================');
  console.log(icsContent);
  
  // Analyser les événements
  console.log('\n🔍 Analyse des événements:');
  console.log('==========================');
  
  const events = icsContent.split('BEGIN:VEVENT');
  console.log(`📊 Nombre d'événements trouvés: ${events.length - 1}`);
  
  for (let i = 1; i < events.length; i++) {
    const eventContent = 'BEGIN:VEVENT' + events[i];
    console.log(`\n--- Événement ${i} ---`);
    console.log(eventContent.substring(0, 500) + '...');
    
    // Analyser les champs importants
    const lines = eventContent.split('\n').map(line => line.replace('\r', ''));
    
    let uid = '';
    let summary = '';
    let description = '';
    let dtstart = '';
    let dtend = '';
    
    for (const line of lines) {
      if (line.startsWith('UID:')) uid = line.substring(4);
      if (line.startsWith('SUMMARY:')) summary = line.substring(8);
      if (line.startsWith('DESCRIPTION:')) description = line.substring(12);
      if (line.startsWith('DTSTART')) dtstart = line;
      if (line.startsWith('DTEND')) dtend = line;
    }
    
    console.log('📋 Champs extraits:');
    console.log('  UID:', uid);
    console.log('  SUMMARY:', summary);
    console.log('  DESCRIPTION:', description);
    console.log('  DTSTART:', dtstart);
    console.log('  DTEND:', dtend);
    
    // Tester les patterns d'extraction
    console.log('\n🔍 Test des patterns d\'extraction:');
    
    // Test extraction booking ID
    const searchText = (description + ' ' + summary).toUpperCase();
    const patterns = [
      /([A-Z0-9]{10})/g,
      /BOOKING[:\s]*([A-Z0-9]{8,12})/gi,
      /CONFIRMATION[:\s]*([A-Z0-9]{8,12})/gi,
      /RESERVATION[:\s]*([A-Z0-9]{8,12})/gi,
      /REF[:\s]*([A-Z0-9]{8,12})/gi,
      /ID[:\s]*([A-Z0-9]{8,12})/gi
    ];
    
    let foundBookingId = false;
    for (const pattern of patterns) {
      const matches = [...searchText.matchAll(pattern)];
      for (const match of matches) {
        const code = match[1];
        if (code && code.length >= 8 && code.length <= 12 && /^[A-Z0-9]+$/.test(code)) {
          console.log('  ✅ Booking ID trouvé:', code);
          foundBookingId = true;
          break;
        }
      }
      if (foundBookingId) break;
    }
    
    if (!foundBookingId) {
      console.log('  ❌ Aucun Booking ID trouvé');
    }
    
    // Test extraction nom invité
    const guestPatterns = [
      /(?:Reserved for|Guest:|Réservé pour|Guest)\s*([A-Za-z\s]+)/i,
      /^([A-Za-z\s]+)(?:\s*-|\s*\(|\s*–)/,
      /([A-Za-z\s]+)\s*\(/,
      /Guest:\s*([A-Za-z\s]+)/i
    ];
    
    let foundGuestName = false;
    for (const pattern of guestPatterns) {
      const match = (summary + ' ' + description).match(pattern);
      if (match && match[1].trim().length > 2) {
        console.log('  ✅ Nom invité trouvé:', match[1].trim());
        foundGuestName = true;
        break;
      }
    }
    
    if (!foundGuestName) {
      console.log('  ❌ Aucun nom d\'invité trouvé');
    }
  }
}

analyzeICSContent().catch(console.error);
