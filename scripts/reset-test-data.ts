import { pool } from '../server/db';

async function resetAndCreateTestData() {
  const client = await pool.connect();
  
  try {
    console.log('Iniciando limpeza do banco de dados...');
    await client.query('BEGIN');

    await client.query('DELETE FROM document_acceptances');
    await client.query('DELETE FROM registrations');
    await client.query('DELETE FROM orders');
    await client.query('DELETE FROM prices');
    await client.query('DELETE FROM registration_batches');
    await client.query('DELETE FROM shirt_sizes');
    await client.query('DELETE FROM attachments');
    await client.query('DELETE FROM event_banners');
    await client.query('DELETE FROM modalities');
    await client.query('DELETE FROM events');
    
    console.log('Tabelas limpas (exceto admin_users e organizers)');

    const organizerResult = await client.query(
      `SELECT id FROM organizers LIMIT 1`
    );
    
    let organizerId: string;
    if (organizerResult.rows.length === 0) {
      const newOrg = await client.query(
        `INSERT INTO organizers (nome, cpf_cnpj, email, telefone)
         VALUES ('Organizador Teste', '12345678000100', 'teste@teste.com', '11999999999')
         RETURNING id`
      );
      organizerId = newOrg.rows[0].id;
      console.log('Organizador de teste criado:', organizerId);
    } else {
      organizerId = organizerResult.rows[0].id;
      console.log('Usando organizador existente:', organizerId);
    }

    const now = new Date();
    const eventDate = new Date(now);
    eventDate.setMonth(eventDate.getMonth() + 2);

    const eventResult = await client.query(
      `INSERT INTO events (
        organizer_id, slug, nome, descricao, data_evento, endereco, cidade, estado,
        abertura_inscricoes, encerramento_inscricoes, limite_vagas_total, vagas_ocupadas, status
      ) VALUES (
        $1, 'evento-teste-transicao-lotes', 'Evento Teste Transicao de Lotes',
        'Evento criado para testar a transicao automatica de lotes',
        $2, 'Rua Teste 123', 'Sao Paulo', 'SP',
        NOW() AT TIME ZONE 'America/Sao_Paulo',
        $3,
        250, 0, 'publicado'
      ) RETURNING id`,
      [organizerId, eventDate.toISOString().split('T')[0], eventDate.toISOString()]
    );
    
    const eventId = eventResult.rows[0].id;
    console.log('Evento criado:', eventId);

    const modalityResult = await client.query(
      `INSERT INTO modalities (
        event_id, nome, distancia, unidade_distancia, horario_largada, descricao,
        limite_vagas, vagas_ocupadas, tipo_acesso, ordem
      ) VALUES (
        $1, '5K - Corrida', '5', 'km', '08:00', 'Corrida de 5 kilometros',
        NULL, 0, 'paga', 1
      ) RETURNING id`,
      [eventId]
    );
    
    const modalityId = modalityResult.rows[0].id;
    console.log('Modalidade criada:', modalityId);

    const batch1Result = await client.query(
      `INSERT INTO registration_batches (
        event_id, nome, data_inicio, data_termino, quantidade_maxima, quantidade_utilizada,
        ativo, status, ordem
      ) VALUES (
        $1, 'Lote 1', NOW() AT TIME ZONE 'America/Sao_Paulo', NULL, 50, 0, true, 'active', 1
      ) RETURNING id`,
      [eventId]
    );
    const batch1Id = batch1Result.rows[0].id;
    console.log('Lote 1 criado (active, ordem=1, capacity=50):', batch1Id);

    const batch2Result = await client.query(
      `INSERT INTO registration_batches (
        event_id, nome, data_inicio, data_termino, quantidade_maxima, quantidade_utilizada,
        ativo, status, ordem
      ) VALUES (
        $1, 'Lote 2', NOW() AT TIME ZONE 'America/Sao_Paulo', NULL, 100, 0, false, 'future', 2
      ) RETURNING id`,
      [eventId]
    );
    const batch2Id = batch2Result.rows[0].id;
    console.log('Lote 2 criado (future, ordem=2, capacity=100):', batch2Id);

    const batch3Result = await client.query(
      `INSERT INTO registration_batches (
        event_id, nome, data_inicio, data_termino, quantidade_maxima, quantidade_utilizada,
        ativo, status, ordem
      ) VALUES (
        $1, 'Lote 3', NOW() AT TIME ZONE 'America/Sao_Paulo', NULL, 100, 0, false, 'future', 3
      ) RETURNING id`,
      [eventId]
    );
    const batch3Id = batch3Result.rows[0].id;
    console.log('Lote 3 criado (future, ordem=3, capacity=100):', batch3Id);

    await client.query(
      `INSERT INTO prices (modality_id, batch_id, valor) VALUES
       ($1, $2, 100.00),
       ($1, $3, 120.00),
       ($1, $4, 140.00)`,
      [modalityId, batch1Id, batch2Id, batch3Id]
    );
    console.log('Precos configurados: Lote1=R$100, Lote2=R$120, Lote3=R$140');

    await client.query('COMMIT');

    console.log('\n=== DADOS DE TESTE CRIADOS ===');
    console.log('Evento: Evento Teste Transicao de Lotes');
    console.log('Capacidade total: 250 vagas');
    console.log('\nLotes:');
    console.log('- Lote 1: ordem=1, capacity=50, status=active, preco=R$100');
    console.log('- Lote 2: ordem=2, capacity=100, status=future, preco=R$120');
    console.log('- Lote 3: ordem=3, capacity=100, status=future, preco=R$140');
    console.log('\nCenario esperado:');
    console.log('- Ao atingir 50 inscricoes: Lote 1 fecha, Lote 2 ativa');
    console.log('- Ao atingir +100 inscricoes: Lote 2 fecha, Lote 3 ativa');
    console.log('- Ao atingir +100 inscricoes: Lote 3 esgota, retorna LOTE_ESGOTADO_E_SEM_PROXIMO');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro ao criar dados de teste:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

resetAndCreateTestData()
  .then(() => {
    console.log('\nScript executado com sucesso!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Falha na execucao:', err);
    process.exit(1);
  });
