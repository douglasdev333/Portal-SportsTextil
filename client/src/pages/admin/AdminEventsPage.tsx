import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search, MoreHorizontal, Pencil, Users, Settings, ShoppingCart, Ticket } from "lucide-react";
import { formatDateOnlyBrazil } from "@/lib/timezone";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Event } from "@shared/schema";

const statusColors: Record<string, string> = {
  rascunho: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  publicado: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  cancelado: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  finalizado: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  esgotado: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
};

const statusLabels: Record<string, string> = {
  rascunho: "Rascunho",
  publicado: "Publicado",
  cancelado: "Cancelado",
  finalizado: "Finalizado",
  esgotado: "Esgotado",
};

export default function AdminEventsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const { toast } = useToast();

  const { data, isLoading } = useQuery<{ success: boolean; data: Event[] }>({
    queryKey: ["/api/admin/events"],
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ eventId, status }: { eventId: string; status: string }) => {
      return apiRequest("PATCH", `/api/admin/events/${eventId}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/events"] });
      toast({
        title: "Status atualizado",
        description: "O status do evento foi alterado com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar status",
        description: error?.message || "Não foi possível alterar o status do evento.",
        variant: "destructive",
      });
    },
  });

  const events = data?.data || [];

  const filteredEvents = events.filter((event) => {
    const matchesSearch = event.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.cidade.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "todos" || event.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleStatusChange = (eventId: string, newStatus: string) => {
    updateStatusMutation.mutate({ eventId, status: newStatus });
  };

  return (
    <AdminLayout 
      title="Eventos" 
      breadcrumbs={[{ label: "Eventos" }]}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Eventos</h1>
            <p className="text-muted-foreground">
              Gerencie os eventos do sistema
            </p>
          </div>
          <Link href="/admin/eventos/novo">
            <Button data-testid="button-create-event">
              <Plus className="mr-2 h-4 w-4" />
              Novo Evento
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou cidade..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-events"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
                  <SelectValue placeholder="Filtrar por status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os status</SelectItem>
                  <SelectItem value="rascunho">Rascunho</SelectItem>
                  <SelectItem value="publicado">Publicado</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                  <SelectItem value="finalizado">Finalizado</SelectItem>
                  <SelectItem value="esgotado">Esgotado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : filteredEvents.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">
                {events.length === 0 
                  ? "Nenhum evento cadastrado" 
                  : "Nenhum evento encontrado com os filtros aplicados"}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Local</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Vagas</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEvents.map((event) => (
                    <TableRow key={event.id} data-testid={`row-event-${event.id}`}>
                      <TableCell className="font-medium">
                        <Link href={`/admin/eventos/${event.id}/gerenciar`}>
                          <span className="hover:underline cursor-pointer text-[#1f2025]" data-testid={`link-event-name-${event.id}`}>
                            {event.nome}
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell>{event.cidade}, {event.estado}</TableCell>
                      <TableCell>
                        {formatDateOnlyBrazil(event.dataEvento)}
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{event.vagasOcupadas}</span>
                        <span className="text-muted-foreground">/{event.limiteVagasTotal}</span>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={event.status}
                          onValueChange={(value) => handleStatusChange(event.id, value)}
                          disabled={updateStatusMutation.isPending}
                        >
                          <SelectTrigger 
                            className="w-[130px] h-8 border-0 bg-transparent p-0"
                            data-testid={`select-status-${event.id}`}
                          >
                            <Badge 
                              variant="secondary" 
                              className={statusColors[event.status]}
                            >
                              {statusLabels[event.status]}
                            </Badge>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="rascunho">
                              <Badge variant="secondary" className={statusColors.rascunho}>
                                Rascunho
                              </Badge>
                            </SelectItem>
                            <SelectItem value="publicado">
                              <Badge variant="secondary" className={statusColors.publicado}>
                                Publicado
                              </Badge>
                            </SelectItem>
                            <SelectItem value="cancelado">
                              <Badge variant="secondary" className={statusColors.cancelado}>
                                Cancelado
                              </Badge>
                            </SelectItem>
                            <SelectItem value="finalizado">
                              <Badge variant="secondary" className={statusColors.finalizado}>
                                Finalizado
                              </Badge>
                            </SelectItem>
                            <SelectItem value="esgotado">
                              <Badge variant="secondary" className={statusColors.esgotado}>
                                Esgotado
                              </Badge>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link href={`/admin/eventos/${event.id}/gerenciar`}>
                            <Button
                              variant="ghost"
                              size="icon"
                              data-testid={`button-settings-${event.id}`}
                            >
                              <Settings className="h-4 w-4" />
                            </Button>
                          </Link>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                data-testid={`button-actions-${event.id}`}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <Link href={`/admin/eventos/${event.id}`}>
                                <DropdownMenuItem data-testid={`menu-edit-${event.id}`}>
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Editar
                                </DropdownMenuItem>
                              </Link>
                              <Link href={`/admin/eventos/${event.id}/inscritos`}>
                                <DropdownMenuItem data-testid={`menu-inscritos-${event.id}`}>
                                  <Users className="mr-2 h-4 w-4" />
                                  Inscritos
                                </DropdownMenuItem>
                              </Link>
                              <Link href={`/admin/eventos/${event.id}/pedidos`}>
                                <DropdownMenuItem data-testid={`menu-pedidos-${event.id}`}>
                                  <ShoppingCart className="mr-2 h-4 w-4" />
                                  Pedidos
                                </DropdownMenuItem>
                              </Link>
                              <Link href={`/admin/eventos/${event.id}/vouchers`}>
                                <DropdownMenuItem data-testid={`menu-cupons-${event.id}`}>
                                  <Ticket className="mr-2 h-4 w-4" />
                                  Cupons
                                </DropdownMenuItem>
                              </Link>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
