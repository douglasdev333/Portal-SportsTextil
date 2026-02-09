import { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { 
  Calendar, 
  MapPin, 
  Award, 
  Eye,
  User,
  Package,
  CheckCircle2,
  Clock,
  Shirt,
  Loader2,
  XCircle,
  Search,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { useAthleteAuth } from "@/contexts/AthleteAuthContext";

const ITEMS_PER_PAGE = 5;

interface Modalidade {
  id: string;
  nome: string;
  distancia: string;
  unidadeDistancia: string;
}

interface Inscricao {
  id: string;
  numeroInscricao: number;
  participanteNome: string;
  status: string;
  tamanhoCamisa: string | null;
  equipe: string | null;
  valorUnitario: number;
  taxaComodidade: number;
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

interface Pedido {
  id: string;
  numeroPedido: number;
  dataPedido: string;
  status: string;
  valorTotal: number;
  valorDesconto: number;
  metodoPagamento: string | null;
  evento: Evento | null;
  inscricoes: Inscricao[];
}

function formatDate(dateString: string) {
  if (!dateString) return '';
  const dateOnly = dateString.split('T')[0];
  const [year, month, day] = dateOnly.split('-').map(Number);
  
  if (!year || !month || !day) return '';
  
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
}

function getStatusConfig(status: string) {
  const configs: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string; icon: typeof CheckCircle2; className?: string }> = {
    pago: { variant: "default", label: "Pago", icon: CheckCircle2 },
    confirmado: { variant: "default", label: "Confirmado", icon: CheckCircle2 },
    confirmada: { variant: "default", label: "Confirmada", icon: CheckCircle2 },
    pendente: { variant: "secondary", label: "Pendente", icon: Clock, className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border-yellow-300" },
    cancelado: { variant: "destructive", label: "Cancelado", icon: XCircle },
    cancelada: { variant: "destructive", label: "Cancelada", icon: XCircle },
    concluido: { variant: "outline", label: "Concluído", icon: CheckCircle2 },
    concluida: { variant: "outline", label: "Concluída", icon: CheckCircle2 },
    expirado: { variant: "destructive", label: "Expirado", icon: XCircle },
  };
  return configs[status] || { variant: "secondary" as const, label: status, icon: Clock };
}

function InscricaoItem({ inscricao, evento }: { inscricao: Inscricao; evento: Evento | null }) {
  const statusConfig = getStatusConfig(inscricao.status);
  
  return (
    <div className="p-4 bg-muted/30 rounded-md space-y-3" data-testid={`inscricao-item-${inscricao.id}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">#{inscricao.numeroInscricao}</span>
          <Badge variant={statusConfig.variant} className={`text-xs ${statusConfig.className || ''}`}>
            {statusConfig.label}
          </Badge>
        </div>
      </div>
      
      <div className="flex items-start gap-3">
        {evento?.bannerUrl && (
          <div className="w-14 h-14 rounded-md overflow-hidden flex-shrink-0">
            <img
              src={evento.bannerUrl}
              alt={evento.nome}
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-foreground text-sm mb-1 line-clamp-2">
            {evento?.nome || "Evento"}
          </h4>
          <p className="text-sm text-muted-foreground flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="truncate">{inscricao.participanteNome}</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Award className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="truncate">{inscricao.modalidade?.nome || "-"}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
          <span>{evento?.dataEvento ? formatDate(evento.dataEvento) : "-"}</span>
        </div>
        {inscricao.tamanhoCamisa && (
          <div className="flex items-center gap-1.5 col-span-2 sm:col-span-1">
            <Shirt className="h-3.5 w-3.5 flex-shrink-0" />
            <span>Camisa {inscricao.tamanhoCamisa}</span>
          </div>
        )}
      </div>

      <Link href={`/inscricao/${inscricao.id}`} className="block">
        <Button variant="outline" size="sm" className="w-full gap-1.5" data-testid={`button-view-inscricao-${inscricao.id}`}>
          <Eye className="h-4 w-4" />
          Ver Inscricao
        </Button>
      </Link>
    </div>
  );
}

function PedidoCard({ pedido }: { pedido: Pedido }) {
  const statusConfig = getStatusConfig(pedido.status);
  const StatusIcon = statusConfig.icon;
  const qtdInscricoes = pedido.inscricoes.length;
  const isPending = pedido.status === "pendente";
  
  return (
    <Card className="overflow-hidden" data-testid={`card-pedido-${pedido.id}`}>
      <CardHeader className="bg-muted/50 pb-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <Link href={`/pedido/${pedido.id}`}>
                  <h3 className="font-bold text-foreground hover:text-primary transition-colors cursor-pointer" data-testid={`text-pedido-numero-${pedido.id}`}>
                    Pedido #{pedido.numeroPedido}
                  </h3>
                </Link>
                <Badge variant={statusConfig.variant} className={`text-xs ${statusConfig.className || ''}`}>
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {statusConfig.label}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {formatDate(pedido.dataPedido)} {qtdInscricoes} {qtdInscricoes === 1 ? 'inscrição' : 'inscrições'}
              </p>
            </div>
          </div>
          <div className="text-right flex items-center gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Valor total</p>
              <p className="font-bold text-lg text-foreground">
                R$ {pedido.valorTotal.toFixed(2)}
              </p>
            </div>
            <Link href={`/pedido/${pedido.id}`}>
              <Button variant={isPending ? "default" : "outline"} size="sm" data-testid={`button-ver-pedido-${pedido.id}`}>
                {isPending ? "Pagar" : "Ver Pedido"}
              </Button>
            </Link>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4 space-y-3">
        {pedido.inscricoes.map((inscricao, index) => (
          <div key={inscricao.id}>
            <InscricaoItem inscricao={inscricao} evento={pedido.evento} />
            {index < pedido.inscricoes.length - 1 && (
              <Separator className="my-3" />
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function MinhasInscricoesPage() {
  const [activeTab, setActiveTab] = useState("todas");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPageTodas, setCurrentPageTodas] = useState(1);
  const [currentPageProximas, setCurrentPageProximas] = useState(1);
  const [currentPageConcluidas, setCurrentPageConcluidas] = useState(1);
  const [, setLocation] = useLocation();
  const { athlete, isLoading: isAuthLoading } = useAthleteAuth();

  // Track if we should poll (based on previous data)
  const [shouldPoll, setShouldPoll] = useState(false);

  const { data: ordersData, isLoading: isOrdersLoading } = useQuery<{ success: boolean; data: Pedido[] }>({
    queryKey: ['/api/registrations/my-orders'],
    enabled: !!athlete,
    refetchOnWindowFocus: true,
    refetchInterval: shouldPoll ? 5000 : false,
    refetchIntervalInBackground: false
  });

  // Update polling state based on data
  useEffect(() => {
    const pedidos = ordersData?.data || [];
    const hasPending = pedidos.some(p => p.status === 'pendente');
    setShouldPoll(hasPending);
  }, [ordersData]);

  useEffect(() => {
    if (!isAuthLoading && !athlete) {
      setLocation("/login?redirect=" + encodeURIComponent("/minhas-inscricoes"));
    }
  }, [isAuthLoading, athlete, setLocation]);

  // Reset pagination when search changes
  useEffect(() => {
    setCurrentPageTodas(1);
    setCurrentPageProximas(1);
    setCurrentPageConcluidas(1);
  }, [searchTerm]);

  // Reset pagination when changing tabs
  useEffect(() => {
    if (activeTab === "todas") {
      setCurrentPageProximas(1);
      setCurrentPageConcluidas(1);
    } else if (activeTab === "proximas") {
      setCurrentPageTodas(1);
      setCurrentPageConcluidas(1);
    } else {
      setCurrentPageTodas(1);
      setCurrentPageProximas(1);
    }
  }, [activeTab]);

  const isLoading = isAuthLoading || isOrdersLoading;
  const pedidos = ordersData?.data || [];
  
  // Sort by date (most recent first)
  const pedidosOrdenados = useMemo(() => {
    return [...pedidos].sort((a, b) => {
      const dateA = new Date(a.dataPedido).getTime();
      const dateB = new Date(b.dataPedido).getTime();
      return dateB - dateA;
    });
  }, [pedidos]);

  // Filter by search term
  const pedidosFiltrados = useMemo(() => {
    if (!searchTerm.trim()) return pedidosOrdenados;
    
    const term = searchTerm.toLowerCase().trim();
    return pedidosOrdenados.filter(p => {
      const matchEvento = p.evento?.nome?.toLowerCase().includes(term);
      const matchNumero = p.numeroPedido.toString().includes(term);
      const matchParticipante = p.inscricoes.some(i => 
        i.participanteNome?.toLowerCase().includes(term)
      );
      const matchModalidade = p.inscricoes.some(i => 
        i.modalidade?.nome?.toLowerCase().includes(term)
      );
      return matchEvento || matchNumero || matchParticipante || matchModalidade;
    });
  }, [pedidosOrdenados, searchTerm]);

  const now = new Date();
  const pedidosProximos = pedidosFiltrados.filter(p => {
    if (!p.evento?.dataEvento) return true;
    const eventDate = new Date(p.evento.dataEvento);
    return eventDate >= now;
  });
  
  const pedidosConcluidos = pedidosFiltrados.filter(p => {
    if (!p.evento?.dataEvento) return false;
    const eventDate = new Date(p.evento.dataEvento);
    return eventDate < now;
  });

  // Pagination logic
  const totalPagesTodas = Math.ceil(pedidosFiltrados.length / ITEMS_PER_PAGE) || 1;
  const totalPagesProximas = Math.ceil(pedidosProximos.length / ITEMS_PER_PAGE) || 1;
  const totalPagesConcluidas = Math.ceil(pedidosConcluidos.length / ITEMS_PER_PAGE) || 1;

  // Clamp current page if it exceeds total pages (when results decrease)
  useEffect(() => {
    if (currentPageTodas > totalPagesTodas) {
      setCurrentPageTodas(Math.max(1, totalPagesTodas));
    }
  }, [currentPageTodas, totalPagesTodas]);

  useEffect(() => {
    if (currentPageProximas > totalPagesProximas) {
      setCurrentPageProximas(Math.max(1, totalPagesProximas));
    }
  }, [currentPageProximas, totalPagesProximas]);

  useEffect(() => {
    if (currentPageConcluidas > totalPagesConcluidas) {
      setCurrentPageConcluidas(Math.max(1, totalPagesConcluidas));
    }
  }, [currentPageConcluidas, totalPagesConcluidas]);

  const pedidosTodasPaginados = pedidosFiltrados.slice(
    (currentPageTodas - 1) * ITEMS_PER_PAGE,
    currentPageTodas * ITEMS_PER_PAGE
  );

  const pedidosProximosPaginados = pedidosProximos.slice(
    (currentPageProximas - 1) * ITEMS_PER_PAGE,
    currentPageProximas * ITEMS_PER_PAGE
  );

  const pedidosConcluidosPaginados = pedidosConcluidos.slice(
    (currentPageConcluidas - 1) * ITEMS_PER_PAGE,
    currentPageConcluidas * ITEMS_PER_PAGE
  );

  const totalInscricoesTodas = pedidosFiltrados.reduce((acc, p) => acc + p.inscricoes.length, 0);
  const totalInscricoesProximas = pedidosProximos.reduce((acc, p) => acc + p.inscricoes.length, 0);
  const totalInscricoesConcluidas = pedidosConcluidos.reduce((acc, p) => acc + p.inscricoes.length, 0);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!athlete) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="max-w-5xl mx-auto px-4 md:px-6 py-8 md:py-12">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
            Minhas Inscrições
          </h1>
          <p className="text-muted-foreground">
            Gerencie suas inscrições em eventos esportivos
          </p>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por evento, participante, modalidade ou n° do pedido..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="input-search-inscricoes"
          />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-lg grid-cols-3">
            <TabsTrigger value="todas" data-testid="tab-todas">
              Todas ({totalInscricoesTodas})
            </TabsTrigger>
            <TabsTrigger value="proximas" data-testid="tab-proximas">
              Próximas ({totalInscricoesProximas})
            </TabsTrigger>
            <TabsTrigger value="concluidas" data-testid="tab-concluidas">
              Concluídas ({totalInscricoesConcluidas})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="todas" className="space-y-6">
            {pedidosTodasPaginados.map((pedido) => (
              <PedidoCard key={pedido.id} pedido={pedido} />
            ))}
            {pedidosFiltrados.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center">
                  <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Nenhuma inscrição encontrada</h3>
                  <p className="text-muted-foreground mb-4">
                    {searchTerm ? "Tente buscar por outro termo." : "Você ainda não possui inscrições."}
                  </p>
                  {!searchTerm && (
                    <Link href="/">
                      <Button>Explorar Eventos</Button>
                    </Link>
                  )}
                </CardContent>
              </Card>
            )}
            {pedidosFiltrados.length > ITEMS_PER_PAGE && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPageTodas(prev => Math.max(1, prev - 1))}
                  disabled={currentPageTodas === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground">
                  Página {currentPageTodas} de {totalPagesTodas}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPageTodas(prev => Math.min(totalPagesTodas, prev + 1))}
                  disabled={currentPageTodas === totalPagesTodas}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="proximas" className="space-y-6">
            {pedidosProximosPaginados.map((pedido) => (
              <PedidoCard key={pedido.id} pedido={pedido} />
            ))}
            {pedidosProximos.length === 0 && (
              <div className="text-center py-12">
                <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  {searchTerm ? "Nenhuma inscrição encontrada para sua busca" : "Você não possui inscrições em eventos próximos"}
                </p>
                {!searchTerm && (
                  <Link href="/">
                    <Button className="mt-4" data-testid="button-ver-eventos">
                      Ver Eventos Disponíveis
                    </Button>
                  </Link>
                )}
              </div>
            )}
            {totalPagesProximas > 1 && (
              <div className="flex items-center justify-center gap-2 pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPageProximas(p => Math.max(1, p - 1))}
                  disabled={currentPageProximas === 1}
                  data-testid="button-prev-page-proximas"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground px-2">
                  Página {currentPageProximas} de {totalPagesProximas}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPageProximas(p => Math.min(totalPagesProximas, p + 1))}
                  disabled={currentPageProximas === totalPagesProximas}
                  data-testid="button-next-page-proximas"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="concluidas" className="space-y-6">
            {pedidosConcluidosPaginados.map((pedido) => (
              <PedidoCard key={pedido.id} pedido={pedido} />
            ))}
            {pedidosConcluidos.length === 0 && (
              <div className="text-center py-12">
                <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  {searchTerm ? "Nenhuma inscrição encontrada para sua busca" : "Você ainda não participou de nenhum evento"}
                </p>
              </div>
            )}
            {totalPagesConcluidas > 1 && (
              <div className="flex items-center justify-center gap-2 pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPageConcluidas(p => Math.max(1, p - 1))}
                  disabled={currentPageConcluidas === 1}
                  data-testid="button-prev-page-concluidas"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground px-2">
                  Página {currentPageConcluidas} de {totalPagesConcluidas}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPageConcluidas(p => Math.min(totalPagesConcluidas, p + 1))}
                  disabled={currentPageConcluidas === totalPagesConcluidas}
                  data-testid="button-next-page-concluidas"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
      <Footer />
    </div>
  );
}
