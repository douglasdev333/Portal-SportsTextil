import {
  type Organizer, type InsertOrganizer,
  type AdminUser, type InsertAdminUser,
  type Event, type InsertEvent,
  type Modality, type InsertModality,
  type ShirtSize, type InsertShirtSize,
  type RegistrationBatch, type InsertRegistrationBatch,
  type Price, type InsertPrice,
  type Attachment, type InsertAttachment,
  type EventBanner, type InsertEventBanner,
  type Athlete, type InsertAthlete,
  type Order, type InsertOrder,
  type Registration, type InsertRegistration,
  type DocumentAcceptance, type InsertDocumentAcceptance,
  type EventVoucherBatch, type InsertEventVoucherBatch,
  type EventVoucher, type InsertEventVoucher,
  type VoucherUsage, type InsertVoucherUsage,
  type EventCoupon, type InsertEventCoupon,
  type CouponUsage, type InsertCouponUsage,
  organizers, adminUsers, events, modalities, shirtSizes,
  registrationBatches, prices, attachments, eventBanners, athletes, orders,
  registrations, documentAcceptances,
  eventVoucherBatches, eventVouchers, voucherUsages, eventCoupons, couponUsages
} from "@shared/schema";
import { db, pool } from "./db";
import { eq, and, isNull, isNotNull, lte, lt, gt, sql, max } from "drizzle-orm";

export interface IStorage {
  getAdminUser(id: string): Promise<AdminUser | undefined>;
  getAdminUserByEmail(email: string): Promise<AdminUser | undefined>;
  getAdminUsers(): Promise<AdminUser[]>;
  createAdminUser(user: InsertAdminUser): Promise<AdminUser>;
  updateAdminUser(id: string, user: Partial<InsertAdminUser>): Promise<AdminUser | undefined>;
  deleteAdminUser(id: string): Promise<boolean>;
  updateAdminUserLastLogin(id: string): Promise<void>;
  getAdminUsersByOrganizer(organizerId: string): Promise<AdminUser[]>;

  getOrganizer(id: string): Promise<Organizer | undefined>;
  getOrganizerByCpfCnpj(cpfCnpj: string): Promise<Organizer | undefined>;
  getOrganizers(): Promise<Organizer[]>;
  createOrganizer(organizer: InsertOrganizer): Promise<Organizer>;
  updateOrganizer(id: string, organizer: Partial<InsertOrganizer>): Promise<Organizer | undefined>;
  deleteOrganizer(id: string): Promise<boolean>;

  getEvent(id: string): Promise<Event | undefined>;
  getEventBySlug(slug: string): Promise<Event | undefined>;
  getEvents(): Promise<Event[]>;
  getEventsByOrganizer(organizerId: string): Promise<Event[]>;
  createEvent(event: InsertEvent): Promise<Event>;
  updateEvent(id: string, event: Partial<InsertEvent>): Promise<Event | undefined>;
  deleteEvent(id: string): Promise<boolean>;

  getModality(id: string): Promise<Modality | undefined>;
  getModalitiesByEvent(eventId: string): Promise<Modality[]>;
  createModality(modality: InsertModality): Promise<Modality>;
  updateModality(id: string, modality: Partial<InsertModality>): Promise<Modality | undefined>;
  deleteModality(id: string): Promise<boolean>;

  getShirtSize(id: string): Promise<ShirtSize | undefined>;
  getShirtSizesByEvent(eventId: string): Promise<ShirtSize[]>;
  getShirtSizesByModality(modalityId: string): Promise<ShirtSize[]>;
  createShirtSize(shirtSize: InsertShirtSize): Promise<ShirtSize>;
  updateShirtSize(id: string, shirtSize: Partial<InsertShirtSize>): Promise<ShirtSize | undefined>;
  deleteShirtSize(id: string): Promise<boolean>;
  decrementShirtSize(id: string): Promise<boolean>;

  getBatch(id: string): Promise<RegistrationBatch | undefined>;
  getBatchesByEvent(eventId: string): Promise<RegistrationBatch[]>;
  getActiveBatch(eventId: string): Promise<RegistrationBatch | undefined>;
  getMaxBatchOrder(eventId: string): Promise<number>;
  checkBatchOrderExists(eventId: string, ordem: number, excludeBatchId?: string): Promise<boolean>;
  createBatch(batch: InsertRegistrationBatch): Promise<RegistrationBatch>;
  updateBatch(id: string, batch: Partial<InsertRegistrationBatch>): Promise<RegistrationBatch | undefined>;
  deleteBatch(id: string): Promise<boolean>;
  deleteBatchSafe(id: string): Promise<{ success: boolean; code?: string; message?: string }>;
  getRegistrationsByBatch(batchId: string): Promise<Registration[]>;
  deletePricesByBatch(batchId: string): Promise<boolean>;

  getPrice(modalityId: string, batchId: string): Promise<Price | undefined>;
  getPriceById(id: string): Promise<Price | undefined>;
  getPricesByModality(modalityId: string): Promise<Price[]>;
  getPricesByBatch(batchId: string): Promise<Price[]>;
  getPricesByEvent(eventId: string): Promise<Price[]>;
  createPrice(price: InsertPrice): Promise<Price>;
  updatePrice(id: string, price: Partial<InsertPrice>): Promise<Price | undefined>;
  deletePrice(id: string): Promise<boolean>;

  getAttachment(id: string): Promise<Attachment | undefined>;
  getAttachmentsByEvent(eventId: string): Promise<Attachment[]>;
  createAttachment(attachment: InsertAttachment): Promise<Attachment>;
  updateAttachment(id: string, attachment: Partial<InsertAttachment>): Promise<Attachment | undefined>;
  deleteAttachment(id: string): Promise<boolean>;

