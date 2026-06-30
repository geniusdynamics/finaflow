import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Link, useSearchParams } from "react-router";
import { Landmark, ChevronLeft, Loader2, CheckCircle, Eye, EyeOff, Lock } from "lucide-react";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const mutation = trpc.localAuth.resetPassword.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      toast.success("Password reset successfully");
    },
    onError: (err: { message?: string }) => {
      toast.error(err.message || "Could not reset password. Please try again.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      toast.error("Reset token is missing");
      return;
    }
    if (!password) {
      toast.error("Please enter a new password");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    mutation.mutate({ token, password });
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#F5EDE6]">
      <div className="flex items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#C73E1D]">
            <Landmark className="h-4 w-4 text-white" />
          </div>
          <span className="font-serif text-lg font-bold text-[#2D2A26]">Finaflow</span>
        </Link>
        <Link to="/login" className="flex items-center gap-1 text-xs text-[#8D8A87] hover:text-[#C73E1D] transition-colors">
          <ChevronLeft className="h-3 w-3" /> Back to Sign In
        </Link>
      </div>
      <div className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center">
            <h1 className="font-serif text-3xl font-bold text-[#2D2A26]">Reset password</h1>
            <p className="mt-2 text-sm text-[#8D8A87]">
              Choose a new password for your account.
            </p>
          </div>
          <Card className="border-[#E8E0D8]">
            <CardContent className="p-5">
              {!token && !submitted && (
                <div className="rounded-lg bg-red-50 p-4 text-center text-sm text-red-700">
                  This reset link appears to be invalid. Please request a new one.
                </div>
              )}
              {submitted ? (
                <div className="text-center space-y-4 py-6">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  </div>
                  <h2 className="text-lg font-semibold text-[#2D2A26]">Password updated</h2>
                  <p className="text-sm text-[#8D8A87]">
                    Your password has been reset. You can now sign in with your new password.
                  </p>
                  <Button
                    asChild
                    className="w-full bg-[#C73E1D] hover:bg-[#C73E1D]/90 min-h-[48px] text-base"
                  >
                    <Link to="/login">Sign In</Link>
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                  <div>
                    <Label htmlFor="password" className="text-xs text-[#8D8A87]">New password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8D8A87]" />
                      <Input
                        id="password"
                        name="new-password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Min 6 characters"
                        className="pl-9 pr-10"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        aria-pressed={showPassword}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[#8D8A87] hover:text-[#2D2A26] min-h-[44px] min-w-[44px] flex items-center justify-center"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="confirmPassword" className="text-xs text-[#8D8A87]">Confirm password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8D8A87]" />
                      <Input
                        id="confirmPassword"
                        name="confirm-password"
                        type={showConfirmPassword ? "text" : "password"}
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Repeat password"
                        className="pl-9 pr-10"
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
                    {confirmPassword && password !== confirmPassword && (
                      <p className="mt-1.5 text-sm text-red-600">Passwords do not match</p>
                    )}
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-[#C73E1D] hover:bg-[#C73E1D]/90 min-h-[48px] text-base"
                    disabled={mutation.isPending || !token}
                  >
                    {mutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Resetting...
                      </>
                    ) : (
                      "Reset password"
                    )}
                  </Button>
                  <p className="text-center text-xs text-[#8D8A87]">
                    Remember your password?{" "}
                    <Link to="/login" className="font-medium text-[#C73E1D] underline">
                      Sign in
                    </Link>
                  </p>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
