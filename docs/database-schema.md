# ST Eventos - Documentacao do Banco de Dados

## Visao Geral

Este documento descreve a estrutura completa do banco de dados do sistema ST Eventos, uma plataforma de inscricoes para eventos de corrida (maratonas, trail runs, corridas de rua).

## Tecnologias Utilizadas

- **Banco de Dados**: PostgreSQL (Supabase)
- **ORM**: Drizzle ORM
- **Validacao**: Drizzle-Zod para schemas de validacao
- **Tipos**: TypeScript para tipagem estatica

## Enumeracoes (ENUMs)

| Enum | Valores | Uso |
|------|---------|-----|
| event_status | rascunho, publicado, cancelado, finalizado | Status do evento |
| modality_access | gratuita, paga, voucher, pcd, aprovacao_manual | Tipo de acesso a modalidade |
| registration_status | pendente, confirmada, cancelada | Status da inscricao |
| order_status | pendente, pago, cancelado, reembolsado, expirado | Status do pedido |
| user_role | superadmin, admin, organizador | Papel do usuario admin |
| user_status | ativo, inativo, bloqueado | Status do usuario admin |

---

## Estrutura das Tabelas

### 1. Organizadores (`organizers`)

Armazena empresas ou pessoas fisicas que criam eventos.

| Campo | Tipo | Descricao |
|-------|------|-----------|
| id | varchar (UUID) | Identificador unico |
| nome | text | Nome do organizador |
| cpfCnpj | varchar(20) | CPF ou CNPJ (unico) |
| email | text | Email de contato |
| telefone | varchar(20) | Telefone de contato |
| dataCadastro | timestamp | Data de criacao do registro |

---

### 2. Usuarios Administrativos (`admin_users`)

Usuarios com acesso ao painel administrativo (superadmin, admin, organizador).

| Campo | Tipo | Descricao |
|-------|------|-----------|
| id | varchar (UUID) | Identificador unico |
| email | text | Email para login (unico) |
| passwordHash | text | Senha criptografada (bcrypt/argon2) |
| nome | text | Nome do usuario |
| role | enum | superadmin, admin, organizador |
| status | enum | ativo, inativo, bloqueado |
| organizerId | varchar | Referencia ao organizador (apenas para role=organizador) |
| ultimoLogin | timestamp | Data/hora do ultimo acesso |
| dataCriacao | timestamp | Data de criacao |
| dataAtualizacao | timestamp | Data da ultima atualizacao |

**Regras de Permissao por Role:**

| Role | Criar Eventos | Editar Eventos | Gerenciar Admins | Dashboard |
|------|---------------|----------------|------------------|-----------|
| superadmin | Sim | Sim | Sim | Todos |
| admin | Sim | Sim | Nao | Todos |
| organizador | Nao | Nao | Nao | Proprio evento |

---

### 3. Permissoes (`permissions`)

Define as permissoes disponiveis no sistema.

| Campo | Tipo | Descricao |
|-------|------|-----------|
| id | varchar (UUID) | Identificador unico |
| codigo | varchar(100) | Codigo unico (ex: eventos.criar) |
| nome | text | Nome legivel |
| descricao | text | Descricao da permissao |
| modulo | varchar(50) | Modulo do sistema |

**Permissoes por Modulo:**

| Modulo | Permissoes |
|--------|------------|
| organizadores | listar, criar, editar, excluir |
| eventos | listar, visualizar, criar, editar, publicar, cancelar |
| inscricoes | listar, visualizar, exportar |
| dashboard | visualizar, faturamento |
| usuarios | listar, criar, editar, excluir |

---

### 4. Permissoes por Role (`role_permissions`)

Relaciona roles as suas permissoes.

| Campo | Tipo | Descricao |
|-------|------|-----------|
| id | varchar (UUID) | Identificador unico |
| role | enum | Role que recebe a permissao |
| permissionId | varchar | Referencia a permissao |

---

### 5. Eventos (`events`)

Contem todas as informacoes gerais do evento de corrida.

