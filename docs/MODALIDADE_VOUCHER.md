# Modalidade Voucher - Documentacao Completa

## Resumo da Funcionalidade

A modalidade **voucher** e uma nova forma de acesso a inscricao em eventos. Nesta modalidade, o participante so consegue realizar a inscricao se informar um codigo de voucher valido. O voucher pode estar vinculado a uma inscricao gratuita ou paga, dependendo da configuracao do lote.

### Principais Caracteristicas

- Inscricao condicionada a apresentacao de voucher valido
- Suporte a vouchers gratuitos e pagos
- Modulo completo de gestao de vouchers e cupons
- Geracao em massa de codigos unicos (ate 50.000)
- Sistema de auditoria completo
- Cupons de desconto independentes (opcionais)

---

## Regras de Negocio

### 1. Modalidade Voucher

| Regra | Descricao |
|-------|-----------|
| Tipo de Acesso | `access_type = 'voucher'` |
| Obrigatoriedade | Voucher e obrigatorio antes de criar pedido |
| Valor | Pode ter valor normal do lote OU valor zero |
| Gratuidade | Mesmo gratuito, voucher continua obrigatorio |

### 2. Validacao do Voucher

O voucher deve atender a **todos** os criterios abaixo:

1. **Unicidade**: Codigo deve ser unico no sistema
2. **Pertencer ao Evento**: Vinculado ao evento atual da inscricao
3. **Validade Temporal**: `valid_from <= now <= valid_until`
4. **Nao Utilizado**: Status diferente de "utilizado"
5. **Limite de Uso**: Maximo 1 uso por participante
6. **Validade do Lote**: Se criado em lote, respeitar validade do lote

### 3. Registro de Uso

Ao utilizar um voucher, registrar:
- Usuario que utilizou (user_id)
- Data/hora do uso
- Inscricao vinculada (registration_id)
- IP do usuario (seguranca)

### 4. Vouchers vs Cupons

| Aspecto | Voucher | Cupom |
|---------|---------|-------|
| Objetivo | Habilitar inscricao | Dar desconto |
| Momento de Uso | Antes do pedido | Na tela de pagamento |
| Obrigatoriedade | Sim (modalidade voucher) | Nao |
| Desconto | Nao concede | Sim (parcial, total ou fixo) |

---

## Fluxos Completos

### Fluxo de Inscricao com Voucher

```
[Usuario acessa evento]
         |
         v
[Seleciona modalidade com access_type = 'voucher']
         |
         v
[Sistema exibe input "Codigo do Voucher"]
         |
         v
[Usuario informa codigo]
         |
         v
[POST /api/vouchers/validate]
         |
    +----+----+
    |         |
 INVALIDO   VALIDO
    |         |
    v         v
[Erro]    [Seguir fluxo]
[Bloqueio]     |
              v
      [Criar inscricao + pedido]
              |
         +----+----+
         |         |
    valor > 0   valor = 0
         |         |
         v         v
   [Pagamento]  [Inscricao Confirmada]
         |
         v
   [Input cupom (opcional)]
         |
         v
   [Aplicar desconto se houver]
         |
         v
   [Processar pagamento]
         |
         v
   [Inscricao Confirmada]
```

### Fluxo de Pagamento com Cupom

```
[Tela de Pagamento]
         |
         v
[Exibir campo "Codigo do Cupom" (opcional)]
         |
         v
[Usuario informa cupom]
         |
         v
[POST /api/coupons/validate]
         |
    +----+----+
    |         |
 INVALIDO   VALIDO
    |         |
    v         v
[Mensagem]  [Aplicar desconto]
[Erro]           |
                 v
         [Recalcular valor]
                 |
                 v
         [Processar pagamento]
```

---

## Estrutura das Tabelas

### 1. event_voucher_batches (Lotes de Vouchers)

```sql
CREATE TABLE event_voucher_batches (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id),
  name VARCHAR(255) NOT NULL,
  quantity INTEGER NOT NULL,
  valid_from TIMESTAMP NOT NULL,
  valid_until TIMESTAMP NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER REFERENCES users(id)
);
```

