# Implementacao do Controle de Vagas Atomico

## Contexto
Portal de inscricao para eventos de corrida que precisa de uma camada robusta de controle de vagas para eventos com limite de inscritos. Cenario tipico: evento gratuito com 1000 vagas que acabam em menos de 3 minutos.

## Decisoes Tecnicas
- **Nao usar Redis** - resolver usando apenas Postgres + Node com transacao atomica
- **Lock de linha** - usar `SELECT ... FOR UPDATE` para travar apenas a linha do evento
- **Transacao curta** - apenas operacoes de banco dentro da transacao (sem emails, PDFs, etc.)
- **Abordagem escolhida**: Transacao pela camada Node (opcao B) usando o pool `pg` existente

### Justificativa da Abordagem B
- Maior flexibilidade para tratamento de erros
- Codigo mais explicito e debugavel
- Mantém a logica na aplicacao (mais facil de testar)
- O pool de conexoes ja esta configurado em `server/db.ts`

---

## Checklist de Implementacao

### 1. Ajustes no Schema do Banco
- [x] Adicionar campo `takenCount` (vagas_ocupadas) na tabela `events`
- [x] Criar UNIQUE constraint `(event_id, athlete_id)` na tabela `registrations`
- [x] Executar migracao com `npm run db:push`

### 2. Servico de Inscricao Atomica
- [x] Criar arquivo `server/services/registration-service.ts`
- [x] Implementar funcao `registerForEvent` com transacao atomica
- [x] Implementar SELECT FOR UPDATE para lock da linha do evento
- [x] Verificar capacidade dentro da transacao
- [x] Inserir inscricao e atualizar contador atomicamente
- [x] Tratar erros de constraint unique
- [x] Tratar erros de vagas esgotadas

### 3. Atualizar Rota de Inscricao
- [x] Modificar `server/routes/registrations.ts` para usar o novo servico
- [x] Manter endpoint enxuto (delegar logica ao servico)
- [x] Retornar mensagens de erro claras

### 4. Testes Automatizados
- [x] Criar arquivo de testes `server/__tests__/registration-service.test.ts`
- [x] Teste: Inscricao simples com vagas sobrando
- [x] Teste: Esgotamento exato de vagas
- [x] Teste: Tentativa apos esgotado
- [x] Teste: Concorrencia simulada (50-100 chamadas)
- [x] Teste: Usuario duplicado

### 5. Validacao Final
- [x] Verificar que transacao e curta (sem operacoes externas)
- [x] Revisar comentarios explicativos no codigo
- [x] Testar fluxo completo manualmente
- [x] Todos os 5 testes automatizados passando (inscricao, duplicata, vagas esgotadas, atomicidade, evento inexistente)

---

## Modelo de Dados Atualizado

### Tabela `events`
```sql
ALTER TABLE events ADD COLUMN vagas_ocupadas INTEGER DEFAULT 0 NOT NULL;
```

### Tabela `registrations`
```sql
ALTER TABLE registrations ADD CONSTRAINT unique_event_athlete 
  UNIQUE (event_id, athlete_id);
```

---

## Fluxo da Inscricao Atomica

```
1. Recebe requisicao de inscricao (event_id, athlete_id)
2. BEGIN TRANSACTION
3. SELECT capacity, takenCount FROM events WHERE id = ? FOR UPDATE
   (trava a linha do evento)
4. SE takenCount >= capacity:
   - ROLLBACK
   - Retorna "vagas esgotadas"
5. INSERT INTO registrations (...)
   (SE violar UNIQUE, retorna "ja inscrito")
6. UPDATE events SET takenCount = takenCount + 1 WHERE id = ?
7. COMMIT
8. Retorna sucesso
```

---

## Tratamento de Erros

| Erro | Codigo | Mensagem |
|------|--------|----------|
| Vagas esgotadas | 409 | "Inscricoes esgotadas para este evento" |
| Ja inscrito | 409 | "Voce ja possui inscricao neste evento" |
| Evento nao encontrado | 404 | "Evento nao encontrado" |
| Modalidade invalida | 400 | "Modalidade nao encontrada" |

---

## Melhorias Futuras (Fora do Escopo Atual)

1. **Redis para cache**: Verificar vagas disponíveis sem hit no banco
2. **Fila de jobs**: Enviar emails/PDFs apos commit via BullMQ ou similar
3. **Rate limiting**: Limitar requisicoes por IP durante picos
4. **Otimistic locking**: Usar versao do registro para detectar conflitos
