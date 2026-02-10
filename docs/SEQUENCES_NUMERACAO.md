# Sequences de Numeração - Pedidos e Inscrições

## Problema

O sistema utiliza sequences do PostgreSQL para gerar números únicos e sequenciais para pedidos (`orders.numero_pedido`) e inscrições (`registrations.numero_inscricao`). Essas sequences precisam existir no banco de dados para o fluxo de inscrição funcionar.

### Erro Original

```
error: relation "order_number_seq" does not exist
```

Este erro ocorre quando as sequences `order_number_seq` e `registration_number_seq` não foram criadas no banco de dados. Sem elas, a função `nextval()` usada no INSERT de pedidos e inscrições falha.

## Solução

### Sequences Necessárias

| Sequence | Tabela | Coluna | Início |
|---|---|---|---|
| `order_number_seq` | `orders` | `numero_pedido` | 1000 |
| `registration_number_seq` | `registrations` | `numero_inscricao` | 1000 |

### SQL para Criar as Sequences

```sql
CREATE SEQUENCE IF NOT EXISTS order_number_seq START WITH 1000 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS registration_number_seq START WITH 1000 INCREMENT BY 1;
```

### Como Funciona

1. Quando uma inscrição é realizada, o sistema cria um **pedido** (order) e uma **inscrição** (registration) dentro de uma transação atômica.
2. O `numero_pedido` é gerado automaticamente via `nextval('order_number_seq')`.
3. O `numero_inscricao` é gerado automaticamente via `nextval('registration_number_seq')`.
4. Ambos começam em **1000** e incrementam de 1 em 1.
5. O PostgreSQL garante que os números são únicos mesmo com acessos concorrentes.

### Onde é Usado

- **`server/services/registration-service.ts`** → Função `registerForEventAtomic()`
  - Linha do INSERT de orders: `nextval('order_number_seq')`
  - Linha do INSERT de registrations: `nextval('registration_number_seq')`

### Verificação

Para verificar se as sequences existem:

```sql
SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public';
```

Para verificar o valor atual:

```sql
SELECT last_value FROM order_number_seq;
SELECT last_value FROM registration_number_seq;
```

### Ajustar o Valor Inicial

Se já existem registros no banco e você precisa que a sequence continue de onde parou:

```sql
-- Verificar o maior número existente
SELECT MAX(numero_pedido) FROM orders;
SELECT MAX(numero_inscricao) FROM registrations;

-- Ajustar a sequence para começar após o maior valor existente
SELECT setval('order_number_seq', (SELECT COALESCE(MAX(numero_pedido), 999) FROM orders));
SELECT setval('registration_number_seq', (SELECT COALESCE(MAX(numero_inscricao), 999) FROM registrations));
```

## Data da Correção

Fevereiro de 2026 - Sequences criadas com início em 1000 para manter numeração organizada e profissional.
