import EventCard from '../EventCard';
import heroImage from '@assets/generated_images/Marathon_runners_landscape_hero_b439e181.png';

export default function EventCardExample() {
  return (
    <div className="p-6 bg-background">
      <div className="max-w-sm">
        <EventCard
          id="1"
          slug="maratona-sao-paulo-2025"
          nome="Maratona de São Paulo 2025"
          data="2025-05-15"
          local="Parque Ibirapuera"
          cidade="São Paulo"
          estado="SP"
          distancias="5km, 10km, 21km, 42km"
          imagemUrl={heroImage}
          valor="R$ 120,00"
        />
      </div>
    </div>
  );
}
