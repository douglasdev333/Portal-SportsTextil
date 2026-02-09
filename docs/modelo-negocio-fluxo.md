# ST Eventos - Modelo de Negocio e Fluxo

## Visao Geral do Sistema

O ST Eventos e uma plataforma de inscricoes para eventos de corrida (maratonas, trail runs, corridas de rua). O sistema possui tres lados principais:

1. **Painel Administrativo (Admin)**: Onde o administrador do sistema cria, configura e gerencia eventos. Apenas o admin pode criar/editar eventos para evitar configuracoes erradas.
2. **Painel do Organizador**: Dashboard somente leitura onde organizadores visualizam dados do seu evento (inscricoes, faturamento, exportacao de dados). SEM permissao de edicao.
3. **Portal do Atleta**: Onde atletas se inscrevem e acompanham suas inscricoes

---

## Papeis e Permissoes

### Super Administrador (superadmin)
- Acesso total ao sistema
- Criar/editar/remover administradores
- Criar/editar/remover organizadores
- Gerenciar configuracoes globais do sistema
- Visualizar todos os eventos e dados

### Administrador (admin)
- Criar e editar organizadores
- Criar e editar eventos completos (dados, modalidades, lotes, precos, camisas, anexos)
- Publicar/cancelar/finalizar eventos
- Visualizar todos os dados do sistema
- NAO pode criar outros administradores

### Organizador do Evento (organizador) - SOMENTE LEITURA
- **NAO PODE** criar ou editar eventos
- **NAO PODE** alterar precos, modalidades, lotes ou qualquer configuracao
- **PODE APENAS** visualizar dados do seu evento via dashboard:
  - Numero total de inscritos
  - Lista completa de inscritos (com exportacao CSV/Excel)
  - Dados de cada inscrito (nome, CPF, email, telefone, modalidade, camisa)
  - Pedidos e status de pagamento
  - Faturamento bruto e liquido
  - Grade de camisas (quantas de cada tamanho)
  - Graficos de inscricoes por dia/semana

---

## Estrutura de Autenticacao (Banco de Dados)

### Tabela: admin_users
| Campo | Tipo | Descricao |
|-------|------|-----------|
| id | UUID | Identificador unico |
| email | TEXT | Email para login (unico) |
| password_hash | TEXT | Senha criptografada (bcrypt/argon2) |
| nome | TEXT | Nome do usuario |
| role | ENUM | superadmin, admin, organizador |
| status | ENUM | ativo, inativo, bloqueado |
| organizer_id | UUID | Vinculo com organizador (apenas para role=organizador) |
| ultimo_login | TIMESTAMP | Data/hora do ultimo acesso |
| data_criacao | TIMESTAMP | Data de criacao |
| data_atualizacao | TIMESTAMP | Data da ultima atualizacao |

### Tabela: permissions
| Campo | Tipo | Descricao |
|-------|------|-----------|
| id | UUID | Identificador unico |
| codigo | VARCHAR | Codigo unico da permissao (ex: eventos.criar) |
| nome | TEXT | Nome legivel |
| descricao | TEXT | Descricao da permissao |
| modulo | VARCHAR | Modulo do sistema (eventos, inscricoes, etc) |

### Tabela: role_permissions
| Campo | Tipo | Descricao |
|-------|------|-----------|
| id | UUID | Identificador unico |
| role | ENUM | Role que recebe a permissao |
| permission_id | UUID | Referencia a permissao |

### Permissoes por Modulo

**Modulo: Organizadores**
- `organizadores.listar` - Listar organizadores
- `organizadores.criar` - Criar organizador
- `organizadores.editar` - Editar organizador
- `organizadores.excluir` - Excluir organizador

**Modulo: Eventos**
- `eventos.listar` - Listar eventos
- `eventos.visualizar` - Ver detalhes do evento
- `eventos.criar` - Criar evento
- `eventos.editar` - Editar evento
- `eventos.publicar` - Publicar evento
- `eventos.cancelar` - Cancelar evento

**Modulo: Inscricoes**
- `inscricoes.listar` - Listar inscricoes
- `inscricoes.visualizar` - Ver detalhes de inscricao
- `inscricoes.exportar` - Exportar lista de inscritos

**Modulo: Dashboard**
- `dashboard.visualizar` - Ver metricas do evento
- `dashboard.faturamento` - Ver faturamento

