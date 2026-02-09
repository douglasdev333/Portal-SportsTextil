import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Plus, Pencil, Loader2, Eye, Search, X, Users, ChevronLeft, ChevronRight } from "lucide-react";
import type { Athlete, Registration } from "@shared/schema";

const BRAZILIAN_STATES = [
  { value: "AC", label: "Acre" },
  { value: "AL", label: "Alagoas" },
  { value: "AP", label: "Amapa" },
  { value: "AM", label: "Amazonas" },
  { value: "BA", label: "Bahia" },
  { value: "CE", label: "Ceara" },
  { value: "DF", label: "Distrito Federal" },
  { value: "ES", label: "Espirito Santo" },
  { value: "GO", label: "Goias" },
  { value: "MA", label: "Maranhao" },
  { value: "MT", label: "Mato Grosso" },
  { value: "MS", label: "Mato Grosso do Sul" },
  { value: "MG", label: "Minas Gerais" },
  { value: "PA", label: "Para" },
  { value: "PB", label: "Paraiba" },
  { value: "PR", label: "Parana" },
  { value: "PE", label: "Pernambuco" },
  { value: "PI", label: "Piaui" },
  { value: "RJ", label: "Rio de Janeiro" },
  { value: "RN", label: "Rio Grande do Norte" },
  { value: "RS", label: "Rio Grande do Sul" },
  { value: "RO", label: "Rondonia" },
  { value: "RR", label: "Roraima" },
  { value: "SC", label: "Santa Catarina" },
  { value: "SP", label: "Sao Paulo" },
  { value: "SE", label: "Sergipe" },
  { value: "TO", label: "Tocantins" },
];

const athleteSchema = z.object({
  cpf: z.string()
    .min(11, "CPF deve ter 11 digitos")
    .refine((val) => isValidCpf(val), { message: "CPF invalido. Verifique os digitos informados" }),
  nome: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  dataNascimento: z.string().min(1, "Data de nascimento obrigatoria"),
  sexo: z.string().min(1, "Sexo obrigatorio"),
  email: z.string().email("Email invalido"),
  telefone: z.string().min(10, "Telefone deve ter pelo menos 10 digitos"),
  estado: z.string().length(2, "Selecione um estado"),
  cidade: z.string().min(2, "Cidade obrigatoria"),
  cep: z.string().optional(),
  rua: z.string().optional(),
  numero: z.string().optional(),
  complemento: z.string().optional(),
  escolaridade: z.string().optional(),
  profissao: z.string().optional(),
});

type AthleteFormData = z.infer<typeof athleteSchema>;

interface RegistrationWithDetails extends Registration {
  eventoNome: string;
  modalidadeNome: string;
}

function formatCpf(cpf: string): string {
  const cleaned = cpf.replace(/\D/g, "");
  if (cleaned.length !== 11) return cpf;
  return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "-";
  // Parse YYYY-MM-DD directly to avoid timezone conversion issues
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${day}/${month}/${year}`;
  }
  return dateStr;
}

function formatDateTime(dateStr: string): string {
  if (!dateStr) return "-";
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "-";
    // Format to Sao Paulo timezone
    return date.toLocaleDateString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "-";
  }
}

function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 11) {
    return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  }
  if (cleaned.length === 10) {
    return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  }
  return phone;
}

function formatCep(cep: string): string {
  const cleaned = cep.replace(/\D/g, "");
  if (cleaned.length === 8) {
    return cleaned.replace(/(\d{5})(\d{3})/, "$1-$2");
  }
  return cep;
}

function formatCpfInput(value: string): string {
  const cleaned = value.replace(/\D/g, "").slice(0, 11);
  if (cleaned.length <= 3) return cleaned;
  if (cleaned.length <= 6) return `${cleaned.slice(0, 3)}.${cleaned.slice(3)}`;
  if (cleaned.length <= 9) return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6)}`;
  return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-${cleaned.slice(9)}`;
}

function formatPhoneInput(value: string): string {
  const cleaned = value.replace(/\D/g, "").slice(0, 11);
  if (cleaned.length <= 2) return cleaned;
  if (cleaned.length <= 7) return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2)}`;
  if (cleaned.length <= 10) return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
}

function formatCepInput(value: string): string {
  const cleaned = value.replace(/\D/g, "").slice(0, 8);
  if (cleaned.length <= 5) return cleaned;
  return `${cleaned.slice(0, 5)}-${cleaned.slice(5)}`;
}

function stripNonDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function isValidCpf(cpf: string): boolean {
  const cleaned = cpf.replace(/\D/g, "");
  
  if (cleaned.length !== 11) return false;
  
  // Check for known invalid CPFs (all same digits)
  if (/^(\d)\1{10}$/.test(cleaned)) return false;
  
  // Validate first verification digit
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned[i]) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleaned[9])) return false;
  
  // Validate second verification digit
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleaned[i]) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleaned[10])) return false;
  
  return true;
}

function getErrorMessage(error: Error): string {
  const message = error.message?.toLowerCase() || "";
  if (message.includes("cpf") && (message.includes("existe") || message.includes("duplicate") || message.includes("unique"))) {
    return "Já existe um atleta cadastrado com este CPF";
  }
  if (message.includes("email") && (message.includes("existe") || message.includes("duplicate") || message.includes("unique"))) {
    return "Já existe um atleta cadastrado com este email";
  }
  if (message.includes("cpf") && message.includes("invalid")) {
    return "O CPF informado é inválido";
  }
  if (message.includes("network") || message.includes("fetch")) {
    return "Erro de conexão. Verifique sua internet e tente novamente";
  }
  return error.message || "Ocorreu um erro inesperado. Tente novamente";
}

function getStatusBadge(status: string) {
  switch (status) {
    case "confirmada":
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Confirmada</Badge>;
    case "pendente":
      return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">Pendente</Badge>;
    case "cancelada":
      return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Cancelada</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

const ITEMS_PER_PAGE_OPTIONS = [10, 20, 50, 100];

export default function AdminAthletesPage() {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingAthlete, setEditingAthlete] = useState<Athlete | null>(null);
  const [viewingAthlete, setViewingAthlete] = useState<Athlete | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  const { data: athletesData, isLoading } = useQuery<{ success: boolean; data: Athlete[] }>({
    queryKey: ["/api/admin/athletes"],
  });

  const { data: registrationsData, isLoading: registrationsLoading } = useQuery<{ success: boolean; data: RegistrationWithDetails[] }>({
    queryKey: ["/api/admin/athletes", viewingAthlete?.id, "registrations"],
    enabled: !!viewingAthlete,
  });

  const athletes = athletesData?.data || [];
  const registrations = registrationsData?.data || [];

  const filteredAthletes = athletes.filter((athlete) => {
    const search = searchTerm.toLowerCase();
    return (
      athlete.nome.toLowerCase().includes(search) ||
      athlete.cpf.includes(search) ||
      athlete.email.toLowerCase().includes(search) ||
      athlete.cidade.toLowerCase().includes(search)
    );
  });

  // Paginação
  const totalPages = Math.ceil(filteredAthletes.length / itemsPerPage);
  const paginatedAthletes = filteredAthletes.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(Number(value));
    setCurrentPage(1);
  };

  const form = useForm<AthleteFormData>({
    resolver: zodResolver(athleteSchema),
    defaultValues: {
      cpf: "",
      nome: "",
      dataNascimento: "",
      sexo: "",
      email: "",
      telefone: "",
      estado: "",
      cidade: "",
      cep: "",
      rua: "",
      numero: "",
      complemento: "",
      escolaridade: "",
      profissao: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: AthleteFormData) => {
      const cleanedData = {
        ...data,
        cpf: stripNonDigits(data.cpf),
        telefone: stripNonDigits(data.telefone),
        cep: data.cep ? stripNonDigits(data.cep) : undefined,
      };
      return apiRequest("POST", "/api/admin/athletes", cleanedData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/athletes"] });
      toast({ title: "Atleta criado com sucesso", description: "O atleta foi cadastrado no sistema" });
      setIsCreateOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Não foi possível criar o atleta",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<AthleteFormData> }) => {
      const cleanedData = {
        ...data,
        cpf: data.cpf ? stripNonDigits(data.cpf) : undefined,
        telefone: data.telefone ? stripNonDigits(data.telefone) : undefined,
        cep: data.cep ? stripNonDigits(data.cep) : undefined,
      };
      return apiRequest("PATCH", `/api/admin/athletes/${id}`, cleanedData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/athletes"] });
      toast({ title: "Atleta atualizado com sucesso", description: "As alterações foram salvas" });
      setEditingAthlete(null);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Não foi possível atualizar o atleta",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });

  const handleEdit = (athlete: Athlete) => {
    form.reset({
      cpf: formatCpfInput(athlete.cpf),
      nome: athlete.nome,
      dataNascimento: athlete.dataNascimento,
      sexo: athlete.sexo,
      email: athlete.email,
      telefone: formatPhoneInput(athlete.telefone),
      estado: athlete.estado,
      cidade: athlete.cidade,
      cep: athlete.cep ? formatCepInput(athlete.cep) : "",
      rua: athlete.rua || "",
      numero: athlete.numero || "",
      complemento: athlete.complemento || "",
      escolaridade: athlete.escolaridade || "",
      profissao: athlete.profissao || "",
    });
    setEditingAthlete(athlete);
  };

  const handleView = (athlete: Athlete) => {
    setViewingAthlete(athlete);
  };

  const onSubmit = (data: AthleteFormData) => {
    if (editingAthlete) {
      updateMutation.mutate({ id: editingAthlete.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleOpenCreate = () => {
    form.reset({
      cpf: "",
      nome: "",
      dataNascimento: "",
      sexo: "",
      email: "",
      telefone: "",
      estado: "",
      cidade: "",
      cep: "",
      rua: "",
      numero: "",
      complemento: "",
      escolaridade: "",
      profissao: "",
    });
    setIsCreateOpen(true);
  };

  return (
    <AdminLayout
      title="Atletas"
      breadcrumbs={[{ label: "Atletas" }]}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Atletas</h1>
            <p className="text-muted-foreground">
              Gerencie todos os atletas cadastrados no sistema
            </p>
          </div>
          <Button onClick={handleOpenCreate} data-testid="button-create-athlete">
            <Plus className="mr-2 h-4 w-4" />
            Novo Atleta
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Lista de Atletas ({filteredAthletes.length})
              </CardTitle>
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, CPF, email ou cidade..."
                  value={searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-athlete"
                />
                {searchTerm && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                    onClick={() => handleSearchChange("")}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : filteredAthletes.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">
                {searchTerm ? "Nenhum atleta encontrado com essa busca" : "Nenhum atleta cadastrado"}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Cidade/UF</TableHead>
                      <TableHead>Nascimento</TableHead>
                      <TableHead className="text-right">Acoes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedAthletes.map((athlete) => (
                      <TableRow key={athlete.id} data-testid={`row-athlete-${athlete.id}`}>
                        <TableCell className="font-medium">{athlete.nome}</TableCell>
                        <TableCell>{formatCpf(athlete.cpf)}</TableCell>
                        <TableCell>{athlete.email}</TableCell>
                        <TableCell>{formatPhone(athlete.telefone)}</TableCell>
                        <TableCell>{athlete.cidade}/{athlete.estado}</TableCell>
                        <TableCell>{formatDate(athlete.dataNascimento)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleView(athlete)}
                              data-testid={`button-view-athlete-${athlete.id}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(athlete)}
                              data-testid={`button-edit-athlete-${athlete.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Paginação */}
            {filteredAthletes.length > 0 && (
              <div className="flex items-center justify-between pt-4 border-t mt-4 flex-wrap gap-4">
                <div className="flex items-center gap-4">
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
                  <p className="text-sm text-muted-foreground">
                    Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, filteredAthletes.length)} de {filteredAthletes.length} atletas
                  </p>
                </div>
                {totalPages > 1 && (
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
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isCreateOpen || !!editingAthlete} onOpenChange={() => {
        setIsCreateOpen(false);
        setEditingAthlete(null);
        form.reset();
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingAthlete ? "Editar Atleta" : "Novo Atleta"}</DialogTitle>
            <DialogDescription>
              {editingAthlete ? "Atualize os dados do atleta" : "Preencha os dados do novo atleta"}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="nome"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Nome Completo *</FormLabel>
                      <FormControl>
                        <Input placeholder="Nome completo" data-testid="input-athlete-nome" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="cpf"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CPF *</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="000.000.000-00" 
                          data-testid="input-athlete-cpf"
                          value={field.value}
                          onChange={(e) => field.onChange(formatCpfInput(e.target.value))}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="dataNascimento"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data de Nascimento *</FormLabel>
                      <FormControl>
                        <Input type="date" data-testid="input-athlete-dataNascimento" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="sexo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sexo *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-athlete-sexo">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="masculino">Masculino</SelectItem>
                          <SelectItem value="feminino">Feminino</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email *</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="email@exemplo.com" data-testid="input-athlete-email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="telefone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone *</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="(00) 00000-0000" 
                          data-testid="input-athlete-telefone"
                          value={field.value}
                          onChange={(e) => field.onChange(formatPhoneInput(e.target.value))}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="estado"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estado *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-athlete-estado">
                            <SelectValue placeholder="Selecione o estado" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {BRAZILIAN_STATES.map((state) => (
                            <SelectItem key={state.value} value={state.value}>
                              {state.value} - {state.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="cidade"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cidade *</FormLabel>
                      <FormControl>
                        <Input placeholder="Cidade" data-testid="input-athlete-cidade" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="cep"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CEP</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="00000-000" 
                          data-testid="input-athlete-cep"
                          value={field.value || ""}
                          onChange={(e) => field.onChange(formatCepInput(e.target.value))}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="rua"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Rua</FormLabel>
                      <FormControl>
                        <Input placeholder="Rua/Avenida" data-testid="input-athlete-rua" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="numero"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Numero</FormLabel>
                      <FormControl>
                        <Input placeholder="123" data-testid="input-athlete-numero" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="complemento"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Complemento</FormLabel>
                      <FormControl>
                        <Input placeholder="Apto, Bloco..." data-testid="input-athlete-complemento" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="escolaridade"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Escolaridade</FormLabel>
                      <FormControl>
                        <Input placeholder="Escolaridade" data-testid="input-athlete-escolaridade" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="profissao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Profissao</FormLabel>
                      <FormControl>
                        <Input placeholder="Profissao" data-testid="input-athlete-profissao" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => {
                  setIsCreateOpen(false);
                  setEditingAthlete(null);
                  form.reset();
                }}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-save-athlete">
                  {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Salvar
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingAthlete} onOpenChange={() => setViewingAthlete(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do Atleta</DialogTitle>
            <DialogDescription>
              Informacoes completas e inscricoes do atleta
            </DialogDescription>
          </DialogHeader>
          {viewingAthlete && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Nome</p>
                  <p className="font-medium">{viewingAthlete.nome}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">CPF</p>
                  <p className="font-medium">{formatCpf(viewingAthlete.cpf)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{viewingAthlete.email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Telefone</p>
                  <p className="font-medium">{formatPhone(viewingAthlete.telefone)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Data de Nascimento</p>
                  <p className="font-medium">{formatDate(viewingAthlete.dataNascimento)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Sexo</p>
                  <p className="font-medium capitalize">{viewingAthlete.sexo}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Cidade/UF</p>
                  <p className="font-medium">{viewingAthlete.cidade}/{viewingAthlete.estado}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">CEP</p>
                  <p className="font-medium">{viewingAthlete.cep || "-"}</p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-sm text-muted-foreground">Endereco</p>
                  <p className="font-medium">
                    {viewingAthlete.rua ? `${viewingAthlete.rua}, ${viewingAthlete.numero || "S/N"}` : "-"}
                    {viewingAthlete.complemento && ` - ${viewingAthlete.complemento}`}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Escolaridade</p>
                  <p className="font-medium">{viewingAthlete.escolaridade || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Profissao</p>
                  <p className="font-medium">{viewingAthlete.profissao || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Data de Cadastro</p>
                  <p className="font-medium">{formatDateTime(viewingAthlete.dataCadastro?.toString() || "")}</p>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-4">Inscricoes do Atleta</h3>
                {registrationsLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : registrations.length === 0 ? (
                  <p className="text-center py-4 text-muted-foreground">
                    Nenhuma inscricao encontrada
                  </p>
                ) : (
                  <ScrollArea className="h-[200px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Inscricao</TableHead>
                          <TableHead>Evento</TableHead>
                          <TableHead>Modalidade</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Data</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {registrations.map((reg) => (
                          <TableRow key={reg.id}>
                            <TableCell>#{reg.numeroInscricao}</TableCell>
                            <TableCell>{reg.eventoNome}</TableCell>
                            <TableCell>{reg.modalidadeNome}</TableCell>
                            <TableCell>{getStatusBadge(reg.status)}</TableCell>
                            <TableCell>{formatDateTime(reg.dataInscricao?.toString() || "")}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingAthlete(null)}>
              Fechar
            </Button>
            <Button onClick={() => {
              if (viewingAthlete) {
                setViewingAthlete(null);
                handleEdit(viewingAthlete);
              }
            }}>
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