### 2. event_vouchers (Vouchers)

```sql
CREATE TABLE event_vouchers (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id),
  batch_id INTEGER REFERENCES event_voucher_batches(id),
  code VARCHAR(20) NOT NULL UNIQUE,
  status VARCHAR(20) DEFAULT 'available', -- 'available', 'used', 'expired'
  valid_from TIMESTAMP NOT NULL,
  valid_until TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT unique_code_per_event UNIQUE (event_id, code)
);

CREATE INDEX idx_vouchers_code ON event_vouchers(code);
CREATE INDEX idx_vouchers_event ON event_vouchers(event_id);
CREATE INDEX idx_vouchers_status ON event_vouchers(status);
```

### 3. voucher_usages (Auditoria de Vouchers)

```sql
CREATE TABLE voucher_usages (
  id SERIAL PRIMARY KEY,
  voucher_id INTEGER NOT NULL REFERENCES event_vouchers(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  registration_id INTEGER REFERENCES registrations(id),
  used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(45),
  user_agent TEXT
);

CREATE INDEX idx_voucher_usages_voucher ON voucher_usages(voucher_id);
CREATE INDEX idx_voucher_usages_user ON voucher_usages(user_id);
```

### 4. event_coupons (Cupons de Desconto)

```sql
CREATE TABLE event_coupons (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id),
  code VARCHAR(50) NOT NULL,
  discount_type VARCHAR(20) NOT NULL, -- 'percentage', 'fixed', 'full'
  discount_value DECIMAL(10, 2), -- valor ou porcentagem
  max_uses INTEGER, -- limite total de usos
  max_uses_per_user INTEGER DEFAULT 1,
  current_uses INTEGER DEFAULT 0,
  valid_from TIMESTAMP NOT NULL,
  valid_until TIMESTAMP NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT unique_coupon_per_event UNIQUE (event_id, code)
);

CREATE INDEX idx_coupons_code ON event_coupons(code);
CREATE INDEX idx_coupons_event ON event_coupons(event_id);
```

### 5. coupon_usages (Auditoria de Cupons)

```sql
CREATE TABLE coupon_usages (
  id SERIAL PRIMARY KEY,
  coupon_id INTEGER NOT NULL REFERENCES event_coupons(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  order_id INTEGER REFERENCES orders(id),
  discount_applied DECIMAL(10, 2),
  used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_coupon_usages_coupon ON coupon_usages(coupon_id);
CREATE INDEX idx_coupon_usages_user ON coupon_usages(user_id);
```

### 6. Alteracao na tabela modalities

```sql
ALTER TABLE modalities 
ADD COLUMN access_type VARCHAR(20) DEFAULT 'open'; 
-- Valores: 'open', 'voucher', 'invite'
```

---

## Endpoints Necessarios

### Vouchers

| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| GET | `/api/events/:eventId/vouchers` | Listar vouchers do evento |
| POST | `/api/events/:eventId/vouchers` | Criar voucher avulso |
| POST | `/api/events/:eventId/vouchers/batch` | Criar lote de vouchers |
| POST | `/api/vouchers/validate` | Validar voucher |
| GET | `/api/events/:eventId/vouchers/batches` | Listar lotes |
| GET | `/api/events/:eventId/vouchers/report` | Relatorio de vouchers |
| DELETE | `/api/vouchers/:id` | Remover voucher (se nao usado) |

### Cupons

| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| GET | `/api/events/:eventId/coupons` | Listar cupons do evento |
| POST | `/api/events/:eventId/coupons` | Criar cupom |
| POST | `/api/coupons/validate` | Validar e aplicar cupom |
| PATCH | `/api/coupons/:id` | Atualizar cupom |
| DELETE | `/api/coupons/:id` | Desativar cupom |

### Exemplos de Request/Response

#### POST /api/events/:eventId/vouchers/batch

**Request:**
```json
{
  "name": "Lote Patrocinadores 2024",
  "quantity": 100,
  "valid_from": "2024-01-01T00:00:00Z",
  "valid_until": "2024-12-31T23:59:59Z",
  "description": "Vouchers para patrocinadores do evento"
}
```

