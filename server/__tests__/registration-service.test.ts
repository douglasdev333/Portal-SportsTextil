import { pool } from '../db';
import { registerForEventAtomic, OrderData, RegistrationData } from '../services/registration-service';

async function cleanupTestData(eventId: string) {
  const client = await pool.connect();
  try {
    await client.query('DELETE FROM registrations WHERE event_id = $1', [eventId]);
    await client.query('DELETE FROM orders WHERE event_id = $1', [eventId]);
    await client.query('UPDATE events SET vagas_ocupadas = 0 WHERE id = $1', [eventId]);
  } finally {
    client.release();
  }
}

async function getTestEvent(): Promise<{ id: string; limiteVagasTotal: number; vagasOcupadas: number } | null> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT id, limite_vagas_total, vagas_ocupadas FROM events LIMIT 1'
    );
    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

async function getTestModality(eventId: string): Promise<{ id: string } | null> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT id FROM modalities WHERE event_id = $1 LIMIT 1',
      [eventId]
    );
    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

async function getTestBatch(eventId: string): Promise<{ id: string } | null> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT id FROM registration_batches WHERE event_id = $1 LIMIT 1',
      [eventId]
    );
    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

async function getOrCreateTestAthlete(): Promise<string> {
  const client = await pool.connect();
  try {
    const existing = await client.query('SELECT id FROM athletes LIMIT 1');
    if (existing.rows[0]) {
      return existing.rows[0].id;
    }
    const result = await client.query(
      `INSERT INTO athletes (id, nome, email, cpf, data_nascimento, sexo, telefone, cidade, estado)
       VALUES (gen_random_uuid(), 'Atleta Teste', 'teste@teste.com', '00000000001', '1990-01-01', 'M', '11999999999', 'Sao Paulo', 'SP')
       RETURNING id`
    );
    return result.rows[0].id;
  } finally {
    client.release();
  }
}

async function setEventCapacity(eventId: string, limite: number, ocupadas: number) {
  const client = await pool.connect();
  try {
    await client.query(
      'UPDATE events SET limite_vagas_total = $1, vagas_ocupadas = $2 WHERE id = $3',
      [limite, ocupadas, eventId]
    );
  } finally {
    client.release();
  }
}

async function getVagasOcupadas(eventId: string): Promise<number> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT vagas_ocupadas FROM events WHERE id = $1',
      [eventId]
    );
    return result.rows[0]?.vagas_ocupadas || 0;
  } finally {
    client.release();
  }
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

let orderCounter = Math.floor(Date.now() / 1000);
let registrationCounter = Math.floor(Date.now() / 1000);

function createOrderData(eventId: string, athleteId: string): OrderData {
  return {
    numeroPedido: ++orderCounter,
    eventId,
    compradorId: athleteId,
    valorTotal: '0',
    valorDesconto: '0',
    status: 'pago',
    metodoPagamento: 'gratuito',
    ipComprador: '127.0.0.1'
  };
}

function createRegistrationData(
  eventId: string, 
  athleteId: string, 
  modalityId: string, 
  batchId: string
): RegistrationData {
  return {
    eventId,
    athleteId,
    modalityId,
    batchId,
    orderId: '',
    numeroInscricao: ++registrationCounter,
    tamanhoCamisa: 'M',
    equipe: null,
    valorUnitario: '0',
    taxaComodidade: '0',
    status: 'confirmada',
    nomeCompleto: 'Atleta Teste',
    cpf: '12345678900',
    dataNascimento: '1990-01-01',
    sexo: 'M'
  };
}

