/**
 * useBrokerQuotePdf — Generates a client-facing PDF quote/confirmation
 * for the broker to download and send to their client.
 *
 * Shows ONLY: service description + price + 21% IVA + total.
 * NO internal data (provider cost, commission, margin).
 */
import { useState, useCallback } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useBrokerAuth } from '@/contexts/BrokerAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, addDays } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import type { TransferRequest, TransferItem } from '@/types/transfers';
import { getVehicleInfo } from '@/lib/transferPricing';

export type BrokerPdfLanguage = 'es' | 'en';

interface InvoiceSettings {
  company_name: string | null;
  tax_id: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  logo_url: string | null;
  footer_text: string | null;
  bank_details: string | null;
}

const TRANSLATIONS: Record<BrokerPdfLanguage, Record<string, string>> = {
  es: {
    title: 'PRESUPUESTO',
    confirmedTitle: 'CONFIRMACIÓN DE SERVICIO',
    client: 'CLIENTE',
    date: 'FECHA',
    reference: 'REFERENCIA',
    route: 'TRAYECTO',
    dateCol: 'FECHA',
    vehicle: 'VEHÍCULO',
    pax: 'PAX',
    price: 'PRECIO',
    subtotal: 'Subtotal',
    vat: 'IVA',
    total: 'TOTAL',
    validUntil: 'Válido hasta',
    bankDetails: 'DATOS BANCARIOS',
    terms: 'CONDICIONES',
    flight: 'Vuelo/Ferry',
    returnTrip: 'Vuelta',
    successMsg: 'generado correctamente',
    serviceNote: 'Servicio de transfer privado con conductor profesional',
    thankYou: 'Gracias por confiar en nosotros',
  },
  en: {
    title: 'QUOTATION',
    confirmedTitle: 'SERVICE CONFIRMATION',
    client: 'CLIENT',
    date: 'DATE',
    reference: 'REFERENCE',
    route: 'ROUTE',
    dateCol: 'DATE',
    vehicle: 'VEHICLE',
    pax: 'PAX',
    price: 'PRICE',
    subtotal: 'Subtotal',
    vat: 'VAT',
    total: 'TOTAL',
    validUntil: 'Valid until',
    bankDetails: 'BANK DETAILS',
    terms: 'TERMS',
    flight: 'Flight/Ferry',
    returnTrip: 'Return',
    successMsg: 'generated successfully',
    serviceNote: 'Private transfer service with professional driver',
    thankYou: 'Thank you for your trust',
  },
};

// Premium color palette — Nautical Luxury (matching internal PDF)
const C = {
  navy: [26, 54, 93] as [number, number, number],
  navyLight: [44, 82, 130] as [number, number, number],
  slate: [51, 65, 85] as [number, number, number],
  coolGray: [100, 116, 139] as [number, number, number],
  lightGray: [148, 163, 184] as [number, number, number],
  bgLight: [248, 250, 252] as [number, number, number],
  bgSubtle: [241, 245, 249] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  gold: [184, 134, 11] as [number, number, number],
  border: [226, 232, 240] as [number, number, number],
  green: [22, 101, 52] as [number, number, number],
};

