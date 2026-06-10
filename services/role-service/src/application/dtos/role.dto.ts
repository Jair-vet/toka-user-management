import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRoleDto {
  @ApiProperty({ example: 'CONTENT_MANAGER' })
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  name!: string;

  @ApiPropertyOptional({ example: 'Can manage content' })
  @IsOptional()
  @IsString()
  description?: string;
}

export class AssignRoleDto {
  @ApiProperty()
  @IsUUID()
  userId!: string;
}

export class RoleResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty()
  isSystem!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty({ isArray: true })
  permissions!: PermissionResponseDto[];
}

export class PermissionResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  resource!: string;

  @ApiProperty()
  action!: string;

  @ApiProperty()
  scope!: string;
}

export class UserRoleResponseDto {
  @ApiProperty()
  userId!: string;

  @ApiProperty()
  roleId!: string;

  @ApiProperty()
  roleName!: string;

  @ApiProperty()
  assignedAt!: Date;
}
