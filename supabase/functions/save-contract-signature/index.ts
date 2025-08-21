import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Payload = {
  bookingId: string;
  signerName: string;
  signerEmail?: string | null;
  signerPhone?: string | null;
  signatureDataUrl: string; // data:image/png;base64,....
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const server = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function badRequest(msg: string) {
  return new Response(JSON.stringify({ error: msg }), { 
    status: 400, 
    headers: { "content-type": "application/json", ...corsHeaders } 
  });
}

function ok(body: unknown) {
  return new Response(JSON.stringify(body ?? {}), { 
    status: 200, 
    headers: { "content-type": "application/json", ...corsHeaders } 
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") return badRequest("POST required");
    
    const body = (await req.json()) as Payload;

    if (!body?.bookingId || !body?.signerName || !body?.signatureDataUrl) {
      return badRequest("bookingId, signerName, signatureDataUrl required");
    }

    // Optional: validate data URL
    if (!body.signatureDataUrl.startsWith("data:image/png;base64,")) {
      return badRequest("signatureDataUrl must be a base64 PNG data URL");
    }

    // (1) Sanity-check booking exists (service role bypasses RLS)
    // Skip validation for temporary booking IDs (generated for contracts without real bookings)
    if (!body.bookingId.startsWith("contract-")) {
      const { data: booking, error: bookingErr } = await server
        .from("bookings")
        .select("id")
        .eq("id", body.bookingId)
        .maybeSingle();

      if (bookingErr) throw bookingErr;
      if (!booking) return badRequest("Unknown booking");
    }

    // (2) Write signature to contract_signatures
    // Generate a proper UUID for temporary booking IDs
    let finalBookingId = body.bookingId;
    if (body.bookingId.startsWith("contract-")) {
      // Generate a deterministic UUID based on the temporary ID
      const crypto = globalThis.crypto || (await import("node:crypto")).webcrypto;
      const encoder = new TextEncoder();
      const data = encoder.encode(body.bookingId);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = new Uint8Array(hashBuffer);
      
      // Convert first 16 bytes to UUID format
      const uuid = [
        Array.from(hashArray.slice(0, 4)).map(b => b.toString(16).padStart(2, '0')).join(''),
        Array.from(hashArray.slice(4, 6)).map(b => b.toString(16).padStart(2, '0')).join(''),
        Array.from(hashArray.slice(6, 8)).map(b => b.toString(16).padStart(2, '0')).join(''),
        Array.from(hashArray.slice(8, 10)).map(b => b.toString(16).padStart(2, '0')).join(''),
        Array.from(hashArray.slice(10, 16)).map(b => b.toString(16).padStart(2, '0')).join('')
      ].join('-');
      
      finalBookingId = uuid;
    }

    const { data: inserted, error: insertErr } = await server
      .from("contract_signatures")
      .insert({
        booking_id: finalBookingId,
        signer_name: body.signerName,
        signer_email: body.signerEmail ?? null,
        signer_phone: body.signerPhone ?? null,
        signature_data: body.signatureDataUrl,
        contract_content: 'Contract signed electronically', // Required field
        signed_at: new Date().toISOString()
      })
      .select("id")
      .single();

    if (insertErr) throw insertErr;

    console.log(`✅ Contract signature saved for booking ${body.bookingId}`);
    
    return ok({ id: inserted.id });
  } catch (e) {
    console.error("save-contract-signature error:", e);
    return new Response(JSON.stringify({ error: "internal" }), { 
      status: 500, 
      headers: { "content-type": "application/json", ...corsHeaders } 
    });
  }
});