"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { CheckCircle2, KeyRound, LoaderCircle, MonitorSmartphone, ShieldCheck, ShieldOff } from "lucide-react";

type TotpEnrollment = { id: string; qrCode: string; secret: string; uri: string };

export default function AccountSecurityControls() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [factors, setFactors] = useState<Array<{ id: string; factor_type: string; status: string; friendly_name?: string }>>([]);
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  const [challengeId, setChallengeId] = useState("");
  const [code, setCode] = useState("");

  const refresh = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) { setError("Connect Supabase to manage account security."); setLoading(false); return; }
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) { setError("Sign in to manage account security."); setLoading(false); return; }
    const { data, error: factorError } = await supabase.auth.mfa.listFactors();
    if (factorError) setError(factorError.message);
    else setFactors(data.all || []);
    setLoading(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  async function beginEnrollment() {
    const supabase = createClient();
    if (!supabase) return;
    setBusy(true); setError(""); setNotice("");
    const { data, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "WorldConnect authenticator" });
    if (enrollError || !data?.totp) setError(enrollError?.message || "Could not start authenticator setup.");
    else setEnrollment({ id: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret, uri: data.totp.uri });
    setBusy(false);
  }

  async function verifyEnrollment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!enrollment) return;
    const supabase = createClient();
    if (!supabase) return;
    setBusy(true); setError(""); setNotice("");
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: enrollment.id });
    if (challengeError || !challenge?.id) { setError(challengeError?.message || "Could not start verification."); setBusy(false); return; }
    const { error: verifyError } = await supabase.auth.mfa.verify({ factorId: enrollment.id, challengeId: challenge.id, code: code.replace(/\s/g, "") });
    if (verifyError) setError(verifyError.message);
    else { setEnrollment(null); setCode(""); setNotice("Authenticator verification succeeded. Multi-factor authentication is enabled."); await refresh(); }
    setBusy(false);
  }

  async function removeFactor(id: string) {
    const supabase = createClient();
    if (!supabase || !window.confirm("Remove this authenticator factor? Your account will have fewer sign-in protections.")) return;
    setBusy(true); setError(""); setNotice("");
    const { error: removeError } = await supabase.auth.mfa.unenroll({ factorId: id });
    if (removeError) setError(removeError.message);
    else { setNotice("Authenticator factor removed."); await refresh(); }
    setBusy(false);
  }

  async function revokeOtherSessions() {
    const supabase = createClient();
    if (!supabase || !window.confirm("Sign out this account from other sessions and devices? This device will remain signed in.")) return;
    setBusy(true); setError(""); setNotice("");
    const { error: signOutError } = await supabase.auth.signOut({ scope: "others" });
    if (signOutError) setError(signOutError.message);
    else setNotice("Other sessions have been signed out. This device remains signed in.");
    setBusy(false);
  }

  const verifiedFactors = factors.filter((factor) => factor.status === "verified");

  return (
    <section className="opportunity-card account-security-card" aria-labelledby="account-security-title">
      <h2 id="account-security-title"><ShieldCheck size={18} /> Account security</h2>
      <p>Protect sign-in with an authenticator app and revoke sessions on other devices. WorldConnect does not display a device inventory because the connected Auth API does not expose a complete device list here.</p>
      {error && <p className="account-security-error" role="alert">{error}</p>}
      {notice && <p className="account-security-notice" role="status"><CheckCircle2 size={15} />{notice}</p>}
      {loading ? <p className="account-security-muted"><LoaderCircle size={16} /> Loading security settings…</p> : (
        <>
          <div className="account-security-row">
            <div><strong>Authenticator verification</strong><small>{verifiedFactors.length ? `${verifiedFactors.length} verified factor(s) enabled` : "No verified authenticator is enabled"}</small></div>
            <span className={verifiedFactors.length ? "account-security-state enabled" : "account-security-state"}>{verifiedFactors.length ? "Enabled" : "Not enabled"}</span>
          </div>
          {factors.filter((factor) => factor.status === "verified").map((factor) => (
            <div className="account-security-row" key={factor.id}>
              <div><strong>{factor.friendly_name || "Authenticator app"}</strong><small>Verified authenticator</small></div>
              <button type="button" className="account-security-secondary" disabled={busy} onClick={() => void removeFactor(factor.id)}><ShieldOff size={14} /> Remove</button>
            </div>
          ))}
          {enrollment ? (
            <div className="account-security-enroll">
              <h3>Finish authenticator setup</h3>
              <p>Scan this QR code with an authenticator app. If scanning is unavailable, enter the setup key manually. The key is shown only during this setup and is not saved by WorldConnect.</p>
              <img className="account-security-qr" src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(enrollment.qrCode)}`} alt="Authenticator setup QR code" />
              <code className="account-security-secret">{enrollment.secret}</code>
              <form onSubmit={verifyEnrollment}>
                <label htmlFor="account-security-code">Six-digit authenticator code</label>
                <input id="account-security-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,8}" maxLength={8} value={code} onChange={(event) => setCode(event.target.value)} required />
                <button type="submit" disabled={busy || code.replace(/\s/g, "").length !== 6}>{busy ? "Verifying…" : "Verify and enable MFA"}</button>
                <button type="button" className="account-security-secondary" disabled={busy} onClick={() => { setEnrollment(null); setCode(""); }}>Cancel setup</button>
              </form>
            </div>
          ) : (
            <button type="button" className="account-security-primary" disabled={busy} onClick={() => void beginEnrollment()}><KeyRound size={15} /> Add authenticator</button>
          )}
          <div className="account-security-session">
            <div><strong><MonitorSmartphone size={16} /> Other sessions</strong><small>Sign out other devices without ending this session.</small></div>
            <button type="button" className="account-security-secondary" disabled={busy} onClick={() => void revokeOtherSessions()}>Sign out other sessions</button>
          </div>
        </>
      )}
    </section>
  );
}
