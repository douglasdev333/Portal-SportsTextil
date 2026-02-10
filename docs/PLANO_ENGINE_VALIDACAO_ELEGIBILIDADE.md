# Plano de Implementação: Engine de Validação de Elegibilidade

## Visão Geral

Engine de regras configuráveis por modalidade que permite validar a elegibilidade de atletas no momento da inscrição, consumindo APIs REST externas (ex: base de pacientes/servidores). A validação atua como camada adicional — não substitui os tipos de acesso existentes (paga, gratuita, voucher, aprovação manual).

---

## Arquitetura da Solução

### Fluxo de Validação

```
Atleta clica "Confirmar Inscrição" (InscricaoResumoPage)
    │
    ▼
POST /api/registrations (backend)
    │
    ├─ Validações existentes (evento ativo, vagas, idade, voucher, etc.)
    │
    ├─ [NOVO] Carrega regras de elegibilidade da modalidade
    │        │
    │        ▼
    │   executeEligibilityCheck()
    │        │
    │        ├─ Regra type: "api_rest" → validateExternalApi()
    │        │       │
    │        │       ├─ Monta URL com sanitizeUrl() (substitui {cpf})
    │        │       ├─ Faz requisição HTTP (axios, com timeout)
    │        │       ├─ 200 OK → Elegível ✓
    │        │       ├─ 404 → Inelegível ✗ (regra de negócio)
    │        │       └─ 500/timeout → Aplica on_error (block ou allow)
    │        │
    │        └─ (Extensível para outros tipos de regra no futuro)
    │
    ├─ Se inelegível → Retorna erro com mensagem personalizada
    │
    └─ Se elegível → Continua fluxo normal (pagamento/gratuito/voucher)
```

### Onde cada parte fica no código

| Componente | Arquivo | Descrição |
|---|---|---|
| Schema DB | `shared/schema.ts` | Campo `regrasElegibilidade` na tabela `modalities` |
| Formulário Admin | `client/src/pages/admin/events/steps/EventModalitiesStep.tsx` | Seção de configuração no modal de criação/edição |
| Rota Admin API | `server/routes/admin/modalities.ts` | Aceitar e persistir regras no create/update |
| Service Engine | `server/services/eligibility-service.ts` | Funções `sanitizeUrl`, `validateExternalApi`, `executeEligibilityCheck` |
| Validação Inscrição | `server/routes/registrations.ts` | Chamar engine antes de criar a inscrição |
| Feedback Frontend | `client/src/pages/InscricaoResumoPage.tsx` | Exibir erro de elegibilidade ao atleta |

---

## Etapas de Implementação

### Fase 1: Schema e Banco de Dados

#### 1.1 Adicionar campo `regrasElegibilidade` na tabela `modalities`

**Arquivo:** `shared/schema.ts`

**Alteração:** Adicionar campo JSONB na definição da tabela `modalities`:

```typescript
regrasElegibilidade: jsonb("regras_elegibilidade").$type<EligibilityRule[]>(),
```

**Tipo TypeScript** (adicionar no mesmo arquivo ou em `shared/types.ts`):

```typescript
export interface EligibilityRuleRequest {
  url: string;
  method: "GET" | "POST";
  params: string[];       // Placeholders a substituir (ex: ["cpf"])
  headers?: Record<string, string>;
  timeout_ms: number;     // Timeout em milissegundos (padrão 3000)
}

export interface EligibilityRuleValidation {
  mode: "http_status" | "json_compare";
  allowed_status?: number[];   // Para mode=http_status (ex: [200])
  path?: string;               // Para mode=json_compare (ex: "apto")
  value?: any;                 // Para mode=json_compare (ex: true)
}

export interface EligibilityRule {
  type: "api_rest";
  enabled: boolean;
  request: EligibilityRuleRequest;
  validation: EligibilityRuleValidation;
  on_error: "block" | "allow";
  error_message: string;
}
```

**Checklist:**
- [ ] Definir interface `EligibilityRule` e sub-interfaces em `shared/schema.ts`
- [ ] Adicionar campo `regrasElegibilidade` na tabela `modalities` (JSONB, nullable)
- [ ] Executar `npm run db:push` para aplicar a migração
- [ ] Verificar que o campo foi criado no banco com `SELECT column_name FROM information_schema.columns WHERE table_name = 'modalities'`

