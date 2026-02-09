import { useState } from "react";
import { useLocation } from "wouter";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

import { EventBasicInfoStep } from "./steps/EventBasicInfoStep";
import { EventModalitiesStep } from "./steps/EventModalitiesStep";
import { EventBatchesStep } from "./steps/EventBatchesStep";
import { EventFinishStep } from "./steps/EventFinishStep";

import type { Event, Modality, RegistrationBatch, Price, ShirtSize, Attachment, EventBanner } from "@shared/schema";

export interface BannerImage {
  id?: string;
  url: string;
  ordem?: number;
}

export interface EventFormData {
  event: Partial<Event>;
  modalities: Partial<Modality>[];
  batches: Partial<RegistrationBatch>[];
  prices: { modalityIndex: number; batchIndex: number; valor: string }[];
  shirts: Partial<ShirtSize>[];
  attachments: Partial<Attachment>[];
  banners: BannerImage[];
}

const STEPS = [
  { id: 1, title: "Informacoes Basicas", description: "Dados principais do evento" },
  { id: 2, title: "Modalidades", description: "Configure as categorias" },
  { id: 3, title: "Lotes e Precos", description: "Defina periodos e valores" },
  { id: 4, title: "Finalizacao", description: "Camisas e documentos" },
];

interface EventWizardProps {
  mode: "create" | "edit";
  eventId?: string;
  initialData?: EventFormData;
}

