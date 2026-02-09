import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import EventCard from "@/components/EventCard";
import ComingSoonCard from "@/components/ComingSoonCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, CalendarX, MapPin, Calendar, Trophy, ChevronLeft, ChevronRight, CalendarCheck } from "lucide-react";
import heroBanner from '@assets/hero-banner.jpg';
import type { Event } from "@shared/schema";

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) {
      setMatches(media.matches);
    }
    const listener = () => setMatches(media.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [matches, query]);

  return matches;
}

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  onPrevious: () => void;
  onNext: () => void;
  position: "top" | "bottom";
  testIdPrefix: string;
  variant?: "default" | "muted";
}

function PaginationControls({
  currentPage,
  totalPages,
  totalItems,
  onPrevious,
  onNext,
  position,
  testIdPrefix,
  variant = "default",
}: PaginationControlsProps) {
  if (totalPages <= 1) return null;

  const buttonVariant = variant === "muted" ? "secondary" : "outline";

  return (
    <div className={`flex items-center justify-between gap-4 ${position === "top" ? "mb-4" : "mt-6"}`}>
      <Button
        variant={buttonVariant}
        size="sm"
        onClick={onPrevious}
        disabled={currentPage === 1}
        className="gap-1"
        data-testid={`${testIdPrefix}-prev-${position}`}
      >
        <ChevronLeft className="h-4 w-4" />
        <span className="hidden sm:inline">Anterior</span>
      </Button>
      
      <span className="text-sm text-muted-foreground">
        Página <span className="font-medium text-foreground">{currentPage}</span> de{" "}
        <span className="font-medium text-foreground">{totalPages}</span>
        <span className="hidden sm:inline text-muted-foreground/70"> ({totalItems} eventos)</span>
      </span>
      
      <Button
        variant={buttonVariant}
        size="sm"
        onClick={onNext}
        disabled={currentPage === totalPages}
        className="gap-1"
        data-testid={`${testIdPrefix}-next-${position}`}
      >
        <span className="hidden sm:inline">Próxima</span>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

interface EventsSectionProps {
  events: Event[];
  isPast: boolean;
  perPage: number;
  isLoading?: boolean;
  emptyState?: React.ReactNode;
  title: string;
  subtitle: string;
  icon?: React.ReactNode;
  testIdPrefix: string;
  variant?: "default" | "muted";
}

function EventsSection({
  events,
  isPast,
  perPage,
  isLoading,
  emptyState,
  title,
  subtitle,
  icon,
  testIdPrefix,
  variant = "default",
}: EventsSectionProps) {
  const [currentPage, setCurrentPage] = useState(1);
  
  useEffect(() => {
    setCurrentPage(1);
  }, [events.length, perPage]);

  const totalPages = Math.ceil(events.length / perPage);
  const startIndex = (currentPage - 1) * perPage;
  const paginatedEvents = events.slice(startIndex, startIndex + perPage);

  const handlePrevious = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleNext = () => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const containerClass = variant === "muted" 
    ? "bg-muted/40 dark:bg-muted/20 -mx-4 md:-mx-6 px-4 md:px-6 py-8 rounded-none" 
    : "";

  if (isLoading) {
    return (
      <section className={`mb-12 ${containerClass}`}>
        <div className="mb-6">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground">{title}</h2>
          <p className="text-muted-foreground mt-1">Carregando...</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-4">
              <Skeleton className="h-48 w-full rounded-lg" />
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (events.length === 0) {
    return emptyState ? (
      <section className="mb-12">
        <div className="mb-6">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground">{title}</h2>
          <p className="text-muted-foreground mt-1">{subtitle}</p>
        </div>
        {emptyState}
      </section>
    ) : null;
  }

  return (
    <section className={containerClass}>
      <div className="mb-4">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-2xl md:text-3xl font-bold text-foreground">{title}</h2>
        </div>
        <p className="text-muted-foreground mt-1">{subtitle}</p>
      </div>

      <PaginationControls
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={events.length}
        onPrevious={handlePrevious}
        onNext={handleNext}
        position="top"
        testIdPrefix={testIdPrefix}
        variant={variant}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {paginatedEvents.map((event) => (
          <EventCard
            key={event.id}
            id={event.id}
            slug={event.slug}
            nome={event.nome}
            data={event.dataEvento}
            local={event.endereco}
            cidade={event.cidade}
            estado={event.estado}
            imagemUrl={event.bannerUrl || heroBanner}
            isPast={isPast}
          />
        ))}
        {!isPast && currentPage === 1 && paginatedEvents.length < 4 && 
          Array.from({ length: 4 - paginatedEvents.length }).map((_, index) => (
            <ComingSoonCard key={`coming-soon-${index}`} index={index} />
          ))
        }
      </div>

      <PaginationControls
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={events.length}
        onPrevious={handlePrevious}
        onNext={handleNext}
        position="bottom"
        testIdPrefix={testIdPrefix}
        variant={variant}
      />
    </section>
  );
}

export default function EventosPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCity, setSelectedCity] = useState<string>("all");
  const [selectedDate, setSelectedDate] = useState<string>("all");

  const isDesktop = useMediaQuery("(min-width: 768px)");
  const eventsPerPage = isDesktop ? 12 : 8;

  const { data, isLoading } = useQuery<{ success: boolean; data: Event[] }>({
    queryKey: ["/api/events"],
  });

  const events = data?.data || [];

  const cities = useMemo(() => {
    const uniqueCities = Array.from(new Set(events.map(e => e.cidade))).sort();
    return uniqueCities;
  }, [events]);

  const dateOptions = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    const options = [];
    for (let i = 0; i < 6; i++) {
      const date = new Date(currentYear, currentMonth + i, 1);
      const monthName = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      options.push({
        value: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
        label: monthName.charAt(0).toUpperCase() + monthName.slice(1)
      });
    }
    return options;
  }, []);

  const now = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const { upcomingEvents, pastEvents } = useMemo(() => {
    const upcoming: Event[] = [];
    const past: Event[] = [];
    
    events.forEach(event => {
      const eventDate = new Date(event.dataEvento);
      eventDate.setHours(23, 59, 59, 999);
      
      if (eventDate >= now) {
        upcoming.push(event);
      } else {
        past.push(event);
      }
    });
    
    upcoming.sort((a, b) => new Date(a.dataEvento).getTime() - new Date(b.dataEvento).getTime());
    past.sort((a, b) => new Date(b.dataEvento).getTime() - new Date(a.dataEvento).getTime());
    
    return { upcomingEvents: upcoming, pastEvents: past };
  }, [events, now]);

  const filterEvents = (eventsList: Event[]) => {
    return eventsList.filter(event => {
      const matchesSearch = searchTerm === "" || 
        event.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        event.cidade.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCity = selectedCity === "all" || event.cidade === selectedCity;
      
      let matchesDate = true;
      if (selectedDate !== "all" && event.dataEvento) {
        const eventDate = new Date(event.dataEvento);
        const [year, month] = selectedDate.split('-');
        matchesDate = eventDate.getFullYear() === parseInt(year) && 
                      (eventDate.getMonth() + 1) === parseInt(month);
      }
      
      return matchesSearch && matchesCity && matchesDate;
    });
  };

  const filteredUpcoming = filterEvents(upcomingEvents);
  const filteredPast = filterEvents(pastEvents);

  const hasFilters = searchTerm || selectedCity !== "all" || selectedDate !== "all";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      
      <main className="flex-1">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/70 z-10"></div>
          <img
            src={heroBanner}
            alt="Corrida de rua"
            className="w-full h-[300px] md:h-[400px] object-cover"
          />
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center">
            <div className="text-center px-4 max-w-3xl">
              <p className="text-sm md:text-base uppercase tracking-widest text-white/80 mb-2 font-medium">
                Portal de Inscrições
              </p>
              <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
                Sua próxima conquista começa aqui
              </h1>
              <p className="text-lg md:text-xl text-white/90">
                Descubra e inscreva-se nos melhores eventos de corrida.
              </p>
            </div>
          </div>
        </div>

        <div className="relative z-30 -mt-8 mb-8">
          <div className="max-w-4xl mx-auto px-4">
            <div className="bg-white dark:bg-card rounded-lg shadow-xl p-2 flex flex-col md:flex-row items-stretch gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Digite para procurar..."
                  className="pl-10 border-0 shadow-none focus-visible:ring-0 h-12"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  data-testid="input-search-events"
                />
              </div>
              
              <div className="hidden md:block w-px bg-border"></div>
              
              <div className="flex-1">
                <Select value={selectedCity} onValueChange={setSelectedCity}>
                  <SelectTrigger className="border-0 shadow-none focus:ring-0 h-12" data-testid="select-city">
                    <MapPin className="h-5 w-5 text-muted-foreground mr-2" />
                    <SelectValue placeholder="Local" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os locais</SelectItem>
                    {cities.map(city => (
                      <SelectItem key={city} value={city}>{city}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="hidden md:block w-px bg-border"></div>
              
              <div className="flex-1">
                <Select value={selectedDate} onValueChange={setSelectedDate}>
                  <SelectTrigger className="border-0 shadow-none focus:ring-0 h-12" data-testid="select-date">
                    <Calendar className="h-5 w-5 text-muted-foreground mr-2" />
                    <SelectValue placeholder="Todas as datas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as datas</SelectItem>
                    {dateOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <Button 
                size="lg" 
                className="h-12 px-8"
                data-testid="button-search"
              >
                <Search className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 md:px-6 pb-8 md:pb-12">
          <EventsSection
            events={filteredUpcoming}
            isPast={false}
            perPage={eventsPerPage}
            isLoading={isLoading}
            title="Próximos Eventos"
            subtitle={`${filteredUpcoming.length} ${filteredUpcoming.length === 1 ? 'evento disponível' : 'eventos disponíveis'}`}
            icon={<CalendarCheck className="h-6 w-6 text-primary" />}
            testIdPrefix="upcoming"
            variant="default"
            emptyState={
              <div className="text-center py-12 bg-muted/30 rounded-lg">
                <CalendarX className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                {hasFilters ? (
                  <p className="text-muted-foreground text-lg">
                    Nenhum evento encontrado com os filtros selecionados
                  </p>
                ) : (
                  <>
                    <p className="text-muted-foreground text-lg mb-2">
                      Nenhum evento disponível no momento
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Novos eventos serão publicados em breve. Volte mais tarde!
                    </p>
                  </>
                )}
              </div>
            }
          />

          {filteredPast.length > 0 && (
            <>
              <div className="my-10 flex items-center gap-4">
                <div className="flex-1 h-px bg-border"></div>
                <span className="text-sm text-muted-foreground font-medium uppercase tracking-wider">Histórico</span>
                <div className="flex-1 h-px bg-border"></div>
              </div>

              <EventsSection
                events={filteredPast}
                isPast={true}
                perPage={eventsPerPage}
                title="Eventos Realizados"
                subtitle={`${filteredPast.length} ${filteredPast.length === 1 ? 'evento realizado' : 'eventos realizados'} - Confira os resultados`}
                icon={<Trophy className="h-6 w-6 text-accent" />}
                testIdPrefix="past"
                variant="muted"
              />
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