---

### Fase 2: Backend — Service da Engine de Elegibilidade

#### 2.1 Criar o serviço `eligibility-service.ts`

**Arquivo:** `server/services/eligibility-service.ts`

**Funções a implementar:**

##### `sanitizeUrl(baseUrl, params)`
- Substitui placeholders `{cpf}`, `{email}`, etc. na URL
- Aplica `encodeURIComponent` nos valores
- Remove formatação do CPF (pontos e traços) antes de substituir

```typescript
export function sanitizeUrl(baseUrl: string, params: Record<string, string>): string {
  let url = baseUrl;
  for (const [key, value] of Object.entries(params)) {
    const sanitizedValue = key === 'cpf' ? value.replace(/[.\-]/g, '') : value;
    url = url.replace(`{${key}}`, encodeURIComponent(sanitizedValue));
  }
  return url;
}
```

##### `maskCpf(cpf)`
- Mascara CPF para logs seguros: `123.***.**9-00` → `123.***.***-00`

##### `validateExternalApi(ruleConfig, athleteData)`
- Executa chamada HTTP usando `axios` (ou `fetch` nativo)
- Trata respostas:
  - **404** → `{ ok: false, message: error_message }` (regra de negócio, NÃO aplica on_error)
  - **200 + http_status mode** → Verifica se status está em `allowed_status`
  - **200 + json_compare mode** → Compara `response.data[path] === value`
  - **Erro de rede/timeout/5xx** → Aplica `on_error`:
    - `"block"` → `{ ok: false, message: error_message }`
    - `"allow"` → `{ ok: true, message: "Validação externa temporariamente indisponível..." }`
- Loga erros com CPF mascarado

##### `executeEligibilityCheck(athleteData, rules)`
- Orquestra execução de todas as regras
- Filtra apenas regras com `enabled: true`
- Executa regras sequencialmente (para não sobrecarregar APIs externas)
- Coleta mensagens de erro
- Retorna `{ eligible: boolean, messages: string[] }`

**Checklist:**
- [ ] Criar arquivo `server/services/eligibility-service.ts`
- [ ] Implementar `sanitizeUrl()` com tratamento de CPF
- [ ] Implementar `maskCpf()` para logging seguro
- [ ] Implementar `validateExternalApi()` com tratamento de 404, status, json_compare e on_error
- [ ] Implementar `executeEligibilityCheck()` como orquestrador
- [ ] Instalar `axios` como dependência (`npm install axios`) — OU usar `fetch` nativo do Node 18+
- [ ] Adicionar tipagem para `AthleteData` (cpf, nome, email, dataNascimento, sexo)

---

### Fase 3: Backend — Integração nas Rotas

#### 3.1 Atualizar rota de criação/edição de modalidades

**Arquivo:** `server/routes/admin/modalities.ts`

**Alterações:**
- Adicionar `regrasElegibilidade` no `modalitySchema` (Zod):

```typescript
regrasElegibilidade: z.array(z.object({
  type: z.literal("api_rest"),
  enabled: z.boolean(),
  request: z.object({
    url: z.string().url(),
    method: z.enum(["GET", "POST"]),
    params: z.array(z.string()),
    headers: z.record(z.string()).optional(),
    timeout_ms: z.number().int().min(500).max(30000).default(3000),
  }),
  validation: z.object({
    mode: z.enum(["http_status", "json_compare"]),
    allowed_status: z.array(z.number().int()).optional(),
    path: z.string().optional(),
    value: z.any().optional(),
  }),
  on_error: z.enum(["block", "allow"]),
  error_message: z.string().min(1),
})).optional().nullable(),
```

- Garantir que o campo é passado para `storage.createModality()` e `storage.updateModality()`

