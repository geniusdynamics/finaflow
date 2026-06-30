import { Link } from "react-router";
import { ShieldAlert, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Unauthorized() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F5EDE6] px-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#D32F2F]/10">
        <ShieldAlert className="h-8 w-8 text-[#D32F2F]" />
      </div>
      <h1 className="mt-6 font-serif text-2xl font-bold text-[#2D2A26]">
        Access Restricted
      </h1>
      <p className="mt-2 max-w-md text-center text-sm text-[#8D8A87]">
        You don&apos;t have permission to view this page. If you believe this is
        a mistake, contact your account administrator.
      </p>
      <div className="mt-6 flex gap-3">
        <Link to="/">
          <Button variant="outline" className="border-[#E8E0D8]">
            Back to Home
          </Button>
        </Link>
        <Link to="/login">
          <Button className="bg-[#C73E1D] hover:bg-[#C73E1D]/90">
            <LogIn className="mr-2 h-4 w-4" />
            Sign In
          </Button>
        </Link>
      </div>
    </div>
  );
}
