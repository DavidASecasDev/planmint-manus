import { describe, it, expect } from 'vitest';
import {
  EQUIPMENT_TIPO_LABELS,
  EQUIPMENT_ESTADO_LABELS,
  EQUIPMENT_ESTADO_COLORS,
  type EquipmentTipo,
  type EquipmentEstado,
  type EquipmentItem,
} from '../types/equipment';

describe('Equipment types and constants', () => {
  it('should have labels for all equipment types', () => {
    const tipos: EquipmentTipo[] = ['silla_bebe', 'silla_infantes', 'elevador', 'gps', 'wifi', 'otro'];
    tipos.forEach((tipo) => {
      expect(EQUIPMENT_TIPO_LABELS[tipo]).toBeDefined();
      expect(typeof EQUIPMENT_TIPO_LABELS[tipo]).toBe('string');
      expect(EQUIPMENT_TIPO_LABELS[tipo].length).toBeGreaterThan(0);
    });
  });

  it('should have labels for all equipment states', () => {
    const estados: EquipmentEstado[] = ['disponible', 'asignada', 'mantenimiento', 'baja'];
    estados.forEach((estado) => {
      expect(EQUIPMENT_ESTADO_LABELS[estado]).toBeDefined();
      expect(typeof EQUIPMENT_ESTADO_LABELS[estado]).toBe('string');
    });
  });

  it('should have color classes for all equipment states', () => {
    const estados: EquipmentEstado[] = ['disponible', 'asignada', 'mantenimiento', 'baja'];
    estados.forEach((estado) => {
      expect(EQUIPMENT_ESTADO_COLORS[estado]).toBeDefined();
      expect(typeof EQUIPMENT_ESTADO_COLORS[estado]).toBe('string');
      expect(EQUIPMENT_ESTADO_COLORS[estado].length).toBeGreaterThan(0);
    });
  });

  it('should correctly type an EquipmentItem', () => {
    const item: EquipmentItem = {
      id: 'test-id',
      organization_id: 'org-123',
      tipo: 'silla_bebe',
      nombre: 'Silla Bebé #1',
      codigo: 'SB-001',
      estado: 'disponible',
      reserva_asignada_id: null,
      vehiculo_asignado_matricula: null,
      notas: null,
      fecha_compra: null,
      fecha_ultima_revision: null,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    };
    expect(item.tipo).toBe('silla_bebe');
    expect(item.estado).toBe('disponible');
    expect(item.reserva_asignada_id).toBeNull();
  });

  it('should correctly type an assigned EquipmentItem', () => {
    const item: EquipmentItem = {
      id: 'test-id-2',
      organization_id: 'org-123',
      tipo: 'elevador',
      nombre: 'Elevador #3',
      codigo: 'EL-003',
      estado: 'asignada',
      reserva_asignada_id: 'res-456',
      vehiculo_asignado_matricula: '9934MTB',
      notas: 'Asignada a reserva activa',
      fecha_compra: '2024-06-15',
      fecha_ultima_revision: '2025-03-01',
      created_at: '2024-06-15T00:00:00Z',
      updated_at: '2025-04-01T00:00:00Z',
    };
    expect(item.estado).toBe('asignada');
    expect(item.reserva_asignada_id).toBe('res-456');
    expect(item.vehiculo_asignado_matricula).toBe('9934MTB');
  });
});

describe('Baby seat detection keywords', () => {
  const SEAT_KEYWORDS = ['silla', 'bebé', 'bebe', 'infante', 'elevador', 'child seat', 'baby seat', 'booster', 'infant'];

  function isBabySeatExtra(name: string): boolean {
    const lower = name.toLowerCase();
    return SEAT_KEYWORDS.some((kw) => lower.includes(kw));
  }

  it('should detect Spanish baby seat names', () => {
    expect(isBabySeatExtra('Silla de Bebé')).toBe(true);
    expect(isBabySeatExtra('Silla de infantes')).toBe(true);
    expect(isBabySeatExtra('Asiento elevador')).toBe(true);
  });

  it('should detect English baby seat names', () => {
    expect(isBabySeatExtra('Child Seat')).toBe(true);
    expect(isBabySeatExtra('Baby Seat Premium')).toBe(true);
    expect(isBabySeatExtra('Booster Seat')).toBe(true);
    expect(isBabySeatExtra('Infant Car Seat')).toBe(true);
  });

  it('should NOT detect non-seat extras', () => {
    expect(isBabySeatExtra('GPS Navigator')).toBe(false);
    expect(isBabySeatExtra('WiFi Hotspot')).toBe(false);
    expect(isBabySeatExtra('Cobertura BASIC')).toBe(false);
    expect(isBabySeatExtra('Full Coverage Insurance')).toBe(false);
  });

  it('should be case insensitive', () => {
    expect(isBabySeatExtra('SILLA DE BEBÉ')).toBe(true);
    expect(isBabySeatExtra('silla de bebé')).toBe(true);
    expect(isBabySeatExtra('CHILD SEAT')).toBe(true);
  });
});