export default function EventWizard({ mode, eventId, initialData }: EventWizardProps) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState<EventFormData>(initialData || {
    event: {
      status: "rascunho",
      entregaCamisaNoKit: true,
      usarGradePorModalidade: false,
    },
    modalities: [],
    batches: [],
    prices: [],
    shirts: [],
    attachments: [],
    banners: [],
  });

  const updateFormData = (updates: Partial<EventFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 1:
        const { event } = formData;
        return !!(
          event.organizerId &&
          event.nome &&
          event.slug &&
          event.descricao &&
          event.dataEvento &&
          event.endereco &&
          event.cidade &&
          event.estado &&
          event.aberturaInscricoes &&
          event.encerramentoInscricoes &&
          event.limiteVagasTotal
        );
      case 2:
        return formData.modalities.length > 0;
      case 3:
        if (formData.batches.length === 0) return false;
        
        const paidModalities = formData.modalities
          .map((m, i) => ({ modality: m, index: i }))
          .filter(({ modality }) => modality.tipoAcesso !== "gratuita");
        
        if (paidModalities.length === 0) return true;
        
        const allPaidModalitiesHavePrices = paidModalities.every(({ index: modalityIndex }) => 
          formData.batches.every((_, batchIndex) => 
            formData.prices.some(p => p.modalityIndex === modalityIndex && p.batchIndex === batchIndex)
          )
        );
        
        return allPaidModalitiesHavePrices;
      case 4:
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStep < 4 && canProceed()) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      let createdEventId = eventId;

      if (mode === "create") {
        const eventResponse = await apiRequest("POST", "/api/admin/events", formData.event);
        const eventResult = await eventResponse.json();
        if (!eventResult.success) throw new Error(eventResult.error?.message || "Erro ao criar evento");
        createdEventId = eventResult.data.id;
      } else {
        const eventResponse = await apiRequest("PATCH", `/api/admin/events/${eventId}`, formData.event);
        const eventResult = await eventResponse.json();
        if (!eventResult.success) throw new Error(eventResult.error?.message || "Erro ao atualizar evento");
      }

      if (mode === "edit" && createdEventId) {
        const existingModalitiesResponse = await fetch(`/api/admin/events/${createdEventId}/modalities`, { credentials: "include" });
        const existingModalitiesResult = await existingModalitiesResponse.json();
        const existingModalities = existingModalitiesResult.data || [];
        
        const formModalityIds = formData.modalities.filter(m => m.id).map(m => m.id);
        const modalitiesToDelete = existingModalities.filter((m: any) => !formModalityIds.includes(m.id));
        
        for (const modalityToDelete of modalitiesToDelete) {
          const deleteResponse = await apiRequest("DELETE", `/api/admin/events/${createdEventId}/modalities/${modalityToDelete.id}`);
          const deleteResult = await deleteResponse.json();
          if (!deleteResult.success) {
            if (deleteResult.error?.code === "HAS_REGISTRATIONS") {
              throw new Error(`A modalidade "${modalityToDelete.nome}" já possui inscrições e não pode ser excluída.`);
            }
            throw new Error(deleteResult.error?.message || "Erro ao deletar modalidade");
          }
        }
      }

      for (const modality of formData.modalities) {
        const modalityData = { ...modality, eventId: createdEventId };
        if (modality.id) {
          await apiRequest("PATCH", `/api/admin/events/${createdEventId}/modalities/${modality.id}`, modalityData);
        } else {
          await apiRequest("POST", `/api/admin/events/${createdEventId}/modalities`, modalityData);
        }
      }

      if (mode === "edit" && createdEventId) {
        const existingBatchesResponse = await fetch(`/api/admin/events/${createdEventId}/batches`, { credentials: "include" });
        const existingBatchesResult = await existingBatchesResponse.json();
        const existingBatches = existingBatchesResult.data || [];
        
        const formBatchIds = formData.batches.filter(b => b.id).map(b => b.id);
        const batchesToDelete = existingBatches.filter((b: any) => !formBatchIds.includes(b.id));
        
        for (const batchToDelete of batchesToDelete) {
          const deleteResponse = await apiRequest("DELETE", `/api/admin/events/${createdEventId}/batches/${batchToDelete.id}`);
          const deleteResult = await deleteResponse.json();
          if (!deleteResult.success) {
            if (deleteResult.error?.code === "BATCH_HAS_REGISTRATIONS") {
              throw new Error("Este lote já possui inscrições vinculadas e não pode ser excluído. Feche ou oculte o lote em vez de apagá-lo.");
            }
            throw new Error(deleteResult.error?.message || "Erro ao deletar lote");
          }
        }
      }

      for (const batch of formData.batches) {
        const batchData = { ...batch, eventId: createdEventId };
        if (batch.id) {
          await apiRequest("PATCH", `/api/admin/events/${createdEventId}/batches/${batch.id}`, batchData);
        } else {
          await apiRequest("POST", `/api/admin/events/${createdEventId}/batches`, batchData);
        }
      }

      const modalitiesResponse = await fetch(`/api/admin/events/${createdEventId}/modalities`, { credentials: "include" });
      const modalitiesResult = await modalitiesResponse.json();
      const savedModalities = modalitiesResult.data || [];

      const batchesResponse = await fetch(`/api/admin/events/${createdEventId}/batches`, { credentials: "include" });
      const batchesResult = await batchesResponse.json();
      const savedBatches = batchesResult.data || [];

      const pricesForBulk: Array<{ modalityId: string; batchId: string; valor: string }> = [];

      for (let modalityIndex = 0; modalityIndex < formData.modalities.length; modalityIndex++) {
        const modality = formData.modalities[modalityIndex];
        const savedModality = savedModalities.find((m: any) => 
          modality.id ? m.id === modality.id : savedModalities.indexOf(m) === modalityIndex
        );
        
        if (!savedModality?.id) continue;
        
        for (let batchIndex = 0; batchIndex < formData.batches.length; batchIndex++) {
          const batch = formData.batches[batchIndex];
          const savedBatch = savedBatches.find((b: any) => 
            batch.id ? b.id === batch.id : savedBatches.indexOf(b) === batchIndex
          );
          if (!savedBatch?.id) continue;
          
          if (modality.tipoAcesso === "gratuita") {
            pricesForBulk.push({
              modalityId: savedModality.id,
              batchId: savedBatch.id,
              valor: "0",
            });
          } else {
            const priceEntry = formData.prices.find(
              p => p.modalityIndex === modalityIndex && p.batchIndex === batchIndex
            );
            if (priceEntry) {
              pricesForBulk.push({
                modalityId: savedModality.id,
                batchId: savedBatch.id,
                valor: priceEntry.valor,
              });
            }
          }
        }
      }

      if (pricesForBulk.length > 0) {
        await apiRequest("PUT", `/api/admin/events/${createdEventId}/prices/bulk`, {
          prices: pricesForBulk,
        });
      }

      // Handle shirts (both create and edit mode)
      // First, delete removed shirts (only in edit mode)
      if (mode === "edit" && createdEventId) {
        const existingShirtsResponse = await fetch(`/api/admin/events/${createdEventId}/shirts`, { credentials: "include" });
        const existingShirtsResult = await existingShirtsResponse.json();
        
        if (!existingShirtsResult.success) {
          throw new Error(existingShirtsResult.error?.message || "Erro ao buscar tamanhos de camisa existentes");
        }
        
        const existingShirts = existingShirtsResult.data || [];
        const formShirtIds = formData.shirts.filter(s => s.id).map(s => s.id);
        const shirtsToDelete = existingShirts.filter((s: any) => !formShirtIds.includes(s.id));
        
        for (const shirtToDelete of shirtsToDelete) {
          const deleteResponse = await apiRequest("DELETE", `/api/admin/events/${createdEventId}/shirts/${shirtToDelete.id}`);
          const deleteResult = await deleteResponse.json();
          if (!deleteResult.success) {
            if (deleteResult.error?.code === "HAS_USAGE") {
              throw new Error(`O tamanho ${shirtToDelete.tamanho} já foi utilizado em inscrições e não pode ser removido.`);
            }
            throw new Error(deleteResult.error?.message || "Erro ao remover tamanho de camisa");
          }
        }
      }
      
      // Then create/update shirts
      for (const shirt of formData.shirts) {
        if (shirt.id) {
          // Update existing shirt
          await apiRequest("PATCH", `/api/admin/events/${createdEventId}/shirts/${shirt.id}`, {
            tamanho: shirt.tamanho,
            quantidadeTotal: shirt.quantidadeTotal,
            quantidadeDisponivel: shirt.quantidadeDisponivel,
            ajustePreco: shirt.ajustePreco
          });
        } else {
          // Create new shirt
          const shirtData = { ...shirt, eventId: createdEventId };
          await apiRequest("POST", `/api/admin/events/${createdEventId}/shirts`, shirtData);
        }
      }

      // Handle attachments (both create and edit mode)
      for (const attachment of formData.attachments) {
        if (attachment.id) {
          // Update existing attachment
          await apiRequest("PATCH", `/api/admin/events/${createdEventId}/attachments/${attachment.id}`, attachment);
        } else {
          // Create new attachment
          const attachmentData = { ...attachment, eventId: createdEventId };
          await apiRequest("POST", `/api/admin/events/${createdEventId}/attachments`, attachmentData);
        }
      }

      queryClient.invalidateQueries({ queryKey: ["/api/admin/events"] });

      toast({
        title: mode === "create" ? "Evento criado!" : "Evento atualizado!",
        description: mode === "create" 
          ? "O evento foi criado com sucesso." 
          : "As alteracoes foram salvas.",
      });

      navigate("/admin/eventos");
    } catch (error) {
      console.error("Error saving event:", error);
      toast({
        variant: "destructive",
        title: "Erro ao salvar",
        description: error instanceof Error ? error.message : "Ocorreu um erro ao salvar o evento.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const breadcrumbs = [
    { label: "Eventos", href: "/admin/eventos" },
    { label: mode === "create" ? "Novo Evento" : "Editar Evento" },
  ];

  return (
    <AdminLayout title={mode === "create" ? "Novo Evento" : "Editar Evento"} breadcrumbs={breadcrumbs}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">
              {mode === "create" ? "Criar Novo Evento" : "Editar Evento"}
            </h1>
            <p className="text-muted-foreground">
              {mode === "create" 
                ? "Preencha as informacoes para criar um novo evento"
                : "Atualize as informacoes do evento"}
            </p>
          </div>
        </div>

        <nav aria-label="Progress">
          <ol className="flex items-center">
            {STEPS.map((step, index) => (
              <li key={step.id} className={cn("relative", index !== STEPS.length - 1 && "flex-1")}>
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => step.id < currentStep && setCurrentStep(step.id)}
                    disabled={step.id > currentStep}
                    className={cn(
                      "relative flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors",
                      step.id < currentStep && "border-primary bg-primary text-primary-foreground",
                      step.id === currentStep && "border-primary bg-background text-primary",
                      step.id > currentStep && "border-muted bg-background text-muted-foreground"
                    )}
                    data-testid={`button-step-${step.id}`}
                  >
                    {step.id < currentStep ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      <span className="text-sm font-medium">{step.id}</span>
                    )}
                  </button>
                  {index !== STEPS.length - 1 && (
                    <div
                      className={cn(
                        "ml-2 h-0.5 w-full",
                        step.id < currentStep ? "bg-primary" : "bg-muted"
                      )}
                    />
                  )}
                </div>
                <div className="mt-2 hidden md:block">
                  <span className={cn(
                    "text-sm font-medium",
                    step.id === currentStep ? "text-foreground" : "text-muted-foreground"
                  )}>
                    {step.title}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        </nav>

        <Card>
          <CardHeader>
            <CardTitle>{STEPS[currentStep - 1].title}</CardTitle>
            <CardDescription>{STEPS[currentStep - 1].description}</CardDescription>
          </CardHeader>
          <CardContent>
            {currentStep === 1 && (
              <EventBasicInfoStep formData={formData} updateFormData={updateFormData} />
            )}
            {currentStep === 2 && (
              <EventModalitiesStep formData={formData} updateFormData={updateFormData} />
            )}
            {currentStep === 3 && (
              <EventBatchesStep formData={formData} updateFormData={updateFormData} />
            )}
            {currentStep === 4 && (
              <EventFinishStep formData={formData} updateFormData={updateFormData} />
            )}
          </CardContent>
        </Card>

        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={handlePrev}
            disabled={currentStep === 1 || isSubmitting}
            data-testid="button-prev-step"
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Anterior
          </Button>

          <div className="flex gap-2">
            {mode === "edit" && currentStep < 4 && (
              <Button
                variant="secondary"
                onClick={handleSubmit}
                disabled={isSubmitting}
                data-testid="button-save-now"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  "Salvar Alteracoes"
                )}
              </Button>
            )}

            {currentStep < 4 ? (
              <Button
                onClick={handleNext}
                disabled={!canProceed() || isSubmitting}
                data-testid="button-next-step"
              >
                Proximo
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                data-testid="button-submit-event"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  mode === "create" ? "Criar Evento" : "Salvar Alteracoes"
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
