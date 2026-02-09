import { useRoute, useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ArrowLeft, 
  Calendar, 
  MapPin, 
  Award, 
  User, 
  Shirt,
  CheckCircle2,
  Clock,
  Users,
  Hash,
  Package,
  AlertCircle,
  PartyPopper,
  Download,
  ExternalLink
} from "lucide-react";
import { formatDateOnlyLong, formatDateOnlyBrazil, formatCPF, formatPhone } from "@/lib/timezone";
import { useAthleteAuth } from "@/contexts/AthleteAuthContext";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useToast } from "@/hooks/use-toast";

interface RegistrationDetail {
  id: string;
  numeroInscricao: number;
  status: string;
  tamanhoCamisa: string | null;
  equipe: string | null;
  dataInscricao: string;
  valorPago: number;
  ajustePrecoTamanho?: number;
  participanteNome: string;
  participanteCpf: string | null;
  participanteDataNascimento: string | null;
  participanteSexo: string | null;
  participanteTelefone: string | null;
  participanteEmail: string | null;
  evento: {
    id: string;
    nome: string;
    slug: string;
    dataEvento: string;
    cidade: string;
    estado: string;
  } | null;
  modalidade: {
    id: string;
    nome: string;
    distancia: string;
    unidadeDistancia: string;
  } | null;
  pedido: {
    id: string;
    numeroPedido: number;
    status: string;
  } | null;
}

function StatusCard({ status }: { status: string }) {
  const statusConfig = {
    confirmada: {
      variant: "default" as const,
      label: "Confirmada",
      icon: CheckCircle2,
      bgColor: "bg-green-50 dark:bg-green-950/20",
      textColor: "text-green-800 dark:text-green-400",
      subTextColor: "text-green-700 dark:text-green-500",
      description: "Sua inscrição está confirmada! Você receberá um e-mail com mais informações sobre a retirada do kit."
    },
    pendente: {
      variant: "secondary" as const,
      label: "Aguardando Pagamento",
      icon: Clock,
      bgColor: "bg-yellow-50 dark:bg-yellow-950/20",
      textColor: "text-yellow-800 dark:text-yellow-400",
      subTextColor: "text-yellow-700 dark:text-yellow-500",
      description: "Estamos aguardando a confirmação do pagamento. Isso pode levar até 48 horas."
    },
    cancelada: {
      variant: "destructive" as const,
      label: "Cancelada",
      icon: AlertCircle,
      bgColor: "bg-red-50 dark:bg-red-950/20",
      textColor: "text-red-800 dark:text-red-400",
      subTextColor: "text-red-700 dark:text-red-500",
      description: "Esta inscrição foi cancelada."
    }
  };

  const currentStatus = statusConfig[status as keyof typeof statusConfig] || statusConfig.pendente;
  const StatusIcon = currentStatus.icon;

  return (
    <div className={`flex items-center gap-3 p-4 ${currentStatus.bgColor} rounded-md`}>
      <StatusIcon className={`h-5 w-5 flex-shrink-0 ${currentStatus.textColor}`} />
      <div className="min-w-0">
        <p className={`font-semibold ${currentStatus.textColor}`}>
          {currentStatus.label}
        </p>
        <p className={`text-sm ${currentStatus.subTextColor}`}>
          {currentStatus.description}
        </p>
      </div>
    </div>
  );
}

