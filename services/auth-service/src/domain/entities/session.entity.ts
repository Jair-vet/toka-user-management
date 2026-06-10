import { BaseEntity } from '@toka/shared-kernel';

export class Session extends BaseEntity {
  userId: string;
  deviceInfo: Record<string, string>;
  ipAddress: string;
  expiresAt: Date;
  isRevoked: boolean;

  constructor(props: {
    id?: string;
    userId: string;
    deviceInfo: Record<string, string>;
    ipAddress: string;
    expiresAt: Date;
  }) {
    super(props.id);
    this.userId = props.userId;
    this.deviceInfo = props.deviceInfo;
    this.ipAddress = props.ipAddress;
    this.expiresAt = props.expiresAt;
    this.isRevoked = false;
  }

  revoke(): void {
    this.isRevoked = true;
    this.updatedAt = new Date();
  }

  isExpired(): boolean {
    return new Date() > this.expiresAt;
  }

  isValid(): boolean {
    return !this.isRevoked && !this.isExpired();
  }
}