| Campo | Tipo | Descricao |
|-------|------|-----------|
| id | varchar (UUID) | Identificador unico |
| organizerId | varchar | Referencia ao organizador |
| slug | text | URL amigavel (ex: corrida-da-lua-2026) |
| nome | text | Nome do evento |
| descricao | text | Descricao completa |
| dataEvento | date | Data do evento |
| endereco | text | Endereco completo |
| cidade | text | Cidade |
| estado | varchar(2) | UF |
| bannerUrl | text | URL da imagem de capa |
| aberturaInscricoes | timestamp | Inicio das inscricoes |
| encerramentoInscricoes | timestamp | Fim das inscricoes |
| **limiteVagasTotal** | **integer** | **Limite total de vagas do evento (OBRIGATORIO)** |
| status | enum | rascunho, publicado, cancelado, finalizado |
| entregaCamisaNoKit | boolean | Se entrega camisa (padrao: true) |
| usarGradePorModalidade | boolean | Grade separada por modalidade (padrao: false) |
| dataCriacao | timestamp | Data de criacao do registro |

**Regra de Capacidade:**
- Todo evento DEVE ter um limite de vagas definido (nao existe opcao ilimitado)
- Se limites por modalidade forem definidos, a soma NAO pode ultrapassar o `limiteVagasTotal`
- Exemplo: Evento com 1000 vagas pode ter 5km (500), 10km (300), 21km (200) = 1000 total

---

### 6. Modalidades (`modalities`)

Cada evento pode ter varias modalidades (5km, 10km, 21km, Kids, etc.).

| Campo | Tipo | Descricao |
|-------|------|-----------|
| id | varchar (UUID) | Identificador unico |
| eventId | varchar | Referencia ao evento |
| nome | text | Nome da modalidade |
| distancia | decimal | Distancia numerica |
| unidadeDistancia | varchar(10) | km ou m (padrao: km) |
| horarioLargada | text | Horario de largada |
| descricao | text | Descricao especifica |
| imagemUrl | text | Imagem da modalidade |
| mapaPercursoUrl | text | Mapa do percurso |
| limiteVagas | integer | Limite de vagas por modalidade (OPCIONAL) |
| tipoAcesso | enum | gratuita, paga, voucher, pcd, aprovacao_manual |
| **taxaComodidade** | **decimal** | **Taxa de comodidade por inscricao (padrao: 0)** |
| ordem | integer | Ordem de exibicao |

**Regras de Limite por Modalidade:**
- O limite de vagas por modalidade e OPCIONAL (prioridade 2)
- Se definido, a SOMA de todas as modalidades NAO pode ultrapassar o `limiteVagasTotal` do evento
- Se nao definido (null), as vagas sao controladas apenas pelo limite global do evento

**Regra de Taxa de Comodidade:**
- A taxa de comodidade e um valor adicional cobrado por inscricao
- E definida por modalidade para maior personalizacao
- Pode ser R$ 0,00 (padrao) ou qualquer valor
- E somada ao preco base da inscricao no momento do checkout

**Exemplo de Precificacao com Taxa:**
| Modalidade | Preco Base (1o Lote) | Taxa Comodidade | Total |
|------------|----------------------|-----------------|-------|
| 5km | R$ 89,00 | R$ 10,00 | R$ 99,00 |
| 10km | R$ 109,00 | R$ 15,00 | R$ 124,00 |
| 21km | R$ 149,00 | R$ 20,00 | R$ 169,00 |
| Kids | Gratis | R$ 5,00 | R$ 5,00 |

---

### 7. Grade de Camisas (`shirt_sizes`)

Controle de estoque de camisas - pode ser global por evento ou por modalidade.

| Campo | Tipo | Descricao |
|-------|------|-----------|
| id | varchar (UUID) | Identificador unico |
| eventId | varchar | Referencia ao evento |
| modalityId | varchar | Referencia a modalidade (null = global) |
| tamanho | varchar(10) | PP, P, M, G, GG, 3G, etc. |
| quantidadeTotal | integer | Quantidade inicial |
| quantidadeDisponivel | integer | Quantidade restante |

**Regra de Negocio:**
- Se `modalityId` e NULL = grade global do evento
- Se `modalityId` tem valor = grade especifica daquela modalidade
- O campo `usarGradePorModalidade` no evento controla qual regra usar

---

### 8. Lotes de Inscricao (`registration_batches`)

Controle de lotes com precos diferentes por periodo.

| Campo | Tipo | Descricao |
|-------|------|-----------|
| id | varchar (UUID) | Identificador unico |
| eventId | varchar | Referencia ao evento |
| nome | text | Nome do lote (Promocional, 1o Lote, etc.) |
| dataInicio | timestamp | Inicio do lote |
| dataTermino | timestamp | Fim do lote (opcional) |
| quantidadeMaxima | integer | Limite de inscricoes (opcional) |
| quantidadeUtilizada | integer | Inscricoes realizadas |
| ativo | boolean | Se o lote esta ativo |
| ordem | integer | Ordem de prioridade |