**Modulo: Usuarios**
- `usuarios.listar` - Listar usuarios admin
- `usuarios.criar` - Criar usuario admin
- `usuarios.editar` - Editar usuario admin
- `usuarios.excluir` - Excluir usuario admin

### Matriz de Permissoes por Role

| Permissao | Superadmin | Admin | Organizador |
|-----------|------------|-------|-------------|
| organizadores.* | SIM | SIM | NAO |
| eventos.listar | SIM | SIM | SIM (proprio) |
| eventos.visualizar | SIM | SIM | SIM (proprio) |
| eventos.criar | SIM | SIM | NAO |
| eventos.editar | SIM | SIM | NAO |
| eventos.publicar | SIM | SIM | NAO |
| inscricoes.listar | SIM | SIM | SIM (proprio) |
| inscricoes.exportar | SIM | SIM | SIM (proprio) |
| dashboard.visualizar | SIM | SIM | SIM (proprio) |
| dashboard.faturamento | SIM | SIM | SIM (proprio) |
| usuarios.* | SIM | NAO | NAO |

---

## Hierarquia de Entidades

```
ORGANIZADOR
    └── EVENTO
            ├── Limite Total de Vagas (OBRIGATORIO)
            │
            ├── MODALIDADES (5km, 10km, 21km, Kids, PCD)
            │       ├── Limite de Vagas por Modalidade (opcional)
            │       └── Tipo de Acesso (gratuita, paga, voucher, pcd, aprovacao_manual)
            │
            ├── LOTES DE INSCRICAO (Promocional, 1o Lote, 2o Lote)
            │       └── Limite de Inscricoes por Lote (opcional)
            │
            ├── PRECOS (Matriz: Modalidade x Lote)
            │
            ├── GRADE DE CAMISAS
            │       └── Global OU Por Modalidade
            │
            └── ARQUIVOS ANEXOS (Regulamento, Termos)
```

---

## Fluxo Completo: Criacao do Evento ate Inscricao

### FASE 1: Cadastro do Organizador (Admin)

**Responsavel:** Administrador do sistema ou proprio organizador

| Passo | Acao | Campos |
|-------|------|--------|
| 1.1 | Cadastrar organizador | Nome, CPF/CNPJ, Email, Telefone |

**Checklist Admin:**
- [ ] Tela de listagem de organizadores
- [ ] Formulario de cadastro de organizador
- [ ] Validacao de CPF/CNPJ unico
- [ ] Edicao de dados do organizador

---

### FASE 2: Criacao do Evento (Admin)

**Responsavel:** Administrador do Sistema (organizador NAO tem acesso)

| Passo | Acao | Campos |
|-------|------|--------|
| 2.1 | Criar evento basico | Nome, Slug, Descricao, Data, Local, Cidade, Estado |
| 2.2 | Definir capacidade | **Limite Total de Vagas** (OBRIGATORIO) |
| 2.3 | Configurar periodo | Abertura e Encerramento das Inscricoes |
| 2.4 | Upload de imagens | Banner do evento |
| 2.5 | Configurar camisa | Entrega no kit? Grade global ou por modalidade? |

**Status do Evento:** Comeca como `rascunho`

**Checklist Admin:**
- [ ] Tela de listagem de eventos (por organizador)
- [ ] Formulario de criacao de evento (wizard ou unica tela)
- [ ] Campo obrigatorio de limite de vagas
- [ ] Upload de banner
- [ ] Preview do evento antes de publicar
- [ ] Botao para mudar status (rascunho → publicado)

---

### FASE 3: Configuracao das Modalidades (Admin)

**Responsavel:** Administrador do Sistema

| Passo | Acao | Campos |
|-------|------|--------|
| 3.1 | Adicionar modalidade | Nome, Distancia, Unidade (km/m), Horario Largada |
| 3.2 | Configurar vagas | Limite de Vagas (opcional - validar soma <= total evento) |
| 3.3 | Definir acesso | Tipo: gratuita, paga, voucher, pcd, aprovacao_manual |
| 3.4 | Extras | Descricao, Imagem, Mapa do Percurso, Ordem de exibicao |

**Regra de Validacao:**
```
SE soma(limiteVagas de todas modalidades) > limiteVagasTotal do evento
   ENTAO erro: "Soma das vagas excede o limite do evento"
```