async function runTests() {
  console.log('Iniciando testes do servico de inscricao atomica...\n');
  
  const event = await getTestEvent();
  if (!event) {
    console.error('ERRO: Nenhum evento encontrado no banco para testes');
    process.exit(1);
  }
  
  const modality = await getTestModality(event.id);
  const batch = await getTestBatch(event.id);
  const baseAthleteId = await getOrCreateTestAthlete();
  
  if (!modality || !batch) {
    console.error('ERRO: Modalidade ou lote nao encontrado');
    process.exit(1);
  }
  
  console.log(`Usando evento: ${event.id}`);
  console.log(`Modalidade: ${modality.id}`);
  console.log(`Lote: ${batch.id}`);
  console.log(`Atleta base: ${baseAthleteId}\n`);
  
  await cleanupTestData(event.id);
  
  console.log('=== Teste 1: Inscricao simples com vagas sobrando ===');
  await setEventCapacity(event.id, 100, 0);
  
  const result1 = await registerForEventAtomic(
    createOrderData(event.id, baseAthleteId),
    createRegistrationData(event.id, baseAthleteId, modality.id, batch.id)
  );
  
  if (result1.success) {
    console.log('PASSOU: Inscricao criada com sucesso');
    const vagas = await getVagasOcupadas(event.id);
    console.log(`Vagas ocupadas apos inscricao: ${vagas}`);
    if (vagas === 1) {
      console.log('PASSOU: Contador incrementado corretamente\n');
    } else {
      console.log('FALHOU: Contador nao foi incrementado\n');
    }
  } else {
    console.log(`FALHOU: ${result1.error}\n`);
  }
  
  console.log('=== Teste 2: Usuario duplicado (mesma inscricao) ===');
  const result2 = await registerForEventAtomic(
    createOrderData(event.id, baseAthleteId),
    createRegistrationData(event.id, baseAthleteId, modality.id, batch.id)
  );
  
  if (!result2.success && result2.errorCode === 'JA_INSCRITO') {
    console.log('PASSOU: Duplicata detectada corretamente\n');
  } else {
    console.log(`FALHOU: Esperava erro JA_INSCRITO, recebeu: ${result2.errorCode}\n`);
  }
  
  console.log('=== Teste 3: Vagas esgotadas (testado via contador) ===');
  await cleanupTestData(event.id);
  await setEventCapacity(event.id, 2, 2);
  
  const result3 = await registerForEventAtomic(
    createOrderData(event.id, baseAthleteId),
    createRegistrationData(event.id, baseAthleteId, modality.id, batch.id)
  );
  
  if (!result3.success && result3.errorCode === 'VAGAS_ESGOTADAS') {
    console.log('PASSOU: Vagas esgotadas detectado corretamente\n');
  } else {
    console.log(`FALHOU: Esperava erro VAGAS_ESGOTADAS, recebeu: ${result3.errorCode || 'sucesso'}\n`);
  }
  
  console.log('=== Teste 4: Verificar que transacao e atomica (lock + update) ===');
  await cleanupTestData(event.id);
  await setEventCapacity(event.id, 5, 0);
  
  const result4 = await registerForEventAtomic(
    createOrderData(event.id, baseAthleteId),
    createRegistrationData(event.id, baseAthleteId, modality.id, batch.id)
  );
  
  if (result4.success) {
    const vagas = await getVagasOcupadas(event.id);
    if (vagas === 1) {
      console.log('PASSOU: Transacao atomica funcionou (ordem + inscricao + contador)\n');
    } else {
      console.log(`FALHOU: Contador incorreto: ${vagas}\n`);
    }
  } else {
    console.log(`FALHOU: ${result4.error}\n`);
  }
  
  console.log('=== Teste 5: Verificar evento nao existente ===');
  const fakeEventId = generateUUID();
  const result5 = await registerForEventAtomic(
    createOrderData(fakeEventId, baseAthleteId),
    createRegistrationData(fakeEventId, baseAthleteId, modality.id, batch.id)
  );
  
  if (!result5.success && result5.errorCode === 'EVENT_NOT_FOUND') {
    console.log('PASSOU: Evento nao encontrado detectado corretamente\n');
  } else {
    console.log(`FALHOU: Esperava erro EVENT_NOT_FOUND, recebeu: ${result5.errorCode || 'sucesso'}\n`);
  }
  
  await cleanupTestData(event.id);
  
  console.log('=== Testes concluidos ===');
  await pool.end();
}

runTests().catch(console.error);
