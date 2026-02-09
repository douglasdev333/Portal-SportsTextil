import InscricaoCard from '../InscricaoCard';
import cityImage from '@assets/generated_images/City_marathon_aerial_view_94ce50b6.png';

export default function InscricaoCardExample() {
  return (
    <div className="p-6 bg-background">
      <InscricaoCard
        id="1"
        eventoNome="Maratona de São Paulo 2025"
        eventoData="2025-05-15"
        eventoLocal="Parque Ibirapuera, São Paulo - SP"
        distancia="21km"
        status="confirmada"
        eventoImagem={cityImage}
      />
    </div>
  );
}
