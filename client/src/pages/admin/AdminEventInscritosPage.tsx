import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { 
  Search, 
  Download,
  ArrowLeft,
  Settings,
  Check,
  X,
  Clock,
  User,
  CreditCard,
  Calendar,
  Shirt,
  Hash,
  Phone,
  Mail,
  Layers,
  History,
  ShoppingCart,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { formatDateOnlyBrazil, formatDateTimeBrazil } from "@/lib/timezone";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Event, Modality } from "@shared/schema";

interface EnrichedRegistration {
  id: string;
  numeroInscricao: number;
  athleteId: string;
  modalityId: string;
  modalityName: string;
  athleteName: string;
  athleteEmail: string;
  athletePhone: string;
  nomeCompleto: string | null;
  cpf: string | null;
  dataNascimento: string | null;
  sexo: string | null;
  tamanhoCamisa: string | null;
  valorUnitario: string;
  taxaComodidade: string;
  status: string;
  equipe: string | null;
  dataInscricao: string;
  batchName: string;
  orderStatus: string;
  metodoPagamento: string | null;
  dataPagamento: string | null;
  valorTotal: string;
  valorDesconto: string;
  codigoCupom: string | null;
  codigoVoucher: string | null;
  orderId: string;
  numeroPedido: number | null;
  orderRegistrationsCount: number;
  dadosElegibilidade: Record<string, any> | null;
}

interface StatusChangeLog {
  id: string;
  entity_type: string;
  entity_id: string;
  old_status: string | null;
  new_status: string;
  reason: string;
  changed_by_type: string;
  changed_by_id: string | null;
  metadata: string | null;
  created_at: string;
}

const statusLabels: Record<string, string> = {
  pendente: "Pendente",
  confirmada: "Confirmada",
  cancelada: "Cancelada",
};

const orderStatusLabels: Record<string, string> = {
  pendente: "Pendente",
  pago: "Pago",
  cancelado: "Cancelado",
  expirado: "Expirado",
};

const metodoPagamentoLabels: Record<string, string> = {
  pix: "PIX",
  credit_card: "Cartão de Crédito",
  boleto: "Boleto",
  cortesia: "Cortesia",
};

function formatCPF(cpf: string | null): string {
  if (!cpf) return "-";
  const cleaned = cpf.replace(/\D/g, "");
  if (cleaned.length !== 11) return cpf;
  return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "confirmada":
      return (
        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-green-100 dark:bg-green-900" title="Confirmada">
          <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
        </div>
      );
    case "cancelada":
      return (
        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-red-100 dark:bg-red-900" title="Cancelada">
          <X className="h-4 w-4 text-red-600 dark:text-red-400" />
        </div>
      );
    case "pendente":
      return (
        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-yellow-100 dark:bg-yellow-900" title="Pendente">
          <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
        </div>
      );
    default:
      return <span>{status}</span>;
  }
}

function formatCurrency(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") {
    return "R$ 0,00";
  }
  let num: number;
  if (typeof value === "string") {
    const normalized = value.replace(",", ".");
    num = parseFloat(normalized);
  } else {
    num = value;
  }
  if (isNaN(num)) {
    return "R$ 0,00";
  }
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(num);
}

const ITEMS_PER_PAGE_OPTIONS = [10, 20, 50, 100];