**Checklist Admin:**
- [ ] Listagem de modalidades do evento
- [ ] Formulario de adicionar/editar modalidade
- [ ] Validacao de soma de vagas vs limite do evento
- [ ] Drag-and-drop para reordenar modalidades
- [ ] Indicador visual de vagas restantes

---

### FASE 4: Configuracao dos Lotes (Admin)

**Responsavel:** Administrador do Sistema

| Passo | Acao | Campos |
|-------|------|--------|
| 4.1 | Criar lote | Nome (ex: "1o Lote"), Data Inicio, Data Termino |
| 4.2 | Limitar quantidade | Quantidade Maxima (opcional) |
| 4.3 | Ativar/Desativar | Campo ativo (boolean) |
| 4.4 | Ordenar | Ordem de prioridade |

**Regra de Troca Automatica:**
```
SE lote.dataTermino <= agora() OU lote.quantidadeUtilizada >= lote.quantidadeMaxima
   ENTAO desativar lote atual E ativar proximo lote (por ordem)
```

**Checklist Admin:**
- [ ] Listagem de lotes do evento
- [ ] Formulario de criar/editar lote
- [ ] Indicador visual do lote ativo
- [ ] Contador de inscricoes utilizadas
- [ ] Botao para ativar/desativar manualmente

---

### FASE 5: Matriz de Precos (Admin)

**Responsavel:** Administrador do Sistema

| Passo | Acao | Campos |
|-------|------|--------|
| 5.1 | Definir preco | Para cada combinacao Modalidade + Lote |

**Exemplo de Matriz:**

| Modalidade / Lote | Promocional | 1o Lote | 2o Lote |
|-------------------|-------------|---------|---------|
| 5km | R$ 69 | R$ 89 | R$ 109 |
| 10km | R$ 89 | R$ 109 | R$ 129 |
| 21km | R$ 129 | R$ 149 | R$ 179 |
| Kids | Gratis | R$ 30 | R$ 40 |

**Checklist Admin:**
- [ ] Tela de matriz de precos (grid editavel)
- [ ] Validacao: toda modalidade paga precisa de preco em todo lote
- [ ] Campo para valor zerado (gratuito)
- [ ] Destaque visual do lote ativo

---

### FASE 6: Grade de Camisas (Admin)

**Responsavel:** Administrador do Sistema

| Passo | Acao | Campos |
|-------|------|--------|
| 6.1 | Definir tipo | Global (todo evento) OU Por Modalidade |
| 6.2 | Adicionar tamanhos | Tamanho (PP, P, M, G, GG, 3G), Quantidade |

**Estrutura:**
```
SE evento.usarGradePorModalidade = false
   ENTAO grade global (modalityId = null)
   
SE evento.usarGradePorModalidade = true
   ENTAO uma grade para cada modalidade
```

**Checklist Admin:**
- [ ] Toggle: Grade Global vs Por Modalidade
- [ ] Formulario de adicionar tamanhos + quantidades
- [ ] Indicador de estoque restante
- [ ] Alerta quando estoque baixo

---

### FASE 7: Arquivos Anexos (Admin)

**Responsavel:** Administrador do Sistema

| Passo | Acao | Campos |
|-------|------|--------|
| 7.1 | Upload de arquivo | Nome, URL (ou upload), Obrigatorio aceitar? |
| 7.2 | Ordenar | Ordem de exibicao |

**Tipos Comuns:**
- Regulamento do Evento
- Termo de Responsabilidade
- Politica de Privacidade

**Checklist Admin:**
- [ ] Listagem de anexos
- [ ] Upload ou link externo
- [ ] Toggle "Obrigatorio aceitar"
- [ ] Reordenar anexos

---

### FASE 8: Publicacao do Evento (Admin)

**Responsavel:** Administrador do Sistema

| Passo | Acao | Validacao |
|-------|------|-----------|
| 8.1 | Revisar evento | Todos os campos obrigatorios preenchidos? |
| 8.2 | Publicar | Mudar status para `publicado` |

**Validacoes antes de publicar:**
- [ ] Limite de vagas definido
- [ ] Pelo menos uma modalidade criada
- [ ] Pelo menos um lote ativo
- [ ] Precos definidos para modalidades pagas
- [ ] Datas de inscricao validas

**Status possiveis:**
- `rascunho` - Em construcao, nao visivel
- `publicado` - Ativo, visivel para atletas
- `cancelado` - Cancelado pelo organizador
- `finalizado` - Evento ja ocorreu

