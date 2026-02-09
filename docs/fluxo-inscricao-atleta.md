# Fluxo de Inscricao do Atleta - ST Eventos

## Visao Geral

Este documento descreve o fluxo completo de inscricao do atleta na plataforma ST Eventos, desde o cadastro ate a confirmacao da inscricao.

## Fluxos Suportados

### 1. Inscricao Gratuita
- Modalidades com `tipoAcesso = "gratuita"`
- Nao requer pagamento
- Confirmacao imediata apos submissao

### 2. Inscricao Paga (Fase 2)
- Modalidades com `tipoAcesso = "paga"`
- Requer integracao com gateway de pagamento
- Confirmacao apos pagamento aprovado

### 3. Inscricao com Voucher (Fase 2)
- Modalidades com `tipoAcesso = "voucher"`
- Requer codigo de voucher valido
- Pode ter desconto total ou parcial

### 4. Inscricao PCD (Fase 2)
- Modalidades com `tipoAcesso = "pcd"`
- Requer aprovacao manual do organizador
- Status fica "pendente" ate aprovacao

### 5. Aprovacao Manual (Fase 2)
- Modalidades com `tipoAcesso = "aprovacao_manual"`
- Requer aprovacao do organizador
- Similar ao fluxo PCD

---

## Fluxo Detalhado - Inscricao Gratuita (MVP)

### Etapa 1: Autenticacao do Atleta

**Rota:** `/login` ou `/cadastro`

**Campos para Cadastro:**
| Campo | Tipo | Obrigatorio | Validacao |
|-------|------|-------------|-----------|
| cpf | varchar(14) | Sim | CPF valido, unico |
| nome | text | Sim | Min 3 caracteres |
| dataNascimento | date | Sim | Maior que 10 anos |
| sexo | varchar(20) | Sim | masculino/feminino |
| email | text | Sim | Email valido |
| telefone | varchar(20) | Sim | Telefone valido |
| estado | varchar(2) | Sim | UF valida |
| cidade | text | Sim | Min 2 caracteres |
| escolaridade | text | Nao | - |
| profissao | text | Nao | - |

**Login:**
- CPF + Data de Nascimento
- Sem senha (autenticacao simplificada)
- Retorna token de sessao

### Etapa 2: Selecao do Evento

**Rota:** `/` ou `/eventos`

**Dados exibidos:**
- Lista de eventos publicados (`status = "publicado"`)
- Filtro por cidade/estado
- Busca por nome
- Cards com: nome, data, local, modalidades

### Etapa 3: Detalhes do Evento

**Rota:** `/evento/:slug`

**Dados exibidos:**
- Informacoes gerais do evento
- Lista de modalidades com precos do lote ativo
- Documentos (regulamento, termos)
- Botao "Inscrever-se"

### Etapa 4: Para Quem e a Inscricao

**Rota:** `/evento/:slug/inscricao/participante`

**Opcoes:**
1. **Para mim** - Usa dados do atleta logado
2. **Para outra pessoa** - Permite cadastrar novo atleta (Fase 2)

### Etapa 5: Selecao da Modalidade

**Rota:** `/evento/:slug/inscricao/modalidade`

**Dados exibidos:**
- Lista de modalidades disponiveis
- Preco de cada modalidade (do lote ativo)
- Taxa de comodidade
- Vagas disponiveis
- Indicador de modalidade gratuita/paga

**Validacoes:**
- Verificar vagas disponiveis
- Verificar se lote esta ativo
- Verificar idade minima

### Etapa 6: Selecao do Tamanho da Camisa

**Rota:** `/evento/:slug/inscricao/modalidade` (mesmo passo)

**Dados exibidos:**
- Tamanhos disponiveis (PP, P, M, G, GG, XGG)
- Estoque de cada tamanho

**Validacoes:**
- Verificar disponibilidade do tamanho

### Etapa 7: Resumo da Inscricao

**Rota:** `/evento/:slug/inscricao/resumo`

