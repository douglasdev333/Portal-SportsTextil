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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { Plus, Pencil, Trash2, Loader2, UserCog } from "lucide-react";
import type { AdminUser, Organizer } from "@shared/schema";

const createUserSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  nome: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  role: z.enum(["superadmin", "admin", "organizador"]),
  organizerId: z.string().optional(),
}).refine((data) => {
  if (data.role === "organizador" && !data.organizerId) {
    return false;
  }
  return true;
}, {
  message: "Organizador deve estar vinculado a um organizador",
  path: ["organizerId"],
});

const updateUserSchema = z.object({
  email: z.string().email("Email inválido"),
  nome: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  role: z.enum(["superadmin", "admin", "organizador"]),
  status: z.enum(["ativo", "inativo", "bloqueado"]),
  organizerId: z.string().optional().nullable(),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres").optional().or(z.literal("")),
}).refine((data) => {
  if (data.role === "organizador" && !data.organizerId) {
    return false;
  }
  return true;
}, {
  message: "Organizador deve estar vinculado a um organizador",
  path: ["organizerId"],
});

type CreateUserFormData = z.infer<typeof createUserSchema>;
type UpdateUserFormData = z.infer<typeof updateUserSchema>;

function getRoleBadge(role: string) {
  switch (role) {
    case "superadmin":
      return <Badge variant="default">Super Admin</Badge>;
    case "admin":
      return <Badge variant="secondary">Admin</Badge>;
    case "organizador":
      return <Badge variant="outline">Organizador</Badge>;
    default:
      return <Badge variant="outline">{role}</Badge>;
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case "ativo":
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Ativo</Badge>;
    case "inativo":
      return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">Inativo</Badge>;
    case "bloqueado":
      return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Bloqueado</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default function AdminUsersPage() {
  const { toast } = useToast();
  const { user: currentUser } = useAdminAuth();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [deletingUser, setDeletingUser] = useState<AdminUser | null>(null);

  const { data: usersData, isLoading: usersLoading } = useQuery<{ success: boolean; data: AdminUser[] }>({
    queryKey: ["/api/admin/users"],
  });

  const { data: organizersData } = useQuery<{ success: boolean; data: Organizer[] }>({
    queryKey: ["/api/admin/organizers"],
  });

  const users = usersData?.data || [];
  const organizers = organizersData?.data || [];

  const createForm = useForm<CreateUserFormData>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      email: "",
      password: "",
      nome: "",
      role: "admin",
      organizerId: "",
    },
  });

  const editForm = useForm<UpdateUserFormData>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: {
      email: "",
      nome: "",
      role: "admin",
      status: "ativo",
      organizerId: "",
      password: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateUserFormData) => {
      const payload: Record<string, unknown> = { ...data };
      if (!data.organizerId) {
        delete payload.organizerId;
      }
      return apiRequest("POST", "/api/admin/users", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Usuário criado com sucesso" });
      setIsCreateOpen(false);
      createForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar usuário",
        description: error.message || "Tente novamente",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateUserFormData }) => {
      const payload: Record<string, unknown> = { ...data };
      if (!data.organizerId) {
        delete payload.organizerId;
      }
      if (!data.password) {
        delete payload.password;
      }
      return apiRequest("PATCH", `/api/admin/users/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Usuário atualizado com sucesso" });
      setEditingUser(null);
      editForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar usuário",
        description: error.message || "Tente novamente",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/admin/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Usuário excluído com sucesso" });
      setDeletingUser(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao excluir usuário",
        description: error.message || "Tente novamente",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (user: AdminUser) => {
    editForm.reset({
      email: user.email,
      nome: user.nome,
      role: user.role as "superadmin" | "admin" | "organizador",
      status: user.status as "ativo" | "inativo" | "bloqueado",
      organizerId: user.organizerId || "",
      password: "",
    });
    setEditingUser(user);
  };

  const onCreateSubmit = (data: CreateUserFormData) => {
    createMutation.mutate(data);
  };

  const onEditSubmit = (data: UpdateUserFormData) => {
    if (editingUser) {
      updateMutation.mutate({ id: editingUser.id, data });
    }
  };

  const watchCreateRole = createForm.watch("role");
  const watchEditRole = editForm.watch("role");

  if (currentUser?.role !== "superadmin") {
    return (
      <AdminLayout 
        title="Usuários" 
        breadcrumbs={[{ label: "Usuários" }]}
      >
        <div className="flex flex-col items-center justify-center py-12">
          <UserCog className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Acesso Restrito</h2>
          <p className="text-muted-foreground text-center">
            Apenas superadmins podem gerenciar usuários do sistema.
          </p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout 
      title="Usuários" 
      breadcrumbs={[{ label: "Usuários" }]}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Usuários</h1>
            <p className="text-muted-foreground">
              Gerencie os usuários administrativos do sistema
            </p>
          </div>
          <Button onClick={() => setIsCreateOpen(true)} data-testid="button-create-user">
            <Plus className="mr-2 h-4 w-4" />
            Novo Usuário
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Lista de Usuários</CardTitle>
          </CardHeader>
          <CardContent>
            {usersLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : users.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">
                Nenhum usuário cadastrado
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Perfil</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Organizador</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => {
                    const organizer = organizers.find(o => o.id === user.organizerId);
                    const isSuperadmin = user.role === "superadmin";
                    const isCurrentUser = user.id === currentUser?.id;
                    
                    return (
                      <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                        <TableCell className="font-medium">{user.nome}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>{getRoleBadge(user.role)}</TableCell>
                        <TableCell>{getStatusBadge(user.status)}</TableCell>
                        <TableCell>
                          {organizer?.nome || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(user)}
                              data-testid={`button-edit-user-${user.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {!isCurrentUser && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeletingUser(user)}
                                data-testid={`button-delete-user-${user.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Usuário</DialogTitle>
            <DialogDescription>
              Preencha os dados do novo usuário administrativo
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
                      <Input placeholder="Nome completo" data-testid="input-user-nome" {...field} />
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
                      <Input type="email" placeholder="email@exemplo.com" data-testid="input-user-email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Senha</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Minimo 6 caracteres" data-testid="input-user-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Perfil</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-user-role">
                          <SelectValue placeholder="Selecione o perfil" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="superadmin">Super Admin</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="organizador">Organizador</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {watchCreateRole === "organizador" && (
                <FormField
                  control={createForm.control}
                  name="organizerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Organizador Vinculado</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger data-testid="select-user-organizer">
                            <SelectValue placeholder="Selecione o organizador" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {organizers.map((org) => (
                            <SelectItem key={org.id} value={org.id}>
                              {org.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending} data-testid="button-save-user">
                  {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Salvar
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>
              Atualize os dados do usuário
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
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nova Senha (opcional)</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Deixe vazio para manter a senha atual" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Perfil</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o perfil" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="superadmin">Super Admin</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="organizador">Organizador</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="ativo">Ativo</SelectItem>
                        <SelectItem value="inativo">Inativo</SelectItem>
                        <SelectItem value="bloqueado">Bloqueado</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {watchEditRole === "organizador" && (
                <FormField
                  control={editForm.control}
                  name="organizerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Organizador Vinculado</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o organizador" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {organizers.map((org) => (
                            <SelectItem key={org.id} value={org.id}>
                              {org.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingUser(null)}>
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

      <AlertDialog open={!!deletingUser} onOpenChange={() => setDeletingUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o usuário "{deletingUser?.nome}"?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingUser && deleteMutation.mutate(deletingUser.id)}
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-delete-user"
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