**Response:**
```json
{
  "success": true,
  "batch": {
    "id": 1,
    "name": "Lote Patrocinadores 2024",
    "quantity": 100,
    "vouchers_created": 100,
    "valid_from": "2024-01-01T00:00:00Z",
    "valid_until": "2024-12-31T23:59:59Z"
  }
}
```

#### POST /api/vouchers/validate

**Request:**
```json
{
  "code": "A7F3B2",
  "event_id": 123,
  "modality_id": 456
}
```

**Response (sucesso):**
```json
{
  "valid": true,
  "voucher": {
    "id": 789,
    "code": "A7F3B2",
    "batch_name": "Lote Patrocinadores 2024",
    "valid_until": "2024-12-31T23:59:59Z"
  }
}
```

**Response (erro):**
```json
{
  "valid": false,
  "error": "voucher_expired",
  "message": "Este voucher expirou em 01/12/2024"
}
```

---

## Regras de Seguranca

### 1. Geracao de Codigos

- Codigos hexadecimais de 6-10 caracteres
- Geracao aleatoria (crypto.randomBytes)
- Sem padroes previsiveis ou sequenciais
- Verificacao de colisao antes de salvar

**Exemplo de geracao:**
```typescript
import crypto from 'crypto';

function generateVoucherCode(length: number = 8): string {
  return crypto.randomBytes(length / 2).toString('hex').toUpperCase();
}
```

### 2. Rate Limiting

| Acao | Limite |
|------|--------|
| Tentativas de validacao | 10 por minuto por IP |
| Tentativas por usuario | 5 por minuto |
| Criacao de vouchers | 1 lote por minuto |

### 3. Registro de Auditoria

Toda tentativa de uso (valida ou invalida) deve registrar:
- Codigo tentado
- IP do usuario
- User Agent
- Timestamp
- Resultado (sucesso/falha)
- Motivo da falha (se aplicavel)

### 4. Validacao de Uso

O voucher so e marcado como **usado** apos:
1. Inscricao ser criada com sucesso
2. Pagamento confirmado (se aplicavel)

Em caso de falha no pagamento, o voucher deve permanecer disponivel.

---

## Exemplos de Uso

### Cenario 1: Evento Corporativo com Vouchers Gratuitos

1. Organizador cria lote de 500 vouchers
2. Distribui codigos para funcionarios via email
3. Funcionarios acessam evento e informam voucher
4. Sistema valida e cria inscricao gratuita

### Cenario 2: Evento Pago com Acesso Restrito

1. Organizador cria lote de 100 vouchers
2. Envia para convidados especiais
3. Convidados informam voucher
4. Sistema valida e exibe tela de pagamento
5. Convidado pode usar cupom de desconto adicional

### Cenario 3: Cupom de Desconto em Evento Aberto

1. Evento com modalidade normal (sem voucher)
2. Usuario faz inscricao normalmente
3. Na tela de pagamento, informa cupom "DESCONTO50"
4. Sistema aplica 50% de desconto
5. Usuario paga valor reduzido

---

## Correcoes e Melhorias (Dezembro 2024)

### 1. Modalidade Voucher com Valor Zero

**Problema:** Modalidades do tipo 'voucher' com valor 0 ou nulo apareciam como INDISPONIVEL.

**Solucao:** Atualizado a logica de `isPaidModality` para considerar tanto 'gratuita' quanto 'voucher' como tipos que podem ter valor zero.

```typescript
// Antes
const isPaidModality = modality.tipo_acesso !== 'gratuita';

// Depois
const isPaidModality = !['gratuita', 'voucher'].includes(modality.tipo_acesso);
```

**Arquivos alterados:**
- `server/services/registration-service.ts`
- `server/routes/registrations.ts`

### 2. Exportacao de Vouchers por Lote

