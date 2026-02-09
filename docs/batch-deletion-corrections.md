# Correcoes de Delecao de Lotes (Batches)

## Contexto do Problema

Ao tentar deletar um lote (batch) pelo gerenciador de eventos, ocorria o seguinte erro do Postgres:

```
error: update or delete on table "registration_batches" violates foreign key constraint 
"prices_batch_id_registration_batches_id_fk" on table "prices"
```

Alem disso, a delecao via tela de criacao/edicao de evento estava inconsistente - lotes removidos visualmente nao eram deletados do banco.

## Regras de Negocio Implementadas

### 1. Lotes com Inscricoes Vinculadas
- **NAO PODEM SER DELETADOS**
- Backend retorna erro `BATCH_HAS_REGISTRATIONS`
- Mensagem: "Este lote possui inscricoes vinculadas e nao pode ser excluido. Feche ou oculte este lote em vez de apagar."

### 2. Lotes com Precos mas sem Inscricoes
- **PODEM SER DELETADOS**
- Precos sao removidos primeiro automaticamente
- Depois o lote e deletado

### 3. Tratamento de Erros FK
- Erros de constraint (codigo `23503`) sao capturados e transformados em mensagem amigavel

---

## Alteracoes Realizadas

### 1. Storage Layer (`server/storage.ts`)

**Novos metodos adicionados a interface `IStorage`:**

```typescript
deleteBatchSafe(id: string): Promise<{ success: boolean; code?: string; message?: string }>;
getRegistrationsByBatch(batchId: string): Promise<Registration[]>;
deletePricesByBatch(batchId: string): Promise<boolean>;
```

**Implementacao de `deleteBatchSafe`:**
- Usa **transacao atomica** para garantir consistencia
- Verifica se existem registros em `registrations` para o batch
- Se existirem inscricoes: faz ROLLBACK e retorna erro `BATCH_HAS_REGISTRATIONS`
- Se nao existirem: deleta precos primeiro, depois deleta o lote atomicamente
- Se qualquer operacao falhar, faz ROLLBACK automatico
- Captura erros FK (codigo `23503`) e retorna mensagem amigavel
- Libera conexao do pool no bloco `finally`

**Implementacao de `getRegistrationsByBatch`:**
- Busca todas as inscricoes vinculadas a um batch especifico

**Implementacao de `deletePricesByBatch`:**
- Remove todos os precos vinculados a um batch

---

### 2. Rota DELETE de Batch (`server/routes/admin/batches.ts`)

**Antes:**
- Verificava apenas `quantidadeUtilizada > 0`
- Deletava diretamente sem tratar precos

**Depois:**
- Usa `storage.deleteBatchSafe()` que:
  - Verifica inscricoes reais na tabela `registrations`
  - Remove precos automaticamente antes de deletar
  - Retorna codigos de erro especificos
- Trata erros FK (23503) como fallback

---

### 3. EventWizard (`client/src/pages/admin/events/EventWizard.tsx`)

**Problema:**
- Lotes removidos na UI nao eram deletados do banco ao salvar

**Solucao implementada:**
- No modo `edit`, antes de criar/atualizar lotes:
  1. Busca lotes existentes no banco
  2. Compara com lotes do formData
  3. Identifica lotes que existem no banco mas nao estao mais no formData
  4. Deleta esses lotes usando a rota DELETE (que aplica as regras de negocio)
  5. Se houver erro `BATCH_HAS_REGISTRATIONS`, exibe mensagem e aborta

---

### 4. Tratamento de Erros na UI (`client/src/pages/admin/AdminEventManagePage.tsx`)

**Ja implementado anteriormente:**
- Quando backend retorna `BATCH_HAS_REGISTRATIONS`:
  - Exibe toast com mensagem amigavel
  - Fecha dialog de confirmacao
  - Nao remove o lote da tela

---

## Fluxo de Delecao Atualizado

```
Usuario solicita delecao de lote
         |
         v
Verifica inscricoes vinculadas (registrations)
         |
    +----+----+
    |         |
   SIM       NAO
    |         |
    v         v
 Retorna    Deleta precos (prices)
 erro           |
              v
         Deleta lote (registration_batches)
              |
              v
         Retorna sucesso
```

---

## Tabelas Afetadas e FKs

| Tabela | FK para registration_batches | Comportamento |
|--------|------------------------------|---------------|
| `prices` | `batch_id` | Deletada automaticamente antes do lote |
| `registrations` | `batch_id` | Bloqueia delecao do lote |

---

## Codigos de Erro

| Codigo | HTTP Status | Descricao |
|--------|-------------|-----------|
| `BATCH_HAS_REGISTRATIONS` | 400 | Lote possui inscricoes vinculadas |
| `NOT_FOUND` | 404 | Lote nao encontrado |
| `FK_CONSTRAINT_VIOLATION` | 400 | Violacao de FK nao tratada |
| `INTERNAL_ERROR` | 500 | Erro interno do servidor |

---

## Testes Recomendados

1. **Lote sem filhos**: Deve ser deletado normalmente
2. **Lote com precos e sem inscricoes**: Deve deletar precos e depois lote
3. **Lote com inscricoes**: Deve retornar erro e nao deletar nada
4. **Tela de edicao de evento**: Remover lote na UI e salvar deve funcionar conforme regras
