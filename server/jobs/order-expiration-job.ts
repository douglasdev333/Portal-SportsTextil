import { pool } from '../db';
import { decrementVagasOcupadas } from '../services/registration-service';
import { logStatusChange } from '../services/status-log-service';

interface ExpiredOrder {
  id: string;
  numeroPedido: number;
  eventId: string;
  pixExpiracao: Date | null;
  idPagamentoGateway: string | null;
  pixPaymentId: string | null;
}

interface ExpiredRegistration {
  id: string;
  eventId: string;
  modalityId: string;
  batchId: string;
  tamanhoCamisa: string | null;
}

export async function expireOrders(): Promise<{
  processedOrders: number;
  releasedSpots: number;
  errors: number;
}> {
  const client = await pool.connect();
  let processedOrders = 0;
  let releasedSpots = 0;
  let errors = 0;

  try {
    // Buscar pedidos pendentes com expiração passada
    // Incluímos dados do PIX para verificar se ainda está válido
    const expiredOrdersResult = await client.query<ExpiredOrder>(
      `SELECT id, numero_pedido as "numeroPedido", event_id as "eventId",
              pix_expiracao as "pixExpiracao", id_pagamento_gateway as "idPagamentoGateway",
              pix_payment_id as "pixPaymentId"
       FROM orders 
       WHERE status = 'pendente' 
         AND data_expiracao IS NOT NULL 
         AND data_expiracao < NOW()
       FOR UPDATE SKIP LOCKED`
    );

    if (expiredOrdersResult.rows.length === 0) {
      return { processedOrders: 0, releasedSpots: 0, errors: 0 };
    }

    console.log(`[order-expiration-job] Encontrados ${expiredOrdersResult.rows.length} pedidos para verificar`);

    for (const order of expiredOrdersResult.rows) {
      try {
        // REGRA CRÍTICA: Se existe um PIX ainda válido, NÃO cancelar o pedido
        // Isso evita inconsistência entre PIX ativo e pedido cancelado
        // Usar pixPaymentId (campo dedicado) para verificar se existe PIX,
        // pois idPagamentoGateway pode ter sido sobrescrito por tentativa de cartão
        const hasPixData = order.pixPaymentId || (order.idPagamentoGateway && order.pixExpiracao);
        
        if (order.pixExpiracao && hasPixData) {
          const pixExpirationDate = new Date(order.pixExpiracao);
          const now = new Date();
          
          if (pixExpirationDate > now) {
            // PIX ainda válido - atualizar a expiração do pedido para coincidir com o PIX
            console.log(
              `[order-expiration-job] Pedido #${order.numeroPedido} tem PIX válido até ${pixExpirationDate.toISOString()}. ` +
              `Sincronizando expiração do pedido.`
            );
            
            await client.query(
              `UPDATE orders SET data_expiracao = $1 WHERE id = $2`,
              [pixExpirationDate, order.id]
            );
            
            continue; // Pular para o próximo pedido, não cancelar este
          }
        }

        await client.query('BEGIN');

        const registrationsResult = await client.query<ExpiredRegistration>(
          `SELECT id, event_id as "eventId", modality_id as "modalityId", 
                  batch_id as "batchId", tamanho_camisa as "tamanhoCamisa"
           FROM registrations 
           WHERE order_id = $1 AND status = 'pendente'
           FOR UPDATE`,
          [order.id]
        );

        for (const registration of registrationsResult.rows) {
          // wasStockDeducted = false because pending registrations never have shirt stock reserved
          // Stock is only decremented when payment is confirmed (status = 'confirmada')
          await decrementVagasOcupadas(
            registration.eventId,
            registration.modalityId,
            registration.batchId,
            registration.tamanhoCamisa,
            false // wasStockDeducted
          );

          await client.query(
            `UPDATE registrations SET status = 'cancelada' WHERE id = $1`,
            [registration.id]
          );
          
          // Log registration status change
          await logStatusChange({
            entityType: 'registration',
            entityId: registration.id,
            oldStatus: 'pendente',
            newStatus: 'cancelada',
            reason: 'Pedido expirado - tempo limite atingido',
            changedByType: 'system',
            metadata: {
              orderId: order.id,
              numeroPedido: order.numeroPedido,
              function: 'expireOrders'
            }
          });

          releasedSpots++;
        }

        await client.query(
          `UPDATE orders SET status = 'expirado' WHERE id = $1`,
          [order.id]
        );
        
        // Log order status change
        await logStatusChange({
          entityType: 'order',
          entityId: order.id,
          oldStatus: 'pendente',
          newStatus: 'expirado',
          reason: 'Tempo limite de pagamento atingido',
          changedByType: 'system',
          metadata: {
            numeroPedido: order.numeroPedido,
            registrationsCount: registrationsResult.rows.length,
            function: 'expireOrders'
          }
        });

        await client.query('COMMIT');
        processedOrders++;

        console.log(
          `[order-expiration-job] Pedido #${order.numeroPedido} (${order.id}) expirado. ` +
          `${registrationsResult.rows.length} vaga(s) liberada(s).`
        );

      } catch (orderError) {
        await client.query('ROLLBACK');
        errors++;
        console.error(
          `[order-expiration-job] Erro ao expirar pedido #${order.numeroPedido}:`,
          orderError
        );
      }
    }

  } catch (error) {
    console.error('[order-expiration-job] Erro geral ao buscar pedidos expirados:', error);
    errors++;
  } finally {
    client.release();
  }

  if (processedOrders > 0 || errors > 0) {
    console.log(
      `[order-expiration-job] Resumo: ${processedOrders} pedidos expirados, ` +
      `${releasedSpots} vagas liberadas, ${errors} erros`
    );
  }

  return { processedOrders, releasedSpots, errors };
}

let jobInterval: NodeJS.Timeout | null = null;

export function startOrderExpirationJob(intervalMs: number = 60000): void {
  if (jobInterval) {
    console.log('[order-expiration-job] Job já está rodando');
    return;
  }

  console.log(`[order-expiration-job] Iniciando job de expiração (intervalo: ${intervalMs}ms)`);
  
  expireOrders().catch(err => {
    console.error('[order-expiration-job] Erro na execução inicial:', err);
  });

  jobInterval = setInterval(async () => {
    try {
      await expireOrders();
    } catch (err) {
      console.error('[order-expiration-job] Erro na execução periódica:', err);
    }
  }, intervalMs);
}

export function stopOrderExpirationJob(): void {
  if (jobInterval) {
    clearInterval(jobInterval);
    jobInterval = null;
    console.log('[order-expiration-job] Job parado');
  }
}
