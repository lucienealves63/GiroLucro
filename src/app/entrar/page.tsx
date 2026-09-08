import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<{ redefinida?: string }>;
}) {
  const user = await getSessionUser();
  if (user) redirect("/");
  const params = await searchParams;
  return <AuthForm mode="login" resetSuccess={params.redefinida === "1"} />;
}
