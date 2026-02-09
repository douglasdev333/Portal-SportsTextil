import { OrganizerLayout } from "@/components/organizador/OrganizerLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useOrganizerAuth } from "@/contexts/OrganizerAuthContext";

export default function OrganizerInscritosPage() {
  const { user } = useOrganizerAuth();

  return (
    <OrganizerLayout title="Inscritos">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Lista de Inscritos</h1>
          <p className="text-muted-foreground">
            Visualize todos os participantes inscritos no seu evento
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Inscritos</CardTitle>
            <CardDescription>
              Lista completa de participantes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground py-8 text-center">
              Nenhum inscrito encontrado
            </p>
          </CardContent>
        </Card>
      </div>
    </OrganizerLayout>
  );
}
