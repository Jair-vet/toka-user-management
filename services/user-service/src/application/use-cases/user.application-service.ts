import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Like, Repository } from 'typeorm';
import { EventPublisher, PaginatedResult } from '@toka/shared-kernel';
import { UserOrmEntity } from '../../infrastructure/persistence/typeorm/user.orm-entity';
import { User, UserStatus } from '../../domain/entities/user.entity';
import {
  CreateUserDto,
  UpdateUserDto,
  UserResponseDto,
} from '../dtos/user.dto';
import { UserCreatedEvent } from '../../domain/events/user-created.event';
import { UserUpdatedEvent } from '../../domain/events/user-updated.event';
import { UserDeletedEvent } from '../../domain/events/user-deleted.event';

@Injectable()
export class UserApplicationService {
  private readonly logger = new Logger(UserApplicationService.name);

  constructor(
    @InjectRepository(UserOrmEntity)
    private readonly userRepo: Repository<UserOrmEntity>,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async create(dto: CreateUserDto): Promise<UserResponseDto> {
    const existing = await this.userRepo.findOne({
      where: { email: dto.email.toLowerCase() },
      withDeleted: true,
    });
    if (existing) throw new BadRequestException('Email already registered');

    const orm = this.userRepo.create({
      email: dto.email.toLowerCase().trim(),
      firstName: dto.firstName.trim(),
      lastName: dto.lastName.trim(),
      status: UserStatus.ACTIVE,
      avatarUrl: dto.avatarUrl ?? null,
    });

    const saved = await this.userRepo.save(orm);

    await this.eventPublisher.publish(
      'user.events',
      'user.created',
      new UserCreatedEvent(saved.id, saved.email, saved.firstName, saved.lastName),
    );

    this.logger.log({ message: 'User created', userId: saved.id, action: 'user.created' });
    return this.toDto(saved);
  }

  async findAll(options: { page: number; limit: number; search?: string; status?: string }): Promise<PaginatedResult<UserResponseDto>> {
    const { page, limit, search, status } = options;
    const where: Record<string, unknown> = { deletedAt: IsNull() };
    if (status) where['status'] = status;

    const query = this.userRepo.createQueryBuilder('u')
      .where('u.deleted_at IS NULL');

    if (search) {
      query.andWhere(
        '(u.email ILIKE :search OR u.first_name ILIKE :search OR u.last_name ILIKE :search)',
        { search: `%${search}%` },
      );
    }
    if (status) query.andWhere('u.status = :status', { status });

    const total = await query.getCount();
    const data = await query
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('u.created_at', 'DESC')
      .getMany();

    return {
      data: data.map(this.toDto),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string): Promise<UserResponseDto> {
    const user = await this.userRepo.findOne({ where: { id, deletedAt: IsNull() } });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return this.toDto(user);
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserResponseDto> {
    const user = await this.userRepo.findOne({ where: { id, deletedAt: IsNull() } });
    if (!user) throw new NotFoundException(`User ${id} not found`);

    Object.assign(user, {
      ...(dto.firstName && { firstName: dto.firstName.trim() }),
      ...(dto.lastName && { lastName: dto.lastName.trim() }),
      ...(dto.status && { status: dto.status }),
      ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl }),
    });

    const saved = await this.userRepo.save(user);
    await this.eventPublisher.publish(
      'user.events',
      'user.updated',
      new UserUpdatedEvent(saved.id, saved.email),
    );
    this.logger.log({ message: 'User updated', userId: saved.id, action: 'user.updated' });
    return this.toDto(saved);
  }

  async softDelete(id: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id, deletedAt: IsNull() } });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    await this.userRepo.softDelete(id);
    await this.eventPublisher.publish(
      'user.events',
      'user.deleted',
      new UserDeletedEvent(user.id, user.email),
    );
    this.logger.log({ message: 'User deleted', userId: id, action: 'user.deleted' });
  }

  private toDto(orm: UserOrmEntity): UserResponseDto {
    return {
      id: orm.id,
      email: orm.email,
      firstName: orm.firstName,
      lastName: orm.lastName,
      fullName: `${orm.firstName} ${orm.lastName}`,
      status: orm.status,
      avatarUrl: orm.avatarUrl,
      createdAt: orm.createdAt,
      updatedAt: orm.updatedAt,
    };
  }
}
