import { sql } from "drizzle-orm";
import { pgTable, text, varchar, date, integer, timestamp, boolean, decimal, pgEnum, unique, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const eventStatusEnum = pgEnum("event_status", ["rascunho", "publicado", "cancelado", "finalizado", "esgotado"]);
export const modalityAccessEnum = pgEnum("modality_access", ["gratuita", "paga", "voucher", "pcd", "aprovacao_manual"]);
export const registrationStatusEnum = pgEnum("registration_status", ["pendente", "confirmada", "cancelada"]);
export const orderStatusEnum = pgEnum("order_status", ["pendente", "pago", "cancelado", "reembolsado", "expirado"]);
export const userRoleEnum = pgEnum("user_role", ["superadmin", "admin", "organizador"]);
export const userStatusEnum = pgEnum("user_status", ["ativo", "inativo", "bloqueado"]);
export const batchStatusEnum = pgEnum("batch_status", ["active", "closed", "future"]);
export const statusEntityTypeEnum = pgEnum("status_entity_type", ["event", "order", "registration"]);
export const statusChangedByTypeEnum = pgEnum("status_changed_by_type", ["system", "admin", "athlete"]);

export const organizers = pgTable("organizers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  nome: text("nome").notNull(),
  cpfCnpj: varchar("cpf_cnpj", { length: 20 }).notNull().unique(),
  email: text("email").notNull(),
  telefone: varchar("telefone", { length: 20 }).notNull(),
  dataCadastro: timestamp("data_cadastro", { withTimezone: true }).defaultNow().notNull(),
});

export const adminUsers = pgTable("admin_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  nome: text("nome").notNull(),
  role: userRoleEnum("role").notNull(),
  status: userStatusEnum("status").default("ativo").notNull(),
  organizerId: varchar("organizer_id").references(() => organizers.id),
  ultimoLogin: timestamp("ultimo_login", { withTimezone: true }),
  dataCriacao: timestamp("data_criacao", { withTimezone: true }).defaultNow().notNull(),
  dataAtualizacao: timestamp("data_atualizacao", { withTimezone: true }).defaultNow().notNull(),
});

export const permissions = pgTable("permissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  codigo: varchar("codigo", { length: 100 }).notNull().unique(),
  nome: text("nome").notNull(),
  descricao: text("descricao"),
  modulo: varchar("modulo", { length: 50 }).notNull(),
});

export const rolePermissions = pgTable("role_permissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  role: userRoleEnum("role").notNull(),
  permissionId: varchar("permission_id").notNull().references(() => permissions.id),
});

export const events = pgTable("events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizerId: varchar("organizer_id").notNull().references(() => organizers.id),
  slug: text("slug").notNull().unique(),
  nome: text("nome").notNull(),
  descricao: text("descricao").notNull(),
  dataEvento: date("data_evento").notNull(),
  endereco: text("endereco").notNull(),
  cidade: text("cidade").notNull(),
  estado: varchar("estado", { length: 2 }).notNull(),
  bannerUrl: text("banner_url"),
  aberturaInscricoes: timestamp("abertura_inscricoes", { withTimezone: true }).notNull(),
  encerramentoInscricoes: timestamp("encerramento_inscricoes", { withTimezone: true }).notNull(),
  limiteVagasTotal: integer("limite_vagas_total").notNull(),
  vagasOcupadas: integer("vagas_ocupadas").default(0).notNull(),
  status: eventStatusEnum("status").default("rascunho").notNull(),
  entregaCamisaNoKit: boolean("entrega_camisa_no_kit").default(true).notNull(),
  usarGradePorModalidade: boolean("usar_grade_por_modalidade").default(false).notNull(),
  informacoesRetiradaKit: text("informacoes_retirada_kit"),
  imagemPercursoUrl: text("imagem_percurso_url"),
  idadeMinimaEvento: integer("idade_minima_evento").default(18).notNull(),
  permitirMultiplasModalidades: boolean("permitir_multiplas_modalidades").default(false).notNull(),
  dataCriacao: timestamp("data_criacao", { withTimezone: true }).defaultNow().notNull(),
});