**Checklist:**
- [ ] Adicionar validação Zod para `regrasElegibilidade` no `modalitySchema`
- [ ] Incluir campo no `storage.createModality()` (POST route)
- [ ] Incluir campo no `storage.updateModality()` (PATCH route)
- [ ] Testar criação de modalidade com regra via API (Postman/curl)
- [ ] Testar edição de modalidade com regra via API
- [ ] Verificar que regra é salva corretamente no banco (query SQL)

#### 3.2 Integrar validação no fluxo de inscrição

**Arquivo:** `server/routes/registrations.ts`

**Ponto de inserção:** Após a validação de idade mínima (linha ~478) e ANTES do cálculo de preço (linha ~480).

**Lógica:**

```typescript
// [NOVO] Validação de elegibilidade via API externa
if (modality.regrasElegibilidade && Array.isArray(modality.regrasElegibilidade) && modality.regrasElegibilidade.length > 0) {
  const eligibilityResult = await executeEligibilityCheck(
    {
      cpf: athlete.cpf,
      nome: athlete.nome,
      email: athlete.email,
      dataNascimento: athlete.dataNascimento,
      sexo: athlete.sexo
    },
    modality.regrasElegibilidade
  );

  if (!eligibilityResult.eligible) {
    return res.status(403).json({
      success: false,
      error: eligibilityResult.messages[0] || "Atleta não elegível para esta modalidade.",
      errorCode: "ELIGIBILITY_CHECK_FAILED",
      details: { messages: eligibilityResult.messages }
    });
  }
}
```

**Checklist:**
- [ ] Importar `executeEligibilityCheck` no arquivo de rotas
- [ ] Inserir bloco de validação após checagem de idade e antes do cálculo de preço
- [ ] Adicionar `ELIGIBILITY_CHECK_FAILED` ao tipo `RegistrationErrorCode` em `registration-service.ts`
- [ ] Testar inscrição com modalidade SEM regras (deve funcionar normalmente)
- [ ] Testar inscrição com modalidade COM regra e atleta elegível (CPF encontrado na API)
- [ ] Testar inscrição com modalidade COM regra e atleta inelegível (CPF não encontrado, 404)
- [ ] Testar inscrição com API externa indisponível + on_error="block"
- [ ] Testar inscrição com API externa indisponível + on_error="allow"

---

### Fase 4: Frontend — Configuração no Modal de Modalidades

#### 4.1 Atualizar tipo `ModalityFormData`

**Arquivo:** `client/src/pages/admin/events/steps/EventModalitiesStep.tsx`

**Alteração:** Adicionar campo no tipo/interface e no `emptyModality`:

```typescript
// No ModalityFormData (ou onde estiver definido)
regrasElegibilidade?: EligibilityRule[];

// No emptyModality
const emptyModality: ModalityFormData = {
  // ... campos existentes
  regrasElegibilidade: [],
};
```

#### 4.2 Criar seção de configuração de regras no modal

**Dentro do Dialog de criação/edição de modalidade**, adicionar uma nova seção colapsável (usando `Collapsible` ou `Accordion` do shadcn/ui):

**UI proposta:**

