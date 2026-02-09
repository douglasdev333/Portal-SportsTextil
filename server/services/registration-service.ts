import { pool } from '../db';
import type { PoolClient } from 'pg';
import { logStatusChange } from './status-log-service';

export interface RegistrationData {
  eventId: string;
  athleteId: string;
  modalityId: string;
  batchId: string;
  orderId: string;
  numeroInscricao: number;
  tamanhoCamisa: string | null;
  equipe: string | null;
  valorUnitario: string;
  taxaComodidade: string;
  status: string;
  nomeCompleto: string;
  cpf: string;
  dataNascimento: string;
  sexo: string;
}

export interface OrderData {
  numeroPedido: number;
  eventId: string;
  compradorId: string;
  valorTotal: string;
  valorDesconto: string;
  status: string;
  metodoPagamento: string | null;
  ipComprador: string | null;
  dataExpiracao?: string | null;
}

export type RegistrationErrorCode = 
  | 'EVENT_FULL'
  | 'EVENT_SOLD_OUT'
  | 'MODALITY_FULL'
  | 'LOT_FULL'
  | 'LOT_SOLD_OUT_OR_CHANGED'
  | 'LOTE_ESGOTADO_E_SEM_PROXIMO'
  | 'MODALITY_NOT_FOUND'
  | 'LOT_NOT_FOUND'
  | 'EVENT_NOT_FOUND'
  | 'VAGAS_ESGOTADAS'
  | 'JA_INSCRITO'
  | 'ALREADY_REGISTERED'
  | 'NO_VALID_BATCH_FOR_PAID_MODALITY'
  | 'SHIRT_SIZE_SOLD_OUT'
  | 'INTERNAL_ERROR';

export interface AtomicRegistrationResult {
  success: boolean;
  order?: {
    id: string;
    numeroPedido: string;
    valorTotal: number;
    status: string;
    dataExpiracao?: string | null;
  };
  registration?: {
    id: string;
    numeroInscricao: string;
    status: string;
    batchId: string;
    valorUnitario: number;
  };
  error?: string;
  errorCode?: RegistrationErrorCode;
}

async function closeBatchAndActivateNext(
  client: PoolClient, 
  currentBatchId: string, 
  eventId: string
): Promise<{ nextBatchActivated: boolean; nextBatchId: string | null }> {
  await client.query(
    `UPDATE registration_batches SET status = 'closed' WHERE id = $1`,
    [currentBatchId]
  );

  const currentBatchOrder = await client.query(
    `SELECT ordem FROM registration_batches WHERE id = $1`,
    [currentBatchId]
  );

  if (currentBatchOrder.rows.length > 0) {
    const currentOrder = currentBatchOrder.rows[0].ordem;
    
    // Get all future batches to find the first valid one
    const candidateBatches = await client.query(
      `SELECT id, nome, data_inicio, data_termino, quantidade_maxima, quantidade_utilizada
       FROM registration_batches
       WHERE event_id = $1 
         AND ordem > $2
         AND status = 'future'
       ORDER BY ordem ASC
       FOR UPDATE`,
      [eventId, currentOrder]
    );

    // Find the first valid candidate batch
    for (const candidate of candidateBatches.rows) {
      // Check if candidate batch is already full - close it permanently
      if (candidate.quantidade_maxima !== null && candidate.quantidade_utilizada >= candidate.quantidade_maxima) {
        console.log(`[registration-service] Lote candidato ${candidate.id} já está cheio, fechando...`);
        await client.query(
          `UPDATE registration_batches 
           SET status = 'closed' 
           WHERE id = $1`,
          [candidate.id]
        );
        continue;
      }
      
      // Check if candidate batch is already expired - close it permanently
      if (candidate.data_termino) {
        const candidateExpired = await client.query(
          `SELECT ($1::timestamptz AT TIME ZONE 'America/Sao_Paulo') < (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo') as expired`,
          [candidate.data_termino]
        );
        
        if (candidateExpired.rows[0]?.expired) {
          console.log(`[registration-service] Lote candidato ${candidate.id} já expirou, fechando...`);
          await client.query(
            `UPDATE registration_batches 
             SET status = 'closed' 
             WHERE id = $1`,
            [candidate.id]
          );
          continue;
        }
      }
      
      // Check if candidate batch start date has arrived (São Paulo timezone)
      // If start date is in the future, we cannot activate it yet
      if (candidate.data_inicio) {
        const canStart = await client.query(
          `SELECT ($1::timestamptz AT TIME ZONE 'America/Sao_Paulo') <= (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo') as can_start`,
          [candidate.data_inicio]
        );
        
        if (!canStart.rows[0]?.can_start) {
          console.log(`[registration-service] Lote candidato ${candidate.id} (${candidate.nome}) ainda não iniciou, aguardando...`);
          // Don't close this batch - it will be activated when its start time arrives
          // Stop searching as this is the next batch in order
          break;
        }
      }
      
      // This batch is valid and can start - activate it
      await client.query(
        `UPDATE registration_batches 
         SET status = 'active'
         WHERE id = $1`,
        [candidate.id]
      );
      console.log(`[registration-service] Lote ${candidate.id} ativado como próximo lote`);
      return { nextBatchActivated: true, nextBatchId: candidate.id };
    }
  }
  
  return { nextBatchActivated: false, nextBatchId: null };
}

