import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { OrganizerLayout } from "@/components/organizador/OrganizerLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useOrganizerAuth } from "@/contexts/OrganizerAuthContext";
import { 
  ArrowLeft, Calendar, MapPin, Users, TrendingUp, Shirt, 
  DollarSign, Ticket, ClipboardList, BarChart3, Package,
  CheckCircle2, Clock, XCircle, Download, Layers, ExternalLink, ShoppingCart
} from "lucide-react";
import * as XLSX from "xlsx";
import { formatDateOnlyBrazil, formatCurrency } from "@/lib/timezone";

interface EventStats {
  totalInscritos: number;
  totalPendentes: number;
  masculino: number;
  feminino: number;
  byModality: Array<{
    modalityId: string;
    modalityName: string;
    total: number;
    masculino: number;
    feminino: number;
    limiteVagas: number | null;
    vagasOcupadas: number;
    vagasDisponiveis: number | null;
  }>;
  faturamento: {
    bruto: number;
    descontos: number;
    taxaComodidade: number;
    liquido: number;
  };
  vagas: {
    total: number;
    ocupadas: number;
    disponiveis: number;
  };
  shirtGrid: Array<{
    id: string;
    tamanho: string;
    quantidadeTotal: number;
    quantidadeDisponivel: number;
    consumoConfirmado: number;
    consumoPendente: number;
  }>;
  batches: Array<{
    id: string;
    nome: string;
    dataInicio: string;
    dataTermino: string | null;
    quantidadeMaxima: number | null;
    quantidadeUtilizada: number;
    ativo: boolean;
    status: string;
    isVigente: boolean;
    precos: Array<{
      modalityId: string;
      modalityName: string;
      valor: string;
    }>;
  }>;
}

interface Event {
  id: string;
  nome: string;
  slug: string;
  cidade: string;
  estado: string;
  dataEvento: string;
  status: string;
  limiteVagasTotal: number;
  vagasOcupadas: number;
  organizerId: string;
  dataInicioInscricoes: string;
  dataFimInscricoes: string;
}

interface VoucherStats {
  vouchers: Array<{
    id: string;
    codigo: string;
    tipo: string;
    valor: string;
    limiteUsos: number | null;
    quantidadeUtilizada: number;
    modalityName: string | null;
    desconto: number;
  }>;
  totalDescontos: number;
}

function StatCard({ 
  title, 
  value, 
  description, 
  icon: Icon,
  trend,
  isLoading = false
}: { 
  title: string; 
  value: string | number; 
  description?: string;
  icon: React.ElementType;
  trend?: "up" | "down" | "neutral";
  isLoading?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <div className="text-2xl font-bold">{value}</div>
        )}
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

