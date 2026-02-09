# Correção dos Cálculos Financeiros

## Conceitos Financeiros Corretos

| Campo | Descrição | Fórmula |
|-------|-----------|---------|
| **Valor Bruto** | Valor original das inscrições (sem desconto, sem taxa) | Soma de `valorUnitario` das inscrições confirmadas |
| **Desconto** | Valor descontado via cupons/vouchers | Soma de `valorDesconto` dos pedidos pagos |
| **Taxa de Comodidade** | Taxa cobrada do cliente (fica com o portal) | Soma de `taxaComodidade` das inscrições confirmadas |
| **Valor Líquido** | Valor que vai para o organizador | `Bruto - Desconto - Taxa` |

## Fluxo do Dinheiro

```
Valor Bruto (R$ 100)
    │
    ├── (-) Desconto (R$ 10)     → Benefício ao cliente
    │
    ├── (-) Taxa (R$ 5)          → Fica com o portal
    │
    └── (=) Valor Líquido (R$ 85) → Vai para o organizador
```

## Alterações no Backend

### Arquivo: `server/routes/admin/eventStats.ts`

**Cálculos corretos:**
```typescript
const paidOrders = orders.filter(o => o.status === "pago");
const totalDescontos = paidOrders.reduce((sum, o) => sum + safeNumber(o.valorDesconto), 0);
const totalTaxaComodidade = confirmedRegistrations.reduce((sum, r) => sum + safeNumber(r.taxaComodidade), 0);
const totalBruto = confirmedRegistrations.reduce((sum, r) => sum + safeNumber(r.valorUnitario), 0);
const totalLiquido = totalBruto - totalDescontos - totalTaxaComodidade;

// Resposta da API
faturamento: {
  bruto: totalBruto,           // Valor original das inscrições
  descontos: totalDescontos,   // Valor descontado
  taxaComodidade: totalTaxaComodidade,  // Taxa do portal
  liquido: totalLiquido        // Bruto - Desconto - Taxa (organizador)
}
```

## Alterações no Frontend

### Interface TypeScript

```typescript
faturamento: {
  bruto: number;
  descontos: number;
  taxaComodidade: number;
  liquido: number;
};
```

### Exibição na Tela (Resumo Financeiro)

**Ordem correta de exibição:**
1. Valor Bruto
2. (-) Descontos (em vermelho)
3. (-) Taxa de Comodidade (em laranja)
4. Valor Líquido (Organizador) (em verde, destacado)

**Exemplo de código:**
```tsx
<div className="flex justify-between items-center">
  <span>Valor Bruto</span>
  <span>{formatCurrency(stats?.faturamento.bruto || 0)}</span>
</div>
<div className="flex justify-between items-center">
  <span>Descontos</span>
  <span className="text-red-600">-{formatCurrency(stats?.faturamento.descontos || 0)}</span>
</div>
<div className="flex justify-between items-center">
  <span>Taxa de Comodidade</span>
  <span className="text-orange-600">-{formatCurrency(stats?.faturamento.taxaComodidade || 0)}</span>
</div>
<div className="border-t pt-4 flex justify-between items-center">
  <span className="font-semibold">Valor Líquido (Organizador)</span>
  <span className="text-green-600 font-bold">{formatCurrency(stats?.faturamento.liquido || 0)}</span>
</div>
```

## Tabelas de Relatórios (Pedidos/Inscritos)

### Colunas para Exibição

| Coluna | Descrição | Cor |
|--------|-----------|-----|
| Bruto | `valorUnitario` ou `subtotal` | Normal |
| Desconto | `valorDesconto` | Vermelho |
| Taxa | `taxaComodidade` | Laranja |
| Líquido | `Bruto - Desconto - Taxa` | Verde |

### Cálculo nas Linhas da Tabela

```tsx
{orders.map((order) => {
  const valorBruto = safeNumber(order.subtotal);
  const valorDesconto = safeNumber(order.valorDesconto);
  const taxaComodidade = safeNumber(order.taxaComodidade);
  const valorLiquido = valorBruto - valorDesconto - taxaComodidade;
  
  return (
    <TableRow>
      <TableCell>{formatCurrency(valorBruto)}</TableCell>
      <TableCell className="text-red-600">
        {valorDesconto > 0 ? `-${formatCurrency(valorDesconto)}` : "-"}
      </TableCell>
      <TableCell className="text-orange-600">
        {taxaComodidade > 0 ? `-${formatCurrency(taxaComodidade)}` : "-"}
      </TableCell>
      <TableCell className="text-green-600 font-medium">{formatCurrency(valorLiquido)}</TableCell>
    </TableRow>
  );
})}
```

### Linha de Totais (apenas pagos/confirmados)

```tsx
const paidOrders = orders.filter(o => o.status === "pago");
const totals = {
  bruto: paidOrders.reduce((sum, o) => sum + safeNumber(o.subtotal), 0),
  desconto: paidOrders.reduce((sum, o) => sum + safeNumber(o.valorDesconto), 0),
  taxa: paidOrders.reduce((sum, o) => sum + safeNumber(o.taxaComodidade), 0),
};
const liquido = totals.bruto - totals.desconto - totals.taxa;
```

## Exportação Excel

### Valores Numéricos (não texto)

```typescript
// Helper para converter valor para número
const safeNumber = (val: any): number => {
  const num = parseFloat(val);
  return isNaN(num) ? 0 : num;
};

// Usar valores numéricos na planilha
worksheet.addRow({
  valorBruto: safeNumber(order.subtotal),
  desconto: safeNumber(order.valorDesconto),
  taxa: safeNumber(order.taxaComodidade),
  valorLiquido: valorLiquido  // Bruto - Desconto - Taxa
});

// Formatar colunas como moeda
worksheet.getColumn('valorBruto').numFmt = 'R$ #,##0.00';
```

## Arquivos Afetados

- `server/routes/admin/eventStats.ts` - Cálculos do backend
- `client/src/pages/admin/AdminEventManagePage.tsx` - Resumo financeiro do admin
- `client/src/pages/admin/AdminEventPedidosPage.tsx` - Tabela de pedidos do admin
- `client/src/pages/admin/AdminEventInscritosPage.tsx` - Tabela de inscritos do admin
- `client/src/pages/organizador/OrganizerEventDashboardPage.tsx` - Dashboard do organizador
- `client/src/pages/organizador/OrganizerEventPedidosPage.tsx` - Tabela de pedidos do organizador
- `client/src/pages/organizador/OrganizerEventInscritosPage.tsx` - Tabela de inscritos do organizador

## Resumo das Fórmulas

```
Valor Bruto = Soma(valorUnitario) das inscrições confirmadas
Desconto = Soma(valorDesconto) dos pedidos pagos
Taxa = Soma(taxaComodidade) das inscrições confirmadas
Valor Líquido = Bruto - Desconto - Taxa
```
