import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <SignUp />
    </div>
  );
}
