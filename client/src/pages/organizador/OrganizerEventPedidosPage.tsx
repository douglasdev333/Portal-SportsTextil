import { useState, useMemo } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { OrganizerLayout } from "@/components/organizador/OrganizerLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import * as XLSX from "xlsx";
import { 
  Download,
  ArrowLeft,
  ShoppingCart,
  Check,
  X,
  Clock,
  AlertCircle,
  Search,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { formatDateOnlyBrazil } from "@/lib/timezone";
import { useOrganizerAuth } from "@/contexts/OrganizerAuthContext";

interface EnrichedOrder {
  id: string;
  numeroPedido: number;
  nomeEvento: string;
  nomeComprador: string;
  emailComprador: string;
  cpfComprador: string | null;
  status: string;
  dataPedido: string;
  dataPagamento: string | null;
  subtotal: number;
  valorDesconto: number;
  codigoCupom: string | null;
  codigoVoucher: string | null;
  taxaComodidade: number;
  valorTotal: number;
  valorLiquido: number;
  metodoPagamento: string | null;
  idPagamentoGateway: string | null;
  qtdInscricoes: number;
}

interface OrderTotals {
  totalBruto: number;
  totalDescontos: number;
  totalTaxaComodidade: number;
  totalLiquido: number;
}

interface Event {
  id: string;
  nome: string;
  slug: string;
  organizerId: string;
}

const statusLabels: Record<string, string> = {
  pendente: "Pendente",
  pago: "Pago",
  cancelado: "Cancelado",
  expirado: "Expirado",
};

const metodoPagamentoLabels: Record<string, string> = {
  pix: "PIX",
  credit_card: "CC",
  boleto: "Boleto",
  cortesia: "Cortesia",
  free: "Cortesia",
};

function formatCPF(cpf: string | null): string {
  if (!cpf) return "-";
  const cleaned = cpf.replace(/\D/g, "");
  if (cleaned.length !== 11) return cpf;
  return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function formatCurrency(value: number): string {
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof Check; className?: string }> = {
    pago: { variant: "default", icon: Check },
    pendente: { variant: "secondary", icon: Clock, className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
    cancelado: { variant: "destructive", icon: X },
    expirado: { variant: "destructive", icon: AlertCircle },
  };
  
  const { variant, icon: Icon, className } = config[status] || config.pendente;
  
  return (
    <Badge variant={variant} className={className}>
      <Icon className="h-3 w-3 mr-1" />
      {statusLabels[status] || status}
    </Badge>
  );
}

const ITEMS_PER_PAGE = 20;

export default function OrganizerEventPedidosPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useOrganizerAuth();
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportFilter, setExportFilter] = useState("todos");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [currentPage, setCurrentPage] = useState(1);

  const { data: eventsData, isLoading: eventsLoading } = useQuery<{ success: boolean; data: Event[] }>({
    queryKey: ["/api/admin/events"],
  });

  const { data: ordersData, isLoading: ordersLoading } = useQuery<{ 
    success: boolean; 
    data: { orders: EnrichedOrder[]; totais: OrderTotals } 
  }>({
    queryKey: ["/api/admin/events", id, "orders"],
  });

  const event = eventsData?.data?.find(e => e.id === id);
  const orders = ordersData?.data?.orders || [];
  const totais = ordersData?.data?.totais;

  // Filtrar pedidos com base na pesquisa e status
  const filteredOrders = useMemo(() => {
    let result = orders;

    // Filtrar por status
    if (statusFilter !== "todos") {
      if (statusFilter === "cancelados") {
        result = result.filter(o => o.status === "cancelado" || o.status === "expirado");
      } else {
        result = result.filter(o => o.status === statusFilter);
      }
    }

    // Filtrar por pesquisa
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(o => 
        o.numeroPedido.toString().includes(query) ||
        o.nomeComprador.toLowerCase().includes(query) ||
        o.emailComprador.toLowerCase().includes(query) ||
        (o.idPagamentoGateway && o.idPagamentoGateway.toLowerCase().includes(query)) ||
        (o.cpfComprador && o.cpfComprador.includes(query))
      );
    }

    return result;
  }, [orders, statusFilter, searchQuery]);

  // Paginação
  const totalPages = Math.ceil(filteredOrders.length / ITEMS_PER_PAGE);
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredOrders.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredOrders, currentPage]);

  // Reset para página 1 quando filtros mudam
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  const getExportData = (filter: string) => {
    let dataToExport = orders;
    
    if (filter === "pagos") {
      dataToExport = orders.filter(o => o.status === "pago");
    } else if (filter === "pendentes") {
      dataToExport = orders.filter(o => o.status === "pendente");
    } else if (filter === "cancelados") {
      dataToExport = orders.filter(o => o.status === "cancelado" || o.status === "expirado");
    }

    const headers = [
      "Nº Pedido",
      "Nome do Evento",
      "Nome do Comprador",
      "Email do Comprador",
      "CPF",
      "Status",
      "Data do Pedido",
      "Data do Pagamento",
      "Hora do Pagamento",
      "Valor Bruto",
      "Desconto",
      "Código Cupom/Voucher",
      "Valor Líquido (Organizador)",
      "Taxa de Comodidade",
      "Total Pago (Cliente)",
      "Forma de Pagamento",
      "Qtd. Inscrições",
    ];

    const rows = dataToExport.map((order) => {
      const dataPagamento = order.dataPagamento ? new Date(order.dataPagamento) : null;
      const valorBruto = order.subtotal;
      const valorLiquido = valorBruto - order.valorDesconto - order.taxaComodidade;
      const totalPago = valorBruto - order.valorDesconto + order.taxaComodidade;
      const isGratuito = totalPago === 0;
      const formaPagamento = isGratuito ? "Cortesia" : (metodoPagamentoLabels[order.metodoPagamento || ""] || order.metodoPagamento || "-");
      
      return [
        order.numeroPedido,
        order.nomeEvento,
        order.nomeComprador,
        order.emailComprador,
        formatCPF(order.cpfComprador),
        statusLabels[order.status] || order.status,
        formatDateOnlyBrazil(order.dataPedido),
        dataPagamento ? formatDateOnlyBrazil(order.dataPagamento!) : "-",
        dataPagamento ? dataPagamento.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "-",
        valorBruto,
        order.valorDesconto,
        order.codigoCupom || order.codigoVoucher || "-",
        valorLiquido,
        order.taxaComodidade,
        totalPago,
        formaPagamento,
        order.qtdInscricoes,
      ];
    });

    // Calcular totais apenas de pedidos pagos
    const paidOrders = dataToExport.filter(o => o.status === "pago");
    const totalBruto = paidOrders.reduce((sum, o) => sum + o.subtotal, 0);
    const totalDescontos = paidOrders.reduce((sum, o) => sum + o.valorDesconto, 0);
    const totalTaxa = paidOrders.reduce((sum, o) => sum + o.taxaComodidade, 0);
    const totalLiquido = totalBruto - totalDescontos - totalTaxa;
    const totalPagoGeral = totalBruto - totalDescontos + totalTaxa;

    // Linha de totais
    const totalsRow = [
      "TOTAIS (Pagos)",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      totalBruto,
      totalDescontos,
      "",
      totalLiquido,
      totalTaxa,
      totalPagoGeral,
      "",
      "",
    ];

    return { headers, rows: [...rows, totalsRow] };
  };

  const exportToExcel = () => {
    const { headers, rows } = getExportData(exportFilter);
    const wsData = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    const colWidths = headers.map((_, i) => {
      const maxLen = Math.max(
        headers[i].length,
        ...rows.map(row => String(row[i]).length)
      );
      return { wch: Math.min(maxLen + 2, 40) };
    });
    ws['!cols'] = colWidths;

    // Formatar colunas monetárias como números (índices: 9=Valor Bruto, 10=Desconto, 12=Taxa, 13=Líquido, 14=Total Pago)
    const moneyColumns = [9, 10, 12, 13, 14];
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let row = 1; row <= range.e.r; row++) {
      for (const col of moneyColumns) {
        const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
        if (ws[cellRef] && typeof ws[cellRef].v === 'number') {
          ws[cellRef].t = 'n';
          ws[cellRef].z = '#,##0.00';
        }
      }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pedidos");
    
    const filterSuffix = exportFilter !== "todos" ? `_${exportFilter}` : "";
    XLSX.writeFile(wb, `pedidos_${event?.slug || id}${filterSuffix}_${new Date().toISOString().split("T")[0]}.xlsx`);
    
    setExportModalOpen(false);
  };

  const isLoading = eventsLoading || ordersLoading;

  if (isLoading) {
    return (
      <OrganizerLayout title="Carregando...">
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      </OrganizerLayout>
    );
  }

  if (!event || event.organizerId !== user?.organizerId) {
    return (
      <OrganizerLayout title="Evento não encontrado">
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground" />
              <h3 className="text-lg font-medium">Evento não encontrado</h3>
              <p className="text-muted-foreground">
                Este evento não existe ou você não tem permissão para visualizá-lo.
              </p>
              <Link href="/organizadores">
                <Button>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar para Meus Eventos
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </OrganizerLayout>
    );
  }

  const paidOrders = orders.filter(o => o.status === "pago");
  const pendingOrders = orders.filter(o => o.status === "pendente");
  const cancelledOrders = orders.filter(o => o.status === "cancelado" || o.status === "expirado");

  return (
    <OrganizerLayout title={`Relatório de Pedidos - ${event.nome}`}>
      <div className="space-y-6">
        <div>
          <Link href={`/organizadores/evento/${id}`}>
            <Button variant="ghost" size="sm" className="mb-2">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Voltar ao Dashboard
            </Button>
          </Link>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl md:text-2xl font-bold tracking-tight">Relatório de Pedidos</h1>
              <p className="text-sm text-muted-foreground truncate">{event.nome}</p>
            </div>
            <Button onClick={() => setExportModalOpen(true)} size="sm" className="shrink-0">
              <Download className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Exportar Excel</span>
              <span className="sm:hidden">Excel</span>
            </Button>
          </div>
        </div>

        {/* Resumo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total de Pedidos</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{orders.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pagos</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">{paidOrders.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pendentes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-yellow-600">{pendingOrders.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Cancelados</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-red-600">{cancelledOrders.length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Totais financeiros */}
        {totais && (
          <Card>
            <CardHeader>
              <CardTitle>Resumo Financeiro (Pedidos Pagos)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Valor Bruto</p>
                  <p className="text-xl font-bold">{formatCurrency(totais.totalBruto)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">(-) Descontos</p>
                  <p className="text-xl font-bold text-red-600">-{formatCurrency(totais.totalDescontos)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">(-) Taxa de Comodidade</p>
                  <p className="text-xl font-bold text-orange-600">-{formatCurrency(totais.totalTaxaComodidade)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Valor Líquido (Organizador)</p>
                  <p className="text-xl font-bold text-green-600">{formatCurrency(totais.totalLiquido)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabela de pedidos */}
        <Card>
          <CardHeader>
            <CardTitle>Lista de Pedidos</CardTitle>
            <CardDescription>
              {filteredOrders.length === orders.length 
                ? `${orders.length} pedidos encontrados`
                : `${filteredOrders.length} de ${orders.length} pedidos`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filtros e Pesquisa */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Pesquisar por nº pedido, nome, email, CPF ou ID transação..."
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Filtrar por status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os status</SelectItem>
                  <SelectItem value="pago">Pagos</SelectItem>
                  <SelectItem value="pendente">Pendentes</SelectItem>
                  <SelectItem value="cancelados">Cancelados/Expirados</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tabela */}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nº Pedido</TableHead>
                    <TableHead>Comprador</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Total Pago</TableHead>
                    <TableHead>Pagamento</TableHead>
                    <TableHead className="text-center">Inscrições</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Nenhum pedido encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedOrders.map((order) => {
                      const valorBruto = order.subtotal;
                      const totalPago = valorBruto - order.valorDesconto + order.taxaComodidade;
                      const isGratuito = totalPago === 0;
                      const formaPagamento = isGratuito ? "Cortesia" : (metodoPagamentoLabels[order.metodoPagamento || ""] || "-");
                      return (
                        <TableRow key={order.id}>
                          <TableCell className="font-mono font-bold">#{order.numeroPedido}</TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{order.nomeComprador}</p>
                              <p className="text-sm text-muted-foreground">{order.emailComprador}</p>
                            </div>
                          </TableCell>
                          <TableCell><StatusBadge status={order.status} /></TableCell>
                          <TableCell>{formatDateOnlyBrazil(order.dataPedido)}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(totalPago)}</TableCell>
                          <TableCell>{formaPagamento}</TableCell>
                          <TableCell className="text-center">{order.qtdInscricoes}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Paginação */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pt-4 border-t gap-3">
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {((currentPage - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredOrders.length)} de {filteredOrders.length} pedidos
                </p>
                <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span className="hidden sm:inline ml-1">Anterior</span>
                  </Button>
                  <span className="text-xs sm:text-sm px-1">
                    {currentPage}/{totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <span className="hidden sm:inline mr-1">Próxima</span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal de exportação */}
      <Dialog open={exportModalOpen} onOpenChange={setExportModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Exportar Relatório de Pedidos</DialogTitle>
            <DialogDescription>
              Selecione quais pedidos deseja exportar
            </DialogDescription>
          </DialogHeader>
          <RadioGroup value={exportFilter} onValueChange={setExportFilter} className="space-y-2">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="todos" id="todos" />
              <Label htmlFor="todos">Todos os pedidos ({orders.length})</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="pagos" id="pagos" />
              <Label htmlFor="pagos">Apenas pagos ({paidOrders.length})</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="pendentes" id="pendentes" />
              <Label htmlFor="pendentes">Apenas pendentes ({pendingOrders.length})</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="cancelados" id="cancelados" />
              <Label htmlFor="cancelados">Apenas cancelados/expirados ({cancelledOrders.length})</Label>
            </div>
          </RadioGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportModalOpen(false)}>Cancelar</Button>
            <Button onClick={exportToExcel}>
              <Download className="h-4 w-4 mr-2" />
              Exportar Excel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </OrganizerLayout>
  );
}
