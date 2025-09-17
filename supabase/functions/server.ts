// Serveur simple pour les Edge Functions
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

// Routeur simple
const router = {
  '/health': () => new Response(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  }),
  
  '/functions/v1/sync-documents': async (req: Request) => {
    try {
      const { bookingId } = await req.json();
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Documents synchronized',
        bookingId 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: error.message 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  },
  
  '/functions/v1/submit-guest-info': async (req: Request) => {
    try {
      const data = await req.json();
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Guest info submitted',
        data 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: error.message 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};

serve(async (req) => {
  const url = new URL(req.url);
  const path = url.pathname;
  
  console.log(`${req.method} ${path}`);
  
  // Gérer les requêtes OPTIONS (CORS)
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  // Router vers la fonction appropriée
  const handler = router[path as keyof typeof router];
  if (handler) {
    return await handler(req);
  }
  
  // Route par défaut
  return new Response(JSON.stringify({ 
    message: 'Morocco Host Helper Edge Functions Server',
    availableEndpoints: Object.keys(router),
    timestamp: new Date().toISOString()
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}, { port: 54321 });
