import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity({ schema: 'roles', name: 'permissions' })
@Unique(['resource', 'action', 'scope'])
export class PermissionOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 100 })
  resource!: string;

  @Column({ length: 50 })
  action!: string;

  @Column({ length: 20, default: 'GLOBAL' })
  scope!: string;

  @Column({ type: 'text', nullable: true })
  description!: string;
}
