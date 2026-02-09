import { useQuery } from "@tanstack/react-query";
import { OrganizerLayout } from "@/components/organizador/OrganizerLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrganizerAuth } from "@/contexts/OrganizerAuthContext";
import { Calendar, MapPin, Users, Eye } from "lucide-react";
import { formatDateOnlyBrazil } from "@/lib/timezone";
import { Link } from "wouter";

interface Event {
  id: string;
  nome: string;
  slug: string;
  cidade: string;
  estado: string;
  dataEvento: string;
  status: string;
  limiteVagasTotal: number;
  vagasOcupadas: number;
  organizerId: string;
}

function getStatusBadge(status: string) {
  switch (status) {
    case "ativo":
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Ativo</Badge>;
    case "encerrado":
      return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Encerrado</Badge>;
    case "finalizado":
      return <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">Finalizado</Badge>;
    case "esgotado":
      return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Esgotado</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function EventCard({ event }: { event: Event }) {
  const vagasDisponiveis = event.limiteVagasTotal - event.vagasOcupadas;
  
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg truncate">{event.nome}</CardTitle>
            <CardDescription className="flex items-center gap-1 mt-1">
              <MapPin className="h-3 w-3" />
              {event.cidade}, {event.estado}
            </CardDescription>
          </div>
          {getStatusBadge(event.status)}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            {formatDateOnlyBrazil(event.dataEvento)}
          </div>
          <div className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            {event.vagasOcupadas} inscritos
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="text-sm">
            <span className="font-medium">{vagasDisponiveis}</span>
            <span className="text-muted-foreground"> vagas disponíveis de {event.limiteVagasTotal}</span>
          </div>
          
          <Link href={`/organizadores/evento/${event.id}`}>
            <Button size="sm" variant="outline">
              <Eye className="h-4 w-4 mr-1" />
              Visualizar
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function EventCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-5 w-16" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-8 w-24" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function OrganizerMeusEventosPage() {
  const { user } = useOrganizerAuth();

  const { data: eventsData, isLoading } = useQuery<{ success: boolean; data: Event[] }>({
    queryKey: ["/api/admin/events"],
  });

  const myEvents = (eventsData?.data || []).filter(
    (e: Event) => e.organizerId === user?.organizerId
  );

  return (
    <OrganizerLayout title="Meus Eventos">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Meus Eventos</h1>
          <p className="text-muted-foreground">
            Visualize todos os eventos vinculados à sua conta
          </p>
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <EventCardSkeleton />
            <EventCardSkeleton />
            <EventCardSkeleton />
          </div>
        ) : myEvents.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {myEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12">
              <div className="text-center space-y-2">
                <Calendar className="h-12 w-12 mx-auto text-muted-foreground" />
                <h3 className="text-lg font-medium">Nenhum evento encontrado</h3>
                <p className="text-muted-foreground">
                  Você não possui eventos vinculados à sua conta.
                  Entre em contato com o administrador.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </OrganizerLayout>
  );
}
