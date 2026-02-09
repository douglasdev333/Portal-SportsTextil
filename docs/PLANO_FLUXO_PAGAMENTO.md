# Plano de Implementação - Fluxo de Inscrição com Pagamento

## Visão Geral

Este documento detalha o plano completo para implementar o fluxo de inscrição com pagamento via Mercado Pago, incluindo:
- Criação de pedido pendente com bloqueio atômico de vagas
- Expiração automática de pedidos após 30 minutos
- Integração com Mercado Pago (Webhook + Polling)
- Liberação de vagas quando pedido é cancelado/expirado

---

## Status Atual do Projeto

### ✅ JÁ IMPLEMENTADO

#### 1. Sistema Atômico de Inscrição (`server/services/registration-service.ts`)
- [x] Função `registerForEventAtomic()` com transação completa
- [x] Lock com `FOR UPDATE` em evento, modalidade e lote
- [x] Verificação de capacidade do evento (`events.vagas_ocupadas` vs `limite_vagas_total`)
- [x] Verificação de capacidade da modalidade (`modalities.vagas_ocupadas` vs `limite_vagas`)
- [x] Verificação de capacidade do lote (`registration_batches.quantidade_utilizada` vs `quantidade_maxima`)
- [x] Troca automática de lote quando esgota
- [x] Verificação de duplicidade de inscrição
- [x] Decremento de tamanho de camisa com verificação de estoque
- [x] Rollback automático em caso de erro

#### 2. Liberação de Vagas (`server/services/registration-service.ts`)
- [x] Função `decrementVagasOcupadas()` para reverter contadores
- [x] Decrementa `events.vagas_ocupadas`
- [x] Decrementa `modalities.vagas_ocupadas`
- [x] Decrementa `registration_batches.quantidade_utilizada`
- [x] Incrementa `shirt_sizes.quantidade_disponivel`

#### 3. Schema do Banco (`shared/schema.ts`)
- [x] Campo `dataExpiracao` na tabela `orders`
- [x] Status `expirado` no enum `order_status`
- [x] Campo `idPagamentoGateway` para armazenar ID do MP

#### 4. Validação de Lotes (`server/services/batch-validation-service.ts`)
- [x] Recálculo de lotes por data/hora (timezone São Paulo)
- [x] Ativação automática do próximo lote
- [x] Marcação de evento como esgotado

---

## 🔴 A IMPLEMENTAR

### ✅ FASE 1: Backend - Job de Expiração de Pedidos [CONCLUÍDA - 12/12/2024]

#### Tarefa 1.1: Criar Job de Expiração
**Arquivo:** `server/jobs/order-expiration-job.ts`

**Objetivo:** Executar a cada 1 minuto e expirar pedidos pendentes que passaram de 30 minutos.

**Lógica:**
```typescript
// PSEUDOCÓDIGO - IMPLEMENTAR ASSIM:

1. Buscar todos os pedidos com:
   - status = 'pendente'
   - dataExpiracao < NOW()

2. Para cada pedido encontrado:
   a. Iniciar transação
   b. Buscar todas as inscrições do pedido
   c. Para cada inscrição:
      - Chamar decrementVagasOcupadas(eventId, modalityId, batchId, tamanhoCamisa)
      - Atualizar status da inscrição para 'cancelada'
   d. Atualizar status do pedido para 'expirado'
   e. Commit da transação
   f. Log: "Pedido {id} expirado, {N} vagas liberadas"

3. Tratamento de erro:
   - Se falhar, fazer rollback
   - Logar erro mas continuar para próximo pedido
```

**Checklist implementação:**
- [x] Criar arquivo `server/jobs/order-expiration-job.ts`
- [x] Implementar função `expireOrders()`
- [x] Usar transação para garantir atomicidade
- [x] Chamar `decrementVagasOcupadas` para cada inscrição
- [x] Adicionar logs detalhados
- [x] Registrar job no `server/index.ts` com `setInterval(60000)` (1 min)

**Detalhes da implementação:**
- Job registrado automaticamente ao iniciar o servidor
- Usa `FOR UPDATE SKIP LOCKED` para evitar conflitos em ambiente multi-instância
- Retorna estatísticas: pedidos processados, vagas liberadas, erros
- Configurável via variável de ambiente `ORDER_EXPIRATION_CHECK_INTERVAL_MS`

---

### FASE 2: Backend - Integração Mercado Pago

#### Tarefa 2.1: Configurar SDK do Mercado Pago
**Arquivo:** `server/services/mercadopago-service.ts`

