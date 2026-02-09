import { MercadoPagoConfig, Payment } from 'mercadopago';
import crypto from 'crypto';

const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

if (!accessToken) {
  console.warn('[mercadopago-service] MERCADOPAGO_ACCESS_TOKEN não configurado. Integração com Mercado Pago desabilitada.');
}

const client = accessToken ? new MercadoPagoConfig({ 
  accessToken,
  options: {
    timeout: 30000 // 30 segundos para evitar falhas de timeout
  }
}) : null;
const paymentClient = client ? new Payment(client) : null;

export interface PixPaymentResult {
  success: boolean;
  paymentId?: string;
  status?: string;
  qrCode?: string;
  qrCodeBase64?: string;
  expirationDate?: string;
  error?: string;
}

export interface CardPaymentResult {
  success: boolean;
  paymentId?: string;
  status?: string;
  statusDetail?: string;
  error?: string;
}

export interface PaymentStatusResult {
  success: boolean;
  paymentId?: string;
  status?: string;
  statusDetail?: string;
  dateApproved?: string;
  externalReference?: string;
  error?: string;
}

export async function createPixPayment(
  orderId: string,
  amount: number,
  description: string,
  buyerEmail: string,
  buyerName?: string,
  externalReference?: string
): Promise<PixPaymentResult> {
  if (!paymentClient) {
    return {
      success: false,
      error: 'Mercado Pago não configurado. Configure MERCADOPAGO_ACCESS_TOKEN.'
    };
  }

  try {
    const expirationMinutes = parseInt(process.env.ORDER_EXPIRATION_MINUTES || "30", 10);
    const expirationDate = new Date(Date.now() + expirationMinutes * 60 * 1000);

    // Separar nome em primeiro nome e sobrenome
    const nameParts = (buyerName || "").trim().split(/\s+/);
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    // Gerar chave de idempotência única para evitar retorno de pagamentos em cache
    const idempotencyKey = `pix-${orderId}-${Date.now()}-${crypto.randomUUID()}`;
    
    console.log(`[mercadopago-service] Criando PIX para pedido ${orderId} com idempotencyKey: ${idempotencyKey}`);

    const payment = await paymentClient.create({
      body: {
        transaction_amount: amount,
        description: description,
        payment_method_id: 'pix',
        statement_descriptor: "KITRUNNER",
        payer: {
          email: buyerEmail,
          first_name: firstName || undefined,
          last_name: lastName || undefined
        },
        external_reference: externalReference || orderId,
        date_of_expiration: expirationDate.toISOString()
      },
      requestOptions: {
        idempotencyKey: idempotencyKey
      }
    });

    const pixData = payment.point_of_interaction?.transaction_data;
    
    console.log(`[mercadopago-service] PIX criado: id=${payment.id}, status=${payment.status}, hasQrCode=${!!pixData?.qr_code}, hasQrCodeBase64=${!!pixData?.qr_code_base64}`);

    return {
      success: true,
      paymentId: payment.id?.toString(),
      status: payment.status || undefined,
      qrCode: pixData?.qr_code || undefined,
      qrCodeBase64: pixData?.qr_code_base64 || undefined,
      expirationDate: payment.date_of_expiration || undefined
    };
  } catch (error: any) {
    console.error('[mercadopago-service] Erro ao criar pagamento PIX:', error);
    // Log detalhes adicionais para debug
    if (error.cause) {
      console.error('[mercadopago-service] Detalhes do erro PIX:', JSON.stringify(error.cause, null, 2));
    }
    return {
      success: false,
      error: error.message || 'Erro ao criar pagamento PIX'
    };
  }
}

export interface PayerAddressInfo {
  zipCode?: string;
  streetName?: string;
  streetNumber?: string;
  neighborhood?: string;
  city?: string;
  federalUnit?: string;
}

export interface PayerPhoneInfo {
  areaCode?: string;
  number?: string;
}

