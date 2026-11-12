import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  const authorization = req.headers.get("Authorization");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("WELCOME_FROM_EMAIL");
  if (!authorization?.startsWith("Bearer ") || !supabaseUrl || !anonKey || !resendKey || !from) {
    return new Response(JSON.stringify({ error: "Welcome email service is not configured." }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const supabase = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user?.email) return new Response(JSON.stringify({ error: "Authentication required." }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const displayName = String(user.user_metadata?.display_name || user.user_metadata?.username || "there").replace(/[<>]/g, "").slice(0, 60);
  const emailResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + resendKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      from, to: [user.email], subject: "Welcome to WorldConnect 🌍",
      html: "<div style=\"font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:32px;color:#24352b\"><h1 style=\"color:#178253\">Welcome to WorldConnect, " + displayName + "!</h1><p>We’re glad you’re here. Your account is ready, and a world of people, ideas and opportunities is waiting for you.</p><p>Connect with people, join communities, share your thoughts and explore opportunities.</p><p>Thanks for being part of our growing community.</p><p><strong>— The WorldConnect Team 🌍</strong></p></div>",
    }),
  });
  if (!emailResponse.ok) { console.error("Resend rejected welcome email:", await emailResponse.text()); return new Response(JSON.stringify({ error: "Could not send welcome email." }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
  return new Response(JSON.stringify({ sent: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