export async function registerForEventAtomic(
  orderData: OrderData,
  registrationData: RegistrationData
): Promise<AtomicRegistrationResult> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 1. LOCK EVENT - Check event status and capacity first (hard cap)
    const eventResult = await client.query(
      `SELECT id, status, limite_vagas_total, vagas_ocupadas, permitir_multiplas_modalidades 
       FROM events 
       WHERE id = $1 
       FOR UPDATE`,
      [registrationData.eventId]
    );
    
    if (!eventResult.rows[0]) {
      await client.query('ROLLBACK');
      return {
        success: false,
        error: 'Evento nao encontrado',
        errorCode: 'EVENT_NOT_FOUND'
      };
    }
    
    const event = eventResult.rows[0];
    
    // Check if event is sold out by status
    if (event.status === 'esgotado') {
      await client.query('ROLLBACK');
      return {
        success: false,
        error: 'Inscricoes encerradas - evento esgotado.',
        errorCode: 'EVENT_SOLD_OUT'
      };
    }
    
    if (event.vagas_ocupadas >= event.limite_vagas_total) {
      // Mark event as sold out
      await client.query(
        `UPDATE events SET status = 'esgotado' WHERE id = $1`,
        [registrationData.eventId]
      );
      await client.query('ROLLBACK');
      return {
        success: false,
        error: 'Evento lotado - vagas esgotadas',
        errorCode: 'EVENT_FULL'
      };
    }

    // 2. LOCK MODALITY - Check modality capacity (optional limit)
    const modalityResult = await client.query(
      `SELECT id, limite_vagas, vagas_ocupadas, nome, tipo_acesso
       FROM modalities 
       WHERE id = $1 
       FOR UPDATE`,
      [registrationData.modalityId]
    );
    
    if (!modalityResult.rows[0]) {
      await client.query('ROLLBACK');
      return {
        success: false,
        error: 'Modalidade nao encontrada',
        errorCode: 'MODALITY_NOT_FOUND'
      };
    }
    
    const modality = modalityResult.rows[0];
    // Modalities with type 'gratuita' or 'voucher' can have zero price
    const isPaidModality = !['gratuita', 'voucher'].includes(modality.tipo_acesso);
    
    if (modality.limite_vagas !== null && modality.vagas_ocupadas >= modality.limite_vagas) {
      await client.query('ROLLBACK');
      return {
        success: false,
        error: `Modalidade ${modality.nome} lotada - vagas esgotadas`,
        errorCode: 'MODALITY_FULL'
      };
    }

    // 3. LOCK ACTIVE BATCH - Check batch capacity and get price (batches are global per event)
    // This loop handles automatic batch switching if the current batch is full
    let batchId: string = '';
    let valorUnitario: string = '';
    let batchSwitchAttempts = 0;
    const maxBatchSwitchAttempts = 10;

    while (batchSwitchAttempts < maxBatchSwitchAttempts) {
      batchSwitchAttempts++;

      // Query active batch with date termino for expiration check
      const batchResult = await client.query(
        `SELECT rb.id, rb.quantidade_maxima, rb.quantidade_utilizada, rb.data_termino, p.valor
         FROM registration_batches rb
         LEFT JOIN prices p ON p.batch_id = rb.id AND p.modality_id = $2
         WHERE rb.event_id = $1 
           AND rb.status = 'active'
         ORDER BY rb.ordem ASC
         LIMIT 1
         FOR UPDATE OF rb`,
        [registrationData.eventId, registrationData.modalityId]
      );

      if (batchResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return {
          success: false,
          error: 'Inscricoes encerradas - nao ha lote ativo disponivel.',
          errorCode: 'LOTE_ESGOTADO_E_SEM_PROXIMO'
        };
      }

      const batch = batchResult.rows[0];
      
      // Check if batch is expired by date (São Paulo timezone)
      if (batch.data_termino) {
        const batchExpired = await client.query(
          `SELECT ($1::timestamptz AT TIME ZONE 'America/Sao_Paulo') < (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo') as expired`,
          [batch.data_termino]
        );
        
        if (batchExpired.rows[0]?.expired) {
          console.log(`[registration-service] Lote ${batch.id} expirou durante transação, ativando próximo...`);
          const { nextBatchActivated } = await closeBatchAndActivateNext(client, batch.id, registrationData.eventId);
          
          if (!nextBatchActivated) {
            await client.query('ROLLBACK');
            return {
              success: false,
              error: 'Inscricoes encerradas - lote expirado e nao ha proximo lote disponivel.',
              errorCode: 'LOTE_ESGOTADO_E_SEM_PROXIMO'
            };
          }
          continue;
        }
      }
      
      // Check if batch is full by capacity
      if (batch.quantidade_maxima !== null && batch.quantidade_utilizada >= batch.quantidade_maxima) {
        const { nextBatchActivated } = await closeBatchAndActivateNext(client, batch.id, registrationData.eventId);
        
        if (!nextBatchActivated) {
          await client.query('ROLLBACK');
          return {
            success: false,
            error: 'Inscricoes encerradas - todos os lotes foram esgotados.',
            errorCode: 'LOTE_ESGOTADO_E_SEM_PROXIMO'
          };
        }
        continue;
      }

      batchId = batch.id;
      
      // CRITICAL BUSINESS RULE: Paid modalities MUST have a valid price from the batch
      // Never allow a paid modality to proceed with price = 0 due to missing price configuration
      if (isPaidModality) {
        if (batch.valor === null || batch.valor === undefined) {
          await client.query('ROLLBACK');
          return {
            success: false,
            error: 'Nenhum lote valido disponivel para esta modalidade no momento.',
            errorCode: 'NO_VALID_BATCH_FOR_PAID_MODALITY'
          };
        }
        const priceValue = parseFloat(batch.valor);
        if (isNaN(priceValue) || priceValue <= 0) {
          await client.query('ROLLBACK');
          return {
            success: false,
            error: 'Nenhum lote valido disponivel para esta modalidade no momento.',
            errorCode: 'NO_VALID_BATCH_FOR_PAID_MODALITY'
          };
        }
        valorUnitario = batch.valor;
      } else {
        // For free modalities, price can be 0
        valorUnitario = batch.valor || '0';
      }
      break;
    }

    if (!batchId!) {
      await client.query('ROLLBACK');
      return {
        success: false,
        error: 'Erro ao processar lote. Por favor, tente novamente.',
        errorCode: 'INTERNAL_ERROR'
      };
    }

    // NOTE: Shirt size price adjustment is now applied in the route before calling this service
    // This ensures the valorTotal in the order already includes the adjustment
    
    // 4. CHECK DUPLICATE REGISTRATION
    console.log(`[registration-service] Verificando duplicatas: permitir_multiplas_modalidades=${event.permitir_multiplas_modalidades}, eventId=${registrationData.eventId}, athleteId=${registrationData.athleteId}, modalityId=${registrationData.modalityId}`);
    
    if (!event.permitir_multiplas_modalidades) {
      const existingRegistration = await client.query(
        `SELECT id, modality_id, status FROM registrations 
         WHERE event_id = $1 AND athlete_id = $2 
         AND status != 'cancelada'
         LIMIT 1`,
        [registrationData.eventId, registrationData.athleteId]
      );
      
      console.log(`[registration-service] Evento não permite múltiplas modalidades. Inscrições existentes:`, existingRegistration.rows);
      
      if (existingRegistration.rows.length > 0) {
        await client.query('ROLLBACK');
        return {
          success: false,
          error: 'Você já possui inscrição neste evento',
          errorCode: 'JA_INSCRITO'
        };
      }
    } else {
      const existingModalityRegistration = await client.query(
        `SELECT id, modality_id, status FROM registrations 
         WHERE event_id = $1 AND athlete_id = $2 AND modality_id = $3
         AND status != 'cancelada'
         LIMIT 1`,
        [registrationData.eventId, registrationData.athleteId, registrationData.modalityId]
      );
      
      console.log(`[registration-service] Evento permite múltiplas modalidades. Inscrições na mesma modalidade:`, existingModalityRegistration.rows);
      
      if (existingModalityRegistration.rows.length > 0) {
        await client.query('ROLLBACK');
        return {
          success: false,
          error: 'Você já possui inscrição nesta modalidade',
          errorCode: 'JA_INSCRITO'
        };
      }
    }
    
    // 5. CREATE ORDER (usando sequence para garantir número único)
    const orderResult = await client.query(
      `INSERT INTO orders (
        id, numero_pedido, event_id, comprador_id, valor_total, 
        valor_desconto, status, metodo_pagamento, ip_comprador, data_expiracao
      ) VALUES (
        gen_random_uuid(), nextval('order_number_seq'), $1, $2, $3, $4, $5, $6, $7, $8
      ) RETURNING id, numero_pedido, valor_total, status, data_expiracao`,
      [
        orderData.eventId,
        orderData.compradorId,
        orderData.valorTotal,
        orderData.valorDesconto,
        orderData.status,
        orderData.metodoPagamento,
        orderData.ipComprador,
        orderData.dataExpiracao || null
      ]
    );
    
    const order = orderResult.rows[0];
    
    // 6. CREATE REGISTRATION (usando sequence para garantir número único)
    const registrationResult = await client.query(
      `INSERT INTO registrations (
        id, numero_inscricao, order_id, event_id, modality_id, batch_id,
        athlete_id, tamanho_camisa, valor_unitario, taxa_comodidade,
        status, equipe, nome_completo, cpf, data_nascimento, sexo
      ) VALUES (
        gen_random_uuid(), nextval('registration_number_seq'), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
      ) RETURNING id, numero_inscricao, status`,
      [
        order.id,
        registrationData.eventId,
        registrationData.modalityId,
        batchId,
        registrationData.athleteId,
        registrationData.tamanhoCamisa,
        registrationData.valorUnitario,
        registrationData.taxaComodidade,
        registrationData.status,
        registrationData.equipe,
        registrationData.nomeCompleto,
        registrationData.cpf,
        registrationData.dataNascimento,
        registrationData.sexo
      ]
    );
    
    const registration = registrationResult.rows[0];
    
    // 7. UPDATE COUNTERS ATOMICALLY
    await client.query(
      'UPDATE events SET vagas_ocupadas = vagas_ocupadas + 1 WHERE id = $1',
      [registrationData.eventId]
    );

    await client.query(
      'UPDATE modalities SET vagas_ocupadas = vagas_ocupadas + 1 WHERE id = $1',
      [registrationData.modalityId]
    );

    await client.query(
      'UPDATE registration_batches SET quantidade_utilizada = quantidade_utilizada + 1 WHERE id = $1',
      [batchId]
    );

    // 7.1. DECREMENT SHIRT SIZE QUANTITY IF SELECTED (with stock check)
    // Only decrement if registration is confirmed (paid/free modality)
    // For pending registrations, the decrement will happen when payment is confirmed
    if (registrationData.tamanhoCamisa && registrationData.status === 'confirmada') {
      // Check if event uses modality-specific shirt sizes
      const eventResult2 = await client.query(
        `SELECT usar_grade_por_modalidade FROM events WHERE id = $1`,
        [registrationData.eventId]
      );
      const usarGradePorModalidade = eventResult2.rows[0]?.usar_grade_por_modalidade || false;
      
      let shirtSizeResult;
      if (usarGradePorModalidade) {
        // Lock and check modality-specific shirt size
        shirtSizeResult = await client.query(
          `SELECT id, quantidade_disponivel FROM shirt_sizes 
           WHERE modality_id = $1 AND tamanho = $2 
           FOR UPDATE`,
          [registrationData.modalityId, registrationData.tamanhoCamisa]
        );
      } else {
        // Lock and check global event shirt size
        shirtSizeResult = await client.query(
          `SELECT id, quantidade_disponivel FROM shirt_sizes 
           WHERE event_id = $1 AND modality_id IS NULL AND tamanho = $2 
           FOR UPDATE`,
          [registrationData.eventId, registrationData.tamanhoCamisa]
        );
      }
      
      // Check if shirt size exists and has stock
      if (shirtSizeResult.rows.length > 0) {
        const shirtSize = shirtSizeResult.rows[0];
        if (shirtSize.quantidade_disponivel <= 0) {
          await client.query('ROLLBACK');
          return {
            success: false,
            error: `Tamanho ${registrationData.tamanhoCamisa} esgotado. Por favor, selecione outro tamanho.`,
            errorCode: 'SHIRT_SIZE_SOLD_OUT' as RegistrationErrorCode
          };
        }
        
        // Decrement the shirt size quantity
        await client.query(
          `UPDATE shirt_sizes SET quantidade_disponivel = quantidade_disponivel - 1 WHERE id = $1`,
          [shirtSize.id]
        );
      }
      // If no shirt size row exists, we allow the registration (no shirt grid configured)
    }

    // 8. CHECK IF BATCH IS NOW FULL AND CLOSE IT (automatic lot switching)
    const updatedBatch = await client.query(
      `SELECT quantidade_maxima, quantidade_utilizada FROM registration_batches WHERE id = $1`,
      [batchId]
    );
    
    if (updatedBatch.rows[0].quantidade_maxima !== null && 
        updatedBatch.rows[0].quantidade_utilizada >= updatedBatch.rows[0].quantidade_maxima) {
      await closeBatchAndActivateNext(client, batchId, registrationData.eventId);
    }
    
    await client.query('COMMIT');
    
    return {
      success: true,
      order: {
        id: order.id,
        numeroPedido: order.numero_pedido,
        valorTotal: parseFloat(order.valor_total),
        status: order.status,
        dataExpiracao: order.data_expiracao
      },
      registration: {
        id: registration.id,
        numeroInscricao: registration.numero_inscricao,
        status: registration.status,
        batchId: batchId,
        valorUnitario: parseFloat(registrationData.valorUnitario)
      }
    };
    
  } catch (e: any) {
    await client.query('ROLLBACK');
    
    if (e.code === '23505') {
      return {
        success: false,
        error: 'Voce ja possui inscricao nesta modalidade',
        errorCode: 'JA_INSCRITO'
      };
    }
    
    console.error('Erro na inscricao atomica:', e);
    return {
      success: false,
      error: 'Erro interno do servidor',
      errorCode: 'INTERNAL_ERROR'
    };
    
  } finally {
    client.release();
  }
}

