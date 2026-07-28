/**
 * GET /api/transfer-pdf/:requestId
 * 
 * Generates a professional PDF for a transfer request with Azul Cars branding.
 * Returns the PDF as a downloadable file.
 */
import { Request, Response } from "express";
import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import {
  getServiceClient,
  authenticateSupabaseRequest,
  AuthError,
} from "./supabaseAdmin";

// Azul Cars brand colors
const COLORS = {
  darkNavy: '#0F1B2D',
  gold: '#C9A96E',
  lightGold: '#E8D5A8',
  white: '#FFFFFF',
  lightGray: '#F5F5F5',
  mediumGray: '#888888',
  darkGray: '#333333',
};

// Use built-in Helvetica fonts (available everywhere, no system font dependency)
const FONT_REGULAR = 'Helvetica';
const FONT_BOLD = 'Helvetica-Bold';

// Logo path - resolve relative to this file
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// In production: dist/index.js -> ../server/assets/logo.png
// In dev: server/transferPdf.ts -> ./assets/logo.png
const LOGO_PATHS = [
  path.resolve(__dirname, 'assets', 'logo.png'),           // dev: server/assets/logo.png
  path.resolve(__dirname, '..', 'server', 'assets', 'logo.png'), // prod: dist/../server/assets/logo.png
  path.resolve(process.cwd(), 'server', 'assets', 'logo.png'),   // fallback: cwd/server/assets/logo.png
];

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatTime(timeStr: string | null): string {
  if (!timeStr) return '-';
  return timeStr.substring(0, 5); // HH:MM
}

function getVehicleLabel(type: string | null): string {
  switch (type) {
    case 'mercedes_vito': return 'Mercedes Vito';
    case 'mercedes_v_class': return 'Mercedes V-Class';
    default: return type || '-';
  }
}

function getDirectionLabel(direction: string | null): string {
  switch (direction) {
    case 'ida': return 'Ida';
    case 'vuelta': return 'Vuelta';
    default: return direction || '-';
  }
}

function getClientTypeLabel(type: string | null): string {
  switch (type) {
    case 'villa': return 'Villa';
    case 'charter': return 'Charter';
    default: return type || '-';
  }
}