export const modalities = pgTable("modalities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").notNull().references(() => events.id),
  nome: text("nome").notNull(),
  distancia: decimal("distancia", { precision: 10, scale: 2 }).notNull(),
  unidadeDistancia: varchar("unidade_distancia", { length: 10 }).default("km").notNull(),
  horarioLargada: text("horario_largada").notNull(),
  descricao: text("descricao"),
  imagemUrl: text("imagem_url"),
  mapaPercursoUrl: text("mapa_percurso_url"),
  linksPercurso: jsonb("links_percurso").$type<Array<{ nome: string; url: string }>>(),
  limiteVagas: integer("limite_vagas"),
  vagasOcupadas: integer("vagas_ocupadas").default(0).notNull(),
  tipoAcesso: modalityAccessEnum("tipo_acesso").default("paga").notNull(),
  taxaComodidade: decimal("taxa_comodidade", { precision: 10, scale: 2 }).default("0").notNull(),
  idadeMinima: integer("idade_minima"),
  ordem: integer("ordem").default(0).notNull(),
  ativo: boolean("ativo").default(true).notNull(),
});

export const shirtSizes = pgTable("shirt_sizes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").notNull().references(() => events.id),
  modalityId: varchar("modality_id").references(() => modalities.id),
  tamanho: varchar("tamanho", { length: 50 }).notNull(),
  quantidadeTotal: integer("quantidade_total").notNull(),
  quantidadeDisponivel: integer("quantidade_disponivel").notNull(),
  ajustePreco: decimal("ajuste_preco", { precision: 10, scale: 2 }).default("0").notNull(),
});

export const registrationBatches = pgTable("registration_batches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").notNull().references(() => events.id),
  modalityId: varchar("modality_id").references(() => modalities.id),
  nome: text("nome").notNull(),
  dataInicio: timestamp("data_inicio", { withTimezone: true }).notNull(),
  dataTermino: timestamp("data_termino", { withTimezone: true }),
  quantidadeMaxima: integer("quantidade_maxima"),
  quantidadeUtilizada: integer("quantidade_utilizada").default(0).notNull(),
  ativo: boolean("ativo").default(true).notNull(),
  status: batchStatusEnum("status").default("future").notNull(),
  precoCentavos: integer("preco_centavos"),
  ordem: integer("ordem").default(0).notNull(),
});

export const prices = pgTable("prices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  modalityId: varchar("modality_id").notNull().references(() => modalities.id),
  batchId: varchar("batch_id").notNull().references(() => registrationBatches.id),
  valor: decimal("valor", { precision: 10, scale: 2 }).notNull(),
  dataCriacao: timestamp("data_criacao", { withTimezone: true }).defaultNow().notNull(),
});

export const attachments = pgTable("attachments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").notNull().references(() => events.id),
  nome: text("nome").notNull(),
  url: text("url").notNull(),
  obrigatorioAceitar: boolean("obrigatorio_aceitar").default(false).notNull(),
  ordem: integer("ordem").default(0).notNull(),
});

export const eventBanners = pgTable("event_banners", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").notNull().references(() => events.id),
  imagemUrl: text("imagem_url").notNull(),
  ordem: integer("ordem").default(0).notNull(),
  dataCriacao: timestamp("data_criacao", { withTimezone: true }).defaultNow().notNull(),
});

export const athletes = pgTable("athletes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  cpf: varchar("cpf", { length: 14 }).notNull().unique(),
  nome: text("nome").notNull(),
  dataNascimento: date("data_nascimento").notNull(),
  sexo: varchar("sexo", { length: 20 }).notNull(),
  email: text("email").notNull().unique(),
  telefone: varchar("telefone", { length: 20 }).notNull(),
  estado: varchar("estado", { length: 2 }).notNull(),
  cidade: text("cidade").notNull(),
  cep: varchar("cep", { length: 9 }),
  rua: text("rua"),
  numero: varchar("numero", { length: 20 }),
  complemento: text("complemento"),
  escolaridade: text("escolaridade"),
  profissao: text("profissao"),
  dataCadastro: timestamp("data_cadastro", { withTimezone: true }).defaultNow().notNull(),
});

