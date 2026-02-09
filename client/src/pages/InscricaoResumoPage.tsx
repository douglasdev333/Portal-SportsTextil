import { useState, useEffect } from "react";
import { useRoute, useLocation, useSearch } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, User, Shirt, Award, Loader2, AlertCircle, CheckCircle, CalendarClock } from "lucide-react";
import Header from "@/components/Header";
import SimpleFooter from "@/components/SimpleFooter";
import { useAthleteAuth } from "@/contexts/AthleteAuthContext";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { parseApiError, getFriendlyErrorMessage } from "@/lib/error-messages";
import { formatDateOnlyBrazil } from "@/lib/timezone";

interface ModalityInfo {
  id: string;
  nome: string;
  distancia: string;
  unidadeDistancia: string;
  tipoAcesso: string;
  preco: number;
  taxaComodidade: number;
}

interface ShirtSizeInfo {
  id: string;
  tamanho: string;
  disponivel: number;
  ajustePreco: string;
}

interface RegistrationInfo {
  event: {
    id: string;
    nome: string;
    slug: string;
    dataEvento: string;
    cidade: string;
    estado: string;
  };
  modalities: ModalityInfo[];
  shirtSizes: {
    byModality: boolean;
    data: ShirtSizeInfo[] | { modalityId: string; sizes: ShirtSizeInfo[] }[];
  };
  registrationStatus?: 'not_started' | 'open' | 'closed' | 'sold_out';
  registrationMessage?: string | null;
}

