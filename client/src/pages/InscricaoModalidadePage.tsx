import { useState, useEffect, useCallback } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ShieldCheck, AlertCircle, Loader2, CheckCircle, XCircle, CalendarClock, Ticket } from "lucide-react";
import Header from "@/components/Header";
import SimpleFooter from "@/components/SimpleFooter";
import { useAthleteAuth } from "@/contexts/AthleteAuthContext";
import { apiRequest } from "@/lib/queryClient";

interface ModalityInfo {
  id: string;
  nome: string;
  distancia: string;
  unidadeDistancia: string;
  horarioLargada: string;
  descricao: string | null;
  tipoAcesso: string;
  preco: number;
  taxaComodidade: number;
  limiteVagas: number | null;
  vagasDisponiveis: number | null;
  idadeMinima: number | null;
  ordem: number;
  ativo?: boolean;
  isSoldOut?: boolean;
  isAvailable?: boolean;
  inscricaoBloqueada?: boolean;
  motivoBloqueio?: string;
}

interface ShirtSize {
  id: string;
  tamanho: string;
  disponivel: number;
  ajustePreco?: string;
}

interface RegistrationInfo {
  event: {
    id: string;
    nome: string;
    slug: string;
    entregaCamisaNoKit: boolean;
    status?: string;
  };
  modalities: ModalityInfo[];
  activeBatch: {
    id: string;
    nome: string;
  } | null;
  shirtSizes: {
    byModality: boolean;
    data: ShirtSize[] | { modalityId: string; sizes: ShirtSize[] }[];
  };
  eventSoldOut?: boolean;
  registrationStatus?: 'not_started' | 'open' | 'closed' | 'sold_out';
  registrationMessage?: string | null;
}

