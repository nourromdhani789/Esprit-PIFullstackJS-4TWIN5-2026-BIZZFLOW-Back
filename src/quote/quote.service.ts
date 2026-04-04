import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Quote, QuoteStatus } from './entities/quote.entity';
import { QuoteItem } from './entities/quote-item.entity';
import { CreateQuoteDto, UpdateQuoteDto } from './dto/quote.dto';
import { Client } from '../client/entities/client.entity';
import { Business } from '../business/entities/business.entity';
import { Product } from '../product/entities/product.entity';
import { AuditService } from '../audit/audit.service';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class QuoteService {
  constructor(
    @InjectRepository(Quote)
    private quoteRepository: Repository<Quote>,
    @InjectRepository(QuoteItem)
    private quoteItemRepository: Repository<QuoteItem>,
    @InjectRepository(Client)
    private clientRepository: Repository<Client>,
    @InjectRepository(Business)
    private businessRepository: Repository<Business>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    private dataSource: DataSource,
    private auditService: AuditService,
    private notificationService: NotificationService,
  ) {}

  private async generateQuoteNumber(businessId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `QUO-${year}-`;
    
    // Find the latest quote number for this business and year
    const latestQuote = await this.quoteRepository
      .createQueryBuilder('quote')
      .where('quote.businessId = :businessId', { businessId })
      .andWhere('quote.quoteNumber LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('quote.createdAt', 'DESC')
      .getOne();

    let increment = 1;
    if (latestQuote?.quoteNumber) {
      const parts = latestQuote.quoteNumber.split('-');
      if (parts.length === 3) {
        const lastNum = parseInt(parts[2], 10);
        if (!isNaN(lastNum)) {
          increment = lastNum + 1;
        }
      }
    }

    return `${prefix}${increment.toString().padStart(3, '0')}`;
  }

  async create(businessId: string, createQuoteDto: CreateQuoteDto, userId?: string, userEmail?: string): Promise<Quote> {
    // Validate client exists and belongs to business
    const client = await this.clientRepository.findOne({
      where: { id: createQuoteDto.clientId, businessId },
    });
    if (!client) {
      throw new BadRequestException('Client not found or does not belong to your business');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Calculate totals
      let subtotal = 0;
      const items = createQuoteDto.items.map(item => {
        const itemTotal = item.quantity * item.unitPrice;
        subtotal += itemTotal;
        return {
          ...item,
          total: itemTotal,
        };
      });

      // Generate quote number
      const quoteNumber = await this.generateQuoteNumber(businessId);

      const business = await this.businessRepository.findOne({ where: { id: businessId } });
      if (!business) {
        throw new NotFoundException('Business not found');
      }

      const taxRate = Number(business.taxRate) || 0;
      const taxAmount = Number(((subtotal * taxRate) / 100).toFixed(3));
      const totalAmount = Number((subtotal + taxAmount).toFixed(3));

      // Create quote
      const { items: _, ...quoteData } = createQuoteDto;
      const quote = this.quoteRepository.create({
        ...quoteData,
        businessId,
        quoteNumber,
        subtotal,
        taxAmount,
        totalAmount,
        taxRate,
        status: createQuoteDto.status || QuoteStatus.DRAFT,
      });

      const savedQuote = await queryRunner.manager.save(quote);

      // Create quote items
      for (const item of items) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const isValidUUID = item.productId && uuidRegex.test(item.productId);
        const productId = isValidUUID ? item.productId : null;

        await queryRunner.manager.query(
          `INSERT INTO quote_items (id, quote_id, product_id, quantity, unit_price, description, total) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            require('uuid').v4(),
            savedQuote.id,
            productId,
            item.quantity,
            item.unitPrice,
            item.description,
            item.total,
          ],
        );
      }

      await queryRunner.commitTransaction();

      // Log audit
      await this.auditService.log(
        userId || 'system',
        userEmail || 'system@localhost',
        'created_quote',
        'Quote',
        savedQuote.id,
        {
          quoteNumber: savedQuote.quoteNumber,
          clientName: client.name,
          clientId: client.id,
          totalAmount: savedQuote.totalAmount,
          itemCount: items.length,
        },
        businessId,
      );

      return this.findOne(savedQuote.id, businessId);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(businessId: string): Promise<Quote[]> {
    return this.quoteRepository.find({
      where: { businessId },
      relations: ['items', 'items.product'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, businessId: string): Promise<Quote> {
    const quote = await this.quoteRepository.findOne({
      where: { id, businessId },
      relations: ['items', 'items.product', 'business', 'client'],
    });
    if (!quote) {
      throw new NotFoundException('Quote not found');
    }
    return quote;
  }

  async update(id: string, businessId: string, updateQuoteDto: UpdateQuoteDto, userId?: string, userEmail?: string): Promise<Quote> {
    const quote = await this.findOne(id, businessId);

    // Only drafts can be updated
    if (quote.status !== QuoteStatus.DRAFT) {
      throw new BadRequestException('Only draft quotes can be updated');
    }

    // If clientId is being updated, validate the new client exists
    if (updateQuoteDto.clientId) {
      const client = await this.clientRepository.findOne({
        where: { id: updateQuoteDto.clientId, businessId },
      });
      if (!client) {
        throw new BadRequestException('Client not found or does not belong to your business');
      }
    }

    Object.assign(quote, updateQuoteDto);
    const savedQuote = await this.quoteRepository.save(quote);

    // Log audit
    await this.auditService.log(
      userId || 'system',
      userEmail || 'system@localhost',
      'updated_quote',
      'Quote',
      savedQuote.id,
      {
        quoteNumber: savedQuote.quoteNumber,
        changes: Object.keys(updateQuoteDto),
      },
      businessId,
    );

    return savedQuote;
  }

  async updateStatus(id: string, businessId: string, status: QuoteStatus, userId?: string, userEmail?: string): Promise<Quote> {
    const quote = await this.findOne(id, businessId);
    const previousStatus = quote.status;
    quote.status = status;
    const savedQuote = await this.quoteRepository.save(quote);

    // Log audit
    await this.auditService.log(
      userId || 'system',
      userEmail || 'system@localhost',
      `changed_quote_status_${status}`,
      'Quote',
      savedQuote.id,
      {
        quoteNumber: savedQuote.quoteNumber,
        previousStatus,
        newStatus: status,
      },
      businessId,
    );

    return savedQuote;
  }

  async remove(id: string, businessId: string, userId?: string, userEmail?: string): Promise<void> {
    const quote = await this.findOne(id, businessId);

    // Only drafts can be deleted
    if (quote.status !== QuoteStatus.DRAFT) {
      throw new BadRequestException('Only draft quotes can be deleted');
    }

    // Log audit before deletion
    await this.auditService.log(
      userId || 'system',
      userEmail || 'system@localhost',
      'deleted_quote',
      'Quote',
      quote.id,
      {
        quoteNumber: quote.quoteNumber,
        clientName: quote.client?.name,
        totalAmount: quote.totalAmount,
      },
      businessId,
    );

    await this.quoteRepository.remove(quote);
  }

  async duplicate(id: string, businessId: string, userId?: string, userEmail?: string): Promise<Quote> {
    const originalQuote = await this.findOne(id, businessId);

    const newQuoteDto: CreateQuoteDto = {
      clientId: originalQuote.clientId,
      notes: originalQuote.notes,
      issueDate: new Date(),
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      items: originalQuote.items
        .filter(item => item.productId !== null)
        .map(item => ({
          productId: item.productId!,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          description: item.description,
        })),
    };

    return this.create(businessId, newQuoteDto, userId, userEmail);
  }

  async markAsSent(id: string, businessId: string, userId?: string, userEmail?: string): Promise<Quote> {
    return this.updateStatus(id, businessId, QuoteStatus.SENT, userId, userEmail);
  }

  async markAsAccepted(id: string, businessId: string, userId?: string, userEmail?: string): Promise<Quote> {
    return this.updateStatus(id, businessId, QuoteStatus.ACCEPTED, userId, userEmail);
  }

  async markAsRejected(id: string, businessId: string, userId?: string, userEmail?: string): Promise<Quote> {
    return this.updateStatus(id, businessId, QuoteStatus.REJECTED, userId, userEmail);
  }

  async convertToSalesOrder(id: string, businessId: string, salesOrderService: any, userId?: string, userEmail?: string): Promise<any> {
    const quote = await this.findOne(id, businessId);

    if (quote.status !== QuoteStatus.ACCEPTED) {
      throw new BadRequestException('Only accepted quotes can be converted to sales orders');
    }

    if (quote.convertedToSalesOrderId) {
      throw new BadRequestException('Quote has already been converted to a sales order');
    }

    // Create sales order data
    const salesOrderData = {
      clientId: quote.clientId,
      notes: quote.notes,
      issueDate: new Date(),
      expectedDeliveryDate: null,
      items: quote.items
        .filter(item => item.productId !== null)
        .map(item => ({
          productId: item.productId!,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          description: item.description,
        })),
      sourceQuoteId: quote.id,
    };

    // Create the sales order using the sales order service
    const salesOrder = await salesOrderService.create(businessId, salesOrderData, userId, userEmail);

    // Update quote with converted reference
    quote.convertedToSalesOrderId = salesOrder.id;
    await this.quoteRepository.save(quote);

    // Log audit
    await this.auditService.log(
      userId || 'system',
      userEmail || 'system@localhost',
      'converted_quote_to_sales_order',
      'Quote',
      quote.id,
      {
        quoteNumber: quote.quoteNumber,
        salesOrderId: salesOrder.id,
        salesOrderNumber: salesOrder.salesOrderNumber,
      },
      businessId,
    );

    return salesOrder;
  }

  async convertToInvoice(id: string, businessId: string, invoiceService: any, userId?: string, userEmail?: string): Promise<any> {
    const quote = await this.findOne(id, businessId);

    if (quote.status !== QuoteStatus.ACCEPTED) {
      throw new BadRequestException('Only accepted quotes can be converted to invoices');
    }

    if (quote.convertedToInvoiceId) {
      throw new BadRequestException('Quote has already been converted to an invoice');
    }

    // Create invoice data
    const invoiceData = {
      clientId: quote.clientId,
      notes: quote.notes,
      dueDate: null,
      items: quote.items
        .filter(item => item.productId !== null)
        .map(item => ({
          productId: item.productId!,
          quantity: item.quantity,
          price: Number(item.unitPrice),
          description: item.description,
        })),
      sourceQuoteId: quote.id,
    };

    // Create the invoice using the invoice service
    const invoice = await invoiceService.create(businessId, invoiceData, userId, userEmail);

    // Update quote with converted reference
    quote.convertedToInvoiceId = invoice.id;
    await this.quoteRepository.save(quote);

    // Log audit
    await this.auditService.log(
      userId || 'system',
      userEmail || 'system@localhost',
      'converted_quote_to_invoice',
      'Quote',
      quote.id,
      {
        quoteNumber: quote.quoteNumber,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
      },
      businessId,
    );

    return invoice;
  }

  async checkExpiredQuotes(): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const expiredQuotes = await this.quoteRepository
      .createQueryBuilder('quote')
      .where('quote.status IN (:...statuses)', { statuses: [QuoteStatus.DRAFT, QuoteStatus.SENT] })
      .andWhere('quote.expiryDate < :today', { today })
      .getMany();

    for (const quote of expiredQuotes) {
      quote.status = QuoteStatus.EXPIRED;
      await this.quoteRepository.save(quote);

      // Create notification
      try {
        await this.notificationService.create(
          quote.businessId,
          'Quote Expired',
          `Quote ${quote.quoteNumber} has expired`,
          'warning',
          'quote',
          `/quotes/${quote.id}`,
          quote.id,
          'Quote',
        );
      } catch (err) {
        console.error('Failed to create notification:', err);
      }
    }
  }
}
