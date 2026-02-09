import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, ChevronLeft, AlertCircle, Clock } from "lucide-react";
import { formatDateOnlyLong } from "@/lib/timezone";

interface EventBasic {
  id: string;
  nome: string;
  slug: string;
  dataEvento: string;
  cidade: string;
  estado: string;
  bannerUrl?: string;
  status: string;
}

export default function EventoResultadosPage() {
  const [, params] = useRoute("/evento/:slug/resultados");
  const [, setLocation] = useLocation();
  const slug = params?.slug;

  const { data, isLoading, error } = useQuery<{ success: boolean; data: EventBasic }>({
    queryKey: ["/api/events", slug],
    queryFn: async () => {
      const response = await fetch(`/api/events/${slug}`);
      return response.json();
    },
    enabled: !!slug,
  });

  const event = data?.data;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Skeleton className="h-8 w-32 mb-6" />
          <Skeleton className="h-12 w-64 mb-4" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <AlertCircle className="h-16 w-16 mx-auto text-destructive mb-4" />
          <h1 className="text-2xl font-bold mb-2">Evento não encontrado</h1>
          <p className="text-muted-foreground mb-6">
            O evento que você está procurando não existe ou não está disponível.
          </p>
          <Button onClick={() => setLocation("/")}>
            Ver todos os eventos
          </Button>
        </div>
      </div>
    );
  }

  const formattedDate = formatDateOnlyLong(event.dataEvento);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Button
          variant="ghost"
          onClick={() => setLocation(`/evento/${slug}`)}
          className="mb-6"
          data-testid="button-voltar"
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          Voltar para o evento
        </Button>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Trophy className="h-8 w-8 text-green-600" />
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              Resultados
            </h1>
          </div>
          <p className="text-lg text-muted-foreground">{event.nome}</p>
          <p className="text-sm text-muted-foreground">{formattedDate} - {event.cidade}, {event.estado}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Resultados em breve
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12">
              <Trophy className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
              <h2 className="text-xl font-semibold text-foreground mb-2">
                Os resultados serão publicados em breve
              </h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                A organização está processando os resultados oficiais. 
                Volte em breve para conferir a classificação completa.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
