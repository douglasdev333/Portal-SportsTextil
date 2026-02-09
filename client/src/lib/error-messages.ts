export const registrationErrors: Record<string, string> = {
  "JA_INSCRITO": "Você já possui inscrição nesta modalidade.",
  "ALREADY_REGISTERED": "Você já está inscrito neste evento.",
  "MODALIDADE_NAO_ENCONTRADA": "Modalidade não encontrada.",
  "EVENTO_NAO_ENCONTRADO": "Evento não encontrado.",
  "INSCRICOES_ENCERRADAS": "As inscrições para este evento estão encerradas.",
  "INSCRICOES_NAO_INICIADAS": "As inscrições ainda não começaram.",
  "VAGAS_ESGOTADAS": "Não há mais vagas disponíveis.",
  "LOTE_ESGOTADO": "Este lote está esgotado.",
  "VOUCHER_INVALIDO": "Voucher inválido ou já utilizado.",
  "VOUCHER_EXPIRADO": "Este voucher expirou.",
  "TAMANHO_OBRIGATORIO": "Selecione o tamanho da camiseta.",
  "ESTOQUE_INSUFICIENTE": "Tamanho de camiseta esgotado.",
};

export const paymentErrors: Record<string, string> = {
  "ORDER_EXPIRED": "Pedido expirado. Faça uma nova inscrição.",
  "ORDER_NOT_FOUND": "Pedido não encontrado.",
  "ORDER_ALREADY_PAID": "Este pedido já foi pago.",
  "PAYMENT_ALREADY_EXISTS": "Já existe um pagamento para este pedido.",
  "INVALID_PAYMENT_METHOD": "Forma de pagamento inválida.",
};

export const mercadoPagoErrors: Record<string, string> = {
  "cc_rejected_high_risk": "Pagamento não autorizado. Tente outro cartão ou aguarde alguns minutos.",
  "cc_rejected_insufficient_amount": "Saldo insuficiente no cartão.",
  "cc_rejected_bad_filled_card_number": "Número do cartão incorreto.",
  "cc_rejected_bad_filled_date": "Data de validade incorreta.",
  "cc_rejected_bad_filled_security_code": "Código de segurança incorreto.",
  "cc_rejected_bad_filled_other": "Dados do cartão incorretos. Verifique e tente novamente.",
  "cc_rejected_blacklist": "Cartão não autorizado. Use outro cartão.",
  "cc_rejected_call_for_authorize": "Ligue para a operadora do cartão para autorizar.",
  "cc_rejected_card_disabled": "Cartão desabilitado. Entre em contato com a operadora.",
  "cc_rejected_duplicated_payment": "Pagamento duplicado. Verifique se já não foi processado.",
  "cc_rejected_max_attempts": "Limite de tentativas excedido. Tente novamente mais tarde.",
  "cc_rejected_other_reason": "Pagamento não autorizado. Tente outro cartão.",
  "pending_contingency": "Pagamento em análise. Aguarde a confirmação.",
  "pending_review_manual": "Pagamento em análise manual. Aguarde a confirmação.",
};

export function parseApiError(error: any, defaultMessage = "Ocorreu um erro. Tente novamente."): string {
  try {
    const errorStr = error?.message || String(error);
    const jsonMatch = errorStr.match(/\d+:\s*(.+)/);
    
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[1]);
      return getFriendlyErrorMessage(parsed.error, parsed.errorCode, parsed.statusDetail);
    }
  } catch {
    // Ignorar erro de parse
  }
  return defaultMessage;
}

export function getFriendlyErrorMessage(
  error?: string, 
  errorCode?: string, 
  statusDetail?: string
): string {
  // Verificar código de erro específico primeiro
  if (errorCode && registrationErrors[errorCode]) {
    return registrationErrors[errorCode];
  }
  
  if (errorCode && paymentErrors[errorCode]) {
    return paymentErrors[errorCode];
  }
  
  // Verificar statusDetail do Mercado Pago
  if (statusDetail && mercadoPagoErrors[statusDetail]) {
    return mercadoPagoErrors[statusDetail];
  }
  
  // Verificar se o erro contém algum código conhecido
  if (error) {
    for (const [code, message] of Object.entries({...registrationErrors, ...paymentErrors})) {
      if (error.includes(code)) {
        return message;
      }
    }
    
    // Se é uma mensagem legível (sem JSON), retornar ela
    if (!error.includes("{") && error.length < 200) {
      return error;
    }
  }
  
  return "Não foi possível completar a operação. Tente novamente.";
}
