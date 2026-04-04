import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { CreditNote } from './entities/credit-note.entity';
import { Invoice } from '../invoice/entities/invoice.entity';
import { Payment } from '../payment/entities/payment.entity';
import { Cash } from '../cash/entities/cash.entity';
import { CreateCreditNoteDto, UpdateCreditNoteDto } from './dto/credit-note.dto';
import { AuditService } from '../audit/audit.service';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class CreditNoteService {
  constructor(
    @InjectRepository(CreditNote)
    private readonly creditNoteRepository: Repository<CreditNote>,
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Cash)
    private readonly cashRepository: Repository<Cash>,
    private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
    private readonly notificationService: NotificationService,
  ) {}

  async create(businessId: string, createDto: CreateCreditNoteDto, userId?: string, userEmail?: string): Promise<CreditNote> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Create credit note with draft status
      const creditNote = this.creditNoteRepository.create({
        ...createDto,
        businessId,
        date: createDto.date || new Date(),
        status: 'draft',
      });
      const savedCreditNote = await queryRunner.manager.save(creditNote);

      await queryRunner.commitTransaction();

      // Log audit
      await this.auditService.log(
        userId || 'system',
        userEmail || 'system@localhost',
        'created_credit_note',
        'CreditNote',
        savedCreditNote.id,
        {
          amount: savedCreditNote.amount,
          clientName: savedCreditNote.clientName,
          reason: savedCreditNote.reason,
          invoiceId: savedCreditNote.invoiceId,
        },
        businessId,
      );

      // Create notification for new credit note
      try {
        await this.notificationService.create(
          businessId,
          'New Credit Note Created',
          `Credit note of TND ${Number(savedCreditNote.amount).toFixed(3)} created for ${savedCreditNote.clientName}`,
          'info',
          'credit_note',
          `/credit-notes/${savedCreditNote.id}`,
          savedCreditNote.id,
          'CreditNote',
        );
      } catch (err) {
        console.error('Failed to create notification:', err);
      }

      return savedCreditNote;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(businessId: string, status?: string): Promise<CreditNote[]> {
    const where: any = { businessId };
    if (status) {
      where.status = status;
    }

    return this.creditNoteRepository.find({
      where,
      relations: ['invoice'],
      order: { date: 'DESC' },
    });
  }

  async findOne(id: string, businessId: string): Promise<CreditNote> {
    const creditNote = await this.creditNoteRepository.findOne({
      where: { id, businessId },
      relations: ['invoice'],
    });

    if (!creditNote) {
      throw new NotFoundException('Credit note not found');
    }

    return creditNote;
  }

  async update(id: string, businessId: string, updateDto: UpdateCreditNoteDto, userId?: string, userEmail?: string): Promise<CreditNote> {
    const creditNote = await this.findOne(id, businessId);

    // Only draft credit notes can be edited
    if (creditNote.status !== 'draft') {
      throw new ForbiddenException('Can only edit draft credit notes');
    }

    Object.assign(creditNote, updateDto);
    const savedCreditNote = await this.creditNoteRepository.save(creditNote);

    // Log audit
    await this.auditService.log(
      userId || 'system',
      userEmail || 'system@localhost',
      'updated_credit_note',
      'CreditNote',
      savedCreditNote.id,
      {
        amount: savedCreditNote.amount,
        clientName: savedCreditNote.clientName,
        changes: Object.keys(updateDto),
      },
      businessId,
    );

    return savedCreditNote;
  }

  // Approve: draft -> approved
  async approve(id: string, businessId: string, userId?: string, userEmail?: string): Promise<CreditNote> {
    const creditNote = await this.findOne(id, businessId);

    if (creditNote.status !== 'draft') {
      throw new ForbiddenException('Can only approve draft credit notes');
    }

    creditNote.status = 'approved';
    const savedCreditNote = await this.creditNoteRepository.save(creditNote);

    // Log audit
    await this.auditService.log(
      userId || 'system',
      userEmail || 'system@localhost',
      'approved_credit_note',
      'CreditNote',
      savedCreditNote.id,
      {
        amount: savedCreditNote.amount,
        clientName: savedCreditNote.clientName,
      },
      businessId,
    );

    // Create notification for approved credit note
    try {
      await this.notificationService.create(
        businessId,
        'Credit Note Approved',
        `Credit note of TND ${Number(savedCreditNote.amount).toFixed(3)} for ${savedCreditNote.clientName} has been approved`,
        'success',
        'credit_note',
        `/credit-notes/${savedCreditNote.id}`,
        savedCreditNote.id,
        'CreditNote',
      );
    } catch (err) {
      console.error('Failed to create notification:', err);
    }

    return savedCreditNote;
  }

  // Apply: approved -> applied (deduct from invoice balance, create payment IN)
  async apply(id: string, businessId: string, userId?: string, userEmail?: string): Promise<CreditNote> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const creditNote = await this.findOne(id, businessId);

      if (creditNote.status !== 'approved') {
        throw new ForbiddenException('Can only apply approved credit notes');
      }

      // If linked to invoice, reduce invoice remaining balance
      if (creditNote.invoiceId) {
        const invoice = await this.invoiceRepository.findOne({
          where: { id: creditNote.invoiceId, businessId },
        });

        if (invoice) {
          // Reduce invoice totalAmount by credit note amount
          invoice.totalAmount = Number(invoice.totalAmount) - Number(creditNote.amount);
          if (invoice.totalAmount < 0) invoice.totalAmount = 0;
          await queryRunner.manager.save(invoice);
        }
      }

      // Create payment record (Money IN - Credit Note Applied)
      const payment = this.paymentRepository.create({
        type: 'IN',
        amount: creditNote.amount,
        method: 'transfer',
        description: `Credit Note applied: ${creditNote.reason} - Client: ${creditNote.clientName}`,
        referenceId: creditNote.id,
        referenceType: 'credit_note',
        date: new Date(),
        businessId,
      });
      const savedPayment = await queryRunner.manager.save(payment);
      console.log('Payment created for apply:', savedPayment);

      // Update cash balance (increase - we're collecting what was owed)
      let cash = await this.cashRepository.findOne({ where: { businessId } });
      if (!cash) {
        cash = this.cashRepository.create({
          businessId,
          currentBalance: 0,
        });
      }
      cash.currentBalance = Number(cash.currentBalance) + Number(creditNote.amount);
      await queryRunner.manager.save(cash);

      creditNote.status = 'applied';
      const savedCreditNote = await queryRunner.manager.save(creditNote);

      await queryRunner.commitTransaction();

      // Log audit
      await this.auditService.log(
        userId || 'system',
        userEmail || 'system@localhost',
        'applied_credit_note',
        'CreditNote',
        savedCreditNote.id,
        {
          amount: savedCreditNote.amount,
          clientName: savedCreditNote.clientName,
          invoiceId: savedCreditNote.invoiceId,
        },
        businessId,
      );

      // Create notification for applied credit note
      try {
        await this.notificationService.create(
          businessId,
          'Credit Note Applied',
          `Credit note of TND ${Number(savedCreditNote.amount).toFixed(3)} applied to invoice for ${savedCreditNote.clientName}`,
          'success',
          'credit_note',
          `/credit-notes/${savedCreditNote.id}`,
          savedCreditNote.id,
          'CreditNote',
        );
      } catch (err) {
        console.error('Failed to create notification:', err);
      }

      return savedCreditNote;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // Refund: approved -> refunded (create payment OUT)
  async refund(id: string, businessId: string, userId?: string, userEmail?: string): Promise<CreditNote> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const creditNote = await this.findOne(id, businessId);

      if (creditNote.status !== 'approved') {
        throw new ForbiddenException('Can only refund approved credit notes');
      }

      // Check sufficient cash balance
      let cash = await this.cashRepository.findOne({ where: { businessId } });
      if (!cash) {
        cash = this.cashRepository.create({
          businessId,
          currentBalance: 0,
        });
      }

      if (Number(cash.currentBalance) < Number(creditNote.amount)) {
        throw new ForbiddenException('Insufficient cash balance for this refund');
      }

      // Create payment record (Money OUT - Refund)
      const payment = this.paymentRepository.create({
        type: 'OUT',
        amount: creditNote.amount,
        method: 'transfer',
        description: `Credit Note refund: ${creditNote.reason} - Client: ${creditNote.clientName}`,
        referenceId: creditNote.id,
        referenceType: 'credit_note',
        date: new Date(),
        businessId,
      });
      const savedPayment = await queryRunner.manager.save(payment);
      console.log('Payment created for refund:', savedPayment);

      // Update cash balance (decrease)
      cash.currentBalance = Number(cash.currentBalance) - Number(creditNote.amount);
      await queryRunner.manager.save(cash);

      creditNote.status = 'refunded';
      const savedCreditNote = await queryRunner.manager.save(creditNote);

      await queryRunner.commitTransaction();

      // Log audit
      await this.auditService.log(
        userId || 'system',
        userEmail || 'system@localhost',
        'refunded_credit_note',
        'CreditNote',
        savedCreditNote.id,
        {
          amount: savedCreditNote.amount,
          clientName: savedCreditNote.clientName,
        },
        businessId,
      );

      // Create notification for refunded credit note
      try {
        await this.notificationService.create(
          businessId,
          'Credit Note Refunded',
          `Credit note of TND ${Number(savedCreditNote.amount).toFixed(3)} refunded to ${savedCreditNote.clientName}`,
          'warning',
          'credit_note',
          `/credit-notes/${savedCreditNote.id}`,
          savedCreditNote.id,
          'CreditNote',
        );
      } catch (err) {
        console.error('Failed to create notification:', err);
      }

      return savedCreditNote;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // Cancel: any status -> cancelled (reverse effects if applied or refunded)
  async cancel(id: string, businessId: string, userId?: string, userEmail?: string): Promise<CreditNote> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const creditNote = await this.findOne(id, businessId);

      if (creditNote.status === 'cancelled') {
        throw new ForbiddenException('Credit note is already cancelled');
      }

      // If was applied, reverse the invoice balance change and cash/payment
      if (creditNote.status === 'applied') {
        // Restore invoice balance if linked
        if (creditNote.invoiceId) {
          const invoice = await this.invoiceRepository.findOne({
            where: { id: creditNote.invoiceId, businessId },
          });
          if (invoice) {
            invoice.totalAmount = Number(invoice.totalAmount) + Number(creditNote.amount);
            await queryRunner.manager.save(invoice);
          }
        }

        // Reverse cash (decrease since we added it before)
        let cash = await this.cashRepository.findOne({ where: { businessId } });
        if (cash) {
          cash.currentBalance = Number(cash.currentBalance) - Number(creditNote.amount);
          await queryRunner.manager.save(cash);
        }

        // Create reversing payment record (Money OUT to reverse the IN)
        const payment = this.paymentRepository.create({
          type: 'OUT',
          amount: creditNote.amount,
          method: 'transfer',
          description: `Credit Note cancelled: ${creditNote.reason} - Client: ${creditNote.clientName}`,
          referenceId: creditNote.id,
          referenceType: 'credit_note',
          date: new Date(),
          businessId,
        });
        await queryRunner.manager.save(payment);
      }

      // If was refunded, reverse the cash outflow (add back to cash)
      if (creditNote.status === 'refunded') {
        // Restore cash balance (add back)
        let cash = await this.cashRepository.findOne({ where: { businessId } });
        if (cash) {
          cash.currentBalance = Number(cash.currentBalance) + Number(creditNote.amount);
          await queryRunner.manager.save(cash);
        }

        // Create reversing payment record (Money IN to reverse the OUT)
        const payment = this.paymentRepository.create({
          type: 'IN',
          amount: creditNote.amount,
          method: 'transfer',
          description: `Credit Note refund cancelled: ${creditNote.reason} - Client: ${creditNote.clientName}`,
          referenceId: creditNote.id,
          referenceType: 'credit_note',
          date: new Date(),
          businessId,
        });
        await queryRunner.manager.save(payment);
      }

      creditNote.status = 'cancelled';
      const savedCreditNote = await queryRunner.manager.save(creditNote);

      await queryRunner.commitTransaction();

      // Log audit
      await this.auditService.log(
        userId || 'system',
        userEmail || 'system@localhost',
        'cancelled_credit_note',
        'CreditNote',
        savedCreditNote.id,
        {
          amount: savedCreditNote.amount,
          clientName: savedCreditNote.clientName,
          previousStatus: creditNote.status,
        },
        businessId,
      );

      // Create notification for cancelled credit note
      try {
        await this.notificationService.create(
          businessId,
          'Credit Note Cancelled',
          `Credit note of TND ${Number(savedCreditNote.amount).toFixed(3)} for ${savedCreditNote.clientName} has been cancelled`,
          'error',
          'credit_note',
          `/credit-notes/${savedCreditNote.id}`,
          savedCreditNote.id,
          'CreditNote',
        );
      } catch (err) {
        console.error('Failed to create notification:', err);
      }

      return savedCreditNote;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async remove(id: string, businessId: string, userId?: string, userEmail?: string): Promise<void> {
    const creditNote = await this.findOne(id, businessId);
    
    // Only draft credit notes can be deleted
    if (creditNote.status !== 'draft') {
      throw new ForbiddenException('Can only delete draft credit notes');
    }

    // Log audit before deletion
    await this.auditService.log(
      userId || 'system',
      userEmail || 'system@localhost',
      'deleted_credit_note',
      'CreditNote',
      creditNote.id,
      {
        amount: creditNote.amount,
        clientName: creditNote.clientName,
        reason: creditNote.reason,
      },
      businessId,
    );
    
    await this.creditNoteRepository.remove(creditNote);
  }

  // Summary endpoint
  async getSummary(businessId: string) {
    const allCreditNotes = await this.creditNoteRepository.find({
      where: { businessId },
    });

    const totalActive = allCreditNotes
      .filter(cn => cn.status === 'approved')
      .reduce((sum, cn) => sum + Number(cn.amount), 0);

    const totalApplied = allCreditNotes
      .filter(cn => cn.status === 'applied')
      .reduce((sum, cn) => sum + Number(cn.amount), 0);

    const totalRefunded = allCreditNotes
      .filter(cn => cn.status === 'refunded')
      .reduce((sum, cn) => sum + Number(cn.amount), 0);

    const count = allCreditNotes.filter(cn => cn.status === 'approved').length;

    return {
      totalActive,
      totalApplied,
      totalRefunded,
      count,
    };
  }
}