export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  numeroPedido: integer("numero_pedido").notNull().unique(),
  eventId: varchar("event_id").notNull().references(() => events.id),
  compradorId: varchar("comprador_id").notNull().references(() => athletes.id),
  valorTotal: decimal("valor_total", { precision: 10, scale: 2 }).notNull(),
  valorDesconto: decimal("valor_desconto", { precision: 10, scale: 2 }).default("0").notNull(),
  codigoVoucher: text("codigo_voucher"),
  codigoCupom: text("codigo_cupom"),
  cupomId: varchar("cupom_id"),
  status: orderStatusEnum("status").default("pendente").notNull(),
  idPagamentoGateway: text("id_pagamento_gateway"),
  metodoPagamento: text("metodo_pagamento"),
  dataPedido: timestamp("data_pedido", { withTimezone: true }).defaultNow().notNull(),
  dataPagamento: timestamp("data_pagamento", { withTimezone: true }),
  dataExpiracao: timestamp("data_expiracao", { withTimezone: true }),
  ipComprador: varchar("ip_comprador", { length: 45 }),
  pixQrCode: text("pix_qr_code"),
  pixQrCodeBase64: text("pix_qr_code_base64"),
  pixExpiracao: timestamp("pix_expiracao", { withTimezone: true }),
  pixDataGeracao: timestamp("pix_data_geracao", { withTimezone: true }),
  pixPaymentId: text("pix_payment_id"), // ID do pagamento PIX separado do idPagamentoGateway
});

export const registrations = pgTable("registrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  numeroInscricao: integer("numero_inscricao").notNull().unique(),
  orderId: varchar("order_id").notNull().references(() => orders.id),
  eventId: varchar("event_id").notNull().references(() => events.id),
  modalityId: varchar("modality_id").notNull().references(() => modalities.id),
  batchId: varchar("batch_id").notNull().references(() => registrationBatches.id),
  athleteId: varchar("athlete_id").notNull().references(() => athletes.id),
  tamanhoCamisa: varchar("tamanho_camisa", { length: 50 }),
  valorUnitario: decimal("valor_unitario", { precision: 10, scale: 2 }).notNull(),
  taxaComodidade: decimal("taxa_comodidade", { precision: 10, scale: 2 }).default("0").notNull(),
  status: registrationStatusEnum("status").default("pendente").notNull(),
  equipe: text("equipe"),
  nomeCompleto: text("nome_completo"),
  cpf: varchar("cpf", { length: 14 }),
  dataNascimento: date("data_nascimento"),
  sexo: varchar("sexo", { length: 20 }),
  dataInscricao: timestamp("data_inscricao", { withTimezone: true }).defaultNow().notNull(),
});

export const documentAcceptances = pgTable("document_acceptances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  registrationId: varchar("registration_id").notNull().references(() => registrations.id),
  attachmentId: varchar("attachment_id").notNull().references(() => attachments.id),
  dataAceite: timestamp("data_aceite", { withTimezone: true }).defaultNow().notNull(),
  ipAceite: varchar("ip_aceite", { length: 45 }),
});

// Enums para vouchers e cupons
export const voucherStatusEnum = pgEnum("voucher_status", ["available", "used", "expired"]);
export const couponTypeEnum = pgEnum("coupon_type", ["percentage", "fixed", "full"]);

// Tabela de lotes de vouchers
export const eventVoucherBatches = pgTable("event_voucher_batches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").notNull().references(() => events.id),
  nome: text("nome").notNull(),
  quantidade: integer("quantidade").notNull(),
  validFrom: timestamp("valid_from", { withTimezone: true }).notNull(),
  validUntil: timestamp("valid_until", { withTimezone: true }).notNull(),
  descricao: text("descricao"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: varchar("created_by").references(() => adminUsers.id),
});

