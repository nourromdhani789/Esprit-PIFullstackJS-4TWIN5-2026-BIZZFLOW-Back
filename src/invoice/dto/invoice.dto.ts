import { InvoiceStatus } from '../entities/invoice.entity';

export class CreateInvoiceItemDto {
  productId: string;
  quantity: number;
  price: number;
  description?: string;
}

export class CreateInvoiceDto {
  clientId: string;
  clientName?: string;
  clientEmail?: string;
  status?: InvoiceStatus;
  notes?: string;
  dueDate?: Date;
  items: CreateInvoiceItemDto[];
}

export class UpdateInvoiceDto {
  clientId?: string;
  clientName?: string;
  clientEmail?: string;
  status?: InvoiceStatus;
  notes?: string;
  dueDate?: Date;
}

export class SendInvoiceEmailDto {
  email: string;
  subject?: string;
  message?: string;
}
