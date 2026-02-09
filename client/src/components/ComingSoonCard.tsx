import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Clock } from "lucide-react";

interface ComingSoonCardProps {
  index: number;
}

export default function ComingSoonCard({ index }: ComingSoonCardProps) {
  return (
    <Card 
      className="overflow-hidden border-dashed border-2 bg-muted/30" 
      data-testid={`card-coming-soon-${index}`}
    >
      <div className="aspect-[16/9] overflow-hidden bg-muted/50 flex items-center justify-center">
        <Clock className="h-12 w-12 text-muted-foreground/40" />
      </div>
      <CardHeader className="space-y-2 pb-3">
        <h3 className="text-xl font-bold text-muted-foreground/60 leading-tight">
          Em breve
        </h3>
      </CardHeader>
      <CardContent className="space-y-2 pb-4">
        <p className="text-sm text-muted-foreground/50">
          Novos eventos estão chegando! Fique ligado para não perder.
        </p>
      </CardContent>
    </Card>
  );
}