// Tabela de vouchers
export const eventVouchers = pgTable("event_vouchers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").notNull().references(() => events.id),
  batchId: varchar("batch_id").references(() => eventVoucherBatches.id),
  code: varchar("code", { length: 20 }).notNull(),
  status: voucherStatusEnum("status").default("available").notNull(),
  validFrom: timestamp("valid_from", { withTimezone: true }).notNull(),
  validUntil: timestamp("valid_until", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  uniqueCodePerEvent: unique("unique_voucher_code_event").on(table.eventId, table.code),
}));

// Tabela de auditoria de uso de vouchers
export const voucherUsages = pgTable("voucher_usages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  voucherId: varchar("voucher_id").notNull().references(() => eventVouchers.id),
  userId: varchar("user_id").notNull().references(() => athletes.id),
  registrationId: varchar("registration_id").references(() => registrations.id),
  usedAt: timestamp("used_at", { withTimezone: true }).defaultNow().notNull(),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
});

// Tabela de cupons de desconto
export const eventCoupons = pgTable("event_coupons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").notNull().references(() => events.id),
  code: varchar("code", { length: 50 }).notNull(),
  discountType: couponTypeEnum("discount_type").notNull(),
  discountValue: decimal("discount_value", { precision: 10, scale: 2 }),
  maxUses: integer("max_uses"),
  maxUsesPerUser: integer("max_uses_per_user").default(1).notNull(),
  currentUses: integer("current_uses").default(0).notNull(),
  validFrom: timestamp("valid_from", { withTimezone: true }).notNull(),
  validUntil: timestamp("valid_until", { withTimezone: true }).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  uniqueCouponPerEvent: unique("unique_coupon_code_event").on(table.eventId, table.code),
}));

