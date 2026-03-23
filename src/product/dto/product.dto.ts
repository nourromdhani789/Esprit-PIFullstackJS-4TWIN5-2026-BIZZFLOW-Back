export class CreateProductDto {
  name: string;
  price: number;
  category?: string;
  description?: string;
}

export class UpdateProductDto {
  name?: string;
  price?: number;
  category?: string;
  description?: string;
}