export default function AdminEventInscritosPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [modalityFilter, setModalityFilter] = useState<string>("todos");
  const [selectedRegistration, setSelectedRegistration] = useState<EnrichedRegistration | null>(null);
  const [sortColumn, setSortColumn] = useState<"numero" | "nome" | "status" | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  
  // Status change states
  const [newRegistrationStatus, setNewRegistrationStatus] = useState<string>("");
  const [newOrderStatus, setNewOrderStatus] = useState<string>("");
  const [statusChangeReason, setStatusChangeReason] = useState<string>("");
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [statusChangeType, setStatusChangeType] = useState<"registration" | "order" | null>(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<"csv" | "excel" | "pdf">("csv");

  const { data: eventData, isLoading: eventLoading } = useQuery<{ success: boolean; data: Event }>({
    queryKey: ["/api/admin/events", id],
  });

  const { data: modalitiesData } = useQuery<{ success: boolean; data: Modality[] }>({
    queryKey: ["/api/admin/events", id, "modalities"],
  });

  const { data: registrationsData, isLoading: registrationsLoading } = useQuery<{ success: boolean; data: EnrichedRegistration[] }>({
    queryKey: ["/api/admin/events", id, "registrations"],
  });
  
  // Fetch status history when a registration is selected
  const { data: registrationHistoryData, isLoading: registrationHistoryLoading } = useQuery<{ success: boolean; data: StatusChangeLog[] }>({
    queryKey: ["/api/admin/events/status-history/registration", selectedRegistration?.id],
    enabled: !!selectedRegistration?.id,
  });
  
  const { data: orderHistoryData, isLoading: orderHistoryLoading } = useQuery<{ success: boolean; data: StatusChangeLog[] }>({
    queryKey: ["/api/admin/events/status-history/order", selectedRegistration?.orderId],
    enabled: !!selectedRegistration?.orderId,
  });
  
  const registrationHistory = registrationHistoryData?.data || [];
  const orderHistory = orderHistoryData?.data || [];
  
  const resetStatusChangeState = () => {
    setNewRegistrationStatus("");
    setNewOrderStatus("");
    setStatusChangeReason("");
    setStatusChangeType(null);
  };
  
  // Mutations for status changes
  const updateRegistrationStatusMutation = useMutation({
    mutationFn: async ({ registrationId, status, reason }: { registrationId: string; status: string; reason: string }) => {
      return await apiRequest("PATCH", `/api/admin/events/${id}/registrations/${registrationId}/status`, { status, reason });
    },
    onSuccess: (_, variables) => {
      toast({ title: "Status da inscrição atualizado com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/events", id, "registrations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/events/status-history/registration", selectedRegistration?.id] });
      setConfirmDialogOpen(false);
      if (selectedRegistration) {
        setSelectedRegistration({ ...selectedRegistration, status: variables.status });
      }
      resetStatusChangeState();
    },
    onError: (error: any) => {
      toast({ title: "Erro ao atualizar status", description: error.message, variant: "destructive" });
    }
  });
  
  const updateOrderStatusMutation = useMutation({
    mutationFn: async ({ orderId, status, reason }: { orderId: string; status: string; reason: string }) => {
      return await apiRequest("PATCH", `/api/admin/events/${id}/orders/${orderId}/status`, { status, reason });
    },
    onSuccess: (_, variables) => {
      toast({ title: "Status do pedido atualizado com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/events", id, "registrations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/events/status-history/order", selectedRegistration?.orderId] });
      setConfirmDialogOpen(false);
      if (selectedRegistration) {
        setSelectedRegistration({ ...selectedRegistration, orderStatus: variables.status });
      }
      resetStatusChangeState();
    },
    onError: (error: any) => {
      toast({ title: "Erro ao atualizar status", description: error.message, variant: "destructive" });
    }
  });
  
  const handleStatusChangeClick = (type: "registration" | "order", newStatus: string) => {
    if (type === "registration") {
      setNewRegistrationStatus(newStatus);
    } else {
      setNewOrderStatus(newStatus);
    }
    setStatusChangeType(type);
    setConfirmDialogOpen(true);
  };
  
  const handleConfirmStatusChange = () => {
    if (!selectedRegistration || !statusChangeReason.trim()) {
      toast({ title: "Por favor, informe o motivo da alteração", variant: "destructive" });
      return;
    }
    
    if (statusChangeType === "registration") {
      updateRegistrationStatusMutation.mutate({
        registrationId: selectedRegistration.id,
        status: newRegistrationStatus,
        reason: statusChangeReason
      });
    } else if (statusChangeType === "order") {
      updateOrderStatusMutation.mutate({
        orderId: selectedRegistration.orderId,
        status: newOrderStatus,
        reason: statusChangeReason
      });
    }
  };

  const event = eventData?.data;
  const modalities = modalitiesData?.data || [];
  const registrations = registrationsData?.data || [];

  const isLoading = eventLoading || registrationsLoading;

  const filteredRegistrations = registrations.filter((reg) => {
    const matchesSearch = 
      reg.athleteName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      reg.nomeCompleto?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      reg.cpf?.includes(searchTerm) ||
      reg.numeroInscricao.toString().includes(searchTerm);
    const matchesStatus = statusFilter === "todos" || reg.status === statusFilter;
    const matchesModality = modalityFilter === "todos" || reg.modalityId === modalityFilter;
    return matchesSearch && matchesStatus && matchesModality;
  });

  const sortedRegistrations = [...filteredRegistrations].sort((a, b) => {
    if (!sortColumn) return 0;
    
    let comparison = 0;
    if (sortColumn === "numero") {
      comparison = a.numeroInscricao - b.numeroInscricao;
    } else if (sortColumn === "nome") {
      const nameA = (a.nomeCompleto || a.athleteName).toLowerCase();
      const nameB = (b.nomeCompleto || b.athleteName).toLowerCase();
      comparison = nameA.localeCompare(nameB, 'pt-BR');
    } else if (sortColumn === "status") {
      comparison = a.status.localeCompare(b.status, 'pt-BR');
    }
    
    return sortDirection === "desc" ? -comparison : comparison;
  });

  // Paginação
  const totalPages = Math.ceil(sortedRegistrations.length / itemsPerPage);
  const paginatedRegistrations = sortedRegistrations.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Reset página quando filtros mudam
  const handleFilterChange = (setter: React.Dispatch<React.SetStateAction<string>>, value: string) => {
    setter(value);
    setCurrentPage(1);
  };

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(Number(value));
    setCurrentPage(1);
  };

  const handleSort = (column: "numero" | "nome" | "status") => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  const getSortIcon = (column: "numero" | "nome" | "status") => {
    if (sortColumn !== column) return <ArrowUpDown className="h-4 w-4 ml-1" />;
    return sortDirection === "desc" 
      ? <ArrowDown className="h-4 w-4 ml-1" /> 
      : <ArrowUp className="h-4 w-4 ml-1" />;
  };

  const getExportData = () => {
    const eligibilityKeys: string[] = [];
    const seenKeys = new Set<string>();
    filteredRegistrations.forEach((reg) => {
      if (reg.dadosElegibilidade && typeof reg.dadosElegibilidade === 'object') {
        Object.keys(reg.dadosElegibilidade).forEach((key) => {
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            eligibilityKeys.push(key);
          }
        });
      }
    });

    const headers = [
      "Nº Inscrição",
      "Nº Pedido",
      "Nome",
      "CPF",
      "Email",
      "Telefone",
      "Sexo",
      "Data Nascimento",
      "Modalidade",
      "Lote",
      "Tamanho Camisa",
      "Equipe",
      "Valor Bruto",
      "Desconto",
      "Código Cupom/Voucher",
      "Valor Líquido (Organizador)",
      "Taxa Comodidade",
      "Total Pago (Cliente)",
      "Forma Pagamento",
      "Status Inscrição",
      "Status Pedido",
      "Data Inscrição",
      "Data Pagamento",
      ...eligibilityKeys.map(k => `Elegibilidade: ${k}`),
    ];

    const rows = filteredRegistrations.map((reg) => {
      const valorUnitario = parseFloat(reg.valorUnitario);
      const taxaComodidade = parseFloat(reg.taxaComodidade);
      const valorDesconto = parseFloat(reg.valorDesconto) / (reg.orderRegistrationsCount || 1);
      const valorBruto = valorUnitario + taxaComodidade;
      const valorLiquido = valorUnitario - valorDesconto;
      const totalPago = valorUnitario - valorDesconto + taxaComodidade;
      const isGratuito = totalPago === 0;
      const formaPagamento = isGratuito ? "Cortesia" : (metodoPagamentoLabels[reg.metodoPagamento || ""] || reg.metodoPagamento || "");
      const codigoDesconto = reg.codigoCupom || reg.codigoVoucher || "";
      
      const eligibilityValues = eligibilityKeys.map(key => {
        const val = reg.dadosElegibilidade?.[key];
        return val != null ? String(val) : "";
      });

      return [
        reg.numeroInscricao,
        reg.numeroPedido || "",
        reg.nomeCompleto || reg.athleteName,
        reg.cpf || "",
        reg.athleteEmail,
        reg.athletePhone,
        reg.sexo === "masculino" ? "Masculino" : reg.sexo === "feminino" ? "Feminino" : "",
        reg.dataNascimento ? formatDateOnlyBrazil(reg.dataNascimento) : "",
        reg.modalityName,
        reg.batchName,
        reg.tamanhoCamisa || "",
        reg.equipe || "",
        valorBruto,
        valorDesconto,
        codigoDesconto,
        valorLiquido > 0 ? valorLiquido : 0,
        taxaComodidade,
        totalPago > 0 ? totalPago : 0,
        formaPagamento,
        statusLabels[reg.status] || reg.status,
        orderStatusLabels[reg.orderStatus] || reg.orderStatus,
        formatDateOnlyBrazil(reg.dataInscricao),
        reg.dataPagamento ? formatDateTimeBrazil(reg.dataPagamento) : "",
        ...eligibilityValues,
      ];
    });

    // Calcular totais apenas de inscrições confirmadas
    const confirmedRegs = filteredRegistrations.filter(r => r.status === "confirmada");
    const totalValorUnitario = confirmedRegs.reduce((sum, r) => sum + parseFloat(r.valorUnitario), 0);
    const totalTaxa = confirmedRegs.reduce((sum, r) => sum + parseFloat(r.taxaComodidade), 0);
    const totalDesconto = confirmedRegs.reduce((sum, r) => sum + (parseFloat(r.valorDesconto) / (r.orderRegistrationsCount || 1)), 0);
    // Valor bruto = valor unitário + taxa (total arrecadado)
    const totalBruto = totalValorUnitario + totalTaxa;
    // Valor líquido = valor unitário - descontos (valor para o organizador)
    const totalLiquido = totalValorUnitario - totalDesconto;
    const totalPago = totalValorUnitario - totalDesconto + totalTaxa;

    const totalsRow = [
      "TOTAIS (Confirmadas)",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      totalBruto,
      totalDesconto,
      "",
      totalLiquido,
      totalTaxa,
      totalPago,
      "",
      "",
      "",
      "",
      "",
      ...eligibilityKeys.map(() => ""),
    ];

    return { headers, rows: [...rows, totalsRow] };
  };

  const exportToCSV = () => {
    const { headers, rows } = getExportData();
    const csvContent = [
      headers.join(";"),
      ...rows.map((row) => row.map(cell => `"${cell}"`).join(";")),
    ].join("\n");

    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `inscritos_${event?.slug || id}_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportToExcel = () => {
    const { headers, rows } = getExportData();
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

    // Formatar colunas monetárias como números (índices: 12=Bruto, 13=Desconto, 15=Taxa, 16=Líquido, 17=Total Pago)
    const moneyColumns = [12, 13, 15, 16, 17];
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
    XLSX.utils.book_append_sheet(wb, ws, "Inscritos");
    XLSX.writeFile(wb, `inscritos_${event?.slug || id}_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const exportToPDF = () => {
    const { headers, rows } = getExportData();
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    
    doc.setFontSize(16);
    doc.text(`Inscritos - ${event?.nome || "Evento"}`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Exportado em: ${new Date().toLocaleDateString("pt-BR")}`, 14, 22);
    doc.text(`Total de inscritos: ${filteredRegistrations.length}`, 14, 28);

    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: 35,
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      columnStyles: {
        0: { cellWidth: 12 },
        1: { cellWidth: 30 },
        2: { cellWidth: 25 },
        3: { cellWidth: 35 },
        4: { cellWidth: 22 },
        5: { cellWidth: 10 },
        6: { cellWidth: 18 },
        7: { cellWidth: 25 },
        8: { cellWidth: 15 },
        9: { cellWidth: 20 },
        10: { cellWidth: 15 },
        11: { cellWidth: 12 },
        12: { cellWidth: 18 },
        13: { cellWidth: 18 },
      },
    });

    doc.save(`inscritos_${event?.slug || id}_${new Date().toISOString().split("T")[0]}.pdf`);
  };

  const handleExport = () => {
    switch (exportFormat) {
      case "csv":
        exportToCSV();
        break;
      case "excel":
        exportToExcel();
        break;
      case "pdf":
        exportToPDF();
        break;
    }
    setExportModalOpen(false);
    toast({
      title: "Exportacao concluida",
      description: `Arquivo ${exportFormat.toUpperCase()} gerado com sucesso.`,
    });
  };

  if (isLoading) {
    return (
      <AdminLayout
        title="Carregando..."
        breadcrumbs={[
          { label: "Eventos", href: "/admin/eventos" },
          { label: "Inscritos" },
        ]}
      >
        <div className="space-y-6">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-64" />
        </div>
      </AdminLayout>
    );
  }

  if (!event) {
    return (
      <AdminLayout
        title="Evento não encontrado"
        breadcrumbs={[
          { label: "Eventos", href: "/admin/eventos" },
          { label: "Não encontrado" },
        ]}
      >
        <div className="text-center py-12">
          <p className="text-muted-foreground">O evento solicitado não foi encontrado.</p>
          <Link href="/admin/eventos">
            <Button className="mt-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar para Eventos
            </Button>
          </Link>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title={`Inscritos: ${event.nome}`}
      breadcrumbs={[
        { label: "Eventos", href: "/admin/eventos" },
        { label: event.nome, href: `/admin/eventos/${id}` },
        { label: "Inscritos" },
      ]}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Inscritos</h1>
            <p className="text-muted-foreground">
              {filteredRegistrations.length} inscricoes encontradas
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button 
              variant="outline" 
              onClick={() => setExportModalOpen(true)}
              disabled={filteredRegistrations.length === 0}
              data-testid="button-export"
            >
              <Download className="mr-2 h-4 w-4" />
              Exportar
            </Button>
            <Link href={`/admin/eventos/${id}/pedidos`}>
              <Button variant="outline" data-testid="button-orders">
                <ShoppingCart className="mr-2 h-4 w-4" />
                Ver Pedidos
              </Button>
            </Link>
            <Link href={`/admin/eventos/${id}/gerenciar`}>
              <Button variant="outline" data-testid="button-manage-event">
                <Settings className="mr-2 h-4 w-4" />
                Gerenciar Evento
              </Button>
            </Link>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, CPF ou número..."
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                  className="pl-9"
                  data-testid="input-search-inscritos"
                />
              </div>
              <Select value={modalityFilter} onValueChange={(v) => handleFilterChange(setModalityFilter, v)}>
                <SelectTrigger className="w-[180px]" data-testid="select-modality-filter">
                  <SelectValue placeholder="Modalidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas modalidades</SelectItem>
                  {modalities.map((mod) => (
                    <SelectItem key={mod.id} value={mod.id}>
                      {mod.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={(v) => handleFilterChange(setStatusFilter, v)}>
                <SelectTrigger className="w-[150px]" data-testid="select-status-filter">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos status</SelectItem>
                  <SelectItem value="confirmada">Confirmada</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
              <Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ITEMS_PER_PAGE_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option.toString()}>
                      {option} por página
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {filteredRegistrations.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">
                {registrations.length === 0 
                  ? "Nenhuma inscrição cadastrada" 
                  : "Nenhuma inscrição encontrada com os filtros aplicados"}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <button 
                          onClick={() => handleSort("numero")}
                          className="flex items-center hover:text-foreground transition-colors"
                        >
                          Numero
                          {getSortIcon("numero")}
                        </button>
                      </TableHead>
                      <TableHead>
                        <button 
                          onClick={() => handleSort("nome")}
                          className="flex items-center hover:text-foreground transition-colors"
                        >
                          Nome
                          {getSortIcon("nome")}
                        </button>
                      </TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead>Nascimento</TableHead>
                      <TableHead>Modalidade</TableHead>
                      <TableHead>Sexo</TableHead>
                      <TableHead>Camisa</TableHead>
                      <TableHead className="text-center">
                        <button 
                          onClick={() => handleSort("status")}
                          className="flex items-center justify-center w-full hover:text-foreground transition-colors"
                        >
                          Status
                          {getSortIcon("status")}
                        </button>
                      </TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedRegistrations.map((reg) => (
                      <TableRow key={reg.id} data-testid={`row-inscrito-${reg.id}`}>
                        <TableCell className="font-medium">
                          #{reg.numeroInscricao}
                        </TableCell>
                        <TableCell>
                          <button
                            onClick={() => setSelectedRegistration(reg)}
                            className="text-left hover:underline focus:outline-none focus:underline"
                            data-testid={`button-view-inscrito-${reg.id}`}
                          >
                            <p className="font-medium text-[#1f2025]">{reg.nomeCompleto || reg.athleteName}</p>
                            <p className="text-xs text-muted-foreground">{reg.athleteEmail}</p>
                          </button>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {formatCPF(reg.cpf)}
                        </TableCell>
                        <TableCell>
                          {reg.dataNascimento ? formatDateOnlyBrazil(reg.dataNascimento) : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{reg.modalityName}</Badge>
                        </TableCell>
                        <TableCell className="capitalize">
                          {reg.sexo || "-"}
                        </TableCell>
                        <TableCell>{reg.tamanhoCamisa || "-"}</TableCell>
                        <TableCell className="text-center">
                          <StatusIcon status={reg.status} />
                        </TableCell>
                        <TableCell>
                          {formatDateOnlyBrazil(reg.dataInscricao)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Paginação */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t mt-4">
                <p className="text-sm text-muted-foreground">
                  Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, sortedRegistrations.length)} de {sortedRegistrations.length} inscrições
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Anterior
                  </Button>
                  <span className="text-sm px-2">
                    Página {currentPage} de {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Próxima
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selectedRegistration} onOpenChange={(open) => !open && setSelectedRegistration(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" data-testid="dialog-registration-details">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Detalhes da Inscricao
            </DialogTitle>
          </DialogHeader>
          
          {selectedRegistration && (
            <Tabs defaultValue="detalhes" className="flex-1 flex flex-col min-h-0">
              <TabsList className="grid w-full grid-cols-3" data-testid="tabs-list-registration">
                <TabsTrigger value="detalhes" data-testid="tab-detalhes">Detalhes</TabsTrigger>
                <TabsTrigger value="status" data-testid="tab-status">Status</TabsTrigger>
                <TabsTrigger value="historico" data-testid="tab-historico">Histórico</TabsTrigger>
              </TabsList>
              
              <TabsContent value="detalhes" className="flex-1 overflow-auto">
                <div className="space-y-6 py-4">
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold">
                        {selectedRegistration.nomeCompleto || selectedRegistration.athleteName}
                      </h3>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Hash className="h-3 w-3" />
                        Inscricao #{selectedRegistration.numeroInscricao}
                      </p>
                    </div>
                    <StatusIcon status={selectedRegistration.status} />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">CPF</p>
                      <p className="font-mono">{formatCPF(selectedRegistration.cpf)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Data de Nascimento</p>
                      <p className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        {selectedRegistration.dataNascimento 
                          ? formatDateOnlyBrazil(selectedRegistration.dataNascimento) 
                          : "-"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Telefone</p>
                      <p className="flex items-center gap-1">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        {selectedRegistration.athletePhone || "-"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Email</p>
                      <p className="flex items-center gap-1 text-sm truncate">
                        <Mail className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        {selectedRegistration.athleteEmail || "-"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Sexo</p>
                      <p className="capitalize">{selectedRegistration.sexo || "-"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Camisa</p>
                      <p className="flex items-center gap-1">
                        <Shirt className="h-3 w-3 text-muted-foreground" />
                        {selectedRegistration.tamanhoCamisa || "-"}
                      </p>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Layers className="h-4 w-4" />
                      Informacoes da Inscricao
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Modalidade</p>
                        <Badge variant="outline">{selectedRegistration.modalityName}</Badge>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Lote</p>
                        <p className="flex items-center gap-1">
                          <Layers className="h-3 w-3 text-muted-foreground" />
                          {selectedRegistration.batchName}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Valor da Inscricao</p>
                        <p className="font-semibold">{formatCurrency(selectedRegistration.valorUnitario)}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Taxa de Servico</p>
                        <p>{formatCurrency(selectedRegistration.taxaComodidade)}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Data da Inscricao</p>
                        <p>{formatDateTimeBrazil(selectedRegistration.dataInscricao)}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Equipe</p>
                        <p>{selectedRegistration.equipe || "-"}</p>
                      </div>
                    </div>
                  </div>

                  {selectedRegistration.dadosElegibilidade && Object.keys(selectedRegistration.dadosElegibilidade).length > 0 && (
                    <div className="border-t pt-4">
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <Layers className="h-4 w-4" />
                        Dados de Elegibilidade
                      </h4>
                      <div className="grid grid-cols-2 gap-4">
                        {Object.entries(selectedRegistration.dadosElegibilidade).map(([key, value]) => (
                          <div key={key} className="space-y-1">
                            <p className="text-xs text-muted-foreground uppercase tracking-wide">{key}</p>
                            <p>{String(value)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <ShoppingCart className="h-4 w-4" />
                      Pedido
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Numero do Pedido</p>
                        <p className="font-mono font-semibold">#{selectedRegistration.numeroPedido || "-"}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Inscricoes no Pedido</p>
                        <p>{selectedRegistration.orderRegistrationsCount}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Status do Pedido</p>
                        <Badge 
                          variant={selectedRegistration.orderStatus === "pago" ? "default" : "secondary"}
                        >
                          {orderStatusLabels[selectedRegistration.orderStatus] || selectedRegistration.orderStatus}
                        </Badge>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Forma de Pagamento</p>
                        <p>
                          {selectedRegistration.metodoPagamento 
                            ? metodoPagamentoLabels[selectedRegistration.metodoPagamento] || selectedRegistration.metodoPagamento
                            : "-"}
                        </p>
                      </div>
                      {selectedRegistration.dataPagamento && (
                        <div className="space-y-1 col-span-2">
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">Data do Pagamento</p>
                          <p>{formatDateTimeBrazil(selectedRegistration.dataPagamento)}</p>
                        </div>
                      )}
                      {parseFloat(selectedRegistration.valorDesconto) > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">Desconto</p>
                          <p className="text-green-600">{formatCurrency(selectedRegistration.valorDesconto)}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="status" className="flex-1 overflow-auto" data-testid="tab-content-status">
                <div className="space-y-6 py-4">
                  <div className="space-y-4">
                    <h4 className="font-medium flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Status da Inscricao
                    </h4>
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <Label>Status atual</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <StatusIcon status={selectedRegistration.status} />
                          <span>{statusLabels[selectedRegistration.status] || selectedRegistration.status}</span>
                        </div>
                      </div>
                      <div className="flex-1">
                        <Label>Alterar para</Label>
                        <Select 
                          key={`reg-status-${selectedRegistration.id}-${selectedRegistration.status}`}
                          value={newRegistrationStatus}
                          onValueChange={(value) => handleStatusChangeClick("registration", value)}
                          disabled={confirmDialogOpen || updateRegistrationStatusMutation.isPending}
                        >
                          <SelectTrigger data-testid="select-registration-status">
                            <SelectValue placeholder="Selecionar status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pendente" disabled={selectedRegistration.status === "pendente"}>Pendente</SelectItem>
                            <SelectItem value="confirmada" disabled={selectedRegistration.status === "confirmada"}>Confirmada</SelectItem>
                            <SelectItem value="cancelada" disabled={selectedRegistration.status === "cancelada"}>Cancelada</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  
                  <div className="border-t pt-4 space-y-4">
                    <h4 className="font-medium flex items-center gap-2">
                      <ShoppingCart className="h-4 w-4" />
                      Status do Pedido #{selectedRegistration.numeroPedido}
                    </h4>
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <Label>Status atual</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant={selectedRegistration.orderStatus === "pago" ? "default" : "secondary"}>
                            {orderStatusLabels[selectedRegistration.orderStatus] || selectedRegistration.orderStatus}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex-1">
                        <Label>Alterar para</Label>
                        <Select 
                          key={`order-status-${selectedRegistration.orderId}-${selectedRegistration.orderStatus}`}
                          value={newOrderStatus}
                          onValueChange={(value) => handleStatusChangeClick("order", value)}
                          disabled={confirmDialogOpen || updateOrderStatusMutation.isPending}
                        >
                          <SelectTrigger data-testid="select-order-status">
                            <SelectValue placeholder="Selecionar status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pendente" disabled={selectedRegistration.orderStatus === "pendente"}>Pendente</SelectItem>
                            <SelectItem value="pago" disabled={selectedRegistration.orderStatus === "pago"}>Pago</SelectItem>
                            <SelectItem value="cancelado" disabled={selectedRegistration.orderStatus === "cancelado"}>Cancelado</SelectItem>
                            <SelectItem value="expirado" disabled={selectedRegistration.orderStatus === "expirado"}>Expirado</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Este pedido possui {selectedRegistration.orderRegistrationsCount} inscrição(ões). Alterar o status do pedido não altera automaticamente o status das inscrições.
                    </p>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="historico" className="flex-1 overflow-auto" data-testid="tab-content-historico">
                <div className="space-y-6 py-4">
                  <div className="space-y-3">
                    <h4 className="font-medium flex items-center gap-2">
                      <History className="h-4 w-4" />
                      Histórico da Inscrição
                    </h4>
                    {registrationHistoryLoading ? (
                      <p className="text-sm text-muted-foreground">Carregando histórico...</p>
                    ) : registrationHistory.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhum histórico disponível</p>
                    ) : (
                      <ScrollArea className="h-32">
                        <div className="space-y-2">
                          {registrationHistory.map((log) => (
                            <div key={log.id} className="text-sm border-l-2 border-primary pl-3 py-1" data-testid={`history-registration-${log.id}`}>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {log.old_status || "N/A"} → {log.new_status}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {formatDateTimeBrazil(log.created_at)}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">{log.reason}</p>
                              <p className="text-xs text-muted-foreground">Por: {log.changed_by_type}</p>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </div>
                  
                  <div className="border-t pt-4 space-y-3">
                    <h4 className="font-medium flex items-center gap-2">
                      <History className="h-4 w-4" />
                      Histórico do Pedido #{selectedRegistration.numeroPedido}
                    </h4>
                    {orderHistoryLoading ? (
                      <p className="text-sm text-muted-foreground">Carregando histórico...</p>
                    ) : orderHistory.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhum histórico disponível</p>
                    ) : (
                      <ScrollArea className="h-32">
                        <div className="space-y-2">
                          {orderHistory.map((log) => (
                            <div key={log.id} className="text-sm border-l-2 border-primary pl-3 py-1" data-testid={`history-order-${log.id}`}>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {log.old_status || "N/A"} → {log.new_status}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {formatDateTimeBrazil(log.created_at)}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">{log.reason}</p>
                              <p className="text-xs text-muted-foreground">Por: {log.changed_by_type}</p>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={confirmDialogOpen} onOpenChange={(open) => { if (!open) resetStatusChangeState(); setConfirmDialogOpen(open); }}>
        <AlertDialogContent data-testid="dialog-confirm-status-change">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar alteração de status</AlertDialogTitle>
            <AlertDialogDescription>
              {statusChangeType === "registration" 
                ? `Você está prestes a alterar o status da inscrição para "${statusLabels[newRegistrationStatus] || newRegistrationStatus}".`
                : `Você está prestes a alterar o status do pedido para "${orderStatusLabels[newOrderStatus] || newOrderStatus}".`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="reason">Motivo da alteração *</Label>
            <Textarea
              id="reason"
              placeholder="Informe o motivo da alteração..."
              value={statusChangeReason}
              onChange={(e) => setStatusChangeReason(e.target.value)}
              className="mt-2"
              data-testid="input-status-change-reason"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={resetStatusChangeState} data-testid="button-cancel-status-change">Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmStatusChange}
              disabled={!statusChangeReason.trim() || updateRegistrationStatusMutation.isPending || updateOrderStatusMutation.isPending}
              data-testid="button-confirm-status-change"
            >
              {(updateRegistrationStatusMutation.isPending || updateOrderStatusMutation.isPending) ? "Salvando..." : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={exportModalOpen} onOpenChange={setExportModalOpen}>
        <DialogContent className="sm:max-w-md" data-testid="modal-export">
          <DialogHeader>
            <DialogTitle>Exportar Inscritos</DialogTitle>
            <DialogDescription>
              Escolha o formato de exportacao desejado.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <RadioGroup value={exportFormat} onValueChange={(value) => setExportFormat(value as "csv" | "excel" | "pdf")}>
              <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer" data-testid="radio-csv">
                <RadioGroupItem value="csv" id="csv" />
                <Label htmlFor="csv" className="flex-1 cursor-pointer">
                  <div className="font-medium">CSV (separado por ponto e virgula)</div>
                  <div className="text-sm text-muted-foreground">Compativel com Excel, Google Sheets e outros</div>
                </Label>
              </div>
              <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer mt-2" data-testid="radio-excel">
                <RadioGroupItem value="excel" id="excel" />
                <Label htmlFor="excel" className="flex-1 cursor-pointer">
                  <div className="font-medium">Excel (.xlsx)</div>
                  <div className="text-sm text-muted-foreground">Planilha nativa do Microsoft Excel</div>
                </Label>
              </div>
              <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer mt-2" data-testid="radio-pdf">
                <RadioGroupItem value="pdf" id="pdf" />
                <Label htmlFor="pdf" className="flex-1 cursor-pointer">
                  <div className="font-medium">PDF (paisagem)</div>
                  <div className="text-sm text-muted-foreground">Documento em formato A4 paisagem para impressao</div>
                </Label>
              </div>
            </RadioGroup>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportModalOpen(false)} data-testid="button-cancel-export">
              Cancelar
            </Button>
            <Button onClick={handleExport} data-testid="button-confirm-export">
              <Download className="mr-2 h-4 w-4" />
              Exportar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
