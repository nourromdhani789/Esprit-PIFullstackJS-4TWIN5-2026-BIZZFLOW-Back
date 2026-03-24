import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Invoice, InvoiceStatus } from './entities/invoice.entity';
import { InvoiceItem } from './entities/invoice-item.entity';
import { CreateInvoiceDto, UpdateInvoiceDto } from './dto/invoice.dto';

@Injectable()
export class InvoiceService {
  constructor(
    @InjectRepository(Invoice)
    private invoiceRepository: Repository<Invoice>,
    @InjectRepository(InvoiceItem)
    private invoiceItemRepository: Repository<InvoiceItem>,
    private dataSource: DataSource,
  ) {}

  async create(businessId: string, createInvoiceDto: CreateInvoiceDto): Promise<Invoice> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Calculate totals
      let subtotal = 0;
      const items = createInvoiceDto.items.map(item => {
        const itemTotal = item.quantity * item.price;
        subtotal += itemTotal;
        return {
          ...item,
          total: itemTotal,
        };
      });

      // Generate invoice number
      const invoiceCount = await this.invoiceRepository.count({ where: { businessId } });
      const invoiceNumber = `INV-${Date.now().toString().slice(-6)}-${(invoiceCount + 1).toString().padStart(4, '0')}`;

      // Create invoice
      const invoice = this.invoiceRepository.create({
        ...createInvoiceDto,
        businessId,
        invoiceNumber,
        subtotal,
        taxAmount: 0,
        totalAmount: subtotal,
        items: items as InvoiceItem[],
      });

      const savedInvoice = await queryRunner.manager.save(invoice);

      // Create invoice items
      for (const item of items) {
        const invoiceItem = this.invoiceItemRepository.create({
          ...item,
          invoiceId: savedInvoice.id,
        });
        await queryRunner.manager.save(invoiceItem);
      }

      await queryRunner.commitTransaction();

      return this.findOne(savedInvoice.id, businessId);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(businessId: string): Promise<Invoice[]> {
    return this.invoiceRepository.find({
      where: { businessId },
      relations: ['items', 'items.product'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, businessId: string): Promise<Invoice> {
    const invoice = await this.invoiceRepository.findOne({
      where: { id, businessId },
      relations: ['items', 'items.product', 'business'],
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    return invoice;
  }

  async update(id: string, businessId: string, updateInvoiceDto: UpdateInvoiceDto): Promise<Invoice> {
    const invoice = await this.findOne(id, businessId);
    Object.assign(invoice, updateInvoiceDto);
    return this.invoiceRepository.save(invoice);
  }

  async updateStatus(id: string, businessId: string, status: InvoiceStatus): Promise<Invoice> {
    const invoice = await this.findOne(id, businessId);
    invoice.status = status;
    return this.invoiceRepository.save(invoice);
  }

  async remove(id: string, businessId: string): Promise<void> {
    const invoice = await this.findOne(id, businessId);
    await this.invoiceRepository.remove(invoice);
  }

  async generatePdf(id: string, businessId: string): Promise<Buffer> {
    const invoice = await this.findOne(id, businessId);
    // PDF generation will be implemented separately
    return Buffer.from('PDF content');
  }
}
