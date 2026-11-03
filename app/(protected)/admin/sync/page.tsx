import { redirect } from "next/navigation";

/** Ancienne URL admin — la synchro est accessible à tous les utilisateurs. */
export default function AdminSyncRedirectPage() {
  redirect("/dashboard/synchronisation");
}