**Dados exibidos:**
- Dados do evento
- Dados do participante
- Modalidade selecionada
- Tamanho da camisa
- Valor da inscricao + taxa
- Campo equipe (opcional)

**Acoes:**
- Voltar (editar)
- Aceitar termos obrigatorios
- Confirmar inscricao

### Etapa 8: Finalizacao

**Rota:** `/evento/:slug/inscricao/confirmacao`

**Para modalidade GRATUITA:**
1. Criar pedido (order) com `valorTotal = 0` e `status = "pago"`
2. Criar inscricao (registration) com `status = "confirmada"`
3. Decrementar estoque de camisa
4. Incrementar contador do lote
5. Exibir confirmacao com numero da inscricao

**Para modalidade PAGA (Fase 2):**
1. Criar pedido com `status = "pendente"`
2. Criar inscricao com `status = "pendente"`
3. Redirecionar para gateway de pagamento
4. Webhook atualiza status apos pagamento

---

## Estrutura de Dados

### Pedido (Order)
```typescript
{
  numeroPedido: number,       // Auto-incremento por evento
  eventId: string,            // Evento da inscricao
  compradorId: string,        // Atleta que fez a compra
  valorTotal: decimal,        // 0 para gratuitas
  valorDesconto: decimal,     // Desconto aplicado
  codigoVoucher: string?,     // Voucher usado
  status: "pendente" | "pago" | "cancelado" | "reembolsado" | "expirado",
  metodoPagamento: string?,   // null para gratuitas
  dataPedido: timestamp,
  dataPagamento: timestamp?,
  ipComprador: string?
}
```

### Inscricao (Registration)
```typescript
{
  numeroInscricao: number,    // Auto-incremento por evento
  orderId: string,            // Pedido associado
  eventId: string,            // Evento
  modalityId: string,         // Modalidade escolhida
  batchId: string,            // Lote ativo no momento
  athleteId: string,          // Atleta inscrito
  tamanhoCamisa: string?,     // Tamanho escolhido
  valorUnitario: decimal,     // Preco da modalidade
  taxaComodidade: decimal,    // Taxa aplicada
  status: "pendente" | "confirmada" | "cancelada",
  equipe: string?,            // Nome da equipe
  dataInscricao: timestamp
}
```

---

## APIs Necessarias

### Autenticacao do Atleta

#### POST /api/athletes/register
Cadastro de novo atleta

**Request:**
```json
{
  "cpf": "123.456.789-00",
  "nome": "Joao Silva",
  "dataNascimento": "1990-03-15",
  "sexo": "masculino",
  "email": "joao@email.com",
  "telefone": "(11) 99999-9999",
  "estado": "SP",
  "cidade": "Sao Paulo"
}
```

**Response:**
```json
{
  "success": true,
  "data": { "id": "...", "nome": "...", ... },
  "token": "jwt-token"
}
```

#### POST /api/athletes/login
Login do atleta

**Request:**
```json
{
  "cpf": "123.456.789-00",
  "dataNascimento": "1990-03-15"
}
```

**Response:**
```json
{
  "success": true,
  "data": { "id": "...", "nome": "...", ... },
  "token": "jwt-token"
}
```

#### GET /api/athletes/me
Retorna dados do atleta logado

### Inscricao

#### GET /api/events/:slug/registration-info
Retorna informacoes para inscricao

**Response:**
```json
{
  "success": true,
  "data": {
    "event": { ... },
    "modalities": [
      {
        "id": "...",
        "nome": "5km",
        "distancia": "5.00",
        "tipoAcesso": "gratuita",
        "preco": 0,
        "taxaComodidade": 0,
        "vagasDisponiveis": 100
      }
    ],
    "activeBatch": { ... },
    "shirtSizes": [
      { "tamanho": "M", "disponivel": 50 }
    ],
    "attachments": [ ... ]
  }
}
```

#### POST /api/registrations
Criar inscricao