export default function InscricaoResumoPage() {
  const [, params] = useRoute("/evento/:slug/inscricao/resumo");
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const { athlete, isLoading: authLoading } = useAthleteAuth();
  const { toast } = useToast();
  const [equipe, setEquipe] = useState("");
  const slug = params?.slug;

  const searchParams = new URLSearchParams(searchString);
  const modalidadeId = searchParams.get("modalidade") || "";
  const tamanho = searchParams.get("tamanho") || "";
  const voucherCode = searchParams.get("codigo") || "";

  useEffect(() => {
    if (!authLoading && !athlete) {
      const redirectUrl = `/evento/${slug}/inscricao/resumo?${searchString}`;
      setLocation(`/login?redirect=${encodeURIComponent(redirectUrl)}`);
    }
  }, [authLoading, athlete, slug, searchString, setLocation]);

  const { data, isLoading, error } = useQuery<{ success: boolean; data: RegistrationInfo; error?: string }>({
    queryKey: ["/api/registrations/events", slug, "registration-info"],
    queryFn: async () => {
      const response = await fetch(`/api/registrations/events/${slug}/registration-info`);
      return response.json();
    },
    enabled: !!slug && !!athlete,
  });

  const createRegistrationMutation = useMutation({
    mutationFn: async (registrationData: {
      eventId: string;
      modalityId: string;
      tamanhoCamisa?: string;
      equipe?: string;
      voucherCode?: string;
    }) => {
      const response = await apiRequest("POST", "/api/registrations", registrationData);
      return response.json();
    },
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ["/api/registrations"] });
        
        const isGratuita = result.data.order.valorTotal === 0;
        
        if (isGratuita) {
          toast({
            title: "Inscrição confirmada!",
            description: `Sua inscrição #${result.data.registration.numeroInscricao} foi realizada com sucesso.`,
          });
          setLocation(`/inscricao/${result.data.registration.id}?sucesso=1`);
        } else {
          setLocation(`/evento/${slug}/inscricao/pagamento?orderId=${result.data.order.id}`);
        }
      } else {
        const friendlyMessage = getFriendlyErrorMessage(result.error, result.errorCode);
        toast({
          title: "Erro na inscrição",
          description: friendlyMessage,
          variant: "destructive"
        });
      }
    },
    onError: (error: any) => {
      const friendlyMessage = parseApiError(error, "Não foi possível realizar a inscrição.");
      toast({
        title: "Erro na inscrição",
        description: friendlyMessage,
        variant: "destructive"
      });
    }
  });

  const handleVoltar = () => {
    setLocation(`/evento/${slug}/inscricao/modalidade`);
  };

  const handleConfirmar = () => {
    if (!athlete || !data?.data) return;

    createRegistrationMutation.mutate({
      eventId: data.data.event.id,
      modalityId: modalidadeId,
      tamanhoCamisa: tamanho || undefined,
      equipe: equipe || undefined,
      voucherCode: voucherCode || undefined
    });
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background pb-24 md:pb-8">
        <Header />
        <div className="max-w-2xl mx-auto px-4 py-8 md:py-12">
          <Skeleton className="h-8 w-24 mb-6" />
          <div className="mb-8">
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!athlete) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data?.success) {
    const errorResponse = data as any;
    const registrationStatus = errorResponse?.registrationStatus;
    const registrationMessage = errorResponse?.registrationMessage;
    const errorMessage = data?.error;
    
    const isNotStarted = registrationStatus === 'not_started';
    const isClosed = registrationStatus === 'closed';
    
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="max-w-2xl mx-auto px-4 py-8 md:py-12 text-center">
          {isNotStarted ? (
            <CalendarClock className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          ) : (
            <AlertCircle className="h-16 w-16 mx-auto text-destructive mb-4" />
          )}
          <h1 className="text-2xl font-bold mb-2">
            {isNotStarted ? "Inscrições em Breve" : 
             isClosed ? "Inscrições Encerradas" : 
             "Erro ao carregar dados"}
          </h1>
          <p className="text-muted-foreground mb-6">
            {registrationMessage || errorMessage || "Não foi possível carregar as informações do evento."}
          </p>
          <Button onClick={() => setLocation(`/evento/${slug}`)}>
            Voltar para o evento
          </Button>
        </div>
      </div>
    );
  }

  const { event, modalities, shirtSizes } = data.data;
  const selectedModality = modalities.find(m => m.id === modalidadeId);

  let ajustePrecoTamanho = 0;
  if (tamanho && shirtSizes) {
    let availableSizes: ShirtSizeInfo[] = [];
    if (shirtSizes.byModality && modalidadeId) {
      const modalitySizes = (shirtSizes.data as { modalityId: string; sizes: ShirtSizeInfo[] }[])
        .find(s => s.modalityId === modalidadeId);
      availableSizes = modalitySizes?.sizes || [];
    } else if (!shirtSizes.byModality) {
      availableSizes = shirtSizes.data as ShirtSizeInfo[];
    }
    const selectedSize = availableSizes.find(s => s.tamanho === tamanho);
    ajustePrecoTamanho = selectedSize ? parseFloat(selectedSize.ajustePreco || '0') : 0;
  }
  
  if (!selectedModality) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="max-w-2xl mx-auto px-4 py-8 md:py-12 text-center">
          <AlertCircle className="h-16 w-16 mx-auto text-destructive mb-4" />
          <h1 className="text-2xl font-bold mb-2">Modalidade não encontrada</h1>
          <p className="text-muted-foreground mb-6">
            Selecione uma modalidade para continuar.
          </p>
          <Button onClick={() => setLocation(`/evento/${slug}/inscricao/modalidade`)}>
            Escolher modalidade
          </Button>
        </div>
      </div>
    );
  }

  const valorModalidade = selectedModality.preco;
  const taxaComodidade = selectedModality.taxaComodidade;
  const valorComAjuste = Math.max(0, valorModalidade + ajustePrecoTamanho);
  const valorTotal = valorComAjuste + taxaComodidade;
  const isGratuita = selectedModality.tipoAcesso === "gratuita" || valorTotal === 0;

  const formatCpf = (cpf: string) => {
    return cpf;
  };

  const formatPrice = (value: number) => {
    if (value === 0) return "Gratuito";
    return `R$ ${value.toFixed(2).replace('.', ',')}`;
  };

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-8">
      <Header />
      <div className="max-w-2xl mx-auto px-4 py-8 md:py-12">
        <Button
          variant="ghost"
          onClick={handleVoltar}
          className="mb-6"
          disabled={createRegistrationMutation.isPending}
          data-testid="button-voltar"
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>

        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
            Resumo da Inscrição
          </h1>
          <p className="text-muted-foreground">
            Confira os dados da sua inscrição
          </p>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Evento</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-semibold text-foreground">{event.nome}</p>
              <p className="text-sm text-muted-foreground">
                {event.cidade}, {event.estado}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-5 w-5" />
                Dados do Participante
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Participante</p>
                <p className="font-semibold text-foreground">{athlete.nome}</p>
                <p className="text-sm text-muted-foreground">CPF: {formatCpf(athlete.cpf)}</p>
                <p className="text-sm text-muted-foreground">
                  Data de Nascimento: {formatDateOnlyBrazil(athlete.dataNascimento)}
                </p>
              </div>

              <div className="border-t pt-4">
                <div className="flex items-start gap-2 mb-2">
                  <Award className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground mb-1">Modalidade</p>
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-foreground">
                        {selectedModality.nome} ({selectedModality.distancia} {selectedModality.unidadeDistancia})
                      </p>
                      <p className="text-lg font-bold text-foreground">
                        {formatPrice(valorModalidade)}
                      </p>
                    </div>
                    {taxaComodidade > 0 && (
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-sm text-muted-foreground">Taxa de comodidade</p>
                        <p className="text-sm text-muted-foreground">
                          R$ {taxaComodidade.toFixed(2).replace('.', ',')}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {tamanho && (
                <div className="border-t pt-4">
                  <div className="flex items-start gap-2">
                    <Shirt className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground mb-1">Tamanho da Camisa</p>
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-foreground">{tamanho}</p>
                        {ajustePrecoTamanho !== 0 && (
                          <p className={`text-sm font-medium ${ajustePrecoTamanho < 0 ? 'text-green-600' : 'text-orange-600'}`}>
                            {ajustePrecoTamanho < 0 ? `-R$ ${Math.abs(ajustePrecoTamanho).toFixed(2).replace('.', ',')}` : `+R$ ${ajustePrecoTamanho.toFixed(2).replace('.', ',')}`}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Equipe (Opcional)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="equipe" className="text-sm text-muted-foreground">
                  Nome da equipe ou assessoria esportiva
                </Label>
                <Input
                  id="equipe"
                  placeholder="Ex: Assessoria RunFast"
                  value={equipe}
                  onChange={(e) => setEquipe(e.target.value)}
                  disabled={createRegistrationMutation.isPending}
                  data-testid="input-equipe"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-background border-t shadow-lg z-50">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              {isGratuita ? (
                <p className="text-lg md:text-xl font-bold text-green-600 dark:text-green-400 flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  Inscrição Gratuita
                </p>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">
                    R$ {valorComAjuste.toFixed(2).replace('.', ',')} + Taxa R$ {taxaComodidade.toFixed(2).replace('.', ',')}
                    {ajustePrecoTamanho !== 0 && (
                      <span className={ajustePrecoTamanho < 0 ? 'text-green-600' : 'text-orange-600'}>
                        {` (${ajustePrecoTamanho < 0 ? 'desc.' : 'acresc.'} camisa)`}
                      </span>
                    )}
                  </p>
                  <p className="text-lg md:text-xl font-bold text-foreground">
                    Total: R$ {valorTotal.toFixed(2).replace('.', ',')}
                  </p>
                </>
              )}
            </div>
            <Button
              size="lg"
              onClick={handleConfirmar}
              disabled={createRegistrationMutation.isPending}
              className="font-semibold pl-[15px] pr-[15px]"
              data-testid="button-confirmar"
            >
              {createRegistrationMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : isGratuita ? (
                "Confirmar Inscrição"
              ) : (
                "Ir para Pagamento"
              )}
            </Button>
          </div>
        </div>
      </div>
      <SimpleFooter />
    </div>
  );
}