describe('Equipment stats calculation', () => {
  const items: EquipmentItem[] = [
    { id: '1', organization_id: 'org', tipo: 'silla_bebe', nombre: 'SB-1', codigo: 'SB-001', estado: 'disponible', reserva_asignada_id: null, vehiculo_asignado_matricula: null, notas: null, fecha_compra: null, fecha_ultima_revision: null, created_at: '', updated_at: '' },
    { id: '2', organization_id: 'org', tipo: 'silla_bebe', nombre: 'SB-2', codigo: 'SB-002', estado: 'asignada', reserva_asignada_id: 'r1', vehiculo_asignado_matricula: '1234ABC', notas: null, fecha_compra: null, fecha_ultima_revision: null, created_at: '', updated_at: '' },
    { id: '3', organization_id: 'org', tipo: 'silla_bebe', nombre: 'SB-3', codigo: 'SB-003', estado: 'mantenimiento', reserva_asignada_id: null, vehiculo_asignado_matricula: null, notas: null, fecha_compra: null, fecha_ultima_revision: null, created_at: '', updated_at: '' },
    { id: '4', organization_id: 'org', tipo: 'elevador', nombre: 'EL-1', codigo: 'EL-001', estado: 'disponible', reserva_asignada_id: null, vehiculo_asignado_matricula: null, notas: null, fecha_compra: null, fecha_ultima_revision: null, created_at: '', updated_at: '' },
    { id: '5', organization_id: 'org', tipo: 'elevador', nombre: 'EL-2', codigo: 'EL-002', estado: 'baja', reserva_asignada_id: null, vehiculo_asignado_matricula: null, notas: null, fecha_compra: null, fecha_ultima_revision: null, created_at: '', updated_at: '' },
  ];

  function countByEstado(items: EquipmentItem[], estado: EquipmentEstado): number {
    return items.filter((i) => i.estado === estado).length;
  }

  function countByTipo(items: EquipmentItem[], tipo: EquipmentTipo): { total: number; disponible: number; asignada: number; mantenimiento: number } {
    const filtered = items.filter((i) => i.tipo === tipo);
    return {
      total: filtered.length,
      disponible: filtered.filter((i) => i.estado === 'disponible').length,
      asignada: filtered.filter((i) => i.estado === 'asignada').length,
      mantenimiento: filtered.filter((i) => i.estado === 'mantenimiento').length,
    };
  }

  it('should count items by estado', () => {
    expect(countByEstado(items, 'disponible')).toBe(2);
    expect(countByEstado(items, 'asignada')).toBe(1);
    expect(countByEstado(items, 'mantenimiento')).toBe(1);
    expect(countByEstado(items, 'baja')).toBe(1);
  });

  it('should count items by tipo', () => {
    const sillaStats = countByTipo(items, 'silla_bebe');
    expect(sillaStats.total).toBe(3);
    expect(sillaStats.disponible).toBe(1);
    expect(sillaStats.asignada).toBe(1);
    expect(sillaStats.mantenimiento).toBe(1);

    const elevadorStats = countByTipo(items, 'elevador');
    expect(elevadorStats.total).toBe(2);
    expect(elevadorStats.disponible).toBe(1);
    expect(elevadorStats.asignada).toBe(0);
  });

  it('should return zero for non-existent tipo', () => {
    const gpsStats = countByTipo(items, 'gps');
    expect(gpsStats.total).toBe(0);
    expect(gpsStats.disponible).toBe(0);
  });
});
