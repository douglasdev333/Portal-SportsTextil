# Primeiros Passos - Frontend Admin ST Eventos

## 1. Autenticação e Layout Base

### Objetivo
Criar estrutura base de autenticação e layout para o painel admin.

### Tarefas

#### 1.1 - Criar contexto de autenticação do admin
```typescript
// client/src/contexts/AdminAuthContext.tsx
- Context com estado de usuário autenticado
- Hook useAdminAuth() para acessar em qualquer componente
- Carregar usuário do /api/admin/auth/me no mount
- Suportar logout
```

#### 1.2 - Criar tela de login do admin
```typescript
// client/src/pages/admin/AdminLoginPage.tsx
- Formulário com email e senha
- Validação com Zod
- Erro de credenciais
- Redirect para dashboard após login bem-sucedido
```

#### 1.3 - Criar Layout do admin
```typescript
// client/src/components/admin/AdminLayout.tsx
- Sidebar com navegação
- Header com logout
- Main content area
- Responsive design
```

#### 1.4 - Criar componente Sidebar
```typescript
// client/src/components/admin/AdminSidebar.tsx
Menu items:
- Dashboard
- Organizadores
- Eventos
- Settings/Perfil
```

#### 1.5 - Proteger rotas admin
```typescript
// client/src/pages/admin/ProtectedAdminRoute.tsx
- Verificar autenticação
- Redirect para /admin/login se não autenticado
- Mostrar loading enquanto carrega autenticação
```

---

## 2. Dashboard Base

### Objetivo
Dashboard simples com contadores e listagem inicial.

### Tarefas

#### 2.1 - Criar página dashboard admin
```typescript
// client/src/pages/admin/AdminDashboardPage.tsx
Mostrar:
- Total de organizadores
- Total de eventos
- Total de inscrições (futura API)
- Eventos recentes
```

#### 2.2 - Cards de resumo
```typescript
// client/src/components/admin/DashboardCards.tsx
- Card com ícone e número
- Estilo consistente
- Animação ao carregar
```

#### 2.3 - Tabela de eventos recentes
```typescript
// client/src/components/admin/RecentEventsTable.tsx
- Usar TanStack Query para GET /api/admin/events
- Coluna: Nome, Organizador, Status, Data
- Link para detalhe
- Loader skeleton enquanto carrega
```

---

## 3. Gerenciamento de Organizadores (Simples)

### Objetivo
CRUD básico de organizadores sem complexidade.

### Tarefas

#### 3.1 - Listar organizadores
```typescript
// client/src/pages/admin/AdminOrganizersPage.tsx
- Tabela com organizadores
- Colunas: Nome, CPF/CNPJ, Email, Status, Ações
- Botão para criar novo
- Botões para editar/deletar em cada linha
```

#### 3.2 - Modal de criar organizador
```typescript
// client/src/components/admin/CreateOrganizerModal.tsx
Formulário com:
- Nome
- Email
- CPF ou CNPJ (radio para escolher)
- Validação CPF/CNPJ no frontend
- Salvar e fechar modal
```

#### 3.3 - Modal de editar organizador
```typescript
// client/src/components/admin/EditOrganizerModal.tsx
- Pré-popular campos
- Validação
- Salvar e fechar
```

#### 3.4 - Confirmação de deletar
```typescript
// client/src/components/admin/DeleteConfirmModal.tsx
- Dialog confirmando deleção
- Botões: Cancelar, Confirmar
```

---

## 4. Gerenciamento de Eventos (Intermediário)

### Objetivo
CRUD de eventos com navegação entre detalhes.

### Tarefas

#### 4.1 - Listar eventos
```typescript
// client/src/pages/admin/AdminEventsPage.tsx
- Tabela com eventos
- Colunas: Nome, Organizador, Status, Data Evento, Vagas, Ações
- Paginação ou infinite scroll
- Busca por nome
- Filtro por status (rascunho, publicado, cancelado, finalizado)
```

#### 4.2 - Página de detalhes do evento
```typescript
// client/src/pages/admin/AdminEventDetailPage.tsx
Layout:
- Header: Nome evento, Status, Ações (editar, deletar, mudar status)
- Abas:
  1. Informações gerais
  2. Modalidades
  3. Lotes (batches)
  4. Preços
  5. Camisas
  6. Anexos
```

#### 4.3 - Tab de informações gerais
```typescript
// client/src/components/admin/EventInfoTab.tsx
Mostrar/editar:
- Nome, descrição
- Data do evento
- Endereço, cidade, estado
- Banner URL
- Datas de abertura/encerramento de inscrições
- Limite de vagas total
- Usar/não usar grade de camisas por modalidade
- Botão editar (abre modal)
```

#### 4.4 - Modal de criar/editar evento
```typescript
// client/src/components/admin/EventFormModal.tsx
Formulário multi-step (opcional para MVP):
- Step 1: Dados básicos
- Step 2: Datas
- Step 3: Configurações (camisas, vagas)
- Salvar
```

#### 4.5 - Tab de modalidades
```typescript
// client/src/components/admin/EventModalitiesTab.tsx
- Tabela: Nome, Distância, Vagas, Ordem, Ações
- Botão adicionar modalidade
- Reordenar (drag-drop ou setas)
- Editar e deletar inline
- Form inline para adicionar nova
```

#### 4.6 - Tab de lotes
```typescript
// client/src/components/admin/EventBatchesTab.tsx
- Tabela: Nome, Quantidade, Data Início, Data Fim, Status, Ações
- Botão adicionar lote
- Editar e deletar
```

#### 4.7 - Tab de preços
```typescript
// client/src/components/admin/EventPricesTab.tsx
- Matrix view: Linhas = Modalidades, Colunas = Lotes
- Células com preço
- Editar ao clicar na célula (inline)
- Bulk upload (CSV ou paster)
```