**Request:**
```json
{
  "eventId": "...",
  "modalityId": "...",
  "athleteId": "...",
  "tamanhoCamisa": "M",
  "equipe": "Assessoria XYZ"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "order": { "numeroPedido": 1, ... },
    "registration": { "numeroInscricao": 1, ... }
  }
}
```

---

## Validacoes de Negocio

### Antes de Criar Inscricao

1. **Verificar evento publicado**
   - `event.status === "publicado"`

2. **Verificar periodo de inscricoes**
   - `now >= event.aberturaInscricoes`
   - `now <= event.encerramentoInscricoes`

3. **Verificar vagas do evento**
   - Total de inscricoes confirmadas < `event.limiteVagasTotal`

4. **Verificar vagas da modalidade**
   - Se `modality.limiteVagas` definido
   - Inscricoes na modalidade < limite

5. **Verificar lote ativo**
   - Lote com `ativo = true`
   - `dataInicio <= now <= dataTermino`
   - `quantidadeUtilizada < quantidadeMaxima`

6. **Verificar idade minima**
   - Idade do atleta na data do evento >= idade minima

7. **Verificar tamanho de camisa**
   - Tamanho disponivel (estoque > 0)

8. **Verificar inscricao duplicada**
   - Atleta nao pode ter inscricao confirmada na mesma modalidade

---

## Estados e Transicoes

### Status do Pedido
```
pendente -> pago (apos pagamento)
pendente -> cancelado (timeout ou cancelamento)
pendente -> expirado (apos prazo)
pago -> reembolsado (solicitacao aceita)
```

### Status da Inscricao
```
pendente -> confirmada (apos pagamento ou inscricao gratuita)
pendente -> cancelada (cancelamento do pedido)
confirmada -> cancelada (solicitacao aceita)
```

---

## Checklist de Implementacao

### Fase 1 - Inscricao Gratuita (MVP)
- [x] Schema de dados (athletes, orders, registrations)
- [x] Storage interface
- [x] API de cadastro de atleta
- [x] API de login de atleta
- [x] API de informacoes para inscricao
- [x] API de criar inscricao gratuita
- [x] Tela de login/cadastro do atleta
- [x] Tela de selecao de modalidade (dados reais)
- [x] Tela de resumo (dados reais)
- [x] Tela de confirmacao
- [x] Seed com dados de teste

### Fase 2 - Inscricao Paga
- [ ] Integracao com gateway de pagamento
- [ ] Webhook de confirmacao
- [ ] Fluxo de pagamento PIX
- [ ] Fluxo de pagamento cartao
- [ ] Tela de pagamento
- [ ] Emails de confirmacao

### Fase 3 - Recursos Adicionais
- [ ] Inscricao para outra pessoa
- [ ] Sistema de vouchers
- [ ] Fluxo PCD
- [ ] Aprovacao manual
- [x] Minhas inscricoes
- [ ] Cancelamento de inscricao

---

## Dados de Teste

### Atletas de Teste
| CPF | Nome | Data Nasc | Cidade |
|-----|------|-----------|--------|
| 111.111.111-11 | Joao Silva | 1990-03-15 | Sao Paulo |
| 222.222.222-22 | Maria Santos | 1985-07-22 | Rio de Janeiro |
| 333.333.333-33 | Pedro Oliveira | 1995-12-10 | Belo Horizonte |

### Eventos de Teste
1. **Maratona de Sao Paulo 2025**
   - Modalidades: 5km (gratuita), 10km (paga), 21km (paga), 42km (paga)
   - Lotes: Promocional, 1o Lote, 2o Lote

2. **Corrida Solidaria**
   - Modalidades: 5km (gratuita), Kids (gratuita)
   - Lotes: Unico

---

## Proximos Passos

1. Implementar APIs de autenticacao do atleta
2. Implementar API de inscricao
3. Atualizar telas para usar dados reais
4. Criar seed com dados de teste
5. Testar fluxo completo gratuito
6. Documentar e preparar para fase paga
