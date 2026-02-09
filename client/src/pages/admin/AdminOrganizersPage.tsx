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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import type { Organizer } from "@shared/schema";

const organizerSchema = z.object({
  nome: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("Email inválido"),
  telefone: z.string().min(10, "Telefone inválido"),
  documentType: z.enum(["cpf", "cnpj"]),
  cpfCnpj: z.string().min(11, "Documento inválido"),
});

type OrganizerFormData = z.infer<typeof organizerSchema>;

function formatCpfCnpj(value: string, type: "cpf" | "cnpj") {
  const digits = value.replace(/\D/g, "");
  if (type === "cpf") {
    return digits
      .slice(0, 11)
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return digits
    .slice(0, 14)
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 10) {
    return digits
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }
  return digits
    .slice(0, 11)
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
}

export default function AdminOrganizersPage() {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingOrganizer, setEditingOrganizer] = useState<Organizer | null>(null);
  const [deletingOrganizer, setDeletingOrganizer] = useState<Organizer | null>(null);

  const { data, isLoading } = useQuery<{ success: boolean; data: Organizer[] }>({
    queryKey: ["/api/admin/organizers"],
  });

  const organizers = data?.data || [];

  const createForm = useForm<OrganizerFormData>({
    resolver: zodResolver(organizerSchema),
    defaultValues: {
      nome: "",
      email: "",
      telefone: "",
      documentType: "cpf",
      cpfCnpj: "",
    },
  });

  const editForm = useForm<OrganizerFormData>({
    resolver: zodResolver(organizerSchema),
    defaultValues: {
      nome: "",
      email: "",
      telefone: "",
      documentType: "cpf",
      cpfCnpj: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: OrganizerFormData) => {
      const { documentType, ...rest } = data;
      return apiRequest("POST", "/api/admin/organizers", rest);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/organizers"] });
      toast({ title: "Organizador criado com sucesso" });
      setIsCreateOpen(false);
      createForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar organizador",
        description: error.message || "Tente novamente",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: OrganizerFormData }) => {
      const { documentType, ...rest } = data;
      return apiRequest("PATCH", `/api/admin/organizers/${id}`, rest);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/organizers"] });
      toast({ title: "Organizador atualizado com sucesso" });
      setEditingOrganizer(null);
      editForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar organizador",
        description: error.message || "Tente novamente",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/admin/organizers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/organizers"] });
      toast({ title: "Organizador excluído com sucesso" });
      setDeletingOrganizer(null);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir organizador",
        description: error.message || "Tente novamente",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (organizer: Organizer) => {
    const isCnpj = organizer.cpfCnpj.replace(/\D/g, "").length > 11;
    editForm.reset({
      nome: organizer.nome,
      email: organizer.email,
      telefone: organizer.telefone,
      documentType: isCnpj ? "cnpj" : "cpf",
      cpfCnpj: organizer.cpfCnpj,
    });
    setEditingOrganizer(organizer);
  };

  const onCreateSubmit = (data: OrganizerFormData) => {
    createMutation.mutate(data);
  };

  const onEditSubmit = (data: OrganizerFormData) => {
    if (editingOrganizer) {
      updateMutation.mutate({ id: editingOrganizer.id, data });
    }
  };

  const watchCreateDocType = createForm.watch("documentType");
  const watchEditDocType = editForm.watch("documentType");

  return (
    <AdminLayout 
      title="Organizadores" 
      breadcrumbs={[{ label: "Organizadores" }]}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Organizadores</h1>
            <p className="text-muted-foreground">
              Gerencie os organizadores de eventos
            </p>
          </div>
          <Button onClick={() => setIsCreateOpen(true)} data-testid="button-create-organizer">
            <Plus className="mr-2 h-4 w-4" />
            Novo Organizador
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Lista de Organizadores</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : organizers.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">
                Nenhum organizador cadastrado
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>CPF/CNPJ</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {organizers.map((org) => (
                    <TableRow key={org.id} data-testid={`row-organizer-${org.id}`}>
                      <TableCell className="font-medium">{org.nome}</TableCell>
                      <TableCell>{org.email}</TableCell>
                      <TableCell>{org.cpfCnpj}</TableCell>
                      <TableCell>{org.telefone}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(org)}
                            data-testid={`button-edit-${org.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeletingOrganizer(org)}
                            data-testid={`button-delete-${org.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
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
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Organizador</DialogTitle>
            <DialogDescription>
              Preencha os dados do novo organizador
            </DialogDescription>
          </DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
              <FormField
                control={createForm.control}
                name="nome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome completo" data-testid="input-nome" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="email@exemplo.com" data-testid="input-email-org" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="telefone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="(11) 99999-9999"
                        data-testid="input-telefone"
                        {...field}
                        onChange={(e) => field.onChange(formatPhone(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="documentType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Documento</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="flex gap-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="cpf" id="cpf" data-testid="radio-cpf" />
                          <label htmlFor="cpf">CPF</label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="cnpj" id="cnpj" data-testid="radio-cnpj" />
                          <label htmlFor="cnpj">CNPJ</label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="cpfCnpj"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{watchCreateDocType === "cpf" ? "CPF" : "CNPJ"}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={watchCreateDocType === "cpf" ? "000.000.000-00" : "00.000.000/0000-00"}
                        data-testid="input-cpfcnpj"
                        {...field}
                        onChange={(e) => field.onChange(formatCpfCnpj(e.target.value, watchCreateDocType))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending} data-testid="button-save-organizer">
                  {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Salvar
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingOrganizer} onOpenChange={() => setEditingOrganizer(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Organizador</DialogTitle>
            <DialogDescription>
              Atualize os dados do organizador
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="nome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome completo" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="email@exemplo.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="telefone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="(11) 99999-9999"
                        {...field}
                        onChange={(e) => field.onChange(formatPhone(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="documentType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Documento</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        value={field.value}
                        className="flex gap-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="cpf" id="edit-cpf" />
                          <label htmlFor="edit-cpf">CPF</label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="cnpj" id="edit-cnpj" />
                          <label htmlFor="edit-cnpj">CNPJ</label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="cpfCnpj"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{watchEditDocType === "cpf" ? "CPF" : "CNPJ"}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={watchEditDocType === "cpf" ? "000.000.000-00" : "00.000.000/0000-00"}
                        {...field}
                        onChange={(e) => field.onChange(formatCpfCnpj(e.target.value, watchEditDocType))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingOrganizer(null)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Salvar
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingOrganizer} onOpenChange={() => setDeletingOrganizer(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o organizador "{deletingOrganizer?.nome}"?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingOrganizer && deleteMutation.mutate(deletingOrganizer.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
