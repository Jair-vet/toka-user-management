import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { AuditEventSchemaClass } from '../../infrastructure/persistence/mongoose/audit-event.schema';
import { AuditApplicationService } from './audit.application-service';

const lean = jest.fn();
const limit = jest.fn(() => ({ lean }));
const skip = jest.fn(() => ({ limit }));
const sort = jest.fn(() => ({ skip }));
const find = jest.fn(() => ({ sort }));
const countDocuments = jest.fn();

const auditModel = {
  countDocuments,
  find,
};

describe('AuditApplicationService', () => {
  let service: AuditApplicationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditApplicationService,
        { provide: getModelToken(AuditEventSchemaClass.name), useValue: auditModel },
      ],
    }).compile();

    service = module.get<AuditApplicationService>(AuditApplicationService);
    jest.clearAllMocks();
  });

  it('returns paginated events', async () => {
    countDocuments.mockResolvedValueOnce(1);
    lean.mockResolvedValueOnce([
      {
        _id: 'mongo-1',
        eventId: 'evt-1',
        action: 'user.created',
        actor: 'actor-1',
        actorEmail: 'actor@toka.com',
        resource: 'User',
        resourceId: 'user-1',
        changes: { after: { email: 'actor@toka.com' } },
        metadata: { correlationId: 'corr-1' },
        timestamp: new Date('2026-06-09T00:00:00Z'),
      },
    ]);

    const result = await service.queryEvents({ page: 1, limit: 20 });

    expect(result.data).toHaveLength(1);
    expect(result.meta.total).toBe(1);
    expect(result.meta.totalPages).toBe(1);
    expect(result.data[0]).toMatchObject({
      id: 'mongo-1',
      eventId: 'evt-1',
      action: 'user.created',
      actor: 'actor-1',
      resource: 'User',
      resourceId: 'user-1',
    });
  });

  it('passes filters to mongoose query', async () => {
    countDocuments.mockResolvedValueOnce(0);
    lean.mockResolvedValueOnce([]);

    await service.queryEvents({
      actor: 'actor-1',
      action: 'created',
      resource: 'User',
      resourceId: 'user-1',
      from: '2026-06-01',
      to: '2026-06-10',
      page: 2,
      limit: 10,
    });

    expect(countDocuments).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'actor-1',
        action: { $regex: 'created', $options: 'i' },
        resource: 'User',
        resourceId: 'user-1',
      }),
    );
    expect(find).toHaveBeenCalledWith(expect.objectContaining({ actor: 'actor-1' }));
    expect(skip).toHaveBeenCalledWith(10);
    expect(limit).toHaveBeenCalledWith(10);
  });
});
