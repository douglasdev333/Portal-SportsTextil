import { useState, useEffect, useCallback } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ArrowLeft, 
  Calendar, 
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Package,
  User,
  Award,
  Shirt,
  Copy,
  CreditCard,
  QrCode,
  RefreshCw,
  Download,
  Timer,
  Hash,
  Eye
} from "lucide-react";
import { Link } from "wouter";
import { useAthleteAuth } from "@/contexts/AthleteAuthContext";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { parseApiError, getFriendlyErrorMessage } from "@/lib/error-messages";
import CreditCardForm from "@/components/CreditCardForm";

interface Modalidade {
  id: string;
  nome: string;
  distancia: string;
  unidadeDistancia: string;
}

interface Inscricao {
  id: string;
  numeroInscricao: number;
  status: string;
  tamanhoCamisa: string | null;
  equipe: string | null;
  valorUnitario: number;
  taxaComodidade: number;
  dataInscricao: string;
  participanteNome: string;
  participanteCpf: string | null;
  modalidade: Modalidade | null;
}

interface Evento {
  id: string;
  nome: string;
  slug: string;
  dataEvento: string;
  cidade: string;
  estado: string;
  bannerUrl: string | null;
}

interface OrderDetail {
  id: string;
  numeroPedido: number;
  status: string;
  valorTotal: number;
  valorDesconto: number;
  subtotal: number;
  taxaTotal: number;
  codigoVoucher: string | null;
  codigoCupom: string | null;
  metodoPagamento: string | null;
  dataPedido: string;
  dataPagamento: string | null;
  dataExpiracao: string | null;
  pixQrCode: string | null;
  pixQrCodeBase64: string | null;
  pixExpiracao: string | null;
  pixDataGeracao: string | null;
  pixExpired: boolean;
  orderExpired: boolean;
  lastPaymentStatus: string | null;
  lastPaymentStatusDetail: string | null;
  evento: Evento | null;
  comprador: { id: string; nome: string; email: string } | null;
  inscricoes: Inscricao[];
}

