// Vérifier la configuration ICS de la propriété
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://csopyblkfyofwkeqqegd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzb3B5YmxrZnlvZndrZXFxZWdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5OTkwNTQsImV4cCI6MjA2OTU3NTA1NH0.QcIqFLgD6Cg5hYu5Q4iQjvuckTVJyKo6wDd9AMEeakM';

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🔍 Vérification de la configuration ICS');
console.log('=====================================');

async function checkPropertyICS() {
  try {
    const { data: properties, error } = await supabase
      .from('properties')
      .select('id, name, airbnb_ics_url')
      .limit(5);
    
    if (error) {
      console.error('❌ Erreur:', error);
      return;
    }
    
    console.log(`📊 ${properties.length} propriété(s) trouvée(s):`);
    
    properties.forEach((property, index) => {
      console.log(`\n${index + 1}. ${property.name} (${property.id})`);
      console.log(`   URL ICS: ${property.airbnb_ics_url || '❌ Non configurée'}`);
    });
    
    // Vérifier s'il y a des propriétés avec URL ICS
    const propertiesWithICS = properties.filter(p => p.airbnb_ics_url);
    console.log(`\n✅ Propriétés avec URL ICS: ${propertiesWithICS.length}`);
    
    if (propertiesWithICS.length > 0) {
      console.log('🎯 Testons sync-airbnb-unified avec une propriété qui a une URL ICS...');
      
      const testProperty = propertiesWithICS[0];
      const { data, error } = await supabase.functions.invoke('sync-airbnb-unified', {
        body: { propertyId: testProperty.id, force: false }
      });
      
      console.log('📊 Résultat:', { data, error });
    } else {
      console.log('⚠️ Aucune propriété n\'a d\'URL ICS configurée');
      console.log('💡 Pour tester sync-airbnb-unified, il faut configurer une URL ICS');
    }
    
  } catch (err) {
    console.error('❌ Erreur:', err);
  }
}

checkPropertyICS();
