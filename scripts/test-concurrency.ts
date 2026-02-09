import pg from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 50
});

interface TestConfig {
  eventCapacity: number;
  modalityCapacity: number | null;
  batchCapacity: number | null;
  parallelRequests: number;
}

async function setupTestData(config: TestConfig): Promise<{ eventId: string; modalityId: string; batchId: string; athleteIds: string[] }> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Create test organizer
    const organizerResult = await client.query(`
      INSERT INTO organizers (nome, cpf_cnpj, email, telefone)
      VALUES ('Test Organizer', '00000000000', 'test@test.com', '11999999999')
      ON CONFLICT (cpf_cnpj) DO UPDATE SET nome = 'Test Organizer'
      RETURNING id
    `);
    const organizerId = organizerResult.rows[0].id;

    // Create test event
    const eventSlug = `test-concurrency-${Date.now()}`;
    const eventResult = await client.query(`
      INSERT INTO events (
        organizer_id, slug, nome, descricao, data_evento, endereco, cidade, estado,
        abertura_inscricoes, encerramento_inscricoes, limite_vagas_total, vagas_ocupadas, status
      ) VALUES (
        $1, $2, 'Evento Teste Concorrencia', 'Teste', '2025-12-31', 'Rua Teste', 'Sao Paulo', 'SP',
        NOW() - INTERVAL '1 day', NOW() + INTERVAL '30 days', $3, 0, 'publicado'
      ) RETURNING id
    `, [organizerId, eventSlug, config.eventCapacity]);
    const eventId = eventResult.rows[0].id;

    // Create test modality
    const modalityResult = await client.query(`
      INSERT INTO modalities (
        event_id, nome, distancia, horario_largada, limite_vagas, vagas_ocupadas, ordem
      ) VALUES (
        $1, 'Corrida 5K Teste', '5.00', '08:00', $2, 0, 1
      ) RETURNING id
    `, [eventId, config.modalityCapacity]);
    const modalityId = modalityResult.rows[0].id;

    // Create test batch
    const batchResult = await client.query(`
      INSERT INTO registration_batches (
        event_id, modality_id, nome, data_inicio, quantidade_maxima, quantidade_utilizada, ativo, status, ordem
      ) VALUES (
        $1, $2, '1o Lote Teste', NOW() - INTERVAL '1 hour', $3, 0, true, 'active', 1
      ) RETURNING id
    `, [eventId, modalityId, config.batchCapacity]);
    const batchId = batchResult.rows[0].id;

    // Create price for modality/batch
    await client.query(`
      INSERT INTO prices (modality_id, batch_id, valor)
      VALUES ($1, $2, '100.00')
    `, [modalityId, batchId]);

    // Create test athletes
    const athleteIds: string[] = [];
    for (let i = 0; i < config.parallelRequests; i++) {
      const cpf = `000${String(i).padStart(8, '0')}${String(i % 10).padStart(2, '0')}`;
      const email = `test${i}_${Date.now()}@test.com`;
      
      const athleteResult = await client.query(`
        INSERT INTO athletes (cpf, nome, data_nascimento, sexo, email, telefone, estado, cidade)
        VALUES ($1, $2, '1990-01-01', 'masculino', $3, '11999999999', 'SP', 'Sao Paulo')
        RETURNING id
      `, [cpf, `Atleta Teste ${i}`, email]);
      athleteIds.push(athleteResult.rows[0].id);
    }

    await client.query('COMMIT');
    
    return { eventId, modalityId, batchId, athleteIds };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function simulateAtomicRegistration(
  eventId: string,
  modalityId: string,
  batchId: string,
  athleteId: string,
  orderNumber: number,
  registrationNumber: number
): Promise<{ success: boolean; error?: string }> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // 1. LOCK EVENT
    const eventResult = await client.query(
      `SELECT id, limite_vagas_total, vagas_ocupadas, permitir_multiplas_modalidades 
       FROM events WHERE id = $1 FOR UPDATE`,
      [eventId]
    );
    
    if (!eventResult.rows[0]) {
      await client.query('ROLLBACK');
      return { success: false, error: 'EVENT_NOT_FOUND' };
    }
    
    const event = eventResult.rows[0];
    if (event.vagas_ocupadas >= event.limite_vagas_total) {
      await client.query('ROLLBACK');
      return { success: false, error: 'EVENT_FULL' };
    }

    // 2. LOCK MODALITY
    const modalityResult = await client.query(
      `SELECT id, limite_vagas, vagas_ocupadas FROM modalities WHERE id = $1 FOR UPDATE`,
      [modalityId]
    );
    
    if (!modalityResult.rows[0]) {
      await client.query('ROLLBACK');
      return { success: false, error: 'MODALITY_NOT_FOUND' };
    }
    
    const modality = modalityResult.rows[0];
    if (modality.limite_vagas !== null && modality.vagas_ocupadas >= modality.limite_vagas) {
      await client.query('ROLLBACK');
      return { success: false, error: 'MODALITY_FULL' };
    }

    // 3. LOCK BATCH
    const batchResult = await client.query(
      `SELECT id, quantidade_maxima, quantidade_utilizada FROM registration_batches 
       WHERE id = $1 AND ativo = true FOR UPDATE`,
      [batchId]
    );
    
    if (batchResult.rows.length > 0) {
      const batch = batchResult.rows[0];
      if (batch.quantidade_maxima !== null && batch.quantidade_utilizada >= batch.quantidade_maxima) {
        await client.query('ROLLBACK');
        return { success: false, error: 'LOT_FULL' };
      }
    }

    // 4. CHECK DUPLICATE
    const duplicateCheck = await client.query(
      `SELECT id FROM registrations WHERE event_id = $1 AND athlete_id = $2 AND status != 'cancelada'`,
      [eventId, athleteId]
    );
    
    if (duplicateCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return { success: false, error: 'ALREADY_REGISTERED' };
    }

    // 5. CREATE ORDER
    const orderResult = await client.query(
      `INSERT INTO orders (numero_pedido, event_id, comprador_id, valor_total, valor_desconto, status)
       VALUES ($1, $2, $3, '100.00', '0', 'pago') RETURNING id`,
      [orderNumber, eventId, athleteId]
    );
    const orderId = orderResult.rows[0].id;

    // 6. CREATE REGISTRATION
    await client.query(
      `INSERT INTO registrations (
        numero_inscricao, order_id, event_id, modality_id, batch_id, athlete_id, 
        valor_unitario, taxa_comodidade, status
      ) VALUES ($1, $2, $3, $4, $5, $6, '100.00', '0', 'confirmada')`,
      [registrationNumber, orderId, eventId, modalityId, batchId, athleteId]
    );

    // 7. UPDATE COUNTERS
    await client.query('UPDATE events SET vagas_ocupadas = vagas_ocupadas + 1 WHERE id = $1', [eventId]);
    await client.query('UPDATE modalities SET vagas_ocupadas = vagas_ocupadas + 1 WHERE id = $1', [modalityId]);
    await client.query('UPDATE registration_batches SET quantidade_utilizada = quantidade_utilizada + 1 WHERE id = $1', [batchId]);

    await client.query('COMMIT');
    return { success: true };
    
  } catch (e: any) {
    await client.query('ROLLBACK');
    if (e.code === '23505') {
      return { success: false, error: 'ALREADY_REGISTERED' };
    }
    return { success: false, error: e.message };
  } finally {
    client.release();
  }
}

