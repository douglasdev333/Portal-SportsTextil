import Header from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserPlus, Users } from "lucide-react";

export default function ParticipantesPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="max-w-3xl mx-auto px-4 md:px-6 py-8 md:py-12">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
            Participantes
          </h1>
          <p className="text-muted-foreground">
            Gerencie os participantes da sua conta
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Lista de Participantes
            </CardTitle>
            <CardDescription>
              Cadastre outras pessoas para inscrever em eventos
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center py-12">
              <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Funcionalidade em Desenvolvimento
              </h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Em breve você poderá cadastrar e gerenciar participantes para realizar 
                inscrições em eventos para outras pessoas.
              </p>
              <Button disabled data-testid="button-add-participant">
                <UserPlus className="w-4 h-4 mr-2" />
                Adicionar Participante
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
