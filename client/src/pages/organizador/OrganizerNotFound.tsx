import { OrganizerLayout } from "@/components/organizador/OrganizerLayout";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Home } from "lucide-react";

export default function OrganizerNotFound() {
  return (
    <OrganizerLayout title="Página não encontrada">
      <div className="flex flex-col items-center justify-center py-16">
        <h1 className="text-4xl font-bold text-muted-foreground">404</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Página não encontrada
        </p>
        <Button asChild className="mt-6">
          <Link href="/organizadores">
            <Home className="mr-2 h-4 w-4" />
            Voltar ao Dashboard
          </Link>
        </Button>
      </div>
    </OrganizerLayout>
  );
}
