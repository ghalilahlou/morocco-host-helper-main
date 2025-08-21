// Uses getServerClient() with SB_URL/SB_SERVICE_ROLE_KEY and SUPABASE_* fallbacks.
import { getServerClient } from '../_shared/serverClient.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SignUrlRequest {
  bucket: 'guest-documents' | 'contracts' | 'police-forms';
  path: string;
  expiresIn?: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { bucket, path, expiresIn = 3600 }: SignUrlRequest = await req.json();

    // Validate bucket is one of the allowed sensitive buckets
    const allowedBuckets = ['guest-documents', 'contracts', 'police-forms'] as const;
    if (!allowedBuckets.includes(bucket)) {
      return new Response(
        JSON.stringify({ error: 'Invalid bucket' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Create service role client
    const server = await getServerClient();

    // Create signed URL
    const { data, error } = await server.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn);

    if (error) {
      console.error('Error creating signed URL:', error);
      
      // Check if it's a file not found error
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

    return new Response(
      JSON.stringify({ signedUrl: data.signedUrl }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});