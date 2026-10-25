import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import LoginForm from "@/components/customer/LoginForm";
import {RadioTower} from "lucide-react";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");
  return (
    <div className="login-wrap">
      <div className="login-box">
        <div className="brand">
          <RadioTower aria-hidden="true" /> SMMSOFT
        </div>
        <h1>Login</h1>
        <p className="hint">Welcome back to SMMSOFT.</p>
        <LoginForm />
      </div>
    </div>
  );
}
