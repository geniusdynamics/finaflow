import { useState, useCallback } from "react";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Link, useSearchParams, useNavigate } from "react-router";
import { Landmark, LogIn, Store, Eye, EyeOff, Briefcase, CheckCircle, Gift, Building, Globe, Loader2, Check, X, ArrowRight, ArrowLeft, ChevronLeft, UserPlus, Handshake } from "lucide-react";
import { setCsrfFromResponse } from "@/hooks/useAuth";

function goToSignup(
  setMode: (m: "accountLookup" | "credentials" | "signup") => void,
  setSignupForm: React.Dispatch<React.SetStateAction<{
    name: string; username: string; email: string; password: string; confirmPassword: string;
    accountName: string; phone: string; businessName: string; createDemo: boolean; userType: "standard" | "partner";
    referralCode: string;
  }>>,
  userType: "standard" | "partner",
) {
  setSignupForm(prev => ({ ...prev, userType }));
  setMode("signup");
}

export default function Login() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const preselectedType = searchParams.get("type");

  const [mode, setMode] = useState<"accountLookup" | "credentials" | "signup">(
    preselectedType === "partner" || preselectedType === "standard" ? "signup" : "accountLookup"
  );
  const [showPassword, setShowPassword] = useState(false);

  const [accountId, setAccountId] = useState("");
  const [foundBusiness, setFoundBusiness] = useState<Record<string, unknown> | null>(null);
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [signupForm, setSignupForm] = useState({
    name: "", username: "", email: "", password: "", confirmPassword: "",
    accountName: "", phone: "", businessName: "", createDemo: false,
    userType: (preselectedType === "partner" ? "partner" : "standard") as "standard" | "partner",
    referralCode: "",
  });
  const [accountNameStatus, setAccountNameStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [accountNameMessage, setAccountNameMessage] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const utils = trpc.useUtils();

  const availabilityCheck = trpc.localAuth.checkAccountAvailability.useMutation();

  const lookupMutation = trpc.localAuth.lookupAccount.useMutation({
    onSuccess: (data: Record<string, unknown>) => {
      console.log("[Login] lookupAccount SUCCESS", data);
      setFoundBusiness(data.business as Record<string, unknown> | null);
      setMode("credentials");
      setLookupLoading(false);
      setLookupError(null);
    },
    onError: (err: { message?: string }, _, __) => {
      console.error("[Login] lookupAccount ERROR:", err);
      setLookupLoading(false);
      setLookupError(err.message || "Account not found");
    },
  });

  const loginMutation = trpc.localAuth.login.useMutation({
    onSuccess: (data: Record<string, unknown>) => {
      console.log("[Login] login SUCCESS", data);
      setCsrfFromResponse((data.csrfToken as string) || null);
      toast.success("Welcome back, " + ((data.user as Record<string, string>)?.name || (data.user as Record<string, string>)?.username) + "!");
      utils.invalidate();
      navigate("/dashboard");
    },
    onError: (err: { message?: string }) => {
      console.error("[Login] login ERROR:", err);
      toast.error(err.message || "Login failed");
    },
  });

  const registerMutation = trpc.localAuth.register.useMutation({
    onSuccess: (data: Record<string, unknown>) => {
      setCsrfFromResponse((data.csrfToken as string) || null);
      toast.success("Welcome, " + (data.user as Record<string, string>)?.name + "! Your account is ready.");
      utils.invalidate();
      navigate("/dashboard");
    },
    onError: (err: { message?: string }) => toast.error(err.message || "Registration failed"),
  });

  const checkAvailability = useCallback(async (name: string) => {
    const cleaned = name.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (cleaned.length < 2) {
      setAccountNameStatus("idle");
      setAccountNameMessage("");
      return;
    }
    setAccountNameStatus("checking");
    setAccountNameMessage("Checking availability...");
    try {
      const result = await availabilityCheck.mutateAsync({ accountName: cleaned });
      if (result && typeof result === "object" && "available" in result) {
        setAccountNameStatus(result.available ? "available" : "taken");
        setAccountNameMessage(result.message);
      } else {
        setAccountNameStatus("idle");
        setAccountNameMessage("");
      }
    } catch (err) {
      console.warn("[availability] check failed, name may still be available", err);
      setAccountNameStatus("idle");
      setAccountNameMessage("Could not verify — will check when you register");
    }
  }, [availabilityCheck]);

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountId.trim()) { toast.error("Enter your Account ID"); return; }
    console.log("[Login] handleLookup calling lookupAccount with:", accountId.trim());
    lookupMutation.mutate({ accountId: accountId.trim() });
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginForm.username || !loginForm.password) {
      toast.error("Please enter username and password");
      return;
    }
    const loginAccountId = (foundBusiness?.accountId as string) || accountId;
    console.log("[Login] handleLogin calling login with:", { accountId: loginAccountId, username: loginForm.username });
    loginMutation.mutate({
      accountId: loginAccountId,
      username: loginForm.username,
      password: loginForm.password,
    });
  };

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!signupForm.name || !signupForm.username || !signupForm.email || !signupForm.password || !signupForm.accountName) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (signupForm.password !== signupForm.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (signupForm.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (accountNameStatus === "taken" || accountNameStatus === "invalid") {
      toast.error("Please choose a different account name");
      return;
    }
    registerMutation.mutate({
      name: signupForm.name,
      username: signupForm.username,
      email: signupForm.email,
      password: signupForm.password,
      accountName: signupForm.accountName,
      phone: signupForm.phone || undefined,
      userType: signupForm.userType,
      businessName: signupForm.businessName || undefined,
      createDemo: signupForm.createDemo,
      referralCode: signupForm.referralCode || undefined,
    });
  };

  const businessName = foundBusiness?.name as string | undefined;

  return (
    <div className="flex min-h-screen flex-col bg-[#F5EDE6]">
      <div className="flex items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#C73E1D]">
            <Landmark className="h-4 w-4 text-white" />
          </div>
          <span className="font-serif text-lg font-bold text-[#2D2A26]">Finaflow</span>
        </Link>
        <Link to="/" className="flex items-center gap-1 text-xs text-[#8D8A87] hover:text-[#C73E1D] transition-colors">
          <ChevronLeft className="h-3 w-3" /> Back to Home
        </Link>
      </div>
      <div className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          {mode === "signup" && signupForm.userType === "partner" && (
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-[#D4A854]/30 bg-gradient-to-r from-[#D4A854]/10 to-[#D4A854]/5 px-4 py-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#D4A854]/20">
                <Handshake className="h-5 w-5 text-[#D4A854]" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#2D2A26]">Joining as Partner</p>
                <p className="text-xs text-[#8D8A87]">Earn 20% revenue share from businesses you onboard</p>
              </div>
            </div>
          )}
          {mode === "signup" && signupForm.userType === "standard" && preselectedType === "standard" && (
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-[#C73E1D]/20 bg-gradient-to-r from-[#C73E1D]/5 to-[#C73E1D]/5 px-4 py-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#C73E1D]/10">
                <UserPlus className="h-5 w-5 text-[#C73E1D]" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#2D2A26]">Creating Business Account</p>
                <p className="text-xs text-[#8D8A87]">Get started with sales, expenses, payroll and more</p>
              </div>
            </div>
          )}
          <div className="mb-6 text-center">
            <h1 className="font-serif text-3xl font-bold text-[#2D2A26]">
              {mode === "signup" ? "Create Your Account" : "Welcome Back"}
            </h1>
            <p className="mt-2 text-sm text-[#8D8A87]">
              {mode === "accountLookup" ? "Enter your Account ID to sign in" :
               mode === "credentials" ? "Signing in to " + businessName :
               "Set up your account and start tracking"}
            </p>
          </div>
          {mode === "accountLookup" || mode === "credentials" ? (
            <div className="mb-4 flex rounded-lg border border-[#E8E0D8] bg-white p-1">
              <button onClick={() => setMode("accountLookup")} className="flex-1 rounded-md py-2 text-xs font-medium transition-all bg-[#C73E1D] text-white">Sign In</button>
              <button onClick={() => goToSignup(setMode, setSignupForm, signupForm.userType)} className="flex-1 rounded-md py-2 text-xs font-medium transition-all text-[#8D8A87] hover:text-[#2D2A26]">Sign Up</button>
            </div>
          ) : null}
          <Card className="border-[#E8E0D8]">
            <CardContent className="p-5">
              {mode === "accountLookup" && (
                <form onSubmit={handleLookup} className="space-y-4">
                  <div>
                    <Label className="text-xs text-[#8D8A87]">Account ID</Label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8D8A87]" />
                      <Input 
                        value={accountId} 
                        onChange={e => setAccountId(e.target.value.toUpperCase())} 
                        placeholder="e.g. GENIUS" 
                        className="font-mono uppercase pl-9" 
                        required 
                      />
                      {lookupLoading && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <Loader2 className="h-4 w-4 animate-spin text-[#C73E1D]" />
                        </div>
                      )}
                      {lookupError && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <X className="h-4 w-4 text-red-600" />
                        </div>
                      )}
                    </div>
                    {lookupError && (
                      <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1">
                        <X className="h-3 w-3" /> {lookupError}
                      </p>
                    )}
                    {!lookupError && accountId && (
                      <p className="mt-1 text-xs text-[#8D8A87]">
                        Your unique business identifier.
                        {accountId && <span className="ml-1 text-[#C73E1D]">{"-> "}<strong>{accountId.toLowerCase()}.finaflow.app</strong></span>}
                      </p>
                    )}
                  </div>
                  <Button type="submit" className="w-full bg-[#C73E1D]" disabled={lookupMutation.isPending}>
                    {lookupMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Searching for Account...
                      </>
                    ) : (
                      <>
                        <ArrowRight className="mr-2 h-4 w-4" />
                        Continue
                      </>
                    )}
                  </Button>
                  <p className="text-center text-xs text-[#8D8A87]">
                    New here? <button type="button" onClick={() => goToSignup(setMode, setSignupForm, "standard")} className="font-medium text-[#C73E1D] underline">Create a new account</button>
                  </p>
                </form>
              )}
              {mode === "credentials" && (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="mb-2 flex items-center gap-2 rounded-lg bg-[#F5EDE6] px-3 py-2">
                    <Building className="h-4 w-4 text-[#C73E1D]" />
                    <span className="text-sm font-medium text-[#2D2A26]">{businessName}</span>
                    <span className="ml-auto font-mono text-xs text-[#8D8A87]">{foundBusiness?.accountId as string}</span>
                  </div>
                  <div>
                    <Label className="text-xs text-[#8D8A87]">Username</Label>
                    <Input value={loginForm.username} onChange={e => setLoginForm(p => ({ ...p, username: e.target.value }))} placeholder="Enter username" required />
                  </div>
                  <div>
                    <Label className="text-xs text-[#8D8A87]">Password</Label>
                    <div className="relative">
                      <Input type={showPassword ? "text" : "password"} value={loginForm.password} onChange={e => setLoginForm(p => ({ ...p, password: e.target.value }))} placeholder="Enter password" required />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8D8A87]">
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <Button type="submit" className="w-full bg-[#C73E1D]" disabled={loginMutation.isPending}>
                    <LogIn className="mr-2 h-4 w-4" />{loginMutation.isPending ? "Signing in..." : "Sign In"}
                  </Button>
                  <div className="flex justify-between">
                    <button type="button" onClick={() => setMode("accountLookup")} className="text-xs text-[#8D8A87] hover:text-[#2D2A26] flex items-center gap-1">
                      <ArrowLeft className="h-3 w-3" /> Different account
                    </button>
                    <button type="button" onClick={() => goToSignup(setMode, setSignupForm, "standard")} className="text-xs font-medium text-[#C73E1D] underline">Create account</button>
                  </div>
                </form>
              )}
              {mode === "signup" && (
                <form onSubmit={handleSignup} className="space-y-4">
                  <div>
                    <Label className="text-xs text-[#8D8A87]">Account Type</Label>
                    <div className="relative">
                      <select value={signupForm.userType} onChange={e => setSignupForm(p => ({ ...p, userType: e.target.value as "standard" | "partner" }))} className="w-full rounded border px-3 py-2 text-sm appearance-none bg-white pr-8">
                        <option value="standard">Business Owner</option>
                        <option value="partner">Partner / Accountant / Consultant</option>
                      </select>
                      {signupForm.userType === "partner" ? (
                        <Handshake className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#D4A854]" />
                      ) : (
                        <Briefcase className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#C73E1D]" />
                      )}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-[#8D8A87]">
                      Account Name <span className="font-normal">(your unique identifier -- used for login URL)</span>
                    </Label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8D8A87]" />
                      <Input
                        value={signupForm.accountName}
                        onChange={e => {
                          const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
                          setSignupForm(p => ({ ...p, accountName: val }));
                          if (val.length >= 2) checkAvailability(val);
                          else { setAccountNameStatus("idle"); setAccountNameMessage(""); }
                        }}
                        placeholder="e.g. GENIUS"
                        className="font-mono uppercase pl-9 pr-9"
                        required
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {accountNameStatus === "checking" && <Loader2 className="h-4 w-4 animate-spin text-[#8D8A87]" />}
                        {accountNameStatus === "available" && <Check className="h-4 w-4 text-green-600" />}
                        {accountNameStatus === "taken" && <X className="h-4 w-4 text-red-600" />}
                      </div>
                    </div>
                    {accountNameMessage && (
                      <p className={"mt-1 text-xs " + (accountNameStatus === "available" ? "text-green-600" : accountNameStatus === "taken" ? "text-red-600" : "text-[#8D8A87]")}>
                        {accountNameStatus === "available" && <Check className="mr-1 inline h-3 w-3" />}
                        {accountNameStatus === "taken" && <X className="mr-1 inline h-3 w-3" />}
                        {accountNameMessage}
                        {signupForm.accountName.length >= 2 && <span className="ml-1 block text-[#C73E1D]">{"-> "}<strong>{signupForm.accountName.toLowerCase()}.finaflow.app</strong></span>}
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-xs text-[#8D8A87]">Full Name</Label><Input value={signupForm.name} onChange={e => setSignupForm(p => ({ ...p, name: e.target.value }))} placeholder="Your name" required /></div>
                    <div><Label className="text-xs text-[#8D8A87]">Username</Label><Input value={signupForm.username} onChange={e => setSignupForm(p => ({ ...p, username: e.target.value }))} placeholder="Choose username" required /></div>
                  </div>
                  <div><Label className="text-xs text-[#8D8A87]">Email</Label><Input type="email" value={signupForm.email} onChange={e => setSignupForm(p => ({ ...p, email: e.target.value }))} placeholder="you@business.com" required /></div>
                  <div><Label className="text-xs text-[#8D8A87]">Phone <span className="font-normal">(optional)</span></Label><Input type="tel" value={signupForm.phone} onChange={e => setSignupForm(p => ({ ...p, phone: e.target.value }))} placeholder="+254 7XX XXX XXX" /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-xs text-[#8D8A87]">Password</Label><Input type="password" value={signupForm.password} onChange={e => setSignupForm(p => ({ ...p, password: e.target.value }))} placeholder="Min 6 chars" required /></div>
                    <div><Label className="text-xs text-[#8D8A87]">Confirm</Label><Input type="password" value={signupForm.confirmPassword} onChange={e => setSignupForm(p => ({ ...p, confirmPassword: e.target.value }))} placeholder="Repeat password" required /></div>
                  </div>
                  <div><Label className="text-xs text-[#8D8A87]">Business / Firm Name <span className="font-normal">(optional)</span></Label><Input value={signupForm.businessName} onChange={e => setSignupForm(p => ({ ...p, businessName: e.target.value }))} placeholder={signupForm.userType === "partner" ? "e.g. ABC Accounting" : "e.g. Karafuu Business"} /></div>
                  <div className="flex items-center gap-2 rounded-lg bg-[#F5EDE6] p-3">
                    <input id="demo" type="checkbox" checked={signupForm.createDemo} onChange={e => setSignupForm(p => ({ ...p, createDemo: e.target.checked }))} className="h-4 w-4 rounded border-[#8D8A87]" />
                    <label htmlFor="demo" className="text-xs text-[#2D2A26]">Start with <strong>Demo Mode</strong> -- preloaded with sample data</label>
                  </div>
                  <div>
                    <Label className="text-xs text-[#8D8A87] flex items-center gap-1">
                      <Gift className="h-3 w-3 text-[#D4A854]" />Referral Code (optional)
                    </Label>
                    <Input value={signupForm.referralCode} onChange={e => setSignupForm(p => ({ ...p, referralCode: e.target.value.toUpperCase() }))} placeholder="e.g. FINAABC123" className="font-mono uppercase" />
                  </div>
                  <Button type="submit" className="w-full bg-[#C73E1D]" disabled={registerMutation.isPending || accountNameStatus === "checking"}>
                    {signupForm.userType === "partner" ? <Briefcase className="mr-2 h-4 w-4" /> : <Store className="mr-2 h-4 w-4" />}
                    {registerMutation.isPending ? "Creating..." : signupForm.userType === "partner" ? "Join as Partner" : "Create Account"}
                  </Button>
                  <p className="text-center text-xs text-[#8D8A87]">
                    Already have an account? <button type="button" onClick={() => setMode("accountLookup")} className="font-medium text-[#C73E1D] underline">Sign in</button>
                  </p>
                </form>
              )}
            </CardContent>
          </Card>
          <div className="mt-6 grid grid-cols-2 gap-3">
            {[
              { icon: Store, text: "Multi-location tracking" },
              { icon: Briefcase, text: "Staff & payroll" },
              { icon: Landmark, text: "M-PESA integration" },
              { icon: CheckCircle, text: "KRA-ready reports" },
            ].map((f, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg border border-[#E8E0D8] bg-white px-3 py-2 text-xs text-[#2D2A26]">
                <f.icon className="h-3.5 w-3.5 text-[#C73E1D]" />{f.text}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
