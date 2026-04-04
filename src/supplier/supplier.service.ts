import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Supplier } from './entities/supplier.entity';
import { CreateSupplierDto, UpdateSupplierDto } from './dto/supplier.dto';
import { Expense } from '../expense/entities/expense.entity';
import { PurchaseOrder } from '../purchase-order/entities/purchase-order.entity';
import { Payment } from '../payment/entities/payment.entity';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class SupplierService {
  constructor(
    @InjectRepository(Supplier)
    private readonly supplierRepository: Repository<Supplier>,
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
    @InjectRepository(PurchaseOrder)
    private readonly purchaseOrderRepository: Repository<PurchaseOrder>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    private readonly auditService: AuditService,
  ) {}

  async create(businessId: string, createSupplierDto: CreateSupplierDto, userId?: string, userEmail?: string): Promise<Supplier> {
    const supplier = this.supplierRepository.create({
      ...createSupplierDto,
      businessId,
    });
    const savedSupplier = await this.supplierRepository.save(supplier);

    // Log audit
    try {
      await this.auditService.log(
        userId || 'system',
        userEmail || 'system@localhost',
        'created_supplier',
        'Supplier',
        savedSupplier.id,
        {
          name: savedSupplier.name,
          email: savedSupplier.email,
          phone: savedSupplier.phone,
        },
        businessId,
      );
    } catch (err) {
      console.error('Failed to log audit:', err);
    }

    return savedSupplier;
  }

  async findAll(businessId: string): Promise<any[]> {
    const suppliers = await this.supplierRepository.find({
      where: { businessId },
      order: { name: 'ASC' },
    });

    // Get all expenses and purchase orders for these suppliers
    const supplierIds = suppliers.map(s => s.id);
    
    const [expenses, purchaseOrders] = await Promise.all([
      supplierIds.length > 0
        ? await this.expenseRepository.find({
            where: supplierIds.map(id => ({ supplierId: id, businessId })),
          })
        : [],
      supplierIds.length > 0
        ? await this.purchaseOrderRepository.find({
            where: supplierIds.map(id => ({ supplierId: id, businessId })),
          })
        : [],
    ]);

    // Calculate computed fields for each supplier
    return suppliers.map(supplier => {
      const supplierExpenses = expenses.filter(e => e.supplierId === supplier.id);
      const supplierOrders = purchaseOrders.filter(o => o.supplierId === supplier.id);
      
      const totalPurchased = supplierExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
      const totalPaid = supplierExpenses
        .filter(e => e.status === 'approved')
        .reduce((sum, e) => sum + Number(e.amount), 0);
      const outstandingBalance = totalPurchased - totalPaid;
      const expenseCount = supplierExpenses.length;
      const orderCount = supplierOrders.length;

      return {
        ...supplier,
        totalPurchased,
        totalPaid,
        outstandingBalance,
        expenseCount,
        orderCount,
      };
    });
  }

  async findOne(id: string, businessId: string): Promise<Supplier> {
    const supplier = await this.supplierRepository.findOne({
      where: { id, businessId },
    });
    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }
    return supplier;
  }

  async getProfile(id: string, businessId: string): Promise<any> {
    const supplier = await this.findOne(id, businessId);

    // Get all expenses for this supplier
    const expenses = await this.expenseRepository.find({
      where: { supplierId: id, businessId },
      order: { createdAt: 'DESC' },
    });

    // Get all purchase orders for this supplier
    const purchaseOrders = await this.purchaseOrderRepository.find({
      where: { supplierId: id, businessId },
      order: { date: 'DESC' },
    });

    // Get payments related to this supplier's expenses
    const expenseIds = expenses.map(e => e.id);
    const payments = expenseIds.length > 0
      ? await this.paymentRepository.find({
          where: expenseIds.map(id => ({ referenceId: id, referenceType: 'expense' })),
          order: { createdAt: 'DESC' },
        })
      : [];

    // Calculate stats
    const totalPurchased = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const totalPaid = expenses
      .filter(e => e.status === 'approved')
      .reduce((sum, e) => sum + Number(e.amount), 0);
    const outstandingBalance = totalPurchased - totalPaid;
    const expenseCount = expenses.length;
    const orderCount = purchaseOrders.length;

    return {
      supplier: {
        id: supplier.id,
        name: supplier.name,
        email: supplier.email,
        phone: supplier.phone,
        address: supplier.address,
        createdAt: supplier.createdAt,
      },
      stats: {
        totalPurchased,
        totalPaid,
        outstandingBalance,
        orderCount,
        expenseCount,
      },
      purchaseOrders: purchaseOrders.map(po => ({
        id: po.id,
        orderNumber: po.id.slice(-8).toUpperCase(), // Generate order number from ID
        date: po.date,
        totalAmount: po.totalAmount,
        status: po.status,
        itemCount: 0, // PurchaseOrder entity doesn't have items relation in current code
        supplierName: po.supplierName,
      })),
      expenses: expenses.map(e => ({
        id: e.id,
        date: e.date,
        amount: e.amount,
        category: e.category,
        status: e.status,
        reference: e.description || '-',
        receiptUrl: e.receiptUrl,
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

  async update(id: string, businessId: string, updateSupplierDto: UpdateSupplierDto, userId?: string, userEmail?: string): Promise<Supplier> {
    const supplier = await this.findOne(id, businessId);
    Object.assign(supplier, updateSupplierDto);
    const savedSupplier = await this.supplierRepository.save(supplier);

    // Log audit
    try {
      await this.auditService.log(
        userId || 'system',
        userEmail || 'system@localhost',
        'updated_supplier',
        'Supplier',
        savedSupplier.id,
        {
          name: savedSupplier.name,
          changes: Object.keys(updateSupplierDto),
        },
        businessId,
      );
    } catch (err) {
      console.error('Failed to log audit:', err);
    }

    return savedSupplier;
  }

  async remove(id: string, businessId: string, userId?: string, userEmail?: string): Promise<void> {
    const supplier = await this.findOne(id, businessId);
    
    // Log audit before deletion
    try {
      await this.auditService.log(
        userId || 'system',
        userEmail || 'system@localhost',
        'deleted_supplier',
        'Supplier',
        supplier.id,
        {
          name: supplier.name,
          email: supplier.email,
        },
        businessId,
      );
    } catch (err) {
      console.error('Failed to log audit:', err);
    }

    await this.supplierRepository.remove(supplier);
  }

  async validateSupplier(supplierId: string, businessId: string): Promise<boolean> {
    const supplier = await this.supplierRepository.findOne({
      where: { id: supplierId, businessId },
    });
    return !!supplier;
  }
}
