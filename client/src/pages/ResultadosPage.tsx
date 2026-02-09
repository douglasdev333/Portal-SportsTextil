import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import EventCard from "@/components/EventCard";
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
import { Search, Trophy, ChevronLeft, ChevronRight, CalendarX } from "lucide-react";
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

export default function ResultadosPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCity, setSelectedCity] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);

  const isDesktop = useMediaQuery("(min-width: 768px)");
  const eventsPerPage = isDesktop ? 12 : 8;

  const { data, isLoading } = useQuery<{ success: boolean; data: Event[] }>({
    queryKey: ["/api/events"],
  });

  const events = data?.data || [];

  const now = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const pastEvents = useMemo(() => {
    const past: Event[] = [];
    
    events.forEach(event => {
      const eventDate = new Date(event.dataEvento);
      eventDate.setHours(23, 59, 59, 999);
      
      if (eventDate < now) {
        past.push(event);
      }
    });
    
    past.sort((a, b) => new Date(b.dataEvento).getTime() - new Date(a.dataEvento).getTime());
    
    return past;
  }, [events, now]);

  const cities = useMemo(() => {
    const uniqueCities = Array.from(new Set(pastEvents.map(e => e.cidade))).sort();
    return uniqueCities;
  }, [pastEvents]);

  const filteredEvents = useMemo(() => {
    return pastEvents.filter(event => {
      const matchesSearch = searchTerm === "" || 
        event.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        event.cidade.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCity = selectedCity === "all" || event.cidade === selectedCity;
      
      return matchesSearch && matchesCity;
    });
  }, [pastEvents, searchTerm, selectedCity]);

  const totalPages = Math.ceil(filteredEvents.length / eventsPerPage);
  const paginatedEvents = filteredEvents.slice(
    (currentPage - 1) * eventsPerPage,
    currentPage * eventsPerPage
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCity]);

  const handlePrevious = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      
      <main className="flex-1">
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-background py-8 md:py-12 border-b border-border">
          <div className="max-w-7xl mx-auto px-4 md:px-6">
            <div className="flex items-center gap-3 mb-2">
              <Trophy className="h-8 w-8 text-primary" />
              <h1 className="text-2xl md:text-4xl font-bold text-foreground">
                Resultados
              </h1>
            </div>
            <p className="text-muted-foreground text-lg">
              Confira os resultados dos eventos já realizados
            </p>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Buscar por nome ou cidade..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={selectedCity} onValueChange={setSelectedCity}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="Todas as cidades" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as cidades</SelectItem>
                {cities.map((city) => (
                  <SelectItem key={city} value={city}>
                    {city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="space-y-4">
                  <Skeleton className="h-48 w-full rounded-lg" />
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))}
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="text-center py-16">
              <CalendarX className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
              <h2 className="text-xl font-semibold text-foreground mb-2">
                Nenhum evento encontrado
              </h2>
              <p className="text-muted-foreground">
                {searchTerm || selectedCity !== "all" 
                  ? "Tente ajustar os filtros de busca" 
                  : "Ainda não há eventos realizados"}
              </p>
            </div>
          ) : (
            <>
              {totalPages > 1 && (
                <div className="flex items-center justify-between gap-4 mb-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePrevious}
                    disabled={currentPage === 1}
                    className="gap-1"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span className="hidden sm:inline">Anterior</span>
                  </Button>
                  
                  <span className="text-sm text-muted-foreground">
                    Página <span className="font-medium text-foreground">{currentPage}</span> de{" "}
                    <span className="font-medium text-foreground">{totalPages}</span>
                    <span className="hidden sm:inline text-muted-foreground/70"> ({filteredEvents.length} eventos)</span>
                  </span>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNext}
                    disabled={currentPage === totalPages}
                    className="gap-1"
                  >
                    <span className="hidden sm:inline">Próxima</span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}

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
                    isPast={true}
                  />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between gap-4 mt-6">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePrevious}
                    disabled={currentPage === 1}
                    className="gap-1"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span className="hidden sm:inline">Anterior</span>
                  </Button>
                  
                  <span className="text-sm text-muted-foreground">
                    Página <span className="font-medium text-foreground">{currentPage}</span> de{" "}
                    <span className="font-medium text-foreground">{totalPages}</span>
                  </span>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNext}
                    disabled={currentPage === totalPages}
                    className="gap-1"
                  >
                    <span className="hidden sm:inline">Próxima</span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
