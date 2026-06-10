import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventPublisher } from '@toka/shared-kernel';
import { RoleOrmEntity } from '../../infrastructure/persistence/typeorm/role.orm-entity';
import { PermissionOrmEntity } from '../../infrastructure/persistence/typeorm/permission.orm-entity';
import { UserRoleOrmEntity } from '../../infrastructure/persistence/typeorm/user-role.orm-entity';
import {
  AssignRoleDto,
  CreateRoleDto,
  PermissionResponseDto,
  RoleResponseDto,
  UserRoleResponseDto,
} from '../dtos/role.dto';
import { RoleAssignedEvent } from '../../domain/events/role-assigned.event';
import { RoleCreatedEvent } from '../../domain/events/role-created.event';
import { RoleRevokedEvent } from '../../domain/events/role-revoked.event';
import { RoleDeletedEvent } from '../../domain/events/role-deleted.event';

@Injectable()
export class RoleApplicationService {
  private readonly logger = new Logger(RoleApplicationService.name);

  constructor(
    @InjectRepository(RoleOrmEntity)
    private readonly roleRepo: Repository<RoleOrmEntity>,
    @InjectRepository(PermissionOrmEntity)
    private readonly permissionRepo: Repository<PermissionOrmEntity>,
    @InjectRepository(UserRoleOrmEntity)
    private readonly userRoleRepo: Repository<UserRoleOrmEntity>,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async findAll(): Promise<RoleResponseDto[]> {
    const roles = await this.roleRepo.find({ relations: ['permissions'] });
    return roles.map(this.toDto);
  }

  async findById(id: string): Promise<RoleResponseDto> {
    const role = await this.roleRepo.findOne({ where: { id }, relations: ['permissions'] });
    if (!role) throw new NotFoundException(`Role ${id} not found`);
    return this.toDto(role);
  }

  async create(dto: CreateRoleDto, createdBy: string): Promise<RoleResponseDto> {
    const existing = await this.roleRepo.findOne({ where: { name: dto.name.toUpperCase() } });
    if (existing) throw new BadRequestException(`Role ${dto.name} already exists`);

    const role = this.roleRepo.create({
      name: dto.name.toUpperCase(),
      description: dto.description ?? '',
      isSystem: false,
    });

    const saved = await this.roleRepo.save(role);

    this.eventPublisher
      .publish('role.events', 'role.created', new RoleCreatedEvent(saved.id, saved.name, createdBy))
      .catch((err: unknown) => this.logger.error('Failed to publish role.created', err));

    return this.toDto(saved);
  }

  async assignRole(roleId: string, dto: AssignRoleDto, assignedBy: string): Promise<UserRoleResponseDto> {
    const role = await this.roleRepo.findOne({ where: { id: roleId } });
    if (!role) throw new NotFoundException(`Role ${roleId} not found`);

    const existing = await this.userRoleRepo.findOne({
      where: { userId: dto.userId, roleId },
    });
    if (existing) throw new BadRequestException('User already has this role');

    const userRole = this.userRoleRepo.create({
      userId: dto.userId,
      roleId,
      assignedBy,
    });
    await this.userRoleRepo.save(userRole);

    await this.eventPublisher.publish(
      'role.events',
      'role.assigned',
      new RoleAssignedEvent(dto.userId, roleId, role.name, assignedBy),
    );

    this.logger.log({ message: 'Role assigned', userId: dto.userId, roleId, roleName: role.name });

    return {
      userId: dto.userId,
      roleId,
      roleName: role.name,
      assignedAt: new Date(),
    };
  }

  async revokeRole(roleId: string, userId: string, revokedBy: string): Promise<void> {
    const userRole = await this.userRoleRepo.findOne({ where: { userId, roleId } });
    if (!userRole) throw new NotFoundException('User does not have this role');

    await this.userRoleRepo.delete({ userId, roleId });

    this.eventPublisher
      .publish('role.events', 'role.revoked', new RoleRevokedEvent(userId, roleId, revokedBy))
      .catch((err: unknown) => this.logger.error('Failed to publish role.revoked', err));
  }

  async deleteRole(roleId: string, deletedBy: string): Promise<void> {
    const role = await this.roleRepo.findOne({ where: { id: roleId } });
    if (!role) throw new NotFoundException(`Role ${roleId} not found`);
    if (role.isSystem) throw new BadRequestException('System roles cannot be deleted');

    await this.roleRepo.delete({ id: roleId });

    this.eventPublisher
      .publish('role.events', 'role.deleted', new RoleDeletedEvent(roleId, role.name, deletedBy))
      .catch((err: unknown) => this.logger.error('Failed to publish role.deleted', err));
  }

  async getUserRoles(userId: string): Promise<UserRoleResponseDto[]> {
    const userRoles = await this.userRoleRepo.find({ where: { userId }, relations: ['role'] });
    return userRoles.map((ur) => ({
      userId: ur.userId,
      roleId: ur.roleId,
      roleName: ur.role.name,
      assignedAt: ur.assignedAt,
    }));
  }

  async getPermissions(): Promise<PermissionResponseDto[]> {
    return this.permissionRepo.find();
  }

  private toDto(role: RoleOrmEntity): RoleResponseDto {
    return {
      id: role.id,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      createdAt: role.createdAt,
      permissions: (role.permissions ?? []).map((p) => ({
        id: p.id,
        resource: p.resource,
        action: p.action,
        scope: p.scope,
      })),
    };
  }
}