// Tabela de auditoria de uso de cupons
export const couponUsages = pgTable("coupon_usages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  couponId: varchar("coupon_id").notNull().references(() => eventCoupons.id),
  userId: varchar("user_id").notNull().references(() => athletes.id),
  orderId: varchar("order_id").references(() => orders.id),
  discountApplied: decimal("discount_applied", { precision: 10, scale: 2 }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertOrganizerSchema = createInsertSchema(organizers).omit({ id: true, dataCadastro: true });
export const insertAdminUserSchema = createInsertSchema(adminUsers).omit({ id: true, dataCriacao: true, dataAtualizacao: true, ultimoLogin: true });
export const insertPermissionSchema = createInsertSchema(permissions).omit({ id: true });
export const insertRolePermissionSchema = createInsertSchema(rolePermissions).omit({ id: true });
export const insertEventSchema = createInsertSchema(events).omit({ id: true, dataCriacao: true });
export const insertModalitySchema = createInsertSchema(modalities).omit({ id: true });
export const insertShirtSizeSchema = createInsertSchema(shirtSizes).omit({ id: true });
export const insertRegistrationBatchSchema = createInsertSchema(registrationBatches).omit({ id: true });
export const insertPriceSchema = createInsertSchema(prices).omit({ id: true, dataCriacao: true });
export const insertAttachmentSchema = createInsertSchema(attachments).omit({ id: true });
export const insertEventBannerSchema = createInsertSchema(eventBanners).omit({ id: true, dataCriacao: true });
export const insertAthleteSchema = createInsertSchema(athletes).omit({ id: true, dataCadastro: true });
export const insertOrderSchema = createInsertSchema(orders).omit({ id: true, dataPedido: true });
export const insertRegistrationSchema = createInsertSchema(registrations).omit({ id: true, dataInscricao: true });
export const insertDocumentAcceptanceSchema = createInsertSchema(documentAcceptances).omit({ id: true, dataAceite: true });

// Schemas de inserção para vouchers e cupons
export const insertEventVoucherBatchSchema = createInsertSchema(eventVoucherBatches).omit({ id: true, createdAt: true });
export const insertEventVoucherSchema = createInsertSchema(eventVouchers).omit({ id: true, createdAt: true });
export const insertVoucherUsageSchema = createInsertSchema(voucherUsages).omit({ id: true, usedAt: true });
export const insertEventCouponSchema = createInsertSchema(eventCoupons).omit({ id: true, createdAt: true, currentUses: true });
export const insertCouponUsageSchema = createInsertSchema(couponUsages).omit({ id: true, usedAt: true });

export type InsertOrganizer = z.infer<typeof insertOrganizerSchema>;
export type Organizer = typeof organizers.$inferSelect;

export type InsertAdminUser = z.infer<typeof insertAdminUserSchema>;
export type AdminUser = typeof adminUsers.$inferSelect;

export type InsertPermission = z.infer<typeof insertPermissionSchema>;
export type Permission = typeof permissions.$inferSelect;

export type InsertRolePermission = z.infer<typeof insertRolePermissionSchema>;
export type RolePermission = typeof rolePermissions.$inferSelect;

export type UserRole = "superadmin" | "admin" | "organizador";
export type UserStatus = "ativo" | "inativo" | "bloqueado";

export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof events.$inferSelect;

export type InsertModality = z.infer<typeof insertModalitySchema>;
export type Modality = typeof modalities.$inferSelect;

export type InsertShirtSize = z.infer<typeof insertShirtSizeSchema>;
export type ShirtSize = typeof shirtSizes.$inferSelect;

export type InsertRegistrationBatch = z.infer<typeof insertRegistrationBatchSchema>;
export type RegistrationBatch = typeof registrationBatches.$inferSelect;

export type InsertPrice = z.infer<typeof insertPriceSchema>;
export type Price = typeof prices.$inferSelect;

export type InsertAttachment = z.infer<typeof insertAttachmentSchema>;
export type Attachment = typeof attachments.$inferSelect;

export type InsertEventBanner = z.infer<typeof insertEventBannerSchema>;
export type EventBanner = typeof eventBanners.$inferSelect;

export type InsertAthlete = z.infer<typeof insertAthleteSchema>;
export type Athlete = typeof athletes.$inferSelect;

export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;

export type InsertRegistration = z.infer<typeof insertRegistrationSchema>;
export type Registration = typeof registrations.$inferSelect;

export type InsertDocumentAcceptance = z.infer<typeof insertDocumentAcceptanceSchema>;
export type DocumentAcceptance = typeof documentAcceptances.$inferSelect;

// Types para vouchers e cupons
export type InsertEventVoucherBatch = z.infer<typeof insertEventVoucherBatchSchema>;
export type EventVoucherBatch = typeof eventVoucherBatches.$inferSelect;

export type InsertEventVoucher = z.infer<typeof insertEventVoucherSchema>;
export type EventVoucher = typeof eventVouchers.$inferSelect;

export type InsertVoucherUsage = z.infer<typeof insertVoucherUsageSchema>;
export type VoucherUsage = typeof voucherUsages.$inferSelect;

export type InsertEventCoupon = z.infer<typeof insertEventCouponSchema>;
export type EventCoupon = typeof eventCoupons.$inferSelect;

export type InsertCouponUsage = z.infer<typeof insertCouponUsageSchema>;
export type CouponUsage = typeof couponUsages.$inferSelect;

export type VoucherStatus = "available" | "used" | "expired";
export type CouponType = "percentage" | "fixed" | "full";

// Status Change Logs - Audit trail for status changes
export const statusChangeLogs = pgTable("status_change_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  entityType: statusEntityTypeEnum("entity_type").notNull(),
  entityId: varchar("entity_id").notNull(),
  oldStatus: text("old_status"),
  newStatus: text("new_status").notNull(),
  reason: text("reason").notNull(),
  changedByType: statusChangedByTypeEnum("changed_by_type").notNull(),
  changedById: varchar("changed_by_id"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertStatusChangeLogSchema = createInsertSchema(statusChangeLogs).omit({ id: true, createdAt: true });
export type InsertStatusChangeLog = z.infer<typeof insertStatusChangeLogSchema>;
export type StatusChangeLog = typeof statusChangeLogs.$inferSelect;
