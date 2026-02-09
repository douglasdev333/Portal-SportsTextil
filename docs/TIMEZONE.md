# Guia Definitivo de Tratamento de Fuso Horario - ST Eventos

## Resumo Executivo

Este documento descreve a solucao definitiva para o tratamento de fuso horario no sistema ST Eventos. A estrategia adotada e:

1. **Armazenar tudo em UTC** no banco de dados
2. **Converter para hora de Sao Paulo** apenas na exibicao/entrada
3. **Usar `TIMESTAMP WITH TIME ZONE`** no PostgreSQL

## O Problema Original

O Brasil (Sao Paulo) esta no fuso horario UTC-3. Sem tratamento adequado:
- Frontend envia "14:00" (hora local de Sao Paulo)
- Backend interpreta como "14:00 UTC"
- Banco armazena "14:00 UTC"
- Na exibicao, mostra "11:00" (UTC-3 aplicado novamente)

Resultado: horarios errados por +3 ou -3 horas.

## A Solucao Implementada

### 1. Banco de Dados (PostgreSQL com Drizzle ORM)

Todas as colunas de timestamp usam `withTimezone: true`:

```typescript
// shared/schema.ts
import { timestamp } from "drizzle-orm/pg-core";

export const events = pgTable("events", {
  // ...
  aberturaInscricoes: timestamp("abertura_inscricoes", { withTimezone: true }).notNull(),
  encerramentoInscricoes: timestamp("encerramento_inscricoes", { withTimezone: true }).notNull(),
  dataCriacao: timestamp("data_criacao", { withTimezone: true }).defaultNow().notNull(),
});

export const registrationBatches = pgTable("registration_batches", {
  // ...
  dataInicio: timestamp("data_inicio", { withTimezone: true }).notNull(),
  dataTermino: timestamp("data_termino", { withTimezone: true }),
});
```

Isso gera colunas `TIMESTAMPTZ` no PostgreSQL, que:
- Armazenam o momento exato em UTC internamente
- Convertem automaticamente para/de qualquer timezone

### 2. Backend (Express + TypeScript)

#### Utilitarios de Timezone (`server/utils/timezone.ts`)

```typescript
import { fromZonedTime, toZonedTime, format } from 'date-fns-tz';
import { parseISO, isValid } from 'date-fns';

export const BRAZIL_TIMEZONE = 'America/Sao_Paulo';

// Converte hora local de Sao Paulo para UTC (para salvar no banco)
// IMPORTANTE: Aceita apenas strings para evitar ambiguidade com objetos Date
export function localToBrazilUTC(localDateTimeString: string): Date {
  if (!localDateTimeString || typeof localDateTimeString !== 'string') {
    throw new Error('Data e obrigatoria e deve ser uma string');
  }
  
  // Se ja tem timezone (Z ou +/-XX:XX), apenas parse
  const trimmed = localDateTimeString.trim();
  if (trimmed.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(trimmed)) {
    return new Date(trimmed);
  }
  
  // String sem timezone = interpreta como hora de Sao Paulo
  const parsed = parseISO(trimmed);
  return fromZonedTime(parsed, BRAZIL_TIMEZONE);
}

// Converte UTC do banco para hora local de Sao Paulo (para exibir)
export function utcToBrazilLocal(utcDate: Date | string): string {
  const date = typeof utcDate === 'string' ? new Date(utcDate) : utcDate;
  const zonedDate = toZonedTime(date, BRAZIL_TIMEZONE);
  return format(zonedDate, "yyyy-MM-dd'T'HH:mm", { timeZone: BRAZIL_TIMEZONE });
}
```

#### Uso nas Rotas

**Entrada (POST/PATCH):** Converte de Sao Paulo para UTC antes de salvar

```typescript
// server/routes/admin/events.ts
router.post("/", async (req, res) => {
  const event = await storage.createEvent({
    // ...
    aberturaInscricoes: localToBrazilUTC(validation.data.aberturaInscricoes),
    encerramentoInscricoes: localToBrazilUTC(validation.data.encerramentoInscricoes),
  });
});
```

**Saida (GET):** Converte de UTC para Sao Paulo antes de retornar

```typescript
function formatEventForResponse(event: any) {
  return {
    ...event,
    aberturaInscricoes: utcToBrazilLocal(event.aberturaInscricoes),
    encerramentoInscricoes: utcToBrazilLocal(event.encerramentoInscricoes),
  };
}

router.get("/", async (req, res) => {
  const events = await storage.getEvents();
  res.json({ success: true, data: events.map(formatEventForResponse) });
});
```

### 3. Frontend (React + TypeScript)