**Checklist Admin:**
- [ ] Checklist de validacao antes de publicar
- [ ] Botao "Publicar Evento"
- [ ] Confirmacao de publicacao
- [ ] Opcao de cancelar evento publicado

---

## Painel do Organizador (Dashboard - SOMENTE LEITURA)

**IMPORTANTE:** O organizador NAO tem permissao para criar ou editar eventos. Toda configuracao e feita pelo Administrador do Sistema para garantir que nao haja erros de configuracao.

### Funcionalidades do Dashboard do Organizador

| Funcionalidade | Descricao | Permissao |
|----------------|-----------|-----------|
| Visao Geral | Cards com metricas principais | Visualizar |
| Lista de Inscritos | Tabela completa com todos os dados | Visualizar + Exportar |
| Pedidos | Lista de pedidos com status de pagamento | Visualizar |
| Grade de Camisas | Quantas camisas de cada tamanho | Visualizar |
| Faturamento | Valores bruto e liquido | Visualizar |
| Graficos | Inscricoes por dia, modalidade, etc. | Visualizar |

### Metricas da Visao Geral

```
DASHBOARD DO ORGANIZADOR
├── Numero Total de Inscritos
├── Vagas Restantes
├── Inscricoes por Modalidade
├── Faturamento Bruto (total arrecadado)
├── Faturamento Liquido (apos taxas)
├── Pedidos Pagos vs Pendentes
└── Inscricoes por Dia (grafico)
```

### Lista de Inscritos (Exportavel)

Dados disponiveis para visualizacao e exportacao CSV/Excel:

| Campo | Descricao |
|-------|-----------|
| Numero Inscricao | ID unico da inscricao |
| Nome Completo | Nome do atleta |
| CPF | Documento do atleta |
| Email | Email de contato |
| Telefone | Telefone de contato |
| Data Nascimento | Para calculo de idade |
| Sexo | Masculino/Feminino |
| Cidade/Estado | Localizacao do atleta |
| Modalidade | Em qual modalidade se inscreveu |
| Tamanho Camisa | PP, P, M, G, GG, 3G |
| Status | Confirmada, Pendente, Cancelada |
| Data Inscricao | Quando se inscreveu |
| Valor Pago | Valor da inscricao |

### Grade de Camisas (Resumo)

| Tamanho | Quantidade Pedida | % do Total |
|---------|-------------------|------------|
| PP | 15 | 5% |
| P | 45 | 15% |
| M | 90 | 30% |
| G | 75 | 25% |
| GG | 45 | 15% |
| 3G | 30 | 10% |

### Checklist Painel do Organizador

- [ ] Tela de login exclusiva para organizadores
- [ ] Dashboard com cards de metricas
- [ ] Lista de inscritos com filtros e busca
- [ ] Botao de exportar para CSV/Excel
- [ ] Visualizacao de pedidos
- [ ] Grafico de inscricoes por dia
- [ ] Resumo da grade de camisas
- [ ] Visualizacao de faturamento (bruto e liquido)
- [ ] Filtros por modalidade, status, data
- [ ] SEM botoes de edicao ou exclusao

---

## Fluxo do Atleta (Portal Publico)

### FASE A: Cadastro do Atleta

| Passo | Acao | Campos |
|-------|------|--------|
| A.1 | Criar conta | CPF, Nome, Data Nascimento, Sexo, Email, Telefone, Cidade, Estado |
| A.2 | Login | CPF + Data de Nascimento |

---

### FASE B: Inscricao no Evento

| Passo | Acao | Descricao |
|-------|------|-----------|
| B.1 | Escolher evento | Listar eventos publicados |
| B.2 | Ver detalhes | Modalidades, precos, regulamento |
| B.3 | Selecionar modalidade | Verificar vagas disponiveis |
| B.4 | Escolher para quem | Para si mesmo OU para outro atleta |
| B.5 | Preencher dados | Dados do atleta (se outro) |
| B.6 | Escolher camisa | Se evento entrega camisa |
| B.7 | Aceitar termos | Documentos obrigatorios |
| B.8 | Adicionar ao pedido | Criar ou adicionar ao pedido atual |
| B.9 | Repetir (opcional) | Adicionar mais inscricoes ao mesmo pedido |
| B.10 | Finalizar pedido | Aplicar voucher (opcional), ver total |
| B.11 | Pagar | PIX, Cartao, etc. |