**Regra de Troca Automatica:**
O sistema troca para o proximo lote quando:
- A data de termino chega, OU
- A quantidade maxima e atingida

---

### 9. Precos (`prices`)

Define o preco BASE por combinacao de Modalidade + Lote.

| Campo | Tipo | Descricao |
|-------|------|-----------|
| id | varchar (UUID) | Identificador unico |
| modalityId | varchar | Referencia a modalidade |
| batchId | varchar | Referencia ao lote |
| valor | decimal | Valor base em reais |

**Calculo do Preco Final:**
```
Preco Final = prices.valor + modalities.taxaComodidade
```

**Exemplo de Matriz de Precos (Base):**

| Lote | 5km | 10km | 21km | Kids |
|------|-----|------|------|------|
| Promocional | R$ 69 | R$ 89 | R$ 129 | Gratis |
| 1o Lote | R$ 89 | R$ 109 | R$ 149 | R$ 30 |
| 2o Lote | R$ 109 | R$ 129 | R$ 179 | R$ 40 |

---

### 10. Arquivos Anexos (`attachments`)

Documentos do evento (regulamento, termos, etc.).

| Campo | Tipo | Descricao |
|-------|------|-----------|
| id | varchar (UUID) | Identificador unico |
| eventId | varchar | Referencia ao evento |
| nome | text | Nome exibido |
| url | text | Link do arquivo |
| obrigatorioAceitar | boolean | Exige aceite para inscrever |
| ordem | integer | Ordem de exibicao |

---

### 11. Atletas (`athletes`)

Cadastro de atletas/usuarios.

| Campo | Tipo | Descricao |
|-------|------|-----------|
| id | varchar (UUID) | Identificador unico |
| cpf | varchar(14) | CPF (unico) |
| nome | text | Nome completo |
| dataNascimento | date | Data de nascimento |
| sexo | varchar(20) | Genero |
| email | text | Email |
| telefone | varchar(20) | Telefone |
| estado | varchar(2) | UF |
| cidade | text | Cidade |
| escolaridade | text | Nivel de escolaridade |
| profissao | text | Profissao |
| dataCadastro | timestamp | Data de cadastro |

---

### 12. Pedidos (`orders`)

Agrupa uma ou mais inscricoes em um unico pedido de compra.

| Campo | Tipo | Descricao |
|-------|------|-----------|
| id | varchar (UUID) | Identificador unico |
| numeroPedido | integer | Numero do pedido |
| eventId | varchar | Referencia ao evento |
| compradorId | varchar | Atleta que realizou a compra |
| valorTotal | decimal | Valor total do pedido (inclui taxas) |
| valorDesconto | decimal | Valor de desconto aplicado |
| codigoVoucher | text | Codigo de voucher usado |
| status | enum | pendente, pago, cancelado, reembolsado, expirado |
| idPagamentoGateway | text | ID no gateway de pagamento |
| metodoPagamento | text | Metodo de pagamento (PIX, cartao, etc.) |
| dataPedido | timestamp | Data de criacao do pedido |
| dataPagamento | timestamp | Data da confirmacao do pagamento |
| dataExpiracao | timestamp | Data de expiracao do pedido |
| ipComprador | varchar(45) | IP do comprador |

**Regras de Negocio:**
- Um pedido pode conter varias inscricoes
- Inscricoes podem ser de atletas diferentes (ex: pai inscrevendo os filhos)
- Inscricoes podem ser do mesmo atleta em modalidades diferentes
- O pagamento e feito por pedido, nao por inscricao individual
- O valorTotal inclui preco base + taxa de comodidade de cada inscricao

---

### 13. Inscricoes (`registrations`)

Registro de cada inscricao individual, vinculada a um pedido.

| Campo | Tipo | Descricao |
|-------|------|-----------|
| id | varchar (UUID) | Identificador unico |
| numeroInscricao | integer | Numero da inscricao |
| orderId | varchar | Referencia ao pedido |
| eventId | varchar | Referencia ao evento |
| modalityId | varchar | Referencia a modalidade |
| batchId | varchar | Referencia ao lote |
| athleteId | varchar | Referencia ao atleta inscrito |
| tamanhoCamisa | varchar(10) | Tamanho escolhido |
| valorUnitario | decimal | Valor individual (preco + taxa) |
| status | enum | pendente, confirmada, cancelada |
| equipe | text | Nome da equipe |
| dataInscricao | timestamp | Data da inscricao |

