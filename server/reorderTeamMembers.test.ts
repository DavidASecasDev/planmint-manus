import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

vi.mock('./supabaseAdmin', () => ({
  getServiceClient: vi.fn(),
  authenticateSupabaseRequest: vi.fn(),
  AuthError: class AuthError extends Error {
    status: number;
    constructor(message: string, status = 401) {
      super(message);
      this.status = status;
    }
  },
}));

vi.mock('./permissionHelper', () => ({
  checkUserPermission: vi.fn(),
  requireAnyPermission: vi.fn(),
}));

import { handleReorderTeamMembers } from './scheduleEndpoints';
import { authenticateSupabaseRequest, getServiceClient } from './supabaseAdmin';
import { requireAnyPermission } from './permissionHelper';

const organizationId = '00000000-0000-0000-0000-000000000001';
const teamId = '10000000-0000-0000-0000-000000000001';
const actorId = '20000000-0000-0000-0000-000000000100';
const orderedUserIds = [
  '20000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000002',
  '20000000-0000-0000-0000-000000000003',
];

function mockResponse() {
  return {
    _status: 200,
    _json: undefined as any,
    status(code: number) {
      this._status = code;
      return this;
    },
    json(payload: any) {
      this._json = payload;
      return this;
    },
  } as unknown as Response & { _status: number; _json: any };
}

function mockRequest(body: Record<string, unknown>): Request {
  return { headers: { authorization: 'Bearer test' }, body } as Request;
}

describe('handleReorderTeamMembers', () => {
  const rpc = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authenticateSupabaseRequest).mockResolvedValue({
      userId: actorId,
      organizationId,
    });
    vi.mocked(getServiceClient).mockReturnValue({ rpc } as any);
    vi.mocked(requireAnyPermission).mockResolvedValue({ role: 'owner', permission: 'schedules.manage' });
    rpc.mockResolvedValue({
      data: [{ changed: true, member_count: 3, stored_count: 3, sequence_valid: true }],
      error: null,
    });
  });

  it('requires a schedule-management permission before calling the RPC', async () => {
    const denied: any = new Error('Permission denied');
    denied.status = 403;
    vi.mocked(requireAnyPermission).mockRejectedValue(denied);
    const res = mockResponse();

    await handleReorderTeamMembers(mockRequest({
      team_id: teamId,
      ordered_user_ids: orderedUserIds,
      week_start: '2026-09-21',
    }), res);

    expect(res._status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('rejects duplicate user ids before any database write', async () => {
    const res = mockResponse();
    await handleReorderTeamMembers(mockRequest({
      team_id: teamId,
      ordered_user_ids: [orderedUserIds[0], orderedUserIds[0]],
      week_start: '2026-09-21',
    }), res);

    expect(res._status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('passes the authenticated organization and complete ordered list to one RPC', async () => {
    const res = mockResponse();
    await handleReorderTeamMembers(mockRequest({
      team_id: teamId,
      ordered_user_ids: orderedUserIds,
      week_start: '2026-09-21',
      organization_id: 'attacker-org',
    }), res);

    expect(res._status).toBe(200);
    expect(res._json).toMatchObject({ ok: true, data: { sequence_valid: true } });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('replace_schedule_member_order', {
      p_organization_id: organizationId,
      p_team_id: teamId,
      p_week_start: '2026-09-21',
      p_ordered_user_ids: orderedUserIds,
      p_actor_user_id: actorId,
      p_actor_role: 'owner',
    });
  });

  it('fails closed when stored count or sequence does not match the request', async () => {
    rpc.mockResolvedValue({
      data: [{ changed: true, member_count: 3, stored_count: 2, sequence_valid: false }],
      error: null,
    });
    const res = mockResponse();

    await handleReorderTeamMembers(mockRequest({
      team_id: teamId,
      ordered_user_ids: orderedUserIds,
      week_start: '2026-09-21',
    }), res);

    expect(res._status).toBe(500);
    expect(res._json.error).toContain('failed validation');
  });

  it('maps an incomplete team list to a clear validation error', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'ordered_member_count_mismatch' } });
    const res = mockResponse();

    await handleReorderTeamMembers(mockRequest({
      team_id: teamId,
      ordered_user_ids: orderedUserIds,
      week_start: '2026-09-21',
    }), res);

    expect(res._status).toBe(400);
    expect(res._json.error).toContain('exactamente una vez');
  });
});