**Melhorias implementadas:**
- Adicionado parametro `?batchId=` para filtrar por lote especifico
- Formato CSV com separador ponto-e-virgula (compativel com Excel)
- Colunas adicionais: Nome do Atleta, Email do Atleta
- Nome do arquivo inclui nome do lote quando filtrado

**Endpoint:** `GET /api/admin/events/:eventId/vouchers/export?batchId=XXX`

**Colunas exportadas:**
| Coluna | Descricao |
|--------|-----------|
| Codigo | Codigo do voucher |
| Lote | Nome do lote |
| Status | Disponivel / Usado / Expirado |
| Valido De | Data de inicio |
| Valido Ate | Data de expiracao |
| Usado | Sim / Nao |
| Data de Uso | Data em que foi usado |
| Atleta | Nome do atleta que usou |
| Email Atleta | Email do atleta |
| Criado Em | Data de criacao |

### 3. Criacao de Cupons em Massa com Codigos Automaticos

**Novos campos no endpoint bulk:**
- `quantity` (opcional): Numero de cupons a gerar automaticamente
- `codes` (opcional): Lista de codigos manuais

**Regra:** Deve informar `codes` OU `quantity`, nao ambos.

**Exemplo - Gerar 10 cupons automaticos:**
```json
{
  "quantity": 10,
  "discountType": "percentage",
  "discountValue": 20,
  "maxUses": 50,
  "maxUsesPerUser": 1,
  "validFrom": "2024-01-01T00:00:00Z",
  "validUntil": "2024-12-31T23:59:59Z",
  "isActive": true
}
```

### 4. Mensagens de Erro de Validacao de Voucher

**Mensagens melhoradas:**
| Erro | Mensagem |
|------|----------|
| VOUCHER_NOT_FOUND | Voucher nao encontrado. Verifique se o codigo esta correto e pertence a este evento. |
| VOUCHER_EXPIRED | Este voucher expirou em {data}. |
| VOUCHER_NOT_VALID_YET | Este voucher ainda nao esta valido. Valido a partir de {data}. |
| VOUCHER_ALREADY_USED | Este voucher ja foi utilizado em outra inscricao. |
| INTERNAL_ERROR | Erro ao validar voucher. Por favor, tente novamente. |

---

## Auditoria Tecnica - Estado Real do Sistema (Dezembro 2024)

### Resumo da Auditoria

Esta secao documenta o estado real das funcionalidades implementadas, apos auditoria tecnica realizada em dezembro de 2024.

### 1. Validacao de Voucher (POST /api/vouchers/validate)

**Status: IMPLEMENTADO COM CORRECOES**

- **Arquivo:** `server/routes/vouchers.ts`
- **Funcao:** `router.post("/validate", ...)`
- **Rota:** `POST /api/vouchers/validate`

**Codigos HTTP utilizados:**
| Cenario | Codigo HTTP | Codigo de Erro |
|---------|-------------|----------------|
| Dados invalidos | 400 | VALIDATION_ERROR |
| Voucher nao encontrado | 404 | VOUCHER_NOT_FOUND |
| Voucher ainda nao valido | 422 | VOUCHER_NOT_VALID_YET |
| Voucher expirado | 422 | VOUCHER_EXPIRED |
| Voucher ja utilizado | 409 | VOUCHER_ALREADY_USED |
| Erro interno | 500 | INTERNAL_ERROR |
| Voucher valido | 200 | - (success: true) |

**Frontend:** `client/src/pages/InscricaoModalidadePage.tsx` trata corretamente os codigos de erro e exibe mensagens especificas.

### 2. Exportacao de Vouchers

**Status: IMPLEMENTADO**

- **Arquivo:** `server/routes/admin/vouchers.ts`
- **Funcao:** `router.get("/export", ...)`
- **Rota:** `GET /api/admin/events/:eventId/vouchers/export`

**Parametros suportados:**
- `batchId` (opcional): Filtra vouchers por lote especifico
- `format` (opcional): "xlsx" (padrao) ou "csv"

**Colunas exportadas:**
- Codigo, Lote, Status, Valido De, Valido Ate, Usado, Data de Uso, Atleta, Email Atleta, Criado Em