---

### FASE C: Confirmacao

| Passo | Acao | Descricao |
|-------|------|-----------|
| C.1 | Pagamento confirmado | Status do pedido: `pago` |
| C.2 | Inscricoes confirmadas | Status de cada inscricao: `confirmada` |
| C.3 | Decrementar estoques | Vagas, lote, camisas |
| C.4 | Enviar emails | Confirmacao para comprador e atletas |

---

## Estrutura de Pedidos e Inscricoes

```
PEDIDO (orders)
├── numeroPedido: 12345
├── compradorId: "atleta-joao"        (quem pagou)
├── valorTotal: R$ 278
├── valorDesconto: R$ 0
├── codigoVoucher: null
├── status: "pago"
│
└── INSCRICOES (registrations)
        ├── Inscricao #1
        │   ├── athleteId: "atleta-joao"  (para si mesmo)
        │   ├── modalityId: "21km"
        │   └── valorUnitario: R$ 149
        │
        ├── Inscricao #2
        │   ├── athleteId: "atleta-maria" (para a esposa)
        │   ├── modalityId: "10km"
        │   └── valorUnitario: R$ 129
        │
        └── Inscricao #3 (MESMO EVENTO, MESMO ATLETA, OUTRA MODALIDADE)
            ├── athleteId: "atleta-joao"  (ele de novo)
            ├── modalityId: "5km-kids"    (correndo com o filho)
            └── valorUnitario: R$ 0 (gratis)
```

---

## Checklist Geral do Painel Admin

### Modulo: Organizadores
- [ ] CRUD completo de organizadores
- [ ] Validacao de CPF/CNPJ

### Modulo: Eventos
- [ ] CRUD completo de eventos
- [ ] Limite de vagas obrigatorio
- [ ] Upload de banner
- [ ] Workflow de status (rascunho → publicado → finalizado)

### Modulo: Modalidades
- [ ] CRUD de modalidades por evento
- [ ] Validacao de soma de vagas
- [ ] Configuracao de tipo de acesso

### Modulo: Lotes
- [ ] CRUD de lotes por evento
- [ ] Visualizacao do lote ativo
- [ ] Contador de utilizacao

### Modulo: Precos
- [ ] Matriz editavel (Modalidade x Lote)
- [ ] Validacao de precos para modalidades pagas

### Modulo: Camisas
- [ ] Configuracao de grade (global ou por modalidade)
- [ ] Controle de estoque por tamanho

### Modulo: Anexos
- [ ] Upload de documentos
- [ ] Marcacao de obrigatoriedade

### Modulo: Inscricoes (Visualizacao)
- [ ] Listagem de inscricoes por evento
- [ ] Filtros por modalidade, status, data
- [ ] Exportacao para Excel/CSV
- [ ] Visualizacao de pedidos

### Modulo: Dashboard
- [ ] Total de inscricoes por evento
- [ ] Vagas restantes
- [ ] Receita por evento
- [ ] Graficos de inscricoes por dia

---

## Ordem Sugerida de Desenvolvimento

### Sprint 1 - Base
1. [ ] CRUD de Organizadores
2. [ ] CRUD de Eventos (sem publicacao)
3. [ ] CRUD de Modalidades

### Sprint 2 - Precos e Estoque
4. [ ] CRUD de Lotes
5. [ ] Matriz de Precos
6. [ ] Grade de Camisas

### Sprint 3 - Documentos e Publicacao
7. [ ] Upload de Anexos
8. [ ] Validacoes pre-publicacao
9. [ ] Workflow de Status

### Sprint 4 - Monitoramento
10. [ ] Listagem de Inscricoes
11. [ ] Exportacao de dados
12. [ ] Dashboard com metricas

---

## Proximos Passos

### Fase 1 - Painel Admin (Prioridade)
1. Integrar gateway de pagamento (Stripe, PagSeguro, etc.)
2. Sistema de vouchers/cupons de desconto
3. Notificacoes por email

### Fase 2 - Painel do Organizador (Somente Leitura)
4. Dashboard com metricas do evento
5. Lista de inscritos com exportacao
6. Visualizacao de faturamento
7. Grade de camisas

### Fase 3 - Melhorias
8. App mobile para atletas
9. Relatorios avancados
10. Integracao com sistemas de cronometragem