#### 4.8 - Tab de camisas
```typescript
// client/src/components/admin/EventShirtsTab.tsx
- Tabela: Tamanho, Quantidade Total, Disponível, Ações
- Se por modalidade, mostrar modalidade também
- Adicionar, editar, deletar
```

#### 4.9 - Tab de anexos
```typescript
// client/src/components/admin/EventAttachmentsTab.tsx
- Tabela: Nome, Tipo, Obrigatório, Ações
- Upload file
- Editar metadata
- Deletar
```

#### 4.10 - Mudar status do evento
```typescript
// client/src/components/admin/EventStatusChangeModal.tsx
- Mostrar status atual e próximos status permitidos
- Confirmar mudança
- Validar regras (ex: não pode publicar sem modalidades)
```

---

## 5. Estrutura de Pastas Recomendada

```
client/src/
├── pages/
│   ├── admin/
│   │   ├── AdminLoginPage.tsx
│   │   ├── AdminDashboardPage.tsx
│   │   ├── AdminOrganizersPage.tsx
│   │   ├── AdminEventsPage.tsx
│   │   ├── AdminEventDetailPage.tsx
│   │   └── ProtectedAdminRoute.tsx
│   └── ... (rotas públicas existentes)
├── components/
│   ├── admin/
│   │   ├── AdminLayout.tsx
│   │   ├── AdminSidebar.tsx
│   │   ├── AdminHeader.tsx
│   │   ├── DashboardCards.tsx
│   │   ├── RecentEventsTable.tsx
│   │   ├── CreateOrganizerModal.tsx
│   │   ├── EditOrganizerModal.tsx
│   │   ├── DeleteConfirmModal.tsx
│   │   ├── EventInfoTab.tsx
│   │   ├── EventFormModal.tsx
│   │   ├── EventModalitiesTab.tsx
│   │   ├── EventBatchesTab.tsx
│   │   ├── EventPricesTab.tsx
│   │   ├── EventShirtsTab.tsx
│   │   ├── EventAttachmentsTab.tsx
│   │   └── EventStatusChangeModal.tsx
│   └── ... (componentes existentes)
├── contexts/
│   ├── AdminAuthContext.tsx
│   └── ... (contextos existentes)
├── lib/
│   ├── adminApi.ts (helpers para chamar /api/admin/*)
│   └── ... (utilitários existentes)
└── App.tsx (adicionar rotas /admin/*)
```

---

## 6. Passos de Implementação

### Ordem Sugerida

1. **AdminAuthContext** (1.1) - Precisa antes de tudo
2. **AdminLoginPage** (1.2) - Tela de login
3. **AdminLayout** (1.3) + **Sidebar** (1.4) - Layout base
4. **ProtectedAdminRoute** (1.5) - Proteção de rotas
5. **AdminDashboardPage** (2.1) - Dashboard simples
6. **AdminOrganizersPage** (3.1) - Listar organizadores
7. **Modals CRUD Organizadores** (3.2-3.4) - Criar/editar/deletar
8. **AdminEventsPage** (4.1) - Listar eventos
9. **AdminEventDetailPage + Tabs** (4.2-4.9) - Detalhes e gerenciamento
10. **Event Status Change** (4.10) - Mudar status

---

## 7. Checklist por Fase

### Fase 1: Autenticação ✅
- [ ] AdminAuthContext criado
- [ ] AdminLoginPage funcional
- [ ] Redirect funcionando
- [ ] Logout funcionando

### Fase 2: Layout ✅
- [ ] AdminLayout criado
- [ ] Sidebar com navegação
- [ ] Header com user info
- [ ] Responsive no mobile

### Fase 3: Dashboard ✅
- [ ] Dashboard carregando dados
- [ ] Contadores atualizando
- [ ] Eventos recentes listando

### Fase 4: Organizadores ✅
- [ ] Listar funcionando
- [ ] Criar funcionando
- [ ] Editar funcionando
- [ ] Deletar funcionando

### Fase 5: Eventos ✅
- [ ] Listar funcionando
- [ ] Detalhes carregando
- [ ] Abas navegando
- [ ] CRUD de modalidades funcional
- [ ] CRUD de lotes funcional
- [ ] Matrix de preços funcional
- [ ] CRUD de camisas funcional
- [ ] CRUD de anexos funcional

---

## 8. Dependências Necessárias

Já existentes no projeto:
- ✅ react-hook-form
- ✅ zod
- ✅ @hookform/resolvers
- ✅ @tanstack/react-query
- ✅ wouter
- ✅ shadcn/ui components
- ✅ tailwindcss
- ✅ lucide-react (ícones)

Não precisa instalar nada novo para começar!

---

## 9. Estratégia de Desenvolvimento

1. **Começar simples** - Login + Dashboard + Listar eventos
2. **Incrementar complexidade** - Adicionar CRUDs um por um
3. **Testar cada etapa** - Validar chamadas API funcionando
4. **Documentar enquanto faz** - Manter replit.md atualizado
5. **Usar TypeScript** - Tipo-segurança em todo lugar

---

## 10. Referências de Design

Cores do projeto:
- Primary: Navy Blue (#032c6b)
- Accent: Yellow (#e8b73d)
- Backgrounds: White
- Font: Inter

Style: shadcn/ui + Tailwind CSS já configurado
Dark mode: Suportado (já existe no projeto)

---

## Próximos Passos

1. Ler este arquivo
2. Começar com tarefa 1.1 (AdminAuthContext)
3. Seguir a ordem sugerida na seção 6
4. Commitar após cada seção completada
5. Testar manualmente no navegador

Bom desenvolvimento! 🚀