```
┌─────────────────────────────────────────────────┐
│ ⚙️ Validação de Elegibilidade (Opcional)        │
│ ─────────────────────────────────────────────── │
│                                                 │
│ ☑ Habilitar validação por API externa           │
│                                                 │
│ ┌─ Configuração da API ──────────────────────┐  │
│ │                                             │  │
│ │ URL da API:                                 │  │
│ │ [https://api.exemplo.com/pacientes/{cpf}  ] │  │
│ │ ℹ️ Use {cpf} onde o CPF do atleta será      │  │
│ │    inserido automaticamente                 │  │
│ │                                             │  │
│ │ Método HTTP:     [GET ▾]                    │  │
│ │                                             │  │
│ │ Timeout (ms):    [3000    ]                 │  │
│ │                                             │  │
│ │ Modo de Validação: [Status HTTP ▾]          │  │
│ │   Status aceitos: [200    ]                 │  │
│ │                                             │  │
│ │ Se API falhar:   [Bloquear inscrição ▾]     │  │
│ │                                             │  │
│ │ Mensagem de erro personalizada:             │  │
│ │ [Inscrição não permitida: cadastro não    ] │  │
│ │ [encontrado na base de dados.             ] │  │
│ │                                             │  │
│ └─────────────────────────────────────────────┘  │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Campos do formulário:**

| Campo | Tipo | Padrão | Descrição |
|---|---|---|---|
| Habilitar | Switch/Checkbox | Desligado | Ativa/desativa a validação |
| URL da API | Input texto | — | URL com placeholder `{cpf}` |
| Método HTTP | Select | GET | GET ou POST |
| Timeout (ms) | Input número | 3000 | 500 a 30000 |
| Modo de Validação | Select | http_status | `http_status` ou `json_compare` |
| Status aceitos | Input | 200 | Somente para mode=http_status |
| Campo JSON | Input | — | Somente para mode=json_compare (ex: "apto") |
| Valor esperado | Input | — | Somente para mode=json_compare (ex: true) |
| Comportamento em falha | Select | block | `block` ou `allow` |
| Mensagem de erro | Textarea | — | Mensagem exibida ao atleta quando inelegível |

**Checklist:**
- [ ] Adicionar campo `regrasElegibilidade` no tipo `ModalityFormData`
- [ ] Adicionar no `emptyModality` com valor padrão `[]`
- [ ] Criar seção colapsável "Validação de Elegibilidade" no modal
- [ ] Implementar switch de habilitação
- [ ] Implementar campos de configuração da API (URL, método, timeout)
- [ ] Implementar seleção de modo de validação com campos condicionais
- [ ] Implementar seleção de comportamento em falha (block/allow)
- [ ] Implementar campo de mensagem de erro personalizada
- [ ] Validar URL contém `{cpf}` quando habilitado
- [ ] Garantir que o campo é enviado no save (handleSave)
- [ ] Garantir que o campo é carregado no edit (openEditDialog)
- [ ] Testar criação de modalidade com regra habilitada
- [ ] Testar edição de modalidade existente (carregar regra salva)
- [ ] Testar desabilitar regra (switch off) e salvar

---

### Fase 5: Frontend — Feedback de Erro na Tela de Resumo

#### 5.1 Tratar erro de elegibilidade na `InscricaoResumoPage`

**Arquivo:** `client/src/pages/InscricaoResumoPage.tsx`

**Alteração:** No `onError` e `onSuccess` da mutation, tratar o `errorCode: "ELIGIBILITY_CHECK_FAILED"`:

```typescript
// No error-messages.ts ou inline
if (errorCode === "ELIGIBILITY_CHECK_FAILED") {
  // Exibir a mensagem personalizada que veio do backend
  // (é a error_message configurada pelo admin na regra)
}
```

**UI de erro proposta:**

```
┌─────────────────────────────────────────┐
│ ⚠️  Inscrição Não Permitida             │
│                                         │
│ Inscrição não permitida: cadastro não   │
│ encontrado na base de dados oficial.    │
│                                         │
│ [Voltar para o evento]                  │
└─────────────────────────────────────────┘
```

O toast destrutivo existente já cuida disso, mas podemos melhorar com uma mensagem mais clara no toast.

**Checklist:**
- [ ] Adicionar `ELIGIBILITY_CHECK_FAILED` no `getFriendlyErrorMessage` em `client/src/lib/error-messages.ts`
- [ ] Verificar que a mensagem personalizada do backend é exibida corretamente no toast
- [ ] Testar exibição de erro ao tentar inscrição de atleta inelegível
- [ ] Verificar que o botão "Confirmar" volta ao estado normal após erro

---

### Fase 6: Testes e Validação Final

#### 6.1 Cenários de teste

| # | Cenário | Esperado |
|---|---|---|
| 1 | Modalidade SEM regras de elegibilidade | Inscrição funciona normalmente (regressão) |
| 2 | Modalidade COM regra, CPF encontrado (200) | Inscrição permitida |
| 3 | Modalidade COM regra, CPF NÃO encontrado (404) | Inscrição bloqueada com mensagem personalizada |
| 4 | Modalidade COM regra, API retorna 500 + on_error=block | Inscrição bloqueada |
| 5 | Modalidade COM regra, API retorna 500 + on_error=allow | Inscrição permitida (com aviso no log) |
| 6 | Modalidade COM regra, API timeout + on_error=block | Inscrição bloqueada |
| 7 | Modalidade COM regra, API timeout + on_error=allow | Inscrição permitida |
| 8 | Regra habilitada → desabilitada → inscrição | Inscrição permitida (regra ignorada) |
| 9 | Validação json_compare com campo "apto"=true | Inscrição permitida se response.apto === true |
| 10 | Múltiplas regras, uma falha | Inscrição bloqueada |
| 11 | Modal admin: criar modalidade com regra | Regra salva no banco corretamente |
| 12 | Modal admin: editar modalidade com regra existente | Campos preenchidos corretamente |
| 13 | Modal admin: desabilitar regra e salvar | Regra atualizada com enabled=false |

**Checklist:**
- [ ] Testar cenário 1: regressão sem regras
- [ ] Testar cenário 2: elegível (200)
- [ ] Testar cenário 3: inelegível (404)
- [ ] Testar cenário 4: erro + block
- [ ] Testar cenário 5: erro + allow
- [ ] Testar cenário 6: timeout + block
- [ ] Testar cenário 7: timeout + allow
- [ ] Testar cenário 8: regra desabilitada
- [ ] Testar cenário 11: criação via admin
- [ ] Testar cenário 12: edição via admin
- [ ] Testar cenário 13: desabilitar via admin

---

## Considerações de Segurança

1. **CPF nunca logado completo** — Usar `maskCpf()` em todos os logs
2. **URL da API externa não exposta ao frontend** — As regras ficam no backend; o frontend admin configura, mas o atleta nunca vê a URL
3. **Timeout obrigatório** — Mínimo 500ms, máximo 30000ms, para evitar que APIs lentas travem o fluxo
4. **Sem chaves de API hardcoded** — Se a API externa exigir autenticação, usar variáveis de ambiente
5. **Tratamento de erros robusto** — Erros de rede nunca crasham o servidor; sempre retornam resposta limpa ao frontend

---

## Considerações de Extensibilidade

A engine foi projetada para suportar novos tipos de regra no futuro:

```typescript
// Exemplo de regra futura: validação por lista/whitelist
{
  type: "whitelist",
  field: "cpf",
  values: ["111.111.111-11", "222.222.222-22"],
  error_message: "CPF não está na lista de permitidos"
}