export default function InscricaoModalidadePage() {
  const [, params] = useRoute("/evento/:slug/inscricao/modalidade");
  const [, setLocation] = useLocation();
  const { athlete, isLoading: authLoading } = useAthleteAuth();
  const slug = params?.slug;
  
  const [modalidadeSelecionada, setModalidadeSelecionada] = useState("");
  const [tamanhoSelecionado, setTamanhoSelecionado] = useState("");
  const [codigoComprovacao, setCodigoComprovacao] = useState("");
  const [voucherValidado, setVoucherValidado] = useState<{
    valid: boolean;
    voucher?: { id: string; code: string; batchName?: string | null; validUntil: string };
    error?: string;
    message?: string;
  } | null>(null);

  useEffect(() => {
    if (!authLoading && !athlete) {
      const redirectUrl = `/evento/${slug}/inscricao/modalidade`;
      setLocation(`/login?redirect=${encodeURIComponent(redirectUrl)}`);
    }
  }, [authLoading, athlete, slug, setLocation]);

  const { data, isLoading, error } = useQuery<{ success: boolean; data: RegistrationInfo; error?: string; aberturaInscricoes?: string }>({
    queryKey: ["/api/registrations/events", slug, "registration-info"],
    queryFn: async () => {
      const response = await fetch(`/api/registrations/events/${slug}/registration-info`);
      return response.json();
    },
    enabled: !!slug && !!athlete,
  });

  const eventId = data?.data?.event?.id;

  const validateVoucherMutation = useMutation({
    mutationFn: async ({ code, eventId }: { code: string; eventId: string }) => {
      try {
        const response = await fetch("/api/vouchers/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, eventId }),
          credentials: "include"
        });
        
        const result = await response.json();
        
        // Handle business logic errors (404, 409, 422) - these are NOT connection errors
        if (!response.ok) {
          // These are expected business errors from the backend
          if (response.status === 404 || response.status === 409 || response.status === 422 || response.status === 400) {
            return { 
              valid: false, 
              error: result.error?.code || "invalid",
              message: result.error?.message || "Voucher inválido"
            };
          }
          // 5xx errors are server errors
          if (response.status >= 500) {
            return {
              valid: false,
              error: "server_error",
              message: "Erro no servidor. Por favor, tente novamente."
            };
          }
        }
        
        if (result.success && result.data?.voucher) {
          return { valid: true, voucher: result.data.voucher };
        } else {
          return { 
            valid: false, 
            error: result.error?.code || "invalid",
            message: result.error?.message || "Voucher invalido"
          };
        }
      } catch (error) {
        // Only true network errors (timeout, no connection, etc) should reach here
        throw error;
      }
    },
    onSuccess: (result) => {
      setVoucherValidado(result);
    },
    onError: () => {
      // This only fires for real network failures (fetch threw an exception)
      setVoucherValidado({
        valid: false,
        error: "network_error",
        message: "Erro de conexão. Verifique sua internet e tente novamente."
      });
    }
  });

  const handleVoucherCodeChange = useCallback((value: string) => {
    setCodigoComprovacao(value);
    setVoucherValidado(null);
  }, []);

  const handleValidateVoucher = useCallback(() => {
    if (!codigoComprovacao.trim() || !eventId) return;
    validateVoucherMutation.mutate({
      code: codigoComprovacao.trim(),
      eventId: eventId
    });
  }, [codigoComprovacao, eventId, validateVoucherMutation]);

  useEffect(() => {
    setVoucherValidado(null);
    setCodigoComprovacao("");
  }, [modalidadeSelecionada]);

  const handleVoltar = () => {
    setLocation(`/evento/${slug}/inscricao/participante`);
  };

  const handleContinuar = () => {
    if (!modalidadeSelecionada) return;
    
    const modality = data?.data?.modalities.find(m => m.id === modalidadeSelecionada);
    if (!modality) return;
    
    if (modality.tipoAcesso === "voucher" && !voucherValidado?.valid) {
      return;
    }
    
    // Build URL - tamanho is optional if no shirt sizes are available
    const params = new URLSearchParams();
    params.set('modalidade', modalidadeSelecionada);
    if (tamanhoSelecionado) {
      params.set('tamanho', tamanhoSelecionado);
    }
    if (voucherValidado?.voucher?.code) {
      params.set('codigo', voucherValidado.voucher.code);
    }
    
    const url = `/evento/${slug}/inscricao/resumo?${params.toString()}`;
    setLocation(url);
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
          <div className="space-y-6">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-48 w-full" />
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

  const { modalities: allModalities, shirtSizes, activeBatch, eventSoldOut, registrationStatus, registrationMessage } = data.data;
  const modalities = allModalities
    .filter(m => m.ativo !== false)
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  const isEventSoldOut = eventSoldOut || data.data?.event?.status === 'esgotado' || registrationStatus === 'sold_out';
  const cannotRegister = registrationStatus !== 'open' && registrationStatus !== undefined;
  const selectedModality = modalities.find(m => m.id === modalidadeSelecionada);
  
  const sizeOrder: Record<string, number> = {
    'PP': 1, 'P': 2, 'M': 3, 'G': 4, 'GG': 5, 'XG': 6, 'XGG': 7, 'EG': 8, 'EGG': 9,
    '2': 10, '4': 11, '6': 12, '8': 13, '10': 14, '12': 15, '14': 16
  };
  
  let availableSizes: ShirtSize[] = [];
  if (shirtSizes.byModality && modalidadeSelecionada) {
    const modalitySizes = (shirtSizes.data as { modalityId: string; sizes: ShirtSize[] }[])
      .find(s => s.modalityId === modalidadeSelecionada);
    availableSizes = modalitySizes?.sizes || [];
  } else if (!shirtSizes.byModality) {
    availableSizes = shirtSizes.data as ShirtSize[];
  }
  
  availableSizes = [...availableSizes].sort((a, b) => {
    const orderA = sizeOrder[a.tamanho.toUpperCase()] ?? 99;
    const orderB = sizeOrder[b.tamanho.toUpperCase()] ?? 99;
    return orderA - orderB;
  });

  const taxaComodidadeValor = selectedModality?.taxaComodidade ?? 0;
  const valorModalidade = selectedModality?.preco ?? 0;
  const selectedSize = availableSizes.find(s => s.tamanho === tamanhoSelecionado);
  const ajustePrecoTamanho = selectedSize ? parseFloat(selectedSize.ajustePreco || '0') : 0;
  const valorComAjuste = Math.max(0, valorModalidade + ajustePrecoTamanho);
  const valorTotal = valorComAjuste + taxaComodidadeValor;

  const requiresCode = selectedModality?.tipoAcesso === "voucher";
  const requiresApproval = selectedModality?.tipoAcesso === "aprovacao_manual" || selectedModality?.tipoAcesso === "pcd";
  
  const requiresShirtSize = availableSizes.length > 0;
  
  const voucherIsValid = voucherValidado?.valid === true;
  const voucherHasError = voucherValidado?.valid === false;
  const isValidatingVoucher = validateVoucherMutation.isPending;
  
  const podeAvancar = modalidadeSelecionada && 
    (!requiresShirtSize || tamanhoSelecionado) && 
    (!requiresCode || voucherIsValid) &&
    !isEventSoldOut &&
    !cannotRegister;

  const getTipoAcessoBadge = (tipoAcesso: string) => {
    switch (tipoAcesso) {
      case "gratuita":
        return <Badge variant="secondary">Gratuita</Badge>;
      case "paga":
        return null;
      case "voucher":
        return <Badge>Código</Badge>;
      case "pcd":
        return <Badge>PCD</Badge>;
      case "aprovacao_manual":
        return <Badge>Aprovação</Badge>;
      default:
        return null;
    }
  };

  const formatPrice = (value: number | null | undefined) => {
    if (value === null || value === undefined) return "Preço indisponível";
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
          data-testid="button-voltar"
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>

        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
            Escolha a Modalidade
          </h1>
          <p className="text-muted-foreground">
            Selecione a distância e o tamanho da sua camisa
          </p>
          {activeBatch && (
            <p className="text-sm text-primary mt-1">
              Lote atual: {activeBatch.nome}
            </p>
          )}
        </div>

        {(isEventSoldOut || cannotRegister) && (
          <Alert variant={registrationStatus === 'not_started' ? 'default' : 'destructive'} className="mb-6">
            {registrationStatus === 'not_started' ? (
              <CalendarClock className="h-4 w-4" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            <AlertDescription>
              {registrationMessage || (isEventSoldOut 
                ? 'Este evento está com todas as vagas esgotadas. Não é possível realizar novas inscrições no momento.'
                : 'Não é possível realizar inscrições no momento.')}
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Modalidade</CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup value={modalidadeSelecionada} onValueChange={setModalidadeSelecionada}>
                <div className="space-y-2">
                  {modalities.map((modality, idx) => {
                    const isSoldOut = modality.isSoldOut || (modality.vagasDisponiveis !== null && modality.vagasDisponiveis <= 0);
                    const isBlocked = modality.inscricaoBloqueada === true;
                    const blockReason = modality.motivoBloqueio;
                    const isEventSoldOut = data?.data?.eventSoldOut || data?.data?.event?.status === 'esgotado';
                    const isUnavailable = isSoldOut || isBlocked || isEventSoldOut;
                    
                    return (
                      <div
                        key={modality.id}
                        className={`flex items-center justify-between p-4 border rounded-md transition-all ${
                          modalidadeSelecionada === modality.id 
                            ? 'border-primary bg-primary/5' 
                            : isUnavailable 
                              ? 'opacity-50 cursor-not-allowed' 
                              : 'hover-elevate'
                        }`}
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <RadioGroupItem 
                            value={modality.id} 
                            id={`modalidade-${idx}`}
                            disabled={isUnavailable}
                            data-testid={`radio-modalidade-${idx}`}
                          />
                          <Label htmlFor={`modalidade-${idx}`} className="flex-1 cursor-pointer">
                            <div className="flex items-center justify-between gap-4 flex-wrap">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-foreground">{modality.nome}</span>
                                {getTipoAcessoBadge(modality.tipoAcesso)}
                                {isSoldOut && (
                                  <Badge variant="destructive">Esgotado</Badge>
                                )}
                                {isBlocked && !isSoldOut && (
                                  <Badge variant="destructive">Indisponível</Badge>
                                )}
                              </div>
                              <Badge variant="secondary" className="font-semibold">
                                {formatPrice(modality.preco)}
                              </Badge>
                            </div>
                            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mt-1">
                              <span>{modality.distancia} {modality.unidadeDistancia}</span>
                              <span>Largada: {modality.horarioLargada}</span>
                              {modality.vagasDisponiveis !== null && !isSoldOut && (
                                <span>{modality.vagasDisponiveis} vagas</span>
                              )}
                              {isBlocked && blockReason && (
                                <span className="text-destructive">{blockReason}</span>
                              )}
                            </div>
                          </Label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </RadioGroup>
            </CardContent>
          </Card>

          {requiresCode && (
            <Alert className={`border-primary/50 ${voucherIsValid ? 'bg-green-50 dark:bg-green-950/30 border-green-500/50' : voucherHasError ? 'bg-destructive/10 border-destructive/50' : 'bg-primary/5'}`}>
              <div className="flex gap-2">
                {voucherIsValid ? (
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                ) : voucherHasError ? (
                  <XCircle className="h-5 w-5 text-destructive" />
                ) : (
                  <Ticket className="h-5 w-5 text-primary" />
                )}
                <div className="flex-1">
                  <AlertDescription className="text-sm">
                    {voucherIsValid ? (
                      <span className="text-green-700 dark:text-green-300 font-medium">
                        Voucher validado com sucesso!
                        {voucherValidado?.voucher?.batchName && (
                          <span className="block text-xs mt-1 font-normal">
                            Lote: {voucherValidado.voucher.batchName}
                          </span>
                        )}
                      </span>
                    ) : voucherHasError ? (
                      <span className="text-destructive font-medium">
                        {voucherValidado?.message || 'Voucher inválido'}
                      </span>
                    ) : (
                      'Esta modalidade requer um código de acesso. Insira o código fornecido e valide para continuar.'
                    )}
                  </AlertDescription>
                  
                  <div className="mt-3 flex gap-2 items-end flex-wrap">
                    <div className="flex-1 min-w-[200px] max-w-xs">
                      <Label htmlFor="codigo-comprovacao" className="text-sm font-medium mb-2 block">
                        Código de Acesso (Voucher)
                      </Label>
                      <Input
                        id="codigo-comprovacao"
                        placeholder="Ex: A7F3B2"
                        value={codigoComprovacao}
                        onChange={(e) => handleVoucherCodeChange(e.target.value.toUpperCase())}
                        className={voucherIsValid ? 'border-green-500' : voucherHasError ? 'border-destructive' : ''}
                        disabled={isValidatingVoucher}
                        data-testid="input-codigo-comprovacao"
                      />
                    </div>
                    <Button
                      type="button"
                      variant={voucherIsValid ? "secondary" : "default"}
                      onClick={handleValidateVoucher}
                      disabled={!codigoComprovacao.trim() || isValidatingVoucher}
                      data-testid="button-validar-voucher"
                    >
                      {isValidatingVoucher ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Validando...
                        </>
                      ) : voucherIsValid ? (
                        <>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Validado
                        </>
                      ) : (
                        'Validar'
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </Alert>
          )}

          {requiresApproval && (
            <Alert className="border-primary/50 bg-primary/5">
              <div className="flex gap-2">
                <AlertCircle className="h-5 w-5 text-primary" />
                <div className="flex-1">
                  <AlertDescription className="text-sm">
                    Esta modalidade requer aprovação. Sua inscrição será analisada e você receberá a confirmação por email em até 48 horas.
                  </AlertDescription>
                </div>
              </div>
            </Alert>
          )}

          {availableSizes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Tamanho da Camisa</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {availableSizes.map((size, idx) => {
                    const isUnavailable = size.disponivel <= 0;
                    const ajuste = parseFloat(size.ajustePreco || '0');
                    const precoFinal = Math.max(0, valorModalidade + ajuste);
                    return (
                      <Button
                        key={size.id}
                        variant={tamanhoSelecionado === size.tamanho ? "default" : "outline"}
                        onClick={() => !isUnavailable && setTamanhoSelecionado(size.tamanho)}
                        className={`font-semibold h-auto py-2 px-2 flex flex-col items-center text-center whitespace-normal break-words min-h-[48px] ${isUnavailable ? 'opacity-50 cursor-not-allowed' : ''}`}
                        disabled={isUnavailable}
                        data-testid={`button-tamanho-${size.tamanho}`}
                      >
                        <span className="text-xs sm:text-sm leading-tight">{size.tamanho}</span>
                        {!isUnavailable && ajuste !== 0 && (
                          <span className={`text-xs ${ajuste < 0 ? 'text-green-600 dark:text-green-400' : 'text-orange-600'}`}>
                            {ajuste < 0 ? `-R$ ${Math.abs(ajuste).toFixed(0)}` : `+R$ ${ajuste.toFixed(0)}`}
                          </span>
                        )}
                        {isUnavailable && <span className="text-xs">(Esgotado)</span>}
                      </Button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t shadow-lg z-50">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4 mb-3">
            <div>
              {selectedModality ? (
                <>
                  {valorTotal > 0 ? (
                    <>
                      <p className="text-xs text-muted-foreground">
                        {formatPrice(valorComAjuste)} + Taxa R$ {taxaComodidadeValor.toFixed(2).replace('.', ',')}
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
                  ) : (
                    <p className="md:text-xl font-bold text-green-600 dark:text-green-400 flex items-center gap-2 text-[16px]">
                      <CheckCircle className="h-5 w-5" />
                      Inscrição Gratuita
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-lg md:text-xl font-bold text-foreground">
                    Selecione uma modalidade
                  </p>
                </>
              )}
            </div>
            <Button
              size="lg"
              onClick={handleContinuar}
              disabled={!podeAvancar}
              className="font-semibold"
              data-testid="button-continuar"
            >
              Continuar
            </Button>
          </div>
        </div>
      </div>
      <SimpleFooter />
    </div>
  );
}
