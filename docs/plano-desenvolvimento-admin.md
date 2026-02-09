# Plano de Desenvolvimento - Painel Administrativo ST Eventos

## Visao Geral

Este documento descreve o plano de desenvolvimento do backend e painel administrativo do ST Eventos, focando nos modulos CRUD necessarios para gerenciamento completo de eventos de corrida.

## Arquitetura da API

### Estrutura de Rotas

```
/api/admin
├── /auth
│   ├── POST   /login              - Login de administrador
│   ├── POST   /logout             - Logout
│   └── GET    /me                 - Usuario atual
│
├── /organizers
│   ├── GET    /                   - Listar organizadores
│   ├── GET    /:id                - Detalhes do organizador
│   ├── POST   /                   - Criar organizador
│   ├── PATCH  /:id                - Atualizar organizador
│   └── DELETE /:id                - Remover organizador
│
├── /events
│   ├── GET    /                   - Listar eventos
│   ├── GET    /:id                - Detalhes do evento
│   ├── GET    /:id/full           - Evento com todas as relacoes
│   ├── POST   /                   - Criar evento
│   ├── PATCH  /:id                - Atualizar evento
│   ├── PATCH  /:id/status         - Alterar status (publicar/cancelar)
│   └── DELETE /:id                - Remover evento (apenas rascunho)
│
├── /events/:eventId/modalities
│   ├── GET    /                   - Listar modalidades
│   ├── POST   /                   - Criar modalidade
│   ├── PATCH  /:id                - Atualizar modalidade
│   ├── PATCH  /reorder            - Reordenar modalidades
│   └── DELETE /:id                - Remover modalidade
│
├── /events/:eventId/batches
│   ├── GET    /                   - Listar lotes
│   ├── POST   /                   - Criar lote
│   ├── PATCH  /:id                - Atualizar lote
│   └── DELETE /:id                - Remover lote
│
├── /events/:eventId/prices
│   ├── GET    /                   - Matriz de precos
│   ├── POST   /                   - Definir preco (modalidade + lote)
│   ├── PATCH  /:id                - Atualizar preco
│   └── PUT    /bulk               - Atualizar matriz completa
│
├── /events/:eventId/shirts
│   ├── GET    /                   - Grade de camisas
│   ├── POST   /                   - Adicionar tamanho
│   ├── PATCH  /:id                - Atualizar quantidade
│   └── DELETE /:id                - Remover tamanho
│
├── /events/:eventId/attachments
│   ├── GET    /                   - Listar anexos
│   ├── POST   /                   - Upload de anexo
│   ├── PATCH  /:id                - Atualizar anexo
│   └── DELETE /:id                - Remover anexo
│
├── /events/:eventId/registrations
│   ├── GET    /                   - Listar inscricoes
│   ├── GET    /:id                - Detalhes da inscricao
│   └── GET    /export             - Exportar CSV/Excel
│
└── /events/:eventId/orders
    ├── GET    /                   - Listar pedidos
    └── GET    /:id                - Detalhes do pedido
```

---

## Ordem de Implementacao

### Fase 1: Base e Autenticacao

#### 1.1 Interface de Storage para Admin Users
- [ ] Adicionar metodos no IStorage para admin_users
- [ ] Implementar CRUD de admin_users no MemStorage
- [ ] Adicionar hash de senha (bcrypt)

#### 1.2 Rotas de Autenticacao
- [ ] POST /api/admin/auth/login
- [ ] POST /api/admin/auth/logout
- [ ] GET /api/admin/auth/me
- [ ] Middleware de autenticacao
- [ ] Middleware de verificacao de role

---

### Fase 2: CRUD de Organizadores

#### 2.1 Rotas de Organizadores
- [ ] GET /api/admin/organizers
- [ ] GET /api/admin/organizers/:id
- [ ] POST /api/admin/organizers
- [ ] PATCH /api/admin/organizers/:id
- [ ] DELETE /api/admin/organizers/:id

#### 2.2 Validacoes
- [ ] CPF/CNPJ unico
- [ ] Email valido
- [ ] Telefone no formato correto

---

### Fase 3: CRUD de Eventos

#### 3.1 Criacao de Evento
Campos obrigatorios (conforme documento do usuario):
- Nome do evento
- Slug (gerado automaticamente)
- Data do evento
- Endereco, Cidade, Estado
- Organizador responsavel
- **Limite total de vagas (OBRIGATORIO)**
- Periodo de inscricoes (inicio e fim)

Campos opcionais:
- Descricao completa
- Banner URL
- Entrega de camisa no kit
- Usar grade por modalidade

#### 3.2 Rotas de Eventos
- [ ] GET /api/admin/events
- [ ] GET /api/admin/events/:id
- [ ] GET /api/admin/events/:id/full (com modalidades, lotes, precos)
- [ ] POST /api/admin/events
- [ ] PATCH /api/admin/events/:id
- [ ] PATCH /api/admin/events/:id/status
- [ ] DELETE /api/admin/events/:id

#### 3.3 Validacoes de Evento
- [ ] Slug unico
- [ ] Limite de vagas > 0
- [ ] Data de encerramento > abertura
- [ ] Data do evento > encerramento inscricoes

#### 3.4 Workflow de Status
```
rascunho ──> publicado ──> finalizado
     │            │
     │            └──> cancelado
     │
     └──> (pode ser editado livremente)
```

---

### Fase 4: CRUD de Modalidades

#### 4.1 Campos da Modalidade
Obrigatorios:
- Nome (ex: "5km Solo", "21km PCD")
- Distancia (numerico)
- Unidade (km ou m)
- Horario de largada
- Tipo de acesso (gratuita, paga, voucher, pcd, aprovacao_manual)