  getEventBanner(id: string): Promise<EventBanner | undefined>;
  getEventBannersByEvent(eventId: string): Promise<EventBanner[]>;
  createEventBanner(banner: InsertEventBanner): Promise<EventBanner>;
  updateEventBanner(id: string, banner: Partial<InsertEventBanner>): Promise<EventBanner | undefined>;
  deleteEventBanner(id: string): Promise<boolean>;
  deleteEventBannersByEvent(eventId: string): Promise<boolean>;

  getAthlete(id: string): Promise<Athlete | undefined>;
  getAthletes(): Promise<Athlete[]>;
  getAthleteByCpf(cpf: string): Promise<Athlete | undefined>;
  getAthleteByEmail(email: string): Promise<Athlete | undefined>;
  createAthlete(athlete: InsertAthlete): Promise<Athlete>;
  updateAthlete(id: string, athlete: Partial<InsertAthlete>): Promise<Athlete | undefined>;

  getOrder(id: string): Promise<Order | undefined>;
  getOrdersByEvent(eventId: string): Promise<Order[]>;
  getOrdersByBuyer(buyerId: string): Promise<Order[]>;
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrder(id: string, order: Partial<InsertOrder>): Promise<Order | undefined>;
  updateOrderPaymentId(orderId: string, paymentId: string, paymentMethod: string): Promise<void>;
  updateOrderPixData(orderId: string, pixData: { qrCode: string; qrCodeBase64: string; expiracao: Date; paymentId?: string }): Promise<void>;
  clearOrderPixData(orderId: string): Promise<void>;
  confirmOrderPayment(orderId: string, paymentId: string): Promise<void>;
  getPendingOrdersWithPayment(): Promise<Order[]>;
  getExpiredPendingOrders(): Promise<Order[]>;
  getOrdersByPaymentId(paymentId: string): Promise<Order | undefined>;
  getNextOrderNumber(): Promise<number>;

  getRegistration(id: string): Promise<Registration | undefined>;
  getRegistrationsByEvent(eventId: string): Promise<Registration[]>;
  getRegistrationsByAthlete(athleteId: string): Promise<Registration[]>;
  getRegistrationsByOrder(orderId: string): Promise<Registration[]>;
  createRegistration(registration: InsertRegistration): Promise<Registration>;
  updateRegistration(id: string, registration: Partial<InsertRegistration>): Promise<Registration | undefined>;
  getNextRegistrationNumber(): Promise<number>;

  getDocumentAcceptancesByRegistration(registrationId: string): Promise<DocumentAcceptance[]>;
  createDocumentAcceptance(acceptance: InsertDocumentAcceptance): Promise<DocumentAcceptance>;

  // Voucher Batch methods
  getVoucherBatch(id: string): Promise<EventVoucherBatch | undefined>;
  getVoucherBatchesByEvent(eventId: string): Promise<EventVoucherBatch[]>;
  createVoucherBatch(batch: InsertEventVoucherBatch): Promise<EventVoucherBatch>;
  updateVoucherBatch(id: string, data: Partial<InsertEventVoucherBatch>): Promise<EventVoucherBatch | undefined>;
  updateVouchersByBatch(batchId: string, data: { validFrom?: Date; validUntil?: Date }): Promise<number>;
  deleteVoucherBatch(id: string): Promise<boolean>;

  // Voucher methods
  getVoucher(id: string): Promise<EventVoucher | undefined>;
  getVoucherByCode(eventId: string, code: string): Promise<EventVoucher | undefined>;
  getVouchersByEvent(eventId: string): Promise<EventVoucher[]>;
  getVouchersByBatch(batchId: string): Promise<EventVoucher[]>;
  createVoucher(voucher: InsertEventVoucher): Promise<EventVoucher>;
  createVouchersBulk(vouchers: InsertEventVoucher[]): Promise<EventVoucher[]>;
  updateVoucher(id: string, data: Partial<InsertEventVoucher>): Promise<EventVoucher | undefined>;
  deleteVoucher(id: string): Promise<boolean>;

  // Voucher Usage methods
  getVoucherUsage(voucherId: string): Promise<VoucherUsage | undefined>;
  createVoucherUsage(usage: InsertVoucherUsage): Promise<VoucherUsage>;

  // Coupon methods
  getCoupon(id: string): Promise<EventCoupon | undefined>;
  getCouponByCode(eventId: string, code: string): Promise<EventCoupon | undefined>;
  getCouponsByEvent(eventId: string): Promise<EventCoupon[]>;
  createCoupon(coupon: InsertEventCoupon): Promise<EventCoupon>;
  updateCoupon(id: string, data: Partial<InsertEventCoupon>): Promise<EventCoupon | undefined>;
  deleteCoupon(id: string): Promise<boolean>;
  incrementCouponUsage(id: string): Promise<void>;

  // Coupon Usage methods
  getCouponUsagesByUser(couponId: string, userId: string): Promise<CouponUsage[]>;
  getCouponUsageByOrder(orderId: string): Promise<CouponUsage | undefined>;
  createCouponUsage(usage: InsertCouponUsage): Promise<CouponUsage>;
  deleteCouponUsageByOrder(orderId: string): Promise<boolean>;
  decrementCouponUsage(id: string): Promise<void>;
}

export class DbStorage implements IStorage {
  async getAdminUser(id: string): Promise<AdminUser | undefined> {
    const [user] = await db.select().from(adminUsers).where(eq(adminUsers.id, id));
    return user;
  }

