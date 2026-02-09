import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Ticket, 
  Tag, 
  Plus, 
  ArrowLeft, 
  Copy, 
  Trash2, 
  CheckCircle,
  XCircle,
  Clock,
  Package,
  Percent,
  DollarSign,
  User,
  Calendar,
  FileText,
  Eye,
  Edit,
  Download,
  Search,
  Filter
} from "lucide-react";
import { formatDateTimeBrazil, formatForInput } from "@/lib/timezone";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Event } from "@shared/schema";

interface VoucherBatch {
  id: string;
  eventId: string;
  nome: string;
  quantidade: number;
  validFrom: string;
  validUntil: string;
  descricao?: string | null;
  createdAt: string;
}

interface Voucher {
  id: string;
  eventId: string;
  batchId?: string | null;
  code: string;
  status: "available" | "used" | "expired";
  validFrom: string;
  validUntil: string;
  createdAt: string;
  usage?: {
    usedAt: string;
    userId: string;
    registrationId?: string | null;
  } | null;
}

interface Coupon {
  id: string;
  eventId: string;
  code: string;
  discountType: "percentage" | "fixed" | "full";
  discountValue?: string | null;
  maxUses?: number | null;
  maxUsesPerUser: number;
  currentUses: number;
  validFrom: string;
  validUntil: string;
  isActive: boolean;
  createdAt: string;
}

interface VoucherReport {
  total: number;
  available: number;
  used: number;
  expired: number;
}

