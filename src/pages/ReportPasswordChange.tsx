// ABOUTME: Lets a recipient flag an unrequested admin password change and recover the account.
import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ReportPasswordChange() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [reported, setReported] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState<{ accountId: string | null; username: string } | null>(null);
  const report = trpc.localAuth.reportPasswordChange.useMutation({ onSuccess: () => setReported(true) });
  const recover = trpc.localAuth.recoverReportedPassword.useMutation({ onSuccess: result => { setDone({ accountId: result.accountId, username: result.username }); setPassword(""); setConfirm(""); } });
  return <main className="flex min-h-screen items-center justify-center bg-[#F5EDE6] px-4 py-10">
    <section className="w-full max-w-md space-y-5 rounded-xl border border-[#E8E0D8] bg-white p-7 shadow-sm" style={{ wordBreak: "break-word" }}>
      <Link to="/login" className="font-serif text-xl font-bold text-[#C73E1D]">Finaflow</Link>
      <h1 className="font-serif text-2xl font-bold text-[#2D2A26]">Report a password change</h1>
      {!token ? <p role="alert">This link is missing its recovery code. Request a new password reset from sign in.</p>
        : done ? <div role="status" className="space-y-3"><p>Your report was recorded and your new password is saved.</p><p>Account ID: <strong>{done.accountId ?? "Ask your account owner"}</strong><br />Username: <strong>{done.username}</strong></p><Button asChild><Link to="/login">Sign in</Link></Button></div>
        : !reported ? <div className="space-y-4"><p className="text-sm text-muted-foreground">If you did not request an administrator to change your password, report it now. The platform admin will see your report. You can then choose a new password yourself.</p>
            {report.error && <p role="alert" className="text-sm text-red-700">{report.error.message}</p>}
            <Button disabled={report.isPending} onClick={() => report.mutate({ token })}>Report unrequested change</Button>
          </div>
          : <form className="space-y-4" onSubmit={e => { e.preventDefault(); if (password.length >= 8 && password === confirm) recover.mutate({ token, password }); }}>
              <p role="status" className="text-sm text-amber-800">Reported to the platform admin. Secure your account now by setting a new password.</p>
              <div><Label htmlFor="recovery-password">New password (at least 8 characters)</Label><Input id="recovery-password" type="password" autoComplete="new-password" minLength={8} maxLength={100} required value={password} onChange={e => setPassword(e.target.value)} /></div>
              <div><Label htmlFor="recovery-confirm">Confirm new password</Label><Input id="recovery-confirm" type="password" autoComplete="new-password" required value={confirm} onChange={e => setConfirm(e.target.value)} /></div>
              {confirm && password !== confirm && <p role="alert" className="text-sm text-red-700">Passwords do not match.</p>}
              {recover.error && <p role="alert" className="text-sm text-red-700">{recover.error.message}</p>}
              <Button type="submit" disabled={recover.isPending || password.length < 8 || password !== confirm}>Set my password</Button>
            </form>}
      <p className="text-xs text-muted-foreground">The report link expires after 7 days. We will never ask you to share your password with support.</p>
    </section>
  </main>;
}
