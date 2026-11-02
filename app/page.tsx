import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { HomeHero } from "@/components/landing/home-hero";
import { getRoleHomePath } from "@/lib/auth/redirect";

export default async function HomePage() {
  const session = await auth();

  if (session?.user?.role) {
    redirect(getRoleHomePath(session.user.role));
  }

  return <HomeHero />;
}
