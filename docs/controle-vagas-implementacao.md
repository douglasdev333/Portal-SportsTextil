# Atualização do Controle de Vagas (Evento, Modalidade e Lote)

## Contexto Geral

O portal de inscrição possui eventos com limite de vagas. Inicialmente, o controle era baseado apenas no limite global do evento, impedindo que mais inscrições fossem criadas após atingir o limite.

Agora o sistema deve suportar, dentro do mesmo evento:

1. **Limite global de vagas para o evento**
2. **Limite individual por modalidade** (opcional)
3. **Limite individual por lote**, incluindo:
   - Fechamento automático do lote quando atingir o limite
   - Ativação automática do próximo lote disponível

Tudo preservando **atomicidade** e **alta concorrência**.

---

## Principais Premissas

### 1. Evento é o limite principal (hard cap)

Se `event.capacity` for atingido:
- Nenhuma inscrição adicional é permitida
- Independentemente de modalidade ou lote ainda possuírem vagas

**Regra global:** evento lotou → tudo trava

### 2. Modalidade é um limite local (opcional)

Cada evento pode ter 0 ou mais modalidades.

**Exemplos:**
- Corrida 5K
- Corrida 10K
- Caminhada
- Kids

Podem ter limite individual por modalidade.

| Situação | Resultado |
|----------|-----------|
| Modalidade possui `capacity` e atingiu esse valor | Trava inscrições apenas nessa modalidade |
| Modalidade sem limite definido | Depende apenas do evento e do lote |

### 3. Lote controla preço e vagas dentro da modalidade/evento

Cada modalidade (ou o evento) pode ter 1 ou mais lotes.

**Exemplo de lotes:**

| Nome | Exemplo capacity | Valor |
|------|-----------------|-------|
| 1º lote | 200 vagas | R$ 100 |
| 2º lote | 300 vagas | R$ 130 |
| 3º lote | sem limite | R$ 150 |

**Regras:**
- Somente **um lote ativo** por modalidade/evento
- Quando um lote atingir o limite:
  - Ele é marcado como encerrado
  - O próximo se torna ativo, se existir
- O preço da inscrição é o do lote ativo na hora da confirmação
- **Não se deve garantir valor apenas por visualizar na tela**

---

## Estrutura de Banco Recomendada

### Tabela: `events`
```sql
id (PK)
name
capacity
vagas_ocupadas
...
```

### Tabela: `event_modalities`
```sql
id (PK)
event_id (FK)
name
capacity NULLABLE  -- se NULL, sem limite próprio
vagas_ocupadas INT DEFAULT 0
```

### Tabela: `event_lots`
```sql
id (PK)
event_id (FK)
modality_id (FK optional)
capacity NULLABLE
vagas_ocupadas INT DEFAULT 0
status ENUM('active', 'closed', 'future')
price_cents INT
order_index INT NOT NULL   -- define a ordem natural dos lotes
```

### Tabela: `registrations`
```sql
id (PK)
event_id FK
modality_id FK NULLABLE
lot_id FK NULLABLE
athlete_id
status
...
```

**Regra importante:**
```sql
UNIQUE(event_id, athlete_id)
```

---

## Fluxo Atômico Atualizado na Inscrição

Toda inscrição segue uma única transação contendo 3 travas (quando aplicável):

### Ordem obrigatória de locking com `SELECT FOR UPDATE`

1. Evento
2. Modalidade (se houver)
3. Lote ativo (se houver)

**Esta ordem previne deadlocks entre transações concorrentes.**

---

## Etapas da Transação

```sql
BEGIN;
```

### 1. Travar evento
```sql
SELECT capacity, vagas_ocupadas
FROM events
WHERE id = :event_id
FOR UPDATE;
```

Se evento lotou:
- → rollback
- → return: `EVENT_FULL`

### 2. Travar modalidade (se enviada)
```sql
SELECT capacity, vagas_ocupadas
FROM event_modalities
WHERE id = :modality_id
FOR UPDATE;
```

| Condição | Ação |
|----------|------|
| `capacity != NULL AND vagas_ocupadas >= capacity` | Bloquear apenas essa modalidade |
| Modalidade não encontrada | Erro `MODALITY_NOT_FOUND` |

### 3. Travar lote ativo
```sql
SELECT id, capacity, vagas_ocupadas
FROM event_lots
WHERE event_id = :event_id
  AND (modality_id = :modality_id OR modality_id IS NULL)
  AND status = 'active'
FOR UPDATE;
```