function formatDate(dateString: string | null) {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatDateTime(dateString: string | null) {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatusConfig(status: string) {
  const configs: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string; icon: typeof CheckCircle2; color: string; className?: string }> = {
    pago: { variant: "default", label: "Pago", icon: CheckCircle2, color: "text-green-600" },
    confirmado: { variant: "default", label: "Confirmado", icon: CheckCircle2, color: "text-green-600" },
    confirmada: { variant: "default", label: "Confirmada", icon: CheckCircle2, color: "text-green-600" },
    pendente: { variant: "secondary", label: "Aguardando Pagamento", icon: Clock, color: "text-yellow-600", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border-yellow-300" },
    cancelado: { variant: "destructive", label: "Cancelado", icon: XCircle, color: "text-red-600" },
    cancelada: { variant: "destructive", label: "Cancelada", icon: XCircle, color: "text-red-600" },
    expirado: { variant: "destructive", label: "Expirado", icon: AlertCircle, color: "text-red-600" },
    reembolsado: { variant: "outline", label: "Reembolsado", icon: RefreshCw, color: "text-gray-600" },
    falhou: { variant: "destructive", label: "Falha no Pagamento", icon: XCircle, color: "text-red-600" },
    failed: { variant: "destructive", label: "Falha no Pagamento", icon: XCircle, color: "text-red-600" },
  };
  return configs[status] || { variant: "secondary" as const, label: status, icon: Clock, color: "text-gray-600" };
}

function CountdownTimer({ expirationDate, onExpire }: { expirationDate: string; onExpire?: () => void }) {
  const [timeLeft, setTimeLeft] = useState<{ minutes: number; seconds: number } | null>(null);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const expiration = new Date(expirationDate).getTime();
      const difference = expiration - now;

      if (difference <= 0) {
        setTimeLeft(null);
        onExpire?.();
        return;
      }

      const minutes = Math.floor((difference / 1000 / 60) % 60);
      const seconds = Math.floor((difference / 1000) % 60);
      setTimeLeft({ minutes, seconds });
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [expirationDate, onExpire]);

  if (!timeLeft) {
    return <span className="text-destructive font-semibold">Expirado</span>;
  }

  return (
    <span className="font-mono text-lg font-bold">
      {String(timeLeft.minutes).padStart(2, "0")}:{String(timeLeft.seconds).padStart(2, "0")}
    </span>
  );
}

function InscricaoCard({ inscricao, showDetails = true }: { inscricao: Inscricao; showDetails?: boolean }) {
  const [isDownloading, setIsDownloading] = useState(false);
  const { toast } = useToast();
  const statusConfig = getStatusConfig(inscricao.status);
  const StatusIcon = statusConfig.icon;

  const handleDownloadComprovante = async () => {
    setIsDownloading(true);
    try {
      const response = await fetch(`/api/receipts/${inscricao.id}`, {
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
      link.download = `comprovante-inscricao-${inscricao.numeroInscricao}.pdf`;
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

  return (
    <div className="p-4 bg-muted/30 rounded-md" data-testid={`card-inscricao-${inscricao.id}`}>
      <div className="flex items-start justify-between gap-2 flex-wrap mb-3">
        <div className="flex items-center gap-2">
          <Hash className="h-4 w-4 text-primary" />
          <span className="font-mono font-bold text-primary">#{inscricao.numeroInscricao}</span>
        </div>
        <Badge variant={statusConfig.variant} className={`text-xs ${statusConfig.className || ''}`}>
          <StatusIcon className="h-3 w-3 mr-1" />
          {statusConfig.label}
        </Badge>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{inscricao.participanteNome}</span>
        </div>

        {inscricao.modalidade && (
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {inscricao.modalidade.nome} - {inscricao.modalidade.distancia} {inscricao.modalidade.unidadeDistancia}
            </span>
          </div>
        )}

        {inscricao.tamanhoCamisa && (
          <div className="flex items-center gap-2">
            <Shirt className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Camisa {inscricao.tamanhoCamisa}</span>
          </div>
        )}
      </div>

      {showDetails && (
        <div className="mt-4 pt-3 border-t flex flex-col sm:flex-row gap-2">
          <Link href={`/inscricao/${inscricao.id}`} className="flex-1">
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full gap-1.5"
              data-testid={`button-view-inscricao-${inscricao.id}`}
            >
              <Eye className="h-4 w-4" />
              <span className="hidden sm:inline">Ver Inscrição</span>
              <span className="sm:hidden">Ver</span>
            </Button>
          </Link>
          {inscricao.status === "confirmada" && (
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1 gap-1.5"
              onClick={handleDownloadComprovante}
              disabled={isDownloading}
              data-testid={`button-download-comprovante-${inscricao.id}`}
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">{isDownloading ? "Baixando..." : "Baixar Comprovante"}</span>
              <span className="sm:hidden">{isDownloading ? "..." : "PDF"}</span>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export default function PedidoDetailPage() {
  const [, params] = useRoute("/pedido/:id");
  const [, setLocation] = useLocation();
  const { athlete, isLoading: authLoading } = useAthleteAuth();
  const { toast } = useToast();
  const orderId = params?.id;

  useEffect(() => {
    if (!authLoading && !athlete) {
      setLocation(`/login?redirect=${encodeURIComponent(`/pedido/${orderId}`)}`);
    }
  }, [authLoading, athlete, orderId, setLocation]);

  const { data, isLoading, refetch } = useQuery<{ success: boolean; data: OrderDetail }>({
    queryKey: ["/api/payments/order", orderId],
    enabled: !!athlete && !!orderId,
  });

  // Buscar configuração do Mercado Pago para cartão de crédito
  const { data: paymentConfig } = useQuery<{ success: boolean; data: { publicKey: string; configured: boolean } }>({
    queryKey: ["/api/payments/config"],
    enabled: !!athlete,
  });

  const mpPublicKey = paymentConfig?.data?.publicKey || "";
  const mpConfigured = paymentConfig?.data?.configured || false;

  // Estado local para forçar exibição das opções de pagamento após trocar método
  const [showPaymentOptions, setShowPaymentOptions] = useState(false);
  // Estado para controlar exibição do formulário de cartão
  const [showCardForm, setShowCardForm] = useState(false);
  const [isProcessingCard, setIsProcessingCard] = useState(false);

  const createPaymentMutation = useMutation({
    mutationFn: async (paymentMethod: "pix" | "credit_card") => {
      const response = await apiRequest("POST", "/api/payments/create", {
        orderId,
        paymentMethod,
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ["/api/payments/order", orderId] });
        // Reseta o estado para mostrar o resultado do pagamento
        setShowPaymentOptions(false);
        toast({
          title: "Pagamento iniciado",
          description: data.data.paymentMethod === "pix" ? "QR Code PIX gerado com sucesso!" : "Processando pagamento...",
        });
      } else {
        toast({
          title: "Erro",
          description: data.error || "Erro ao criar pagamento",
          variant: "destructive",
        });
      }
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao processar pagamento",
        variant: "destructive",
      });
    },
  });

  const changeMethodMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/payments/change-method/${orderId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments/order", orderId] });
      // Força exibição das opções de pagamento e esconde formulário de cartão
      setShowPaymentOptions(true);
      setShowCardForm(false);
      toast({
        title: "Pronto",
        description: "Escolha a nova forma de pagamento abaixo.",
      });
    },
  });

  // Handler para pagamento com cartão de crédito
  const handleCardPayment = async (cardData: {
    token: string;
    paymentMethodId: string;
    issuerId: string;
    installments: number;
    payerIdentification: {
      type: string;
      number: string;
    };
    cardholderName: string;
    deviceId?: string;
  }) => {
    // Prevenir chamadas duplicadas
    if (isProcessingCard) {
      console.log("[PedidoDetailPage] Ignorando chamada duplicada de handleCardPayment");
      return;
    }
    
    setIsProcessingCard(true);
    try {
      const response = await apiRequest("POST", "/api/payments/create", {
        orderId,
        paymentMethod: "credit_card",
        cardToken: cardData.token,
        paymentMethodId: cardData.paymentMethodId,
        issuerId: cardData.issuerId,
        installments: cardData.installments,
        payerIdentification: cardData.payerIdentification,
        cardholderName: cardData.cardholderName,
        deviceId: cardData.deviceId,
      });

      const result = await response.json();

      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ["/api/payments/order", orderId] });
        setShowPaymentOptions(false);
        setShowCardForm(false);
        
        if (result.data.status === "approved") {
          toast({
            title: "Pagamento aprovado!",
            description: "Sua inscrição foi confirmada.",
          });
        } else if (result.data.status === "pending" || result.data.status === "in_process") {
          toast({
            title: "Pagamento em análise",
            description: "Seu pagamento está sendo processado. Acompanhe o status.",
          });
        } else {
          toast({
            title: "Pagamento processado",
            description: "Verifique o status do seu pagamento.",
          });
        }
      } else {
        // Mapear erros do backend para mensagens amigáveis
        const friendlyMessage = getFriendlyErrorMessage(result.error, result.errorCode, result.statusDetail);
        toast({
          title: "Erro no pagamento",
          description: friendlyMessage,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      // Tentar extrair mensagem amigável do erro
      const friendlyMessage = parseApiError(error, "Erro ao processar pagamento. Tente novamente.");
      toast({
        title: "Erro",
        description: friendlyMessage,
        variant: "destructive",
      });
    } finally {
      setIsProcessingCard(false);
    }
  };

  // Ao clicar em cartão, mostrar o formulário em vez de chamar a API diretamente
  const handleSelectCardPayment = () => {
    setShowCardForm(true);
  };

  const handleCopyPixCode = useCallback(() => {
    if (data?.data?.pixQrCode) {
      navigator.clipboard.writeText(data.data.pixQrCode);
      toast({
        title: "Copiado!",
        description: "Código PIX copiado para a área de transferência.",
      });
    }
  }, [data?.data?.pixQrCode, toast]);

  const handleRefreshStatus = useCallback(async () => {
    try {
      // Primeiro verifica o status no Mercado Pago (pode confirmar pagamento automaticamente)
      await apiRequest("GET", `/api/payments/status/${orderId}`);
    } catch (error) {
      console.log("Erro ao verificar status do pagamento:", error);
    }
    // Depois atualiza os dados do pedido
    refetch();
  }, [orderId, refetch]);

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-8">
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

  const order = data?.data;

  if (!order) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-16 text-center">
          <AlertCircle className="h-16 w-16 mx-auto text-destructive mb-4" />
          <h1 className="text-2xl font-bold mb-2">Pedido não encontrado</h1>
          <p className="text-muted-foreground mb-6">
            O pedido que você está procurando não existe ou não está disponível.
          </p>
          <Button onClick={() => setLocation("/minhas-inscricoes")} data-testid="button-voltar-inscricoes">
            Ver minhas inscrições
          </Button>
        </div>
      </div>
    );
  }

  const statusConfig = getStatusConfig(order.status);
  const StatusIcon = statusConfig.icon;
  const isPending = order.status === "pendente";
  const isPaid = order.status === "pago";
  const isExpired = order.status === "expirado";
  const isCanceled = order.status === "cancelado";
  const isFailed = order.status === "falhou" || order.status === "failed";
  // Se showPaymentOptions=true, esconde o QR Code e mostra opções de pagamento
  const hasPixActive = isPending && order.pixQrCode && !order.pixExpired && !showPaymentOptions;
  const hasPixExpired = isPending && order.pixExpiracao && order.pixExpired && !showPaymentOptions;
  const canPay = isPending && !order.orderExpired;
  const canRetryPayment = isFailed && !order.orderExpired;
  const isPaymentRejected = isPending && order.lastPaymentStatus === "rejected";
  const isPaymentInProcess = isPending && order.lastPaymentStatus === "in_process";
  const rejectedMessage = order.lastPaymentStatusDetail ? 
    getFriendlyErrorMessage(undefined, undefined, order.lastPaymentStatusDetail) : 
    "Pagamento não autorizado. Tente outra forma de pagamento.";

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="max-w-4xl mx-auto px-4 md:px-6 py-8 md:py-12">
        <Button
          variant="ghost"
          onClick={() => setLocation("/minhas-inscricoes")}
          className="mb-6"
          data-testid="button-voltar"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>

        <Card className="mb-6">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10">
                  <Package className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl" data-testid="text-pedido-numero">
                    Pedido #{order.numeroPedido}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">{formatDateTime(order.dataPedido)}</p>
                </div>
              </div>
              <Badge variant={statusConfig.variant} className={`text-sm px-3 py-1 ${statusConfig.className || ''}`}>
                <StatusIcon className="h-4 w-4 mr-1" />
                {statusConfig.label}
              </Badge>
            </div>
          </CardHeader>

          <CardContent>
            {isPending && order.dataExpiracao && !order.orderExpired && (
              <div className="flex items-center gap-3 p-4 bg-yellow-50 dark:bg-yellow-950/20 rounded-md mb-4">
                <Timer className="h-5 w-5 text-yellow-600" />
                <div>
                  <p className="font-medium text-yellow-800 dark:text-yellow-400">
                    Tempo restante para pagamento
                  </p>
                  <CountdownTimer
                    expirationDate={order.dataExpiracao}
                    onExpire={handleRefreshStatus}
                  />
                </div>
              </div>
            )}

            {isPaymentRejected && (
              <div className="flex flex-col gap-3 p-4 bg-red-50 dark:bg-red-950/20 rounded-md mb-4 border border-red-200 dark:border-red-800">
                <div className="flex items-start gap-3">
                  <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold text-red-800 dark:text-red-400">
                      Pagamento não aprovado
                    </p>
                    <p className="text-sm text-red-700 dark:text-red-500 mt-1">
                      {rejectedMessage}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 mt-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowPaymentOptions(true)}
                    className="border-red-300 text-red-700 hover:bg-red-100"
                  >
                    Tentar outra forma de pagamento
                  </Button>
                  <a 
                    href="https://wa.me/5583981302961?text=Olá! Preciso de ajuda com meu pagamento rejeitado."
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="ghost" size="sm" className="text-muted-foreground">
                      Falar com suporte
                    </Button>
                  </a>
                </div>
              </div>
            )}

            {isPaymentInProcess && (
              <div className="flex flex-col gap-3 p-4 bg-orange-50 dark:bg-orange-950/20 rounded-md mb-4 border border-orange-200 dark:border-orange-800">
                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-orange-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold text-orange-800 dark:text-orange-400">
                      Pagamento em análise
                    </p>
                    <p className="text-sm text-orange-700 dark:text-orange-500 mt-1">
                      Seu pagamento está sendo analisado pelo banco ou operadora. Isso pode levar algumas horas.
                      Se não receber confirmação em até 24 horas, você pode tentar outra forma de pagamento.
                    </p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 mt-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleRefreshStatus()}
                    className="border-orange-300 text-orange-700 hover:bg-orange-100"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Verificar status
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowPaymentOptions(true)}
                    className="border-orange-300 text-orange-700 hover:bg-orange-100"
                  >
                    Tentar outra forma de pagamento
                  </Button>
                  <a 
                    href="https://wa.me/5583981302961?text=Olá! Meu pagamento está em análise há muito tempo."
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="ghost" size="sm" className="text-muted-foreground">
                      Falar com suporte
                    </Button>
                  </a>
                </div>
              </div>
            )}

            {isPaid && (
              <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950/20 rounded-md mb-4">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-semibold text-green-800 dark:text-green-400">
                    Pagamento confirmado!
                  </p>
                  {order.dataPagamento && (
                    <p className="text-sm text-green-700 dark:text-green-500">
                      Pago em {formatDateTime(order.dataPagamento)}
                    </p>
                  )}
                </div>
              </div>
            )}

            {isExpired && (
              <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-950/20 rounded-md mb-4">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <div>
                  <p className="font-semibold text-red-800 dark:text-red-400">
                    O tempo para pagamento acabou
                  </p>
                  <p className="text-sm text-red-700 dark:text-red-500">
                    Este pedido expirou e as inscrições foram canceladas.
                  </p>
                </div>
              </div>
            )}

            {isCanceled && (
              <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-950/20 rounded-md mb-4">
                <XCircle className="h-5 w-5 text-red-600" />
                <div>
                  <p className="font-semibold text-red-800 dark:text-red-400">Pedido cancelado</p>
                </div>
              </div>
            )}

            {isFailed && (
              <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-950/20 rounded-md mb-4">
                <XCircle className="h-5 w-5 text-red-600" />
                <div>
                  <p className="font-semibold text-red-800 dark:text-red-400">
                    Falha no pagamento
                  </p>
                  <p className="text-sm text-red-700 dark:text-red-500">
                    Houve um problema com seu pagamento. Você pode tentar novamente.
                  </p>
                </div>
              </div>
            )}

            <Separator className="my-4" />
            
            <div className="space-y-2">
              {(order.subtotal !== undefined && order.subtotal > 0) && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal ({order.inscricoes.length} {order.inscricoes.length === 1 ? 'inscrição' : 'inscrições'})</span>
                  <span className="font-medium">R$ {(order.subtotal || 0).toFixed(2).replace(".", ",")}</span>
                </div>
              )}
              
              {(order.taxaTotal !== undefined && order.taxaTotal > 0) && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Taxa de comodidade</span>
                  <span className="font-medium">R$ {(order.taxaTotal || 0).toFixed(2).replace(".", ",")}</span>
                </div>
              )}
              
              {(order.valorDesconto !== undefined && order.valorDesconto > 0) && (
                <div className="flex items-center justify-between text-sm text-green-600">
                  <span className="flex items-center gap-1">
                    Desconto
                    {order.codigoCupom && (
                      <Badge variant="outline" className="text-xs font-mono">
                        {order.codigoCupom}
                      </Badge>
                    )}
                    {order.codigoVoucher && !order.codigoCupom && (
                      <Badge variant="outline" className="text-xs font-mono">
                        {order.codigoVoucher}
                      </Badge>
                    )}
                  </span>
                  <span className="font-medium">- R$ {(order.valorDesconto || 0).toFixed(2).replace(".", ",")}</span>
                </div>
              )}
              
              <Separator className="my-2" />
              
              <div className="flex items-center justify-between pt-1">
                <span className="font-semibold">Valor total</span>
                <span className="text-2xl font-bold text-primary">
                  R$ {(order.valorTotal || 0).toFixed(2).replace(".", ",")}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {canPay && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Pagamento
              </CardTitle>
            </CardHeader>
            <CardContent>
              {hasPixActive ? (
                <div className="space-y-4">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-2">Escaneie o QR Code ou copie o código</p>
                    {order.pixQrCodeBase64 && (
                      <div className="flex justify-center mb-4">
                        <img
                          src={order.pixQrCodeBase64.startsWith("data:") 
                            ? order.pixQrCodeBase64 
                            : `data:image/png;base64,${order.pixQrCodeBase64}`}
                          alt="QR Code PIX"
                          className="w-48 h-48 border rounded-md"
                          data-testid="img-qrcode-pix"
                        />
                      </div>
                    )}
                    {order.pixExpiracao && (
                      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-4">
                        <Clock className="h-4 w-4" />
                        <span>PIX expira em: </span>
                        <CountdownTimer expirationDate={order.pixExpiracao} onExpire={handleRefreshStatus} />
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    <Button onClick={handleCopyPixCode} variant="outline" data-testid="button-copiar-pix">
                      <Copy className="h-4 w-4 mr-2" />
                      Copiar Código PIX
                    </Button>
                    <Button
                      onClick={handleRefreshStatus}
                      variant="ghost"
                      data-testid="button-verificar-pagamento"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Verificar Pagamento
                    </Button>
                  </div>

                  <Separator />

                  <Button
                    variant="ghost"
                    className="w-full"
                    onClick={() => changeMethodMutation.mutate()}
                    disabled={changeMethodMutation.isPending}
                    data-testid="button-trocar-metodo"
                  >
                    Trocar forma de pagamento
                  </Button>
                </div>
              ) : hasPixExpired ? (
                <div className="space-y-4">
                  <div className="p-4 bg-yellow-50 dark:bg-yellow-950/20 rounded-md text-center">
                    <AlertCircle className="h-8 w-8 mx-auto text-yellow-600 mb-2" />
                    <p className="font-semibold text-yellow-800 dark:text-yellow-400">
                      O QR Code PIX expirou
                    </p>
                    <p className="text-sm text-yellow-700 dark:text-yellow-500">
                      Gere um novo código para continuar o pagamento
                    </p>
                  </div>

                  <Button
                    onClick={() => createPaymentMutation.mutate("pix")}
                    disabled={createPaymentMutation.isPending}
                    className="w-full h-auto py-4"
                    data-testid="button-regenerar-pix"
                  >
                    <RefreshCw className="h-5 w-5 mr-2" />
                    Gerar Novo QR Code PIX
                  </Button>

                  <Separator />

                  <Button
                    variant="ghost"
                    className="w-full"
                    onClick={() => changeMethodMutation.mutate()}
                    disabled={changeMethodMutation.isPending}
                    data-testid="button-trocar-metodo-expirado"
                  >
                    Pagar com cartão de crédito
                  </Button>
                </div>
              ) : showCardForm ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowCardForm(false)}
                      data-testid="button-voltar-opcoes"
                    >
                      <ArrowLeft className="h-4 w-4 mr-1" />
                      Voltar
                    </Button>
                    <span className="text-sm text-muted-foreground">Pagamento com Cartão</span>
                  </div>
                  
                  {mpConfigured && mpPublicKey ? (
                    <CreditCardForm
                      amount={order.valorTotal}
                      onSubmit={handleCardPayment}
                      isProcessing={isProcessingCard}
                      publicKey={mpPublicKey}
                    />
                  ) : (
                    <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
                      <AlertCircle className="h-4 w-4 text-yellow-600" />
                      <span className="text-sm text-yellow-800 dark:text-yellow-200">
                        Pagamento com cartão temporariamente indisponível. Use PIX.
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-center text-muted-foreground">
                    Escolha a forma de pagamento
                  </p>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Button
                      onClick={() => createPaymentMutation.mutate("pix")}
                      disabled={createPaymentMutation.isPending}
                      className="h-auto py-4"
                      data-testid="button-pagar-pix"
                    >
                      <QrCode className="h-6 w-6 mr-3" />
                      <div className="text-left">
                        <p className="font-semibold">Pagar com PIX</p>
                        <p className="text-xs opacity-80">Aprovação instantânea</p>
                      </div>
                    </Button>

                    <Button
                      variant="outline"
                      onClick={handleSelectCardPayment}
                      disabled={createPaymentMutation.isPending}
                      className="h-auto py-4"
                      data-testid="button-pagar-cartao"
                    >
                      <CreditCard className="h-6 w-6 mr-3" />
                      <div className="text-left">
                        <p className="font-semibold">Cartão de Crédito</p>
                        <p className="text-xs text-muted-foreground">Pagamento seguro e instantâneo</p>
                      </div>
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {canRetryPayment && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Tentar Novamente
              </CardTitle>
            </CardHeader>
            <CardContent>
              {showCardForm ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowCardForm(false)}
                      data-testid="button-retry-voltar-opcoes"
                    >
                      <ArrowLeft className="h-4 w-4 mr-1" />
                      Voltar
                    </Button>
                    <span className="text-sm text-muted-foreground">Pagamento com Cartão</span>
                  </div>
                  
                  {mpConfigured && mpPublicKey ? (
                    <CreditCardForm
                      amount={order.valorTotal}
                      onSubmit={handleCardPayment}
                      isProcessing={isProcessingCard}
                      publicKey={mpPublicKey}
                    />
                  ) : (
                    <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
                      <AlertCircle className="h-4 w-4 text-yellow-600" />
                      <span className="text-sm text-yellow-800 dark:text-yellow-200">
                        Pagamento com cartão temporariamente indisponível. Use PIX.
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-center text-muted-foreground">
                    Escolha uma forma de pagamento para tentar novamente
                  </p>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Button
                      onClick={() => createPaymentMutation.mutate("pix")}
                      disabled={createPaymentMutation.isPending}
                      className="h-auto py-4"
                      data-testid="button-retry-pix"
                    >
                      <QrCode className="h-6 w-6 mr-3" />
                      <div className="text-left">
                        <p className="font-semibold">Pagar com PIX</p>
                        <p className="text-xs opacity-80">Aprovação instantânea</p>
                      </div>
                    </Button>

                    <Button
                      variant="outline"
                      onClick={handleSelectCardPayment}
                      disabled={createPaymentMutation.isPending}
                      className="h-auto py-4"
                      data-testid="button-retry-cartao"
                    >
                      <CreditCard className="h-6 w-6 mr-3" />
                      <div className="text-left">
                        <p className="font-semibold">Cartão de Crédito</p>
                        <p className="text-xs text-muted-foreground">Pagamento seguro e instantâneo</p>
                      </div>
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Inscrições
              </CardTitle>
              {order.inscricoes.length > 1 && (
                <Badge variant="secondary">
                  {order.inscricoes.length} inscrições
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {order.evento && (
              <div className="mb-4 p-3 bg-muted/50 rounded-md">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{order.evento.nome}</span>
                  <span className="text-muted-foreground">-</span>
                  <span className="text-muted-foreground">
                    {formatDate(order.evento.dataEvento)}
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {order.inscricoes.map((inscricao) => (
                <InscricaoCard key={inscricao.id} inscricao={inscricao} />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
