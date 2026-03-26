import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { CreditNote } from './entities/credit-note.entity';
import { Payment } from '../payment/entities/payment.entity';
import { Cash } from '../cash/entities/cash.entity';
import { CreateCreditNoteDto, UpdateCreditNoteDto } from './dto/credit-note.dto';

@Injectable()
export class CreditNoteService {
  constructor(
    @InjectRepository(CreditNote)
    private readonly creditNoteRepository: Repository<CreditNote>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Cash)
    private readonly cashRepository: Repository<Cash>,
    private readonly dataSource: DataSource,
  ) {}

  async create(businessId: string, createDto: CreateCreditNoteDto): Promise<CreditNote> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Create credit note
      const creditNote = this.creditNoteRepository.create({
        ...createDto,
        businessId,
        date: createDto.date || new Date(),
        status: 'active',
      });
      const savedCreditNote = await queryRunner.manager.save(creditNote);

      // AUTO: Create payment and decrease cash immediately
      const payment = this.paymentRepository.create({
        type: 'OUT',
        amount: creditNote.amount,
        method: 'transfer',
        description: `Credit Note: ${creditNote.reason} - Client: ${creditNote.clientName}`,
        referenceId: creditNote.id,
        referenceType: 'credit_note',
        date: new Date(),
        businessId,
      });
      await queryRunner.manager.save(payment);

      // Update cash balance (decrease) - calculate dynamically from all payments
      const allPayments = await this.paymentRepository.find({ where: { businessId } });
      let currentBalance = 0;
      for (const p of allPayments) {
        currentBalance += p.type === 'IN' ? Number(p.amount) : -Number(p.amount);
      }
      
      // Check sufficient balance
      if (currentBalance < Number(creditNote.amount)) {
        throw new ForbiddenException('Insufficient cash balance for this credit note');
      }
      
      // Update stored cash record with correct calculated balance minus credit note
      let cash = await this.cashRepository.findOne({ where: { businessId } });
      if (!cash) {
        cash = this.cashRepository.create({
          businessId,
          currentBalance: 0,
        });
      }
      cash.currentBalance = currentBalance - Number(creditNote.amount);
      await queryRunner.manager.save(cash);

      await queryRunner.commitTransaction();
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
      order: { date: 'DESC' },
    });
  }

  async findOne(id: string, businessId: string): Promise<CreditNote> {
    const creditNote = await this.creditNoteRepository.findOne({
      where: { id, businessId },
    });

    if (!creditNote) {
      throw new NotFoundException('Credit note not found');
    }

    return creditNote;
  }

  async update(id: string, businessId: string, updateDto: UpdateCreditNoteDto): Promise<CreditNote> {
    const creditNote = await this.findOne(id, businessId);

    if (creditNote.status !== 'active') {
      throw new NotFoundException('Can only update active credit notes');
    }

    Object.assign(creditNote, updateDto);
    return this.creditNoteRepository.save(creditNote);
  }

  async cancel(id: string, businessId: string): Promise<CreditNote> {
    const creditNote = await this.findOne(id, businessId);
    creditNote.status = 'cancelled';
    return this.creditNoteRepository.save(creditNote);
  }

  // AUTO: Apply credit note and create cash outflow
  async apply(id: string, businessId: string): Promise<CreditNote> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const creditNote = await this.findOne(id, businessId);
      
      if (creditNote.status !== 'active') {
        throw new ForbiddenException('Can only apply active credit notes');
      }

      // Update credit note status
      creditNote.status = 'used';
      const savedCreditNote = await queryRunner.manager.save(creditNote);

      // AUTO: Create payment record (Money OUT - Refund/Discount given)
      const payment = this.paymentRepository.create({
        type: 'OUT',
        amount: creditNote.amount,
        method: 'transfer',
        description: `Credit Note applied: ${creditNote.reason} - Client: ${creditNote.clientName}`,
        referenceId: creditNote.id,
        referenceType: 'credit_note',
        date: new Date(),
        businessId,
      });
      await queryRunner.manager.save(payment);

      // Update cash balance (decrease)
      let cash = await this.cashRepository.findOne({ where: { businessId } });
      if (!cash) {
        cash = this.cashRepository.create({
          businessId,
          currentBalance: 0,
        });
      }
      
      // Check sufficient balance
      if (cash.currentBalance < Number(creditNote.amount)) {
        throw new ForbiddenException('Insufficient cash balance for this credit note');
      }
      
      cash.currentBalance -= Number(creditNote.amount);
      await queryRunner.manager.save(cash);

      await queryRunner.commitTransaction();
      return savedCreditNote;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async remove(id: string, businessId: string): Promise<void> {
    const creditNote = await this.findOne(id, businessId);
    await this.creditNoteRepository.remove(creditNote);
  }
}
