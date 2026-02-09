import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Trophy } from "lucide-react";
import { Link } from "wouter";
import { formatDateOnlyLong } from "@/lib/timezone";

interface EventCardProps {
  id: string;
  slug: string;
  nome: string;
  data: string;
  local: string;
  cidade: string;
  estado: string;
  distancias?: string;
  imagemUrl: string;
  isPast?: boolean;
}

export default function EventCard({
  id,
  slug,
  nome,
  data,
  local,
  cidade,
  estado,
  distancias,
  imagemUrl,
  isPast = false,
}: EventCardProps) {
  const formattedDate = formatDateOnlyLong(data);

  return (
    <Card className="overflow-hidden hover-elevate transition-all" data-testid={`card-event-${id}`}>
      <div className="aspect-[16/9] overflow-hidden">
        <img
          src={imagemUrl}
          alt={nome}
          className="w-full h-full object-cover"
        />
      </div>
      <CardHeader className="space-y-2 pb-3">
        <h3 className="text-xl font-bold text-foreground leading-tight" data-testid={`text-event-name-${id}`}>
          {nome}
        </h3>
        {distancias && distancias.trim() && (
          <div className="flex flex-wrap gap-2">
            {distancias.split(',').filter(d => d.trim()).map((dist, idx) => (
              <Badge key={idx} variant="secondary" className="text-xs">
                {dist.trim()}
              </Badge>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-2 pb-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span data-testid={`text-event-date-${id}`}>{formattedDate}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4" />
          <span data-testid={`text-event-location-${id}`}>{cidade}, {estado}</span>
        </div>
      </CardContent>
      <CardFooter>
        <Link href={isPast ? `/evento/${slug}/resultados` : `/evento/${slug}`} className="w-full">
          <Button 
            variant={isPast ? "outline" : "default"}
            className="w-full font-semibold"
            data-testid={`button-view-event-${id}`}
          >
            {isPast ? (
              <>
                <Trophy className="h-4 w-4 mr-2" />
                Resultados
              </>
            ) : (
              "Inscreva-se"
            )}
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
