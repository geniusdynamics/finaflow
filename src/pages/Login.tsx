import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Landmark, LogIn, Store, Eye, EyeOff, Building2, Briefcase, CheckCircle, ArrowRight, ArrowLeft, Copy, Gift, Building } from "lucide-react";

export default function Login() {
  const [mode, setMode] = useState<"accountLookup" | "credentials" | "signup">("accountLookup");
  const [showPassword, setShowPassword] = useState(false);

  // Step 1: Account lookup
  const [accountId, setAccountId] = useState("");
  const [foundBusiness, setFoundBusiness] = useState<any>(null);

  // Step 2: Credentials
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });

  // Signup form
  const [signupForm, setSignupForm] = useState({
    name: "", username: "", email: "", password: "", confirmPassword: "",
    businessName: "", createDemo: false, userType: "standard" as "standard" | "partner",
    referralCode: "",
  });

  const lookupMutation = trpc.localAuth.lookupAccount.useMutation({
    onSuccess: (data) => {
      setFoundBusiness(data.business);
      setMode("credentials");
    },
    onError: (err) => toast.error(err.message || "Account not found"),
  });

  const loginMutation = trpc.localAuth.login.useMutation({
    onSuccess: (data) => {
      localStorage.setItem("finaflow_token", data.token);
      toast.success(`Welcome back, ${data.user.name || data.user.username}!`);
      window.location.href = "/dashboard";
    },
    onError: (err) => toast.error(err.message || "Login failed"),
  });

  const registerMutation = trpc.localAuth.register.useMutation({
    onSuccess: (data) => {
      localStorage.setItem("finaflow_token", data.token);
      toast.success(`Welcome, ${data.user.name}! Your account is ready.`);
      window.location.href = "/dashboard";
    },
    onError: (err) => toast.error(err.message || "Registration failed"),
  });

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountId.trim()) { toast.error("Enter your Account ID"); return; }
    lookupMutation.mutate({ accountId: accountId.trim() });
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginForm.username || !loginForm.password) {
      toast.error("Please enter username and password");
      return;
    }
    loginMutation.mutate({
      accountId: foundBusiness?.accountId || accountId,
      username: loginForm.username,
      password: loginForm.password,
    });
  };

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!signupForm.name || !signupForm.username || !signupForm.email || !signupForm.password) {
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
    registerMutation.mutate({
      name: signupForm.name,
      username: signupForm.username,
      email: signupForm.email,
      password: signupForm.password,
      userType: signupForm.userType,
      businessName: signupForm.businessName || undefined,
      createDemo: signupForm.createDemo,
      referralCode: signupForm.referralCode || undefined,
    });
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#F5EDE6]">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#C73E1D]">
            <Landmark className="h-4 w-4 text-white" />
          </div>
          <span className="font-serif text-lg font-bold text-[#2D2A26]">Finaflow</span>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center">
            <h1 className="font-serif text-3xl font-bold text-[#2D2A26]">
              {mode === "signup" ? "Create Your Account" : "Welcome Back"}
            </h1>
            <p className="mt-2 text-sm text-[#8D8A87]">
              {mode === "accountLookup" ? "Enter your Account ID to sign in" :
               mode === "credentials" ? `Signing in to ${foundBusiness?.name}` :
               "Set up your account and start tracking"}
            </p>
          </div>

          {mode !== "signup" && (
            <div className="mb-4 flex rounded-lg border border-[#E8E0D8] bg-white p-1">
              <button onClick={() => setMode("accountLookup")} className={`flex-1 rounded-md py-2 text-xs font-medium transition-all ${mode !== "signup" ? "bg-[#C73E1D] text-white" : "text-[#8D8A87] hover:text-[#2D2A26]"}`}>
                Sign In
              </button>
              <button onClick={() => setMode("signup")} className={`flex-1 rounded-md py-2 text-xs font-medium transition-all ${mode === "signup" ? "bg-[#C73E1D] text-white" : "text-[#8D8A87] hover:text-[#2D2A26]"}`}>
                Sign Up
              </button>
            </div>
          )}

          <Card className="border-[#E8E0D8]">
            <CardContent className="p-5">
              {/* STEP 1: ACCOUNT LOOKUP */}
              {mode === "accountLookup" && (
                <form onSubmit={handleLookup} className="space-y-4">
                  <div>
                    <Label className="text-xs text-[#8D8A87]">Account ID</Label>
                    <Input
                      value={accountId}
                      onChange={e => setAccountId(e.target.value.toUpperCase())}
                      placeholder="e.g. GENIUS"
                      className="font-mono uppercase"
                      required
                    />
                    <p className="mt-1 text-xs text-[#8D8A87]">
                      Your unique business identifier. Ask your admin if you don't know it.
                    </p>
                  </div>
                  <Button type="submit" className="w-full bg-[#C73E1D]" disabled={lookupMutation.isPending}>
                    <ArrowRight className="mr-2 h-4 w-4" />{lookupMutation.isPending ? "Looking up..." : "Continue"}
                  </Button>
                  <p className="text-center text-xs text-[#8D8A87]">
                    New here? <button type="button" onClick={() => setMode("signup")} className="font-medium text-[#C73E1D] underline">Create a new account</button>
                  </p>
                </form>
              )}

              {/* STEP 2: CREDENTIALS */}
              {mode === "credentials" && (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="mb-2 flex items-center gap-2 rounded-lg bg-[#F5EDE6] px-3 py-2">
                    <Building className="h-4 w-4 text-[#C73E1D]" />
                    <span className="text-sm font-medium text-[#2D2A26]">{foundBusiness?.name}</span>
                    <span className="ml-auto font-mono text-xs text-[#8D8A87]">{foundBusiness?.accountId}</span>
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
                    <button type="button" onClick={() => setMode("signup")} className="text-xs font-medium text-[#C73E1D] underline">Create account</button>
                  </div>
                </form>
              )}

              {/* SIGNUP FORM */}
              {mode === "signup" && (
                <form onSubmit={handleSignup} className="space-y-4">
                  <div>
                    <Label className="text-xs text-[#8D8A87]">Account Type</Label>
                    <select
                      value={signupForm.userType}
                      onChange={e => setSignupForm(p => ({ ...p, userType: e.target.value as "standard" | "partner" }))}
                      className="w-full rounded border px-3 py-2 text-sm"
                    >
                      <option value="standard">Business Owner</option>
                      <option value="partner">Partner / Accountant / Consultant</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-xs text-[#8D8A87]">Full Name</Label><Input value={signupForm.name} onChange={e => setSignupForm(p => ({ ...p, name: e.target.value }))} placeholder="Your name" required /></div>
                    <div><Label className="text-xs text-[#8D8A87]">Username</Label><Input value={signupForm.username} onChange={e => setSignupForm(p => ({ ...p, username: e.target.value }))} placeholder="Choose username" required /></div>
                  </div>
                  <div><Label className="text-xs text-[#8D8A87]">Email</Label><Input type="email" value={signupForm.email} onChange={e => setSignupForm(p => ({ ...p, email: e.target.value }))} placeholder="you@business.com" required /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-xs text-[#8D8A87]">Password</Label><Input type="password" value={signupForm.password} onChange={e => setSignupForm(p => ({ ...p, password: e.target.value }))} placeholder="Min 6 chars" required /></div>
                    <div><Label className="text-xs text-[#8D8A87]">Confirm</Label><Input type="password" value={signupForm.confirmPassword} onChange={e => setSignupForm(p => ({ ...p, confirmPassword: e.target.value }))} placeholder="Repeat password" required /></div>
                  </div>
                  <div><Label className="text-xs text-[#8D8A87]">Business / Firm Name <span className="font-normal">(optional — leave blank for demo)</span></Label><Input value={signupForm.businessName} onChange={e => setSignupForm(p => ({ ...p, businessName: e.target.value }))} placeholder={signupForm.userType === "partner" ? "e.g. ABC Accounting" : "e.g. Karafuu Restaurant"} /></div>

                  <div className="flex items-center gap-2 rounded-lg bg-[#F5EDE6] p-3">
                    <input id="demo" type="checkbox" checked={signupForm.createDemo} onChange={e => setSignupForm(p => ({ ...p, createDemo: e.target.checked }))} className="h-4 w-4 rounded border-[#8D8A87]" />
                    <label htmlFor="demo" className="text-xs text-[#2D2A26]">
                      Start with <strong>Demo Mode</strong> — pre-loaded sample data so you can explore all features immediately
                    </label>
                  </div>

                  <div>
                    <Label className="text-xs text-[#8D8A87] flex items-center gap-1">
                      <Gift className="h-3 w-3 text-[#D4A854]" />
                      Referral Code (optional)
                    </Label>
                    <Input
                      value={signupForm.referralCode}
                      onChange={e => setSignupForm(p => ({ ...p, referralCode: e.target.value.toUpperCase() }))}
                      placeholder="e.g. FINAABC123"
                      className="font-mono uppercase"
                    />
                    <p className="mt-1 text-xs text-[#8D8A87]">Have a referral code? Enter it for <strong>10% off your first month</strong>.</p>
                  </div>

                  <Button type="submit" className="w-full bg-[#C73E1D]" disabled={registerMutation.isPending}>
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
