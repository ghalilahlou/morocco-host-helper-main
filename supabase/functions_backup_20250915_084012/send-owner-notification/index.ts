import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY") as string);
const FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") || "notifications@resend.dev";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface OwnerNotificationRequest {
  toEmail: string;
  guestName: string;
  checkIn: string; // ISO date or readable
  checkOut: string; // ISO date or readable
  propertyId: string;
  propertyName?: string;
  dashboardUrl?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    const body = (await req.json()) as OwnerNotificationRequest;

    const { toEmail, guestName, checkIn, checkOut, propertyId, propertyName, dashboardUrl } = body;

    if (!toEmail || !guestName || !checkIn || !checkOut || !propertyId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const subject = `[Check-in] ${guestName} a finalisé son check-in – ${checkIn} → ${checkOut}`;

    const html = `
      <div style="font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; color: #111;">
        <h2 style="margin:0 0 12px 0;">Check-in terminé</h2>
        <p style="margin:0 0 8px 0;">Bonjour,</p>
        <p style="margin:0 0 8px 0;">
          <strong>${guestName}</strong> a finalisé son check-in pour
          ${propertyName ? `<strong>${propertyName}</strong>` : "votre propriété"}.
        </p>
        <p style="margin:0 0 8px 0;">Séjour&nbsp;: <strong>${checkIn}</strong> → <strong>${checkOut}</strong></p>
        ${dashboardUrl ? `<p style="margin:16px 0;"><a href="${dashboardUrl}" style="background:#111;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;">Ouvrir le dashboard du bien</a></p>` : ""}
        <p style="margin:16px 0; color:#555;">Vous pouvez vérifier les documents (ID, fiche police, contrat de location courte durée) dans le dashboard.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:16px 0;"/>
        <p style="font-size:12px;color:#888;">Cet email a été envoyé automatiquement.</p>
      </div>
    `;

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [toEmail],
      subject,
      html,
    });

    if (error) {
      console.error("Resend error:", error);
      return new Response(JSON.stringify({ error: String(error) }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ ok: true, data }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("send-owner-notification error:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
