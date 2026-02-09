import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ImageUpload, SingleImageUpload } from "@/components/ImageUpload";
import { Image, Map } from "lucide-react";
import type { EventFormData, BannerImage } from "../EventWizard";
import type { Organizer } from "@shared/schema";

const ESTADOS_BRASIL = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

interface EventBasicInfoStepProps {
  formData: EventFormData;
  updateFormData: (updates: Partial<EventFormData>) => void;
}

export function EventBasicInfoStep({ formData, updateFormData }: EventBasicInfoStepProps) {
  const { data: organizers = [] } = useQuery<Organizer[]>({
    queryKey: ["/api/admin/organizers"],
    select: (data: any) => data?.data || [],
  });

  const updateEvent = (field: string, value: any) => {
    updateFormData({
      event: { ...formData.event, [field]: value }
    });
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  };

  const handleNameBlur = () => {
    const name = formData.event.nome || "";
    if (name && !formData.event.slug) {
      updateEvent("slug", generateSlug(name));
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="organizerId">Organizador *</Label>
          <Select
            value={formData.event.organizerId || ""}
            onValueChange={(value) => updateEvent("organizerId", value)}
          >
            <SelectTrigger data-testid="select-organizer">
              <SelectValue placeholder="Selecione o organizador" />
            </SelectTrigger>
            <SelectContent>
              {organizers.map((org) => (
                <SelectItem key={org.id} value={org.id}>
                  {org.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select
            value={formData.event.status || "rascunho"}
            onValueChange={(value) => updateEvent("status", value)}
          >
            <SelectTrigger data-testid="select-status">
              <SelectValue placeholder="Selecione o status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rascunho">Rascunho</SelectItem>
              <SelectItem value="publicado">Publicado</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
              <SelectItem value="finalizado">Finalizado</SelectItem>
              <SelectItem value="esgotado">Esgotado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="nome">Nome do Evento *</Label>
          <Input
            id="nome"
            value={formData.event.nome || ""}
            onChange={(e) => updateEvent("nome", e.target.value)}
            onBlur={handleNameBlur}
            placeholder="Ex: Meia Maratona de Sao Paulo 2025"
            data-testid="input-event-name"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="slug">Slug (URL) *</Label>
          <Input
            id="slug"
            value={formData.event.slug || ""}
            onChange={(e) => updateEvent("slug", e.target.value)}
            placeholder="meia-maratona-sp-2025"
            data-testid="input-event-slug"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="descricao">Descricao *</Label>
        <Textarea
          id="descricao"
          value={formData.event.descricao || ""}
          onChange={(e) => updateEvent("descricao", e.target.value)}
          placeholder="Descreva o evento, informacoes importantes para os participantes..."
          rows={4}
          data-testid="input-event-description"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="dataEvento">Data do Evento *</Label>
          <Input
            id="dataEvento"
            type="date"
            value={formData.event.dataEvento?.toString() || ""}
            onChange={(e) => updateEvent("dataEvento", e.target.value)}
            data-testid="input-event-date"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="limiteVagasTotal">Limite Total de Vagas *</Label>
          <Input
            id="limiteVagasTotal"
            type="number"
            min="1"
            value={formData.event.limiteVagasTotal || ""}
            onChange={(e) => updateEvent("limiteVagasTotal", parseInt(e.target.value) || "")}
            placeholder="Ex: 5000"
            data-testid="input-total-capacity"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="endereco">Endereco *</Label>
        <Input
          id="endereco"
          value={formData.event.endereco || ""}
          onChange={(e) => updateEvent("endereco", e.target.value)}
          placeholder="Ex: Parque Ibirapuera - Portao 10"
          data-testid="input-event-address"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="cidade">Cidade *</Label>
          <Input
            id="cidade"
            value={formData.event.cidade || ""}
            onChange={(e) => updateEvent("cidade", e.target.value)}
            placeholder="Ex: Sao Paulo"
            data-testid="input-event-city"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="estado">Estado *</Label>
          <Select
            value={formData.event.estado || ""}
            onValueChange={(value) => updateEvent("estado", value)}
          >
            <SelectTrigger data-testid="select-state">
              <SelectValue placeholder="UF" />
            </SelectTrigger>
            <SelectContent>
              {ESTADOS_BRASIL.map((uf) => (
                <SelectItem key={uf} value={uf}>
                  {uf}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="aberturaInscricoes">Abertura das Inscricoes *</Label>
          <Input
            id="aberturaInscricoes"
            type="datetime-local"
            value={typeof formData.event.aberturaInscricoes === 'string' 
              ? formData.event.aberturaInscricoes 
              : formData.event.aberturaInscricoes 
                ? formData.event.aberturaInscricoes.toISOString().slice(0, 16)
                : ""}
            onChange={(e) => updateEvent("aberturaInscricoes", e.target.value)}
            data-testid="input-registration-start"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="encerramentoInscricoes">Encerramento das Inscrições *</Label>
          <Input
            id="encerramentoInscricoes"
            type="datetime-local"
            value={typeof formData.event.encerramentoInscricoes === 'string' 
              ? formData.event.encerramentoInscricoes 
              : formData.event.encerramentoInscricoes 
                ? formData.event.encerramentoInscricoes.toISOString().slice(0, 16)
                : ""}
            onChange={(e) => updateEvent("encerramentoInscricoes", e.target.value)}
            data-testid="input-registration-end"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="idadeMinimaEvento">Idade Mínima para Inscrição</Label>
          <Input
            id="idadeMinimaEvento"
            type="number"
            min="0"
            max="100"
            value={formData.event.idadeMinimaEvento ?? 18}
            onChange={(e) => updateEvent("idadeMinimaEvento", parseInt(e.target.value) || 0)}
            placeholder="18"
            data-testid="input-minimum-age"
          />
          <p className="text-xs text-muted-foreground">
            Idade mínima padrão para todas as modalidades. Pode ser personalizado por modalidade.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label htmlFor="permitirMultiplasModalidades">Permitir Múltiplas Modalidades por Atleta</Label>
              <p className="text-xs text-muted-foreground">
                Quando ativado, o atleta pode se inscrever em mais de uma modalidade no mesmo evento. 
                Ainda não poderá repetir a mesma modalidade.
              </p>
            </div>
            <Switch
              id="permitirMultiplasModalidades"
              checked={formData.event.permitirMultiplasModalidades ?? false}
              onCheckedChange={(checked) => updateEvent("permitirMultiplasModalidades", checked)}
              data-testid="switch-allow-multiple-modalities"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2 space-y-0">
          <Image className="h-5 w-5" />
          <div>
            <CardTitle className="text-base">Banners do Evento</CardTitle>
            <p className="text-sm text-muted-foreground">
              Adicione imagens no formato de post do Instagram (4:5)
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <ImageUpload
            eventId={formData.event.id as string | undefined}
            images={formData.banners}
            onImagesChange={(images) => updateFormData({ banners: images })}
            maxImages={10}
            aspectRatio="portrait"
            label="Imagens do Banner"
            description="Ate 10 imagens no formato 4:5 (Instagram)"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2 space-y-0">
          <Map className="h-5 w-5" />
          <div>
            <CardTitle className="text-base">Mapa do Percurso</CardTitle>
            <p className="text-sm text-muted-foreground">
              Imagem do percurso geral do evento (opcional)
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <SingleImageUpload
            eventId={formData.event.id as string | undefined}
            imageUrl={formData.event.imagemPercursoUrl || null}
            onImageChange={(url) => updateEvent("imagemPercursoUrl", url)}
            uploadType="route"
            label="Imagem do Percurso"
            description="Mapa ou imagem do percurso do evento"
            aspectRatio="landscape"
          />
        </CardContent>
      </Card>

    </div>
  );
}
