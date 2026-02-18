import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Business } from './entities/business.entity';
import { CreateBusinessDto } from './dtos/create-business.dto';
import { BusinessCategory } from './entities/business-category.entity';

@Injectable()
export class BusinessService {
  constructor(
    @InjectRepository(Business)
    private businessRepository: Repository<Business>,
    @InjectRepository(BusinessCategory)
    private categoryRepository: Repository<BusinessCategory>,
  ) {}

  async create(createBusinessDto: CreateBusinessDto, tenantId: string): Promise<Business> {
    const business = this.businessRepository.create({
      ...createBusinessDto,
      tenantId,
    });
    return this.businessRepository.save(business);
  }

  async findAll(): Promise<Business[]> {
    return this.businessRepository.find({
      relations: ['categories', 'userEntities'],
    });
  }

  async findOne(id: string): Promise<Business> {
    const business = await this.businessRepository.findOne({
      where: { id },
      relations: ['categories', 'userEntities'],
    });

    if (!business) {
      throw new NotFoundException(`Business with ID ${id} not found`);
    }

    return business;
  }

  async findByTenant(tenantId: string): Promise<Business[]> {
    return this.businessRepository.find({
      where: { tenantId },
      relations: ['categories', 'userEntities'],
    });
  }

  async update(id: string, updateBusinessDto: Partial<CreateBusinessDto>): Promise<Business> {
    const business = await this.findOne(id);
    
    Object.assign(business, updateBusinessDto);
    
    return this.businessRepository.save(business);
  }

  async remove(id: string): Promise<void> {
    const business = await this.findOne(id);
    await this.businessRepository.remove(business);
  }
}
