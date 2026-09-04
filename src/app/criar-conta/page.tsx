import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function CriarContaPage() {
  const user = await getSessionUser();
  if (user) redirect("/");
  return <AuthForm mode="register" />;
}
