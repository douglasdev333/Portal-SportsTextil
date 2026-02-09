import { useState, useRef, useCallback } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, MapPin, Award, Info, FileText, Download, Package, AlertCircle, XCircle, CalendarClock, Trophy, CheckCircle, Tag, Users, Timer, Map, ExternalLink, Link2, ZoomIn, ZoomOut, Share2, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import heroImage from '@assets/generated_images/Marathon_runners_landscape_hero_b439e181.png';
import { formatDateOnlyLong } from "@/lib/timezone";
import type { Event, Modality, RegistrationBatch, Price, Attachment } from "@shared/schema";

function ZoomableImage({ src, alt }: { src: string; alt: string }) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const lastPosition = useRef({ x: 0, y: 0 });
  const lastPinchDistance = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const clampPosition = useCallback((pos: { x: number; y: number }, currentScale: number) => {
    if (currentScale <= 1) return { x: 0, y: 0 };
    const maxOffset = (currentScale - 1) * 150;
    return {
      x: Math.max(-maxOffset, Math.min(maxOffset, pos.x)),
      y: Math.max(-maxOffset, Math.min(maxOffset, pos.y))
    };
  }, []);

  const handleZoomIn = useCallback(() => {
    setScale(s => Math.min(s + 0.5, 4));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale(s => {
      const newScale = Math.max(s - 0.5, 1);
      if (newScale === 1) setPosition({ x: 0, y: 0 });
      return newScale;
    });
  }, []);

  const handleReset = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      lastPosition.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    }
  }, [scale, position]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging && scale > 1) {
      const newPos = {
        x: e.clientX - lastPosition.current.x,
        y: e.clientY - lastPosition.current.y
      };
      setPosition(clampPosition(newPos, scale));
    }
  }, [isDragging, scale, clampPosition]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const getDistance = (touches: React.TouchList) => {
    return Math.hypot(
      touches[0].clientX - touches[1].clientX,
      touches[0].clientY - touches[1].clientY
    );
  };

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      lastPinchDistance.current = getDistance(e.touches);
    } else if (e.touches.length === 1 && scale > 1) {
      setIsDragging(true);
      lastPosition.current = { 
        x: e.touches[0].clientX - position.x, 
        y: e.touches[0].clientY - position.y 
      };
    }
  }, [scale, position]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastPinchDistance.current !== null) {
      e.preventDefault();
      const newDistance = getDistance(e.touches);
      const scaleDelta = (newDistance - lastPinchDistance.current) * 0.01;
      setScale(s => Math.max(1, Math.min(4, s + scaleDelta)));
      lastPinchDistance.current = newDistance;
    } else if (isDragging && e.touches.length === 1 && scale > 1) {
      const newPos = {
        x: e.touches[0].clientX - lastPosition.current.x,
        y: e.touches[0].clientY - lastPosition.current.y
      };
      setPosition(clampPosition(newPos, scale));
    }
  }, [isDragging, scale, clampPosition]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      lastPinchDistance.current = null;
    }
    if (e.touches.length === 0) {
      setIsDragging(false);
      if (scale < 1) {
        setScale(1);
        setPosition({ x: 0, y: 0 });
      }
    }
  }, [scale]);

  const handleDoubleClick = useCallback(() => {
    if (scale === 1) {
      setScale(2);
    } else {
      handleReset();
    }
  }, [scale, handleReset]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-center gap-2 p-2 border-b bg-muted/30">
        <Button variant="outline" size="sm" onClick={handleZoomOut} disabled={scale <= 1}>
          <ZoomOut className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium min-w-[60px] text-center">{Math.round(scale * 100)}%</span>
        <Button variant="outline" size="sm" onClick={handleZoomIn} disabled={scale >= 4}>
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={handleReset} disabled={scale === 1}>
          Resetar
        </Button>
      </div>
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden cursor-grab active:cursor-grabbing bg-muted/10"
        style={{ touchAction: 'none' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onDoubleClick={handleDoubleClick}
      >
        <div 
          className="w-full h-full flex items-center justify-center p-4 select-none"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transition: isDragging || lastPinchDistance.current !== null ? 'none' : 'transform 0.2s ease-out',
            transformOrigin: 'center center'
          }}
        >
          <img 
            src={src} 
            alt={alt}
            className="max-w-full max-h-[60vh] object-contain rounded-lg pointer-events-none"
            draggable={false}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground text-center p-2 border-t">
        <span className="hidden md:inline">Duplo clique para zoom | Arraste para mover</span>
        <span className="md:hidden">Pinça para zoom | Arraste para mover</span>
      </p>
    </div>
  );
}

