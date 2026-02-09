import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Plus, Pencil, Trash2, Info, MoreHorizontal, Play, XCircle, Clock, Eye, EyeOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatTimestampAsDateBrazil } from "@/lib/timezone";
import type { EventFormData } from "../EventWizard";
import type { RegistrationBatch } from "@shared/schema";

interface EventBatchesStepProps {
  formData: EventFormData;
  updateFormData: (updates: Partial<EventFormData>) => void;
}

type BatchStatus = "active" | "closed" | "future";

interface BatchWithStatus extends Partial<RegistrationBatch> {
  status?: BatchStatus;
}

const emptyBatch: BatchWithStatus = {
  nome: "",
  dataInicio: undefined,
  dataTermino: undefined,
  quantidadeMaxima: undefined,
  quantidadeUtilizada: 0,
  ativo: true,
  status: "future",
  ordem: 0,
};

function getBatchStatusLabel(status: BatchStatus): string {
  switch (status) {
    case "active": return "Ativo";
    case "closed": return "Fechado";
    case "future": return "Futuro";
    default: return "Desconhecido";
  }
}

function getBatchStatusVariant(status: BatchStatus): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "active": return "default";
    case "closed": return "destructive";
    case "future": return "secondary";
    default: return "outline";
  }
}

function isBatchExpired(batch: BatchWithStatus): boolean {
  if (!batch.dataTermino) return false;
  const endDate = typeof batch.dataTermino === 'string' 
    ? new Date(batch.dataTermino) 
    : batch.dataTermino;
  return endDate < new Date();
}

function isBatchFull(batch: BatchWithStatus): boolean {
  if (!batch.quantidadeMaxima) return false;
  return (batch.quantidadeUtilizada ?? 0) >= batch.quantidadeMaxima;
}