#### Utilitarios de Timezone (`client/src/lib/timezone.ts`)

```typescript
import { formatInTimeZone } from 'date-fns-tz';

export const BRAZIL_TIMEZONE = 'America/Sao_Paulo';

// Formata para exibicao
export function formatDateTimeBrazil(dateString: string): string {
  return formatInTimeZone(new Date(dateString), BRAZIL_TIMEZONE, 'dd/MM/yyyy HH:mm');
}

// Verifica se inscricoes estao abertas
export function isEventOpen(abertura: string, encerramento: string): boolean {
  const now = new Date();
  return now >= new Date(abertura) && now <= new Date(encerramento);
}
```

## Fluxo Completo de Dados

```
Usuario digita: "2025-11-27 14:00" (hora de Sao Paulo)
         |
         v
Frontend envia: "2025-11-27T14:00" (string local)
         |
         v
Backend converte: localToBrazilUTC("2025-11-27T14:00")
         |         = new Date("2025-11-27T17:00:00Z") (UTC)
         v
PostgreSQL armazena: 2025-11-27 17:00:00+00 (TIMESTAMPTZ)
         |
         v
Backend le: Date("2025-11-27T17:00:00Z") (UTC)
         |
         v
Backend converte: utcToBrazilLocal(date)
         |         = "2025-11-27T14:00" (string local)
         v
Frontend exibe: "27/11/2025 14:00" (formatado para usuario)
```

## Tabelas com Timestamps

As seguintes tabelas possuem colunas timestamp que seguem este padrao:

| Tabela | Colunas Timestamp |
|--------|-------------------|
| `organizers` | `dataCadastro` |
| `admin_users` | `ultimoLogin`, `dataCriacao`, `dataAtualizacao` |
| `events` | `aberturaInscricoes`, `encerramentoInscricoes`, `dataCriacao` |
| `registration_batches` | `dataInicio`, `dataTermino` |
| `event_banners` | `dataCriacao` |
| `athletes` | `dataCadastro` |
| `orders` | `dataPedido`, `dataPagamento`, `dataExpiracao` |
| `registrations` | `dataInscricao` |
| `document_acceptances` | `dataAceite` |

## Regras de Ouro

### SEMPRE Fazer:

1. Usar `timestamp({ withTimezone: true })` em novas colunas de data/hora
2. Chamar `localToBrazilUTC()` ao receber datas do frontend
3. Chamar `utcToBrazilLocal()` ao enviar datas para o frontend
4. Usar `formatInTimeZone()` no frontend para exibicao

### NUNCA Fazer:

1. Usar `new Date().toISOString()` diretamente para salvar datas do usuario
2. Assumir que strings de data ja estao em UTC
3. Usar `timestamp()` sem `withTimezone: true` para novas colunas
4. Fazer calculos de tempo sem considerar o timezone

## Dependencias Utilizadas

```json
{
  "date-fns": "^3.6.0",
  "date-fns-tz": "^3.2.0"
}
```

## Testes de Validacao

Para validar que o timezone esta funcionando corretamente:

1. Crie um evento com abertura as 14:00
2. Verifique no banco: deve mostrar 17:00 UTC (ou +00)
3. Visualize no frontend: deve mostrar 14:00

```sql
-- Verificar no PostgreSQL
SELECT 
  nome,
  abertura_inscricoes,
  abertura_inscricoes AT TIME ZONE 'America/Sao_Paulo' as hora_local
FROM events;
```

## Consideracoes Adicionais

### Horario de Verao

O Brasil encerrou o horario de verao permanentemente em 2019. Sao Paulo agora e **sempre UTC-3**. A biblioteca `date-fns-tz` lida com isso automaticamente usando o banco de dados IANA.

### Novos Desenvolvedores

Ao adicionar novas funcionalidades com datas:

1. Adicione `{ withTimezone: true }` na coluna do schema
2. Use as funcoes utilitarias existentes
3. Siga o padrao das rotas existentes

### Migracao de Dados Existentes

Se houver dados antigos com timezone incorreto, execute:

```sql
-- CUIDADO: Fazer backup antes!
-- Este exemplo converte datas que foram salvas incorretamente
UPDATE events 
SET abertura_inscricoes = abertura_inscricoes - INTERVAL '3 hours'
WHERE abertura_inscricoes IS NOT NULL;
```

## Conclusao

Com esta implementacao:
- Todos os timestamps sao armazenados em UTC
- A conversao para hora de Sao Paulo e automatica
- O codigo e consistente em todo o projeto
- Novos desenvolvedores tem um guia claro a seguir

---

**Autor:** Sistema ST Eventos  
**Data:** Novembro 2025  
**Versao:** 1.0