async function runConcurrencyTest(config: TestConfig): Promise<void> {
  console.log('\n========================================');
  console.log('TESTE DE CONCORRENCIA - Controle de Vagas');
  console.log('========================================');
  console.log(`Capacidade Evento: ${config.eventCapacity}`);
  console.log(`Capacidade Modalidade: ${config.modalityCapacity ?? 'SEM LIMITE'}`);
  console.log(`Capacidade Lote: ${config.batchCapacity ?? 'SEM LIMITE'}`);
  console.log(`Requisicoes Paralelas: ${config.parallelRequests}`);
  console.log('----------------------------------------\n');

  console.log('1. Configurando dados de teste...');
  const { eventId, modalityId, batchId, athleteIds } = await setupTestData(config);
  console.log(`   Evento ID: ${eventId}`);
  console.log(`   Modalidade ID: ${modalityId}`);
  console.log(`   Lote ID: ${batchId}`);
  console.log(`   Atletas criados: ${athleteIds.length}\n`);

  console.log('2. Executando inscricoes paralelas...');
  const startTime = Date.now();
  
  const promises = athleteIds.map((athleteId, index) => 
    simulateAtomicRegistration(eventId, modalityId, batchId, athleteId, 10000 + index, 10000 + index)
  );
  
  const results = await Promise.all(promises);
  const endTime = Date.now();

  const successCount = results.filter(r => r.success).length;
  const failedResults = results.filter(r => !r.success);
  
  const errorCounts: Record<string, number> = {};
  failedResults.forEach(r => {
    const error = r.error || 'UNKNOWN';
    errorCounts[error] = (errorCounts[error] || 0) + 1;
  });

  console.log(`   Tempo total: ${endTime - startTime}ms`);
  console.log(`   Inscricoes bem-sucedidas: ${successCount}`);
  console.log(`   Inscricoes bloqueadas: ${failedResults.length}`);
  
  if (Object.keys(errorCounts).length > 0) {
    console.log('\n   Motivos de bloqueio:');
    Object.entries(errorCounts).forEach(([error, count]) => {
      console.log(`     - ${error}: ${count}`);
    });
  }

  // Verify final counters
  console.log('\n3. Verificando contadores finais...');
  const client = await pool.connect();
  try {
    const eventCheck = await client.query(
      'SELECT vagas_ocupadas FROM events WHERE id = $1', [eventId]
    );
    const modalityCheck = await client.query(
      'SELECT vagas_ocupadas FROM modalities WHERE id = $1', [modalityId]
    );
    const batchCheck = await client.query(
      'SELECT quantidade_utilizada FROM registration_batches WHERE id = $1', [batchId]
    );
    const registrationCount = await client.query(
      'SELECT COUNT(*) as total FROM registrations WHERE event_id = $1', [eventId]
    );

    const eventVagas = eventCheck.rows[0].vagas_ocupadas;
    const modalityVagas = modalityCheck.rows[0].vagas_ocupadas;
    const batchUtilizado = batchCheck.rows[0].quantidade_utilizada;
    const totalRegistrations = parseInt(registrationCount.rows[0].total);

    console.log(`   Evento vagas_ocupadas: ${eventVagas}`);
    console.log(`   Modalidade vagas_ocupadas: ${modalityVagas}`);
    console.log(`   Lote quantidade_utilizada: ${batchUtilizado}`);
    console.log(`   Total inscricoes no banco: ${totalRegistrations}`);

    // Validation
    console.log('\n4. Validacao de consistencia:');
    
    const expectedLimit = Math.min(
      config.eventCapacity,
      config.modalityCapacity ?? Infinity,
      config.batchCapacity ?? Infinity
    );
    
    let allPassed = true;

    if (successCount !== totalRegistrations) {
      console.log(`   [FALHA] Sucesso (${successCount}) != Registros no banco (${totalRegistrations})`);
      allPassed = false;
    } else {
      console.log(`   [OK] Sucesso (${successCount}) == Registros no banco (${totalRegistrations})`);
    }

    if (successCount > expectedLimit) {
      console.log(`   [FALHA] Overbooking detectado! ${successCount} > ${expectedLimit} (limite esperado)`);
      allPassed = false;
    } else {
      console.log(`   [OK] Nenhum overbooking: ${successCount} <= ${expectedLimit}`);
    }

    if (eventVagas !== successCount) {
      console.log(`   [FALHA] Contador evento (${eventVagas}) != sucesso (${successCount})`);
      allPassed = false;
    } else {
      console.log(`   [OK] Contador evento correto: ${eventVagas}`);
    }

    if (modalityVagas !== successCount) {
      console.log(`   [FALHA] Contador modalidade (${modalityVagas}) != sucesso (${successCount})`);
      allPassed = false;
    } else {
      console.log(`   [OK] Contador modalidade correto: ${modalityVagas}`);
    }

    if (batchUtilizado !== successCount) {
      console.log(`   [FALHA] Contador lote (${batchUtilizado}) != sucesso (${successCount})`);
      allPassed = false;
    } else {
      console.log(`   [OK] Contador lote correto: ${batchUtilizado}`);
    }

    console.log('\n========================================');
    if (allPassed) {
      console.log('RESULTADO: TODOS OS TESTES PASSARAM!');
    } else {
      console.log('RESULTADO: ALGUNS TESTES FALHARAM!');
    }
    console.log('========================================\n');

  } finally {
    client.release();
  }
}

