/**
 * Tests for supabaseQuery builder
 * Verifies that .select() after .insert()/.update()/.upsert() does NOT override the operation type.
 */
import { describe, it, expect } from 'vitest';

// We need to test the builder logic directly. Since supabaseQuery uses apiInvoke internally,
// we'll test the descriptor construction by accessing the private desc field via a workaround.
// We'll import the module and inspect the builder's behavior.

// Since the builder is a class, we can test its behavior by examining what it sends.
// We'll mock apiInvoke to capture the descriptor.

import { vi } from 'vitest';

// Mock the apiClient module
vi.mock('./apiClient', () => ({
  apiInvoke: vi.fn().mockResolvedValue({ data: { data: [], error: null, count: null }, error: null }),
}));

import { supabaseQuery } from './supabaseQuery';
import { apiInvoke } from './apiClient';

const mockedApiInvoke = vi.mocked(apiInvoke);

describe('supabaseQuery builder', () => {
  beforeEach(() => {
    mockedApiInvoke.mockClear();
    mockedApiInvoke.mockResolvedValue({ data: { data: { id: '123' }, error: null, count: null }, error: null });
  });

  it('select() as first call sets operation to select', async () => {
    await supabaseQuery.from('test_table').select('*').eq('id', '123');
    
    expect(mockedApiInvoke).toHaveBeenCalledWith('supabase-query', {
      body: expect.objectContaining({
        table: 'test_table',
        operation: 'select',
        select: '*',
      }),
    });
  });

  it('insert().select().single() keeps operation as insert', async () => {
    await supabaseQuery
      .from('vehicle_movements')
      .insert({ matricula: '1234ABC', movement_type: 'entrega' })
      .select()
      .single();
    
    expect(mockedApiInvoke).toHaveBeenCalledWith('supabase-query', {
      body: expect.objectContaining({
        table: 'vehicle_movements',
        operation: 'insert',
        data: { matricula: '1234ABC', movement_type: 'entrega' },
        select: '*',
        single: true,
      }),
    });
  });

  it('insert().select("id, name").single() keeps operation as insert with specific columns', async () => {
    await supabaseQuery
      .from('vehicle_movements')
      .insert({ matricula: '5678DEF' })
      .select('id, name')
      .single();
    
    expect(mockedApiInvoke).toHaveBeenCalledWith('supabase-query', {
      body: expect.objectContaining({
        table: 'vehicle_movements',
        operation: 'insert',
        data: { matricula: '5678DEF' },
        select: 'id, name',
        single: true,
      }),
    });
  });

  it('update().select().single() keeps operation as update', async () => {
    await supabaseQuery
      .from('vehicle_movements')
      .update({ status: 'completado' })
      .eq('id', 'abc-123')
      .select()
      .single();
    
    expect(mockedApiInvoke).toHaveBeenCalledWith('supabase-query', {
      body: expect.objectContaining({
        table: 'vehicle_movements',
        operation: 'update',
        data: { status: 'completado' },
        select: '*',
        single: true,
      }),
    });
  });

  it('upsert().select().single() keeps operation as upsert', async () => {
    await supabaseQuery
      .from('settings')
      .upsert({ key: 'theme', value: 'dark' }, { onConflict: 'key' })
      .select()
      .single();
    
    expect(mockedApiInvoke).toHaveBeenCalledWith('supabase-query', {
      body: expect.objectContaining({
        table: 'settings',
        operation: 'upsert',
        data: { key: 'theme', value: 'dark' },
        select: '*',
        single: true,
        onConflict: 'key',
      }),
    });
  });

  it('plain select without prior write sets operation to select', async () => {
    await supabaseQuery.from('vehicles').select('id, matricula').eq('organization_id', 'org-1');
    
    expect(mockedApiInvoke).toHaveBeenCalledWith('supabase-query', {
      body: expect.objectContaining({
        table: 'vehicles',
        operation: 'select',
        select: 'id, matricula',
      }),
    });
  });

  it('insert without .select() still sends operation as insert', async () => {
    // Some code might do .insert({...}) without .select()
    await supabaseQuery
      .from('audit_logs')
      .insert({ action: 'login', user_id: 'u1' });
    
    expect(mockedApiInvoke).toHaveBeenCalledWith('supabase-query', {
      body: expect.objectContaining({
        table: 'audit_logs',
        operation: 'insert',
        data: { action: 'login', user_id: 'u1' },
      }),
    });
  });
});