  async getAdminUserByEmail(email: string): Promise<AdminUser | undefined> {
    const [user] = await db.select().from(adminUsers).where(eq(adminUsers.email, email.toLowerCase()));
    return user;
  }

  async getAdminUsers(): Promise<AdminUser[]> {
    return db.select().from(adminUsers);
  }

  async createAdminUser(insertUser: InsertAdminUser): Promise<AdminUser> {
    const [user] = await db.insert(adminUsers).values({
      ...insertUser,
      email: insertUser.email.toLowerCase()
    }).returning();
    return user;
  }

  async updateAdminUser(id: string, userData: Partial<InsertAdminUser>): Promise<AdminUser | undefined> {
    const [user] = await db.update(adminUsers)
      .set({ ...userData, dataAtualizacao: new Date() })
      .where(eq(adminUsers.id, id))
      .returning();
    return user;
  }

  async deleteAdminUser(id: string): Promise<boolean> {
    const result = await db.delete(adminUsers).where(eq(adminUsers.id, id)).returning();
    return result.length > 0;
  }

  async updateAdminUserLastLogin(id: string): Promise<void> {
    await db.update(adminUsers)
      .set({ ultimoLogin: new Date() })
      .where(eq(adminUsers.id, id));
  }

  async getAdminUsersByOrganizer(organizerId: string): Promise<AdminUser[]> {
    return db.select().from(adminUsers).where(eq(adminUsers.organizerId, organizerId));
  }

  async getOrganizer(id: string): Promise<Organizer | undefined> {
    const [organizer] = await db.select().from(organizers).where(eq(organizers.id, id));
    return organizer;
  }

  async getOrganizerByCpfCnpj(cpfCnpj: string): Promise<Organizer | undefined> {
    const [organizer] = await db.select().from(organizers).where(eq(organizers.cpfCnpj, cpfCnpj));
    return organizer;
  }

  async getOrganizers(): Promise<Organizer[]> {
    return db.select().from(organizers);
  }

  async createOrganizer(insertOrganizer: InsertOrganizer): Promise<Organizer> {
    const [organizer] = await db.insert(organizers).values(insertOrganizer).returning();
    return organizer;
  }

  async updateOrganizer(id: string, organizerData: Partial<InsertOrganizer>): Promise<Organizer | undefined> {
    const [organizer] = await db.update(organizers)
      .set(organizerData)
      .where(eq(organizers.id, id))
      .returning();
    return organizer;
  }

  async deleteOrganizer(id: string): Promise<boolean> {
    const result = await db.delete(organizers).where(eq(organizers.id, id)).returning();
    return result.length > 0;
  }

  async getEvent(id: string): Promise<Event | undefined> {
    const [event] = await db.select().from(events).where(eq(events.id, id));
    return event;
  }

  async getEventBySlug(slug: string): Promise<Event | undefined> {
    const [event] = await db.select().from(events).where(eq(events.slug, slug));
    return event;
  }

  async getEvents(): Promise<Event[]> {
    return db.select().from(events);
  }

  async getEventsByOrganizer(organizerId: string): Promise<Event[]> {
    return db.select().from(events).where(eq(events.organizerId, organizerId));
  }

  async createEvent(insertEvent: InsertEvent): Promise<Event> {
    const [event] = await db.insert(events).values(insertEvent).returning();
    return event;
  }

  async updateEvent(id: string, eventData: Partial<InsertEvent>): Promise<Event | undefined> {
    const [event] = await db.update(events)
      .set(eventData)
      .where(eq(events.id, id))
      .returning();
    return event;
  }

  async deleteEvent(id: string): Promise<boolean> {
    const result = await db.delete(events).where(eq(events.id, id)).returning();
    return result.length > 0;
  }

  async getModality(id: string): Promise<Modality | undefined> {
    const [modality] = await db.select().from(modalities).where(eq(modalities.id, id));
    return modality;
  }

  async getModalitiesByEvent(eventId: string): Promise<Modality[]> {
    return db.select().from(modalities).where(eq(modalities.eventId, eventId));
  }

  async createModality(insertModality: InsertModality): Promise<Modality> {
    const [modality] = await db.insert(modalities).values(insertModality).returning();
    return modality;
  }

  async updateModality(id: string, modalityData: Partial<InsertModality>): Promise<Modality | undefined> {
    const [modality] = await db.update(modalities)
      .set(modalityData)
      .where(eq(modalities.id, id))
      .returning();
    return modality;
  }

  async deleteModality(id: string): Promise<boolean> {
    // Apagar registros dependentes primeiro (em cascata)
    // 1. Preços vinculados à modalidade
    await db.delete(prices).where(eq(prices.modalityId, id));
    
    // 2. Lotes vinculados à modalidade
    await db.delete(registrationBatches).where(eq(registrationBatches.modalityId, id));
    
    // 3. Tamanhos de camisa vinculados à modalidade
    await db.delete(shirtSizes).where(eq(shirtSizes.modalityId, id));
    
    // 4. Finalmente apagar a modalidade
    const result = await db.delete(modalities).where(eq(modalities.id, id)).returning();
    return result.length > 0;
  }

  async getShirtSize(id: string): Promise<ShirtSize | undefined> {
    const [size] = await db.select().from(shirtSizes).where(eq(shirtSizes.id, id));
    return size;
  }

  async getShirtSizesByEvent(eventId: string): Promise<ShirtSize[]> {
    return db.select().from(shirtSizes).where(
      and(eq(shirtSizes.eventId, eventId), isNull(shirtSizes.modalityId))
    );
  }