**Frontend:** `client/src/pages/admin/AdminEventVouchersPage.tsx`
- Botao "Exportar Excel" (todos os vouchers)
- Botao "CSV" (todos os vouchers)
- Botao de download por lote na tabela de lotes

### 3. Criacao de Cupons em Massa

**Status: IMPLEMENTADO**

- **Arquivo:** `server/routes/admin/coupons.ts`
- **Funcao:** `router.post("/bulk", ...)`
- **Rota:** `POST /api/admin/events/:eventId/coupons/bulk`

**Campos suportados:**
- `quantity`: Quantidade de cupons a gerar automaticamente (1-1000)
- `codes`: Lista de codigos manuais (alternativa a quantity)
- `discountType`: percentage | fixed | full
- `discountValue`: Valor do desconto
- `maxUses`: Limite total de usos
- `maxUsesPerUser`: Limite por usuario
- `validFrom`, `validUntil`: Datas de validade
- `isActive`: Status do cupom

**Validacoes implementadas:**
- Unicidade global de codigos (voucher + cupom)
- Validacao de porcentagem <= 100%
- Impedimento de criar codes E quantity simultaneamente

### Divergencias Corrigidas

| Item | Estado Anterior | Estado Atual |
|------|-----------------|--------------|
| HTTP codes validacao voucher | Todos HTTP 400 | 404/409/422 conforme tipo de erro |
| Formato exportacao | Apenas CSV | CSV + Excel (.xlsx) |
| Exportacao por lote | Apenas backend | Backend + frontend com botao por lote |

### 4. Correcoes de Frontend (Dezembro 2024)

#### 4.1 Tratamento de Erros de Validacao de Voucher

**Problema:** O frontend tratava erros HTTP 404/409/422 como "erro de conexao" ao inves de exibir a mensagem de erro retornada pelo backend.

**Solucao:** A validacao de voucher agora utiliza `fetch` diretamente (ao inves de `apiRequest`) para poder tratar respostas HTTP nao-200 como erros de regra de negocio:

```typescript
// Tratamento correto de erros de negocio
if (!response.ok) {
  if (response.status === 404 || response.status === 409 || response.status === 422 || response.status === 400) {
    return { 
      valid: false, 
      error: result.error?.code || "invalid",
      message: result.error?.message || "Voucher invalido"
    };
  }
}
```

**Comportamento atual:**
- 404: Voucher nao encontrado - exibe mensagem do backend
- 409: Voucher ja utilizado - exibe mensagem do backend
- 422: Voucher expirado ou ainda nao valido - exibe mensagem do backend
- 5xx: Erro de servidor - exibe mensagem generica
- Erro de rede real: Exibe "Erro de conexao"

#### 4.2 UI de Criacao de Cupons em Massa

**Problema:** A UI de criacao de cupons em massa so permitia codigos manuais, sem opcao de geracao automatica.

**Solucao:** Adicionado modo de alternancia entre:
- **Geracao Automatica:** Informar quantidade (1-1000) para gerar codigos aleatorios
- **Codigos Manuais:** Inserir codigos um por linha ou separados por virgula

**Campos disponiveis na UI:**
| Campo | Descricao |
|-------|-----------|
| Modo | Automatico ou Manual |
| Quantidade | Numero de cupons (modo automatico) |
| Codigos | Lista de codigos (modo manual) |
| Tipo de Desconto | Porcentagem, Valor Fixo, 100% Gratuito |
| Valor do Desconto | Valor ou percentual |
| Limite Total de Usos | Maximo de usos por cupom |
| Limite por Usuario | Maximo de usos por usuario |
| Valido De/Ate | Periodo de validade |
| Cupom Ativo | Se pode ser usado imediatamente |

#### 4.3 Modalidade Voucher com Valor Zero

**Status:** Funcionando corretamente.

A regra de `isPaidModality` no backend ja exclui modalidades do tipo 'voucher':
```typescript
const isPaidModality = !['gratuita', 'voucher'].includes(mod.tipoAcesso);
```