Opcionais:
- Descricao
- Imagem da modalidade
- Mapa do percurso (URL)
- Limite de vagas por modalidade
- Taxa de comodidade
- Ordem de exibicao

#### 4.2 Tipos de Acesso
| Tipo | Descricao |
|------|-----------|
| gratuita | Inscricao gratis, sem pagamento |
| paga | Requer pagamento conforme matriz de precos |
| voucher | Requer codigo de cortesia |
| pcd | Exclusiva para PCD (com ou sem acompanhante) |
| aprovacao_manual | Requer aprovacao do organizador |

#### 4.3 Validacoes
- [ ] Soma de limites <= limite total do evento
- [ ] Se tipo=paga, deve ter preco definido em pelo menos um lote

---

### Fase 5: CRUD de Lotes

#### 5.1 Campos do Lote
- Nome (ex: "Lote Promocional", "1o Lote")
- Data de inicio
- Data de termino (opcional)
- Quantidade maxima (opcional)
- Ordem de prioridade
- Ativo (boolean)

#### 5.2 Logica de Troca Automatica
```javascript
// Lote ativo quando:
// 1. Campo "ativo" = true
// 2. dataInicio <= agora
// 3. (dataTermino == null OU dataTermino > agora)
// 4. (quantidadeMaxima == null OU quantidadeUtilizada < quantidadeMaxima)
```

---

### Fase 6: Matriz de Precos

#### 6.1 Estrutura
Cada preco e uma combinacao de:
- Modalidade
- Lote
- Valor base

#### 6.2 Calculo Final
```
Preco Final = prices.valor + modalities.taxaComodidade
```

#### 6.3 Validacoes
- [ ] Toda modalidade "paga" deve ter preco em todos os lotes ativos
- [ ] Modalidade "gratuita" pode ter preco = 0 ou nenhum preco

---

### Fase 7: Grade de Camisas

#### 7.1 Modos de Operacao
1. **Global**: Uma grade unica para todo o evento
2. **Por Modalidade**: Cada modalidade tem sua propria grade

#### 7.2 Campos
- Tamanho (PP, P, M, G, GG, 3G, etc)
- Quantidade total
- Quantidade disponivel

---

### Fase 8: Anexos do Evento

#### 8.1 Campos
- Nome do arquivo (visivel ao atleta)
- URL do arquivo
- Obrigatorio aceitar? (boolean)
- Ordem de exibicao

#### 8.2 Tipos Comuns
- Regulamento do Evento
- Termo de Responsabilidade
- Autorizacao de Imagem
- Politica de Privacidade

---

## Validacoes Pre-Publicacao

Antes de mudar status para "publicado", verificar:

- [ ] Limite de vagas total definido (> 0)
- [ ] Pelo menos uma modalidade criada
- [ ] Pelo menos um lote ativo
- [ ] Precos definidos para todas as modalidades pagas
- [ ] Periodo de inscricoes valido (inicio < fim < data evento)
- [ ] Regulamento ou termo de responsabilidade anexado

---

## Estrutura de Arquivos Backend

```
server/
├── index.ts              # Entry point do servidor
├── routes.ts             # Registro das rotas
├── storage.ts            # Interface e MemStorage
├── db.ts                 # Conexao com PostgreSQL (futuro)
│
├── routes/
│   ├── admin/
│   │   ├── auth.ts       # Rotas de autenticacao
│   │   ├── organizers.ts # CRUD organizadores
│   │   ├── events.ts     # CRUD eventos
│   │   ├── modalities.ts # CRUD modalidades
│   │   ├── batches.ts    # CRUD lotes
│   │   ├── prices.ts     # Matriz de precos
│   │   ├── shirts.ts     # Grade de camisas
│   │   └── attachments.ts # Anexos
│   │
│   └── public/
│       ├── events.ts     # Listagem publica
│       └── registrations.ts # Inscricao do atleta
│
├── middleware/
│   ├── auth.ts           # Verificacao de autenticacao
│   └── permissions.ts    # Verificacao de permissoes
│
└── utils/
    ├── validators.ts     # Validacoes comuns
    ├── slugify.ts        # Geracao de slugs
    └── password.ts       # Hash de senhas
```

---

## Proximo Passo Imediato

### Sprint 1 - Backend Base (Esta Semana)

1. **Expandir IStorage** para incluir AdminUsers
2. **Criar rotas de autenticacao** (/api/admin/auth/*)
3. **Criar rotas de organizadores** (/api/admin/organizers/*)
4. **Criar rotas de eventos** (/api/admin/events/*)
5. **Criar rotas de modalidades** (/api/admin/events/:id/modalities/*)
6. **Criar rotas de lotes** (/api/admin/events/:id/batches/*)
7. **Criar rotas de precos** (/api/admin/events/:id/prices/*)

---

## Notas Tecnicas

### Autenticacao
- Usar express-session com memoria ou PostgreSQL
- Senhas com bcrypt (custo 10)
- Token de sessao HTTPOnly

### Validacao de Dados
- Usar Zod schemas do drizzle-zod
- Validar todos os inputs antes de processar
- Retornar erros descritivos

### Respostas da API
```typescript
// Sucesso
{ success: true, data: {...} }

// Erro
{ success: false, error: { code: "...", message: "..." } }

// Lista com paginacao
{ success: true, data: [...], meta: { total: 100, page: 1, limit: 20 } }
```

---

## Historico de Atualizacoes

| Data | Descricao |
|------|-----------|
| 2025-11-26 | Documento inicial criado |
| 2025-11-26 | Estrutura de rotas definida |
| 2025-11-26 | Ordem de implementacao definida |