export default function InscricaoDetailPage() {
  const [, params] = useRoute("/inscricao/:id");
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  const isSuccess = searchParams.get("sucesso") === "1";
  const { athlete, isLoading: authLoading } = useAthleteAuth();
  const registrationId = params?.id;
  const { toast } = useToast();
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    if (!authLoading && !athlete) {
      setLocation(`/login?redirect=${encodeURIComponent(`/inscricao/${registrationId}`)}`);
    }
  }, [authLoading, athlete, registrationId, setLocation]);

  const { data, isLoading, error } = useQuery<{ success: boolean; data: RegistrationDetail[] }>({
    queryKey: ["/api/registrations/my-registrations"],
    enabled: !!athlete,
  });

  const handleVoltar = () => {
    setLocation("/minhas-inscricoes");
  };

  const handleVerEvento = (slug: string) => {
    setLocation(`/evento/${slug}`);
  };

  const handleDownloadComprovante = async () => {
    if (!registrationId) return;
    
    setIsDownloading(true);
    try {
      const response = await fetch(`/api/receipts/${registrationId}`, {
        credentials: "include",
      });
      
      if (!response.ok) {
        let errorMessage = "Erro ao baixar comprovante";
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          errorMessage = `Erro de rede (${response.status})`;
        }
        throw new Error(errorMessage);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const registration = data?.data?.find(r => r.id === registrationId);
      link.download = `comprovante-inscricao-${registration?.numeroInscricao || registrationId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Sucesso",
        description: "Comprovante baixado com sucesso!",
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao baixar comprovante. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Skeleton className="h-8 w-48 mb-4" />
          <Skeleton className="h-64 w-full mb-4" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (!athlete) {
    return null;
  }

  const registration = data?.data?.find(r => r.id === registrationId);

  if (error || !data?.success || !registration) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <AlertCircle className="h-16 w-16 mx-auto text-destructive mb-4" />
          <h1 className="text-2xl font-bold mb-2">Inscrição não encontrada</h1>
          <p className="text-muted-foreground mb-6">
            A inscrição que você está procurando não existe ou não está disponível.
          </p>
          <Button onClick={() => setLocation("/minhas-inscricoes")} data-testid="button-voltar-inscricoes">
            Ver minhas inscrições
          </Button>
        </div>
      </div>
    );
  }

  const formattedEventDate = registration.evento ? formatDateOnlyLong(registration.evento.dataEvento) : "";
  const formattedInscricaoDate = formatDateOnlyLong(registration.dataInscricao);

  const statusConfig = {
    confirmada: { variant: "default" as const, label: "Confirmada", className: "" },
    pendente: { variant: "secondary" as const, label: "Pendente", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border-yellow-300" },
    cancelada: { variant: "destructive" as const, label: "Cancelada", className: "" }
  };
  const currentStatus = statusConfig[registration.status as keyof typeof statusConfig] || statusConfig.pendente;

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="max-w-4xl mx-auto px-4 py-6 md:py-8">
        <Button
          variant="ghost"
          onClick={handleVoltar}
          className="mb-4"
          data-testid="button-voltar"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>

        <Card className="mb-4">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10 flex-shrink-0">
                  <Hash className="h-6 w-6 text-primary" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-xl" data-testid="text-inscricao-numero">
                    Inscrição #{registration.numeroInscricao}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">{formattedInscricaoDate}</p>
                </div>
              </div>
              <Badge variant={currentStatus.variant} className={`text-sm px-3 py-1 w-fit ${currentStatus.className || ''}`}>
                {currentStatus.label}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {isSuccess && (
              <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950/20 rounded-md">
                <PartyPopper className="h-5 w-5 text-green-600 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-green-800 dark:text-green-400">
                    Inscrição realizada com sucesso!
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-500">
                    Guarde o número da inscrição para referência.
                  </p>
                </div>
              </div>
            )}

            <StatusCard status={registration.status} />
          </CardContent>
        </Card>

        {registration.status === "confirmada" && (
          <Card className="mb-4">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle2 className="h-5 w-5" />
                QR Code de Verificação
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col items-center">
                <div className="bg-white p-4 rounded-lg border">
                  <QRCodeSVG
                    value={JSON.stringify({
                      nome: registration.participanteNome,
                      cpf: registration.participanteCpf || "",
                      n_inscricao: registration.numeroInscricao,
                      n_pedido: registration.pedido?.numeroPedido || "",
                    })}
                    size={180}
                    level="M"
                    fgColor="#6D28D9"
                  />
                </div>
                <p className="text-sm text-muted-foreground mt-3 text-center">
                  Apresente este QR code no dia do evento para agilizar sua identificação.
                </p>
              </div>
              <Separator />
              <Button 
                onClick={handleDownloadComprovante}
                disabled={isDownloading}
                className="w-full gap-2"
                data-testid="button-download-comprovante"
              >
                <Download className="h-4 w-4" />
                {isDownloading ? "Baixando..." : "Baixar Comprovante PDF"}
              </Button>
            </CardContent>
          </Card>
        )}

        {registration.evento && (
          <Card className="mb-4">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="h-5 w-5" />
                Evento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="font-semibold text-foreground text-lg">{registration.evento.nome}</p>
              </div>
              <Separator />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Data</p>
                  <p className="font-medium text-foreground">{formattedEventDate}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Local</p>
                  <p className="font-medium text-foreground flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {registration.evento.cidade}, {registration.evento.estado}
                  </p>
                </div>
              </div>
              <Button 
                variant="outline" 
                className="w-full gap-2"
                onClick={() => handleVerEvento(registration.evento!.slug)}
                data-testid="button-ver-evento"
              >
                <ExternalLink className="h-4 w-4" />
                Ver Pagina do Evento
              </Button>
            </CardContent>
          </Card>
        )}

        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Award className="h-5 w-5" />
              Modalidade
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {registration.modalidade ? (
              <>
                <div>
                  <p className="font-semibold text-foreground">{registration.modalidade.nome}</p>
                  <p className="text-sm text-muted-foreground">
                    {registration.modalidade.distancia} {registration.modalidade.unidadeDistancia}
                  </p>
                </div>
                {(registration.tamanhoCamisa || registration.equipe) && <Separator />}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {registration.tamanhoCamisa && (
                    <div className="flex items-center gap-2">
                      <Shirt className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Camisa</p>
                        <p className="font-medium text-foreground">{registration.tamanhoCamisa}</p>
                        {registration.ajustePrecoTamanho !== undefined && registration.ajustePrecoTamanho !== 0 && (
                          <p className={`text-xs ${registration.ajustePrecoTamanho < 0 ? 'text-green-600' : 'text-orange-600'}`}>
                            {registration.ajustePrecoTamanho < 0 
                              ? `Desconto: -R$ ${Math.abs(registration.ajustePrecoTamanho).toFixed(2).replace('.', ',')}` 
                              : `Acréscimo: +R$ ${registration.ajustePrecoTamanho.toFixed(2).replace('.', ',')}`}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                  {registration.equipe && (
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Equipe</p>
                        <p className="font-medium text-foreground">{registration.equipe}</p>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <p className="text-muted-foreground">Modalidade não informada</p>
            )}
          </CardContent>
        </Card>

        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-5 w-5" />
              Participante
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Nome</p>
              <p className="font-semibold text-foreground">{registration.participanteNome}</p>
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">CPF</p>
                <p className="text-sm text-foreground">{formatCPF(registration.participanteCpf)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Nascimento</p>
                <p className="text-sm text-foreground">{formatDateOnlyBrazil(registration.participanteDataNascimento)}</p>
              </div>
            </div>
            <Separator />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">E-mail</p>
                <p className="text-sm text-foreground break-all">{registration.participanteEmail || athlete?.email}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Telefone</p>
                <p className="text-sm text-foreground">{formatPhone(registration.participanteTelefone || athlete?.telefone)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {registration.pedido && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Package className="h-5 w-5" />
                Pedido
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-mono font-bold text-primary">#{registration.pedido.numeroPedido}</p>
                  <p className="text-sm text-muted-foreground capitalize">{registration.pedido.status}</p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setLocation(`/pedido/${registration.pedido?.id}`)}
                  data-testid="button-ver-pedido"
                >
                  Ver Pedido
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