---

### 14. Aceite de Documentos (`document_acceptances`)

Rastreia quais documentos cada atleta aceitou.

| Campo | Tipo | Descricao |
|-------|------|-----------|
| id | varchar (UUID) | Identificador unico |
| registrationId | varchar | Referencia a inscricao |
| attachmentId | varchar | Referencia ao documento |
| dataAceite | timestamp | Data/hora do aceite |
| ipAceite | varchar(45) | IP do aceite |

---

## Relacionamentos

```
Organizador (1) ──────< AdminUser (N)    [role=organizador vinculado]
      │
      └──────< Evento (N)
                   │
                   ├──< Modalidade (N)
                   │        │
                   │        ├── taxaComodidade (R$)
                   │        │
                   │        └──< Preco (N) >── Lote
                   │
                   ├──< Lote (N)
                   │
                   ├──< Grade de Camisas (N)
                   │    (global ou por modalidade)
                   │
                   ├──< Arquivo Anexo (N)
                   │
                   └──< Pedido (N)
                            │
                            └──< Inscricao (N) ──< Aceite de Documento (N)

Atleta (1) ──┬──< Pedido (N)           (como comprador)
             │
             └──< Inscricao (N)        (como atleta inscrito)

AdminUser (1) ──< RolePermission (N) ──> Permission (N)
```

**Fluxo de Inscricao:**
1. Atleta (comprador) cria um Pedido
2. Adiciona uma ou mais Inscricoes ao Pedido
3. Cada Inscricao pode ser para o proprio comprador ou outro atleta
4. Preco calculado: valor base do lote + taxa de comodidade da modalidade
5. Pagamento e feito no nivel do Pedido
6. Quando pago, todas as Inscricoes do Pedido sao confirmadas

---

## Regras de Negocio Implementadas

### 1. Controle de Estoque de Lotes

Quando uma inscricao e criada:
1. Verifica se o lote ainda tem vagas disponiveis
2. Se `quantidadeMaxima` foi atingida, lanca erro "Lote esgotado"
3. Apos validacao, incrementa `quantidadeUtilizada`

### 2. Controle de Estoque de Camisas

Quando uma inscricao com camisa e criada:
1. Verifica se o evento usa grade global ou por modalidade
2. Busca o tamanho correspondente
3. Se `quantidadeDisponivel <= 0`, lanca erro "Tamanho X esgotado"
4. Se tamanho nao encontrado, lanca erro
5. Apos validacao, decrementa `quantidadeDisponivel`

### 3. Calculo de Preco com Taxa

Ao calcular o valor de uma inscricao:
1. Busca o preco base na tabela `prices` (modalidade + lote ativo)
2. Busca a taxa de comodidade na tabela `modalities`
3. Soma: `valorUnitario = preco.valor + modalidade.taxaComodidade`

### 4. Validacao Atomica

A criacao de inscricao segue ordem especifica:
1. Valida disponibilidade do lote (sem modificar)
2. Valida disponibilidade da camisa (sem modificar)
3. Se qualquer validacao falhar, lanca erro antes de modificar dados
4. Somente apos todas validacoes, atualiza estoque do lote
5. Atualiza estoque da camisa
6. Cria o registro da inscricao

Isso garante que nao ha atualizacoes parciais em caso de erro.

---

## Arquivos do Projeto

| Arquivo | Descricao |
|---------|-----------|
| `shared/schema.ts` | Definicao das tabelas e tipos |
| `server/storage.ts` | Interface e implementacao de armazenamento |
| `drizzle.config.ts` | Configuracao do Drizzle ORM |

---

## Comandos Uteis

```bash
# Sincronizar schema com o banco
npm run db:push

# Iniciar aplicacao em desenvolvimento
npm run dev

# Build para producao
npm run build
```

---

## Historico de Alteracoes

| Data | Alteracao |
|------|-----------|
| 2025-11-26 | Adicionado sistema de usuarios administrativos (admin_users, permissions, role_permissions) |
| 2025-11-26 | Adicionado campo taxaComodidade na tabela modalities |
| 2025-11-26 | Documentacao de roles e permissoes (superadmin, admin, organizador) |
