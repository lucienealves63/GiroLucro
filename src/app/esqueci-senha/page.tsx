import { redirect } from "next/navigation";
import { ForgotPasswordForm } from "@/components/forgot-password-form";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function EsqueciSenhaPage() {
  const user = await getSessionUser();
  if (user) redirect("/");
  return <ForgotPasswordForm />;
}
