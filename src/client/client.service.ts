import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from './entities/client.entity';
import { CreateClientDto, UpdateClientDto } from './dto/client.dto';
import { Invoice, InvoiceStatus } from '../invoice/entities/invoice.entity';
import { CreditNote } from '../credit-note/entities/credit-note.entity';
import { Payment } from '../payment/entities/payment.entity';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class ClientService {
  constructor(
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(CreditNote)
    private readonly creditNoteRepository: Repository<CreditNote>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    private readonly auditService: AuditService,
  ) {}

  async create(businessId: string, createClientDto: CreateClientDto, userId?: string, userEmail?: string): Promise<Client> {
    const client = this.clientRepository.create({
      ...createClientDto,
      businessId,
    });
    const savedClient = await this.clientRepository.save(client);

    // Log audit
    try {
      await this.auditService.log(
        userId || 'system',
        userEmail || 'system@localhost',
        'created_client',
        'Client',
        savedClient.id,
        {
          name: savedClient.name,
          email: savedClient.email,
          phone: savedClient.phone,
        },
        businessId,
      );
    } catch (err) {
      // Audit logging failure should not fail the main operation
      console.error('Failed to log audit:', err);
    }

    return savedClient;
  }

  async findAll(businessId: string): Promise<any[]> {
    const clients = await this.clientRepository.find({
      where: { businessId },
      order: { name: 'ASC' },
    });

    // Get all invoices for these clients
    const clientIds = clients.map(c => c.id);
    const invoices = clientIds.length > 0 
      ? await this.invoiceRepository.find({
          where: { businessId },
        })
      : [];

    // Calculate computed fields for each client
    return clients.map(client => {
      const clientInvoices = invoices.filter(inv => inv.clientId === client.id);
      const totalInvoiced = clientInvoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0);
      const totalPaid = clientInvoices
        .filter(inv => inv.status === InvoiceStatus.PAID)
        .reduce((sum, inv) => sum + Number(inv.totalAmount), 0);
      const outstandingBalance = totalInvoiced - totalPaid;
      const invoiceCount = clientInvoices.length;

      return {
        ...client,
        totalInvoiced,
        totalPaid,
        outstandingBalance,
        invoiceCount,
      };
    });
  }

  async findOne(id: string, businessId: string): Promise<Client> {
    const client = await this.clientRepository.findOne({
      where: { id, businessId },
    });
    if (!client) {
      throw new NotFoundException('Client not found');
    }
    return client;
  }

  async getProfile(id: string, businessId: string): Promise<any> {
    const client = await this.findOne(id, businessId);

    // Get all invoices for this client
    const invoices = await this.invoiceRepository.find({
      where: { clientId: id, businessId },
      order: { createdAt: 'DESC' },
    });

    // Get all credit notes for this client (by clientName since that's what we have)
    const creditNotes = await this.creditNoteRepository.find({
      where: { clientName: client.name, businessId },
      order: { createdAt: 'DESC' },
    });

    // Get payments related to this client's invoices
    const invoiceIds = invoices.map(inv => inv.id);
    const payments = invoiceIds.length > 0
      ? await this.paymentRepository.find({
          where: invoiceIds.map(id => ({ referenceId: id, referenceType: 'invoice' })),
          order: { createdAt: 'DESC' },
        })
      : [];

    // Calculate stats
    const totalInvoiced = invoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0);
    const totalPaid = invoices
      .filter(inv => inv.status === InvoiceStatus.PAID)
      .reduce((sum, inv) => sum + Number(inv.totalAmount), 0);
    const outstandingBalance = totalInvoiced - totalPaid;
    
    const today = new Date();
    const overdueAmount = invoices
      .filter(inv => inv.status !== InvoiceStatus.PAID && inv.dueDate && new Date(inv.dueDate) < today)
      .reduce((sum, inv) => sum + Number(inv.totalAmount), 0);

    const invoiceCount = invoices.length;
    const creditNoteCount = creditNotes.length;

    return {
      client: {
        id: client.id,
        name: client.name,
        email: client.email,
        phone: client.phone,
        address: client.address,
        createdAt: client.createdAt,
      },
      stats: {
        totalInvoiced,
        totalPaid,
        outstandingBalance,
        overdueAmount,
        invoiceCount,
        creditNoteCount,
      },
      invoices: invoices.map(inv => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        date: inv.createdAt,
        dueDate: inv.dueDate,
        totalAmount: inv.totalAmount,
        status: inv.status,
        itemCount: inv.items?.length || 0,
      })),
      creditNotes: creditNotes.map(cn => ({
        id: cn.id,
        date: cn.date,
        amount: cn.amount,
        reason: cn.reason,
        status: cn.status,
        reference: cn.reference,
      })),
      payments: payments.map(p => ({
        id: p.id,
        date: p.date,
        amount: p.amount,
        method: p.method,
        reference: p.reference,
      })),
    };
  }

  async update(id: string, businessId: string, updateClientDto: UpdateClientDto, userId?: string, userEmail?: string): Promise<Client> {
    const client = await this.findOne(id, businessId);
    Object.assign(client, updateClientDto);
    const savedClient = await this.clientRepository.save(client);

    // Log audit
    try {
      await this.auditService.log(
        userId || 'system',
        userEmail || 'system@localhost',
        'updated_client',
        'Client',
        savedClient.id,
        {
          name: savedClient.name,
          changes: Object.keys(updateClientDto),
        },
        businessId,
      );
    } catch (err) {
      console.error('Failed to log audit:', err);
    }

    return savedClient;
  }

  async remove(id: string, businessId: string, userId?: string, userEmail?: string): Promise<void> {
    const client = await this.findOne(id, businessId);
    
    // Log audit before deletion
    try {
      await this.auditService.log(
        userId || 'system',
        userEmail || 'system@localhost',
        'deleted_client',
        'Client',
        client.id,
        {
          name: client.name,
          email: client.email,
        },
        businessId,
      );
    } catch (err) {
      console.error('Failed to log audit:', err);
    }

    await this.clientRepository.remove(client);
  }

  async validateClient(clientId: string, businessId: string): Promise<boolean> {
    const client = await this.clientRepository.findOne({
      where: { id: clientId, businessId },
    });
    return !!client;
  }
}