export async function handleTransferPdf(req: Request, res: Response) {
  try {
    const { userId, organizationId } = await authenticateSupabaseRequest(
      req.headers.authorization
    );

    const { requestId } = req.params;
    if (!requestId) {
      return res.status(400).json({ error: "requestId is required" });
    }

    const sb = getServiceClient();

    // Fetch transfer request with items
    const { data: request, error: reqError } = await sb
      .from("transfer_requests")
      .select(`
        *,
        items:transfer_items(*)
      `)
      .eq("id", requestId)
      .eq("organization_id", organizationId)
      .single();

    if (reqError || !request) {
      return res.status(404).json({ error: "Solicitud no encontrada" });
    }

    // Sort items by position
    const items = (request.items || []).sort((a: any, b: any) => (a.position || 0) - (b.position || 0));

    // Create PDF
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 40, bottom: 40, left: 50, right: 50 },
      info: {
        Title: `Transfer ${request.request_number}`,
        Author: 'Azul Cars',
        Subject: 'Confirmación de Transfer',
      },
    });

    // Set response headers
    const filename = `transfer-${request.request_number}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    doc.pipe(res);

    // Use built-in PDFKit fonts (no registration needed for Helvetica)
    // 'Regular' and 'Bold' are aliases we use throughout
    const fontRegular = FONT_REGULAR;
    const fontBold = FONT_BOLD;

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    // ===== HEADER =====
    // Dark navy background header
    doc.save();
    doc.rect(0, 0, doc.page.width, 100).fill(COLORS.darkNavy);
    doc.restore();

    // Logo image (banner format 998x208 → ~4.8:1 aspect ratio)
    const logoPath = LOGO_PATHS.find(p => fs.existsSync(p));
    if (logoPath) {
      // Height 50px → width ~240px, centered vertically in 100px header
      doc.image(logoPath, 50, 25, { height: 50 });
    } else {
      // Fallback to text if logo not found
      doc.font(fontBold).fontSize(28).fillColor(COLORS.white);
      doc.text('AZUL', 50, 30, { continued: true });
      doc.fillColor(COLORS.gold).text(' CARS', { continued: false });
    }
    
    doc.font(fontRegular).fontSize(10).fillColor(COLORS.lightGold);
    doc.text('TRANSFERS', 50, 78);

    // Request number on the right
    doc.font(fontBold).fontSize(12).fillColor(COLORS.white);
    doc.text(`No ${request.request_number}`, 350, 35, { align: 'right', width: pageWidth - 300 });
    doc.font(fontRegular).fontSize(9).fillColor(COLORS.lightGold);
    doc.text(`Fecha: ${formatDate(request.created_at)}`, 350, 55, { align: 'right', width: pageWidth - 300 });

    // ===== GOLD DIVIDER =====
    doc.moveTo(50, 110).lineTo(doc.page.width - 50, 110).strokeColor(COLORS.gold).lineWidth(2).stroke();

    let yPos = 130;

    // ===== CLIENT INFORMATION SECTION =====
    // Section header
    doc.font(fontBold).fontSize(11).fillColor(COLORS.darkNavy);
    doc.text('INFORMACION DEL CLIENTE', 50, yPos);
    yPos += 20;

    // Client info grid
    const drawField = (label: string, value: string, x: number, y: number, width: number) => {
      doc.font(fontRegular).fontSize(8).fillColor(COLORS.mediumGray);
      doc.text(label, x, y);
      doc.font(fontRegular).fontSize(10).fillColor(COLORS.darkGray);
      doc.text(value || '-', x, y + 12, { width });
    };

    const colWidth = (pageWidth - 20) / 2;

    drawField('Nombre del cliente', request.client_name || '-', 50, yPos, colWidth);
    drawField('Tipo', getClientTypeLabel(request.client_type), 50 + colWidth + 20, yPos, colWidth);
    yPos += 40;

    drawField('Telefono', request.client_phone || '-', 50, yPos, colWidth);
    drawField('Email', request.client_email || '-', 50 + colWidth + 20, yPos, colWidth);
    yPos += 40;

    if (request.client_type === 'villa' && request.villa_name) {
      drawField('Villa', request.villa_name, 50, yPos, colWidth);
      yPos += 40;
    } else if (request.client_type === 'charter') {
      drawField('Embarcacion', request.boat_name || '-', 50, yPos, colWidth);
      drawField('Amarre', request.berth_number || '-', 50 + colWidth + 20, yPos, colWidth);
      yPos += 40;
    }

    if (request.broker_name) {
      drawField('Broker', request.broker_name, 50, yPos, colWidth);
      yPos += 40;
    }

    // ===== TRANSFERS SECTION =====
    // Gray separator
    doc.moveTo(50, yPos).lineTo(doc.page.width - 50, yPos).strokeColor('#DDDDDD').lineWidth(0.5).stroke();
    yPos += 15;

    doc.font(fontBold).fontSize(11).fillColor(COLORS.darkNavy);
    doc.text('SERVICIOS DE TRANSFER', 50, yPos);
    yPos += 25;

    // Draw each transfer item
    items.forEach((item: any, index: number) => {
      // Check if we need a new page
      if (yPos > 680) {
        doc.addPage();
        yPos = 50;
      }

      // Calculate card height (base 130 + extra for baby seats)
      const hasBabySeats = item.baby_seats_count && item.baby_seats_count > 0;
      let cardHeight = 130;
      if (hasBabySeats) {
        cardHeight += 20;
        let seatsArr: any[] = [];
        if (item.baby_seats) { try { seatsArr = typeof item.baby_seats === 'string' ? JSON.parse(item.baby_seats) : item.baby_seats; } catch {} }
        if (seatsArr.length > 0) cardHeight += 14;
      }

      // Item card background
      doc.save();
      doc.roundedRect(50, yPos, pageWidth, cardHeight, 4).fill(COLORS.lightGray);
      doc.restore();

      const cardX = 60;
      const cardY = yPos + 10;

      // Transfer number and direction badge
      doc.font(fontBold).fontSize(10).fillColor(COLORS.darkNavy);
      doc.text(`Transfer ${index + 1}`, cardX, cardY);
      
      // Direction badge
      const dirLabel = getDirectionLabel(item.direction);
      const badgeX = cardX + 80;
      doc.save();
      doc.roundedRect(badgeX, cardY - 2, 45, 16, 3).fill(COLORS.gold);
      doc.restore();
      doc.font(fontBold).fontSize(8).fillColor(COLORS.white);
      doc.text(dirLabel, badgeX + 5, cardY + 2, { width: 35, align: 'center' });

      // Date and time
      doc.font(fontRegular).fontSize(9).fillColor(COLORS.mediumGray);
      doc.text(`${formatDate(item.transfer_date)} - ${formatTime(item.transfer_time)}`, cardX + 150, cardY);

      // Flight number if present
      if (item.flight_number) {
        doc.font(fontRegular).fontSize(9).fillColor(COLORS.gold);
        doc.text(`Vuelo: ${item.flight_number}`, cardX + 320, cardY);
      }

      // Route
      const routeY = cardY + 25;
      
      // Pickup
      doc.save();
      doc.circle(cardX + 5, routeY + 5, 4).fill(COLORS.gold);
      doc.restore();
      doc.font(fontRegular).fontSize(8).fillColor(COLORS.mediumGray);
      doc.text('RECOGIDA', cardX + 15, routeY - 2);
      doc.font(fontRegular).fontSize(9).fillColor(COLORS.darkGray);
      doc.text(item.pickup_location || '-', cardX + 15, routeY + 10, { width: pageWidth - 40 });

      // Dotted line
      const dotY = routeY + 28;
      for (let i = 0; i < 3; i++) {
        doc.circle(cardX + 5, dotY + i * 5, 1).fill('#CCCCCC');
      }

      // Dropoff
      const dropY = routeY + 45;
      doc.save();
      doc.circle(cardX + 5, dropY + 5, 4).fill(COLORS.darkNavy);
      doc.restore();
      doc.font(fontRegular).fontSize(8).fillColor(COLORS.mediumGray);
      doc.text('DESTINO', cardX + 15, dropY - 2);
      doc.font(fontRegular).fontSize(9).fillColor(COLORS.darkGray);
      doc.text(item.dropoff_location || '-', cardX + 15, dropY + 10, { width: pageWidth - 40 });

      // Bottom row: vehicle, pax, driver
      const bottomY = cardY + 100;
      doc.font(fontRegular).fontSize(8).fillColor(COLORS.mediumGray);
      doc.text('Vehiculo: ', cardX, bottomY, { continued: true });
      doc.fillColor(COLORS.darkGray).text(getVehicleLabel(item.vehicle_type));

      doc.fillColor(COLORS.mediumGray).text('Pasajeros: ', cardX + 180, bottomY, { continued: true });
      doc.fillColor(COLORS.darkGray).text(`${item.pax_count || '-'}`);

      if (item.driver_name) {
        doc.fillColor(COLORS.mediumGray).text('Conductor: ', cardX + 280, bottomY, { continued: true });
        doc.fillColor(COLORS.darkGray).text(item.driver_name);
      }

      // Baby seats info
      let extraHeight = 0;
      if (item.baby_seats_count && item.baby_seats_count > 0) {
        extraHeight = 20;
        const babyY = bottomY + 15;
        doc.font(fontBold).fontSize(8).fillColor('#D946A8');
        doc.text(`\u{1F476} Sillitas de bebe: ${item.baby_seats_count}`, cardX, babyY);

        // Parse baby_seats details
        let seatsData: Array<{ age: number; weight: number }> = [];
        if (item.baby_seats) {
          try {
            seatsData = typeof item.baby_seats === 'string' ? JSON.parse(item.baby_seats) : item.baby_seats;
          } catch {}
        }

        if (seatsData.length > 0) {
          const getGroup = (w: number) => w < 9 ? 'Grupo 0 - Reci\u00e9n nacido' : w < 18 ? 'Grupo 1 - Infantes' : w <= 36 ? 'Grupo 2 - Ni\u00f1o' : 'Grupo 3 - Elevador';
          const detailStr = seatsData.map((s: any, i: number) => `Silla ${i + 1}: ${s.age} a\u00f1os, ${s.weight} kg (${getGroup(s.weight)})`).join('  |  ');
          doc.font(fontRegular).fontSize(8).fillColor(COLORS.darkGray);
          doc.text(detailStr, cardX, babyY + 12, { width: pageWidth - 40 });
          extraHeight += 14;
        }
      }

      yPos += 145 + extraHeight;
    });

    // ===== NOTES SECTION =====
    if (request.notes) {
      if (yPos > 680) {
        doc.addPage();
        yPos = 50;
      }

      yPos += 10;
      doc.moveTo(50, yPos).lineTo(doc.page.width - 50, yPos).strokeColor('#DDDDDD').lineWidth(0.5).stroke();
      yPos += 15;

      doc.font(fontBold).fontSize(11).fillColor(COLORS.darkNavy);
      doc.text('NOTAS', 50, yPos);
      yPos += 18;
      doc.font(fontRegular).fontSize(9).fillColor(COLORS.darkGray);
      doc.text(request.notes, 50, yPos, { width: pageWidth });
    }

    // ===== FOOTER =====
    const footerY = doc.page.height - 60;
    doc.moveTo(50, footerY).lineTo(doc.page.width - 50, footerY).strokeColor(COLORS.gold).lineWidth(0.5).stroke();
    
    doc.font(fontRegular).fontSize(8).fillColor(COLORS.mediumGray);
    doc.text('Azul Cars - Servicio de Transfers Premium', 50, footerY + 10, { align: 'center', width: pageWidth });
    doc.text('Este documento es una confirmacion del servicio solicitado.', 50, footerY + 22, { align: 'center', width: pageWidth });

    // Finalize PDF
    doc.end();
  } catch (err: any) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error("[transfer-pdf] Unexpected error:", err);
    if (!res.headersSent) {
      return res.status(500).json({ error: err.message || "Internal error" });
    }
  }
}
