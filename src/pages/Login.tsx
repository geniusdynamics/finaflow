// ABOUTME: Sign-in / sign-up page with persistent tabbed intent switcher, mobile-friendly 48px touch targets, and prominent "already have an account" CTA.
// ABOUTME: Form state is preserved when users toggle between Sign In and Sign Up so they never have to retype already-entered data.
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
import { setAuthToken } from "@/providers/trpc";
import { getDefaultLandingPage } from "@/lib/permissions";


type Intent = "login" | "signup";
type LoginStep = "accountLookup" | "credentials";
type UserType = "standard" | "partner";

const TABS: { id: Intent; label: string }[] = [
  { id: "login", label: "Sign In" },
  { id: "signup", label: "Sign Up" },
];

function switchIntent(
  next: Intent,
  current: LoginStep | "signup",
  setMode: (m: LoginStep | "signup") => void,
) {
  if (next === "login") {
    // Always land on the account lookup step when returning to sign-in so
    // users can change accounts or retry without re-typing the previous one.
    setMode("accountLookup");
    return;
  }
  // Only switch to signup if we are not already there. This preserves any
  // partially-typed signup form data and avoids unnecessary re-renders.
  if (current !== "signup") {
    setMode("signup");
  }
}

export default function Login() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const preselectedType = searchParams.get("type");
  const initialIntent: Intent =
    preselectedType === "partner" || preselectedType === "standard" ? "signup" : "login";
  const initialUserType: UserType = preselectedType === "partner" ? "partner" : "standard";

  const [intent, setIntent] = useState<Intent>(initialIntent);
  const [mode, setMode] = useState<LoginStep | "signup">(
    initialIntent === "signup" ? "signup" : "accountLookup",
  );
  const [showPassword, setShowPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [accountId, setAccountId] = useState("");
  const [foundBusiness, setFoundBusiness] = useState<Record<string, unknown> | null>(null);
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [signupForm, setSignupForm] = useState({
    name: "", username: "", email: "", password: "", confirmPassword: "",
    accountName: "", phone: "", businessName: "", createDemo: false,
    userType: initialUserType,
    referralCode: "",
  });
  const [accountNameStatus, setAccountNameStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [accountNameMessage, setAccountNameMessage] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);

  const utils = trpc.useUtils();

  const availabilityCheck = trpc.localAuth.checkAccountAvailability.useMutation();

  const lookupMutation = trpc.localAuth.lookupAccount.useMutation({
    onSuccess: (data: Record<string, unknown>) => {
      setFoundBusiness(data.business as Record<string, unknown> | null);
      setMode("credentials");
      setLookupLoading(false);
      setLookupError(null);
    },
    onError: (err: { message?: string }) => {
      setLookupLoading(false);
      setLookupError(err.message || "Account not found");
    },
  });

  const loginMutation = trpc.localAuth.login.useMutation({
    onSuccess: (data: Record<string, unknown>) => {
      setCsrfFromResponse((data.csrfToken as string) || null);
      // Store JWT as Bearer token fallback for reliable auth
      if (data.token) setAuthToken(data.token as string);
      toast.success("Welcome back, " + ((data.user as Record<string, string>)?.name || (data.user as Record<string, string>)?.username) + "!");
      // Reset (remove from cache) the me query before navigating so
      // ProtectedRoute starts with a cache miss, shows its loading
      // spinner, and fetches the me query fresh with the auth cookie.
      // This avoids the race where ProtectedRoute finds stale null
      // data in cache (isLoading=false) and redirects back to /login.
      utils.localAuth.me.reset();
      const user = data.user as Record<string, unknown> | undefined;
      const userPerms = Array.isArray(user?.permissions) ? (user?.permissions as string[]) : [];
      const userRole = (user?.role as string) ?? "viewer";
      navigate(getDefaultLandingPage(userPerms.length > 0 ? userPerms : userRole));
    },
    onError: (err: { message?: string }) => {
      const message = err.message || "Login failed. Check your username and password.";
      setLoginError(message);
      toast.error(message);
    },
  });

  const registerMutation = trpc.localAuth.register.useMutation({
    onSuccess: (data: Record<string, unknown>) => {
      setCsrfFromResponse((data.csrfToken as string) || null);
      // Store JWT as Bearer token fallback for reliable auth
      if (data.token) setAuthToken(data.token as string);
      toast.success("Welcome, " + (data.user as Record<string, string>)?.name + "! Your account is ready.");
      utils.localAuth.me.reset();
      const user = data.user as Record<string, unknown> | undefined;
      const userPerms = Array.isArray(user?.permissions) ? (user?.permissions as string[]) : [];
      const userRole = (user?.role as string) ?? "viewer";
      navigate(getDefaultLandingPage(userPerms.length > 0 ? userPerms : userRole));
    },
    onError: (err: { message?: string }) => toast.error(err.message || "Registration failed"),
  });

  const handleIntentChange = (next: Intent) => {
    if (next === intent) return;
    setIntent(next);
    // Clear any stale error surfaces so the new tab starts fresh.
    setLoginError(null);
    setLookupError(null);
    switchIntent(next, mode, setMode);
  };

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
    setLoginError(null);
    lookupMutation.mutate({ accountId: accountId.trim() });
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginForm.username || !loginForm.password) {
      const message = "Please enter your username and password.";
      setLoginError(message);
      toast.error(message);
      return;
    }
    setLoginError(null);
    const loginAccountId = (foundBusiness?.accountId as string) || accountId;
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
  const isLoginActive = intent === "login";
  const isSignupActive = intent === "signup";

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
          {/* Persistent intent tabs — always visible on both desktop and mobile,
              48px tall on touch viewports so they remain comfortably tappable. */}
          <div
            role="tablist"
            aria-label="Authentication mode"
            className="mb-4 flex rounded-lg border border-[#E8E0D8] bg-white p-1"
          >
            {TABS.map((tab) => {
              const active = (tab.id === "login" && isLoginActive) || (tab.id === "signup" && isSignupActive);
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-controls="auth-panel"
                  data-testid={`auth-tab-${tab.id}`}
                  onClick={() => handleIntentChange(tab.id)}
                  className={`flex-1 rounded-md py-2.5 text-sm font-medium transition-all min-h-[44px] sm:min-h-[48px] ${
                    active
                      ? "bg-[#C73E1D] text-white shadow-sm"
                      : "text-[#8D8A87] hover:text-[#2D2A26]"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
          <Card className="border-[#E8E0D8]">
            <CardContent className="p-5" id="auth-panel" role="tabpanel">
              {mode === "accountLookup" && (
                <form onSubmit={handleLookup} className="space-y-4" noValidate>
                  <div>
                    <Label htmlFor="accountId" className="text-xs text-[#8D8A87]">Account ID</Label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8D8A87]" />
                      <Input
                        id="accountId"
                        name="accountId"
                        autoComplete="username"
                        spellCheck={false}
                        autoCapitalize="characters"
                        value={accountId}
                        onChange={e => {
                          setAccountId(e.target.value.toUpperCase());
                          if (lookupError) setLookupError(null);
                        }}
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
                      <p role="alert" className="mt-1.5 text-sm text-red-600 flex items-center gap-1">
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
                  {/* 48px minimum touch target on mobile; full-width CTA so the
                      primary action is obvious and unambiguous. */}
                  <Button
                    type="submit"
                    className="w-full bg-[#C73E1D] hover:bg-[#C73E1D]/90 min-h-[48px] text-base"
                    disabled={lookupMutation.isPending}
                  >
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
                  <button
                    type="button"
                    onClick={() => handleIntentChange("signup")}
                    className="flex w-full items-center justify-center gap-1 rounded-md border border-[#E8E0D8] bg-white py-3 text-sm font-medium text-[#2D2A26] transition-colors hover:bg-[#F5EDE6] min-h-[48px]"
                    data-testid="account-cta-signup"
                  >
                    New here? <span className="text-[#C73E1D] underline">Create a new account</span>
                  </button>
                </form>
              )}
              {mode === "credentials" && (
                <form onSubmit={handleLogin} className="space-y-4" noValidate>
                  <div className="mb-2 flex items-center gap-2 rounded-lg bg-[#F5EDE6] px-3 py-2">
                    <Building className="h-4 w-4 text-[#C73E1D]" />
                    <span className="text-sm font-medium text-[#2D2A26]">{businessName}</span>
                    <span className="ml-auto font-mono text-xs text-[#8D8A87]">{foundBusiness?.accountId as string}</span>
                  </div>
                  <div>
                    <Label htmlFor="login-username" className="text-xs text-[#8D8A87]">Username</Label>
                    <Input
                      id="login-username"
                      name="username"
                      autoComplete="username"
                      value={loginForm.username}
                      onChange={e => {
                        setLoginForm(p => ({ ...p, username: e.target.value }));
                        if (loginError) setLoginError(null);
                      }}
                      placeholder="Enter username"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="login-password" className="text-xs text-[#8D8A87]">Password</Label>
                    <div className="relative">
                      <Input
                        id="login-password"
                        name="password"
                        autoComplete="current-password"
                        type={showPassword ? "text" : "password"}
                        value={loginForm.password}
                        onChange={e => {
                          setLoginForm(p => ({ ...p, password: e.target.value }));
                          if (loginError) setLoginError(null);
                        }}
                        placeholder="Enter password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        aria-pressed={showPassword}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8D8A87] hover:text-[#2D2A26] min-h-[44px] min-w-[44px] flex items-center justify-center"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {loginError && (
                      <p role="alert" className="mt-1.5 text-sm text-red-600 flex items-center gap-1">
                        <X className="h-3 w-3" /> {loginError}
                      </p>
                    )}
                  </div>
                  <div className="flex justify-end">
                    <Link
                      to="/forgot-password"
                      className="text-xs font-medium text-[#C73E1D] underline min-h-[44px] flex items-center"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-[#C73E1D] hover:bg-[#C73E1D]/90 min-h-[48px] text-base"
                    disabled={loginMutation.isPending}
                  >
                    <LogIn className="mr-2 h-4 w-4" />
                    {loginMutation.isPending ? "Signing in..." : "Sign In"}
                  </Button>
                  <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
                    <button
                      type="button"
                      onClick={() => {
                        setMode("accountLookup");
                        setLoginError(null);
                      }}
                      className="text-xs text-[#8D8A87] hover:text-[#2D2A26] flex items-center justify-center gap-1 min-h-[44px]"
                    >
                      <ArrowLeft className="h-3 w-3" /> Different account
                    </button>
                    <button
                      type="button"
                      onClick={() => handleIntentChange("signup")}
                      className="text-xs font-medium text-[#C73E1D] underline min-h-[44px] flex items-center justify-center"
                    >
                      Create account
                    </button>
                  </div>
                </form>
              )}
              {mode === "signup" && (
                <form onSubmit={handleSignup} className="space-y-4" noValidate>
                  <div>
                    <Label htmlFor="signup-userType" className="text-xs text-[#8D8A87]">Account Type</Label>
                    <div className="relative">
                      <select
                        id="signup-userType"
                        value={signupForm.userType}
                        onChange={e => setSignupForm(p => ({ ...p, userType: e.target.value as UserType }))}
                        className="w-full rounded border px-3 py-2 text-sm appearance-none bg-white pr-8 min-h-[48px]"
                      >
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
                    <Label htmlFor="signup-accountName" className="text-xs text-[#8D8A87]">
                      Account Name <span className="font-normal">(your unique identifier -- used for login URL)</span>
                    </Label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8D8A87]" />
                      <Input
                        id="signup-accountName"
                        name="accountName"
                        autoComplete="off"
                        spellCheck={false}
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
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="signup-name" className="text-xs text-[#8D8A87]">Full Name</Label>
                      <Input
                        id="signup-name"
                        name="name"
                        autoComplete="name"
                        value={signupForm.name}
                        onChange={e => setSignupForm(p => ({ ...p, name: e.target.value }))}
                        placeholder="Your name"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="signup-username" className="text-xs text-[#8D8A87]">Username</Label>
                      <Input
                        id="signup-username"
                        name="username"
                        autoComplete="username"
                        value={signupForm.username}
                        onChange={e => setSignupForm(p => ({ ...p, username: e.target.value }))}
                        placeholder="Choose username"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="signup-email" className="text-xs text-[#8D8A87]">Email</Label>
                    <Input
                      id="signup-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      inputMode="email"
                      value={signupForm.email}
                      onChange={e => setSignupForm(p => ({ ...p, email: e.target.value }))}
                      placeholder="you@business.com"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="signup-phone" className="text-xs text-[#8D8A87]">Phone <span className="font-normal">(optional)</span></Label>
                    <Input
                      id="signup-phone"
                      name="phone"
                      type="tel"
                      autoComplete="tel"
                      inputMode="tel"
                      value={signupForm.phone}
                      onChange={e => setSignupForm(p => ({ ...p, phone: e.target.value }))}
                      placeholder="+254 7XX XXX XXX"
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="signup-password" className="text-xs text-[#8D8A87]">Password</Label>
                      <div className="relative">
                        <Input
                          id="signup-password"
                          name="new-password"
                          autoComplete="new-password"
                          type={showSignupPassword ? "text" : "password"}
                          value={signupForm.password}
                          onChange={e => setSignupForm(p => ({ ...p, password: e.target.value }))}
                          placeholder="Min 6 chars"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowSignupPassword(!showSignupPassword)}
                          aria-label={showSignupPassword ? "Hide password" : "Show password"}
                          aria-pressed={showSignupPassword}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-[#8D8A87] hover:text-[#2D2A26] min-h-[44px] min-w-[44px] flex items-center justify-center"
                        >
                          {showSignupPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="signup-confirm" className="text-xs text-[#8D8A87]">Confirm</Label>
                      <div className="relative">
                        <Input
                          id="signup-confirm"
                          name="confirm-password"
                          autoComplete="new-password"
                          type={showConfirmPassword ? "text" : "password"}
                          value={signupForm.confirmPassword}
                          onChange={e => setSignupForm(p => ({ ...p, confirmPassword: e.target.value }))}
                          placeholder="Repeat password"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                          aria-pressed={showConfirmPassword}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-[#8D8A87] hover:text-[#2D2A26] min-h-[44px] min-w-[44px] flex items-center justify-center"
                        >
                          {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="signup-businessName" className="text-xs text-[#8D8A87]">Business / Firm Name <span className="font-normal">(optional)</span></Label>
                    <Input
                      id="signup-businessName"
                      name="organization"
                      autoComplete="organization"
                      value={signupForm.businessName}
                      onChange={e => setSignupForm(p => ({ ...p, businessName: e.target.value }))}
                      placeholder={signupForm.userType === "partner" ? "e.g. ABC Accounting" : "e.g. Karafuu Business"}
                    />
                  </div>
                  <div className="flex items-center gap-2 rounded-lg bg-[#F5EDE6] p-3">
                    <input
                      id="demo"
                      name="createDemo"
                      type="checkbox"
                      checked={signupForm.createDemo}
                      onChange={e => setSignupForm(p => ({ ...p, createDemo: e.target.checked }))}
                      className="h-5 w-5 rounded border-[#8D8A87]"
                    />
                    <label htmlFor="demo" className="text-xs text-[#2D2A26]">Start with <strong>Demo Mode</strong> -- preloaded with sample data</label>
                  </div>
                  <div>
                    <Label htmlFor="signup-referral" className="text-xs text-[#8D8A87] flex items-center gap-1">
                      <Gift className="h-3 w-3 text-[#D4A854]" />Referral Code (optional)
                    </Label>
                    <Input
                      id="signup-referral"
                      name="referralCode"
                      autoComplete="off"
                      spellCheck={false}
                      value={signupForm.referralCode}
                      onChange={e => setSignupForm(p => ({ ...p, referralCode: e.target.value.toUpperCase() }))}
                      placeholder="e.g. FINAABC123"
                      className="font-mono uppercase"
                    />
                  </div>
                  {/* Primary CTA: 48px+ touch target, full-width, clear visual
                      hierarchy. Avoids accidental overlap with surrounding form
                      fields via vertical spacing rather than side-by-side layout. */}
                  <Button
                    type="submit"
                    className="w-full bg-[#C73E1D] hover:bg-[#C73E1D]/90 min-h-[52px] text-base"
                    disabled={registerMutation.isPending || accountNameStatus === "checking"}
                    data-testid="signup-submit"
                  >
                    {signupForm.userType === "partner" ? <Briefcase className="mr-2 h-4 w-4" /> : <Store className="mr-2 h-4 w-4" />}
                    {registerMutation.isPending ? "Creating..." : signupForm.userType === "partner" ? "Join as Partner" : "Create Account"}
                  </Button>
                  {/* Prominent "already have an account" CTA — full-width, visually
                      distinct from the primary action, large enough to be tapped
                      confidently on mobile. */}
                  <button
                    type="button"
                    onClick={() => handleIntentChange("login")}
                    data-testid="account-cta-signin"
                    className="flex w-full items-center justify-center gap-2 rounded-md border border-[#E8E0D8] bg-white py-3 text-sm font-medium text-[#2D2A26] transition-colors hover:bg-[#F5EDE6] min-h-[48px]"
                  >
                    <LogIn className="h-4 w-4 text-[#C73E1D]" />
                    Already have an account? <span className="text-[#C73E1D] underline">Sign In</span>
                  </button>
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
