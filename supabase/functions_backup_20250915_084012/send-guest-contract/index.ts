import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY") as string);
const FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") || "notifications@resend.dev";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface GuestContractRequest {
  guestEmail: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  propertyName: string;
  propertyAddress: string;
  contractUrl?: string;
  numberOfGuests: number;
  totalPrice?: number;
  currency?: string;
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
    const body = (await req.json()) as GuestContractRequest;

    const { 
      guestEmail, 
      guestName, 
      checkIn, 
      checkOut, 
      propertyName, 
      propertyAddress,
      contractUrl,
      numberOfGuests,
      totalPrice,
      currency = "EUR"
    } = body;

    if (!guestEmail || !guestName || !checkIn || !checkOut || !propertyName) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validation de l'email
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    if (!emailRegex.test(guestEmail)) {
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const subject = `[Confirmation] Votre réservation - ${propertyName}`;

    const priceDisplay = totalPrice ? `\nPrix total : ${totalPrice} ${currency}` : "";
    const contractLink = contractUrl ? `\n\n📄 <a href="${contractUrl}" style="background:#111;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;">Télécharger votre contrat</a>` : "";

    const html = `
      <div style="font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; color: #111; max-width: 600px; margin: 0 auto;">
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h1 style="margin:0 0 16px 0; color: #1f2937;">Confirmation de réservation</h1>
          <p style="margin:0 0 8px 0; font-size: 18px;">Bonjour <strong>${guestName}</strong>,</p>
          <p style="margin:0 0 16px 0;">Votre réservation a été confirmée avec succès !</p>
        </div>

        <div style="background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <h2 style="margin:0 0 16px 0; color: #1f2937; border-bottom: 2px solid #3b82f6; padding-bottom: 8px;">Détails de votre séjour</h2>
          
          <div style="margin-bottom: 16px;">
            <strong style="color: #374151;">🏠 Propriété :</strong>
            <p style="margin: 4px 0 0 20px; color: #6b7280;">${propertyName}</p>
            <p style="margin: 4px 0 0 20px; color: #6b7280;">📍 ${propertyAddress}</p>
          </div>

          <div style="margin-bottom: 16px;">
            <strong style="color: #374151;">📅 Dates :</strong>
            <p style="margin: 4px 0 0 20px; color: #6b7280;">
              Arrivée : <strong>${checkIn}</strong><br>
              Départ : <strong>${checkOut}</strong>
            </p>
          </div>

          <div style="margin-bottom: 16px;">
            <strong style="color: #374151;">👥 Nombre de voyageurs :</strong>
            <p style="margin: 4px 0 0 20px; color: #6b7280;">${numberOfGuests} personne${numberOfGuests > 1 ? 's' : ''}</p>
          </div>
          ${priceDisplay}
        </div>

        <div style="background: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <h3 style="margin:0 0 12px 0; color: #0c4a6e;">📋 Documents requis</h3>
          <p style="margin:0 0 8px 0; color: #0c4a6e;">Pour finaliser votre séjour, vous devez fournir :</p>
          <ul style="margin:8px 0 0 20px; color: #0c4a6e;">
            <li>Pièce d'identité (passeport ou carte nationale)</li>
            <li>Fiche de police (générée automatiquement)</li>
            <li>Contrat de location signé</li>
          </ul>
        </div>

        ${contractLink}

        <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
          <h3 style="margin:0 0 8px 0; color: #92400e;">⚠️ Important</h3>
          <p style="margin:0 0 8px 0; color: #92400e;">
            • Présentez-vous à l'heure convenue pour le check-in<br>
            • Ayez tous vos documents en main<br>
            • Respectez les règles de la propriété
          </p>
        </div>

        <div style="text-align: center; margin-top: 30px;">
          <p style="margin:0 0 8px 0; color: #6b7280;">Pour toute question, contactez votre hôte</p>
          <p style="margin:0; color: #9ca3af; font-size: 14px;">Bon séjour ! 🌟</p>
        </div>

        <hr style="border:none;border-top:1px solid #e5e7eb;margin:30px 0 20px 0;"/>
        <p style="font-size:12px;color:#9ca3af;text-align:center;">
          Cet email a été envoyé automatiquement. Merci de ne pas y répondre.
        </p>
      </div>
    `;

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [guestEmail],
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

    console.log(`✅ Email envoyé avec succès à ${guestEmail} pour ${guestName}`);

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Email envoyé avec succès",
      data 
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("send-guest-contract error:", error);
    return new Response(
      JSON.stringify({ 
        error: error?.message || "Unknown error",
        details: error?.stack || "No stack trace available"
      }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
