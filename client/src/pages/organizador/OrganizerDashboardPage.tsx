import { useQuery } from "@tanstack/react-query";
import { OrganizerLayout } from "@/components/organizador/OrganizerLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrganizerAuth } from "@/contexts/OrganizerAuthContext";
import { Users, Calendar, TrendingUp, Shirt } from "lucide-react";
import { formatDateOnlyBrazil } from "@/lib/timezone";

interface DashboardStats {
  totalInscritos: number;
  inscritosPagos: number;
  faturamentoBruto: number;
  totalCamisas: number;
}

function StatsCard({ 
  title, 
  value, 
  description, 
  icon: Icon,
  isLoading 
}: { 
  title: string; 
  value: number | string; 
  description: string; 
  icon: React.ElementType;
  isLoading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <div className="text-2xl font-bold" data-testid={`stat-${title.toLowerCase().replace(/\s+/g, '-')}`}>
            {value}
          </div>
        )}
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

export default function OrganizerDashboardPage() {
  const { user } = useOrganizerAuth();

  const { data: eventsData, isLoading } = useQuery<{ success: boolean; data: any[] }>({
    queryKey: ["/api/admin/events"],
  });

  const events = eventsData?.data || [];
  const myEvent = events.find((e: any) => e.organizerId === user?.organizerId);

  return (
    <OrganizerLayout title="Dashboard">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard do Organizador</h1>
          <p className="text-muted-foreground">
            Bem-vindo, {user?.nome}! Visualize os dados do seu evento.
          </p>
        </div>

        {myEvent ? (
          <>
            <Card>
              <CardHeader>
                <CardTitle>{myEvent.nome}</CardTitle>
                <CardDescription>
                  {myEvent.cidade}, {myEvent.estado} - {formatDateOnlyBrazil(myEvent.dataEvento)}
                </CardDescription>
              </CardHeader>
            </Card>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <StatsCard
                title="Total Inscritos"
                value={0}
                description="Participantes inscritos"
                icon={Users}
                isLoading={isLoading}
              />
              <StatsCard
                title="Pagos"
                value={0}
                description="Inscrições confirmadas"
                icon={TrendingUp}
                isLoading={isLoading}
              />
              <StatsCard
                title="Faturamento"
                value="R$ 0,00"
                description="Valor total arrecadado"
                icon={Calendar}
                isLoading={isLoading}
              />
              <StatsCard
                title="Camisas"
                value={0}
                description="Total de camisas pedidas"
                icon={Shirt}
                isLoading={isLoading}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Inscrições Recentes</CardTitle>
                  <CardDescription>Últimas inscrições no evento</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    Nenhuma inscrição ainda
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Grade de Camisas</CardTitle>
                  <CardDescription>Quantidade por tamanho</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    Nenhuma camisa pedida ainda
                  </p>
                </CardContent>
              </Card>
            </div>
          </>
        ) : (
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-muted-foreground">
                Você não tem nenhum evento vinculado a sua conta.
                Entre em contato com o administrador.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </OrganizerLayout>
  );
}
