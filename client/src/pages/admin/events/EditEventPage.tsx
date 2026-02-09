import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Loader2 } from "lucide-react";
import EventWizard from "./EventWizard";
import type { EventFormData } from "./EventWizard";

export default function EditEventPage() {
  const params = useParams<{ id: string }>();
  const eventId = params.id;

  const { data: eventData, isLoading, error } = useQuery({
    queryKey: ["/api/admin/events", eventId, "full"],
    queryFn: async () => {
      const response = await fetch(`/api/admin/events/${eventId}/full`, {
        credentials: "include"
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error?.message);
      return result.data;
    },
    enabled: !!eventId,
  });

  if (isLoading) {
    return (
      <AdminLayout title="Carregando..." breadcrumbs={[{ label: "Eventos", href: "/admin/eventos" }]}>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  if (error || !eventData) {
    return (
      <AdminLayout title="Erro" breadcrumbs={[{ label: "Eventos", href: "/admin/eventos" }]}>
        <div className="text-center py-12">
          <p className="text-destructive">Erro ao carregar evento</p>
        </div>
      </AdminLayout>
    );
  }

  const { modalities, batches, prices, shirtSizes, attachments, banners, ...event } = eventData;

  const initialData: EventFormData = {
    event,
    modalities: modalities || [],
    batches: batches || [],
    prices: (prices || []).map((p: any) => {
      const modalityIndex = (modalities || []).findIndex((m: any) => m.id === p.modalityId);
      const batchIndex = (batches || []).findIndex((b: any) => b.id === p.batchId);
      return { modalityIndex, batchIndex, valor: p.valor };
    }),
    shirts: shirtSizes || [],
    attachments: attachments || [],
    banners: (banners || []).map((b: any) => ({
      id: b.id,
      url: b.imagemUrl,
      ordem: b.ordem
    })),
  };

  return <EventWizard mode="edit" eventId={eventId} initialData={initialData} />;
}