export function useBrokerQuotePdf() {
  const { broker } = useBrokerAuth();
  const [isGenerating, setIsGenerating] = useState(false);

  const fmt = (n: number | null | undefined) =>
    new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n ?? 0);

  const loadImage = async (url: string): Promise<string | null> => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      return new Promise((resolve) => {
        const r = new FileReader();
        r.onloadend = () => resolve(r.result as string);
        r.onerror = () => resolve(null);
        r.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  };

  const drawLine = (pdf: jsPDF, y: number, ml: number, mr: number, color = C.border) => {
    pdf.setDrawColor(...color);
    pdf.setLineWidth(0.3);
    pdf.line(ml, y, pdf.internal.pageSize.getWidth() - mr, y);
  };

  const drawLabel = (pdf: jsPDF, label: string, x: number, y: number) => {
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...C.coolGray);
    pdf.text(label, x, y);
    pdf.setDrawColor(...C.gold);
    pdf.setLineWidth(0.5);
    pdf.line(x, y + 1.5, x + pdf.getTextWidth(label), y + 1.5);
  };

  const generateBrokerPdf = useCallback(
    async (request: TransferRequest, items: TransferItem[], language: BrokerPdfLanguage = 'es') => {
      if (!broker?.organization_id) {
        toast.error('No se pudo identificar la organización');
        return;
      }

      setIsGenerating(true);
      const t = TRANSLATIONS[language];
      const dateLocale = language === 'es' ? es : enUS;

      try {
        // Fetch invoice settings for company branding
        const { data: settings } = await supabase
          .from('transfer_invoice_settings')
          .select('company_name, tax_id, address, phone, email, logo_url, footer_text, bank_details')
          .eq('organization_id', broker.organization_id)
          .maybeSingle();

        const s: InvoiceSettings = settings || {
          company_name: null, tax_id: null, address: null,
          phone: null, email: null, logo_url: null,
          footer_text: null, bank_details: null,
        };

        const isConfirmed = request.status === 'confirmado' || request.status === 'completado';
        const docTitle = isConfirmed ? t.confirmedTitle : t.title;

        const pdf = new jsPDF('p', 'mm', 'a4');
        const pw = pdf.internal.pageSize.getWidth();
        const ph = pdf.internal.pageSize.getHeight();
        const ml = 25;
        const mr = 25;
        const cw = pw - ml - mr;
        let y = 25;

        // ── HEADER ──
        if (s.logo_url) {
          try {
            const b64 = await loadImage(s.logo_url);
            if (b64) pdf.addImage(b64, 'PNG', ml, y, 40, 20);
          } catch { /* skip */ }
        }

        const re = pw - mr;
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(...C.navy);
        pdf.text(s.company_name || 'Azul Cars', re, y + 4, { align: 'right' });

        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(...C.slate);
        if (s.tax_id) pdf.text(`CIF: ${s.tax_id}`, re, y + 10, { align: 'right' });

        let iy = y + 16;
        pdf.setFontSize(8);
        pdf.setTextColor(...C.coolGray);
        if (s.address) {
          const lines = pdf.splitTextToSize(s.address, 75);
          lines.forEach((l: string) => { pdf.text(l, re, iy, { align: 'right' }); iy += 3.5; });
        }
        if (s.phone) { pdf.text(`Tel: ${s.phone}`, re, iy, { align: 'right' }); iy += 3.5; }
        if (s.email) { pdf.text(s.email, re, iy, { align: 'right' }); }

        y = Math.max(y + 28, iy + 5);
        drawLine(pdf, y, ml, mr);
        y += 12;

        // ── DOCUMENT TITLE ──
        pdf.setFontSize(22);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(...(isConfirmed ? C.green : C.navy));
        const titleSpaced = docTitle.split('').join(' ');
        pdf.text(titleSpaced, pw / 2, y, { align: 'center' });
        y += 8;

        // Reference number
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(...C.navyLight);
        pdf.text(request.request_number || '-', pw / 2, y, { align: 'center' });
        y += 16;

        // ── CLIENT & DATE BOXES ──
        const bh = 30;
        const bg = 12;
        const b1w = cw * 0.55;
        const b2w = cw - b1w - bg;

        // Client box
        pdf.setFillColor(...C.bgLight);
        pdf.roundedRect(ml, y, b1w, bh, 3, 3, 'F');
        drawLabel(pdf, t.client, ml + 8, y + 8);
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(...C.slate);
        pdf.text(request.client_name || '-', ml + 8, y + 17);
        if ((request as any).client_phone) {
          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(...C.coolGray);
          pdf.text((request as any).client_phone, ml + 8, y + 24);
        }

        // Date box
        const b2x = ml + b1w + bg;
        pdf.setFillColor(...C.bgLight);
        pdf.roundedRect(b2x, y, b2w, bh, 3, 3, 'F');
        drawLabel(pdf, t.date, b2x + 8, y + 8);
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(...C.slate);
        pdf.text(format(new Date(), 'dd MMMM yyyy', { locale: dateLocale }), b2x + 8, y + 15);
        drawLabel(pdf, t.reference, b2x + 8, y + 21);
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(...C.navyLight);
        pdf.text(request.request_number || '-', b2x + 8, y + 28);

        y += bh + 14;

        // ── ITEMS TABLE ──
        const sortedItems = [...items].sort((a, b) => {
          if (!a.transfer_date && !b.transfer_date) return 0;
          if (!a.transfer_date) return 1;
          if (!b.transfer_date) return -1;
          const dc = new Date(a.transfer_date).getTime() - new Date(b.transfer_date).getTime();
          if (dc !== 0) return dc;
          return (a.pickup_time || '').localeCompare(b.pickup_time || '');
        });

        const tableRows = sortedItems.map((item) => {
          const route = [item.pickup_location, item.dropoff_location].filter(Boolean).join(' → ') || '-';
          const dateStr = item.transfer_date
            ? format(new Date(item.transfer_date), 'dd MMM', { locale: dateLocale })
            : '-';
          const timeStr = item.pickup_time ? item.pickup_time.slice(0, 5) : '';
          const dt = timeStr ? `${dateStr}\n${timeStr}` : dateStr;
          const vInfo = item.vehicle_type ? getVehicleInfo(item.vehicle_type) : null;
          const vehicle = vInfo?.label || item.vehicle_type || '-';
          const price = item.price_with_commission || 0;

          return [dt, route, String(item.pax_count || '-'), vehicle, fmt(price)];
        });

        autoTable(pdf, {
          startY: y,
          head: [[t.dateCol, t.route, t.pax, t.vehicle, t.price]],
          body: tableRows,
          theme: 'plain',
          tableWidth: cw,
          styles: {
            fontSize: 9,
            cellPadding: { top: 5, right: 4, bottom: 5, left: 4 },
            textColor: C.slate,
            lineColor: C.border,
            lineWidth: 0.1,
            overflow: 'linebreak',
            valign: 'middle',
          },
          headStyles: {
            fillColor: C.navy,
            textColor: C.white,
            fontStyle: 'bold',
            fontSize: 8,
            cellPadding: { top: 6, right: 4, bottom: 6, left: 4 },
            halign: 'center',
          },
          alternateRowStyles: { fillColor: C.bgSubtle },
          columnStyles: {
            0: { cellWidth: 22, halign: 'center', fontStyle: 'bold' },
            1: { cellWidth: 72, overflow: 'linebreak', fontSize: 8 },
            2: { cellWidth: 15, halign: 'center' },
            3: { cellWidth: 26, halign: 'center' },
            4: { cellWidth: 25, halign: 'right', fontStyle: 'bold', textColor: C.navy },
          },
          margin: { left: ml, right: mr },
        });

        const finalY = (pdf as any).lastAutoTable?.finalY || y + 50;
        y = finalY + 12;

        // ── TOTALS BOX ──
        const subtotal = items.reduce((s, it) => s + (it.price_with_commission || 0), 0);
        const vatRate = 21;
        const vatAmount = Math.round(subtotal * 0.21 * 100) / 100;
        const total = Math.round((subtotal + vatAmount) * 100) / 100;

        const tbw = 85;
        const tbx = pw - mr - tbw;
        const tbh = 42;

        const footerReserve = 50;
        const validitySpace = !isConfirmed ? 12 : 0;
        if (y + tbh + validitySpace + footerReserve + 10 > ph) {
          pdf.addPage();
          y = 25;
        }

        pdf.setFillColor(...C.bgLight);
        pdf.setDrawColor(...C.border);
        pdf.setLineWidth(0.3);
        pdf.roundedRect(tbx, y, tbw, tbh, 3, 3, 'FD');

        const lx = tbx + 8;
        const vx = tbx + tbw - 8;
        let ry = y + 10;

        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(...C.coolGray);
        pdf.text(t.subtotal, lx, ry);
        pdf.setTextColor(...C.slate);
        pdf.text(fmt(subtotal), vx, ry, { align: 'right' });

        ry += 8;
        pdf.setTextColor(...C.coolGray);
        pdf.text(`${t.vat} (${vatRate}%)`, lx, ry);
        pdf.setTextColor(...C.slate);
        pdf.text(fmt(vatAmount), vx, ry, { align: 'right' });

        ry += 5;
        pdf.setDrawColor(...C.navy);
        pdf.setLineWidth(0.5);
        pdf.line(lx, ry, vx, ry);

        ry += 9;
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(...C.navy);
        pdf.text(t.total, lx, ry);
        pdf.setFontSize(13);
        pdf.text(fmt(total), vx, ry, { align: 'right' });

        // Service note (left of totals)
        pdf.setFontSize(7);
        pdf.setFont('helvetica', 'italic');
        pdf.setTextColor(...C.lightGray);
        pdf.text(t.serviceNote, ml, y + tbh - 4);

        y += tbh + 8;

        // ── VALIDITY (quotes only) ──
        if (!isConfirmed) {
          const validUntil = addDays(new Date(), 7);
          pdf.setFontSize(8);
          pdf.setFont('helvetica', 'italic');
          pdf.setTextColor(...C.coolGray);
          pdf.text(
            `${t.validUntil}: ${format(validUntil, 'dd MMMM yyyy', { locale: dateLocale })}`,
            pw - mr, y, { align: 'right' }
          );
          y += 10;
        }

        // ── FOOTER ──
        const minFy = y + 8;
        const prefFy = ph - 45;
        let fy = Math.max(minFy, prefFy);

        if (fy + 35 > ph) {
          pdf.addPage();
          fy = ph - 45;
        }

        drawLine(pdf, fy, ml, mr);
        let fcy = fy + 6;

        if (s.bank_details) {
          pdf.setFontSize(7);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(...C.slate);
          pdf.text(t.bankDetails, ml, fcy);
          let by = fcy + 4;
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(...C.coolGray);
          pdf.setFontSize(7);
          s.bank_details.split('\n').slice(0, 3).forEach((l) => {
            pdf.text(l.trim(), ml, by);
            by += 3.2;
          });
        }

        if (s.footer_text) {
          const fmw = cw * 0.8;
          pdf.setFontSize(7);
          pdf.setFont('helvetica', 'italic');
          pdf.setTextColor(...C.lightGray);
          const fl = pdf.splitTextToSize(s.footer_text, fmw);
          pdf.text(fl, pw / 2, fcy + 12, { align: 'center' });
        }

        // Thank you note
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'italic');
        pdf.setTextColor(...C.gold);
        pdf.text(t.thankYou, pw / 2, ph - 12, { align: 'center' });

        // Page numbers
        const pc = pdf.getNumberOfPages();
        for (let i = 1; i <= pc; i++) {
          pdf.setPage(i);
          pdf.setFontSize(7);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(...C.lightGray);
          pdf.text(`${i} / ${pc}`, pw / 2, ph - 8, { align: 'center' });
        }

        // ── SAVE ──
        const prefix = isConfirmed ? 'CONF' : 'PRES';
        const fileName = `${prefix}-${request.request_number || 'transfer'}.pdf`;
        pdf.save(fileName);

        toast.success(`${docTitle} ${t.successMsg}`);
      } catch (error) {
        console.error('Error generating broker PDF:', error);
        toast.error('Error al generar el documento');
      } finally {
        setIsGenerating(false);
      }
    },
    [broker]
  );

  return { generateBrokerPdf, isGenerating };
}
