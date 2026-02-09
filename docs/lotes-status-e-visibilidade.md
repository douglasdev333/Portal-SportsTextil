# Documentacao: Gerenciamento de Lotes de Inscricao

## Visao Geral

Este documento descreve a nova logica de gerenciamento de lotes de inscricao, incluindo a diferenca entre **status** e **ativo (visibilidade)**.

---

## Conceitos Importantes

### Campo `status` (Regra de Negocio)

O campo `status` define o estado do lote para fins de **logica de negocio**. Este e o campo principal que determina se um lote pode receber inscricoes.

| Status   | Descricao                                                                 |
|----------|---------------------------------------------------------------------------|
| `future` | Lote futuro, aguardando ativacao. Sera ativado automaticamente quando o lote atual fechar. |
| `active` | Lote ativo, recebendo inscricoes. **Apenas um lote pode estar ativo por evento.** |
| `closed` | Lote fechado, nao aceita mais inscricoes.                                |

### Campo `ativo` (Visibilidade para o Cliente)

O campo `ativo` e um **boolean** que controla apenas a **visibilidade** do lote na area do cliente/atleta.

| Valor | Descricao                                                    |
|-------|--------------------------------------------------------------|
| `true`  | O lote aparece para o atleta na listagem de lotes.         |
| `false` | O lote fica oculto, mas ainda existe no sistema.           |

**Importante:**
- O campo `ativo` **NAO** afeta a logica de inscricao.
- Mesmo um lote com `ativo = false` pode ter `status = 'active'` (raro, mas possivel).
- A regra de qual lote aceita inscricoes e definida **exclusivamente** pelo `status`.

---

## Acoes do Administrador

### 1. Ativar Lote

**Endpoint:** `POST /api/admin/events/:eventId/batches/:batchId/activate`

**O que acontece:**
- O lote selecionado recebe `status = 'active'` e `ativo = true`.
- Se existir outro lote com `status = 'active'`, o sistema solicita confirmacao.
- Ao confirmar, os outros lotes ativos sao fechados (`status = 'closed'`).

**Regra:** Nunca existirao dois lotes com `status = 'active'` para o mesmo evento.

---

### 2. Fechar Lote

**Endpoint:** `POST /api/admin/events/:eventId/batches/:batchId/close`

**O que acontece:**
- O lote recebe `status = 'closed'`.
- O campo `ativo` nao e alterado.
- O lote nao aceita mais inscricoes.

---

### 3. Marcar como Futuro

**Endpoint:** `POST /api/admin/events/:eventId/batches/:batchId/set-future`

**O que acontece:**
- O lote recebe `status = 'future'`.
- Disponivel apenas para lotes com `status = 'closed'`.
- Util para reabrir um lote fechado para ativacao futura.

**Restricao:** Nao e possivel marcar um lote ativo como futuro. Feche-o primeiro.

---

### 4. Alterar Visibilidade

**Endpoint:** `PATCH /api/admin/events/:eventId/batches/:batchId/visibility`

**Body:** `{ "ativo": true | false }`

**O que acontece:**
- Altera apenas o campo `ativo` (visibilidade).
- Nao afeta o `status` nem a logica de inscricao.
- Lotes ocultos (`ativo = false`) nao aparecem para atletas, mas continuam funcionando se tiverem `status = 'active'`.

---

## Interface do Administrador

Na tela de gerenciamento do evento, cada lote exibe:

1. **Nome do lote**
2. **Quantidade utilizada / maxima**
3. **Badges indicativos:**
   - `Status: Ativo` / `Status: Fechado` / `Status: Futuro`
   - `Visivel` (verde) ou `Oculto` (cinza)
   - `Expirado` (se a data de termino passou)
   - `Lotado` (se atingiu quantidade maxima)

4. **Botoes de acao (no menu do lote):**
   - **Ativar:** Disponivel para lotes que nao estao ativos
   - **Fechar:** Disponivel apenas para o lote ativo
   - **Marcar Futuro:** Disponivel para lotes fechados
   - **Tornar Visivel/Ocultar:** Alterna a visibilidade para atletas

5. **Dialog de edicao:**
   - Permite editar: nome, data inicio, data termino, quantidade maxima
   - **NAO** permite alterar status ou visibilidade diretamente
   - Status e visibilidade devem ser alterados pelos botoes de acao dedicados

---

## Fluxo Recomendado

1. **Criar lotes** com `status = 'future'` e `ativo = true`.
2. **Ativar o primeiro lote** quando as inscricoes abrirem.
3. O sistema **automaticamente fecha** o lote quando:
   - A quantidade maxima e atingida, OU
   - A data de termino chega.
4. O sistema **automaticamente ativa o proximo lote** (com `status = 'future'` e menor ordem).
5. **Fechar manualmente** um lote se necessario.
6. **Ocultar lotes** que nao devem aparecer para atletas.

---

## Queries de Inscricao

Para buscar o lote ativo para inscricao, use sempre:

```sql
SELECT *
FROM registration_batches
WHERE event_id = :eventId
  AND status = 'active'
LIMIT 1;
```

**NAO** use `ativo = true` para definir logica de inscricao.

---

## Resumo

| Acao                | Campo `status`      | Campo `ativo`       |
|---------------------|---------------------|---------------------|
| Ativar lote         | `'active'`          | `true`              |
| Fechar lote         | `'closed'`          | (nao muda)          |
| Marcar como futuro  | `'future'`          | (nao muda)          |
| Alterar visibilidade| (nao muda)          | `true` ou `false`   |

---

## Consideracoes Finais

- **`status`** = Regra de negocio (qual lote recebe inscricoes)
- **`ativo`** = Visibilidade (o que o atleta ve)
- Nunca use `ativo` para determinar se um lote aceita inscricoes.
- Sempre use `status = 'active'` para identificar o lote atual de inscricao.