// Exemplo de regra futura: validação por campo do atleta
{
  type: "field_check",
  field: "sexo",
  operator: "equals",
  value: "Feminino",
  error_message: "Esta modalidade é exclusiva para atletas do sexo feminino"
}
```

O `executeEligibilityCheck` já está preparado para rotear diferentes `type` de regra.

---

## Resumo de Arquivos Modificados/Criados

| Ação | Arquivo |
|---|---|
| **MODIFICAR** | `shared/schema.ts` — Adicionar campo + tipos |
| **CRIAR** | `server/services/eligibility-service.ts` — Engine completa |
| **MODIFICAR** | `server/routes/admin/modalities.ts` — Schema Zod + persistência |
| **MODIFICAR** | `server/routes/registrations.ts` — Integrar validação |
| **MODIFICAR** | `server/services/registration-service.ts` — Novo error code |
| **MODIFICAR** | `client/src/pages/admin/events/steps/EventModalitiesStep.tsx` — UI de config |
| **MODIFICAR** | `client/src/pages/InscricaoResumoPage.tsx` — Feedback de erro |
| **MODIFICAR** | `client/src/lib/error-messages.ts` — Mensagem amigável |
| **CRIAR** | `docs/PLANO_ENGINE_VALIDACAO_ELEGIBILIDADE.md` — Este documento |

---

## Ordem de Execução Recomendada

```
1. Schema + DB (Fase 1)          ← Fundação
2. Service Engine (Fase 2)       ← Lógica core
3. Rotas Backend (Fase 3)        ← Integração
4. UI Admin (Fase 4)             ← Configuração
5. Feedback Frontend (Fase 5)    ← Experiência do atleta
6. Testes (Fase 6)               ← Validação
```

Cada fase pode ser implementada e testada independentemente antes de avançar para a próxima.
