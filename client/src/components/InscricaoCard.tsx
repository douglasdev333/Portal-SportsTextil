import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Award } from "lucide-react";
import { Link } from "wouter";
import { formatDateOnlyLong } from "@/lib/timezone";

interface InscricaoCardProps {
  id: string;
  eventoNome: string;
  eventoData: string;
  eventoLocal: string;
  distancia: string;
  status: string;
  eventoImagem: string;
}

export default function InscricaoCard({
  id,
  eventoNome,
  eventoData,
  eventoLocal,
  distancia,
  status,
  eventoImagem,
}: InscricaoCardProps) {
  const formattedDate = formatDateOnlyLong(eventoData);

  const statusVariant = status === 'confirmada' ? 'default' : 'secondary';
  const statusLabel = status === 'confirmada' ? 'Confirmada' : 'Pendente';

  return (
    <Card className="overflow-hidden hover-elevate transition-all" data-testid={`card-inscricao-${id}`}>
      <div className="flex flex-col md:flex-row">
        <div className="w-full md:w-48 h-32 md:h-auto overflow-hidden">
          <img
            src={eventoImagem}
            alt={eventoNome}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="flex-1">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <h3 className="text-lg font-bold text-foreground" data-testid={`text-inscricao-event-${id}`}>
                {eventoNome}
              </h3>
              <Badge variant={statusVariant} data-testid={`badge-status-${id}`}>
                {statusLabel}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>{formattedDate}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>{eventoLocal}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Award className="h-4 w-4" />
              <span className="font-medium text-foreground">{distancia}</span>
            </div>
            <div className="flex gap-2 pt-2">
              <Link href={`/inscricao/${id}`} className="w-full md:w-auto">
                <Button variant="outline" size="sm" className="w-full" data-testid={`button-view-details-${id}`}>
                  Ver Detalhes
                </Button>
              </Link>
            </div>
          </CardContent>
        </div>
      </div>
    </Card>
  );
}