export async function decrementVagasOcupadas(
  eventId: string, 
  modalityId?: string, 
  batchId?: string,
  tamanhoCamisa?: string | null,
  wasStockDeducted: boolean = false
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    await client.query(
      'UPDATE events SET vagas_ocupadas = GREATEST(vagas_ocupadas - 1, 0) WHERE id = $1',
      [eventId]
    );

    if (modalityId) {
      await client.query(
        'UPDATE modalities SET vagas_ocupadas = GREATEST(vagas_ocupadas - 1, 0) WHERE id = $1',
        [modalityId]
      );
    }

    if (batchId) {
      await client.query(
        'UPDATE registration_batches SET quantidade_utilizada = GREATEST(quantidade_utilizada - 1, 0) WHERE id = $1',
        [batchId]
      );
    }

    // Increment shirt size back ONLY if it was actually deducted
    // For pending registrations, stock is never reserved, so we don't increment
    if (tamanhoCamisa && modalityId && wasStockDeducted) {
      // Check if event uses modality-specific shirt sizes
      const eventResult = await client.query(
        `SELECT usar_grade_por_modalidade FROM events WHERE id = $1`,
        [eventId]
      );
      const usarGradePorModalidade = eventResult.rows[0]?.usar_grade_por_modalidade || false;
      
      if (usarGradePorModalidade) {
        // Increment modality-specific shirt size
        await client.query(
          `UPDATE shirt_sizes 
           SET quantidade_disponivel = quantidade_disponivel + 1 
           WHERE modality_id = $1 AND tamanho = $2`,
          [modalityId, tamanhoCamisa]
        );
      } else {
        // Increment global event shirt size
        await client.query(
          `UPDATE shirt_sizes 
           SET quantidade_disponivel = quantidade_disponivel + 1 
           WHERE event_id = $1 AND modality_id IS NULL AND tamanho = $2`,
          [eventId, tamanhoCamisa]
        );
      }
    }

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function getAvailableSpots(eventId: string): Promise<{
  event: { total: number; occupied: number; available: number };
  modalities: Array<{ id: string; name: string; total: number | null; occupied: number; available: number | null }>;
  activeBatch: { id: string; name: string; total: number | null; occupied: number; available: number | null } | null;
}> {
  const client = await pool.connect();
  
  try {
    const eventResult = await client.query(
      `SELECT id, nome, limite_vagas_total, vagas_ocupadas FROM events WHERE id = $1`,
      [eventId]
    );

    if (eventResult.rows.length === 0) {
      throw new Error("Evento nao encontrado");
    }

    const event = eventResult.rows[0];
    
    const modalitiesResult = await client.query(
      `SELECT id, nome, limite_vagas, vagas_ocupadas FROM modalities WHERE event_id = $1 ORDER BY ordem`,
      [eventId]
    );

    const batchResult = await client.query(
      `SELECT id, nome, quantidade_maxima, quantidade_utilizada 
       FROM registration_batches 
       WHERE event_id = $1 AND status = 'active'
       ORDER BY ordem ASC
       LIMIT 1`,
      [eventId]
    );

    return {
      event: {
        total: event.limite_vagas_total,
        occupied: event.vagas_ocupadas,
        available: event.limite_vagas_total - event.vagas_ocupadas
      },
      modalities: modalitiesResult.rows.map(m => ({
        id: m.id,
        name: m.nome,
        total: m.limite_vagas,
        occupied: m.vagas_ocupadas,
        available: m.limite_vagas !== null ? m.limite_vagas - m.vagas_ocupadas : null
      })),
      activeBatch: batchResult.rows.length > 0 ? {
        id: batchResult.rows[0].id,
        name: batchResult.rows[0].nome,
        total: batchResult.rows[0].quantidade_maxima,
        occupied: batchResult.rows[0].quantidade_utilizada,
        available: batchResult.rows[0].quantidade_maxima !== null 
          ? batchResult.rows[0].quantidade_maxima - batchResult.rows[0].quantidade_utilizada 
          : null
      } : null
    };

  } finally {
    client.release();
  }
}

export interface ConfirmPaymentResult {
  success: boolean;
  error?: string;
  errorCode?: string;
}

export async function confirmPaymentAtomic(
  orderId: string,
  metodoPagamento: string
): Promise<ConfirmPaymentResult> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 1. Get and lock the order
    const orderResult = await client.query(
      `SELECT id, event_id, status, cupom_id, comprador_id, valor_desconto FROM orders WHERE id = $1 FOR UPDATE`,
      [orderId]
    );
    
    if (!orderResult.rows[0]) {
      await client.query('ROLLBACK');
      return { success: false, error: 'Pedido nao encontrado', errorCode: 'ORDER_NOT_FOUND' };
    }
    
    const order = orderResult.rows[0];
    
    if (order.status === 'pago') {
      await client.query('ROLLBACK');
      return { success: false, error: 'Pedido ja foi confirmado', errorCode: 'ALREADY_PAID' };
    }
    
    if (order.status === 'cancelado') {
      await client.query('ROLLBACK');
      return { success: false, error: 'Pedido foi cancelado', errorCode: 'ORDER_CANCELLED' };
    }
    
    // 2. Update order status to paid
    await client.query(
      `UPDATE orders SET status = 'pago', metodo_pagamento = $1, data_pagamento = NOW() WHERE id = $2`,
      [metodoPagamento, orderId]
    );
    
    // 2.1. Register coupon usage if a coupon was applied
    if (order.cupom_id && order.comprador_id) {
      // Increment coupon global usage counter
      await client.query(
        `UPDATE event_coupons SET current_uses = current_uses + 1 WHERE id = $1`,
        [order.cupom_id]
      );
      
      // Create coupon usage record for user tracking
      await client.query(
        `INSERT INTO coupon_usages (id, coupon_id, user_id, order_id, discount_applied)
         VALUES (gen_random_uuid(), $1, $2, $3, $4)`,
        [order.cupom_id, order.comprador_id, orderId, order.valor_desconto || '0']
      );
      
      console.log(`[confirmPaymentAtomic] Cupom ${order.cupom_id} uso registrado para pedido ${orderId}`);
    }
    
    // 3. Get all registrations for this order
    const registrationsResult = await client.query(
      `SELECT id, event_id, modality_id, tamanho_camisa, status 
       FROM registrations 
       WHERE order_id = $1 
       FOR UPDATE`,
      [orderId]
    );
    
    // 4. Check event for shirt size configuration
    const eventResult = await client.query(
      `SELECT usar_grade_por_modalidade FROM events WHERE id = $1`,
      [order.event_id]
    );
    const usarGradePorModalidade = eventResult.rows[0]?.usar_grade_por_modalidade || false;
    
    // 5. First pass: validate all shirt sizes have stock (before any updates)
    const shirtUpdates: Array<{ shirtSizeId: string; tamanho: string }> = [];
    const registrationsToConfirm: string[] = [];
    
    for (const reg of registrationsResult.rows) {
      // Skip if already confirmed
      if (reg.status === 'confirmada') continue;
      
      registrationsToConfirm.push(reg.id);
      
      // Validate shirt size if selected
      if (reg.tamanho_camisa) {
        let shirtSizeResult;
        if (usarGradePorModalidade) {
          shirtSizeResult = await client.query(
            `SELECT id, quantidade_disponivel FROM shirt_sizes 
             WHERE modality_id = $1 AND tamanho = $2 
             FOR UPDATE`,
            [reg.modality_id, reg.tamanho_camisa]
          );
        } else {
          shirtSizeResult = await client.query(
            `SELECT id, quantidade_disponivel FROM shirt_sizes 
             WHERE event_id = $1 AND modality_id IS NULL AND tamanho = $2 
             FOR UPDATE`,
            [reg.event_id, reg.tamanho_camisa]
          );
        }
        
        if (shirtSizeResult.rows.length > 0) {
          const shirtSize = shirtSizeResult.rows[0];
          
          // Count how many of this size we need
          const sameShirtCount = shirtUpdates.filter(s => s.shirtSizeId === shirtSize.id).length;
          
          if (shirtSize.quantidade_disponivel <= sameShirtCount) {
            // Shirt size sold out - rollback and return error
            await client.query('ROLLBACK');
            return {
              success: false,
              error: `Tamanho ${reg.tamanho_camisa} esgotado. Por favor, entre em contato com o organizador.`,
              errorCode: 'SHIRT_SIZE_SOLD_OUT'
            };
          }
          
          shirtUpdates.push({ shirtSizeId: shirtSize.id, tamanho: reg.tamanho_camisa });
        }
      }
    }
    
    // 6. Second pass: apply all updates atomically (validation passed)
    // Decrement shirt sizes
    for (const update of shirtUpdates) {
      await client.query(
        `UPDATE shirt_sizes SET quantidade_disponivel = quantidade_disponivel - 1 WHERE id = $1`,
        [update.shirtSizeId]
      );
    }
    
    // Update registration statuses
    for (const regId of registrationsToConfirm) {
      await client.query(
        `UPDATE registrations SET status = 'confirmada' WHERE id = $1`,
        [regId]
      );
      
      // Log registration status change
      await logStatusChange({
        entityType: 'registration',
        entityId: regId,
        oldStatus: 'pendente',
        newStatus: 'confirmada',
        reason: `Pagamento confirmado via ${metodoPagamento}`,
        changedByType: 'system',
        metadata: {
          orderId,
          metodoPagamento,
          function: 'confirmPaymentAtomic'
        }
      });
    }
    
    // Log order status change
    await logStatusChange({
      entityType: 'order',
      entityId: orderId,
      oldStatus: order.status,
      newStatus: 'pago',
      reason: `Pagamento aprovado via ${metodoPagamento}`,
      changedByType: 'system',
      metadata: {
        metodoPagamento,
        registrationsConfirmed: registrationsToConfirm.length,
        function: 'confirmPaymentAtomic'
      }
    });
    
    await client.query('COMMIT');
    return { success: true };
    
  } catch (e: any) {
    await client.query('ROLLBACK');
    console.error('Erro ao confirmar pagamento:', e);
    return { success: false, error: 'Erro interno do servidor', errorCode: 'INTERNAL_ERROR' };
  } finally {
    client.release();
  }
}
