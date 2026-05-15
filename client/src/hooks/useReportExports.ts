import { useState } from 'react';
import { supabaseQuery } from '@/lib/supabaseQuery';
import { useAuth } from '@/contexts/AuthContext';
import { ReportFilters, DashboardKPIs } from '@/types/reports';
import { toast } from 'sonner';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

/**
 * Escapes HTML special characters to prevent XSS attacks
 * when embedding user-controlled data in HTML output
 */
function escapeHtml(text: string | number | null | undefined): string {
  if (text === null || text === undefined) return '';
  const str = String(text);
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function getDateRange(filters: ReportFilters): { start: Date; end: Date } {
  const end = endOfDay(new Date());
  let start: Date;

  switch (filters.dateRange) {
    case '7d':
      start = startOfDay(subDays(end, 7));
      break;
    case '30d':
      start = startOfDay(subDays(end, 30));
      break;
    case '90d':
      start = startOfDay(subDays(end, 90));
      break;
    case 'custom':
      start = filters.startDate ? startOfDay(filters.startDate) : startOfDay(subDays(end, 30));
      break;
    default:
      start = startOfDay(subDays(end, 30));
  }

  return { start, end: filters.endDate ? endOfDay(filters.endDate) : end };
}

export function useReportExports() {
  const { profile } = useAuth();
  const [isExporting, setIsExporting] = useState(false);

  const exportTasksCSV = async (filters: ReportFilters) => {
    if (!profile?.organization_id) return;
    setIsExporting(true);

    try {
      const { start, end } = getDateRange(filters);

      let query = supabaseQuery
        .from('tasks')
        .select(`
          id,
          title,
          status,
          priority,
          type,
          due_date,
          created_at,
          started_at,
          completed_at,
          assigned_to,
          assignee:profiles!tasks_assigned_to_fkey(name),
          task_areas(area:areas(name)),
          task_tags(tag:tags(name))
        `)
        .eq('organization_id', profile.organization_id)
        .eq('is_archived', false)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .order('created_at', { ascending: false });

      if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }
      if (filters.taskType && filters.taskType !== 'all') {
        query = query.eq('type', filters.taskType as string);
      }
      if (filters.assigneeId && filters.assigneeId !== 'all') {
        query = query.eq('assigned_to', filters.assigneeId);
      }

      const { data: tasks, error } = await query;
      if (error) throw error;

      // Calculate cycle time for each task
      const csvData = (tasks || []).map((task: any) => {
        const areas = task.task_areas?.map((ta: any) => ta.area?.name).filter(Boolean).join(', ') || '';
        const tags = task.task_tags?.map((tt: any) => tt.tag?.name).filter(Boolean).join(', ') || '';
        
        let cycleTime = '';
        if (task.started_at && task.completed_at) {
          const days = Math.round(
            (new Date(task.completed_at).getTime() - new Date(task.started_at).getTime()) / (1000 * 60 * 60 * 24)
          );
          cycleTime = `${days} días`;
        }

        return {
          id: task.id,
          title: task.title,
          status: task.status,
          priority: task.priority,
          type: task.type,
          due_date: task.due_date || '',
          areas,
          tags,
          assignee: task.assignee?.name || '',
          created_at: format(new Date(task.created_at), 'yyyy-MM-dd HH:mm'),
          started_at: task.started_at ? format(new Date(task.started_at), 'yyyy-MM-dd HH:mm') : '',
          completed_at: task.completed_at ? format(new Date(task.completed_at), 'yyyy-MM-dd HH:mm') : '',
          cycle_time: cycleTime,
        };
      });

      const headers = ['ID', 'Título', 'Estado', 'Prioridad', 'Tipo', 'Fecha límite', 'Áreas', 'Etiquetas', 'Asignado a', 'Creado', 'Iniciado', 'Completado', 'Tiempo de ciclo'];
      const rows = csvData.map((row: any) => [
        row.id,
        `"${row.title.replace(/"/g, '""')}"`,
        row.status,
        row.priority,
        row.type,
        row.due_date,
        `"${row.areas}"`,
        `"${row.tags}"`,
        `"${row.assignee}"`,
        row.created_at,
        row.started_at,
        row.completed_at,
        row.cycle_time,
      ].join(','));

      const csv = [headers.join(','), ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `tareas_${format(new Date(), 'yyyy-MM-dd')}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      toast.success('Tareas exportadas correctamente');
    } catch (error) {
      console.error('Error exporting tasks:', error);
      toast.error('Error al exportar tareas');
    } finally {
      setIsExporting(false);
    }
  };

  const exportKPIsCSV = async (kpis: DashboardKPIs, filters: ReportFilters) => {
    setIsExporting(true);

    try {
      const { start, end } = getDateRange(filters);
      
      const rows = [
        ['Métrica', 'Valor'],
        ['Periodo', `${format(start, 'yyyy-MM-dd')} - ${format(end, 'yyyy-MM-dd')}`],
        [''],
        ['-- Actividad --'],
        ['Tareas creadas', kpis.taskMetrics.tasksCreated.toString()],
        ['Tareas completadas', kpis.taskMetrics.tasksCompleted.toString()],
        ['Tareas abiertas', kpis.taskMetrics.tasksOpen.toString()],
        ['Tareas en progreso', kpis.taskMetrics.tasksInProgress.toString()],
        ['Tareas bloqueadas', kpis.taskMetrics.tasksBlocked.toString()],
        ['Tareas vencidas', kpis.taskMetrics.tasksOverdue.toString()],
        ['Tasa de vencimiento', `${kpis.taskMetrics.overdueRate.toFixed(1)}%`],
        [''],
        ['-- Flujo --'],
        ['Throughput (completadas)', kpis.flowMetrics.throughput.toString()],
        ['Tiempo de ciclo promedio', kpis.flowMetrics.avgCycleTime !== null ? `${kpis.flowMetrics.avgCycleTime.toFixed(1)} días` : 'N/A'],
        ['Lead time promedio', kpis.flowMetrics.avgLeadTime !== null ? `${kpis.flowMetrics.avgLeadTime.toFixed(1)} días` : 'N/A'],
        [''],
        ['-- Objetivos --'],
        ['Total objetivos', kpis.goalMetrics.goalsTotal.toString()],
        ['Objetivos completados', kpis.goalMetrics.goalsCompleted.toString()],
        ['Objetivos en progreso', kpis.goalMetrics.goalsInProgress.toString()],
        ['Objetivos en riesgo', kpis.goalMetrics.goalsAtRisk.toString()],
        ['Progreso promedio', `${kpis.goalMetrics.goalProgressAvg.toFixed(1)}%`],
      ];

      const csv = rows.map(row => row.join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `kpis_${format(new Date(), 'yyyy-MM-dd')}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      toast.success('KPIs exportados correctamente');
    } catch (error) {
      console.error('Error exporting KPIs:', error);
      toast.error('Error al exportar KPIs');
    } finally {
      setIsExporting(false);
    }
  };

  const exportReportPDF = async (kpis: DashboardKPIs, filters: ReportFilters) => {
    setIsExporting(true);

    try {
      // For PDF, we'll generate a printable HTML that can be saved as PDF
      const { start, end } = getDateRange(filters);
      
      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';">
  <title>Reporte PlanMint - ${escapeHtml(format(new Date(), 'yyyy-MM-dd'))}</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
    h1 { color: #1a1a1a; border-bottom: 2px solid #6366f1; padding-bottom: 10px; }
    h2 { color: #374151; margin-top: 30px; }
    .period { color: #6b7280; margin-bottom: 30px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin: 20px 0; }
    .kpi-card { background: #f9fafb; border-radius: 8px; padding: 16px; }
    .kpi-value { font-size: 28px; font-weight: 700; color: #1a1a1a; }
    .kpi-label { color: #6b7280; font-size: 14px; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { text-align: left; padding: 12px; border-bottom: 1px solid #e5e7eb; }
    th { background: #f9fafb; font-weight: 600; }
    .warning { color: #d97706; }
    .success { color: #059669; }
    .footer { margin-top: 40px; color: #9ca3af; font-size: 12px; text-align: center; }
  </style>
</head>
<body>
  <h1>PlanMint - Reporte de Productividad</h1>
  <p class="period">Periodo: ${escapeHtml(format(start, 'dd/MM/yyyy'))} - ${escapeHtml(format(end, 'dd/MM/yyyy'))}</p>
  
  <h2>Métricas de Actividad</h2>
  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-value">${escapeHtml(kpis.taskMetrics.tasksCreated)}</div>
      <div class="kpi-label">Tareas creadas</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-value">${escapeHtml(kpis.taskMetrics.tasksCompleted)}</div>
      <div class="kpi-label">Tareas completadas</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-value">${escapeHtml(kpis.taskMetrics.tasksOpen)}</div>
      <div class="kpi-label">Tareas abiertas</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-value ${kpis.taskMetrics.tasksBlocked > 0 ? 'warning' : ''}">${escapeHtml(kpis.taskMetrics.tasksBlocked)}</div>
      <div class="kpi-label">Tareas bloqueadas</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-value ${kpis.taskMetrics.tasksOverdue > 0 ? 'warning' : ''}">${escapeHtml(kpis.taskMetrics.tasksOverdue)}</div>
      <div class="kpi-label">Tareas vencidas</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-value">${escapeHtml(kpis.taskMetrics.overdueRate.toFixed(1))}%</div>
      <div class="kpi-label">Tasa de vencimiento</div>
    </div>
  </div>

  <h2>Métricas de Flujo</h2>
  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-value">${escapeHtml(kpis.flowMetrics.throughput)}</div>
      <div class="kpi-label">Throughput</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-value">${kpis.flowMetrics.avgCycleTime !== null ? escapeHtml(kpis.flowMetrics.avgCycleTime.toFixed(1)) + ' días' : 'N/A'}</div>
      <div class="kpi-label">Tiempo de ciclo</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-value">${kpis.flowMetrics.avgLeadTime !== null ? escapeHtml(kpis.flowMetrics.avgLeadTime.toFixed(1)) + ' días' : 'N/A'}</div>
      <div class="kpi-label">Lead time</div>
    </div>
  </div>

  <h2>Objetivos</h2>
  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-value">${escapeHtml(kpis.goalMetrics.goalsTotal)}</div>
      <div class="kpi-label">Total objetivos</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-value success">${escapeHtml(kpis.goalMetrics.goalsCompleted)}</div>
      <div class="kpi-label">Completados</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-value ${kpis.goalMetrics.goalsAtRisk > 0 ? 'warning' : ''}">${escapeHtml(kpis.goalMetrics.goalsAtRisk)}</div>
      <div class="kpi-label">En riesgo</div>
    </div>
  </div>

  <div class="footer">
    Generado por PlanMint el ${escapeHtml(format(new Date(), 'dd/MM/yyyy HH:mm'))}
  </div>
</body>
</html>`;

      // Use Blob + Object URL instead of document.write for security
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const printWindow = window.open(url, '_blank');
      
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.focus();
          setTimeout(() => {
            printWindow.print();
            URL.revokeObjectURL(url);
          }, 250);
        };
      } else {
        URL.revokeObjectURL(url);
      }

      toast.success('Reporte generado - usa Ctrl+P para guardar como PDF');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Error al generar el reporte PDF');
    } finally {
      setIsExporting(false);
    }
  };

  return {
    isExporting,
    exportTasksCSV,
    exportKPIsCSV,
    exportReportPDF,
  };
}
