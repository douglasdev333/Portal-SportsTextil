import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Calendar, ClipboardList, TrendingUp } from "lucide-react";

interface DashboardStats {
  organizadores: number;
  eventos: number;
  eventosPublicados: number;
  eventosRascunho: number;
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

export default function AdminDashboardPage() {
  const { data: organizersData, isLoading: loadingOrganizers } = useQuery<{ success: boolean; data: any[] }>({
    queryKey: ["/api/admin/organizers"],
  });

  const { data: eventsData, isLoading: loadingEvents } = useQuery<{ success: boolean; data: any[] }>({
    queryKey: ["/api/admin/events"],
  });

  const organizers = organizersData?.data || [];
  const events = eventsData?.data || [];
  
  const eventosPublicados = events.filter((e: any) => e.status === "publicado").length;
  const eventosRascunho = events.filter((e: any) => e.status === "rascunho").length;

  const isLoading = loadingOrganizers || loadingEvents;

  return (
    <AdminLayout title="Dashboard">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Visao geral do sistema KitRunner
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Organizadores"
            value={organizers.length}
            description="Total cadastrados"
            icon={Users}
            isLoading={isLoading}
          />
          <StatsCard
            title="Eventos"
            value={events.length}
            description="Total de eventos"
            icon={Calendar}
            isLoading={isLoading}
          />
          <StatsCard
            title="Publicados"
            value={eventosPublicados}
            description="Eventos ativos"
            icon={TrendingUp}
            isLoading={isLoading}
          />
          <StatsCard
            title="Rascunhos"
            value={eventosRascunho}
            description="Aguardando publicação"
            icon={ClipboardList}
            isLoading={isLoading}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Eventos Recentes</CardTitle>
              <CardDescription>Últimos eventos cadastrados</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : events.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Nenhum evento cadastrado
                </p>
              ) : (
                <div className="space-y-2">
                  {events.slice(0, 5).map((event: any) => (
                    <div 
                      key={event.id} 
                      className="flex items-center justify-between rounded-md border p-3"
                      data-testid={`event-row-${event.id}`}
                    >
                      <div>
                        <p className="font-medium">{event.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {event.cidade}, {event.estado}
                        </p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        event.status === "publicado" 
                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" 
                          : event.status === "rascunho"
                          ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                          : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                      }`}>
                        {event.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Organizadores</CardTitle>
              <CardDescription>Organizadores cadastrados</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : organizers.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Nenhum organizador cadastrado
                </p>
              ) : (
                <div className="space-y-2">
                  {organizers.slice(0, 5).map((org: any) => (
                    <div 
                      key={org.id} 
                      className="flex items-center justify-between rounded-md border p-3"
                      data-testid={`organizer-row-${org.id}`}
                    >
                      <div>
                        <p className="font-medium">{org.nome}</p>
                        <p className="text-xs text-muted-foreground">{org.email}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {org.cpfCnpj}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