interface ModalityWithAvailability extends Modality {
  isAvailable?: boolean;
  isSoldOut?: boolean;
}

interface EventWithDetails extends Event {
  modalities: ModalityWithAvailability[];
  activeBatch: RegistrationBatch | null;
  activeBatches: RegistrationBatch[];
  prices: Price[];
  attachments: Attachment[];
  eventSoldOut?: boolean;
  registrationStatus?: 'not_started' | 'open' | 'closed' | 'sold_out' | 'finished';
  registrationMessage?: string | null;
  urlResultados?: string | null;
}

export default function EventoDetailPage() {
  const [, params] = useRoute("/evento/:slug");
  const [, setLocation] = useLocation();
  const slug = params?.slug;
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const { data, isLoading, error } = useQuery<{ success: boolean; data: EventWithDetails }>({
    queryKey: ["/api/events", slug],
    queryFn: async () => {
      const response = await fetch(`/api/events/${slug}`);
      return response.json();
    },
    enabled: !!slug,
  });

  const event = data?.data;

  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  
  const handleShare = async () => {
    if (navigator.share && event) {
      try {
        await navigator.share({
          title: event.nome,
          text: `Confira o evento ${event.nome}!`,
          url: shareUrl,
        });
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          handleCopyLink();
        }
      }
    } else {
      handleCopyLink();
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast({
      title: "Link copiado!",
      description: "O link do evento foi copiado para a área de transferência.",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareWhatsApp = () => {
    if (!event) return;
    const text = encodeURIComponent(`Confira o evento ${event.nome}!\n${shareUrl}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
          <Skeleton className="w-full aspect-[4/3] md:aspect-[21/9] rounded-lg mb-8" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
            <div>
              <Skeleton className="h-64 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-16 text-center">
          <AlertCircle className="h-16 w-16 mx-auto text-destructive mb-4" />
          <h1 className="text-2xl font-bold mb-2">Evento não encontrado</h1>
          <p className="text-muted-foreground mb-6">
            O evento que você está procurando não existe ou não está mais disponível.
          </p>
          <Button onClick={() => setLocation("/")} data-testid="button-voltar">
            Ver todos os eventos
          </Button>
        </div>
      </div>
    );
  }

  const formattedDate = formatDateOnlyLong(event.dataEvento);

  const handleInscricao = () => {
    setLocation(`/evento/${event.slug}/inscricao/participante`);
  };

  const handleDownload = (url: string, nome: string) => {
    window.open(url, '_blank');
  };

  const getPrice = (modalityId: string): string => {
    const modality = modalities.find(m => m.id === modalityId);
    
    // Modalidade gratuita: deixar em branco
    if (modality?.tipoAcesso === "gratuita") return "";
    
    const price = event.prices?.find(p => p.modalityId === modalityId);
    if (!price) return "Consulte";
    
    const valor = parseFloat(price.valor);
    
    // Voucher com valor 0: mostrar "Voucher"
    if (modality?.tipoAcesso === "voucher" && valor === 0) return "Voucher";
    
    // Valor 0 (não voucher): deixar em branco
    if (valor === 0) return "";
    
    return `R$ ${valor.toFixed(2).replace('.', ',')}`;
  };

  const getLowestPrice = (): string => {
    const paidModalities = modalities.filter(m => m.tipoAcesso !== "gratuita");
    
    // Todas modalidades são gratuitas: deixar em branco
    if (paidModalities.length === 0) return "";
    
    const prices = paidModalities.map(mod => {
      const price = event.prices?.find(p => p.modalityId === mod.id);
      return price ? parseFloat(price.valor) : Infinity;
    }).filter(p => p !== Infinity && p > 0);
    
    if (prices.length === 0) {
      // Sem preços pagos: verificar se há vouchers
      const hasVoucher = modalities.some(m => m.tipoAcesso === "voucher");
      return hasVoucher ? "Voucher" : "";
    }
    
    const minPrice = Math.min(...prices);
    return `R$ ${minPrice.toFixed(2).replace('.', ',')}`;
  };

  const modalities = (event.modalities || [])
    .filter(mod => mod.ativo !== false)
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  const attachments = event.attachments || [];
  const activeBatches = event.activeBatches || [];
  const eventSoldOut = event.eventSoldOut || event.status === 'esgotado';
  const isFinished = event.status === 'finalizado';
  const registrationStatus = event.registrationStatus || (isFinished ? 'finished' : eventSoldOut ? 'sold_out' : 'open');
  const registrationMessage = event.registrationMessage;
  
  const getMobileRegistrationMessage = () => {
    if (!registrationMessage) return null;
    const match = registrationMessage.match(/(\d{2}\/\d{2}\/\d{4})/);
    if (match) {
      return `Início ${match[1]}`;
    }
    return registrationMessage;
  };
  const mobileRegistrationMessage = getMobileRegistrationMessage();
  
  const canRegister = registrationStatus === 'open';

  // Get unique distances
  const uniqueDistances = Array.from(new Set(modalities.map(mod => `${mod.distancia} ${mod.unidadeDistancia}`)));
  
  const getButtonText = () => {
    switch (registrationStatus) {
      case 'not_started':
        return 'Inscrições em Breve';
      case 'closed':
        return 'Inscrições Encerradas';
      case 'sold_out':
        return 'Evento Esgotado';
      case 'finished':
        return 'Ver Resultados';
      default:
        return 'Inscrever-se';
    }
  };
  
  const getStatusBadge = () => {
    switch (registrationStatus) {
      case 'not_started':
        return (
          <Badge variant="secondary" className="text-sm px-3 py-1">
            <CalendarClock className="h-4 w-4 mr-1" />
            Em Breve
          </Badge>
        );
      case 'closed':
        return (
          <Badge variant="destructive" className="text-sm px-3 py-1">
            <XCircle className="h-4 w-4 mr-1" />
            Encerrado
          </Badge>
        );
      case 'sold_out':
        return (
          <Badge variant="destructive" className="text-sm px-3 py-1">
            <XCircle className="h-4 w-4 mr-1" />
            Esgotado
          </Badge>
        );
      case 'finished':
        return (
          <Badge className="text-sm px-3 py-1 bg-green-600">
            <CheckCircle className="h-4 w-4 mr-1" />
            Finalizado
          </Badge>
        );
      default:
        return (
          <Badge className="text-sm px-3 py-1 bg-green-600">
            <CheckCircle className="h-4 w-4 mr-1" />
            Inscrições Abertas
          </Badge>
        );
    }
  };

  const formatBatchDate = (dateStr: string | Date | null) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="max-w-7xl mx-auto px-3 md:px-6 py-4 md:py-8">
        {/* Banner with 16:9 aspect ratio */}
        <div className="relative rounded-lg overflow-hidden mb-4 md:mb-8">
          <div className="aspect-[16/9]">
            <img
              src={event.bannerUrl || heroImage}
              alt={event.nome}
              className="w-full h-full object-cover"
            />
            {/* Overlay only on desktop */}
            <div className="hidden md:block absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent"></div>
          </div>
          {/* Info inside banner - desktop only */}
          <div className="hidden md:block absolute bottom-0 left-0 right-0 p-8">
            <div className="flex flex-wrap items-center justify-between mb-3">
              <div className="flex flex-wrap items-center gap-3">
                {getStatusBadge()}
              </div>
              {/* Share dropdown - desktop */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" size="sm" className="gap-2 bg-white/20 hover:bg-white/30 text-white border-white/30">
                    <Share2 className="h-4 w-4" />
                    Compartilhar
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleShare} className="gap-2 cursor-pointer">
                    <Share2 className="h-4 w-4" />
                    Compartilhar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleCopyLink} className="gap-2 cursor-pointer">
                    {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                    {copied ? "Link copiado!" : "Copiar link"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <h1 className="text-3xl lg:text-4xl font-bold text-white mb-3">
              {event.nome}
            </h1>
            <div className="flex flex-wrap gap-2">
              {uniqueDistances.map((distance) => (
                <Badge key={distance} variant="secondary" className="text-sm bg-white/20 text-white border-white/30">
                  {distance}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        {/* Info below banner - mobile only */}
        <div className="md:hidden mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex flex-wrap items-center gap-2">
              {getStatusBadge()}
            </div>
            {/* Share dropdown - mobile */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-9 w-9">
                  <Share2 className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleShare} className="gap-2 cursor-pointer">
                  <Share2 className="h-4 w-4" />
                  Compartilhar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleShareWhatsApp} className="gap-2 cursor-pointer text-green-600">
                  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  WhatsApp
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleCopyLink} className="gap-2 cursor-pointer">
                  {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Link copiado!" : "Copiar link"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">
            {event.nome}
          </h1>
          <div className="flex flex-wrap gap-1.5">
            {uniqueDistances.map((distance) => (
              <Badge key={distance} variant="secondary" className="text-xs">
                {distance}
              </Badge>
            ))}
          </div>
        </div>


        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-8">
          <div className="lg:col-span-2 pb-24 md:pb-0">
            {/* Event Info Cards */}
            <div className="grid grid-cols-2 gap-2 md:gap-4 mb-4 md:mb-8">
              <Card className="p-3 md:p-0">
                <CardHeader className="p-0 md:p-6 pb-1 md:pb-3">
                  <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground flex items-center gap-1.5 md:gap-2">
                    <Calendar className="h-3.5 w-3.5 md:h-4 md:w-4" />
                    Data
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 md:p-6 md:pt-0">
                  <p className="font-semibold text-foreground text-sm md:text-lg">{formattedDate}</p>
                </CardContent>
              </Card>

              <Card className="p-3 md:p-0">
                <CardHeader className="p-0 md:p-6 pb-1 md:pb-3">
                  <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground flex items-center gap-1.5 md:gap-2">
                    <MapPin className="h-3.5 w-3.5 md:h-4 md:w-4" />
                    Local
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 md:p-6 md:pt-0">
                  <p className="font-semibold text-foreground text-sm md:text-base">{event.endereco}</p>
                  <p className="text-xs md:text-sm text-muted-foreground">{event.cidade}, {event.estado}</p>
                </CardContent>
              </Card>
            </div>

            {/* Tabs - Sobre, Kit, Documentos */}
            <Tabs defaultValue="sobre" className="space-y-3 md:space-y-6 mb-6 md:mb-8">
              <div className="overflow-x-auto -mx-3 px-3 md:mx-0 md:px-0">
                <TabsList className="inline-flex w-auto min-w-full md:grid md:w-full md:grid-cols-3 gap-1">
                  <TabsTrigger value="sobre" data-testid="tab-sobre" className="flex-shrink-0 text-xs md:text-sm px-2.5 md:px-4">
                    <Info className="h-3 w-3 md:hidden mr-1" />
                    <span>Sobre</span>
                  </TabsTrigger>
                  <TabsTrigger value="retirada" data-testid="tab-retirada" className="flex-shrink-0 text-xs md:text-sm px-2.5 md:px-4">
                    <Package className="h-3 w-3 md:hidden mr-1" />
                    <span className="hidden md:inline">Retirada Kit</span>
                    <span className="md:hidden">Retirada de Kit</span>
                  </TabsTrigger>
                  <TabsTrigger value="documentos" data-testid="tab-documentos" className="flex-shrink-0 text-xs md:text-sm px-2.5 md:px-4">
                    <FileText className="h-3 w-3 md:hidden mr-1" />
                    <span className="hidden md:inline">Documentos</span>
                    <span className="md:hidden">Docs</span>
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="sobre" className="space-y-4 md:space-y-6">
                <Card>
                  <CardHeader className="p-4 md:p-6">
                    <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                      <Info className="h-4 w-4 md:h-5 md:w-5" />
                      Sobre o Evento
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 md:p-6 pt-0 md:pt-0">
                    <p className="text-sm md:text-base text-muted-foreground leading-relaxed whitespace-pre-wrap">
                      {event.descricao}
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="retirada" className="space-y-4 md:space-y-6">
                <Card>
                  <CardHeader className="p-4 md:p-6">
                    <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                      <Package className="h-4 w-4 md:h-5 md:w-5" />
                      Retirada de Kit
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 md:p-6 pt-0 md:pt-0">
                    {event.informacoesRetiradaKit ? (
                      <p className="text-sm md:text-base text-muted-foreground leading-relaxed whitespace-pre-wrap">
                        {event.informacoesRetiradaKit}
                      </p>
                    ) : (
                      <div className="text-center py-6 md:py-8">
                        <Package className="h-10 w-10 md:h-12 md:w-12 mx-auto text-muted-foreground mb-3 md:mb-4" />
                        <p className="text-sm md:text-base text-muted-foreground font-medium mb-1 md:mb-2">
                          Informações em breve
                        </p>
                        <p className="text-xs md:text-sm text-muted-foreground">
                          As informações sobre retirada de kit serão divulgadas em breve.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="documentos" className="space-y-4 md:space-y-6">
                <Card>
                  <CardHeader className="p-4 md:p-6">
                    <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                      <FileText className="h-4 w-4 md:h-5 md:w-5" />
                      Documentos do Evento
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 md:p-6 pt-0 md:pt-0">
                    {attachments.length > 0 ? (
                      <div className="space-y-2 md:space-y-3">
                        {attachments.map((doc, idx) => (
                          <div
                            key={doc.id}
                            className="flex items-center justify-between p-3 md:p-4 border rounded-lg hover-elevate transition-all"
                          >
                            <div className="flex items-center gap-2 md:gap-3">
                              <FileText className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
                              <div>
                                <p className="font-medium text-foreground text-sm md:text-base">{doc.nome}</p>
                                {doc.obrigatorioAceitar && (
                                  <span className="text-xs text-destructive">Aceite obrigatório</span>
                                )}
                              </div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownload(doc.url, doc.nome)}
                              data-testid={`button-download-${idx}`}
                              className="text-xs md:text-sm"
                            >
                              <Download className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5 md:mr-2" />
                              Baixar
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center py-6 md:py-8 text-sm md:text-base text-muted-foreground">
                        Nenhum documento cadastrado
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {/* Modalidades Section - Separate from tabs */}
            <Card className="mb-6 md:mb-8">
              <CardHeader className="p-4 md:p-6">
                <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                  <Award className="h-4 w-4 md:h-5 md:w-5" />
                  Modalidades {eventSoldOut ? '' : 'Disponíveis'}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 md:p-6 pt-0 md:pt-0">
                {modalities.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3 md:gap-4">
                    {modalities.map((mod) => {
                      const isSoldOut = eventSoldOut || mod.isSoldOut;
                      const showAsComingSoon = registrationStatus === 'not_started';
                      return (
                        <div 
                          key={mod.id} 
                          className={`p-3 md:p-4 border rounded-lg ${isSoldOut && !showAsComingSoon ? 'opacity-60 bg-muted/30' : ''}`}
                          data-testid={`modality-item-${mod.id}`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 md:gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold text-sm md:text-lg">{mod.nome}</h3>
                                {isSoldOut && !showAsComingSoon && (
                                  <Badge variant="destructive" className="text-xs">
                                    Esgotado
                                  </Badge>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-2 md:gap-4 text-xs md:text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Award className="h-3.5 w-3.5 md:h-4 md:w-4" />
                                  {mod.distancia} {mod.unidadeDistancia}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Timer className="h-3.5 w-3.5 md:h-4 md:w-4" />
                                  Largada: {mod.horarioLargada}
                                </span>
                              </div>
                              {mod.descricao && (
                                <p className="text-xs md:text-sm text-muted-foreground mt-1.5 md:mt-2">{mod.descricao}</p>
                              )}
                            </div>
                            <div className="text-right">
                              {!isSoldOut && (
                                <span className="text-lg md:text-xl font-bold text-primary">{getPrice(mod.id)}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-center py-6 md:py-8 text-sm md:text-base text-muted-foreground">
                    Nenhuma modalidade cadastrada
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Batches Card - At the end */}
            {activeBatches.length > 0 && (
              <Card className="mb-6 md:mb-8">
                <CardHeader className="p-4 md:p-6">
                  <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                    <Tag className="h-4 w-4 md:h-5 md:w-5" />
                    Lotes de Inscrição
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 md:p-6 pt-0 md:pt-0">
                  <div className="space-y-3">
                    {activeBatches.map((batch, index) => {
                      const isCurrentBatch = event.activeBatch?.id === batch.id;
                      const eventComingSoon = registrationStatus === 'not_started';
                      const isFuture = batch.status === 'future' || eventComingSoon;
                      const isClosed = batch.status === 'closed' && !eventComingSoon;
                      
                      return (
                        <div 
                          key={batch.id}
                          className={`flex items-center justify-between p-4 rounded-lg border ${
                            isCurrentBatch 
                              ? 'bg-primary/5 border-primary' 
                              : isClosed 
                                ? 'bg-muted/50 opacity-60' 
                                : 'bg-muted/30'
                          }`}
                          data-testid={`batch-item-${index}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${
                              isCurrentBatch ? 'bg-primary' : isClosed ? 'bg-muted-foreground' : 'bg-muted-foreground/50'
                            }`} />
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium">{batch.nome}</span>
                                {isCurrentBatch && (
                                  <Badge variant="default" className="text-xs">Ativo</Badge>
                                )}
                                {isFuture && (
                                  <Badge variant="secondary" className="text-xs">Em breve</Badge>
                                )}
                                {isClosed && (
                                  <Badge variant="outline" className="text-xs">Encerrado</Badge>
                                )}
                              </div>
                              <div className="text-sm text-muted-foreground space-y-0.5">
                                <p><span className="font-medium">Início:</span> {formatBatchDate(batch.dataInicio)}</p>
                                {batch.dataTermino && (
                                  <p><span className="font-medium">Término:</span> {formatBatchDate(batch.dataTermino)}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Percursos Section - Modalidades com imagem ou links de percurso */}
            {modalities.some(mod => mod.imagemUrl || (Array.isArray(mod.linksPercurso) && mod.linksPercurso.length > 0)) && (
              <Card className="mb-6 md:mb-8">
                <CardHeader className="p-4 md:p-6">
                  <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                    <Map className="h-4 w-4 md:h-5 md:w-5" />
                    Percursos
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 md:p-6 pt-0 md:pt-0">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                    {modalities
                      .filter(mod => mod.imagemUrl || (Array.isArray(mod.linksPercurso) && mod.linksPercurso.length > 0))
                      .map((mod) => {
                        const links = Array.isArray(mod.linksPercurso) ? mod.linksPercurso : [];
                        const hasImage = !!mod.imagemUrl;
                        const hasLinks = links.length > 0;
                        
                        return (
                          <Card key={mod.id} className="overflow-hidden">
                            <CardContent className="p-4">
                              <div className="flex items-center gap-2 mb-3">
                                <Award className="h-4 w-4 text-primary" />
                                <h4 className="font-semibold text-sm md:text-base">{mod.nome}</h4>
                                <Badge variant="secondary" className="text-xs ml-auto">
                                  {mod.distancia} {mod.unidadeDistancia}
                                </Badge>
                              </div>
                              
                              <div className="space-y-2">
                                {hasImage && (
                                  <Dialog>
                                    <DialogTrigger asChild>
                                      <Button 
                                        variant="outline" 
                                        size="sm" 
                                        className="w-full justify-start gap-2"
                                        data-testid={`button-view-percurso-image-${mod.id}`}
                                      >
                                        <Map className="h-4 w-4" />
                                        Ver Mapa do Percurso
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-[95vw] md:max-w-4xl h-[85vh] p-0 flex flex-col overflow-hidden">
                                      <DialogHeader className="p-4 pb-2 shrink-0">
                                        <DialogTitle>Percurso - {mod.nome}</DialogTitle>
                                      </DialogHeader>
                                      <div className="flex-1 min-h-0">
                                        <ZoomableImage 
                                          src={mod.imagemUrl!} 
                                          alt={`Percurso ${mod.nome}`}
                                        />
                                      </div>
                                    </DialogContent>
                                  </Dialog>
                                )}
                                
                                {hasLinks && links.map((link, idx) => (
                                  <a
                                    key={idx}
                                    href={link.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 p-2 border rounded-lg hover:bg-muted/50 transition-colors text-sm"
                                    data-testid={`link-percurso-${mod.id}-${idx}`}
                                  >
                                    <Link2 className="h-4 w-4 text-muted-foreground" />
                                    <span className="flex-1 font-medium truncate">
                                      {link.nome || 'Ver no App'}
                                    </span>
                                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                                  </a>
                                ))}
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar - Registration Card */}
          <div className="lg:col-span-1 hidden lg:block">
            <div className="sticky top-8">
              <Card className="overflow-hidden">
                {registrationStatus === 'finished' ? (
                  <div className="p-6">
                    <div className="text-center py-4">
                      <div className="mb-4 p-4 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                        <Trophy className="h-12 w-12 mx-auto text-green-600 dark:text-green-400 mb-3" />
                        <p className="text-lg font-semibold text-green-700 dark:text-green-300 mb-1">
                          Evento Finalizado
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {registrationMessage || 'Confira os resultados oficiais'}
                        </p>
                      </div>
                      <Button
                        size="lg"
                        className="w-full font-semibold bg-green-600"
                        onClick={() => setLocation(`/evento/${event.slug}/resultados`)}
                        data-testid="button-resultados"
                      >
                        <Trophy className="h-4 w-4 mr-2" />
                        Ver Resultados
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Price Header */}
                    <div className="bg-primary p-6 text-primary-foreground">
                      <p className="text-2xl font-bold">Preços e Categorias</p>
                      {event.activeBatch && (
                        <p className="text-sm opacity-90 mt-2">
                          Lote atual: {event.activeBatch.nome}
                        </p>
                      )}
                    </div>
                    
                    <div className="p-6">
                      {registrationMessage && (
                        <div className={`mb-4 p-3 rounded-lg ${
                          registrationStatus === 'not_started' 
                            ? 'bg-secondary/50 border border-secondary' 
                            : 'bg-destructive/10 border border-destructive/20'
                        }`}>
                          <p className={`text-sm font-medium flex items-center gap-2 ${
                            registrationStatus === 'not_started' ? 'text-foreground' : 'text-destructive'
                          }`}>
                            {registrationStatus === 'not_started' ? (
                              <CalendarClock className="h-4 w-4" />
                            ) : (
                              <XCircle className="h-4 w-4" />
                            )}
                            {registrationStatus === 'not_started' ? 'Inscrições em Breve' : 
                             registrationStatus === 'closed' ? 'Inscrições Encerradas' : 'Evento Esgotado'}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {registrationMessage}
                          </p>
                        </div>
                      )}
                      
                      {/* Modalities Summary */}
                      <div className="space-y-2 mb-6">
                        <h4 className="text-sm font-medium text-muted-foreground mb-3">Modalidades</h4>
                        {modalities.map((mod) => {
                          const isSoldOut = eventSoldOut || mod.isSoldOut;
                          const showAsComingSoon = registrationStatus === 'not_started';
                          return (
                            <div 
                              key={mod.id} 
                              className={`flex items-center justify-between py-2 ${isSoldOut && !showAsComingSoon ? 'opacity-60' : ''}`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-sm">{mod.distancia} {mod.unidadeDistancia}</span>
                                <span className="text-xs text-muted-foreground">- {mod.nome}</span>
                              </div>
                              {isSoldOut && !showAsComingSoon ? (
                                <Badge variant="destructive" className="text-xs">
                                  Esgotado
                                </Badge>
                              ) : showAsComingSoon ? (
                                <span className="font-semibold text-sm text-muted-foreground">Em breve</span>
                              ) : (
                                <span className="font-semibold text-sm">{getPrice(mod.id)}</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      
                      <Button
                        size="lg"
                        className="w-full font-semibold"
                        onClick={handleInscricao}
                        disabled={!canRegister}
                        data-testid="button-inscricao"
                      >
                        {getButtonText()}
                      </Button>
                      
                      {canRegister && (
                        <p className="text-xs text-muted-foreground text-center mt-3">
                          Inscrição rápida e segura
                        </p>
                      )}
                    </div>
                  </>
                )}
              </Card>
            </div>
          </div>
        </div>
      </div>
      {/* Mobile Fixed Bottom Bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-background border-t shadow-lg z-50">
        <div className="px-4 py-3">
          {registrationStatus === 'finished' ? (
            <Button
              size="lg"
              className="w-full font-semibold bg-green-600"
              onClick={() => setLocation(`/evento/${event.slug}/resultados`)}
              data-testid="button-resultados-mobile"
            >
              <Trophy className="h-4 w-4 mr-2" />
              Ver Resultados
            </Button>
          ) : canRegister ? (
            <Button
              size="lg"
              className="w-full font-semibold"
              onClick={handleInscricao}
              data-testid="button-inscricao-mobile"
            >
              Inscrever-se
            </Button>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0 overflow-hidden">
                <div className="flex items-center gap-2">
                  {registrationStatus === 'not_started' ? (
                    <CalendarClock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                  )}
                  <span className={`text-sm font-medium truncate ${registrationStatus === 'not_started' ? 'text-foreground' : 'text-destructive'}`}>
                    {registrationStatus === 'not_started' ? 'Inscrições em Breve' : 
                     registrationStatus === 'closed' ? 'Inscrições Encerradas' : 'Evento Esgotado'}
                  </span>
                </div>
                {mobileRegistrationMessage && (
                  <p className="text-xs text-muted-foreground mt-1 truncate">{mobileRegistrationMessage}</p>
                )}
              </div>
              <Button
                size="default"
                variant="secondary"
                className="font-semibold flex-shrink-0 whitespace-nowrap"
                disabled
                data-testid="button-inscricao-mobile-disabled"
              >
                {getButtonText()}
              </Button>
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}
