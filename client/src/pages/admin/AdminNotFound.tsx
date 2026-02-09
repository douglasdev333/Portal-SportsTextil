import { Link } from "wouter";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowLeft } from "lucide-react";

export default function AdminNotFound() {
  return (
    <AdminLayout title="Página não encontrada">
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <AlertCircle className="h-16 w-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">Página não encontrada</h1>
        <p className="text-muted-foreground mb-6">
          A página que você está procurando não existe ou foi removida.
        </p>
        <Link href="/admin">
          <Button data-testid="button-back-dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar ao Dashboard
          </Button>
        </Link>
      </div>
    </AdminLayout>
  );
}
