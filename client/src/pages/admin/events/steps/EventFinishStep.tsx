import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Plus, Trash2, Shirt, FileText, AlertCircle, Package, X, Upload, Loader2, Pencil } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import type { EventFormData } from "../EventWizard";
import type { ShirtSize, Attachment } from "@shared/schema";

interface EventFinishStepProps {
  formData: EventFormData;
  updateFormData: (updates: Partial<EventFormData>) => void;
}

const TAMANHOS_CAMISA = ["PP", "P", "M", "G", "GG", "XG", "XXG", "INFANTIL"];

interface ShirtSelection {
  tamanho: string;
  quantidadeTotal: number;
  ajustePreco: number;
}

const emptyAttachment: Partial<Attachment> = {
  nome: "",
  url: "",
  obrigatorioAceitar: false,
  ordem: 0,
};

export function EventFinishStep({ formData, updateFormData }: EventFinishStepProps) {
  const { toast } = useToast();
  const [shirtDialogOpen, setShirtDialogOpen] = useState(false);
  const [editShirtDialogOpen, setEditShirtDialogOpen] = useState(false);
  const [editingShirtIndex, setEditingShirtIndex] = useState<number | null>(null);
  const [editingShirtData, setEditingShirtData] = useState<ShirtSelection | null>(null);
  const [attachmentDialogOpen, setAttachmentDialogOpen] = useState(false);
  const [selectedSizes, setSelectedSizes] = useState<ShirtSelection[]>([]);
  const [customSizeInput, setCustomSizeInput] = useState("");
  const [currentAttachment, setCurrentAttachment] = useState<Partial<Attachment>>(emptyAttachment);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const usedSizes = formData.shirts.map(s => s.tamanho);
  const availablePredefinedSizes = TAMANHOS_CAMISA.filter(t => !usedSizes.includes(t));

  const toggleSize = (size: string) => {
    const existingIndex = selectedSizes.findIndex(s => s.tamanho === size);
    if (existingIndex >= 0) {
      setSelectedSizes(prev => prev.filter((_, i) => i !== existingIndex));
    } else {
      setSelectedSizes(prev => [...prev, { tamanho: size, quantidadeTotal: 0, ajustePreco: 0 }]);
    }
  };

  const updateSizeQuantity = (size: string, quantity: number) => {
    setSelectedSizes(prev => prev.map(s => 
      s.tamanho === size ? { ...s, quantidadeTotal: quantity } : s
    ));
  };

  const updateSizeAjustePreco = (size: string, ajuste: number) => {
    setSelectedSizes(prev => prev.map(s => 
      s.tamanho === size ? { ...s, ajustePreco: ajuste } : s
    ));
  };

  const addCustomSize = () => {
    const trimmed = customSizeInput.trim().toUpperCase();
    if (trimmed && !selectedSizes.find(s => s.tamanho === trimmed) && !usedSizes.includes(trimmed)) {
      setSelectedSizes(prev => [...prev, { tamanho: trimmed, quantidadeTotal: 0, ajustePreco: 0 }]);
      setCustomSizeInput("");
    }
  };

  const removeSelectedSize = (size: string) => {
    setSelectedSizes(prev => prev.filter(s => s.tamanho !== size));
  };

  const handleAddShirts = () => {
    const validShirts = selectedSizes.filter(s => s.quantidadeTotal > 0);
    if (validShirts.length > 0) {
      const newShirts = [
        ...formData.shirts,
        ...validShirts.map(s => ({
          tamanho: s.tamanho,
          quantidadeTotal: s.quantidadeTotal,
          quantidadeDisponivel: s.quantidadeTotal,
          ajustePreco: String(s.ajustePreco || 0)
        }))
      ];
      updateFormData({ shirts: newShirts });
      setSelectedSizes([]);
      setShirtDialogOpen(false);
    }
  };

  const handleDeleteShirt = (index: number) => {
    const newShirts = formData.shirts.filter((_, i) => i !== index);
    updateFormData({ shirts: newShirts });
  };

  const handleEditShirt = (index: number) => {
    const shirt = formData.shirts[index];
    setEditingShirtIndex(index);
    setEditingShirtData({
      tamanho: shirt.tamanho || '',
      quantidadeTotal: shirt.quantidadeTotal || 0,
      ajustePreco: parseFloat(String(shirt.ajustePreco || 0))
    });
    setEditShirtDialogOpen(true);
  };

  const handleSaveEditShirt = () => {
    if (editingShirtIndex !== null && editingShirtData) {
      const newShirts = [...formData.shirts];
      const currentShirt = newShirts[editingShirtIndex];
      const oldTotal = currentShirt.quantidadeTotal || 0;
      const oldDisponivel = currentShirt.quantidadeDisponivel ?? oldTotal;
      const usedStock = oldTotal - oldDisponivel;
      const newDisponivel = Math.max(0, editingShirtData.quantidadeTotal - usedStock);
      
      newShirts[editingShirtIndex] = {
        ...currentShirt,
        tamanho: editingShirtData.tamanho,
        quantidadeTotal: editingShirtData.quantidadeTotal,
        quantidadeDisponivel: newDisponivel,
        ajustePreco: String(editingShirtData.ajustePreco || 0)
      };
      updateFormData({ shirts: newShirts });
      setEditShirtDialogOpen(false);
      setEditingShirtIndex(null);
      setEditingShirtData(null);
    }
  };

  const handleDialogOpenChange = (open: boolean) => {
    setShirtDialogOpen(open);
    if (!open) {
      setSelectedSizes([]);
      setCustomSizeInput("");
    }
  };

  const canAddShirts = selectedSizes.length > 0 && selectedSizes.every(s => s.quantidadeTotal > 0);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append("file", file);

      const response = await fetch("/api/admin/uploads/document", {
        method: "POST",
        credentials: "include",
        body: formDataUpload
      });

      const result = await response.json();
      if (result.success) {
        setCurrentAttachment(prev => ({ ...prev, url: result.data.url }));
        setUploadedFileName(result.data.originalName);
        toast({
          title: "Arquivo enviado",
          description: "O documento foi carregado com sucesso."
        });
      } else {
        throw new Error(result.message || "Erro ao enviar arquivo");
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro no upload",
        description: error instanceof Error ? error.message : "Erro ao enviar o arquivo"
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleAddAttachment = () => {
    if (currentAttachment.nome && currentAttachment.url) {
      const newAttachments = [...formData.attachments, {
        ...currentAttachment,
        ordem: formData.attachments.length
      }];
      updateFormData({ attachments: newAttachments });
      setCurrentAttachment(emptyAttachment);
      setUploadedFileName("");
      setAttachmentDialogOpen(false);
    }
  };

  const handleAttachmentDialogOpenChange = (open: boolean) => {
    setAttachmentDialogOpen(open);
    if (!open) {
      setCurrentAttachment(emptyAttachment);
      setUploadedFileName("");
    }
  };

  const handleDeleteAttachment = (index: number) => {
    const newAttachments = formData.attachments.filter((_, i) => i !== index);
    updateFormData({ attachments: newAttachments });
  };

  return (
    <div className="space-y-6">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Este e o ultimo passo. Configure a grade de camisas e documentos do evento.
          Voce podera editar estas informacoes depois.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <div className="flex items-center gap-2">
            <Shirt className="h-5 w-5" />
            <div>
              <CardTitle>Grade de Camisas</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Configure os tamanhos e quantidades disponiveis
              </p>
            </div>
          </div>
          <Dialog open={shirtDialogOpen} onOpenChange={handleDialogOpenChange}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-add-shirt">
                <Plus className="mr-2 h-4 w-4" />
                Adicionar Tamanhos
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Adicionar Tamanhos de Camisa</DialogTitle>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Selecione os tamanhos</Label>
                  <div className="flex flex-wrap gap-2">
                    {availablePredefinedSizes.map((size) => {
                      const isSelected = selectedSizes.some(s => s.tamanho === size);
                      return (
                        <Button
                          key={size}
                          type="button"
                          variant={isSelected ? "default" : "outline"}
                          size="sm"
                          onClick={() => toggleSize(size)}
                          data-testid={`button-size-${size}`}
                        >
                          {size}
                        </Button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Adicionar tamanho personalizado</Label>
                  <div className="flex gap-2">
                    <Input
                      value={customSizeInput}
                      onChange={(e) => setCustomSizeInput(e.target.value)}
                      placeholder="Ex: 3XG, KIDS-M..."
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustomSize())}
                      data-testid="input-custom-size"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={addCustomSize}
                      disabled={!customSizeInput.trim()}
                      data-testid="button-add-custom-size"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {selectedSizes.length > 0 && (
                  <div className="space-y-3 pt-2 border-t">
                    <Label>Quantidades e Ajuste de Preco</Label>
                    <p className="text-xs text-muted-foreground">
                      Use ajuste negativo para desconto (ex: -25 para R$ 25 de desconto)
                    </p>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {selectedSizes.map((selection) => (
                        <div 
                          key={selection.tamanho} 
                          className="flex items-center gap-2 p-2 rounded-md bg-muted/50"
                        >
                          <span className="font-medium min-w-16">{selection.tamanho}</span>
                          <div className="flex-1">
                            <Input
                              type="number"
                              min="1"
                              value={selection.quantidadeTotal || ""}
                              onChange={(e) => updateSizeQuantity(selection.tamanho, parseInt(e.target.value) || 0)}
                              placeholder="Qtd"
                              data-testid={`input-quantity-${selection.tamanho}`}
                            />
                          </div>
                          <div className="w-28">
                            <Input
                              type="number"
                              step="0.01"
                              value={selection.ajustePreco || ""}
                              onChange={(e) => updateSizeAjustePreco(selection.tamanho, parseFloat(e.target.value) || 0)}
                              placeholder="Ajuste R$"
                              data-testid={`input-ajuste-${selection.tamanho}`}
                            />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeSelectedSize(selection.tamanho)}
                            data-testid={`button-remove-${selection.tamanho}`}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancelar</Button>
                </DialogClose>
                <Button 
                  onClick={handleAddShirts}
                  disabled={!canAddShirts}
                  data-testid="button-save-shirts"
                >
                  Adicionar {selectedSizes.length > 0 ? `(${selectedSizes.length})` : ""}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {formData.shirts.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">Nenhum tamanho cadastrado</p>
              <Button variant="outline" onClick={() => setShirtDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Adicionar tamanhos
              </Button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
              {formData.shirts.map((shirt, index) => {
                const ajuste = parseFloat(String(shirt.ajustePreco || 0));
                return (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 rounded-lg border"
                    data-testid={`card-shirt-${index}`}
                  >
                    <div>
                      <span className="font-bold text-lg">{shirt.tamanho}</span>
                      <p className="text-sm text-muted-foreground">
                        {shirt.quantidadeTotal} unidades
                      </p>
                      {ajuste !== 0 && (
                        <p className={`text-xs ${ajuste < 0 ? 'text-green-600' : 'text-orange-600'}`}>
                          {ajuste < 0 ? `Desconto: R$ ${Math.abs(ajuste).toFixed(2)}` : `Acrescimo: R$ ${ajuste.toFixed(2)}`}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditShirt(index)}
                        data-testid={`button-edit-shirt-${index}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteShirt(index)}
                        data-testid={`button-delete-shirt-${index}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={editShirtDialogOpen} onOpenChange={(open) => {
        setEditShirtDialogOpen(open);
        if (!open) {
          setEditingShirtIndex(null);
          setEditingShirtData(null);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Tamanho de Camisa</DialogTitle>
          </DialogHeader>
          {editingShirtData && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Tamanho</Label>
                <Input
                  value={editingShirtData.tamanho}
                  onChange={(e) => setEditingShirtData({ ...editingShirtData, tamanho: e.target.value.toUpperCase() })}
                  placeholder="Ex: M, G, GG"
                  data-testid="input-edit-shirt-tamanho"
                />
              </div>
              <div className="space-y-2">
                <Label>Quantidade Total</Label>
                <Input
                  type="number"
                  min={0}
                  value={editingShirtData.quantidadeTotal}
                  onChange={(e) => setEditingShirtData({ ...editingShirtData, quantidadeTotal: parseInt(e.target.value) || 0 })}
                  data-testid="input-edit-shirt-quantidade"
                />
              </div>
              <div className="space-y-2">
                <Label>Ajuste de Preco (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editingShirtData.ajustePreco}
                  onChange={(e) => setEditingShirtData({ ...editingShirtData, ajustePreco: parseFloat(e.target.value) || 0 })}
                  placeholder="Ex: -25 para desconto, 10 para acrescimo"
                  data-testid="input-edit-shirt-ajuste"
                />
                <p className="text-xs text-muted-foreground">
                  Use valores negativos para desconto e positivos para acrescimo
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button onClick={handleSaveEditShirt} disabled={!editingShirtData?.quantidadeTotal}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            <div>
              <CardTitle>Documentos e Anexos</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Regulamento, termos de uso e outros documentos
              </p>
            </div>
          </div>
          <Dialog open={attachmentDialogOpen} onOpenChange={handleAttachmentDialogOpenChange}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-add-attachment">
                <Plus className="mr-2 h-4 w-4" />
                Adicionar Documento
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar Documento</DialogTitle>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="attachment-name">Nome do Documento *</Label>
                  <Input
                    id="attachment-name"
                    value={currentAttachment.nome || ""}
                    onChange={(e) => setCurrentAttachment(prev => ({ ...prev, nome: e.target.value }))}
                    placeholder="Ex: Regulamento do Evento"
                    data-testid="input-attachment-name"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Arquivo do Documento *</Label>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.txt"
                    className="hidden"
                    data-testid="input-attachment-file"
                  />
                  
                  {currentAttachment.url ? (
                    <div className="flex items-center gap-2 p-3 rounded-lg border bg-muted/50">
                      <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm truncate flex-1">{uploadedFileName || currentAttachment.url}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setCurrentAttachment(prev => ({ ...prev, url: "" }));
                          setUploadedFileName("");
                        }}
                        data-testid="button-remove-file"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      data-testid="button-upload-file"
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        <>
                          <Upload className="mr-2 h-4 w-4" />
                          Selecionar Arquivo
                        </>
                      )}
                    </Button>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Formatos aceitos: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG, WebP, TXT (max 20MB)
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Aceite Obrigatório</Label>
                    <p className="text-sm text-muted-foreground">
                      Participante deve aceitar para se inscrever
                    </p>
                  </div>
                  <Switch
                    checked={currentAttachment.obrigatorioAceitar ?? false}
                    onCheckedChange={(checked) => setCurrentAttachment(prev => ({
                      ...prev,
                      obrigatorioAceitar: checked
                    }))}
                    data-testid="switch-attachment-required"
                  />
                </div>
              </div>

              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancelar</Button>
                </DialogClose>
                <Button 
                  onClick={handleAddAttachment}
                  disabled={!currentAttachment.nome || !currentAttachment.url || isUploading}
                  data-testid="button-save-attachment"
                >
                  Adicionar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {formData.attachments.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">Nenhum documento cadastrado</p>
              <Button variant="outline" onClick={() => setAttachmentDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Adicionar documento
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {formData.attachments.map((attachment, index) => {
                const isLocalFile = attachment.url?.startsWith("/uploads/");
                const fileName = isLocalFile 
                  ? attachment.url?.split("/").pop() 
                  : attachment.url;
                
                return (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 rounded-lg border"
                    data-testid={`card-attachment-${index}`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{attachment.nome}</span>
                          {attachment.obrigatorioAceitar && (
                            <span className="text-xs text-destructive">(Aceite obrigatório)</span>
                          )}
                        </div>
                        {isLocalFile ? (
                          <a 
                            href={attachment.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline truncate block"
                          >
                            {fileName}
                          </a>
                        ) : (
                          <p className="text-sm text-muted-foreground truncate">
                            {attachment.url}
                          </p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteAttachment(index)}
                      className="flex-shrink-0"
                      data-testid={`button-delete-attachment-${index}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2 space-y-0">
          <Package className="h-5 w-5" />
          <div>
            <CardTitle>Retirada de Kit</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Informacoes sobre local, data e horario de retirada do kit (opcional)
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="informacoesRetiradaKit">Informacoes da Retirada de Kit</Label>
            <Textarea
              id="informacoesRetiradaKit"
              value={formData.event.informacoesRetiradaKit || ""}
              onChange={(e) => updateFormData({
                event: { ...formData.event, informacoesRetiradaKit: e.target.value }
              })}
              placeholder="Ex: Retirada no dia 10/01/2025 das 10h as 18h no Ginasio Municipal, Av. Principal, 1000. Levar documento com foto."
              rows={4}
              data-testid="input-kit-pickup-info"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Resumo do Evento</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <p className="text-3xl font-bold">{formData.modalities.length}</p>
              <p className="text-sm text-muted-foreground">Modalidades</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <p className="text-3xl font-bold">{formData.batches.length}</p>
              <p className="text-sm text-muted-foreground">Lotes</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <p className="text-3xl font-bold">{formData.shirts.length}</p>
              <p className="text-sm text-muted-foreground">Tamanhos de Camisa</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <p className="text-3xl font-bold">{formData.attachments.length}</p>
              <p className="text-sm text-muted-foreground">Documentos</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
