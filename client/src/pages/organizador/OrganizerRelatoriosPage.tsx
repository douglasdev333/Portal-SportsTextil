import { OrganizerLayout } from "@/components/organizador/OrganizerLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useOrganizerAuth } from "@/contexts/OrganizerAuthContext";

export default function OrganizerRelatoriosPage() {
  const { user } = useOrganizerAuth();

  return (
    <OrganizerLayout title="Relatorios">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Relatorios</h1>
          <p className="text-muted-foreground">
            Exporte dados e relatorios do seu evento
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Exportar Inscritos</CardTitle>
              <CardDescription>
                Baixe a lista completa de inscritos em CSV ou Excel
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground py-4 text-center">
                Sem dados para exportar
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Grade de Camisas</CardTitle>
              <CardDescription>
                Relatorio de camisas por tamanho
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground py-4 text-center">
                Sem dados para exportar
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </OrganizerLayout>
  );
}
