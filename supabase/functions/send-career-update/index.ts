import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OWNER_EMAIL = "narsingbeesetti006@gmail.com";

const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[char] || char));

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const authorization = req.headers.get("Authorization");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("WELCOME_FROM_EMAIL");
  if (!authorization?.startsWith("Bearer ") || !supabaseUrl || !anonKey || !resendKey || !from) {
    return Response.json({ error: "Career email service is not configured." }, { status: 503 });
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || user?.email?.toLowerCase() !== OWNER_EMAIL) {
    return Response.json({ error: "Not authorized." }, { status: 403 });
  }

  const payload = await req.json().catch(() => ({}));
  const company = escapeHtml(payload.company).slice(0, 160);
  const position = escapeHtml(payload.position).slice(0, 160);
  const status = escapeHtml(payload.status).slice(0, 40);
  const event = escapeHtml(payload.event).slice(0, 80);
  const interview = escapeHtml(payload.interviewDate).slice(0, 40);
  const followUp = escapeHtml(payload.followUpDate).slice(0, 40);
  if (!company || !position || !event) return Response.json({ error: "Missing application details." }, { status: 400 });

  const emailResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + resendKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [OWNER_EMAIL],
      subject: "Career tracker: " + company + " — " + position,
      html: "<div style='font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:28px;color:#24352b'>" +
        "<h2 style='color:#178253'>Your job tracker was updated</h2>" +
        "<p><strong>Update:</strong> " + event + "</p>" +
        "<p><strong>Company:</strong> " + company + "<br><strong>Position:</strong> " + position +
        "<br><strong>Status:</strong> " + status + "</p>" +
        (interview ? "<p><strong>Interview date:</strong> " + interview + "</p>" : "") +
        (followUp ? "<p><strong>Follow-up date:</strong> " + followUp + "</p>" : "") +
        "<p>Open your private WorldConnect career tracker to review the details.</p></div>",
    }),
  });
  if (!emailResponse.ok) {
    console.error("Resend rejected career notification:", await emailResponse.text());
    return Response.json({ error: "Email provider rejected the notification." }, { status: 502 });
  }
  return Response.json({ sent: true });
});