export function EventBatchesStep({ formData, updateFormData }: EventBatchesStepProps) {
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [editingBatchIndex, setEditingBatchIndex] = useState<number | null>(null);
  const [currentBatch, setCurrentBatch] = useState<BatchWithStatus>(emptyBatch);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ type: string; index: number } | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);

  const sortedBatches = [...formData.batches].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));

  const openNewBatchDialog = () => {
    const maxOrdem = formData.batches.length > 0 
      ? Math.max(...formData.batches.map(b => b.ordem ?? 0)) 
      : 0;
    setCurrentBatch({ 
      ...emptyBatch, 
      ordem: maxOrdem + 1,
      status: "future",
      ativo: true
    });
    setEditingBatchIndex(null);
    setOrderError(null);
    setBatchDialogOpen(true);
  };

  const openEditBatchDialog = (index: number) => {
    const batch = formData.batches[index];
    setCurrentBatch({ 
      ...batch,
      status: batch.status || "future"
    });
    setEditingBatchIndex(index);
    setOrderError(null);
    setBatchDialogOpen(true);
  };

  const validateOrderIndex = (ordem: number, excludeIndex: number | null): boolean => {
    const isDuplicate = formData.batches.some((batch, idx) => 
      idx !== excludeIndex && batch.ordem === ordem
    );
    if (isDuplicate) {
      setOrderError("Já existe um lote com essa ordem. Use um número diferente.");
      return false;
    }
    setOrderError(null);
    return true;
  };

  const hasValidTime = (dateStr: string | Date | null | undefined): boolean => {
    if (!dateStr) return false;
    const str = typeof dateStr === 'string' ? dateStr : dateStr.toISOString();
    const match = str.match(/T(\d{2}):(\d{2})/);
    return !!match;
  };

  const [dateError, setDateError] = useState<string | null>(null);

  const handleSaveBatch = () => {
    if (!currentBatch.ordem || currentBatch.ordem < 1) {
      setOrderError("A ordem deve ser um numero inteiro maior ou igual a 1.");
      return;
    }

    if (!hasValidTime(currentBatch.dataInicio)) {
      setDateError("Informe a data e horario de inicio do lote.");
      return;
    }
    
    if (currentBatch.dataTermino && !hasValidTime(currentBatch.dataTermino)) {
      setDateError("Informe o horario de termino do lote.");
      return;
    }
    
    setDateError(null);

    if (!validateOrderIndex(currentBatch.ordem, editingBatchIndex)) {
      return;
    }

    const newBatches = [...formData.batches];
    
    if (editingBatchIndex !== null) {
      newBatches[editingBatchIndex] = {
        ...newBatches[editingBatchIndex],
        nome: currentBatch.nome,
        dataInicio: currentBatch.dataInicio,
        dataTermino: currentBatch.dataTermino,
        quantidadeMaxima: currentBatch.quantidadeMaxima,
        ordem: currentBatch.ordem,
      };
    } else {
      newBatches.push({
        ...currentBatch,
        status: "future",
        ativo: true,
      });
    }
    
    updateFormData({ batches: newBatches });
    setBatchDialogOpen(false);
  };

  const handleActivateBatch = (index: number, closeOthers: boolean = false) => {
    const activeBatchIndex = formData.batches.findIndex(
      (b, idx) => b.status === "active" && idx !== index
    );

    if (activeBatchIndex >= 0 && !closeOthers) {
      setConfirmAction({ type: "activate", index });
      setConfirmDialogOpen(true);
      return;
    }

    const newBatches = formData.batches.map((batch, idx) => {
      if (idx === index) {
        return { ...batch, status: "active" as BatchStatus, ativo: true };
      }
      if (closeOthers && batch.status === "active") {
        return { ...batch, status: "closed" as BatchStatus };
      }
      return batch;
    });

    updateFormData({ batches: newBatches });
    setConfirmDialogOpen(false);
    setConfirmAction(null);
  };

  const handleCloseBatch = (index: number) => {
    const newBatches = formData.batches.map((batch, idx) => {
      if (idx === index) {
        return { ...batch, status: "closed" as BatchStatus };
      }
      return batch;
    });
    updateFormData({ batches: newBatches });
  };

  const handleSetFuture = (index: number) => {
    const batch = formData.batches[index];
    if (batch.status === "active") {
      setConfirmAction({ type: "setFuture", index });
      setConfirmDialogOpen(true);
      return;
    }

    const newBatches = formData.batches.map((b, idx) => {
      if (idx === index) {
        return { ...b, status: "future" as BatchStatus };
      }
      return b;
    });
    updateFormData({ batches: newBatches });
  };

  const handleToggleVisibility = (index: number) => {
    const newBatches = formData.batches.map((batch, idx) => {
      if (idx === index) {
        return { ...batch, ativo: !batch.ativo };
      }
      return batch;
    });
    updateFormData({ batches: newBatches });
  };

  const handleDeleteBatch = (index: number) => {
    const batch = formData.batches[index];
    if ((batch.quantidadeUtilizada ?? 0) > 0) {
      return;
    }
    
    const newBatches = formData.batches.filter((_, i) => i !== index);
    const newPrices = formData.prices.filter(p => p.batchIndex !== index)
      .map(p => ({
        ...p,
        batchIndex: p.batchIndex > index ? p.batchIndex - 1 : p.batchIndex
      }));
    updateFormData({ batches: newBatches, prices: newPrices });
  };

  const updateCurrentBatch = (field: string, value: any) => {
    if (field === "ordem") {
      setOrderError(null);
    }
    setCurrentBatch(prev => ({ ...prev, [field]: value }));
  };

  const getPrice = (modalityIndex: number, batchIndex: number): string => {
    const price = formData.prices.find(
      p => p.modalityIndex === modalityIndex && p.batchIndex === batchIndex
    );
    return price?.valor || "";
  };

  const setPrice = (modalityIndex: number, batchIndex: number, valor: string) => {
    const existingIndex = formData.prices.findIndex(
      p => p.modalityIndex === modalityIndex && p.batchIndex === batchIndex
    );
    
    const newPrices = [...formData.prices];
    if (existingIndex >= 0) {
      if (valor) {
        newPrices[existingIndex] = { modalityIndex, batchIndex, valor };
      } else {
        newPrices.splice(existingIndex, 1);
      }
    } else if (valor) {
      newPrices.push({ modalityIndex, batchIndex, valor });
    }
    
    updateFormData({ prices: newPrices });
  };

  const getOriginalIndex = (batch: BatchWithStatus): number => {
    return formData.batches.findIndex(b => b === batch);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <div>
            <CardTitle>Lotes de Inscricao</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Configure os periodos de inscricao e seus limites. Use os botoes de acao para gerenciar o status de cada lote.
            </p>
          </div>
          <Button size="sm" onClick={openNewBatchDialog} data-testid="button-add-batch">
            <Plus className="mr-2 h-4 w-4" />
            Adicionar Lote
          </Button>
        </CardHeader>
        <CardContent>
          {formData.batches.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">Nenhum lote cadastrado</p>
              <Button variant="outline" onClick={openNewBatchDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Adicionar primeiro lote
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {sortedBatches.map((batch) => {
                const originalIndex = getOriginalIndex(batch);
                const status = (batch.status || "future") as BatchStatus;
                const isExpired = isBatchExpired(batch);
                const isFull = isBatchFull(batch);
                
                return (
                  <div
                    key={originalIndex}
                    className="flex items-center justify-between p-3 rounded-lg border"
                    data-testid={`card-batch-${originalIndex}`}
                  >
                    <div className="flex items-center gap-3 flex-wrap">
                      <Badge variant="outline" className="text-xs font-mono">
                        #{batch.ordem ?? originalIndex + 1}
                      </Badge>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{batch.nome}</span>
                          <Badge variant={getBatchStatusVariant(status)}>
                            {getBatchStatusLabel(status)}
                          </Badge>
                          {batch.ativo ? (
                            <Badge variant="outline" className="text-xs">
                              <Eye className="h-3 w-3 mr-1" />
                              Visivel
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-muted-foreground">
                              <EyeOff className="h-3 w-3 mr-1" />
                              Oculto
                            </Badge>
                          )}
                          {isFull && (
                            <Badge variant="destructive" className="text-xs">
                              Lotado
                            </Badge>
                          )}
                          {isExpired && (
                            <Badge variant="secondary" className="text-xs">
                              Expirado
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {batch.dataInicio ? formatTimestampAsDateBrazil(batch.dataInicio) : ""} 
                          {batch.dataTermino ? ` - ${formatTimestampAsDateBrazil(batch.dataTermino)}` : ""}
                          {batch.quantidadeMaxima ? ` | Vagas: ${batch.quantidadeUtilizada ?? 0}/${batch.quantidadeMaxima}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            data-testid={`button-batch-actions-${originalIndex}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {status !== "active" && (
                            <DropdownMenuItem 
                              onClick={() => handleActivateBatch(originalIndex)}
                              data-testid={`button-activate-batch-${originalIndex}`}
                            >
                              <Play className="h-4 w-4 mr-2" />
                              Ativar Lote
                            </DropdownMenuItem>
                          )}
                          {status === "active" && (
                            <DropdownMenuItem 
                              onClick={() => handleCloseBatch(originalIndex)}
                              data-testid={`button-close-batch-${originalIndex}`}
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Fechar Lote
                            </DropdownMenuItem>
                          )}
                          {status === "closed" && (
                            <DropdownMenuItem 
                              onClick={() => handleSetFuture(originalIndex)}
                              data-testid={`button-future-batch-${originalIndex}`}
                            >
                              <Clock className="h-4 w-4 mr-2" />
                              Marcar como Futuro
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => handleToggleVisibility(originalIndex)}
                            data-testid={`button-visibility-batch-${originalIndex}`}
                          >
                            {batch.ativo ? (
                              <>
                                <EyeOff className="h-4 w-4 mr-2" />
                                Ocultar para Atletas
                              </>
                            ) : (
                              <>
                                <Eye className="h-4 w-4 mr-2" />
                                Tornar Visivel
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => openEditBatchDialog(originalIndex)}
                            data-testid={`button-edit-batch-${originalIndex}`}
                          >
                            <Pencil className="h-4 w-4 mr-2" />
                            Editar Configuracao
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDeleteBatch(originalIndex)}
                            disabled={(batch.quantidadeUtilizada ?? 0) > 0}
                            className="text-destructive"
                            data-testid={`button-delete-batch-${originalIndex}`}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir Lote
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {formData.modalities.length > 0 && formData.batches.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Tabela de Precos</CardTitle>
            <p className="text-sm text-muted-foreground">
              Defina o valor de cada modalidade por lote
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[150px]">Modalidade</TableHead>
                    {formData.batches.map((batch, index) => (
                      <TableHead key={index} className="min-w-[120px]">
                        {batch.nome}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {formData.modalities.map((modality, modalityIndex) => {
                    const isGratuita = modality.tipoAcesso === "gratuita";
                    return (
                      <TableRow key={modalityIndex}>
                        <TableCell className="font-medium">
                          {modality.nome}
                          <span className="text-muted-foreground text-sm block">
                            {modality.distancia} {modality.unidadeDistancia}
                          </span>
                        </TableCell>
                        {formData.batches.map((_, batchIndex) => (
                          <TableCell key={batchIndex}>
                            {isGratuita ? (
                              <Badge variant="secondary" className="text-xs">
                                Gratuita
                              </Badge>
                            ) : (
                              <div className="flex items-center gap-1">
                                <span className="text-muted-foreground">R$</span>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={getPrice(modalityIndex, batchIndex)}
                                  onChange={(e) => setPrice(modalityIndex, batchIndex, e.target.value)}
                                  className="w-24"
                                  placeholder="0.00"
                                  data-testid={`input-price-${modalityIndex}-${batchIndex}`}
                                />
                              </div>
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={batchDialogOpen} onOpenChange={setBatchDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingBatchIndex !== null ? "Editar Configuracao do Lote" : "Novo Lote"}
            </DialogTitle>
          </DialogHeader>

          {(formData.event.aberturaInscricoes || formData.event.encerramentoInscricoes) && (
            <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-md text-sm">
              <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="text-muted-foreground">
                <span className="font-medium text-foreground">Periodo de inscricoes do evento:</span>
                <br />
                {formData.event.aberturaInscricoes && (
                  <span>Inicio: {formatTimestampAsDateBrazil(formData.event.aberturaInscricoes)}</span>
                )}
                {formData.event.aberturaInscricoes && formData.event.encerramentoInscricoes && " | "}
                {formData.event.encerramentoInscricoes && (
                  <span>Termino: {formatTimestampAsDateBrazil(formData.event.encerramentoInscricoes)}</span>
                )}
              </div>
            </div>
          )}

          {editingBatchIndex !== null && (
            <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-md text-sm">
              <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
              <div className="text-blue-700 dark:text-blue-300">
                <span className="font-medium">Nota:</span> O status do lote (Ativo/Fechado/Futuro) e a visibilidade sao gerenciados atraves dos botoes de acao na listagem, nao neste formulario.
              </div>
            </div>
          )}

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="batch-nome">Nome do Lote *</Label>
              <Input
                id="batch-nome"
                value={currentBatch.nome || ""}
                onChange={(e) => updateCurrentBatch("nome", e.target.value)}
                placeholder="Ex: 1o Lote, Lote Promocional"
                data-testid="input-batch-name"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="batch-inicio">Data e Horario de Inicio *</Label>
                <Input
                  id="batch-inicio"
                  type="datetime-local"
                  value={typeof currentBatch.dataInicio === 'string' 
                    ? currentBatch.dataInicio 
                    : currentBatch.dataInicio 
                      ? currentBatch.dataInicio.toISOString().slice(0, 16)
                      : ""}
                  onChange={(e) => { updateCurrentBatch("dataInicio", e.target.value); setDateError(null); }}
                  data-testid="input-batch-start"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="batch-termino">Data e Horario de Termino</Label>
                <Input
                  id="batch-termino"
                  type="datetime-local"
                  value={typeof currentBatch.dataTermino === 'string' 
                    ? currentBatch.dataTermino 
                    : currentBatch.dataTermino 
                      ? currentBatch.dataTermino.toISOString().slice(0, 16)
                      : ""}
                  onChange={(e) => { updateCurrentBatch("dataTermino", e.target.value || undefined); setDateError(null); }}
                  data-testid="input-batch-end"
                />
              </div>
            </div>
            
            {dateError && (
              <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                {dateError}
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="batch-quantidade">Quantidade Maxima</Label>
                <Input
                  id="batch-quantidade"
                  type="number"
                  min="1"
                  value={currentBatch.quantidadeMaxima || ""}
                  onChange={(e) => updateCurrentBatch("quantidadeMaxima", e.target.value ? parseInt(e.target.value) : undefined)}
                  placeholder="Deixe vazio para sem limite"
                  data-testid="input-batch-quantity"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="batch-ordem">Ordem de Ativacao *</Label>
                <Input
                  id="batch-ordem"
                  type="number"
                  min="1"
                  value={currentBatch.ordem ?? ""}
                  onChange={(e) => updateCurrentBatch("ordem", e.target.value ? parseInt(e.target.value) : undefined)}
                  placeholder="Ordem do lote"
                  data-testid="input-batch-order"
                  className={orderError ? "border-destructive" : ""}
                />
                {orderError && (
                  <p className="text-xs text-destructive">{orderError}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Define a ordem de ativacao automatica. Lotes com ordem menor sao ativados primeiro quando o lote atual e fechado.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button 
              onClick={handleSaveBatch}
              disabled={!currentBatch.nome || !currentBatch.dataInicio || !currentBatch.ordem || currentBatch.ordem < 1}
              data-testid="button-save-batch"
            >
              {editingBatchIndex !== null ? "Salvar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDialogOpen} onOpenChange={(open) => {
        setConfirmDialogOpen(open);
        if (!open) {
          setConfirmAction(null);
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === "activate" && "Confirmar Ativação de Lote"}
              {confirmAction?.type === "setFuture" && "Não é possível marcar como futuro"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === "activate" && (
                <>
                  Existe um lote ativo. Ao ativar este lote, o lote atual será automaticamente fechado (status = 'closed').
                  Deseja continuar?
                </>
              )}
              {confirmAction?.type === "setFuture" && (
                <>
                  Não é possível marcar um lote ativo como futuro. Feche-o primeiro ou ative outro lote.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {confirmAction?.type === "setFuture" ? "Entendi" : "Cancelar"}
            </AlertDialogCancel>
            {confirmAction?.type === "activate" && (
              <AlertDialogAction 
                onClick={() => handleActivateBatch(confirmAction.index, true)}
                data-testid="button-confirm-activate-batch"
              >
                Sim, ativar e fechar outros
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