export async function createCardPayment(
  orderId: string,
  amount: number,
  token: string,
  installments: number,
  buyerEmail: string,
  paymentMethodId: string,
  issuerId: string,
  externalReference?: string,
  payerIdentification?: { type: string; number: string },
  cardholderName?: string,
  description?: string,
  ipAddress?: string,
  payerPhone?: PayerPhoneInfo,
  payerAddress?: PayerAddressInfo,
  deviceId?: string
): Promise<CardPaymentResult> {
  if (!paymentClient) {
    return {
      success: false,
      error: 'Mercado Pago não configurado. Configure MERCADOPAGO_ACCESS_TOKEN.'
    };
  }

  try {
    // === VALIDAÇÕES ===
    // Validar token do cartão
    if (!token || token.length < 10) {
      return {
        success: false,
        error: 'Token do cartão inválido ou muito curto'
      };
    }

    // Validar CPF (11 dígitos)
    const cleanCpf = payerIdentification?.number?.replace(/\D/g, '') || '';
    if (cleanCpf.length !== 11) {
      return {
        success: false,
        error: 'CPF inválido - deve ter exatamente 11 dígitos'
      };
    }

    // Validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(buyerEmail)) {
      return {
        success: false,
        error: 'Email inválido'
      };
    }

    // Parse first_name and last_name from cardholderName
    let firstName = "";
    let lastName = "";
    if (cardholderName) {
      const nameParts = cardholderName.trim().split(/\s+/);
      firstName = nameParts[0] || "";
      lastName = nameParts.slice(1).join(" ") || nameParts[0] || "";
    }

    // Validar nome e sobrenome
    if (firstName.length < 1 || lastName.length < 1) {
      return {
        success: false,
        error: 'Nome e sobrenome são obrigatórios'
      };
    }

    const paymentBody: any = {
      transaction_amount: amount,
      token: token,
      description: description || `Pagamento pedido ${orderId}`,
      installments: installments,
      payment_method_id: paymentMethodId,
      statement_descriptor: "KITRUNNER",
      binary_mode: false,
      payer: {
        email: buyerEmail,
        first_name: firstName,
        last_name: lastName,
        identification: {
          type: "CPF",
          number: cleanCpf
        }
      },
      external_reference: externalReference || `order_${orderId}`,
      additional_info: {
        items: [
          {
            id: orderId.substring(0, 50),
            title: (description || `Inscrição em evento esportivo`).substring(0, 255),
            description: (description || `Inscrição em evento esportivo`).substring(0, 255),
            category_id: "services",
            quantity: 1,
            unit_price: amount
          }
        ],
        payer: {
          first_name: firstName,
          last_name: lastName,
          registration_date: new Date().toISOString()
        }
      }
    };

    // Add payer identification (required for real cards in Brazil)
    if (payerIdentification) {
      paymentBody.payer.identification = {
        type: payerIdentification.type,
        number: payerIdentification.number
      };
    }

    // Add payer phone (helps with anti-fraud analysis)
    if (payerPhone?.areaCode && payerPhone?.number) {
      paymentBody.payer.phone = {
        area_code: payerPhone.areaCode,
        number: payerPhone.number
      };
      paymentBody.additional_info.payer.phone = {
        area_code: payerPhone.areaCode,
        number: payerPhone.number
      };
    }

    // Add payer address (critical for anti-fraud analysis)
    // IMPORTANTE: Não enviar valores genéricos - só enviar endereço se tiver dados reais
    const streetNameNormalized = payerAddress?.streetName?.trim().toLowerCase() || "";
    const isValidStreetName = payerAddress?.streetName && 
      payerAddress.streetName.trim() !== "" && 
      streetNameNormalized !== "não informado" &&
      streetNameNormalized !== "nao informado" &&
      !streetNameNormalized.includes("não informado") &&
      !streetNameNormalized.includes("nao informado");
    
    if (payerAddress?.zipCode && isValidStreetName) {
      const cleanZipCode = payerAddress.zipCode.replace(/\D/g, "");
      const streetNumber = parseInt(payerAddress.streetNumber || "0", 10) || 1;
      const validatedStreetName = payerAddress.streetName!.trim();
      
      paymentBody.payer.address = {
        zip_code: cleanZipCode,
        street_name: validatedStreetName,
        street_number: streetNumber
      };
      
      paymentBody.additional_info.payer.address = {
        zip_code: cleanZipCode,
        street_name: validatedStreetName,
        street_number: streetNumber
      };
      
      // Shipments info helps with fraud prevention
      paymentBody.additional_info.shipments = {
        receiver_address: {
          zip_code: cleanZipCode,
          state_name: payerAddress.federalUnit || "",
          city_name: payerAddress.city || "",
          street_name: validatedStreetName,
          street_number: streetNumber
        }
      };
    }

    if (issuerId && issuerId.trim() !== "") {
      paymentBody.issuer_id = parseInt(issuerId, 10);
    }

    // Add IP address for fraud prevention if available
    if (ipAddress) {
      paymentBody.additional_info.ip_address = ipAddress;
    }

    // Enable 3D Secure for improved approval rates on high-risk payments
    // "optional" allows MP to decide when 3DS is needed
    paymentBody.three_d_secure_mode = "optional";

    // Gerar chave de idempotência única para evitar duplicatas
    const idempotencyKey = `${orderId}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    // Preparar headers customizados para antifraude
    const customHeaders: Record<string, string> = {};
    if (deviceId && deviceId.trim() !== "") {
      customHeaders['X-Device-Id'] = deviceId.trim();
    }

    console.log('[mercadopago-service] Enviando pagamento cartão:', {
      transaction_amount: paymentBody.transaction_amount,
      payment_method_id: paymentBody.payment_method_id,
      installments: paymentBody.installments,
      issuer_id: paymentBody.issuer_id,
      has_token: !!paymentBody.token,
      has_identification: !!paymentBody.payer?.identification,
      identification_number: paymentBody.payer?.identification?.number ? `***${paymentBody.payer.identification.number.slice(-4)}` : null,
      has_phone: !!paymentBody.payer?.phone,
      has_address: !!paymentBody.payer?.address,
      has_shipments: !!paymentBody.additional_info?.shipments,
      payer_email: paymentBody.payer?.email,
      payer_first_name: paymentBody.payer?.first_name,
      payer_last_name: paymentBody.payer?.last_name,
      three_d_secure: paymentBody.three_d_secure_mode,
      idempotency_key: idempotencyKey,
      has_device_id: !!deviceId,
      device_id_length: deviceId?.length || 0
    });

    const payment = await paymentClient.create({
      body: paymentBody,
      requestOptions: {
        idempotencyKey: idempotencyKey,
        ...(Object.keys(customHeaders).length > 0 && { headers: customHeaders })
      }
    });

    console.log('[mercadopago-service] Resposta pagamento:', {
      id: payment.id,
      status: payment.status,
      status_detail: payment.status_detail
    });

    return {
      success: true,
      paymentId: payment.id?.toString(),
      status: payment.status || undefined,
      statusDetail: payment.status_detail || undefined
    };
  } catch (error: any) {
    console.error('[mercadopago-service] Erro ao criar pagamento com cartão:', error);
    // Log full error details for debugging
    if (error.cause) {
      console.error('[mercadopago-service] Detalhes do erro:', JSON.stringify(error.cause, null, 2));
    }
    return {
      success: false,
      error: error.message || 'Erro ao criar pagamento com cartão'
    };
  }
}

export async function getPaymentStatus(paymentId: string): Promise<PaymentStatusResult> {
  if (!paymentClient) {
    return {
      success: false,
      error: 'Mercado Pago não configurado. Configure MERCADOPAGO_ACCESS_TOKEN.'
    };
  }

  try {
    const payment = await paymentClient.get({ id: paymentId });

    return {
      success: true,
      paymentId: payment.id?.toString(),
      status: payment.status || undefined,
      statusDetail: payment.status_detail || undefined,
      dateApproved: payment.date_approved || undefined,
      externalReference: payment.external_reference || undefined
    };
  } catch (error: any) {
    console.error('[mercadopago-service] Erro ao consultar status do pagamento:', error);
    return {
      success: false,
      error: error.message || 'Erro ao consultar status do pagamento'
    };
  }
}

export function validateWebhookSignature(
  xSignature: string | undefined,
  xRequestId: string | undefined,
  dataId: string,
  secret: string
): boolean {
  if (!xSignature || !xRequestId || !secret) {
    return false;
  }

  try {
    const parts = xSignature.split(',');
    let ts: string | undefined;
    let hash: string | undefined;
    
    for (const part of parts) {
      const [key, value] = part.split('=');
      if (key?.trim() === 'ts') {
        ts = value?.trim();
      } else if (key?.trim() === 'v1') {
        hash = value?.trim();
      }
    }
    
    if (!ts || !hash) {
      return false;
    }
    
    const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
    const expectedHash = crypto
      .createHmac('sha256', secret)
      .update(manifest)
      .digest('hex');
    
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(expectedHash));
  } catch (error) {
    console.error('[mercadopago-service] Erro ao validar assinatura do webhook:', error);
    return false;
  }
}

export function isConfigured(): boolean {
  return !!paymentClient;
}