export default function AdminEventVouchersPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState("vouchers");
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [voucherDialogOpen, setVoucherDialogOpen] = useState(false);
  const [couponDialogOpen, setCouponDialogOpen] = useState(false);
  const [deleteVoucherDialog, setDeleteVoucherDialog] = useState<{ open: boolean; id: string; code: string } | null>(null);
  const [deleteCouponDialog, setDeleteCouponDialog] = useState<{ open: boolean; id: string; code: string } | null>(null);
  const [editCouponDialog, setEditCouponDialog] = useState<Coupon | null>(null);
  const [autoGenerateCouponCode, setAutoGenerateCouponCode] = useState(false);
  const [voucherDetailDialog, setVoucherDetailDialog] = useState<Voucher | null>(null);
  const [editBatchDialog, setEditBatchDialog] = useState<VoucherBatch | null>(null);
  const [voucherSearch, setVoucherSearch] = useState("");
  const [voucherStatusFilter, setVoucherStatusFilter] = useState<"all" | "available" | "used" | "expired">("all");
  const [bulkCouponDialogOpen, setBulkCouponDialogOpen] = useState(false);
  const [bulkCouponMode, setBulkCouponMode] = useState<"manual" | "auto">("auto");
  const [bulkCouponForm, setBulkCouponForm] = useState({
    codes: "",
    quantity: "10",
    discountType: "percentage" as "percentage" | "fixed" | "full",
    discountValue: "",
    maxUses: "",
    maxUsesPerUser: "1",
    validFrom: "",
    validUntil: "",
    isActive: true,
  });
  const [editBatchForm, setEditBatchForm] = useState({ validFrom: "", validUntil: "" });

  const [batchForm, setBatchForm] = useState({
    nome: "",
    quantidade: 10,
    validFrom: "",
    validUntil: "",
    descricao: ""
  });

  const [voucherForm, setVoucherForm] = useState({
    code: "",
    validFrom: "",
    validUntil: ""
  });

  const [couponForm, setCouponForm] = useState({
    code: "",
    discountType: "percentage" as "percentage" | "fixed" | "full",
    discountValue: "",
    maxUses: "",
    maxUsesPerUser: "1",
    validFrom: "",
    validUntil: "",
    isActive: true
  });

  const [editCouponForm, setEditCouponForm] = useState({
    code: "",
    discountType: "percentage" as "percentage" | "fixed" | "full",
    discountValue: "",
    maxUses: "",
    maxUsesPerUser: "1",
    validFrom: "",
    validUntil: "",
    isActive: true
  });

  const { data: eventData, isLoading: eventLoading } = useQuery<{ success: boolean; data: Event }>({
    queryKey: ["/api/admin/events", id],
  });

  const { data: batchesData, isLoading: batchesLoading } = useQuery<{ success: boolean; data: VoucherBatch[] }>({
    queryKey: ["/api/admin/events", id, "vouchers/batches"],
  });

  const { data: vouchersData, isLoading: vouchersLoading } = useQuery<{ success: boolean; data: Voucher[] }>({
    queryKey: ["/api/admin/events", id, "vouchers"],
  });

  const { data: reportData } = useQuery<{ success: boolean; data: VoucherReport }>({
    queryKey: ["/api/admin/events", id, "vouchers/report"],
  });

  const { data: couponsData, isLoading: couponsLoading } = useQuery<{ success: boolean; data: Coupon[] }>({
    queryKey: ["/api/admin/events", id, "coupons"],
  });

  const event = eventData?.data;
  const batches = batchesData?.data || [];
  const vouchers = vouchersData?.data || [];
  const report = reportData?.data;
  const coupons = couponsData?.data || [];

  const createBatchMutation = useMutation({
    mutationFn: async (data: typeof batchForm) => {
      const response = await apiRequest("POST", `/api/admin/events/${id}/vouchers/batches`, data);
      const result = await response.json();
      if (!result.success) throw new Error(result.error?.message || "Erro ao criar lote");
      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/events", id, "vouchers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/events", id, "vouchers/batches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/events", id, "vouchers/report"] });
      setBatchDialogOpen(false);
      setBatchForm({ nome: "", quantidade: 10, validFrom: "", validUntil: "", descricao: "" });
      toast({ title: `Lote criado com ${result.data?.vouchersCreated || 0} vouchers` });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao criar lote", description: error.message, variant: "destructive" });
    }
  });

  const createVoucherMutation = useMutation({
    mutationFn: async (data: typeof voucherForm) => {
      const response = await apiRequest("POST", `/api/admin/events/${id}/vouchers`, data);
      const result = await response.json();
      if (!result.success) throw new Error(result.error?.message || "Erro ao criar voucher");
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/events", id, "vouchers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/events", id, "vouchers/report"] });
      setVoucherDialogOpen(false);
      setVoucherForm({ code: "", validFrom: "", validUntil: "" });
      toast({ title: "Voucher criado com sucesso" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao criar voucher", description: error.message, variant: "destructive" });
    }
  });

  const deleteVoucherMutation = useMutation({
    mutationFn: async (voucherId: string) => {
      const response = await apiRequest("DELETE", `/api/admin/events/${id}/vouchers/${voucherId}`);
      const result = await response.json();
      if (!result.success) throw new Error(result.error?.message || "Erro ao excluir voucher");
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/events", id, "vouchers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/events", id, "vouchers/report"] });
      setDeleteVoucherDialog(null);
      toast({ title: "Voucher excluido com sucesso" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao excluir voucher", description: error.message, variant: "destructive" });
    }
  });

  const createCouponMutation = useMutation({
    mutationFn: async (data: typeof couponForm) => {
      const payload = {
        code: data.code,
        discountType: data.discountType,
        discountValue: data.discountType === "full" ? null : parseFloat(data.discountValue) || 0,
        maxUses: data.maxUses ? parseInt(data.maxUses) : null,
        maxUsesPerUser: parseInt(data.maxUsesPerUser) || 1,
        validFrom: data.validFrom,
        validUntil: data.validUntil,
        isActive: data.isActive
      };
      const response = await apiRequest("POST", `/api/admin/events/${id}/coupons`, payload);
      const result = await response.json();
      if (!result.success) throw new Error(result.error?.message || "Erro ao criar cupom");
      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/events", id, "coupons"] });
      setCouponDialogOpen(false);
      setAutoGenerateCouponCode(false);
      const createdCode = result.data?.code;
      setCouponForm({ code: "", discountType: "percentage", discountValue: "", maxUses: "", maxUsesPerUser: "1", validFrom: "", validUntil: "", isActive: true });
      toast({ 
        title: "Cupom criado com sucesso",
        description: createdCode ? `Codigo: ${createdCode}` : undefined
      });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao criar cupom", description: error.message, variant: "destructive" });
    }
  });

  const updateCouponMutation = useMutation({
    mutationFn: async ({ couponId, data }: { couponId: string; data: typeof editCouponForm }) => {
      const payload: Record<string, unknown> = {
        isActive: data.isActive,
        code: data.code || undefined,
        discountType: data.discountType || undefined,
        discountValue: data.discountType === "full" ? null : (data.discountValue ? parseFloat(data.discountValue) : null),
        maxUses: data.maxUses ? parseInt(data.maxUses) : null,
        maxUsesPerUser: data.maxUsesPerUser ? parseInt(data.maxUsesPerUser) : 1,
        validFrom: data.validFrom || undefined,
        validUntil: data.validUntil || undefined
      };
      
      const response = await apiRequest("PATCH", `/api/admin/events/${id}/coupons/${couponId}`, payload);
      const result = await response.json();
      if (!result.success) throw new Error(result.error?.message || "Erro ao atualizar cupom");
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/events", id, "coupons"] });
      setEditCouponDialog(null);
      toast({ title: "Cupom atualizado com sucesso" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar cupom", description: error.message, variant: "destructive" });
    }
  });

  const createBulkCouponsMutation = useMutation({
    mutationFn: async ({ data, mode }: { data: typeof bulkCouponForm; mode: "manual" | "auto" }) => {
      const payload: Record<string, unknown> = {
        discountType: data.discountType,
        discountValue: data.discountType === "full" ? null : parseFloat(data.discountValue) || 0,
        maxUses: data.maxUses ? parseInt(data.maxUses) : null,
        maxUsesPerUser: parseInt(data.maxUsesPerUser) || 1,
        validFrom: data.validFrom,
        validUntil: data.validUntil,
        isActive: data.isActive
      };
      
      if (mode === "auto") {
        // Use quantity for auto-generation
        payload.quantity = parseInt(data.quantity) || 10;
      } else {
        // Use manual codes
        const codes = data.codes.split(/[\n,;]+/).map(c => c.trim().toUpperCase()).filter(c => c.length >= 2);
        payload.codes = codes;
      }
      
      const response = await apiRequest("POST", `/api/admin/events/${id}/coupons/bulk`, payload);
      const result = await response.json();
      if (!result.success) throw new Error(result.error?.message || "Erro ao criar cupons");
      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/events", id, "coupons"] });
      setBulkCouponDialogOpen(false);
      setBulkCouponMode("auto");
      setBulkCouponForm({ codes: "", quantity: "10", discountType: "percentage", discountValue: "", maxUses: "", maxUsesPerUser: "1", validFrom: "", validUntil: "", isActive: true });
      const codesGenerated = result.data?.generatedCodes;
      if (codesGenerated && codesGenerated.length > 0) {
        toast({ 
          title: `${result.data?.created || 0} cupons criados com sucesso`,
          description: `Codigos: ${codesGenerated.slice(0, 3).join(", ")}${codesGenerated.length > 3 ? ` e mais ${codesGenerated.length - 3}...` : ""}`
        });
      } else {
        toast({ title: `${result.data?.created || 0} cupons criados com sucesso` });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao criar cupons", description: error.message, variant: "destructive" });
    }
  });

  const deleteCouponMutation = useMutation({
    mutationFn: async (couponId: string) => {
      const response = await apiRequest("DELETE", `/api/admin/events/${id}/coupons/${couponId}`);
      const result = await response.json();
      if (!result.success) throw new Error(result.error?.message || "Erro ao excluir cupom");
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/events", id, "coupons"] });
      setDeleteCouponDialog(null);
      toast({ title: "Cupom excluido com sucesso" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao excluir cupom", description: error.message, variant: "destructive" });
    }
  });

  const updateBatchMutation = useMutation({
    mutationFn: async ({ batchId, data }: { batchId: string; data: { validFrom?: string; validUntil?: string } }) => {
      const response = await apiRequest("PATCH", `/api/admin/events/${id}/vouchers/batches/${batchId}`, data);
      const result = await response.json();
      if (!result.success) throw new Error(result.error?.message || "Erro ao atualizar lote");
      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/events", id, "vouchers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/events", id, "vouchers/batches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/events", id, "vouchers/report"] });
      setEditBatchDialog(null);
      toast({ title: `Lote atualizado. ${result.data?.vouchersUpdated || 0} vouchers afetados.` });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar lote", description: error.message, variant: "destructive" });
    }
  });

  const handleOpenEditBatch = (batch: VoucherBatch) => {
    setEditBatchForm({
      validFrom: formatForInput(batch.validFrom),
      validUntil: formatForInput(batch.validUntil)
    });
    setEditBatchDialog(batch);
  };

  const handleOpenEditCoupon = (coupon: Coupon) => {
    setEditCouponForm({
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue || "",
      maxUses: coupon.maxUses?.toString() || "",
      maxUsesPerUser: coupon.maxUsesPerUser.toString(),
      validFrom: formatForInput(coupon.validFrom),
      validUntil: formatForInput(coupon.validUntil),
      isActive: coupon.isActive
    });
    setEditCouponDialog(coupon);
  };

  const generateCouponCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleAutoGenerateCode = () => {
    const code = generateCouponCode();
    setCouponForm({ ...couponForm, code });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Codigo copiado!" });
  };

  const handleExportVouchers = (batchId?: string, format: "xlsx" | "csv" = "xlsx") => {
    const params = new URLSearchParams();
    if (batchId) params.set("batchId", batchId);
    params.set("format", format);
    const queryString = params.toString();
    window.open(`/api/admin/events/${id}/vouchers/export${queryString ? `?${queryString}` : ""}`, "_blank");
  };

  const now = new Date();
  const filteredVouchers = vouchers.filter(v => {
    const matchesSearch = !voucherSearch || v.code.toLowerCase().includes(voucherSearch.toLowerCase());
    if (!matchesSearch) return false;
    
    if (voucherStatusFilter === "all") return true;
    if (voucherStatusFilter === "used") return v.status === "used";
    if (voucherStatusFilter === "expired") return v.status === "expired" || (v.status === "available" && new Date(v.validUntil) < now);
    if (voucherStatusFilter === "available") return v.status === "available" && new Date(v.validUntil) >= now;
    return true;
  });

  const getStatusBadge = (status: string, validUntil?: string) => {
    const isExpired = validUntil && new Date(validUntil) < now;
    
    if (status === "used") {
      return <Badge variant="default"><Clock className="h-3 w-3 mr-1" />Utilizado</Badge>;
    }
    if (status === "expired" || (status === "available" && isExpired)) {
      return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Expirado</Badge>;
    }
    if (status === "available") {
      return <Badge variant="secondary"><CheckCircle className="h-3 w-3 mr-1" />Disponivel</Badge>;
    }
    return <Badge variant="outline">{status}</Badge>;
  };

  const getDiscountLabel = (type: string, value?: string | null) => {
    switch (type) {
      case "percentage":
        return `${value || 0}%`;
      case "fixed":
        return `R$ ${parseFloat(value || "0").toFixed(2)}`;
      case "full":
        return "100%";
      default:
        return "-";
    }
  };

  if (eventLoading) {
    return (
      <AdminLayout
        title="Carregando..."
        breadcrumbs={[
          { label: "Eventos", href: "/admin/eventos" },
          { label: "Vouchers e Cupons" },
        ]}
      >
        <div className="space-y-6">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-96" />
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
      title={`Vouchers e Cupons: ${event.nome}`}
      breadcrumbs={[
        { label: "Eventos", href: "/admin/eventos" },
        { label: event.nome, href: `/admin/eventos/${id}/gerenciar` },
        { label: "Vouchers e Cupons" },
      ]}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Vouchers e Cupons</h1>
            <p className="text-muted-foreground">{event.nome}</p>
          </div>
          <Link href={`/admin/eventos/${id}/gerenciar`}>
            <Button variant="outline" data-testid="button-back">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
          </Link>
        </div>

        {report && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-total">{report.total}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Disponiveis</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600" data-testid="text-available">{report.available}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Utilizados</CardTitle>
                <Clock className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600" data-testid="text-used">{report.used}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Expirados</CardTitle>
                <XCircle className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive" data-testid="text-expired">{report.expired}</div>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="vouchers" data-testid="tab-vouchers">
              <Ticket className="h-4 w-4 mr-2" />
              Vouchers
            </TabsTrigger>
            <TabsTrigger value="coupons" data-testid="tab-coupons">
              <Tag className="h-4 w-4 mr-2" />
              Cupons
            </TabsTrigger>
          </TabsList>

          <TabsContent value="vouchers" className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              <Button onClick={() => setBatchDialogOpen(true)} data-testid="button-create-batch">
                <Plus className="h-4 w-4 mr-2" />
                Criar Lote
              </Button>
              <Button variant="outline" onClick={() => setVoucherDialogOpen(true)} data-testid="button-create-voucher">
                <Plus className="h-4 w-4 mr-2" />
                Voucher Avulso
              </Button>
            </div>

            {batches.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Lotes de Vouchers</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Quantidade</TableHead>
                        <TableHead>Validade</TableHead>
                        <TableHead>Criado em</TableHead>
                        <TableHead>Acoes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {batches.map((batch) => (
                        <TableRow key={batch.id} data-testid={`row-batch-${batch.id}`}>
                          <TableCell className="font-medium">{batch.nome}</TableCell>
                          <TableCell>{batch.quantidade}</TableCell>
                          <TableCell className="text-sm">
                            {formatDateTimeBrazil(batch.validFrom)} - {formatDateTimeBrazil(batch.validUntil)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDateTimeBrazil(batch.createdAt)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleExportVouchers(batch.id, "xlsx")}
                                title="Exportar vouchers deste lote"
                                data-testid={`button-export-batch-${batch.id}`}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleOpenEditBatch(batch)}
                                data-testid={`button-edit-batch-${batch.id}`}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between gap-2 flex-wrap">
                  <span>Vouchers ({vouchers.length})</span>
                  {vouchers.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleExportVouchers(undefined, "xlsx")}
                        data-testid="button-export-vouchers-xlsx"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Exportar Excel
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleExportVouchers(undefined, "csv")}
                        data-testid="button-export-vouchers-csv"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        CSV
                      </Button>
                    </div>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {vouchersLoading ? (
                  <Skeleton className="h-48" />
                ) : vouchers.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">Nenhum voucher criado ainda.</p>
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-3 items-center">
                      <div className="relative flex-1 min-w-[200px] max-w-[300px]">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Buscar por codigo..."
                          value={voucherSearch}
                          onChange={(e) => setVoucherSearch(e.target.value)}
                          className="pl-9"
                          data-testid="input-voucher-search"
                        />
                      </div>
                      <Select value={voucherStatusFilter} onValueChange={(v) => setVoucherStatusFilter(v as typeof voucherStatusFilter)}>
                        <SelectTrigger className="w-[150px]" data-testid="select-voucher-status-filter">
                          <Filter className="h-4 w-4 mr-2" />
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          <SelectItem value="available">Disponiveis</SelectItem>
                          <SelectItem value="used">Utilizados</SelectItem>
                          <SelectItem value="expired">Expirados</SelectItem>
                        </SelectContent>
                      </Select>
                      {(voucherSearch || voucherStatusFilter !== "all") && (
                        <span className="text-sm text-muted-foreground">
                          Mostrando {filteredVouchers.length} de {vouchers.length}
                        </span>
                      )}
                    </div>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Codigo</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Validade</TableHead>
                            <TableHead>Acoes</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredVouchers.slice(0, 100).map((voucher) => (
                            <TableRow 
                              key={voucher.id} 
                              data-testid={`row-voucher-${voucher.id}`}
                              className="cursor-pointer hover-elevate"
                              onClick={() => setVoucherDetailDialog(voucher)}
                          >
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <code className="font-mono bg-muted px-2 py-1 rounded text-sm">{voucher.code}</code>
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  onClick={(e) => { e.stopPropagation(); copyToClipboard(voucher.code); }}
                                  data-testid={`button-copy-${voucher.id}`}
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell>{getStatusBadge(voucher.status, voucher.validUntil)}</TableCell>
                            <TableCell className="text-sm">
                              {formatDateTimeBrazil(voucher.validUntil)}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                {voucher.usage && (
                                  <Badge variant="outline" className="text-xs">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Uso registrado
                                  </Badge>
                                )}
                                {voucher.status === "available" && (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={(e) => { e.stopPropagation(); setDeleteVoucherDialog({ open: true, id: voucher.id, code: voucher.code }); }}
                                    data-testid={`button-delete-${voucher.id}`}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {filteredVouchers.length > 100 && (
                        <p className="text-sm text-muted-foreground mt-4 text-center">
                          Exibindo 100 de {filteredVouchers.length} vouchers
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="coupons" className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setCouponDialogOpen(true)} data-testid="button-create-coupon">
                <Plus className="h-4 w-4 mr-2" />
                Criar Cupom
              </Button>
              <Button variant="outline" onClick={() => setBulkCouponDialogOpen(true)} data-testid="button-bulk-create-coupons">
                <Package className="h-4 w-4 mr-2" />
                Criar Varios Cupons
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Cupons de Desconto ({coupons.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {couponsLoading ? (
                  <Skeleton className="h-48" />
                ) : coupons.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">Nenhum cupom criado ainda.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Codigo</TableHead>
                        <TableHead>Desconto</TableHead>
                        <TableHead>Usos</TableHead>
                        <TableHead>Validade</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Acoes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {coupons.map((coupon) => (
                        <TableRow key={coupon.id} data-testid={`row-coupon-${coupon.id}`}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <code className="font-mono bg-muted px-2 py-1 rounded text-sm">{coupon.code}</code>
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                onClick={() => copyToClipboard(coupon.code)}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {coupon.discountType === "percentage" ? (
                                <Percent className="h-3 w-3" />
                              ) : (
                                <DollarSign className="h-3 w-3" />
                              )}
                              {getDiscountLabel(coupon.discountType, coupon.discountValue)}
                            </div>
                          </TableCell>
                          <TableCell>
                            {coupon.currentUses}/{coupon.maxUses || "Ilimitado"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatDateTimeBrazil(coupon.validUntil)}
                          </TableCell>
                          <TableCell>
                            {coupon.isActive ? (
                              <Badge variant="secondary">Ativo</Badge>
                            ) : (
                              <Badge variant="destructive">Inativo</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleOpenEditCoupon(coupon)}
                                data-testid={`button-edit-coupon-${coupon.id}`}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setDeleteCouponDialog({ open: true, id: coupon.id, code: coupon.code })}
                                data-testid={`button-delete-coupon-${coupon.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={batchDialogOpen} onOpenChange={setBatchDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Lote de Vouchers</DialogTitle>
            <DialogDescription>
              Gere multiplos vouchers de uma vez. Cada voucher tera um codigo unico.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="batch-nome">Nome do Lote</Label>
              <Input
                id="batch-nome"
                value={batchForm.nome}
                onChange={(e) => setBatchForm({ ...batchForm, nome: e.target.value })}
                placeholder="Ex: Lote Patrocinadores 2024"
                data-testid="input-batch-nome"
              />
            </div>
            <div>
              <Label htmlFor="batch-quantidade">Quantidade de Vouchers</Label>
              <Input
                id="batch-quantidade"
                type="number"
                min={1}
                max={50000}
                value={batchForm.quantidade}
                onChange={(e) => setBatchForm({ ...batchForm, quantidade: parseInt(e.target.value) || 1 })}
                data-testid="input-batch-quantidade"
              />
              <p className="text-xs text-muted-foreground mt-1">Maximo: 50.000</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="batch-valid-from">Valido a partir de</Label>
                <Input
                  id="batch-valid-from"
                  type="datetime-local"
                  value={batchForm.validFrom}
                  onChange={(e) => setBatchForm({ ...batchForm, validFrom: e.target.value })}
                  data-testid="input-batch-valid-from"
                />
              </div>
              <div>
                <Label htmlFor="batch-valid-until">Valido ate</Label>
                <Input
                  id="batch-valid-until"
                  type="datetime-local"
                  value={batchForm.validUntil}
                  onChange={(e) => setBatchForm({ ...batchForm, validUntil: e.target.value })}
                  data-testid="input-batch-valid-until"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="batch-descricao">Descricao (opcional)</Label>
              <Textarea
                id="batch-descricao"
                value={batchForm.descricao}
                onChange={(e) => setBatchForm({ ...batchForm, descricao: e.target.value })}
                placeholder="Descricao do lote..."
                data-testid="input-batch-descricao"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchDialogOpen(false)}>Cancelar</Button>
            <Button 
              onClick={() => createBatchMutation.mutate(batchForm)}
              disabled={createBatchMutation.isPending || !batchForm.nome || !batchForm.validFrom || !batchForm.validUntil}
              data-testid="button-submit-batch"
            >
              {createBatchMutation.isPending ? "Criando..." : "Criar Lote"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={voucherDialogOpen} onOpenChange={setVoucherDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Voucher Avulso</DialogTitle>
            <DialogDescription>
              Crie um voucher individual com codigo personalizado ou gerado automaticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="voucher-code">Codigo (opcional)</Label>
              <Input
                id="voucher-code"
                value={voucherForm.code}
                onChange={(e) => setVoucherForm({ ...voucherForm, code: e.target.value.toUpperCase() })}
                placeholder="Deixe em branco para gerar automaticamente"
                data-testid="input-voucher-code"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="voucher-valid-from">Valido a partir de</Label>
                <Input
                  id="voucher-valid-from"
                  type="datetime-local"
                  value={voucherForm.validFrom}
                  onChange={(e) => setVoucherForm({ ...voucherForm, validFrom: e.target.value })}
                  data-testid="input-voucher-valid-from"
                />
              </div>
              <div>
                <Label htmlFor="voucher-valid-until">Valido ate</Label>
                <Input
                  id="voucher-valid-until"
                  type="datetime-local"
                  value={voucherForm.validUntil}
                  onChange={(e) => setVoucherForm({ ...voucherForm, validUntil: e.target.value })}
                  data-testid="input-voucher-valid-until"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoucherDialogOpen(false)}>Cancelar</Button>
            <Button 
              onClick={() => createVoucherMutation.mutate(voucherForm)}
              disabled={createVoucherMutation.isPending || !voucherForm.validFrom || !voucherForm.validUntil}
              data-testid="button-submit-voucher"
            >
              {createVoucherMutation.isPending ? "Criando..." : "Criar Voucher"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={couponDialogOpen} onOpenChange={(open) => {
        setCouponDialogOpen(open);
        if (!open) {
          setAutoGenerateCouponCode(false);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Cupom de Desconto</DialogTitle>
            <DialogDescription>
              Crie um cupom que pode ser aplicado na tela de pagamento.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label htmlFor="coupon-code">Codigo do Cupom</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="auto-generate-code"
                    checked={autoGenerateCouponCode}
                    onChange={(e) => {
                      setAutoGenerateCouponCode(e.target.checked);
                      if (e.target.checked) {
                        handleAutoGenerateCode();
                      } else {
                        setCouponForm({ ...couponForm, code: "" });
                      }
                    }}
                    className="h-4 w-4 rounded border-gray-300"
                    data-testid="checkbox-auto-generate-code"
                  />
                  <Label htmlFor="auto-generate-code" className="text-sm cursor-pointer">
                    Gerar automaticamente
                  </Label>
                </div>
              </div>
              <div className="flex gap-2">
                <Input
                  id="coupon-code"
                  value={couponForm.code}
                  onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })}
                  placeholder={autoGenerateCouponCode ? "Codigo gerado" : "Ex: DESCONTO50"}
                  readOnly={autoGenerateCouponCode}
                  className={autoGenerateCouponCode ? "bg-muted font-mono" : ""}
                  data-testid="input-coupon-code"
                />
                {autoGenerateCouponCode && couponForm.code && (
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={() => copyToClipboard(couponForm.code)}
                    title="Copiar codigo"
                    data-testid="button-copy-generated-code"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                )}
                {autoGenerateCouponCode && (
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={handleAutoGenerateCode}
                    title="Gerar novo codigo"
                    data-testid="button-regenerate-code"
                  >
                    <Tag className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="coupon-type">Tipo de Desconto</Label>
                <Select 
                  value={couponForm.discountType} 
                  onValueChange={(v: "percentage" | "fixed" | "full") => setCouponForm({ ...couponForm, discountType: v })}
                >
                  <SelectTrigger data-testid="select-coupon-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Porcentagem (%)</SelectItem>
                    <SelectItem value="fixed">Valor Fixo (R$)</SelectItem>
                    <SelectItem value="full">Gratuidade Total</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {couponForm.discountType !== "full" && (
                <div>
                  <Label htmlFor="coupon-value">Valor do Desconto</Label>
                  <Input
                    id="coupon-value"
                    type="number"
                    min={0}
                    max={couponForm.discountType === "percentage" ? 100 : undefined}
                    value={couponForm.discountValue}
                    onChange={(e) => setCouponForm({ ...couponForm, discountValue: e.target.value })}
                    placeholder={couponForm.discountType === "percentage" ? "Ex: 50" : "Ex: 25.00"}
                    data-testid="input-coupon-value"
                  />
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="coupon-max-uses">Limite de Usos (total)</Label>
                <Input
                  id="coupon-max-uses"
                  type="number"
                  min={1}
                  value={couponForm.maxUses}
                  onChange={(e) => setCouponForm({ ...couponForm, maxUses: e.target.value })}
                  placeholder="Sem limite"
                  data-testid="input-coupon-max-uses"
                />
              </div>
              <div>
                <Label htmlFor="coupon-max-per-user">Limite por Usuario</Label>
                <Input
                  id="coupon-max-per-user"
                  type="number"
                  min={1}
                  value={couponForm.maxUsesPerUser}
                  onChange={(e) => setCouponForm({ ...couponForm, maxUsesPerUser: e.target.value })}
                  data-testid="input-coupon-max-per-user"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="coupon-valid-from">Valido a partir de</Label>
                <Input
                  id="coupon-valid-from"
                  type="datetime-local"
                  value={couponForm.validFrom}
                  onChange={(e) => setCouponForm({ ...couponForm, validFrom: e.target.value })}
                  data-testid="input-coupon-valid-from"
                />
              </div>
              <div>
                <Label htmlFor="coupon-valid-until">Valido ate</Label>
                <Input
                  id="coupon-valid-until"
                  type="datetime-local"
                  value={couponForm.validUntil}
                  onChange={(e) => setCouponForm({ ...couponForm, validUntil: e.target.value })}
                  data-testid="input-coupon-valid-until"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 pt-2 border-t">
              <input
                type="checkbox"
                id="coupon-is-active"
                checked={couponForm.isActive}
                onChange={(e) => setCouponForm({ ...couponForm, isActive: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
                data-testid="checkbox-coupon-is-active"
              />
              <Label htmlFor="coupon-is-active" className="cursor-pointer">
                Cupom ativo (pode ser usado imediatamente)
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCouponDialogOpen(false)}>Cancelar</Button>
            <Button 
              onClick={() => createCouponMutation.mutate(couponForm)}
              disabled={createCouponMutation.isPending || !couponForm.code || !couponForm.validFrom || !couponForm.validUntil}
              data-testid="button-submit-coupon"
            >
              {createCouponMutation.isPending ? "Criando..." : "Criar Cupom"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteVoucherDialog?.open || false} onOpenChange={(open) => !open && setDeleteVoucherDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Voucher</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o voucher "{deleteVoucherDialog?.code}"?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteVoucherDialog && deleteVoucherMutation.mutate(deleteVoucherDialog.id)}
              className="bg-destructive text-destructive-foreground"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteCouponDialog?.open || false} onOpenChange={(open) => !open && setDeleteCouponDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Cupom</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o cupom "{deleteCouponDialog?.code}"?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteCouponDialog && deleteCouponMutation.mutate(deleteCouponDialog.id)}
              className="bg-destructive text-destructive-foreground"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!editCouponDialog} onOpenChange={(open) => !open && setEditCouponDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Editar Cupom
            </DialogTitle>
            <DialogDescription>
              Edite as configuracoes do cupom "{editCouponDialog?.code}".
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-md border">
              <div>
                <p className="font-medium">Status do Cupom</p>
                <p className="text-sm text-muted-foreground">
                  {editCouponForm.isActive ? "Cupom está ativo e pode ser usado" : "Cupom está inativo e não pode ser usado"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="edit-coupon-active" className="text-sm">
                  {editCouponForm.isActive ? "Ativo" : "Inativo"}
                </Label>
                <input
                  type="checkbox"
                  id="edit-coupon-active"
                  checked={editCouponForm.isActive}
                  onChange={(e) => setEditCouponForm({ ...editCouponForm, isActive: e.target.checked })}
                  className="h-5 w-5 rounded border-gray-300"
                  data-testid="checkbox-edit-coupon-active"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="edit-coupon-code">Codigo do Cupom</Label>
              <Input
                id="edit-coupon-code"
                value={editCouponForm.code}
                onChange={(e) => setEditCouponForm({ ...editCouponForm, code: e.target.value.toUpperCase() })}
                data-testid="input-edit-coupon-code"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-coupon-type">Tipo de Desconto</Label>
                <Select 
                  value={editCouponForm.discountType} 
                  onValueChange={(v: "percentage" | "fixed" | "full") => setEditCouponForm({ ...editCouponForm, discountType: v })}
                >
                  <SelectTrigger data-testid="select-edit-coupon-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Porcentagem (%)</SelectItem>
                    <SelectItem value="fixed">Valor Fixo (R$)</SelectItem>
                    <SelectItem value="full">Gratuidade Total</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {editCouponForm.discountType !== "full" && (
                <div>
                  <Label htmlFor="edit-coupon-value">Valor do Desconto</Label>
                  <Input
                    id="edit-coupon-value"
                    type="number"
                    min={0}
                    max={editCouponForm.discountType === "percentage" ? 100 : undefined}
                    value={editCouponForm.discountValue}
                    onChange={(e) => setEditCouponForm({ ...editCouponForm, discountValue: e.target.value })}
                    data-testid="input-edit-coupon-value"
                  />
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-coupon-max-uses">Limite de Usos (total)</Label>
                <Input
                  id="edit-coupon-max-uses"
                  type="number"
                  min={1}
                  value={editCouponForm.maxUses}
                  onChange={(e) => setEditCouponForm({ ...editCouponForm, maxUses: e.target.value })}
                  placeholder="Sem limite"
                  data-testid="input-edit-coupon-max-uses"
                />
              </div>
              <div>
                <Label htmlFor="edit-coupon-max-per-user">Limite por Usuario</Label>
                <Input
                  id="edit-coupon-max-per-user"
                  type="number"
                  min={1}
                  value={editCouponForm.maxUsesPerUser}
                  onChange={(e) => setEditCouponForm({ ...editCouponForm, maxUsesPerUser: e.target.value })}
                  data-testid="input-edit-coupon-max-per-user"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-coupon-valid-from">Valido a partir de</Label>
                <Input
                  id="edit-coupon-valid-from"
                  type="datetime-local"
                  value={editCouponForm.validFrom}
                  onChange={(e) => setEditCouponForm({ ...editCouponForm, validFrom: e.target.value })}
                  data-testid="input-edit-coupon-valid-from"
                />
              </div>
              <div>
                <Label htmlFor="edit-coupon-valid-until">Valido ate</Label>
                <Input
                  id="edit-coupon-valid-until"
                  type="datetime-local"
                  value={editCouponForm.validUntil}
                  onChange={(e) => setEditCouponForm({ ...editCouponForm, validUntil: e.target.value })}
                  data-testid="input-edit-coupon-valid-until"
                />
              </div>
            </div>
            {editCouponDialog && (
              <div className="text-sm text-muted-foreground pt-2 border-t">
                <p>Usos atuais: {editCouponDialog.currentUses}/{editCouponDialog.maxUses || "Ilimitado"}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditCouponDialog(null)}>Cancelar</Button>
            <Button 
              onClick={() => editCouponDialog && updateCouponMutation.mutate({ 
                couponId: editCouponDialog.id, 
                data: editCouponForm 
              })}
              disabled={updateCouponMutation.isPending}
              data-testid="button-submit-edit-coupon"
            >
              {updateCouponMutation.isPending ? "Salvando..." : "Salvar Alteracoes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!voucherDetailDialog} onOpenChange={(open) => !open && setVoucherDetailDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ticket className="h-5 w-5" />
              Detalhes do Voucher
            </DialogTitle>
          </DialogHeader>
          {voucherDetailDialog && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4 flex-wrap p-4 bg-muted rounded-md">
                <div>
                  <p className="text-xs text-muted-foreground">Codigo</p>
                  <code className="font-mono text-lg font-bold">{voucherDetailDialog.code}</code>
                </div>
                <div>
                  {getStatusBadge(voucherDetailDialog.status)}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span className="text-xs">Validade</span>
                  </div>
                  <p className="text-sm">
                    {formatDateTimeBrazil(voucherDetailDialog.validFrom)} ate {formatDateTimeBrazil(voucherDetailDialog.validUntil)}
                  </p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <FileText className="h-4 w-4" />
                    <span className="text-xs">Criado em</span>
                  </div>
                  <p className="text-sm">{formatDateTimeBrazil(voucherDetailDialog.createdAt)}</p>
                </div>
              </div>

              {voucherDetailDialog.batchId && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Package className="h-4 w-4" />
                    <span className="text-xs">Lote</span>
                  </div>
                  <p className="text-sm">
                    {batches.find(b => b.id === voucherDetailDialog.batchId)?.nome || `ID: ${voucherDetailDialog.batchId}`}
                  </p>
                </div>
              )}

              <div className="border-t pt-4">
                <h4 className="font-medium flex items-center gap-2 mb-3">
                  <Eye className="h-4 w-4" />
                  Auditoria de Uso
                </h4>
                {voucherDetailDialog.usage ? (
                  <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-md p-4 space-y-3">
                    <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                      <CheckCircle className="h-5 w-5" />
                      <span className="font-medium">Voucher Utilizado</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">Data/Hora do Uso</p>
                        <p>{formatDateTimeBrazil(voucherDetailDialog.usage.usedAt)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">ID do Usuario</p>
                        <p className="font-mono">{voucherDetailDialog.usage.userId}</p>
                      </div>
                    </div>
                    {voucherDetailDialog.usage.registrationId && (
                      <div>
                        <p className="text-muted-foreground text-xs">Inscricao Associada</p>
                        <p className="font-mono text-sm">#{voucherDetailDialog.usage.registrationId}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Este voucher ainda não foi utilizado.</p>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoucherDetailDialog(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkCouponDialogOpen} onOpenChange={setBulkCouponDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Criar Cupons em Massa
            </DialogTitle>
            <DialogDescription>
              Gere codigos automaticamente ou insira manualmente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Mode Toggle */}
            <div className="flex gap-2">
              <Button 
                type="button"
                variant={bulkCouponMode === "auto" ? "default" : "outline"}
                size="sm"
                onClick={() => setBulkCouponMode("auto")}
                data-testid="button-bulk-mode-auto"
              >
                Gerar Automaticamente
              </Button>
              <Button 
                type="button"
                variant={bulkCouponMode === "manual" ? "default" : "outline"}
                size="sm"
                onClick={() => setBulkCouponMode("manual")}
                data-testid="button-bulk-mode-manual"
              >
                Codigos Manuais
              </Button>
            </div>

            {/* Code Input - depends on mode */}
            {bulkCouponMode === "auto" ? (
              <div>
                <Label htmlFor="bulk-coupon-quantity">Quantidade de Cupons</Label>
                <Input
                  id="bulk-coupon-quantity"
                  type="number"
                  min={1}
                  max={1000}
                  value={bulkCouponForm.quantity}
                  onChange={(e) => setBulkCouponForm({ ...bulkCouponForm, quantity: e.target.value })}
                  placeholder="Ex: 10"
                  data-testid="input-bulk-coupon-quantity"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Codigos aleatorios serao gerados automaticamente (max: 1000)
                </p>
              </div>
            ) : (
              <div>
                <Label htmlFor="bulk-coupon-codes">Codigos (um por linha ou separados por virgula)</Label>
                <Textarea
                  id="bulk-coupon-codes"
                  value={bulkCouponForm.codes}
                  onChange={(e) => setBulkCouponForm({ ...bulkCouponForm, codes: e.target.value.toUpperCase() })}
                  placeholder="CUPOM10&#10;DESCONTO20&#10;PROMO30"
                  className="min-h-[100px] font-mono"
                  data-testid="input-bulk-coupon-codes"
                />
                {bulkCouponForm.codes && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {bulkCouponForm.codes.split(/[\n,;]+/).filter(c => c.trim().length >= 2).length} codigo(s) detectado(s)
                  </p>
                )}
              </div>
            )}

            {/* Discount Type */}
            <div>
              <Label>Tipo de Desconto</Label>
              <Select 
                value={bulkCouponForm.discountType} 
                onValueChange={(v: "percentage" | "fixed" | "full") => setBulkCouponForm({ ...bulkCouponForm, discountType: v })}
              >
                <SelectTrigger data-testid="select-bulk-coupon-discount-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Porcentagem (%)</SelectItem>
                  <SelectItem value="fixed">Valor Fixo (R$)</SelectItem>
                  <SelectItem value="full">100% Gratuito</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Discount Value */}
            {bulkCouponForm.discountType !== "full" && (
              <div>
                <Label htmlFor="bulk-coupon-discount-value">
                  Valor do Desconto {bulkCouponForm.discountType === "percentage" ? "(%)" : "(R$)"}
                </Label>
                <Input
                  id="bulk-coupon-discount-value"
                  type="number"
                  min="0"
                  max={bulkCouponForm.discountType === "percentage" ? 100 : undefined}
                  value={bulkCouponForm.discountValue}
                  onChange={(e) => setBulkCouponForm({ ...bulkCouponForm, discountValue: e.target.value })}
                  placeholder={bulkCouponForm.discountType === "percentage" ? "Ex: 20" : "Ex: 50.00"}
                  data-testid="input-bulk-coupon-discount-value"
                />
              </div>
            )}

            {/* Usage Limits */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="bulk-coupon-max-uses">Limite Total de Usos</Label>
                <Input
                  id="bulk-coupon-max-uses"
                  type="number"
                  min={1}
                  value={bulkCouponForm.maxUses}
                  onChange={(e) => setBulkCouponForm({ ...bulkCouponForm, maxUses: e.target.value })}
                  placeholder="Sem limite"
                  data-testid="input-bulk-coupon-max-uses"
                />
              </div>
              <div>
                <Label htmlFor="bulk-coupon-max-per-user">Limite por Usuario</Label>
                <Input
                  id="bulk-coupon-max-per-user"
                  type="number"
                  min={1}
                  value={bulkCouponForm.maxUsesPerUser}
                  onChange={(e) => setBulkCouponForm({ ...bulkCouponForm, maxUsesPerUser: e.target.value })}
                  data-testid="input-bulk-coupon-max-per-user"
                />
              </div>
            </div>

            {/* Validity Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="bulk-coupon-valid-from">Valido a partir de</Label>
                <Input
                  id="bulk-coupon-valid-from"
                  type="datetime-local"
                  value={bulkCouponForm.validFrom}
                  onChange={(e) => setBulkCouponForm({ ...bulkCouponForm, validFrom: e.target.value })}
                  data-testid="input-bulk-coupon-valid-from"
                />
              </div>
              <div>
                <Label htmlFor="bulk-coupon-valid-until">Valido ate</Label>
                <Input
                  id="bulk-coupon-valid-until"
                  type="datetime-local"
                  value={bulkCouponForm.validUntil}
                  onChange={(e) => setBulkCouponForm({ ...bulkCouponForm, validUntil: e.target.value })}
                  data-testid="input-bulk-coupon-valid-until"
                />
              </div>
            </div>

            {/* Active Status */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="bulk-coupon-active"
                checked={bulkCouponForm.isActive}
                onChange={(e) => setBulkCouponForm({ ...bulkCouponForm, isActive: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
                data-testid="checkbox-bulk-coupon-active"
              />
              <Label htmlFor="bulk-coupon-active" className="cursor-pointer">
                Cupom ativo (pode ser usado imediatamente)
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkCouponDialogOpen(false)}>Cancelar</Button>
            <Button 
              onClick={() => createBulkCouponsMutation.mutate({ data: bulkCouponForm, mode: bulkCouponMode })}
              disabled={
                createBulkCouponsMutation.isPending || 
                !bulkCouponForm.validFrom || 
                !bulkCouponForm.validUntil ||
                (bulkCouponMode === "manual" && !bulkCouponForm.codes) ||
                (bulkCouponMode === "auto" && (!bulkCouponForm.quantity || parseInt(bulkCouponForm.quantity) < 1))
              }
              data-testid="button-confirm-bulk-coupons"
            >
              {createBulkCouponsMutation.isPending ? "Criando..." : "Criar Cupons"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!editBatchDialog} onOpenChange={(open) => !open && setEditBatchDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Alterar Validade do Lote
            </AlertDialogTitle>
            <AlertDialogDescription>
              {editBatchDialog && (
                <span>
                  Esta alteracao afetara <strong>{editBatchDialog.quantidade}</strong> vouchers do lote "{editBatchDialog.nome}".
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-batch-valid-from">Valido a partir de</Label>
                <Input
                  id="edit-batch-valid-from"
                  type="datetime-local"
                  value={editBatchForm.validFrom}
                  onChange={(e) => setEditBatchForm({ ...editBatchForm, validFrom: e.target.value })}
                  data-testid="input-edit-batch-valid-from"
                />
              </div>
              <div>
                <Label htmlFor="edit-batch-valid-until">Valido ate</Label>
                <Input
                  id="edit-batch-valid-until"
                  type="datetime-local"
                  value={editBatchForm.validUntil}
                  onChange={(e) => setEditBatchForm({ ...editBatchForm, validUntil: e.target.value })}
                  data-testid="input-edit-batch-valid-until"
                />
              </div>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => editBatchDialog && updateBatchMutation.mutate({
                batchId: editBatchDialog.id,
                data: {
                  validFrom: editBatchForm.validFrom || undefined,
                  validUntil: editBatchForm.validUntil || undefined
                }
              })}
              disabled={updateBatchMutation.isPending || (!editBatchForm.validFrom && !editBatchForm.validUntil)}
              data-testid="button-confirm-update-batch"
            >
              {updateBatchMutation.isPending ? "Atualizando..." : "Confirmar Alteracao"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
