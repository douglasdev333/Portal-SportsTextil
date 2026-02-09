# Gerenciamento de Lotes na Criacao e Edicao de Eventos

## Resumo das Mudancas

Este documento descreve as atualizacoes feitas na secao de lotes dentro das telas de criacao e edicao de eventos para alinhar com o modelo correto de gerenciamento de lotes.

---

## Modelo de Dados

### Campos Principais

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `status` | `'active' \| 'closed' \| 'future'` | Regra de negocio que define se o lote aceita inscricoes |
| `ativo` | `boolean` | Controla apenas a visibilidade para atletas |
| `ordem` | `integer` | Define a ordem de ativacao automatica dos lotes |

### Separacao de Conceitos

- **Status**: Define a logica de negocio
  - `active`: Lote recebendo inscricoes (apenas 1 por evento)
  - `closed`: Lote fechado, nao aceita mais inscricoes
  - `future`: Lote aguardando ativacao

- **Ativo (Visibilidade)**: Controla se o atleta ve o lote
  - `true`: Lote visivel para atletas
  - `false`: Lote oculto (mas pode estar ativo internamente)

---

## Fluxo de Acoes

### 1. Ativar Lote
- **Acao**: Clica no botao "Ativar Lote" no menu de acoes
- **Resultado**: 
  - `status = 'active'`
  - `ativo = true`
  - Outros lotes ativos sao fechados automaticamente (`status = 'closed'`)

### 2. Fechar Lote
- **Acao**: Clica no botao "Fechar Lote" no menu de acoes
- **Resultado**: 
  - `status = 'closed'`
  - Campo `ativo` nao e alterado

### 3. Marcar como Futuro
- **Acao**: Clica no botao "Marcar como Futuro" no menu de acoes
- **Restricao**: Nao disponivel para lotes ativos (feche primeiro)
- **Resultado**: 
  - `status = 'future'`

### 4. Alternar Visibilidade
- **Acao**: Clica no botao "Ocultar/Tornar Visivel" no menu de acoes
- **Resultado**: 
  - Alterna o valor de `ativo` (true/false)
  - Nao afeta o `status`

---

## Interface do Usuario

### Badges Exibidos por Lote

| Badge | Condicao | Cor |
|-------|----------|-----|
| Ativo | `status === 'active'` | Primaria (azul) |
| Fechado | `status === 'closed'` | Destrutiva (vermelha) |
| Futuro | `status === 'future'` | Secundaria (cinza) |
| Visivel | `ativo === true` | Outline |
| Oculto | `ativo === false` | Outline (cinza) |
| Lotado | `quantidadeUtilizada >= quantidadeMaxima` | Destrutiva |
| Expirado | `dataTermino < agora` | Secundaria |

### Menu de Acoes

O menu dropdown de cada lote inclui:
1. **Ativar Lote** (se nao estiver ativo)
2. **Fechar Lote** (se estiver ativo)
3. **Marcar como Futuro** (se estiver fechado)
4. **Alternar Visibilidade**
5. **Editar Configuracao**
6. **Excluir Lote** (desabilitado se tiver inscricoes)

---

## Modal de Edicao

### Campos Editaveis
- Nome do lote
- Data de inicio
- Data de termino
- Quantidade maxima
- **Ordem de ativacao (order_index)**

### Campos NAO Editaveis no Modal
- Status (gerenciado pelos botoes de acao)
- Ativo/Visibilidade (gerenciado pelos botoes de acao)

### Validacao de Ordem (order_index)
- Deve ser um numero inteiro >= 1
- Nao pode ser vazio
- Nao pode ser duplicado com outro lote do mesmo evento
- Erro amigavel exibido em caso de duplicidade

---

## Criacao de Novos Lotes

Ao criar um novo lote:
- `status` padrao: `'future'`
- `ativo` padrao: `true`
- `ordem` padrao: `MAX(ordem) + 1` do evento

---

## Ordenacao

Os lotes sao exibidos ordenados pelo campo `ordem` (order_index), do menor para o maior.

---

## Testes Recomendados

### Teste 1 - Alteracao de Ordem
1. Criar evento com 3 lotes (L1=ordem 1, L2=ordem 2, L3=ordem 3)
2. Editar L3 e mudar para ordem 1
3. Verificar erro de duplicidade
4. Alterar L1 para ordem 4 primeiro, depois L3 para ordem 1
5. Verificar que a ordenacao na UI respeita a nova ordem

### Teste 2 - Ativar Lote
1. Criar lote e ativa-lo
2. Verificar `status='active'` e `ativo=true`
3. Criar outro lote e ativa-lo
4. Confirmar que o primeiro foi fechado (`status='closed'`)

### Teste 3 - Visibilidade
1. Ocultar lote ativo
2. Verificar que `ativo=false` mas `status='active'`
3. Lote continua funcionando internamente

### Teste 4 - Consistencia
Todas as acoes da tela de criacao/edicao devem produzir os mesmos resultados que o gerenciador de lotes do evento.

---

## Arquivos Modificados

- `client/src/pages/admin/events/steps/EventBatchesStep.tsx` - Componente principal atualizado

## Referencias

- `docs/lotes-status-e-visibilidade.md` - Documentacao do modelo de lotes
- `server/routes/admin/batches.ts` - Rotas de backend para lotes