**Variáveis de ambiente necessárias:**
```
MERCADOPAGO_ACCESS_TOKEN=<token de produção ou sandbox>
MERCADOPAGO_WEBHOOK_SECRET=<secret para validar webhooks>
```

**Checklist:**
- [ ] Instalar SDK: `npm install mercadopago`
- [ ] Criar arquivo de serviço
- [ ] Configurar cliente MP com access token
- [ ] Implementar função `createPixPayment(orderId, amount, description, buyerEmail)`
- [ ] Implementar função `createCardPayment(orderId, amount, token, installments, buyerEmail)`
- [ ] Implementar função `getPaymentStatus(paymentId)`
- [ ] Retornar: `{ paymentId, status, qrCode, qrCodeBase64, expirationDate }`

---

#### Tarefa 2.2: Endpoint de Criação de Pagamento
**Arquivo:** `server/routes/payments.ts`

**Endpoint:** `POST /api/payments/create`

**Request Body:**
```json
{
  "orderId": "uuid",
  "paymentMethod": "pix" | "credit_card",
  "cardToken": "string (apenas para cartão)",
  "installments": 1
}
```

**Lógica:**
```typescript
1. Validar orderId existe e status = 'pendente'
2. Verificar se dataExpiracao ainda não passou
3. Se expirou:
   - Retornar erro "Tempo de pagamento expirado"
4. Criar pagamento no Mercado Pago
5. Atualizar order com:
   - idPagamentoGateway = paymentId do MP
   - metodoPagamento = 'pix' ou 'credit_card'
6. Retornar dados do pagamento (QR Code para PIX)
```

**Checklist:**
- [ ] Criar rota POST `/api/payments/create`
- [ ] Validar pedido existe e está pendente
- [ ] Verificar expiração antes de criar pagamento
- [ ] Chamar mercadopagoService.createPixPayment ou createCardPayment
- [ ] Salvar idPagamentoGateway no pedido
- [ ] Retornar QR Code (PIX) ou status (cartão)

---

#### Tarefa 2.3: Webhook do Mercado Pago
**Arquivo:** `server/routes/webhooks.ts`

**Endpoint:** `POST /api/webhooks/mercadopago`

**Lógica:**
```typescript
1. Validar assinatura do webhook (header x-signature)
2. Extrair tipo de notificação e data.id
3. Se tipo = 'payment':
   a. Buscar pagamento no MP: getPaymentStatus(paymentId)
   b. Buscar pedido pelo idPagamentoGateway
   c. Se pagamento aprovado E pedido ainda pendente:
      - Atualizar order.status = 'pago'
      - Atualizar order.dataPagamento = NOW()
      - Atualizar todas registrations do pedido para status = 'confirmada'
      - Log: "Pagamento confirmado para pedido {id}"
   d. Se pagamento rejeitado:
      - Manter pedido pendente (usuário pode tentar novamente)
      - Log: "Pagamento rejeitado para pedido {id}"
4. Retornar 200 OK (sempre, mesmo em erro interno)
```

**Checklist:**
- [ ] Criar rota POST `/api/webhooks/mercadopago`
- [ ] Validar assinatura do webhook
- [ ] Buscar status do pagamento no MP
- [ ] Confirmar pedido e inscrições se aprovado
- [ ] Logar todas as operações
- [ ] Sempre retornar 200 para MP não reenviar

---

#### Tarefa 2.4: Job de Polling de Pagamentos (Backup)
**Arquivo:** `server/jobs/payment-polling-job.ts`

**Objetivo:** Verificar pagamentos a cada 2 minutos como backup do webhook.

**Lógica:**
```typescript
1. Buscar pedidos com:
   - status = 'pendente'
   - idPagamentoGateway IS NOT NULL (já foi criado pagamento)
   - dataExpiracao > NOW() (ainda não expirou)

2. Para cada pedido:
   a. Consultar status no MP: getPaymentStatus(idPagamentoGateway)
   b. Se status = 'approved':
      - Confirmar pedido (mesma lógica do webhook)
   c. Se status = 'rejected' ou 'cancelled':
      - Apenas logar (não cancelar, usuário pode tentar novamente)
```

**Checklist:**
- [ ] Criar arquivo `server/jobs/payment-polling-job.ts`
- [ ] Implementar função `pollPayments()`
- [ ] Consultar MP para cada pedido pendente com pagamento criado
- [ ] Confirmar pedidos aprovados
- [ ] Registrar job no `server/index.ts` com `setInterval(120000)` (2 min)