Isso garante que:
- Modalidades voucher com valor 0 NAO aparecem como "indisponivel"
- Modalidades voucher sao sempre selecionaveis (desde que nao esgotadas)
- O preco exibido sera "Gratuito" quando valor = 0

---

## Checklist de Implementacao

### Backend

- [x] Criar tabela `event_voucher_batches` (schema Drizzle)
- [x] Criar tabela `event_vouchers` (schema Drizzle)
- [x] Criar tabela `voucher_usages` (schema Drizzle)
- [x] Criar tabela `event_coupons` (schema Drizzle)
- [x] Criar tabela `coupon_usages` (schema Drizzle)
- [x] Adicionar campo `access_type` na tabela `modalities`
- [x] Implementar endpoint POST `/api/events/:eventId/vouchers/batch`
- [x] Implementar endpoint POST `/api/events/:eventId/vouchers`
- [x] Implementar endpoint GET `/api/events/:eventId/vouchers`
- [x] Implementar endpoint POST `/api/vouchers/validate`
- [x] Implementar endpoint DELETE `/api/vouchers/:id`
- [x] Implementar endpoint GET `/api/events/:eventId/vouchers/batches`
- [x] Implementar endpoint GET `/api/events/:eventId/vouchers/report`
- [x] Implementar endpoint POST `/api/events/:eventId/coupons`
- [x] Implementar endpoint GET `/api/events/:eventId/coupons`
- [x] Implementar endpoint POST `/api/coupons/validate`
- [x] Implementar endpoint PATCH `/api/coupons/:id`
- [x] Implementar endpoint DELETE `/api/coupons/:id`
- [x] Implementar funcao de geracao de codigo seguro
- [ ] Implementar rate limiting nos endpoints de validacao
- [x] Implementar registro de auditoria
- [x] Adicionar logica de voucher no fluxo de inscricao
- [x] Adicionar logica de cupom no fluxo de pagamento
- [x] Exportacao de vouchers por lote
- [x] Geracao automatica de codigos de cupons em massa

### Frontend

- [x] Criar componente de input de voucher
- [x] Integrar validacao de voucher no fluxo de inscricao
- [x] Criar pagina de gerenciamento de vouchers (admin)
- [x] Criar formulario de criacao de lote
- [x] Criar formulario de criacao de voucher avulso
- [x] Criar listagem de vouchers com filtros
- [ ] Criar visualizacao de auditoria
- [x] Criar pagina de gerenciamento de cupons (admin)
- [x] Criar formulario de criacao de cupom
- [x] Criar formulario de criacao de cupom em massa (com geracao automatica)
- [x] Criar listagem de cupons
- [x] Integrar cupom na tela de pagamento
- [ ] Adicionar relatorios de uso
- [x] Mensagens de erro de voucher detalhadas
- [x] Tratamento correto de erros HTTP 404/409/422 na validacao
- [x] UI de criacao em massa com modo automatico e manual

### Testes

- [ ] Testes unitarios para geracao de codigo
- [ ] Testes unitarios para validacao de voucher
- [ ] Testes unitarios para validacao de cupom
- [ ] Testes de integracao para fluxo completo de inscricao
- [ ] Testes de integracao para fluxo completo de pagamento
- [ ] Testes de seguranca (rate limiting, colisao de codigos)

### Documentacao

- [x] Documentacao de regras de negocio
- [x] Documentacao de estrutura de tabelas
- [x] Documentacao de endpoints
- [x] Documentacao de seguranca
- [ ] Documentacao de uso para organizadores (manual)

---

## Consideracoes Finais

### Performance

- Indexar campos de busca frequente (code, event_id, status)
- Considerar cache para validacao de vouchers em eventos grandes
- Limitar tamanho de lotes para evitar timeout (max 50.000)

### Escalabilidade

- Geracao de lotes grandes pode ser assincrona (job/queue)
- Relatorios podem usar agregacao pre-calculada

### Manutencao

- Criar job para atualizar status de vouchers expirados
- Criar job para limpeza de logs de auditoria antigos (> 1 ano)
