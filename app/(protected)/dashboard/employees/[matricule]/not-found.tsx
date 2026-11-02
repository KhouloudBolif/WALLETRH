import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function EmployeeNotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <h1 className="font-serif text-3xl font-medium tracking-tight">Salarié introuvable</h1>
      <p className="mt-2 max-w-md text-muted-foreground">
        Ce matricule n&apos;existe pas dans les données de démonstration.
      </p>
      <Link
        href="/dashboard/employees"
        className={cn(buttonVariants({ variant: "outline" }), "mt-6")}
      >
        Retour à l&apos;annuaire
      </Link>
    </div>
  );
}