async function cleanupTestData(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`DELETE FROM document_acceptances WHERE registration_id IN 
      (SELECT id FROM registrations WHERE event_id IN 
        (SELECT id FROM events WHERE slug LIKE 'test-concurrency-%'))`);
    await client.query(`DELETE FROM registrations WHERE event_id IN 
      (SELECT id FROM events WHERE slug LIKE 'test-concurrency-%')`);
    await client.query(`DELETE FROM orders WHERE event_id IN 
      (SELECT id FROM events WHERE slug LIKE 'test-concurrency-%')`);
    await client.query(`DELETE FROM prices WHERE batch_id IN 
      (SELECT id FROM registration_batches WHERE event_id IN 
        (SELECT id FROM events WHERE slug LIKE 'test-concurrency-%'))`);
    await client.query(`DELETE FROM registration_batches WHERE event_id IN 
      (SELECT id FROM events WHERE slug LIKE 'test-concurrency-%')`);
    await client.query(`DELETE FROM modalities WHERE event_id IN 
      (SELECT id FROM events WHERE slug LIKE 'test-concurrency-%')`);
    await client.query(`DELETE FROM events WHERE slug LIKE 'test-concurrency-%'`);
    await client.query(`DELETE FROM athletes WHERE email LIKE 'test%@test.com'`);
    console.log('Dados de teste limpos com sucesso!\n');
  } finally {
    client.release();
  }
}

async function main() {
  try {
    console.log('\nLimpando dados de testes anteriores...');
    await cleanupTestData();

    // Test 1: Event limit controls
    await runConcurrencyTest({
      eventCapacity: 10,
      modalityCapacity: null,
      batchCapacity: null,
      parallelRequests: 50
    });

    await cleanupTestData();

    // Test 2: Modality limit controls
    await runConcurrencyTest({
      eventCapacity: 100,
      modalityCapacity: 10,
      batchCapacity: null,
      parallelRequests: 50
    });

    await cleanupTestData();

    // Test 3: Batch limit controls
    await runConcurrencyTest({
      eventCapacity: 100,
      modalityCapacity: 100,
      batchCapacity: 10,
      parallelRequests: 50
    });

    await cleanupTestData();

    // Test 4: All limits combined
    await runConcurrencyTest({
      eventCapacity: 15,
      modalityCapacity: 12,
      batchCapacity: 10,
      parallelRequests: 100
    });

    await cleanupTestData();

  } catch (error) {
    console.error('Erro durante testes:', error);
  } finally {
    await pool.end();
  }
}

main();