  async getShirtSizesByModality(modalityId: string): Promise<ShirtSize[]> {
    return db.select().from(shirtSizes).where(eq(shirtSizes.modalityId, modalityId));
  }

  async createShirtSize(insertShirtSize: InsertShirtSize): Promise<ShirtSize> {
    const [size] = await db.insert(shirtSizes).values(insertShirtSize).returning();
    return size;
  }

  async updateShirtSize(id: string, shirtSizeData: Partial<InsertShirtSize>): Promise<ShirtSize | undefined> {
    const [size] = await db.update(shirtSizes)
      .set(shirtSizeData)
      .where(eq(shirtSizes.id, id))
      .returning();
    return size;
  }

  async deleteShirtSize(id: string): Promise<boolean> {
    const result = await db.delete(shirtSizes).where(eq(shirtSizes.id, id)).returning();
    return result.length > 0;
  }

  async decrementShirtSize(id: string): Promise<boolean> {
    const [size] = await db.select().from(shirtSizes).where(eq(shirtSizes.id, id));
    if (!size || size.quantidadeDisponivel <= 0) return false;
    
    await db.update(shirtSizes)
      .set({ quantidadeDisponivel: size.quantidadeDisponivel - 1 })
      .where(eq(shirtSizes.id, id));
    return true;
  }

  async getBatch(id: string): Promise<RegistrationBatch | undefined> {
    const [batch] = await db.select().from(registrationBatches).where(eq(registrationBatches.id, id));
    return batch;
  }

  async getBatchesByEvent(eventId: string): Promise<RegistrationBatch[]> {
    return db.select().from(registrationBatches)
      .where(eq(registrationBatches.eventId, eventId))
      .orderBy(registrationBatches.ordem);
  }

  async getMaxBatchOrder(eventId: string): Promise<number> {
    const result = await db.select({ maxOrdem: max(registrationBatches.ordem) })
      .from(registrationBatches)
      .where(eq(registrationBatches.eventId, eventId));
    return result[0]?.maxOrdem ?? 0;
  }

  async checkBatchOrderExists(eventId: string, ordem: number, excludeBatchId?: string): Promise<boolean> {
    const batches = await db.select().from(registrationBatches)
      .where(and(
        eq(registrationBatches.eventId, eventId),
        eq(registrationBatches.ordem, ordem)
      ));
    
    if (excludeBatchId) {
      return batches.some(b => b.id !== excludeBatchId);
    }
    return batches.length > 0;
  }

  async getActiveBatch(eventId: string): Promise<RegistrationBatch | undefined> {
    const now = new Date();
    const allBatches = await db.select().from(registrationBatches)
      .where(and(
        eq(registrationBatches.eventId, eventId),
        eq(registrationBatches.status, 'active'),
        lte(registrationBatches.dataInicio, now)
      ));
    
    return allBatches.find(b => 
      (!b.dataTermino || new Date(b.dataTermino) > now) &&
      (!b.quantidadeMaxima || b.quantidadeUtilizada < b.quantidadeMaxima)
    );
  }

  async createBatch(insertBatch: InsertRegistrationBatch): Promise<RegistrationBatch> {
    const [batch] = await db.insert(registrationBatches).values(insertBatch).returning();
    return batch;
  }

  async updateBatch(id: string, batchData: Partial<InsertRegistrationBatch>): Promise<RegistrationBatch | undefined> {
    const [batch] = await db.update(registrationBatches)
      .set(batchData)
      .where(eq(registrationBatches.id, id))
      .returning();
    return batch;
  }

  async deleteBatch(id: string): Promise<boolean> {
    const result = await db.delete(registrationBatches).where(eq(registrationBatches.id, id)).returning();
    return result.length > 0;
  }

  async getRegistrationsByBatch(batchId: string): Promise<Registration[]> {
    return db.select().from(registrations).where(eq(registrations.batchId, batchId));
  }

  async deletePricesByBatch(batchId: string): Promise<boolean> {
    await db.delete(prices).where(eq(prices.batchId, batchId));
    return true;
  }

  async deleteBatchSafe(id: string): Promise<{ success: boolean; code?: string; message?: string }> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const registrationsResult = await client.query(
        'SELECT id FROM registrations WHERE batch_id = $1 LIMIT 1',
        [id]
      );
      
      if (registrationsResult.rows.length > 0) {
        await client.query('ROLLBACK');
        return {
          success: false,
          code: "BATCH_HAS_REGISTRATIONS",
          message: "Este lote possui inscricoes vinculadas e nao pode ser excluido. Feche ou oculte este lote em vez de apagar."
        };
      }

      await client.query('DELETE FROM prices WHERE batch_id = $1', [id]);
      
      const deleteResult = await client.query(
        'DELETE FROM registration_batches WHERE id = $1 RETURNING id',
        [id]
      );
      
      if (deleteResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return {
          success: false,
          code: "NOT_FOUND",
          message: "Lote nao encontrado"
        };
      }
      
