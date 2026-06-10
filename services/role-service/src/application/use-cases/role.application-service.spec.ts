import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { EventPublisher } from '@toka/shared-kernel';
import { PermissionOrmEntity } from '../../infrastructure/persistence/typeorm/permission.orm-entity';
import { RoleOrmEntity } from '../../infrastructure/persistence/typeorm/role.orm-entity';
import { UserRoleOrmEntity } from '../../infrastructure/persistence/typeorm/user-role.orm-entity';
import { RoleApplicationService } from './role.application-service';

const roleRepo = {
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  delete: jest.fn(),
};
const permissionRepo = { find: jest.fn() };
const userRoleRepo = {
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  delete: jest.fn(),
};
const eventPublisher = { publish: jest.fn() };

describe('RoleApplicationService', () => {
  let service: RoleApplicationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoleApplicationService,
        { provide: getRepositoryToken(RoleOrmEntity), useValue: roleRepo },
        { provide: getRepositoryToken(PermissionOrmEntity), useValue: permissionRepo },
        { provide: getRepositoryToken(UserRoleOrmEntity), useValue: userRoleRepo },
        { provide: EventPublisher, useValue: eventPublisher },
      ],
    }).compile();

    service = module.get(RoleApplicationService);
    jest.clearAllMocks();
  });

  it('returns all roles', async () => {
    roleRepo.find.mockResolvedValueOnce([
      {
        id: 'role-1',
        name: 'ADMIN',
        description: 'Admin',
        isSystem: true,
        createdAt: new Date(),
        permissions: [],
      },
    ]);

    const result = await service.findAll();

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('ADMIN');
  });

  it('throws BadRequestException if role name exists', async () => {
    roleRepo.findOne.mockResolvedValueOnce({ id: 'existing' });

    await expect(
      service.create({ name: 'admin', description: 'duplicate' }, 'actor-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('creates role and publishes role.created', async () => {
    const saved = {
      id: 'role-2',
      name: 'EDITOR',
      description: 'Editor role',
      isSystem: false,
      createdAt: new Date(),
      permissions: [],
    };
    roleRepo.findOne.mockResolvedValueOnce(null);
    roleRepo.create.mockReturnValueOnce(saved);
    roleRepo.save.mockResolvedValueOnce(saved);
    eventPublisher.publish.mockResolvedValueOnce(undefined);

    const result = await service.create({ name: 'editor', description: 'Editor role' }, 'actor-1');

    expect(result.name).toBe('EDITOR');
    expect(eventPublisher.publish).toHaveBeenCalledWith('role.events', 'role.created', expect.any(Object));
  });

  it('throws NotFoundException if assigned role does not exist', async () => {
    roleRepo.findOne.mockResolvedValueOnce(null);

    await expect(
      service.assignRole('missing-role', { userId: 'user-1' }, 'actor-1'),
    ).rejects.toThrow(NotFoundException);
  });

  it('assigns role and publishes role.assigned', async () => {
    roleRepo.findOne.mockResolvedValueOnce({ id: 'role-1', name: 'ADMIN' });
    userRoleRepo.findOne.mockResolvedValueOnce(null);
    userRoleRepo.create.mockReturnValueOnce({ userId: 'user-1', roleId: 'role-1' });
    userRoleRepo.save.mockResolvedValueOnce({ userId: 'user-1', roleId: 'role-1' });
    eventPublisher.publish.mockResolvedValueOnce(undefined);

    const result = await service.assignRole('role-1', { userId: 'user-1' }, 'actor-1');

    expect(result).toMatchObject({ userId: 'user-1', roleId: 'role-1', roleName: 'ADMIN' });
    expect(eventPublisher.publish).toHaveBeenCalledWith('role.events', 'role.assigned', expect.any(Object));
  });

  it('finds role by id', async () => {
    roleRepo.findOne.mockResolvedValueOnce({
      id: 'role-1',
      name: 'ADMIN',
      description: 'Admin',
      isSystem: true,
      createdAt: new Date(),
      permissions: [],
    });

    const result = await service.findById('role-1');

    expect(result.id).toBe('role-1');
  });

  it('revokes a user role and publishes role.revoked', async () => {
    userRoleRepo.findOne.mockResolvedValueOnce({ userId: 'user-1', roleId: 'role-1' });
    userRoleRepo.delete.mockResolvedValueOnce({ affected: 1 });
    eventPublisher.publish.mockResolvedValueOnce(undefined);

    await service.revokeRole('role-1', 'user-1', 'actor-1');

    expect(userRoleRepo.delete).toHaveBeenCalledWith({ userId: 'user-1', roleId: 'role-1' });
    expect(eventPublisher.publish).toHaveBeenCalledWith('role.events', 'role.revoked', expect.any(Object));
  });

  it('deletes non-system role and rejects system role deletion', async () => {
    roleRepo.findOne.mockResolvedValueOnce({ id: 'role-1', name: 'CUSTOM', isSystem: false });
    roleRepo.delete.mockResolvedValueOnce({ affected: 1 });
    eventPublisher.publish.mockResolvedValueOnce(undefined);

    await service.deleteRole('role-1', 'actor-1');

    expect(roleRepo.delete).toHaveBeenCalledWith({ id: 'role-1' });
    expect(eventPublisher.publish).toHaveBeenCalledWith('role.events', 'role.deleted', expect.any(Object));

    roleRepo.findOne.mockResolvedValueOnce({ id: 'role-2', name: 'ADMIN', isSystem: true });
    await expect(service.deleteRole('role-2', 'actor-1')).rejects.toThrow(BadRequestException);
  });

  it('returns user roles and permissions', async () => {
    userRoleRepo.find.mockResolvedValueOnce([
      { userId: 'user-1', roleId: 'role-1', role: { name: 'ADMIN' }, assignedAt: new Date() },
    ]);
    permissionRepo.find.mockResolvedValueOnce([{ id: 'p1', resource: 'users', action: 'read', scope: 'GLOBAL' }]);

    await expect(service.getUserRoles('user-1')).resolves.toHaveLength(1);
    await expect(service.getPermissions()).resolves.toHaveLength(1);
  });
});