function OverviewTab({ event, stats, isLoading }: { event: Event; stats: EventStats | null; isLoading: boolean }) {
  const vagasPercentual = event.limiteVagasTotal > 0 
    ? Math.round((event.vagasOcupadas / event.limiteVagasTotal) * 100)
    : 0;

  const activeBatches = stats?.batches?.filter(b => b.isVigente || b.status === "active") || [];
  const upcomingBatches = stats?.batches?.filter(b => {
    const startDate = new Date(b.dataInicio);
    return startDate > new Date() && b.status !== "closed";
  }) || [];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total de Inscritos"
          value={stats?.totalInscritos ?? 0}
          description="Inscrições confirmadas"
          icon={Users}
          isLoading={isLoading}
        />
        <StatCard
          title="Pendentes"
          value={stats?.totalPendentes ?? 0}
          description="Aguardando pagamento"
          icon={Clock}
          isLoading={isLoading}
        />
        <StatCard
          title="Valor Líquido"
          value={formatCurrency(stats?.faturamento.liquido ?? 0)}
          description="Valor do organizador"
          icon={DollarSign}
          isLoading={isLoading}
        />
        <StatCard
          title="Vagas Disponíveis"
          value={stats?.vagas.disponiveis ?? 0}
          description={`de ${event.limiteVagasTotal} vagas totais`}
          icon={Ticket}
          isLoading={isLoading}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Ocupação de Vagas</CardTitle>
            <CardDescription>Progresso das inscrições</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span>{event.vagasOcupadas} ocupadas</span>
              <span className="font-medium">{vagasPercentual}%</span>
            </div>
            <Progress value={vagasPercentual} className="h-3" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0</span>
              <span>{event.limiteVagasTotal} vagas</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Informações do Evento</CardTitle>
            <CardDescription>Dados gerais</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Data do Evento</span>
              <span className="font-medium">{formatDateOnlyBrazil(event.dataEvento)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Local</span>
              <span className="font-medium">{event.cidade}, {event.estado}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Período de Inscrições</span>
              <span className="font-medium text-sm">
                {formatDateOnlyBrazil(event.dataInicioInscricoes)} - {formatDateOnlyBrazil(event.dataFimInscricoes)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Status</span>
              <Badge variant={event.status === "ativo" ? "default" : "secondary"}>
                {event.status === "ativo" ? "Ativo" : event.status}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Resumo por Gênero</CardTitle>
          <CardDescription>Distribuição dos inscritos confirmados</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-blue-50 dark:bg-blue-950">
              <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.masculino ?? 0}</p>
                <p className="text-sm text-muted-foreground">Masculino</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-lg bg-pink-50 dark:bg-pink-950">
              <div className="h-10 w-10 rounded-full bg-pink-100 dark:bg-pink-900 flex items-center justify-center">
                <Users className="h-5 w-5 text-pink-600 dark:text-pink-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.feminino ?? 0}</p>
                <p className="text-sm text-muted-foreground">Feminino</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Lotes Ativos e Próximos
          </CardTitle>
          <CardDescription>Lotes de inscrição em andamento</CardDescription>
        </CardHeader>
        <CardContent>
          {activeBatches.length === 0 && upcomingBatches.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Layers className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>Nenhum lote ativo ou próximo</p>
            </div>
          ) : (
            <div className="space-y-4">
              {activeBatches.map((batch) => (
                <div key={batch.id} className="border rounded-lg p-4 bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-green-600 hover:bg-green-600">Ativo</Badge>
                      <span className="font-medium">{batch.nome}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {batch.quantidadeUtilizada} / {batch.quantidadeMaxima ?? "∞"} vagas
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {formatDateOnlyBrazil(batch.dataInicio)}
                    {batch.dataTermino && ` até ${formatDateOnlyBrazil(batch.dataTermino)}`}
                  </p>
                </div>
              ))}
              {upcomingBatches.filter(b => !activeBatches.find(a => a.id === b.id)).map((batch) => (
                <div key={batch.id} className="border rounded-lg p-4 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="border-blue-500 text-blue-600">Próximo</Badge>
                      <span className="font-medium">{batch.nome}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      0 / {batch.quantidadeMaxima ?? "∞"} vagas
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Início: {formatDateOnlyBrazil(batch.dataInicio)}
                    {batch.dataTermino && ` até ${formatDateOnlyBrazil(batch.dataTermino)}`}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ModalitiesTab({ stats, isLoading }: { stats: EventStats | null; isLoading: boolean }) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Modalidades & Vagas</CardTitle>
          <CardDescription>Ocupação por modalidade</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Modalidade</TableHead>
                <TableHead className="text-center">Inscritos</TableHead>
                <TableHead className="text-center">Limite</TableHead>
                <TableHead className="text-center">Disponíveis</TableHead>
                <TableHead className="text-right">Ocupação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats?.byModality.map((mod) => {
                const ocupacao = mod.limiteVagas 
                  ? Math.round((mod.vagasOcupadas / mod.limiteVagas) * 100)
                  : 0;
                return (
                  <TableRow key={mod.modalityId}>
                    <TableCell className="font-medium">{mod.modalityName}</TableCell>
                    <TableCell className="text-center">{mod.total}</TableCell>
                    <TableCell className="text-center">
                      {mod.limiteVagas ?? "Ilimitado"}
                    </TableCell>
                    <TableCell className="text-center">
                      {mod.vagasDisponiveis ?? "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Progress value={ocupacao} className="w-16 h-2" />
                        <span className="text-sm text-muted-foreground w-10">{ocupacao}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Lotes de Inscrição</CardTitle>
          <CardDescription>Histórico e valores por lote</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stats?.batches.map((batch) => (
              <div key={batch.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{batch.nome}</span>
                    {batch.isVigente && (
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Atual</Badge>
                    )}
                    {batch.status === "closed" && (
                      <Badge variant="secondary">Encerrado</Badge>
                    )}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {batch.quantidadeUtilizada} / {batch.quantidadeMaxima ?? "∞"}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground mb-3">
                  {formatDateOnlyBrazil(batch.dataInicio)}
                  {batch.dataTermino && ` até ${formatDateOnlyBrazil(batch.dataTermino)}`}
                </div>
                <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                  {batch.precos.map((preco) => (
                    <div key={preco.modalityId} className="flex justify-between text-sm bg-muted/50 rounded px-3 py-2">
                      <span>{preco.modalityName}</span>
                      <span className="font-medium">{formatCurrency(parseFloat(preco.valor))}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ShirtsTab({ stats, isLoading, eventName }: { stats: EventStats | null; isLoading: boolean; eventName?: string }) {
  const sizeOrder: Record<string, number> = {
    'PP': 1, 'P': 2, 'M': 3, 'G': 4, 'GG': 5, 'XG': 6, 'XGG': 7, 'EG': 8, 'EGG': 9,
    '2': 10, '4': 11, '6': 12, '8': 13, '10': 14, '12': 15, '14': 16
  };

  const sortedShirts = [...(stats?.shirtGrid || [])].sort((a, b) => {
    const orderA = sizeOrder[a.tamanho.toUpperCase()] ?? 99;
    const orderB = sizeOrder[b.tamanho.toUpperCase()] ?? 99;
    return orderA - orderB;
  });

  const totalCamisas = sortedShirts.reduce((sum, s) => sum + s.quantidadeTotal, 0);
  const totalUtilizado = sortedShirts.reduce((sum, s) => sum + s.consumoConfirmado, 0);

  const exportShirtsToExcel = () => {
    const headers = ["Tamanho", "Total", "Confirmadas", "Pendentes", "Disponíveis", "Ocupação (%)"];
    const rows = sortedShirts.map((shirt) => {
      const ocupacao = shirt.quantidadeTotal > 0
        ? Math.round((shirt.consumoConfirmado / shirt.quantidadeTotal) * 100)
        : 0;
      return [
        shirt.tamanho,
        shirt.quantidadeTotal,
        shirt.consumoConfirmado,
        shirt.consumoPendente,
        shirt.quantidadeDisponivel,
        ocupacao
      ];
    });
    
    rows.push([
      "TOTAL",
      totalCamisas,
      totalUtilizado,
      sortedShirts.reduce((sum, s) => sum + s.consumoPendente, 0),
      totalCamisas - totalUtilizado,
      totalCamisas > 0 ? Math.round((totalUtilizado / totalCamisas) * 100) : 0
    ]);

    const wsData = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    const colWidths = headers.map((_, i) => {
      const maxLen = Math.max(
        headers[i].length,
        ...rows.map(row => String(row[i]).length)
      );
      return { wch: Math.min(maxLen + 2, 30) };
    });
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Grade Camisas");
    XLSX.writeFile(wb, `grade_camisas_${eventName?.replace(/\s+/g, '_') || 'evento'}_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Total de Camisas"
          value={totalCamisas}
          description="Estoque total configurado"
          icon={Shirt}
        />
        <StatCard
          title="Utilizadas"
          value={totalUtilizado}
          description="Confirmadas em inscrições"
          icon={Package}
        />
        <StatCard
          title="Disponíveis"
          value={totalCamisas - totalUtilizado}
          description="Restantes no estoque"
          icon={CheckCircle2}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Grade de Camisas</CardTitle>
            <CardDescription>Estoque por tamanho</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={exportShirtsToExcel}>
            <Download className="h-4 w-4 mr-2" />
            Baixar Excel
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tamanho</TableHead>
                <TableHead className="text-center">Confirmadas</TableHead>
                <TableHead className="text-center">Pendentes</TableHead>
                <TableHead className="text-center">Disponíveis</TableHead>
                <TableHead className="text-center">Total</TableHead>
                <TableHead className="text-right">Ocupação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedShirts.map((shirt) => {
                const ocupacao = shirt.quantidadeTotal > 0
                  ? Math.round((shirt.consumoConfirmado / shirt.quantidadeTotal) * 100)
                  : 0;
                return (
                  <TableRow key={shirt.id}>
                    <TableCell className="font-medium">{shirt.tamanho}</TableCell>
                    <TableCell className="text-center">
                      <span className="text-green-600 font-medium">{shirt.consumoConfirmado}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-yellow-600">{shirt.consumoPendente}</span>
                    </TableCell>
                    <TableCell className="text-center">{shirt.quantidadeDisponivel}</TableCell>
                    <TableCell className="text-center">{shirt.quantidadeTotal}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Progress value={ocupacao} className="w-16 h-2" />
                        <span className="text-sm text-muted-foreground w-10">{ocupacao}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function RegistrationsTab({ event, stats, isLoading, eventId }: { event: Event; stats: EventStats | null; isLoading: boolean; eventId: string }) {
  const totalCanceladas = 0;
  const totalInscritos = (stats?.totalInscritos ?? 0) + (stats?.totalPendentes ?? 0);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-end gap-2">
        <Link href={`/organizadores/evento/${eventId}/inscritos`} className="w-full sm:w-auto">
          <Button className="w-full sm:w-auto" size="sm">
            <ExternalLink className="h-4 w-4 mr-1.5" />
            Ver Lista Completa
          </Button>
        </Link>
        {/* Botão de Relatório de Pedidos temporariamente desativado
        <Link href={`/organizadores/evento/${eventId}/pedidos`} className="w-full sm:w-auto">
          <Button variant="outline" className="w-full sm:w-auto" size="sm">
            <ShoppingCart className="h-4 w-4 mr-1.5" />
            Relatório de Pedidos
          </Button>
        </Link>
        */}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <ClipboardList className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{totalInscritos}</p>
                <p className="text-sm text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{stats?.totalInscritos ?? 0}</p>
                <p className="text-sm text-muted-foreground">Confirmadas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-yellow-500">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold">{stats?.totalPendentes ?? 0}</p>
                <p className="text-sm text-muted-foreground">Pendentes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card de Canceladas temporariamente desativado
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <XCircle className="h-8 w-8 text-red-500" />
              <div>
                <p className="text-2xl font-bold">{totalCanceladas}</p>
                <p className="text-sm text-muted-foreground">Canceladas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        */}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Inscrições por Modalidade</CardTitle>
          <CardDescription>Distribuição dos inscritos confirmados</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stats?.byModality.map((mod) => {
              const percentual = totalInscritos > 0 
                ? Math.round((mod.total / (stats?.totalInscritos || 1)) * 100)
                : 0;
              return (
                <div key={mod.modalityId} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{mod.modalityName}</span>
                    <span className="text-sm text-muted-foreground">
                      {mod.total} inscritos ({percentual}%)
                    </span>
                  </div>
                  <Progress value={percentual} className="h-2" />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function FinanceTab({ stats, isLoading }: { stats: EventStats | null; isLoading: boolean }) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const faturamento = stats?.faturamento || { bruto: 0, descontos: 0, taxaComodidade: 0, liquido: 0 };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Valor Bruto"
          value={formatCurrency(faturamento.bruto)}
          description="Valor das inscrições"
          icon={DollarSign}
        />
        <StatCard
          title="Descontos"
          value={formatCurrency(faturamento.descontos)}
          description="Cupons e vouchers"
          icon={Ticket}
        />
        <StatCard
          title="Taxa de Comodidade"
          value={formatCurrency(faturamento.taxaComodidade)}
          description="Taxas aplicadas"
          icon={TrendingUp}
        />
        <StatCard
          title="Faturamento Líquido"
          value={formatCurrency(faturamento.liquido)}
          description="Após descontos"
          icon={BarChart3}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Resumo Financeiro</CardTitle>
            <CardDescription>Detalhamento dos valores</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-muted-foreground">Valor Bruto</span>
              <span className="font-medium text-lg">{formatCurrency(faturamento.bruto)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-muted-foreground">(-) Descontos</span>
              <span className="font-medium text-red-600">-{formatCurrency(faturamento.descontos)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-muted-foreground">(-) Taxa de Comodidade</span>
              <span className="font-medium text-orange-600">-{formatCurrency(faturamento.taxaComodidade)}</span>
            </div>
            <div className="flex justify-between items-center py-2 bg-muted/50 rounded-lg px-3">
              <span className="font-medium">Valor Líquido (Organizador)</span>
              <span className="font-bold text-xl text-green-600">{formatCurrency(faturamento.liquido)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Comparativo de Pagamentos</CardTitle>
            <CardDescription>Pagos vs Pendentes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-green-50 dark:bg-green-950">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
              <div className="flex-1">
                <p className="font-medium">Pagos</p>
                <p className="text-2xl font-bold text-green-600">{stats?.totalInscritos ?? 0}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Valor Líquido</p>
                <p className="font-medium">{formatCurrency(faturamento.liquido)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-lg bg-yellow-50 dark:bg-yellow-950">
              <Clock className="h-8 w-8 text-yellow-600" />
              <div className="flex-1">
                <p className="font-medium">Pendentes</p>
                <p className="text-2xl font-bold text-yellow-600">{stats?.totalPendentes ?? 0}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Potencial</p>
                <p className="font-medium text-muted-foreground">-</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function VouchersTab({ eventId }: { eventId: string }) {
  const { data: vouchersData, isLoading } = useQuery<{ success: boolean; data: VoucherStats }>({
    queryKey: [`/api/admin/events/${eventId}/voucher-stats`],
  });

  const vouchers = vouchersData?.data?.vouchers || [];
  const totalDescontos = vouchersData?.data?.totalDescontos || 0;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <StatCard
          title="Total de Cupons"
          value={vouchers.length}
          description="Cupons configurados"
          icon={Ticket}
        />
        <StatCard
          title="Impacto no Faturamento"
          value={formatCurrency(totalDescontos)}
          description="Total de descontos aplicados"
          icon={DollarSign}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Cupons & Vouchers</CardTitle>
          <CardDescription>Lista de cupons do evento</CardDescription>
        </CardHeader>
        <CardContent>
          {vouchers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Ticket className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Nenhum cupom configurado para este evento</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-center">Utilizados</TableHead>
                  <TableHead className="text-center">Limite</TableHead>
                  <TableHead>Modalidade</TableHead>
                  <TableHead className="text-right">Desconto Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vouchers.map((voucher) => (
                  <TableRow key={voucher.id}>
                    <TableCell className="font-mono font-medium">{voucher.codigo}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {voucher.tipo === "percentual" ? `${voucher.valor}%` : formatCurrency(parseFloat(voucher.valor))}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">{voucher.quantidadeUtilizada}</TableCell>
                    <TableCell className="text-center">{voucher.limiteUsos ?? "∞"}</TableCell>
                    <TableCell>{voucher.modalityName || "Todas"}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(voucher.desconto)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function OrganizerEventDashboardPage() {
  const { id: eventId } = useParams<{ id: string }>();
  const { user } = useOrganizerAuth();

  const { data: eventsData, isLoading: eventsLoading } = useQuery<{ success: boolean; data: Event[] }>({
    queryKey: ["/api/admin/events"],
  });

  const event = eventsData?.data?.find((e) => e.id === eventId);

  const { data: statsData, isLoading: statsLoading } = useQuery<{ success: boolean; data: EventStats }>({
    queryKey: [`/api/admin/events/${eventId}/stats`],
    enabled: !!eventId && !!event,
  });

  const stats = statsData?.data || null;
  const isLoading = eventsLoading || statsLoading;

  if (eventsLoading) {
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
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground" />
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

  return (
    <OrganizerLayout title={event.nome}>
      <div className="space-y-6">
        <div>
          <Link href="/organizadores">
            <Button variant="ghost" size="sm" className="mb-2">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Voltar
            </Button>
          </Link>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl md:text-2xl font-bold tracking-tight truncate">{event.nome}</h1>
              <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{event.cidade}, {event.estado} - {formatDateOnlyBrazil(event.dataEvento)}</span>
              </p>
            </div>
            <Badge variant={event.status === "ativo" ? "default" : "secondary"} className="text-sm shrink-0">
              {event.status === "ativo" ? "Ativo" : event.status}
            </Badge>
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <TabsList className="inline-flex w-auto min-w-full sm:grid sm:grid-cols-6 sm:w-full">
              <TabsTrigger value="overview" className="text-xs sm:text-sm px-3 sm:px-4">Visão Geral</TabsTrigger>
              <TabsTrigger value="modalities" className="text-xs sm:text-sm px-3 sm:px-4">Modalidades</TabsTrigger>
              <TabsTrigger value="shirts" className="text-xs sm:text-sm px-3 sm:px-4">Camisas</TabsTrigger>
              <TabsTrigger value="registrations" className="text-xs sm:text-sm px-3 sm:px-4">Inscrições</TabsTrigger>
              <TabsTrigger value="finance" className="text-xs sm:text-sm px-3 sm:px-4">Financeiro</TabsTrigger>
              <TabsTrigger value="vouchers" className="text-xs sm:text-sm px-3 sm:px-4">Cupons</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview">
            <OverviewTab event={event} stats={stats} isLoading={isLoading} />
          </TabsContent>

          <TabsContent value="modalities">
            <ModalitiesTab stats={stats} isLoading={isLoading} />
          </TabsContent>

          <TabsContent value="shirts">
            <ShirtsTab stats={stats} isLoading={isLoading} eventName={event.nome} />
          </TabsContent>

          <TabsContent value="registrations">
            <RegistrationsTab event={event} stats={stats} isLoading={isLoading} eventId={eventId!} />
          </TabsContent>

          <TabsContent value="finance">
            <FinanceTab stats={stats} isLoading={isLoading} />
          </TabsContent>

          <TabsContent value="vouchers">
            <VouchersTab eventId={eventId!} />
          </TabsContent>
        </Tabs>
      </div>
    </OrganizerLayout>
  );
}