      await client.query('COMMIT');
      return { success: true };
      
    } catch (error: any) {
      await client.query('ROLLBACK');
      
      if (error?.code === "23503") {
        return {
          success: false,
          code: "FK_CONSTRAINT_VIOLATION",
          message: "O lote possui dependencias que impedem a exclusao. Contate o suporte."
        };
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async getPrice(modalityId: string, batchId: string): Promise<Price | undefined> {
    const [price] = await db.select().from(prices).where(
      and(eq(prices.modalityId, modalityId), eq(prices.batchId, batchId))
    );
    return price;
  }

  async getPriceById(id: string): Promise<Price | undefined> {
    const [price] = await db.select().from(prices).where(eq(prices.id, id));
    return price;
  }

  async getPricesByModality(modalityId: string): Promise<Price[]> {
    return db.select().from(prices).where(eq(prices.modalityId, modalityId));
  }

  async getPricesByBatch(batchId: string): Promise<Price[]> {
    return db.select().from(prices).where(eq(prices.batchId, batchId));
  }

  async getPricesByEvent(eventId: string): Promise<Price[]> {
    const eventModalities = await this.getModalitiesByEvent(eventId);
    const modalityIds = eventModalities.map(m => m.id);
    if (modalityIds.length === 0) return [];
    
    const allPrices: Price[] = [];
    for (const modId of modalityIds) {
      const modalityPrices = await db.select().from(prices).where(eq(prices.modalityId, modId));
      allPrices.push(...modalityPrices);
    }
    return allPrices;
  }

  async createPrice(insertPrice: InsertPrice): Promise<Price> {
    const [price] = await db.insert(prices).values(insertPrice).returning();
    return price;
  }

  async updatePrice(id: string, priceData: Partial<InsertPrice>): Promise<Price | undefined> {
    const [price] = await db.update(prices)
      .set(priceData)
      .where(eq(prices.id, id))
      .returning();
    return price;
  }

  async deletePrice(id: string): Promise<boolean> {
    const result = await db.delete(prices).where(eq(prices.id, id)).returning();
    return result.length > 0;
  }

  async getAttachment(id: string): Promise<Attachment | undefined> {
    const [attachment] = await db.select().from(attachments).where(eq(attachments.id, id));
    return attachment;
  }

  async getAttachmentsByEvent(eventId: string): Promise<Attachment[]> {
    return db.select().from(attachments).where(eq(attachments.eventId, eventId));
  }

  async createAttachment(insertAttachment: InsertAttachment): Promise<Attachment> {
    const [attachment] = await db.insert(attachments).values(insertAttachment).returning();
    return attachment;
  }

  async updateAttachment(id: string, attachmentData: Partial<InsertAttachment>): Promise<Attachment | undefined> {
    const [attachment] = await db.update(attachments)
      .set(attachmentData)
      .where(eq(attachments.id, id))
      .returning();
    return attachment;
  }

  async deleteAttachment(id: string): Promise<boolean> {
    const result = await db.delete(attachments).where(eq(attachments.id, id)).returning();
    return result.length > 0;
  }

  async getEventBanner(id: string): Promise<EventBanner | undefined> {
    const [banner] = await db.select().from(eventBanners).where(eq(eventBanners.id, id));
    return banner;
  }

  async getEventBannersByEvent(eventId: string): Promise<EventBanner[]> {
    return db.select().from(eventBanners).where(eq(eventBanners.eventId, eventId));
  }

  async createEventBanner(insertBanner: InsertEventBanner): Promise<EventBanner> {
    const [banner] = await db.insert(eventBanners).values(insertBanner).returning();
    return banner;
  }

  async updateEventBanner(id: string, bannerData: Partial<InsertEventBanner>): Promise<EventBanner | undefined> {
    const [banner] = await db.update(eventBanners)
      .set(bannerData)
      .where(eq(eventBanners.id, id))
      .returning();
    return banner;
  }

  async deleteEventBanner(id: string): Promise<boolean> {
    const result = await db.delete(eventBanners).where(eq(eventBanners.id, id)).returning();
    return result.length > 0;
  }

  async deleteEventBannersByEvent(eventId: string): Promise<boolean> {
    const result = await db.delete(eventBanners).where(eq(eventBanners.eventId, eventId)).returning();
    return result.length >= 0;
  }

  async getAthlete(id: string): Promise<Athlete | undefined> {
    const [athlete] = await db.select().from(athletes).where(eq(athletes.id, id));
    return athlete;
  }

  async getAthletes(): Promise<Athlete[]> {
    return db.select().from(athletes);
  }

  async getAthleteByCpf(cpf: string): Promise<Athlete | undefined> {
    const [athlete] = await db.select().from(athletes).where(eq(athletes.cpf, cpf));
    return athlete;
  }

  async getAthleteByEmail(email: string): Promise<Athlete | undefined> {
    const [athlete] = await db.select().from(athletes).where(eq(athletes.email, email.toLowerCase()));
    return athlete;
  }

  async createAthlete(insertAthlete: InsertAthlete): Promise<Athlete> {
    const [athlete] = await db.insert(athletes).values({
      ...insertAthlete,
      nome: insertAthlete.nome.toUpperCase()
    }).returning();
    return athlete;
  }

  async updateAthlete(id: string, athleteData: Partial<InsertAthlete>): Promise<Athlete | undefined> {
    const dataToUpdate = athleteData.nome 
      ? { ...athleteData, nome: athleteData.nome.toUpperCase() }
      : athleteData;
    const [athlete] = await db.update(athletes)
      .set(dataToUpdate)
      .where(eq(athletes.id, id))
      .returning();
    return athlete;
  }

  async getOrder(id: string): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    return order;
  }

  async getOrdersByEvent(eventId: string): Promise<Order[]> {
    return db.select().from(orders).where(eq(orders.eventId, eventId));
  }

  async getOrdersByBuyer(buyerId: string): Promise<Order[]> {
    return db.select().from(orders).where(eq(orders.compradorId, buyerId));
  }

  async createOrder(insertOrder: InsertOrder): Promise<Order> {
    const [order] = await db.insert(orders).values(insertOrder).returning();
    return order;
  }

  async updateOrder(id: string, orderData: Partial<InsertOrder>): Promise<Order | undefined> {
    const [order] = await db.update(orders)
      .set(orderData)
      .where(eq(orders.id, id))
      .returning();
    return order;
  }

  async getNextOrderNumber(): Promise<number> {
    // Usar subquery para obter o próximo número de forma segura
    const result = await db.execute(sql`
      SELECT COALESCE(
        (SELECT numero_pedido FROM orders ORDER BY numero_pedido DESC LIMIT 1),
        999
      ) + 1 as next_num
    `);
    return Number(result.rows[0]?.next_num ?? 1000);
  }

  async updateOrderPaymentId(orderId: string, paymentId: string, paymentMethod: string): Promise<void> {
    try {
      // Verificar se este order já tem este paymentId (para evitar update desnecessário)
      const [currentOrder] = await db.select().from(orders).where(eq(orders.id, orderId));
      if (currentOrder?.idPagamentoGateway === paymentId) {
        // Já tem o mesmo ID, só atualizar o método se necessário
        if (currentOrder.metodoPagamento !== paymentMethod) {
          await db.update(orders)
            .set({ metodoPagamento: paymentMethod })
            .where(eq(orders.id, orderId));
        }
        return;
      }
      
      // Verificar se outro order já usa este paymentId (violaria unique constraint)
      const [existingOrder] = await db.select().from(orders).where(eq(orders.idPagamentoGateway, paymentId));
      if (existingOrder && existingOrder.id !== orderId) {
        console.warn(`[storage] PaymentId ${paymentId} já existe no pedido ${existingOrder.id}. Atualizando apenas método de pagamento para pedido ${orderId}.`);
        // Não atualizar o idPagamentoGateway, apenas o método
        await db.update(orders)
          .set({ metodoPagamento: paymentMethod })
          .where(eq(orders.id, orderId));
        return;
      }
      
      await db.update(orders)
        .set({ 
          idPagamentoGateway: paymentId,
          metodoPagamento: paymentMethod
        })
        .where(eq(orders.id, orderId));
    } catch (error: any) {
      // Se for erro de duplicata, logar e não propagar
      if (error.code === '23505' && error.constraint === 'orders_id_pagamento_gateway_key') {
        console.warn(`[storage] Erro de duplicata ao atualizar paymentId ${paymentId} para pedido ${orderId}:`, error.detail);
        // Tentar atualizar apenas o método de pagamento
        await db.update(orders)
          .set({ metodoPagamento: paymentMethod })
          .where(eq(orders.id, orderId));
        return;
      }
      throw error;
    }
  }

  async updateOrderPixData(orderId: string, pixData: { qrCode: string; qrCodeBase64: string; expiracao: Date; paymentId?: string }): Promise<void> {
    const updateData: any = {
      pixQrCode: pixData.qrCode,
      pixQrCodeBase64: pixData.qrCodeBase64,
      pixExpiracao: pixData.expiracao,
      pixDataGeracao: new Date()
    };
    
    // Se um paymentId do PIX foi fornecido, salvar no campo dedicado
    if (pixData.paymentId) {
      updateData.pixPaymentId = pixData.paymentId;
    }
    
    await db.update(orders)
      .set(updateData)
      .where(eq(orders.id, orderId));
  }

  async clearOrderPixData(orderId: string): Promise<void> {
    await db.update(orders)
      .set({
        pixQrCode: null,
        pixQrCodeBase64: null,
        pixExpiracao: null,
        pixDataGeracao: null
      })
      .where(eq(orders.id, orderId));
  }

  async confirmOrderPayment(orderId: string, paymentId: string): Promise<void> {
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
    
    if (order && order.status === 'pago') {
      return;
    }

    await db.update(orders)
      .set({ 
        status: 'pago',
        dataPagamento: new Date(),
        idPagamentoGateway: paymentId
      })
      .where(eq(orders.id, orderId));

    await db.update(registrations)
      .set({ status: 'confirmada' })
      .where(eq(registrations.orderId, orderId));

    if (order && order.cupomId) {
      const existingUsage = await db.select().from(couponUsages)
        .where(eq(couponUsages.orderId, orderId));
      
      if (existingUsage.length === 0) {
        await db.update(eventCoupons)
          .set({ currentUses: sql`${eventCoupons.currentUses} + 1` })
          .where(eq(eventCoupons.id, order.cupomId));
        
        await db.insert(couponUsages).values({
          couponId: order.cupomId,
          userId: order.compradorId,
          orderId: orderId,
          discountApplied: order.valorDesconto,
        });
      }
    }
  }

  async getPendingOrdersWithPayment(): Promise<Order[]> {
    return db.select().from(orders)
      .where(
        and(
          eq(orders.status, 'pendente'),
          isNotNull(orders.idPagamentoGateway),
          gt(orders.dataExpiracao, new Date())
        )
      );
  }

  async getExpiredPendingOrders(): Promise<Order[]> {
    return db.select().from(orders)
      .where(
        and(
          eq(orders.status, 'pendente'),
          isNotNull(orders.dataExpiracao),
          lt(orders.dataExpiracao, new Date())
        )
      );
  }

  async getOrdersByPaymentId(paymentId: string): Promise<Order | undefined> {
    // Primeiro tenta pelo idPagamentoGateway (pagamento atual)
    let [order] = await db.select().from(orders)
      .where(eq(orders.idPagamentoGateway, paymentId));
    
    // Se não encontrar, tenta pelo pixPaymentId (PIX pode ter sido substituído por cartão)
    if (!order) {
      [order] = await db.select().from(orders)
        .where(eq(orders.pixPaymentId, paymentId));
    }
    
    return order;
  }

  async getRegistration(id: string): Promise<Registration | undefined> {
    const [reg] = await db.select().from(registrations).where(eq(registrations.id, id));
    return reg;
  }

  async getRegistrationsByEvent(eventId: string): Promise<Registration[]> {
    return db.select().from(registrations).where(eq(registrations.eventId, eventId));
  }

  async getRegistrationsByAthlete(athleteId: string): Promise<Registration[]> {
    return db.select().from(registrations).where(eq(registrations.athleteId, athleteId));
  }

  async getRegistrationsByOrder(orderId: string): Promise<Registration[]> {
    return db.select().from(registrations).where(eq(registrations.orderId, orderId));
  }

  async createRegistration(insertRegistration: InsertRegistration): Promise<Registration> {
    const batch = await this.getBatch(insertRegistration.batchId);
    if (batch && batch.quantidadeMaxima && batch.quantidadeUtilizada >= batch.quantidadeMaxima) {
      throw new Error("Lote esgotado");
    }

    const event = await this.getEvent(insertRegistration.eventId);
    if (!event) {
      throw new Error("Evento não encontrado");
    }

    const modality = await this.getModality(insertRegistration.modalityId);
    if (!modality) {
      throw new Error("Modalidade não encontrada");
    }

    const athlete = await this.getAthlete(insertRegistration.athleteId);
    if (!athlete) {
      throw new Error("Atleta não encontrado");
    }

    const idadeMinima = modality.idadeMinima ?? event.idadeMinimaEvento ?? 18;
    
    const eventDate = new Date(event.dataEvento);
    const birthDate = new Date(athlete.dataNascimento);
    let age = eventDate.getFullYear() - birthDate.getFullYear();
    const monthDiff = eventDate.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && eventDate.getDate() < birthDate.getDate())) {
      age--;
    }

    if (age < idadeMinima) {
      throw new Error(`Idade mínima para esta modalidade é ${idadeMinima} anos. O participante terá ${age} anos na data do evento.`);
    }

    if (batch) {
      await db.update(registrationBatches)
        .set({ quantidadeUtilizada: batch.quantidadeUtilizada + 1 })
        .where(eq(registrationBatches.id, batch.id));
    }

    const [registration] = await db.insert(registrations).values(insertRegistration).returning();
    return registration;
  }

  async updateRegistration(id: string, registrationData: Partial<InsertRegistration>): Promise<Registration | undefined> {
    const [registration] = await db.update(registrations)
      .set(registrationData)
      .where(eq(registrations.id, id))
      .returning();
    return registration;
  }

  async getNextRegistrationNumber(): Promise<number> {
    // Usar subquery para obter o próximo número de forma segura
    const result = await db.execute(sql`
      SELECT COALESCE(
        (SELECT numero_inscricao FROM registrations ORDER BY numero_inscricao DESC LIMIT 1),
        999
      ) + 1 as next_num
    `);
    return Number(result.rows[0]?.next_num ?? 1000);
  }

  async getDocumentAcceptancesByRegistration(registrationId: string): Promise<DocumentAcceptance[]> {
    return db.select().from(documentAcceptances).where(eq(documentAcceptances.registrationId, registrationId));
  }

  async createDocumentAcceptance(insertAcceptance: InsertDocumentAcceptance): Promise<DocumentAcceptance> {
    const [acceptance] = await db.insert(documentAcceptances).values(insertAcceptance).returning();
    return acceptance;
  }

  // Voucher Batch methods
  async getVoucherBatch(id: string): Promise<EventVoucherBatch | undefined> {
    const [batch] = await db.select().from(eventVoucherBatches).where(eq(eventVoucherBatches.id, id));
    return batch;
  }

  async getVoucherBatchesByEvent(eventId: string): Promise<EventVoucherBatch[]> {
    return db.select().from(eventVoucherBatches).where(eq(eventVoucherBatches.eventId, eventId));
  }

  async createVoucherBatch(batch: InsertEventVoucherBatch): Promise<EventVoucherBatch> {
    const [created] = await db.insert(eventVoucherBatches).values(batch).returning();
    return created;
  }

  async updateVoucherBatch(id: string, data: Partial<InsertEventVoucherBatch>): Promise<EventVoucherBatch | undefined> {
    const [updated] = await db.update(eventVoucherBatches).set(data).where(eq(eventVoucherBatches.id, id)).returning();
    return updated;
  }

  async updateVouchersByBatch(batchId: string, data: { validFrom?: Date; validUntil?: Date }): Promise<number> {
    const updateData: any = {};
    if (data.validFrom) updateData.validFrom = data.validFrom;
    if (data.validUntil) updateData.validUntil = data.validUntil;
    
    if (Object.keys(updateData).length === 0) return 0;
    
    const result = await db.update(eventVouchers)
      .set(updateData)
      .where(eq(eventVouchers.batchId, batchId))
      .returning();
    return result.length;
  }

  async deleteVoucherBatch(id: string): Promise<boolean> {
    const result = await db.delete(eventVoucherBatches).where(eq(eventVoucherBatches.id, id)).returning();
    return result.length > 0;
  }

  // Voucher methods
  async getVoucher(id: string): Promise<EventVoucher | undefined> {
    const [voucher] = await db.select().from(eventVouchers).where(eq(eventVouchers.id, id));
    return voucher;
  }

  async getVoucherByCode(eventId: string, code: string): Promise<EventVoucher | undefined> {
    const [voucher] = await db.select().from(eventVouchers)
      .where(and(eq(eventVouchers.eventId, eventId), eq(eventVouchers.code, code.toUpperCase())));
    return voucher;
  }

  async getVouchersByEvent(eventId: string): Promise<EventVoucher[]> {
    return db.select().from(eventVouchers).where(eq(eventVouchers.eventId, eventId));
  }

  async getVouchersByBatch(batchId: string): Promise<EventVoucher[]> {
    return db.select().from(eventVouchers).where(eq(eventVouchers.batchId, batchId));
  }

  async createVoucher(voucher: InsertEventVoucher): Promise<EventVoucher> {
    const [created] = await db.insert(eventVouchers).values({
      ...voucher,
      code: voucher.code.toUpperCase()
    }).returning();
    return created;
  }

  async createVouchersBulk(vouchers: InsertEventVoucher[]): Promise<EventVoucher[]> {
    if (vouchers.length === 0) return [];
    const normalizedVouchers = vouchers.map(v => ({ ...v, code: v.code.toUpperCase() }));
    return db.insert(eventVouchers).values(normalizedVouchers).returning();
  }

  async updateVoucher(id: string, data: Partial<InsertEventVoucher>): Promise<EventVoucher | undefined> {
    const updateData = { ...data };
    if (updateData.code) updateData.code = updateData.code.toUpperCase();
    const [updated] = await db.update(eventVouchers).set(updateData).where(eq(eventVouchers.id, id)).returning();
    return updated;
  }

  async deleteVoucher(id: string): Promise<boolean> {
    const result = await db.delete(eventVouchers).where(eq(eventVouchers.id, id)).returning();
    return result.length > 0;
  }

  // Voucher Usage methods
  async getVoucherUsage(voucherId: string): Promise<VoucherUsage | undefined> {
    const [usage] = await db.select().from(voucherUsages).where(eq(voucherUsages.voucherId, voucherId));
    return usage;
  }

  async createVoucherUsage(usage: InsertVoucherUsage): Promise<VoucherUsage> {
    const [created] = await db.insert(voucherUsages).values(usage).returning();
    return created;
  }

  // Coupon methods
  async getCoupon(id: string): Promise<EventCoupon | undefined> {
    const [coupon] = await db.select().from(eventCoupons).where(eq(eventCoupons.id, id));
    return coupon;
  }

  async getCouponByCode(eventId: string, code: string): Promise<EventCoupon | undefined> {
    const [coupon] = await db.select().from(eventCoupons)
      .where(and(eq(eventCoupons.eventId, eventId), eq(eventCoupons.code, code.toUpperCase())));
    return coupon;
  }

  async isCodeGloballyUnique(eventId: string, code: string): Promise<{ isUnique: boolean; type?: "voucher" | "coupon" }> {
    const upperCode = code.toUpperCase();
    const existingVoucher = await this.getVoucherByCode(eventId, upperCode);
    if (existingVoucher) {
      return { isUnique: false, type: "voucher" };
    }
    const existingCoupon = await this.getCouponByCode(eventId, upperCode);
    if (existingCoupon) {
      return { isUnique: false, type: "coupon" };
    }
    return { isUnique: true };
  }

  async getCouponsByEvent(eventId: string): Promise<EventCoupon[]> {
    return db.select().from(eventCoupons).where(eq(eventCoupons.eventId, eventId));
  }

  async createCoupon(coupon: InsertEventCoupon): Promise<EventCoupon> {
    const [created] = await db.insert(eventCoupons).values({
      ...coupon,
      code: coupon.code.toUpperCase()
    }).returning();
    return created;
  }

  async updateCoupon(id: string, data: Partial<InsertEventCoupon>): Promise<EventCoupon | undefined> {
    const updateData = { ...data };
    if (updateData.code) updateData.code = updateData.code.toUpperCase();
    const [updated] = await db.update(eventCoupons).set(updateData).where(eq(eventCoupons.id, id)).returning();
    return updated;
  }

  async deleteCoupon(id: string): Promise<boolean> {
    const result = await db.delete(eventCoupons).where(eq(eventCoupons.id, id)).returning();
    return result.length > 0;
  }

  async incrementCouponUsage(id: string): Promise<void> {
    await db.update(eventCoupons)
      .set({ currentUses: sql`${eventCoupons.currentUses} + 1` })
      .where(eq(eventCoupons.id, id));
  }

  // Coupon Usage methods
  async getCouponUsagesByUser(couponId: string, userId: string): Promise<CouponUsage[]> {
    return db.select().from(couponUsages)
      .where(and(eq(couponUsages.couponId, couponId), eq(couponUsages.userId, userId)));
  }

  async getCouponUsageByOrder(orderId: string): Promise<CouponUsage | undefined> {
    const [usage] = await db.select().from(couponUsages)
      .where(eq(couponUsages.orderId, orderId));
    return usage;
  }

  async createCouponUsage(usage: InsertCouponUsage): Promise<CouponUsage> {
    const [created] = await db.insert(couponUsages).values(usage).returning();
    return created;
  }

  async deleteCouponUsageByOrder(orderId: string): Promise<boolean> {
    const result = await db.delete(couponUsages)
      .where(eq(couponUsages.orderId, orderId))
      .returning();
    return result.length > 0;
  }

  async decrementCouponUsage(id: string): Promise<void> {
    await db.update(eventCoupons)
      .set({ currentUses: sql`GREATEST(${eventCoupons.currentUses} - 1, 0)` })
      .where(eq(eventCoupons.id, id));
  }
}

export const storage = new DbStorage();
