import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, GripVertical, Upload, X, ImageIcon, Loader2, DollarSign, Users, Clock, Link2, ExternalLink, EyeOff, ChevronUp, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import type { EventFormData } from "../EventWizard";
import type { Modality } from "@shared/schema";

interface EventModalitiesStepProps {
  formData: EventFormData;
  updateFormData: (updates: Partial<EventFormData>) => void;
}

const TIPOS_ACESSO = [
  { value: "paga", label: "Paga" },
  { value: "gratuita", label: "Gratuita" },
  { value: "voucher", label: "Voucher" },
  { value: "pcd", label: "PCD" },
  { value: "aprovacao_manual", label: "Aprovacao Manual" },
];

interface LinkPercurso {
  nome: string;
  url: string;
}

type ModalityFormData = Partial<Modality> & { 
  linksPercurso?: LinkPercurso[] | null;
};

const emptyModality: ModalityFormData = {
  nome: "",
  distancia: "0",
  unidadeDistancia: "km",
  horarioLargada: "",
  descricao: "",
  tipoAcesso: "paga",
  taxaComodidade: "0",
  ordem: 0,
  linksPercurso: [],
  ativo: true,
};

export function EventModalitiesStep({ formData, updateFormData }: EventModalitiesStepProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [currentModality, setCurrentModality] = useState<ModalityFormData>(emptyModality);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const { toast } = useToast();

  const resetDialogState = () => {
    setIsUploadingImage(false);
    setDragOver(false);
  };

  const openNewDialog = () => {
    setCurrentModality({ ...emptyModality, ordem: formData.modalities.length });
    setEditingIndex(null);
    resetDialogState();
    setDialogOpen(true);
  };

  const openEditDialog = (index: number) => {
    const modality = formData.modalities[index];
    const linksPercurso = Array.isArray(modality.linksPercurso) ? modality.linksPercurso : [];
    setCurrentModality({ ...modality, linksPercurso });
    setEditingIndex(index);
    resetDialogState();
    setDialogOpen(true);
  };

  const handleDialogChange = (open: boolean) => {
    if (!open) {
      resetDialogState();
    }
    setDialogOpen(open);
  };

  const handleSave = () => {
    const newModalities = [...formData.modalities];
    let newPrices = [...formData.prices];
    
    const normalizedModality = {
      ...currentModality,
      linksPercurso: Array.isArray(currentModality.linksPercurso) 
        ? currentModality.linksPercurso.filter(link => link.nome && link.url) 
        : null
    };
    
    if (editingIndex !== null) {
      newModalities[editingIndex] = normalizedModality;
      if (normalizedModality.tipoAcesso === "gratuita") {
        newPrices = newPrices.filter(p => p.modalityIndex !== editingIndex);
      }
    } else {
      newModalities.push(normalizedModality);
    }
    
    updateFormData({ modalities: newModalities, prices: newPrices });
    resetDialogState();
    setDialogOpen(false);
  };

  const handleDelete = (index: number) => {
    const newModalities = formData.modalities.filter((_, i) => i !== index);
    const newPrices = formData.prices
      .filter(p => p.modalityIndex !== index)
      .map(p => ({
        ...p,
        modalityIndex: p.modalityIndex > index ? p.modalityIndex - 1 : p.modalityIndex
      }));
    updateFormData({ modalities: newModalities, prices: newPrices });
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newModalities = [...formData.modalities];
    const temp = newModalities[index - 1];
    newModalities[index - 1] = { ...newModalities[index], ordem: index - 1 };
    newModalities[index] = { ...temp, ordem: index };
    
    const newPrices = formData.prices.map(p => {
      if (p.modalityIndex === index) return { ...p, modalityIndex: index - 1 };
      if (p.modalityIndex === index - 1) return { ...p, modalityIndex: index };
      return p;
    });
    
    updateFormData({ modalities: newModalities, prices: newPrices });
  };

  const handleMoveDown = (index: number) => {
    if (index >= formData.modalities.length - 1) return;
    const newModalities = [...formData.modalities];
    const temp = newModalities[index + 1];
    newModalities[index + 1] = { ...newModalities[index], ordem: index + 1 };
    newModalities[index] = { ...temp, ordem: index };
    
    const newPrices = formData.prices.map(p => {
      if (p.modalityIndex === index) return { ...p, modalityIndex: index + 1 };
      if (p.modalityIndex === index + 1) return { ...p, modalityIndex: index };
      return p;
    });
    
    updateFormData({ modalities: newModalities, prices: newPrices });
  };

  const updateCurrentModality = (field: string, value: any) => {
    setCurrentModality(prev => ({ ...prev, [field]: value }));
  };

  const handleImageUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Arquivo inválido",
        description: "Apenas imagens são permitidas",
        variant: "destructive"
      });
      return;
    }

    setIsUploadingImage(true);
    
    try {
      const formData = new FormData();
      formData.append("image", file);
      
      const response = await fetch("/api/admin/uploads/modality-image", {
        method: "POST",
        credentials: "include",
        body: formData
      });
      
      const result = await response.json();
      
      if (result.success) {
        updateCurrentModality("imagemUrl", result.data.imageUrl);
      } else {
        throw new Error(result.message || "Erro ao fazer upload");
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Erro ao carregar imagem",
        description: "Não foi possível fazer upload da imagem",
        variant: "destructive"
      });
    } finally {
      setIsUploadingImage(false);
    }
  }, [toast]);

  const handleImageRemove = () => {
    updateCurrentModality("imagemUrl", null);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleImageUpload(e.dataTransfer.files);
  }, [handleImageUpload]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Adicione as modalidades (categorias) do evento. Ex: 5km, 10km, 21km
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
          <DialogTrigger asChild>
            <Button onClick={openNewDialog} data-testid="button-add-modality">
              <Plus className="mr-2 h-4 w-4" />
              Adicionar Modalidade
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingIndex !== null ? "Editar Modalidade" : "Nova Modalidade"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="mod-nome">Nome *</Label>
                  <Input
                    id="mod-nome"
                    value={currentModality.nome || ""}
                    onChange={(e) => updateCurrentModality("nome", e.target.value)}
                    placeholder="Ex: Corrida 10km"
                    data-testid="input-modality-name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mod-horario">Horario de Largada *</Label>
                  <Input
                    id="mod-horario"
                    type="time"
                    value={currentModality.horarioLargada || ""}
                    onChange={(e) => updateCurrentModality("horarioLargada", e.target.value)}
                    data-testid="input-modality-time"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="mod-distancia">Distancia *</Label>
                  <Input
                    id="mod-distancia"
                    type="number"
                    step="0.01"
                    min="0"
                    value={currentModality.distancia || ""}
                    onChange={(e) => updateCurrentModality("distancia", e.target.value)}
                    placeholder="10"
                    data-testid="input-modality-distance"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mod-unidade">Unidade</Label>
                  <Select
                    value={currentModality.unidadeDistancia || "km"}
                    onValueChange={(value) => updateCurrentModality("unidadeDistancia", value)}
                  >
                    <SelectTrigger data-testid="select-modality-unit">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="km">km</SelectItem>
                      <SelectItem value="m">m</SelectItem>
                      <SelectItem value="mi">mi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mod-vagas">Limite de Vagas</Label>
                  <Input
                    id="mod-vagas"
                    type="number"
                    min="0"
                    value={currentModality.limiteVagas || ""}
                    onChange={(e) => updateCurrentModality("limiteVagas", e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="Opcional"
                    data-testid="input-modality-capacity"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="mod-acesso">Tipo de Acesso *</Label>
                  <Select
                    value={currentModality.tipoAcesso || "paga"}
                    onValueChange={(value) => updateCurrentModality("tipoAcesso", value)}
                  >
                    <SelectTrigger data-testid="select-modality-access">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPOS_ACESSO.map((tipo) => (
                        <SelectItem key={tipo.value} value={tipo.value}>
                          {tipo.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mod-taxa">Taxa de Comodidade (R$)</Label>
                  <Input
                    id="mod-taxa"
                    type="number"
                    step="0.01"
                    min="0"
                    value={currentModality.taxaComodidade || "0"}
                    onChange={(e) => updateCurrentModality("taxaComodidade", e.target.value)}
                    placeholder="0.00"
                    data-testid="input-modality-fee"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mod-idade-minima">Idade Minima</Label>
                  <Input
                    id="mod-idade-minima"
                    type="number"
                    min="0"
                    max="100"
                    value={currentModality.idadeMinima ?? ""}
                    onChange={(e) => updateCurrentModality("idadeMinima", e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="Usa padrao do evento"
                    data-testid="input-modality-min-age"
                  />
                  <p className="text-xs text-muted-foreground">
                    Deixe vazio para usar a idade do evento
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="mod-descricao">Descricao</Label>
                <Textarea
                  id="mod-descricao"
                  value={currentModality.descricao || ""}
                  onChange={(e) => updateCurrentModality("descricao", e.target.value)}
                  placeholder="Informacoes adicionais sobre a modalidade..."
                  rows={3}
                  data-testid="input-modality-description"
                />
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Imagem do Percurso</Label>
                  <p className="text-sm text-muted-foreground">
                    Adicione uma imagem do percurso desta modalidade
                  </p>
                  
                  {currentModality.imagemUrl ? (
                    <div className="relative max-w-md">
                      <Card className="relative overflow-hidden group aspect-video">
                        <img
                          src={currentModality.imagemUrl}
                          alt="Imagem do percurso"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <label className="cursor-pointer">
                            <input
                              type="file"
                              accept="image/*"
                              className="sr-only"
                              onChange={(e) => handleImageUpload(e.target.files)}
                              disabled={isUploadingImage}
                            />
                            <Button size="sm" variant="secondary" asChild>
                              <span>
                                <Upload className="h-4 w-4 mr-2" />
                                Trocar
                              </span>
                            </Button>
                          </label>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={handleImageRemove}
                            data-testid="button-remove-modality-image"
                          >
                            <X className="h-4 w-4 mr-2" />
                            Remover
                          </Button>
                        </div>
                      </Card>
                    </div>
                  ) : (
                    <label
                      className={`
                        relative flex flex-col items-center justify-center 
                        border-2 border-dashed rounded-lg cursor-pointer
                        transition-colors aspect-video max-w-md
                        ${dragOver ? "border-primary bg-primary/10" : "border-muted-foreground/25 hover:border-primary/50"}
                        ${isUploadingImage ? "pointer-events-none opacity-50" : ""}
                      `}
                      onDrop={handleDrop}
                      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                      onDragLeave={(e) => { e.preventDefault(); setDragOver(false); }}
                      data-testid="input-modality-image-upload"
                    >
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={(e) => handleImageUpload(e.target.files)}
                        disabled={isUploadingImage}
                      />
                      {isUploadingImage ? (
                        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
                      ) : (
                        <>
                          <ImageIcon className="h-10 w-10 text-muted-foreground mb-3" />
                          <span className="text-sm text-muted-foreground">
                            Clique ou arraste uma imagem
                          </span>
                        </>
                      )}
                    </label>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Links do Percurso</Label>
                      <p className="text-xs text-muted-foreground">
                        Adicione links do Google Maps, Strava ou outros apps
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const links = currentModality.linksPercurso || [];
                        updateCurrentModality("linksPercurso", [...links, { nome: "", url: "" }]);
                      }}
                      data-testid="button-add-percurso-link"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Adicionar Link
                    </Button>
                  </div>
                  
                  {(currentModality.linksPercurso || []).length > 0 ? (
                    <div className="space-y-2">
                      {(currentModality.linksPercurso || []).map((link, idx) => (
                        <div key={idx} className="flex items-center gap-2 p-3 border rounded-lg bg-muted/30">
                          <Link2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <Input
                            placeholder="Nome (ex: Strava, Google Maps)"
                            value={link.nome}
                            onChange={(e) => {
                              const links = [...(currentModality.linksPercurso || [])];
                              links[idx] = { ...links[idx], nome: e.target.value };
                              updateCurrentModality("linksPercurso", links);
                            }}
                            className="max-w-[180px]"
                            data-testid={`input-link-nome-${idx}`}
                          />
                          <Input
                            placeholder="https://..."
                            type="url"
                            value={link.url}
                            onChange={(e) => {
                              const links = [...(currentModality.linksPercurso || [])];
                              links[idx] = { ...links[idx], url: e.target.value };
                              updateCurrentModality("linksPercurso", links);
                            }}
                            className="flex-1"
                            data-testid={`input-link-url-${idx}`}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              const links = (currentModality.linksPercurso || []).filter((_, i) => i !== idx);
                              updateCurrentModality("linksPercurso", links);
                            }}
                            data-testid={`button-remove-link-${idx}`}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-sm text-muted-foreground border border-dashed rounded-lg">
                      Nenhum link adicionado
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                <div className="space-y-0.5">
                  <Label htmlFor="mod-ativo" className="text-base font-medium">Modalidade Ativa</Label>
                  <p className="text-sm text-muted-foreground">
                    Modalidades inativas não aparecem no fluxo de inscrição
                  </p>
                </div>
                <Switch
                  id="mod-ativo"
                  checked={currentModality.ativo !== false}
                  onCheckedChange={(checked) => updateCurrentModality("ativo", checked)}
                  data-testid="switch-modality-active"
                />
              </div>
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancelar</Button>
              </DialogClose>
              <Button 
                onClick={handleSave}
                disabled={!currentModality.nome || !currentModality.horarioLargada}
                data-testid="button-save-modality"
              >
                {editingIndex !== null ? "Salvar" : "Adicionar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {formData.modalities.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">Nenhuma modalidade cadastrada</p>
            <Button variant="outline" onClick={openNewDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Adicionar primeira modalidade
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {formData.modalities.map((modality, index) => {
            const tipoAcessoLabel = TIPOS_ACESSO.find(t => t.value === modality.tipoAcesso)?.label || modality.tipoAcesso;
            const isGratuita = modality.tipoAcesso === "gratuita";
            const taxa = typeof modality.taxaComodidade === 'number' 
              ? modality.taxaComodidade 
              : parseFloat(modality.taxaComodidade || "0") || 0;
            
            return (
              <Card key={index} data-testid={`card-modality-${index}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <GripVertical className="h-5 w-5 text-muted-foreground" />
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <CardTitle className="text-base">{modality.nome}</CardTitle>
                          <Badge 
                            variant={isGratuita ? "secondary" : "default"}
                            className="text-xs"
                            data-testid={`badge-access-type-${index}`}
                          >
                            {tipoAcessoLabel}
                          </Badge>
                          {modality.ativo === false && (
                            <Badge 
                              variant="outline"
                              className="text-xs text-muted-foreground border-muted-foreground/50"
                              data-testid={`badge-inactive-${index}`}
                            >
                              <EyeOff className="h-3 w-3 mr-1" />
                              Inativa
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            {modality.distancia} {modality.unidadeDistancia}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {modality.horarioLargada}
                          </span>
                          {taxa > 0 && (
                            <span className="flex items-center gap-1" data-testid={`text-fee-${index}`}>
                              <DollarSign className="h-3.5 w-3.5" />
                              Taxa: R$ {taxa.toFixed(2)}
                            </span>
                          )}
                          {modality.limiteVagas && (
                            <span className="flex items-center gap-1" data-testid={`text-capacity-${index}`}>
                              <Users className="h-3.5 w-3.5" />
                              {modality.limiteVagas} vagas
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleMoveUp(index)}
                        disabled={index === 0}
                        title="Mover para cima"
                        data-testid={`button-move-up-${index}`}
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleMoveDown(index)}
                        disabled={index === formData.modalities.length - 1}
                        title="Mover para baixo"
                        data-testid={`button-move-down-${index}`}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(index)}
                        data-testid={`button-edit-modality-${index}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(index)}
                        data-testid={`button-delete-modality-${index}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