---

### FASE 3: Backend - Atualizar Endpoint de Inscrição

#### Tarefa 3.1: Modificar criação de pedido para definir expiração
**Arquivo:** `server/routes/registrations.ts`

**Modificação na rota `POST /api/registrations`:**

```typescript
// Ao criar o pedido, definir dataExpiracao:
const dataExpiracao = new Date(Date.now() + 30 * 60 * 1000); // 30 minutos

const orderData = {
  ...
  dataExpiracao: dataExpiracao.toISOString(),
  status: 'pendente'
};
```

**Checklist:**
- [ ] Adicionar cálculo de dataExpiracao (30 min)
- [ ] Passar dataExpiracao para registerForEventAtomic
- [ ] Atualizar função registerForEventAtomic para aceitar dataExpiracao
- [ ] Retornar dataExpiracao na resposta para o frontend

---

### FASE 4: Frontend - Tela de Pagamento

#### Tarefa 4.1: Atualizar tela de pagamento com contador
**Arquivo:** `client/src/pages/payment.tsx`

**Funcionalidades:**
1. Exibir contador regressivo baseado em `dataExpiracao`
2. Quando contador zerar:
   - Mostrar mensagem "Tempo esgotado"
   - Desabilitar botões de pagamento
   - Oferecer botão "Refazer inscrição"
3. Para PIX:
   - Exibir QR Code
   - Botão "Copiar código PIX"
   - Polling local a cada 5 segundos para verificar se pagou
4. Para Cartão:
   - Formulário de cartão
   - Integração com MP.js para tokenização

**Checklist:**
- [ ] Implementar contador regressivo com `useEffect` e `setInterval`
- [ ] Exibir tempo restante formatado (MM:SS)
- [ ] Chamar API para criar pagamento PIX
- [ ] Exibir QR Code do PIX
- [ ] Implementar polling para verificar pagamento
- [ ] Redirecionar para tela de sucesso quando confirmado
- [ ] Tratar expiração mostrando mensagem e botão de refazer

---

#### Tarefa 4.2: Tela de confirmação de inscrição
**Arquivo:** `client/src/pages/registration-success.tsx`

**Exibir:**
- Número do pedido
- Número da inscrição
- Detalhes do evento e modalidade
- Data/hora do pagamento
- Botão para baixar comprovante

**Checklist:**
- [ ] Criar página de sucesso
- [ ] Buscar dados do pedido/inscrição
- [ ] Exibir informações formatadas
- [ ] Botão de download/print

---

### FASE 5: Segurança e Robustez

#### Tarefa 5.1: Validações extras

**Checklist:**
- [ ] Impedir múltiplos pedidos pendentes do mesmo atleta para mesmo evento
- [ ] Validar que webhook veio realmente do MP (signature)
- [ ] Rate limiting no endpoint de criação de pagamento
- [ ] Logs estruturados para auditoria

---

## Ordem de Execução Recomendada

```
1. [FASE 1] Job de Expiração de Pedidos
   └─> Testar com pedidos mock
   
2. [FASE 3] Atualizar Endpoint de Inscrição
   └─> Adicionar dataExpiracao
   └─> Testar criação de pedido com expiração
   
3. [FASE 2.1] Configurar SDK Mercado Pago
   └─> Testar conexão com sandbox
   
4. [FASE 2.2] Endpoint de Criação de Pagamento
   └─> Testar criação de PIX no sandbox
   
5. [FASE 4.1] Tela de Pagamento com Contador
   └─> Testar exibição de QR Code e contador
   
6. [FASE 2.3] Webhook do Mercado Pago
   └─> Testar com ngrok ou similar
   
7. [FASE 2.4] Job de Polling
   └─> Testar backup do webhook
   
8. [FASE 4.2] Tela de Sucesso
   └─> Testar fluxo completo
   
9. [FASE 5] Segurança e Robustez
   └─> Validações finais
```

---

## Testes Importantes

### Teste 1: Expiração de Pedido
```
1. Criar pedido pendente
2. Aguardar 30 minutos (ou ajustar para 1 min em dev)
3. Verificar que:
   - Pedido mudou para 'expirado'
   - Vagas do evento foram liberadas
   - Vagas da modalidade foram liberadas
   - Vagas do lote foram liberadas
   - Camisa foi devolvida ao estoque
```