| Condição | Ação |
|----------|------|
| `lot_capacity` atingido | Lote vira `closed` |
| Existe lote `future` com `order_index` maior | Próximo lote vira `active` |
| Se não houver próximo lote | Esgotado nesta modalidade |

**IMPORTANTÍSSIMO:**
> O lote só garante o valor no momento do commit da transação. Isto evita inconsistência de preço.

### 4. Verificar duplicidade

Via UNIQUE constraint:
- Se violar → erro `ALREADY_REGISTERED`

### 5. Criar registro
```sql
INSERT INTO registrations (...)
VALUES (...);
```

### 6. Atualizar contadores

Cada entidade existente no fluxo incrementa 1:

```sql
UPDATE events SET vagas_ocupadas = vagas_ocupadas + 1 WHERE id = :event_id;

UPDATE event_modalities SET vagas_ocupadas = vagas_ocupadas + 1 WHERE id = :modality_id;

UPDATE event_lots SET vagas_ocupadas = vagas_ocupadas + 1 WHERE id = :lot_id;
```

```sql
COMMIT;
```

---

## Códigos de Erro

| Código | Motivo |
|--------|--------|
| `EVENT_FULL` | Limite geral atingido |
| `MODALITY_FULL` | Modalidade atingiu limite |
| `LOT_FULL` | Lote lotou antes dessa inscrição |
| `MODALITY_NOT_FOUND` | Modalidade inválida |
| `LOT_NOT_FOUND` | Lote inválido para modalidade |
| `ALREADY_REGISTERED` | Mesmo atleta tentando inscrição |

---

## Estratégia para Lote Pago

Como **NÃO haverá reserva prévia**, a regra é:

Quando o usuário envia o formulário, o backend:

1. Confirma acesso ao lote ativo via `SELECT FOR UPDATE`
2. Garante que ainda há vaga
3. Gera inscrição com `lot_id` e `price_cents` daquele lote

Se o lote lotar naquele exato instante:
- Retorna erro `LOT_SOLD_OUT_OR_CHANGED`
- Front deve refazer consulta e exibir novo preço/lote

**Nunca migrar automaticamente o usuário de lote sem consentimento.**

---

## Testes Recomendados

### Eventos
- [ ] Bloqueia novas inscrições quando lotado

### Modalidades
- [ ] Modalidade lotou, outras continuam abertas
- [ ] Modalidade sem limite respeita apenas o evento

### Lote
- [ ] Lote ativo vira fechado quando lotado
- [ ] Próximo lote vira ativo
- [ ] Inscrição simultânea respeita lote correto

### Concorrência
- [ ] 100 requisições paralelas
  - Confere que contadores batem
  - Nenhuma ultrapassa limite

---

## Resultado Esperado

Com essas implementações:

- [x] Nenhuma condição de corrida gera overbooking
- [x] Sempre confirma a inscrição com lote e preço corretos
- [x] Modalidades podem esgotar individualmente
- [x] Evento pode encerrar todas as inscrições
- [x] Com alta concorrência o sistema se mantém consistente
- [x] Lote vira de forma segura e previsível dentro da transação

---

## Resumo das Alterações Necessárias

### Schema (Drizzle)
1. Adicionar tabela `event_modalities` com campos: `id`, `event_id`, `name`, `capacity` (nullable), `vagas_ocupadas`
2. Adicionar tabela `event_lots` com campos: `id`, `event_id`, `modality_id` (nullable), `capacity` (nullable), `vagas_ocupadas`, `status`, `price_cents`, `order_index`
3. Adicionar campo `vagas_ocupadas` na tabela `events` (se não existir)
4. Adicionar campos `modality_id` e `lot_id` na tabela `registrations`
5. Adicionar constraint `UNIQUE(event_id, athlete_id)` na tabela `registrations`

### Backend (API Routes)
1. Implementar transação atômica com `SELECT FOR UPDATE` na ordem correta
2. Implementar lógica de fechamento automático de lote
3. Implementar ativação automática do próximo lote
4. Retornar códigos de erro apropriados

### Frontend
1. Exibir modalidades disponíveis com vagas restantes
2. Exibir lote ativo com preço
3. Tratar erro `LOT_SOLD_OUT_OR_CHANGED` recarregando informações
4. Não garantir preço apenas por visualização
