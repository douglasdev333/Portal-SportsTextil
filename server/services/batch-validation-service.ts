import { pool } from '../db';
import type { PoolClient } from 'pg';
import { logStatusChange } from './status-log-service';

export interface BatchValidationResult {
  eventId: string;
  eventStatus: string;
  batchesUpdated: number;
  eventMarkedAsSoldOut: boolean;
  activeBatchId: string | null;
  hasValidBatches: boolean;
}

export interface ModalityAvailability {
  id: string;
  nome: string;
  tipoAcesso: string;
  limiteVagas: number | null;
  vagasOcupadas: number;
  isAvailable: boolean;
  isSoldOut: boolean;
  activeBatchId: string | null;
  activeBatchPrice: string | null;
}

/**
 * Recalcula e valida os lotes de um evento.
 * 
 * Esta função deve ser chamada:
 * 1. Quando o cliente acessa a tela do evento/modalidades (GET)
 * 2. Antes de iniciar a transação de inscrição
 * 
 * Verifica:
 * - Se o lote ativo expirou por data/hora (timezone São Paulo)
 * - Se o lote ativo atingiu limite de vagas
 * - Ativa o próximo lote se necessário
 * - Marca evento como 'esgotado' se não houver mais lotes válidos
 */
export async function recalculateBatchesForEvent(eventId: string): Promise<BatchValidationResult> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Lock event for update
    const eventResult = await client.query(
      `SELECT id, status, limite_vagas_total, vagas_ocupadas 
       FROM events 
       WHERE id = $1 
       FOR UPDATE`,
      [eventId]
    );
    
    if (eventResult.rows.length === 0) {
      await client.query('ROLLBACK');
      throw new Error('Evento não encontrado');
    }
    
    const event = eventResult.rows[0];
    let batchesUpdated = 0;
    let eventMarkedAsSoldOut = false;
    
    // Check if event capacity is already full - mark as sold out
    if (event.vagas_ocupadas >= event.limite_vagas_total) {
      if (event.status !== 'esgotado') {
        const oldStatus = event.status;
        await client.query(
          `UPDATE events SET status = 'esgotado' WHERE id = $1`,
          [eventId]
        );
        eventMarkedAsSoldOut = true;
        
        // Log status change
        await logStatusChange({
          entityType: 'event',
          entityId: eventId,
          oldStatus,
          newStatus: 'esgotado',
          reason: `Capacidade atingida: ${event.vagas_ocupadas}/${event.limite_vagas_total} vagas ocupadas`,
          changedByType: 'system',
          metadata: {
            vagasOcupadas: event.vagas_ocupadas,
            limiteVagasTotal: event.limite_vagas_total,
            function: 'recalculateBatchesForEvent'
          }
        });
      }
      
      await client.query('COMMIT');
      return {
        eventId,
        eventStatus: 'esgotado',
        batchesUpdated: 0,
        eventMarkedAsSoldOut,
        activeBatchId: null,
        hasValidBatches: false
      };
    }
    
    // Get all active batches that might need updating
    const activeBatches = await client.query(
      `SELECT id, nome, data_inicio, data_termino, quantidade_maxima, quantidade_utilizada, ordem, status
       FROM registration_batches
       WHERE event_id = $1 
         AND status = 'active'
       ORDER BY ordem ASC
       FOR UPDATE`,
      [eventId]
    );
    
    // Check each active batch for expiration or capacity
    for (const batch of activeBatches.rows) {
      let needsClosing = false;
      
      // Check if batch expired by date (using São Paulo timezone)
      if (batch.data_termino) {
        const expiredByDate = await client.query(
          `SELECT ($1::timestamptz AT TIME ZONE 'America/Sao_Paulo') < (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo') as expired`,
          [batch.data_termino]
        );
        
        if (expiredByDate.rows[0]?.expired) {
          needsClosing = true;
          console.log(`Lote ${batch.id} (${batch.nome}) expirou por data`);
        }
      }
      
      // Check if batch is full by capacity
      if (batch.quantidade_maxima !== null && batch.quantidade_utilizada >= batch.quantidade_maxima) {
        needsClosing = true;
        console.log(`Lote ${batch.id} (${batch.nome}) esgotou por capacidade`);
      }
      
      if (needsClosing && batch.status !== 'closed') {
        // Close this batch
        await client.query(
          `UPDATE registration_batches 
           SET status = 'closed' 
           WHERE id = $1`,
          [batch.id]
        );
        batchesUpdated++;
        
        // Try to find and activate the next valid batch
        const candidateBatches = await client.query(
          `SELECT id, nome, data_inicio, data_termino, quantidade_maxima, quantidade_utilizada
           FROM registration_batches
           WHERE event_id = $1 
             AND ordem > $2
             AND status = 'future'
           ORDER BY ordem ASC
           FOR UPDATE`,
          [eventId, batch.ordem]
        );
        
        // Find the first valid candidate batch
        for (const candidate of candidateBatches.rows) {
          // Check if candidate batch is already full - close it permanently
          if (candidate.quantidade_maxima !== null && candidate.quantidade_utilizada >= candidate.quantidade_maxima) {
            console.log(`Lote candidato ${candidate.id} (${candidate.nome}) já está cheio, fechando...`);
            await client.query(
              `UPDATE registration_batches 
               SET status = 'closed' 
               WHERE id = $1`,
              [candidate.id]
            );
            batchesUpdated++;
            continue;
          }
          
          // Check if candidate batch is already expired - close it permanently
          if (candidate.data_termino) {
            const candidateExpired = await client.query(
              `SELECT ($1::timestamptz AT TIME ZONE 'America/Sao_Paulo') < (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo') as expired`,
              [candidate.data_termino]
            );
            
            if (candidateExpired.rows[0]?.expired) {
              console.log(`Lote candidato ${candidate.id} (${candidate.nome}) já expirou, fechando...`);
              await client.query(
                `UPDATE registration_batches 
                 SET status = 'closed' 
                 WHERE id = $1`,
                [candidate.id]
              );
              batchesUpdated++;
              continue;
            }
          }
          
          // Check if candidate batch start date has arrived (São Paulo timezone)
          // If start date is in the future, we cannot activate it yet - stop searching
          if (candidate.data_inicio) {
            const canStart = await client.query(
              `SELECT ($1::timestamptz AT TIME ZONE 'America/Sao_Paulo') <= (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo') as can_start`,
              [candidate.data_inicio]
            );
            
            if (!canStart.rows[0]?.can_start) {
              console.log(`Lote candidato ${candidate.id} (${candidate.nome}) ainda não iniciou, aguardando...`);
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
          batchesUpdated++;
          console.log(`Lote ${candidate.id} (${candidate.nome}) ativado como próximo lote`);
          break; // Only activate one batch
        }
      }
    }
    
    // Check for valid active batch after updates
    const currentActiveBatch = await client.query(
      `SELECT id FROM registration_batches
       WHERE event_id = $1 
         AND status = 'active'
         AND (quantidade_maxima IS NULL OR quantidade_utilizada < quantidade_maxima)
       ORDER BY ordem ASC
       LIMIT 1`,
      [eventId]
    );
    
    const hasValidBatches = currentActiveBatch.rows.length > 0;
    const activeBatchId = hasValidBatches ? currentActiveBatch.rows[0].id : null;
    
    // If no valid batches, check if we should mark event as sold out
    if (!hasValidBatches) {
      // Check if there are any future batches waiting
      const futureBatches = await client.query(
        `SELECT id FROM registration_batches
         WHERE event_id = $1 
           AND status = 'future'
         LIMIT 1`,
        [eventId]
      );
      
      // If no future batches and no active batch, mark event as sold out
      if (futureBatches.rows.length === 0 && event.status !== 'esgotado') {
        const oldStatus = event.status;
        await client.query(
          `UPDATE events SET status = 'esgotado' WHERE id = $1`,
          [eventId]
        );
        eventMarkedAsSoldOut = true;
        
        // Log status change
        await logStatusChange({
          entityType: 'event',
          entityId: eventId,
          oldStatus,
          newStatus: 'esgotado',
          reason: 'Sem lotes ativos ou futuros disponíveis',
          changedByType: 'system',
          metadata: {
            hasValidBatches: false,
            hasFutureBatches: false,
            function: 'recalculateBatchesForEvent'
          }
        });
      }
    }
    
    // Get final event status
    const finalEventStatus = await client.query(
      `SELECT status FROM events WHERE id = $1`,
      [eventId]
    );
    
    await client.query('COMMIT');
    
    return {
      eventId,
      eventStatus: finalEventStatus.rows[0]?.status || event.status,
      batchesUpdated,
      eventMarkedAsSoldOut,
      activeBatchId,
      hasValidBatches
    };
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro ao recalcular lotes:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Verifica a disponibilidade de todas as modalidades de um evento.
 * Retorna informações sobre quais modalidades estão abertas ou esgotadas.
 */
export async function getModalitiesAvailability(eventId: string): Promise<{
  eventStatus: string;
  eventSoldOut: boolean;
  modalities: ModalityAvailability[];
}> {
  const client = await pool.connect();
  
  try {
    // First, recalculate batches to ensure data is fresh
    const batchResult = await recalculateBatchesForEvent(eventId);
    
    // Get event status
    const eventResult = await client.query(
      `SELECT status, limite_vagas_total, vagas_ocupadas FROM events WHERE id = $1`,
      [eventId]
    );
    
    if (eventResult.rows.length === 0) {
      throw new Error('Evento não encontrado');
    }
    
    const event = eventResult.rows[0];
    const eventSoldOut = event.status === 'esgotado' || event.vagas_ocupadas >= event.limite_vagas_total;
    
    // Get all modalities with their availability
    const modalitiesResult = await client.query(
      `SELECT 
        m.id, 
        m.nome, 
        m.tipo_acesso,
        m.limite_vagas, 
        m.vagas_ocupadas,
        rb.id as active_batch_id,
        p.valor as batch_price
       FROM modalities m
       LEFT JOIN registration_batches rb ON rb.event_id = m.event_id 
         AND rb.status = 'active'
         AND (rb.modality_id IS NULL OR rb.modality_id = m.id)
         AND (rb.quantidade_maxima IS NULL OR rb.quantidade_utilizada < rb.quantidade_maxima)
       LEFT JOIN prices p ON p.batch_id = rb.id AND p.modality_id = m.id
       WHERE m.event_id = $1
       ORDER BY m.ordem ASC`,
      [eventId]
    );
    
    const modalities: ModalityAvailability[] = modalitiesResult.rows.map(m => {
      // If event is sold out, all modalities are sold out
      if (eventSoldOut) {
        return {
          id: m.id,
          nome: m.nome,
          tipoAcesso: m.tipo_acesso,
          limiteVagas: m.limite_vagas,
          vagasOcupadas: m.vagas_ocupadas,
          isAvailable: false,
          isSoldOut: true,
          activeBatchId: null,
          activeBatchPrice: null
        };
      }
      
      // Check if modality has reached its limit
      const modalityFull = m.limite_vagas !== null && m.vagas_ocupadas >= m.limite_vagas;
      
      // Check if there's a valid active batch for this modality
      const hasValidBatch = m.active_batch_id !== null;
      
      // For paid modalities, also check if there's a price configured
      const needsPrice = m.tipo_acesso !== 'gratuita';
      const hasValidPrice = !needsPrice || (m.batch_price !== null && parseFloat(m.batch_price) > 0);
      
      const isAvailable = !modalityFull && hasValidBatch && hasValidPrice;
      const isSoldOut = modalityFull || !hasValidBatch;
      
      return {
        id: m.id,
        nome: m.nome,
        tipoAcesso: m.tipo_acesso,
        limiteVagas: m.limite_vagas,
        vagasOcupadas: m.vagas_ocupadas,
        isAvailable,
        isSoldOut,
        activeBatchId: hasValidBatch ? m.active_batch_id : null,
        activeBatchPrice: m.batch_price
      };
    });
    
    return {
      eventStatus: event.status,
      eventSoldOut,
      modalities
    };
    
  } finally {
    client.release();
  }
}

/**
 * Verifica se o evento permite novas inscrições.
 * Deve ser chamada no início do fluxo de inscrição.
 */
export async function checkEventCanAcceptRegistrations(eventId: string): Promise<{
  canAccept: boolean;
  reason?: string;
  errorCode?: string;
}> {
  const client = await pool.connect();
  
  try {
    // First recalculate batches
    await recalculateBatchesForEvent(eventId);
    
    // Check event status and capacity
    const eventResult = await client.query(
      `SELECT status, limite_vagas_total, vagas_ocupadas, encerramento_inscricoes
       FROM events 
       WHERE id = $1`,
      [eventId]
    );
    
    if (eventResult.rows.length === 0) {
      return {
        canAccept: false,
        reason: 'Evento não encontrado',
        errorCode: 'EVENT_NOT_FOUND'
      };
    }
    
    const event = eventResult.rows[0];
    
    // Check if event is sold out
    if (event.status === 'esgotado') {
      return {
        canAccept: false,
        reason: 'Inscrições encerradas - evento esgotado.',
        errorCode: 'EVENT_SOLD_OUT'
      };
    }
    
    // Check if event is not published
    if (event.status === 'rascunho') {
      return {
        canAccept: false,
        reason: 'Evento ainda não publicado.',
        errorCode: 'EVENT_NOT_PUBLISHED'
      };
    }
    
    // Check if event is cancelled or finished
    if (event.status === 'cancelado' || event.status === 'finalizado') {
      return {
        canAccept: false,
        reason: 'Inscrições encerradas para este evento.',
        errorCode: 'EVENT_CLOSED'
      };
    }
    
    // Check if event capacity is full
    if (event.vagas_ocupadas >= event.limite_vagas_total) {
      return {
        canAccept: false,
        reason: 'Evento lotado - vagas esgotadas.',
        errorCode: 'EVENT_FULL'
      };
    }
    
    // Check if registration period has ended (São Paulo timezone)
    const registrationEnded = await client.query(
      `SELECT ($1::timestamptz AT TIME ZONE 'America/Sao_Paulo') < (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo') as ended`,
      [event.encerramento_inscricoes]
    );
    
    if (registrationEnded.rows[0]?.ended) {
      return {
        canAccept: false,
        reason: 'Período de inscrições encerrado.',
        errorCode: 'REGISTRATION_PERIOD_ENDED'
      };
    }
    
    // Check if there's an active batch
    const activeBatch = await client.query(
      `SELECT id FROM registration_batches
       WHERE event_id = $1 
         AND status = 'active'
         AND (quantidade_maxima IS NULL OR quantidade_utilizada < quantidade_maxima)
       LIMIT 1`,
      [eventId]
    );
    
    if (activeBatch.rows.length === 0) {
      return {
        canAccept: false,
        reason: 'Não há lote ativo disponível para inscrição.',
        errorCode: 'NO_ACTIVE_BATCH'
      };
    }
    
    return { canAccept: true };
    
  } finally {
    client.release();
  }
}
