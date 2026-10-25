import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import RegisterForm from "@/components/customer/RegisterForm";

export default async function RegisterPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");
  return (
    <div className="login-wrap">
      <div className="login-box">
        <div className="brand">
          <i className="fa-solid fa-tower-broadcast" /> SMMSOFT
        </div>
        <h1>Create your account</h1>
        <p className="hint">Send SMS from the web or through the API.</p>
        <RegisterForm />
      </div>
    </div>
  );
}
