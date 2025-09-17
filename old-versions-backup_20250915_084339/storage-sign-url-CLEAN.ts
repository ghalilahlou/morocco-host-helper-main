import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface SignUrlRequest {
  bucket: 'guest-documents' | 'contracts' | 'police-forms';
  path: string;
  expiresIn?: number;
}

async function getServerClient() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!url || !key) {
    throw new Error('Missing Supabase credentials');
  }

  return createClient(url, key, { auth: { persistSession: false } });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔗 storage-sign-url function called');
    console.log('📅 Timestamp:', new Date().toISOString());
    
    const { bucket, path, expiresIn = 3600 }: SignUrlRequest = await req.json();
    
    console.log('📥 Request data:', {
      bucket,
      path,
      expiresIn
    });

    const allowedBuckets = ['guest-documents', 'contracts', 'police-forms'] as const;
    if (!allowedBuckets.includes(bucket)) {
      console.error('❌ Invalid bucket:', bucket);
      return new Response(
        JSON.stringify({ error: 'Invalid bucket' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const server = await getServerClient();

    const { data, error } = await server.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn);

    if (error) {
      console.error('❌ Error creating signed URL:', error);
      
      if (error.message?.includes('not found') || error.message?.includes('does not exist')) {
        return new Response(
          JSON.stringify({ error: 'File not found' }),
          { 
            status: 404, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      return new Response(
        JSON.stringify({ error: 'Failed to create signed URL' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('✅ Signed URL created successfully');
    
    return new Response(
      JSON.stringify({ signedUrl: data.signedUrl }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
