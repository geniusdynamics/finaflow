import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Link } from "react-router";
import { Landmark, ChevronLeft, Loader2, Mail, CheckCircle } from "lucide-react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const mutation = trpc.localAuth.requestPasswordReset.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      toast.success("Reset link sent — check your inbox");
    },
    onError: (err: { message?: string }) => {
      toast.error(err.message || "Could not request reset. Please try again.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Please enter your email address");
      return;
    }
    mutation.mutate({ email: email.trim() });
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
            <h1 className="font-serif text-3xl font-bold text-[#2D2A26]">Forgot password?</h1>
            <p className="mt-2 text-sm text-[#8D8A87]">
              Enter your email and we will send you a reset link.
            </p>
          </div>
          <Card className="border-[#E8E0D8]">
            <CardContent className="p-5">
              {submitted ? (
                <div className="text-center space-y-4 py-6">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  </div>
                  <h2 className="text-lg font-semibold text-[#2D2A26]">Check your email</h2>
                  <p className="text-sm text-[#8D8A87]">
                    If an account exists for <strong className="text-[#2D2A26]">{email}</strong>, we have sent a password reset link that expires in 1 hour.
                  </p>
                  <Button
                    asChild
                    className="w-full bg-[#C73E1D] hover:bg-[#C73E1D]/90 min-h-[48px] text-base"
                  >
                    <Link to="/login">Return to Sign In</Link>
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                  <div>
                    <Label htmlFor="email" className="text-xs text-[#8D8A87]">Email address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8D8A87]" />
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        inputMode="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@business.com"
                        className="pl-9"
                        required
                      />
                    </div>
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-[#C73E1D] hover:bg-[#C73E1D]/90 min-h-[48px] text-base"
                    disabled={mutation.isPending}
                  >
                    {mutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending link...
                      </>
                    ) : (
                      "Send reset link"
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