### Teste 2: Concorrência de Vagas
```
1. Evento com 5 vagas
2. 10 usuários tentam inscrever simultaneamente
3. Verificar que:
   - Apenas 5 conseguem criar pedido
   - Outros 5 recebem erro "Vagas esgotadas"
   - Nenhuma vaga negativa
```

### Teste 3: Pagamento Confirmado
```
1. Criar pedido pendente
2. Simular pagamento aprovado no MP
3. Verificar que:
   - Pedido mudou para 'pago'
   - Inscrição mudou para 'confirmada'
   - Vagas continuam ocupadas
```

### Teste 4: Pagamento Após Expiração
```
1. Criar pedido pendente
2. Aguardar expirar
3. Simular pagamento aprovado no MP
4. Verificar que:
   - Webhook detecta pedido expirado
   - Cria nova inscrição OU notifica admin
```

---

## Variáveis de Ambiente Necessárias

```bash
# Mercado Pago
MERCADOPAGO_ACCESS_TOKEN=APP_USR-xxxx
MERCADOPAGO_PUBLIC_KEY=APP_USR-xxxx (para frontend)
MERCADOPAGO_WEBHOOK_SECRET=xxxx

# Configuração
ORDER_EXPIRATION_MINUTES=30
PAYMENT_POLLING_INTERVAL_MS=120000
ORDER_EXPIRATION_CHECK_INTERVAL_MS=60000
```

---

## Arquivos a Criar/Modificar

### Novos Arquivos:
- `server/jobs/order-expiration-job.ts`
- `server/jobs/payment-polling-job.ts`
- `server/services/mercadopago-service.ts`
- `server/routes/payments.ts`
- `server/routes/webhooks.ts`
- `client/src/pages/registration-success.tsx`

### Arquivos a Modificar:
- `server/index.ts` (registrar jobs)
- `server/routes/registrations.ts` (adicionar dataExpiracao)
- `server/services/registration-service.ts` (aceitar dataExpiracao)
- `client/src/pages/payment.tsx` (contador e integração MP)
- `shared/schema.ts` (se precisar de novos campos)

---

## Notas Técnicas

### Sobre o Sistema Atômico Existente

O código atual em `registerForEventAtomic()` já é **robusto** e usa:
- `FOR UPDATE` locks para evitar race conditions
- Transações com rollback automático
- Verificação de capacidade antes de incrementar

**NÃO MODIFICAR** a lógica core de bloqueio de vagas. Apenas adicionar o campo `dataExpiracao`.

### Sobre Concorrência

Em eventos com alta concorrência (ex: 1000 pessoas tentando 100 vagas):
- O `FOR UPDATE` serializa as transações
- Cada transação verifica a capacidade APÓS adquirir o lock
- Isso garante que NUNCA teremos mais inscrições que vagas

### Sobre o Mercado Pago

- Webhooks podem atrasar até 30 segundos em picos
- Sempre ter polling como backup
- Validar assinatura para segurança
- Sandbox: usar cartões de teste do MP

---

## Histórico de Implementação

### 12/12/2024 - Fase 1 Concluída

**Arquivos criados:**
- `server/jobs/order-expiration-job.ts` - Job de expiração de pedidos

**Arquivos modificados:**
- `server/index.ts` - Registro do job de expiração

**Funcionalidades implementadas:**
- Job executa a cada 1 minuto (configurável)
- Busca pedidos com status='pendente' e dataExpiracao < NOW()
- Para cada pedido expirado:
  - Libera vagas do evento, modalidade e lote
  - Devolve camisa ao estoque (se aplicável)
  - Atualiza status do pedido para 'expirado'
  - Atualiza status das inscrições para 'cancelada'
- Logs detalhados para monitoramento
- Usa `FOR UPDATE SKIP LOCKED` para evitar deadlocks

---

## Próximos Passos (Resumo)

### Próxima implementação: FASE 3 - Atualizar Endpoint de Inscrição
1. Modificar `POST /api/registrations` para definir `dataExpiracao = NOW() + 30 min`
2. Retornar `dataExpiracao` na resposta para o frontend exibir contador

### Depois: FASE 2 - Integração Mercado Pago
1. Instalar SDK do Mercado Pago
2. Criar serviço de pagamento (PIX e cartão)
3. Criar endpoint de criação de pagamento
4. Criar endpoint de webhook
5. Criar job de polling (backup)

### Por último: FASE 4 e 5 - Frontend e Segurança
1. Implementar contador regressivo na tela de pagamento
2. Exibir QR Code do PIX
3. Tela de sucesso
4. Validações de segurança
