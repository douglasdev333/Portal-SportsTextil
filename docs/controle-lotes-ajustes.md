# Ajustes no Controle de Lotes

Data: 09/12/2024

## Resumo das Correcoes Implementadas

### 1. Virada Automatica de Lote na Transacao Atomica

**Problema anterior:** Quando o lote ativo atingia o limite de vagas, o sistema fechava o lote mas nao ativava o proximo automaticamente (a troca era feita seguida de ROLLBACK).

**Correcao:** A funcao `closeBatchAndActivateNext` agora:
- Fecha o lote atual (status = 'closed', ativo = false)
- Busca o proximo lote com `ordem` maior e `status = 'future'`
- Ativa o proximo lote usando `FOR UPDATE` para lock
- Retorna se houve ativacao de proximo lote ou nao
- As mudancas sao commitadas na transacao atomica

### 2. Lotes Globais por Evento (nao por Modalidade)

**Problema anterior:** A logica de busca de lotes incluia filtro por `modality_id`, mas o modelo de negocio utiliza lotes globais por evento.

**Correcao:** 
- Removida a referencia a `modality_id` na busca do lote ativo
- Query simplificada para buscar apenas por `event_id`
- A coluna `modality_id` na tabela `registration_batches` foi mantida por compatibilidade, mas nao e usada no fluxo de inscricao

### 3. Validacao de Lote Unico Ativo

**Problema anterior:** Era possivel ativar multiplos lotes ao mesmo tempo atraves da interface admin.

**Correcao:** Adicionada funcao `validateSingleActiveBatch` que:
- Verifica se ja existe lote ativo para o evento
- Bloqueia criacao/edicao se tentar ativar mais de um lote
- Retorna erro com codigo `MULTIPLE_ACTIVE_BATCHES`
- Mensagem: "Somente um lote pode estar ativo ao mesmo tempo. Desative o lote atual antes de ativar outro."

### 4. Novo Codigo de Erro: LOTE_ESGOTADO_E_SEM_PROXIMO

**Problema anterior:** Quando nao havia proximo lote disponivel, a mensagem nao era clara.

**Correcao:** Adicionado novo codigo de erro `LOTE_ESGOTADO_E_SEM_PROXIMO` com mensagem:
- "Inscricoes encerradas - todos os lotes foram esgotados."

### 5. Campo Status no Schema de Batch

**Correcao:** Adicionado campo `status` no schema de validacao de lotes com valores:
- `active`: Lote ativo (unico por evento)
- `closed`: Lote encerrado
- `future`: Lote futuro (aguardando ativacao)

---

## Fluxo de Controle de Vagas Atualizado

```
Inscricao solicitada
        |
        v
  Evento lotado? ────Yes───> Bloqueia tudo (EVENT_FULL)
        |
       No
        v
  Modalidade lotada? ────Yes───> Bloqueia modalidade (MODALITY_FULL)
        |
       No
        v
  Lote ativo encontrado? ────No───> LOT_SOLD_OUT_OR_CHANGED
        |
       Yes
        v
  Lote cheio? ────Yes───> Fecha lote atual
        |                         |
       No                    Proximo lote existe?
        |                    /            \
        v                  Yes            No
  Processa inscricao    Ativa proximo    Retorna LOTE_ESGOTADO_E_SEM_PROXIMO
        |               lote e retorna
        v               LOT_SOLD_OUT_OR_CHANGED
  Inscricao confirmada  Repete o loop e
                       processa inscricao
                       com novo lote
```

### 6. Remocao de Restricoes de Data na Query de Lote Ativo

**Problema anterior:** A query de busca de lote ativo incluia filtros de data (`data_inicio <= NOW()` e `data_termino`). Apos a ativacao automatica de um lote futuro, a query nao o encontrava pois sua `data_inicio` poderia estar no futuro.

**Correcao:** 
- Removidas as restricoes de data da query de busca de lote ativo
- Os flags `ativo=true` e `status='active'` sao agora a fonte de verdade
- A ativacao automatica de lotes ignora datas para garantir fluxo continuo de inscricoes

---

## Arquivos Modificados

1. `server/services/registration-service.ts`
   - Funcao `closeBatchAndActivateNext` refatorada
   - Novo codigo de erro `LOTE_ESGOTADO_E_SEM_PROXIMO`
   - Query de busca de lote simplificada (sem modality_id)
   - Virada de lote dentro da transacao atomica

2. `server/routes/admin/batches.ts`
   - Funcao `validateSingleActiveBatch` adicionada
   - Campo `status` adicionado no schema de validacao
   - Validacao de lote unico no POST e PATCH

---

## Sobre a Coluna modality_id

A coluna `modality_id` na tabela `registration_batches` foi **mantida** mas:
- Nao e utilizada no fluxo atual de inscricao
- Lotes sao tratados como globais por evento
- Pode ser removida em migracao futura se confirmado que nao sera necessaria
