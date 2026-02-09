# Plano de Desenvolvimento - Painel de Admin ST Eventos

## Fase 1: Backend Admin (✅ CONCLUÍDO)

### Autenticação e Autorização
- [x] Criar tabelas `admin_users`, `roles`, `permissions`
- [x] Implementar autenticação com email/senha
- [x] Hash de senha com bcrypt (12 rounds)
- [x] Middleware de autenticação (`requireAuth`)
- [x] Middleware de autorização por role (`requireRole`)
- [x] Regeneração de sessão no login (proteção contra fixação)
- [x] Cookies seguras com sameSite="lax" e httpOnly
- [x] Setup inicial de superadmin
- [x] Endpoint GET /api/admin/auth/me

### Organizers (CRUD)
- [x] GET /api/admin/organizers (lista todos)
- [x] GET /api/admin/organizers/:id (detalhes)
- [x] POST /api/admin/organizers (criar)
- [x] PATCH /api/admin/organizers/:id (editar)
- [x] DELETE /api/admin/organizers/:id (deletar)
- [x] Validação de CPF/CNPJ
- [x] Status (ativo, inativo, bloqueado)

### Events (CRUD)
- [x] GET /api/admin/events (lista com filtro por organizador)
- [x] GET /api/admin/events/:id (detalhes)
- [x] GET /api/admin/events/:id/full (com relacionamentos)
- [x] POST /api/admin/events (criar)
- [x] PATCH /api/admin/events/:id (editar)
- [x] PATCH /api/admin/events/:id/status (workflow de status)
- [x] DELETE /api/admin/events/:id (apenas rascunhos sem inscrições)
- [x] Slug geração automática e único
- [x] Validação de datas (inscrições antes do evento)
- [x] Limite total de vagas obrigatório

### Modalities (CRUD)
- [x] GET /api/admin/events/:eventId/modalities
- [x] POST /api/admin/events/:eventId/modalities
- [x] PATCH /api/admin/events/:eventId/modalities/:id
- [x] PATCH /api/admin/events/:eventId/modalities/reorder
- [x] DELETE /api/admin/events/:eventId/modalities/:id
- [x] Limite de vagas por modalidade (opcional)
- [x] Validação de distância

### Batches (CRUD)
- [x] GET /api/admin/events/:eventId/batches
- [x] POST /api/admin/events/:eventId/batches
- [x] PATCH /api/admin/events/:eventId/batches/:id
- [x] DELETE /api/admin/events/:eventId/batches/:id
- [x] Auto-ativação de lote

### Prices (CRUD)
- [x] GET /api/admin/events/:eventId/prices
- [x] POST /api/admin/events/:eventId/prices
- [x] PATCH /api/admin/events/:eventId/prices/:id
- [x] PUT /api/admin/events/:eventId/prices/bulk
- [x] DELETE /api/admin/events/:eventId/prices/:id
- [x] Combinação Modality + Batch

### Shirt Sizes (CRUD)
- [x] GET /api/admin/events/:eventId/shirts
- [x] POST /api/admin/events/:eventId/shirts
- [x] PATCH /api/admin/events/:eventId/shirts/:id
- [x] DELETE /api/admin/events/:eventId/shirts/:id
- [x] Suporte por evento ou por modalidade

### Attachments (CRUD)
- [x] GET /api/admin/events/:eventId/attachments
- [x] POST /api/admin/events/:eventId/attachments
- [x] PATCH /api/admin/events/:eventId/attachments/:id
- [x] DELETE /api/admin/events/:eventId/attachments/:id

### Segurança (✅ CONCLUÍDO)
- [x] Verificação de propriedade em todos endpoints (organizadores só veem eventos deles)
- [x] Proteção contra CSRF com cookies sameSite
- [x] Hash seguro de senha com bcrypt
- [x] Regeneração de sessão no login
- [x] Validação de entrada com Zod em todas rotas
- [x] Erros 403 apropriados para acesso não autorizado
- [x] Erros 404 em vez de 403 para eventos não encontrados (protege de enumeração)

---

## Fase 2: Frontend Admin (⏳ EM ANDAMENTO)

### Estrutura Base
- [ ] Layout com sidebar/navegação
- [ ] Autenticação frontend (login/logout)
- [ ] Proteção de rotas (redirect para login)
- [ ] Temas e estilos admin

### Autenticação
- [ ] Tela de login de admin
- [ ] Session persistence
- [ ] Logout
- [ ] Redirecionamento pós-login

### Dashboard Admin
- [ ] Dashboard inicial com resumo
- [ ] Listagem de eventos
- [ ] Listagem de organizadores

### Gerenciamento de Organizadores
- [ ] Listar organizadores
- [ ] Criar organizador (formulário)
- [ ] Editar organizador
- [ ] Deletar organizador
- [ ] Validação de CPF/CNPJ no frontend

### Gerenciamento de Eventos
- [ ] Listar eventos
- [ ] Criar evento (formulário multi-step)
- [ ] Editar evento
- [ ] Deletar evento
- [ ] Visualizar detalhes completo (com modalidades, lotes, preços, camisas)
- [ ] Mudar status do evento

### Gerenciamento de Modalidades
- [ ] CRUD modalidades dentro de evento
- [ ] Reordenação de modalidades
- [ ] Visualização de capacidade por modalidade

### Gerenciamento de Lotes
- [ ] CRUD lotes dentro de evento
- [ ] Visualização de status (ativo/inativo)
- [ ] Data de ativação automática

### Gerenciamento de Preços
- [ ] CRUD preços (Modalidade x Lote)
- [ ] Bulk upload de preços
- [ ] Matrix view (Modalidades vs Lotes)

### Gerenciamento de Camisas
- [ ] CRUD tamanhos de camisas
- [ ] Inventário por tamanho
- [ ] Suporte por evento ou modalidade

### Gerenciamento de Anexos
- [ ] CRUD anexos/documentos
- [ ] Upload de arquivos
- [ ] Marcação de obrigatoriedade

### Dashboard de Organizador (Read-only)
- [ ] Visualizar eventos da organização
- [ ] Visualizar inscrições
- [ ] Exportar dados

---

## Prioridade MVP para Frontend Admin

1. **Login admin** - Tela de autenticação
2. **Dashboard** - Listagem de eventos
3. **CRUD Eventos** - Criar, editar, listar eventos
4. **CRUD Organizadores** - Criar, editar, listar organizadores
5. **Nested CRUD** - Modalidades, lotes, preços, camisas

---

## Arquitetura

### Stack
- Frontend: React + TypeScript + Vite
- UI: shadcn/ui + Tailwind CSS
- Routing: Wouter
- Forms: React Hook Form + Zod
- State: TanStack Query v5
- Styling: Tailwind CSS com custom design tokens

### Estrutura de Pastas Frontend Admin
```
client/src/
├── pages/
│   ├── admin/
│   │   ├── AdminLoginPage.tsx
│   │   ├── AdminDashboard.tsx
│   │   ├── AdminEventsList.tsx
│   │   ├── AdminEventDetail.tsx
│   │   ├── AdminOrganizersList.tsx
│   │   └── ...
├── components/
│   ├── admin/
│   │   ├── AdminLayout.tsx
│   │   ├── AdminSidebar.tsx
│   │   ├── AdminHeader.tsx
│   │   └── ...
```

### Autenticação Frontend
- Sessão via cookies (Express session)
- Verificar /api/admin/auth/me no mount
- Redirect para login se não autenticado

### API Base
- Todas requisições para `/api/admin/*`
- TanStack Query para caching
- Validação com Zod schemas

