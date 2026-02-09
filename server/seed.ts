import { db } from "./db";
import { 
  organizers, events, modalities, registrationBatches, prices, 
  shirtSizes, attachments, athletes 
} from "@shared/schema";
import { sql } from "drizzle-orm";

async function seed() {
  console.log("Iniciando seed do banco de dados...");

  try {
    const existingOrganizers = await db.select().from(organizers);
    if (existingOrganizers.length > 0) {
      console.log("Banco ja possui dados. Pulando seed.");
      return;
    }

    console.log("Criando organizador...");
    const [organizador] = await db.insert(organizers).values({
      nome: "ST Eventos Esportivos",
      cpfCnpj: "12.345.678/0001-90",
      email: "contato@steventos.com.br",
      telefone: "(11) 99999-0000"
    }).returning();

    console.log("Criando eventos...");
    
    const dataEvento1 = new Date();
    dataEvento1.setMonth(dataEvento1.getMonth() + 3);
    const abertura1 = new Date();
    abertura1.setMonth(abertura1.getMonth() - 1);
    const encerramento1 = new Date(dataEvento1);
    encerramento1.setDate(encerramento1.getDate() - 7);

    const [evento1] = await db.insert(events).values({
      organizerId: organizador.id,
      slug: "maratona-sao-paulo-2025",
      nome: "Maratona de Sao Paulo 2025",
      descricao: "A maior maratona do Brasil! Venha participar da 30a edicao da Maratona de Sao Paulo, com percursos de 5km, 10km, 21km e 42km passando pelos principais pontos turisticos da cidade.\n\nData: Abril 2025\nLocal: Parque Ibirapuera\n\nInclui:\n- Kit do atleta com camisa oficial\n- Chip de cronometragem\n- Medalha de participacao\n- Hidratacao no percurso\n- Frutas na chegada",
      dataEvento: dataEvento1.toISOString().split('T')[0],
      endereco: "Parque Ibirapuera - Portao 10",
      cidade: "Sao Paulo",
      estado: "SP",
      limiteVagasTotal: 5000,
      status: "publicado",
      aberturaInscricoes: abertura1.toISOString(),
      encerramentoInscricoes: encerramento1.toISOString(),
      entregaCamisaNoKit: true,
      usarGradePorModalidade: false,
      idadeMinimaEvento: 16
    }).returning();

    const dataEvento2 = new Date();
    dataEvento2.setMonth(dataEvento2.getMonth() + 2);
    const abertura2 = new Date();
    abertura2.setMonth(abertura2.getMonth() - 2);
    const encerramento2 = new Date(dataEvento2);
    encerramento2.setDate(encerramento2.getDate() - 3);

    const [evento2] = await db.insert(events).values({
      organizerId: organizador.id,
      slug: "corrida-solidaria-2025",
      nome: "Corrida Solidaria 2025",
      descricao: "Corra por uma boa causa! A Corrida Solidaria 2025 arrecada fundos para instituicoes de caridade da cidade. Modalidades gratuitas para todos os publicos.\n\nData: Marco 2025\nLocal: Praca da Se\n\nToda a arrecadacao sera revertida para instituicoes parceiras.",
      dataEvento: dataEvento2.toISOString().split('T')[0],
      endereco: "Praca da Se",
      cidade: "Sao Paulo",
      estado: "SP",
      limiteVagasTotal: 2000,
      status: "publicado",
      aberturaInscricoes: abertura2.toISOString(),
      encerramentoInscricoes: encerramento2.toISOString(),
      entregaCamisaNoKit: true,
      usarGradePorModalidade: false,
      idadeMinimaEvento: 10
    }).returning();

    console.log("Criando modalidades...");

    const [mod5km] = await db.insert(modalities).values({
      eventId: evento1.id,
      nome: "Corrida 5km",
      distancia: "5.00",
      unidadeDistancia: "km",
      horarioLargada: "07:30",
      descricao: "Percurso de 5km ideal para iniciantes. Percurso plano dentro do Parque Ibirapuera.",
      tipoAcesso: "gratuita",
      taxaComodidade: "0",
      limiteVagas: 1000,
      ordem: 0
    }).returning();

    const [mod10km] = await db.insert(modalities).values({
      eventId: evento1.id,
      nome: "Corrida 10km",
      distancia: "10.00",
      unidadeDistancia: "km",
      horarioLargada: "07:00",
      descricao: "Percurso de 10km para corredores intermediarios. Passa pela Av. Paulista.",
      tipoAcesso: "paga",
      taxaComodidade: "5.00",
      limiteVagas: 2000,
      ordem: 1
    }).returning();

    const [mod21km] = await db.insert(modalities).values({
      eventId: evento1.id,
      nome: "Meia Maratona 21km",
      distancia: "21.00",
      unidadeDistancia: "km",
      horarioLargada: "06:30",
      descricao: "Meia maratona para corredores experientes. Percurso completo pela cidade.",
      tipoAcesso: "paga",
      taxaComodidade: "8.00",
      limiteVagas: 1500,
      ordem: 2,
      idadeMinima: 18
    }).returning();

    const [mod42km] = await db.insert(modalities).values({
      eventId: evento1.id,
      nome: "Maratona 42km",
      distancia: "42.195",
      unidadeDistancia: "km",
      horarioLargada: "06:00",
      descricao: "A maratona completa! Apenas para atletas preparados. Limite de 6 horas.",
      tipoAcesso: "paga",
      taxaComodidade: "10.00",
      limiteVagas: 500,
      ordem: 3,
      idadeMinima: 18
    }).returning();

    const [modSolidaria5km] = await db.insert(modalities).values({
      eventId: evento2.id,
      nome: "Corrida Solidaria 5km",
      distancia: "5.00",
      unidadeDistancia: "km",
      horarioLargada: "08:00",
      descricao: "Corrida de 5km aberta a todos. Inscrição gratuita!",
      tipoAcesso: "gratuita",
      taxaComodidade: "0",
      limiteVagas: 1500,
      ordem: 0
    }).returning();

    const [modKids] = await db.insert(modalities).values({
      eventId: evento2.id,
      nome: "Kids Run",
      distancia: "1.00",
      unidadeDistancia: "km",
      horarioLargada: "09:00",
      descricao: "Corrida especial para criancas de 6 a 12 anos. Percurso seguro e divertido!",
      tipoAcesso: "gratuita",
      taxaComodidade: "0",
      limiteVagas: 500,
      ordem: 1,
      idadeMinima: 6
    }).returning();

    console.log("Criando lotes...");

    const lotePromoInicio = new Date();
    lotePromoInicio.setMonth(lotePromoInicio.getMonth() - 1);
    const lotePromoFim = new Date();
    lotePromoFim.setDate(lotePromoFim.getDate() + 7);

    const [lotePromo] = await db.insert(registrationBatches).values({
      eventId: evento1.id,
      nome: "Lote Promocional",
      dataInicio: lotePromoInicio.toISOString(),
      dataTermino: lotePromoFim.toISOString(),
      quantidadeMaxima: 500,
      quantidadeUtilizada: 0,
      ativo: true,
      ordem: 0
    }).returning();

    const lote1Inicio = new Date(lotePromoFim);
    lote1Inicio.setDate(lote1Inicio.getDate() + 1);
    const lote1Fim = new Date(lote1Inicio);
    lote1Fim.setMonth(lote1Fim.getMonth() + 1);

    const [lote1] = await db.insert(registrationBatches).values({
      eventId: evento1.id,
      nome: "1o Lote",
      dataInicio: lote1Inicio.toISOString(),
      dataTermino: lote1Fim.toISOString(),
      quantidadeMaxima: 1500,
      quantidadeUtilizada: 0,
      ativo: false,
      ordem: 1
    }).returning();

    const lote2Inicio = new Date(lote1Fim);
    lote2Inicio.setDate(lote2Inicio.getDate() + 1);

    const [lote2] = await db.insert(registrationBatches).values({
      eventId: evento1.id,
      nome: "2o Lote",
      dataInicio: lote2Inicio.toISOString(),
      quantidadeMaxima: null,
      quantidadeUtilizada: 0,
      ativo: false,
      ordem: 2
    }).returning();

    const loteSolidariaInicio = new Date();
    loteSolidariaInicio.setMonth(loteSolidariaInicio.getMonth() - 2);

    const [loteSolidaria] = await db.insert(registrationBatches).values({
      eventId: evento2.id,
      nome: "Inscricoes Abertas",
      dataInicio: loteSolidariaInicio.toISOString(),
      quantidadeMaxima: null,
      quantidadeUtilizada: 0,
      ativo: true,
      ordem: 0
    }).returning();

    console.log("Criando precos...");

    await db.insert(prices).values([
      { modalityId: mod5km.id, batchId: lotePromo.id, valor: "0" },
      { modalityId: mod5km.id, batchId: lote1.id, valor: "0" },
      { modalityId: mod5km.id, batchId: lote2.id, valor: "0" },
      
      { modalityId: mod10km.id, batchId: lotePromo.id, valor: "69.00" },
      { modalityId: mod10km.id, batchId: lote1.id, valor: "89.00" },
      { modalityId: mod10km.id, batchId: lote2.id, valor: "109.00" },
      
      { modalityId: mod21km.id, batchId: lotePromo.id, valor: "99.00" },
      { modalityId: mod21km.id, batchId: lote1.id, valor: "129.00" },
      { modalityId: mod21km.id, batchId: lote2.id, valor: "159.00" },
      
      { modalityId: mod42km.id, batchId: lotePromo.id, valor: "149.00" },
      { modalityId: mod42km.id, batchId: lote1.id, valor: "189.00" },
      { modalityId: mod42km.id, batchId: lote2.id, valor: "229.00" },

      { modalityId: modSolidaria5km.id, batchId: loteSolidaria.id, valor: "0" },
      { modalityId: modKids.id, batchId: loteSolidaria.id, valor: "0" }
    ]);

    console.log("Criando grade de camisas...");

    const tamanhos = ["PP", "P", "M", "G", "GG", "XGG"];
    const quantidades = [100, 300, 500, 400, 200, 100];

    for (let i = 0; i < tamanhos.length; i++) {
      await db.insert(shirtSizes).values({
        eventId: evento1.id,
        modalityId: null,
        tamanho: tamanhos[i],
        quantidadeTotal: quantidades[i],
        quantidadeDisponivel: quantidades[i]
      });
    }

    const quantidadesSolidaria = [50, 150, 300, 250, 100, 50];
    for (let i = 0; i < tamanhos.length; i++) {
      await db.insert(shirtSizes).values({
        eventId: evento2.id,
        modalityId: null,
        tamanho: tamanhos[i],
        quantidadeTotal: quantidadesSolidaria[i],
        quantidadeDisponivel: quantidadesSolidaria[i]
      });
    }

    console.log("Criando anexos...");

    await db.insert(attachments).values([
      {
        eventId: evento1.id,
        nome: "Regulamento Oficial",
        url: "https://example.com/regulamento-maratona-sp-2025.pdf",
        obrigatorioAceitar: true,
        ordem: 0
      },
      {
        eventId: evento1.id,
        nome: "Termo de Responsabilidade",
        url: "https://example.com/termo-responsabilidade.pdf",
        obrigatorioAceitar: true,
        ordem: 1
      },
      {
        eventId: evento2.id,
        nome: "Regulamento da Corrida Solidaria",
        url: "https://example.com/regulamento-solidaria.pdf",
        obrigatorioAceitar: true,
        ordem: 0
      }
    ]);

    console.log("Criando atletas de teste...");

    await db.insert(athletes).values([
      {
        cpf: "111.111.111-11",
        nome: "Joao Silva",
        dataNascimento: "1990-03-15",
        sexo: "masculino",
        email: "joao.silva@email.com",
        telefone: "(11) 99999-1111",
        estado: "SP",
        cidade: "Sao Paulo",
        escolaridade: "Superior Completo",
        profissao: "Engenheiro"
      },
      {
        cpf: "222.222.222-22",
        nome: "Maria Santos",
        dataNascimento: "1985-07-22",
        sexo: "feminino",
        email: "maria.santos@email.com",
        telefone: "(21) 99999-2222",
        estado: "RJ",
        cidade: "Rio de Janeiro",
        escolaridade: "Pos-Graduacao",
        profissao: "Medica"
      },
      {
        cpf: "333.333.333-33",
        nome: "Pedro Oliveira",
        dataNascimento: "1995-12-10",
        sexo: "masculino",
        email: "pedro.oliveira@email.com",
        telefone: "(31) 99999-3333",
        estado: "MG",
        cidade: "Belo Horizonte",
        escolaridade: "Superior Incompleto",
        profissao: "Estudante"
      },
      {
        cpf: "444.444.444-44",
        nome: "Ana Costa",
        dataNascimento: "1988-05-08",
        sexo: "feminino",
        email: "ana.costa@email.com",
        telefone: "(11) 99999-4444",
        estado: "SP",
        cidade: "Campinas",
        escolaridade: "Superior Completo",
        profissao: "Advogada"
      },
      {
        cpf: "555.555.555-55",
        nome: "Lucas Ferreira",
        dataNascimento: "2000-01-20",
        sexo: "masculino",
        email: "lucas.ferreira@email.com",
        telefone: "(11) 99999-5555",
        estado: "SP",
        cidade: "Santos",
        escolaridade: "Ensino Medio Completo",
        profissao: "Atleta Profissional"
      }
    ]);

    console.log("Seed concluido com sucesso!");
    console.log(`Eventos criados: ${evento1.nome}, ${evento2.nome}`);
    console.log("Atletas de teste criados: 5");

  } catch (error) {
    console.error("Erro ao executar seed:", error);
    throw error;
  }
}

seed()
  .then(() => {
    console.log("Seed finalizado.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Seed falhou:", error);
    process.exit(1);
  });
