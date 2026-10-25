import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import LoginForm from "@/components/customer/LoginForm";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");
  return (
    <div className="login-wrap">
      <div className="login-box">
        <div className="brand">
          <i className="fa-solid fa-tower-broadcast" /> SMMSOFT
        </div>
        <h1>Login</h1>
        <p className="hint">Welcome back to SMMSOFT.</p>
        <LoginForm />
      </div>
    </div>
  );
}
