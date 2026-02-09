# Implementacao: Inscricao Sem Camisa com Ajuste de Preco

**Data:** 26/01/2026  
**Status:** Concluído

## Objetivo

Permitir que eventos ofereçam a opcao de inscricao sem camisa (ou com tamanhos especiais) com ajuste de preco, tornando o processo mais flexivel para organizadores e atletas.

## Solucao Escolhida

**Adicionar campo de ajuste de preco na grade de tamanhos de camisa.**

### Funcionamento

1. Cada tamanho de camisa pode ter um **ajuste de preco** (positivo ou negativo)
2. O organizador configura a grade com opcoes como:
   - "Sem camisa" com ajuste de -R$ 25,00 (desconto)
   - "P", "M", "G", "GG" com ajuste de R$ 0,00 (preco padrao)
   - "EG", "EGG" com ajuste de +R$ 10,00 (tamanhos especiais)
3. O preco final exibido ao atleta = preco do lote + ajuste do tamanho
4. "Sem camisa" nao consome estoque de camisas fisicas

### Vantagens

- UX intuitiva - atleta ve todas opcoes na mesma tela
- Mantem modalidades unicas (facilita gestao e resultados)
- Flexivel - diferentes precos por tamanho
- Relatorios mais limpos
- Menos trabalho para o organizador

---

## Etapas da Implementacao

### 1. Alteracao no Banco de Dados

**Tabela:** `shirt_sizes`

**Campo adicionado:**
- `ajuste_preco` (DECIMAL 10,2) - Valor do ajuste em reais. Negativo = desconto, Positivo = acrescimo, Zero = preco padrao

**Migracao:**
```sql
ALTER TABLE shirt_sizes 
ADD COLUMN ajuste_preco DECIMAL(10,2) DEFAULT 0 NOT NULL;
```

### 2. Atualizacao do Schema (Drizzle)

**Arquivo:** `shared/schema.ts`

```typescript
export const shirtSizes = pgTable("shirt_sizes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").notNull().references(() => events.id),
  modalityId: varchar("modality_id").references(() => modalities.id),
  tamanho: varchar("tamanho", { length: 10 }).notNull(),
  quantidadeTotal: integer("quantidade_total").notNull(),
  quantidadeDisponivel: integer("quantidade_disponivel").notNull(),
  ajustePreco: decimal("ajuste_preco", { precision: 10, scale: 2 }).default("0").notNull(), // NOVO
});
```

### 3. Atualizacao dos Formularios de Administracao

**Arquivos afetados:**
- `AdminEventManagePage.tsx` - Aba "Camisas" para adicionar/editar tamanhos
- `EventWizard.tsx` - Step de camisas no wizard de criacao

**Alteracoes:**
- Adicionar campo de "Ajuste de Preco" no formulario de tamanho
- Permitir valores negativos (desconto)
- Exibir preview do preco final

### 4. Atualizacao da Tela de Inscricao

**Arquivo:** `InscricaoModalidadePage.tsx`

**Alteracoes:**
- Exibir preco ajustado ao lado de cada tamanho
- Tamanhos com desconto devem destacar a economia
- Atualizar o valor exibido no resumo

### 5. Atualizacao do Calculo de Valor

**Arquivo:** `server/services/registration-service.ts`

**Alteracoes:**
- Ao calcular o valor da inscricao, somar o ajuste de preco do tamanho selecionado
- Garantir que o valor minimo seja zero (nao pode ficar negativo)

---

## Fluxo de Uso

### Para o Organizador

1. Acessar gerenciamento do evento
2. Na aba "Camisas", adicionar tamanhos
3. Para cada tamanho, definir:
   - Nome do tamanho (ex: "Sem camisa", "M", "GG")
   - Quantidade disponivel
   - Ajuste de preco (ex: -25.00 para desconto)

### Para o Atleta

1. Escolher modalidade
2. Ver lista de tamanhos com precos:
   - Sem camisa: R$ 75,00 (economia de R$ 25)
   - P, M, G: R$ 100,00
   - GG, EG: R$ 110,00
3. Selecionar opcao desejada
4. Continuar para resumo/pagamento

---

## Arquivos Modificados

| Arquivo | Tipo de Alteracao |
|---------|------------------|
| `shared/schema.ts` | Adicionar campo ajustePreco |
| `server/storage.ts` | Atualizar queries |
| `server/services/registration-service.ts` | Atualizar calculo de valor |
| `server/routes/admin/events.ts` | Retornar ajustePreco |
| `client/src/pages/admin/AdminEventManagePage.tsx` | Formulario de ajuste |
| `client/src/pages/admin/events/steps/EventShirtSizesStep.tsx` | Formulario no wizard |
| `client/src/pages/InscricaoModalidadePage.tsx` | Exibir preco ajustado |
| `client/src/pages/InscricaoResumoPage.tsx` | Exibir preco final |

---

## Testes Necessarios

- [x] Criar tamanho "Sem camisa" com desconto de R$ 25
- [x] Verificar que preco exibido na inscricao esta correto
- [x] Confirmar que valor do pedido reflete o desconto
- [x] Testar tamanho com acrescimo (ex: +R$ 10)
- [ ] Verificar que "Sem camisa" nao consome estoque
- [ ] Exportar inscritos e verificar dados corretos

---

## Rollback

Em caso de problemas, reverter:

1. Remover campo `ajuste_preco` da tabela
2. Reverter alteracoes nos arquivos listados
3. Usar checkpoint anterior do Replit

---

## Historico

| Data | Acao |
|------|------|
| 26/01/2026 | Inicio da implementacao |
| 26/01/2026 | Campo ajustePreco adicionado ao schema |
| 26/01/2026 | Formularios de admin atualizados |
| 26/01/2026 | Tela de inscricao mostra precos ajustados |
| 26/01/2026 | registration-service aplica ajuste no calculo |
| 26/01/2026 | API registration-info retorna ajustePreco |
