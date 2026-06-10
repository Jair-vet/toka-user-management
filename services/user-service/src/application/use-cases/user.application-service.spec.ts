import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { EventPublisher } from '@toka/shared-kernel';
import { IsNull } from 'typeorm';
import { UserStatus } from '../../domain/entities/user.entity';
import { UserOrmEntity } from '../../infrastructure/persistence/typeorm/user.orm-entity';
import { UserApplicationService } from './user.application-service';

const userRepo = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  createQueryBuilder: jest.fn(),
  softDelete: jest.fn(),
};

const eventPublisher = { publish: jest.fn() };

describe('UserApplicationService', () => {
  let service: UserApplicationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserApplicationService,
        { provide: getRepositoryToken(UserOrmEntity), useValue: userRepo },
        { provide: EventPublisher, useValue: eventPublisher },
      ],
    }).compile();

    service = module.get(UserApplicationService);
    jest.clearAllMocks();
  });

  it('throws BadRequestException if email already exists', async () => {
    userRepo.findOne.mockResolvedValueOnce({ id: 'existing-id' });

    await expect(
      service.create({ email: 'exists@test.com', firstName: 'John', lastName: 'Doe' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('creates user and publishes user.created', async () => {
    const created = {
      email: 'new@test.com',
      firstName: 'Jane',
      lastName: 'Smith',
      status: UserStatus.ACTIVE,
      avatarUrl: null,
    };
    const saved = {
      id: 'new-id',
      ...created,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    userRepo.findOne.mockResolvedValueOnce(null);
    userRepo.create.mockReturnValueOnce(created);
    userRepo.save.mockResolvedValueOnce(saved);

    const result = await service.create({
      email: ' NEW@Test.com ',
      firstName: ' Jane ',
      lastName: ' Smith ',
    });

    expect(userRepo.create).toHaveBeenCalledWith(expect.objectContaining({ email: 'new@test.com' }));
    expect(eventPublisher.publish).toHaveBeenCalledWith('user.events', 'user.created', expect.any(Object));
    expect(result.email).toBe('new@test.com');
  });

  it('throws NotFoundException when user is missing', async () => {
    userRepo.findOne.mockResolvedValueOnce(null);

    await expect(service.findById('user-1')).rejects.toThrow(NotFoundException);
    expect(userRepo.findOne).toHaveBeenCalledWith({ where: { id: 'user-1', deletedAt: IsNull() } });
  });

  it('soft deletes and publishes user.deleted', async () => {
    userRepo.findOne.mockResolvedValueOnce({ id: 'user-1', email: 'user@test.com' });
    userRepo.softDelete.mockResolvedValueOnce({ affected: 1 });

    await service.softDelete('user-1');

    expect(userRepo.softDelete).toHaveBeenCalledWith('user-1');
    expect(eventPublisher.publish).toHaveBeenCalledWith('user.events', 'user.deleted', expect.any(Object));
  });

  it('finds users with pagination and search', async () => {
    const query = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(1),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          id: 'user-1',
          email: 'user@test.com',
          firstName: 'Test',
          lastName: 'User',
          status: UserStatus.ACTIVE,
          avatarUrl: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]),
    };
    userRepo.createQueryBuilder.mockReturnValueOnce(query);

    const result = await service.findAll({ page: 1, limit: 10, search: 'test', status: UserStatus.ACTIVE });

    expect(result.data).toHaveLength(1);
    expect(result.meta.total).toBe(1);
    expect(query.andWhere).toHaveBeenCalledTimes(2);
  });

  it('updates user profile and status', async () => {
    const existing = {
      id: 'user-1',
      email: 'user@test.com',
      firstName: 'Old',
      lastName: 'Name',
      status: UserStatus.PENDING,
      avatarUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const saved = { ...existing, firstName: 'New', status: UserStatus.ACTIVE };
    userRepo.findOne.mockResolvedValueOnce(existing);
    userRepo.save.mockResolvedValueOnce(saved);
    eventPublisher.publish.mockResolvedValueOnce(undefined);

    const result = await service.update('user-1', { firstName: ' New ', status: UserStatus.ACTIVE });

    expect(result.firstName).toBe('New');
    expect(result.status).toBe(UserStatus.ACTIVE);
    expect(eventPublisher.publish).toHaveBeenCalledWith('user.events', 'user.updated', expect.any(Object));
  });
});
