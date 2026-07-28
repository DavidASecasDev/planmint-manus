/**
 * GET /api/transfer-pdf/:requestId
 * 
 * Generates a professional PDF for a transfer request with Azul Cars branding.
 * Includes route map, baby seat info, and proper Spanish typography.
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
import { makeRequest } from "./_core/map";
import { ENV } from "./_core/env";

// Azul Cars brand colors
const COLORS = {
  darkNavy: '#0F1B2D',
  navy: '#1A2B42',
  gold: '#C9A96E',
  lightGold: '#E8D5A8',
  white: '#FFFFFF',
  offWhite: '#FAFAFA',
  lightGray: '#F2F4F6',
  borderGray: '#E5E7EB',
  mediumGray: '#6B7280',
  darkGray: '#374151',
  black: '#111827',
  pink: '#DB2777',
  lightPink: '#FDF2F8',
};

// Font paths - resolve relative to this file
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSET_PATHS = [
  path.resolve(__dirname, 'assets'),
  path.resolve(__dirname, '..', 'server', 'assets'),
  path.resolve(process.cwd(), 'server', 'assets'),
];

function getAssetPath(filename: string): string | null {
  for (const dir of ASSET_PATHS) {
    const p = path.join(dir, filename);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function formatDateShort(dateStr: string | null): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('es-ES', {
    weekday: 'short',
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

function getBabySeatGroup(weight: number): string {
  if (weight < 9) return 'Grupo 0';
  if (weight < 18) return 'Grupo 1';
  if (weight <= 36) return 'Grupo 2';
  return 'Grupo 3';
}

function getBabySeatGroupDesc(weight: number): string {
  if (weight < 9) return 'Grupo 0 (Recién nacido)';
  if (weight < 18) return 'Grupo 1 (Infantil)';
  if (weight <= 36) return 'Grupo 2 (Niño)';
  return 'Grupo 3 (Elevador)';
}

/**
 * Fetch a static map image for a route between two locations.
 * Returns a Buffer of the PNG image, or null if it fails.
 */
async function fetchRouteMapImage(
  origin: string,
  destination: string,
  polyline?: string
): Promise<Buffer | null> {
  try {
    const baseUrl = ENV.forgeApiUrl?.replace(/\/+$/, '');
    const apiKey = ENV.forgeApiKey;
    if (!baseUrl || !apiKey) return null;

    const url = new URL(`${baseUrl}/v1/maps/proxy/maps/api/staticmap`);
    url.searchParams.append('key', apiKey);
    url.searchParams.append('size', '480x160');
    url.searchParams.append('maptype', 'roadmap');
    url.searchParams.append('style', 'feature:all|saturation:-20');

    if (polyline) {
      // Use the encoded polyline for the path
      url.searchParams.append('path', `weight:4|color:0x0F1B2Dff|enc:${polyline}`);
    }

    // Origin marker (gold)
    url.searchParams.append('markers', `color:0xC9A96E|label:A|${origin}`);
    // Destination marker (navy)
    url.searchParams.append('markers', `color:0x0F1B2D|label:B|${destination}`);

    const response = await fetch(url.toString());
    if (!response.ok) return null;

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (err) {
    console.error('[transfer-pdf] Static map fetch error:', err);
    return null;
  }
}

/**
 * Fetch directions (distance/duration + polyline) for a route.
 */
async function fetchDirections(origin: string, destination: string) {
  try {
    const result = await makeRequest<any>('/maps/api/directions/json', {
      origin,
      destination,
      mode: 'driving',
    });
    if (result.status !== 'OK' || !result.routes?.length) return null;
    const route = result.routes[0];
    const leg = route.legs[0];
    return {
      distance: leg.distance?.text || '',
      duration: leg.duration?.text || '',
      polyline: route.overview_polyline?.points || '',
    };
  } catch {
    return null;
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

    // Pre-fetch route data for each item (directions + map images)
    const routeData: Array<{ distance: string; duration: string; mapImage: Buffer | null } | null> = [];
    for (const item of items) {
      if (item.pickup_location && item.dropoff_location) {
        const directions = await fetchDirections(item.pickup_location, item.dropoff_location);
        let mapImage: Buffer | null = null;
        if (directions?.polyline) {
          mapImage = await fetchRouteMapImage(item.pickup_location, item.dropoff_location, directions.polyline);
        } else {
          mapImage = await fetchRouteMapImage(item.pickup_location, item.dropoff_location);
        }
        routeData.push({
          distance: directions?.distance || '',
          duration: directions?.duration || '',
          mapImage,
        });
      } else {
        routeData.push(null);
      }
    }

    // Create PDF
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      info: {
        Title: `Transfer ${request.request_number}`,
        Author: 'Azul Cars',
        Subject: 'Orden de Servicio - Transfer',
      },
    });

    // Set response headers
    const filename = `transfer-${request.request_number}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    doc.pipe(res);

    // Register custom fonts
    const robotoRegular = getAssetPath('Roboto-Regular.ttf');
    const robotoBold = getAssetPath('Roboto-Bold.ttf');
    const robotoMedium = getAssetPath('Roboto-Medium.ttf');
    const robotoLight = getAssetPath('Roboto-Light.ttf');

    if (robotoRegular) doc.registerFont('Regular', robotoRegular);
    if (robotoBold) doc.registerFont('Bold', robotoBold);
    if (robotoMedium) doc.registerFont('Medium', robotoMedium);
    if (robotoLight) doc.registerFont('Light', robotoLight);

    // Fallback to Helvetica if fonts not found
    const fontRegular = robotoRegular ? 'Regular' : 'Helvetica';
    const fontBold = robotoBold ? 'Bold' : 'Helvetica-Bold';
    const fontMedium = robotoMedium ? 'Medium' : 'Helvetica';
    const fontLight = robotoLight ? 'Light' : 'Helvetica';

    const pageWidth = doc.page.width;
    const contentWidth = pageWidth - 100; // 50px margins each side
    const marginLeft = 50;
    const marginRight = 50;

    // ===== HEADER =====
    // Full-width dark navy header
    doc.save();
    doc.rect(0, 0, pageWidth, 90).fill(COLORS.darkNavy);
    doc.restore();

    // Logo
    const logoPath = getAssetPath('logo.png');
    if (logoPath) {
      doc.image(logoPath, marginLeft, 22, { height: 44 });
    } else {
      doc.font(fontBold).fontSize(24).fillColor(COLORS.white);
      doc.text('AZUL', marginLeft, 28, { continued: true });
      doc.fillColor(COLORS.gold).text(' CARS');
    }

    // Request number and date (right side)
    doc.font(fontBold).fontSize(11).fillColor(COLORS.white);
    doc.text(`N\u00ba ${request.request_number}`, pageWidth - marginRight - 180, 28, { width: 180, align: 'right' });
    doc.font(fontLight).fontSize(9).fillColor(COLORS.lightGold);
    doc.text(formatDate(request.created_at), pageWidth - marginRight - 180, 46, { width: 180, align: 'right' });
    
    // Subtitle
    doc.font(fontMedium).fontSize(9).fillColor(COLORS.gold);
    doc.text('ORDEN DE SERVICIO', marginLeft, 72);

    // Gold accent line below header
    doc.save();
    doc.rect(0, 90, pageWidth, 3).fill(COLORS.gold);
    doc.restore();

    let yPos = 110;

    // ===== CLIENT INFORMATION SECTION =====
    doc.font(fontBold).fontSize(10).fillColor(COLORS.darkNavy);
    doc.text('INFORMACI\u00d3N DEL CLIENTE', marginLeft, yPos);
    yPos += 5;
    // Underline
    doc.moveTo(marginLeft, yPos + 12).lineTo(marginLeft + 140, yPos + 12).strokeColor(COLORS.gold).lineWidth(1).stroke();
    yPos += 22;

    // Client info in a clean grid
    const drawField = (label: string, value: string, x: number, y: number, width: number) => {
      doc.font(fontLight).fontSize(7.5).fillColor(COLORS.mediumGray);
      doc.text(label, x, y);
      doc.font(fontRegular).fontSize(9.5).fillColor(COLORS.black);
      doc.text(value || '-', x, y + 11, { width });
    };

    const col1X = marginLeft;
    const col2X = marginLeft + contentWidth / 2 + 10;
    const colWidth = contentWidth / 2 - 10;

    drawField('Nombre del cliente', request.client_name || '-', col1X, yPos, colWidth);
    drawField('Tipo de servicio', getClientTypeLabel(request.client_type), col2X, yPos, colWidth);
    yPos += 38;

    drawField('Tel\u00e9fono', request.client_phone || '-', col1X, yPos, colWidth);
    drawField('Email', request.client_email || '-', col2X, yPos, colWidth);
    yPos += 38;

    if (request.client_type === 'villa' && request.villa_name) {
      drawField('Villa', request.villa_name, col1X, yPos, colWidth);
      if (request.villa_address) {
        drawField('Direcci\u00f3n', request.villa_address, col2X, yPos, colWidth);
      }
      yPos += 38;
    } else if (request.client_type === 'charter') {
      drawField('Embarcaci\u00f3n', request.boat_name || '-', col1X, yPos, colWidth);
      drawField('Amarre', request.berth_number || '-', col2X, yPos, colWidth);
      yPos += 38;
    }

    if (request.broker_name) {
      drawField('Broker', request.broker_name, col1X, yPos, colWidth);
      yPos += 38;
    }

    // ===== TRANSFERS SECTION =====
    // Section divider
    doc.moveTo(marginLeft, yPos).lineTo(pageWidth - marginRight, yPos).strokeColor(COLORS.borderGray).lineWidth(0.5).stroke();
    yPos += 18;

    doc.font(fontBold).fontSize(10).fillColor(COLORS.darkNavy);
    doc.text('SERVICIOS DE TRANSFER', marginLeft, yPos);
    yPos += 5;
    doc.moveTo(marginLeft, yPos + 12).lineTo(marginLeft + 155, yPos + 12).strokeColor(COLORS.gold).lineWidth(1).stroke();
    yPos += 22;

    // Draw each transfer item
    for (let index = 0; index < items.length; index++) {
      const item = items[index];
      const route = routeData[index];

      // Calculate card height
      const hasBabySeats = item.baby_seats_count && item.baby_seats_count > 0;
      let seatsArr: any[] = [];
      if (hasBabySeats && item.baby_seats) {
        try { seatsArr = typeof item.baby_seats === 'string' ? JSON.parse(item.baby_seats) : item.baby_seats; } catch {}
      }

      // Estimate height needed for this item
      let estimatedHeight = 155; // base
      if (hasBabySeats) estimatedHeight += 30 + (seatsArr.length * 14);
      if (route?.mapImage) estimatedHeight += 175;

      // Check if we need a new page (leave 60px for footer)
      if (yPos + estimatedHeight > doc.page.height - 60) {
        doc.addPage();
        yPos = 50;
      }

      // Item card with subtle left border
      const cardStartY = yPos;
      
      // Left accent bar
      doc.save();
      doc.rect(marginLeft, yPos, 3, 28).fill(COLORS.gold);
      doc.restore();

      // Transfer header row
      const headerX = marginLeft + 12;
      doc.font(fontBold).fontSize(10).fillColor(COLORS.darkNavy);
      doc.text(`Transfer ${index + 1}`, headerX, yPos + 4);

      // Direction badge
      const dirLabel = getDirectionLabel(item.direction);
      const badgeX = headerX + 72;
      const badgeColor = item.direction === 'ida' ? COLORS.gold : COLORS.navy;
      doc.save();
      doc.roundedRect(badgeX, yPos + 2, 42, 17, 8).fill(badgeColor);
      doc.restore();
      doc.font(fontMedium).fontSize(7.5).fillColor(COLORS.white);
      doc.text(dirLabel, badgeX + 3, yPos + 6, { width: 36, align: 'center' });

      // Date and time
      doc.font(fontRegular).fontSize(9).fillColor(COLORS.darkGray);
      const dateTimeStr = `${formatDateShort(item.transfer_date)}  \u2022  ${formatTime(item.transfer_time)} h`;
      doc.text(dateTimeStr, headerX + 140, yPos + 6);

      // Flight number
      if (item.flight_number) {
        doc.font(fontMedium).fontSize(8).fillColor(COLORS.mediumGray);
        doc.text(`Vuelo: ${item.flight_number}`, pageWidth - marginRight - 120, yPos + 6, { width: 120, align: 'right' });
      }

      yPos += 32;

      // Route section with timeline dots
      const routeX = marginLeft + 18;

      // Pickup
      doc.save();
      doc.circle(routeX, yPos + 5, 5).fill(COLORS.gold);
      doc.restore();
      // Small "A" in the circle
      doc.font(fontBold).fontSize(6).fillColor(COLORS.white);
      doc.text('A', routeX - 3, yPos + 2.5, { width: 6, align: 'center' });

      doc.font(fontLight).fontSize(7).fillColor(COLORS.mediumGray);
      doc.text('RECOGIDA', routeX + 14, yPos - 1);
      doc.font(fontRegular).fontSize(9).fillColor(COLORS.black);
      doc.text(item.pickup_location || '-', routeX + 14, yPos + 9, { width: contentWidth - 50 });

      // Connecting dotted line
      yPos += 26;
      for (let i = 0; i < 3; i++) {
        doc.circle(routeX, yPos + i * 5, 1.2).fill(COLORS.borderGray);
      }

      // Dropoff
      yPos += 18;
      doc.save();
      doc.circle(routeX, yPos + 5, 5).fill(COLORS.darkNavy);
      doc.restore();
      doc.font(fontBold).fontSize(6).fillColor(COLORS.white);
      doc.text('B', routeX - 3, yPos + 2.5, { width: 6, align: 'center' });

      doc.font(fontLight).fontSize(7).fillColor(COLORS.mediumGray);
      doc.text('DESTINO', routeX + 14, yPos - 1);
      doc.font(fontRegular).fontSize(9).fillColor(COLORS.black);
      doc.text(item.dropoff_location || '-', routeX + 14, yPos + 9, { width: contentWidth - 50 });

      yPos += 28;

      // Route distance/duration info
      if (route && (route.distance || route.duration)) {
        doc.font(fontMedium).fontSize(8).fillColor(COLORS.mediumGray);
        const routeInfo = [route.distance, route.duration].filter(Boolean).join('  \u2022  ');
        doc.text(`\u2192  ${routeInfo}`, routeX + 14, yPos);
        yPos += 16;
      }

      // Route map image
      if (route?.mapImage) {
        yPos += 4;
        // Draw map with rounded corners effect (clip)
        doc.save();
        doc.roundedRect(marginLeft + 12, yPos, contentWidth - 12, 150, 6).clip();
        doc.image(route.mapImage, marginLeft + 12, yPos, { width: contentWidth - 12, height: 150 });
        doc.restore();
        // Border around map
        doc.roundedRect(marginLeft + 12, yPos, contentWidth - 12, 150, 6).strokeColor(COLORS.borderGray).lineWidth(0.5).stroke();
        yPos += 158;
      }

      // Bottom info row: vehicle, passengers, driver
      yPos += 6;
      const infoY = yPos;
      
      // Light background for info row
      doc.save();
      doc.roundedRect(marginLeft + 12, infoY - 3, contentWidth - 12, 22, 4).fill(COLORS.lightGray);
      doc.restore();

      const infoX = marginLeft + 20;
      doc.font(fontLight).fontSize(7.5).fillColor(COLORS.mediumGray);
      doc.text('Veh\u00edculo', infoX, infoY);
      doc.font(fontRegular).fontSize(8.5).fillColor(COLORS.darkGray);
      doc.text(getVehicleLabel(item.vehicle_type), infoX, infoY + 9);

      doc.font(fontLight).fontSize(7.5).fillColor(COLORS.mediumGray);
      doc.text('Pasajeros', infoX + 150, infoY);
      doc.font(fontRegular).fontSize(8.5).fillColor(COLORS.darkGray);
      doc.text(`${item.pax_count || '-'}`, infoX + 150, infoY + 9);

      if (item.driver_name) {
        doc.font(fontLight).fontSize(7.5).fillColor(COLORS.mediumGray);
        doc.text('Conductor', infoX + 240, infoY);
        doc.font(fontRegular).fontSize(8.5).fillColor(COLORS.darkGray);
        doc.text(item.driver_name, infoX + 240, infoY + 9);
      }

      yPos += 28;

      // Baby seats section
      if (hasBabySeats) {
        yPos += 4;
        // Pink accent background
        doc.save();
        const babySectionHeight = 18 + (seatsArr.length > 0 ? seatsArr.length * 15 + 4 : 0);
        doc.roundedRect(marginLeft + 12, yPos - 3, contentWidth - 12, babySectionHeight, 4).fill(COLORS.lightPink);
        doc.restore();

        doc.font(fontBold).fontSize(8.5).fillColor(COLORS.pink);
        doc.text(`Sillitas de beb\u00e9: ${item.baby_seats_count}`, marginLeft + 20, yPos);
        yPos += 14;

        if (seatsArr.length > 0) {
          seatsArr.forEach((seat: any, sIdx: number) => {
            doc.font(fontRegular).fontSize(8).fillColor(COLORS.darkGray);
            const seatInfo = `Silla ${sIdx + 1}:  ${seat.age} a\u00f1os  \u2022  ${seat.weight} kg  \u2022  ${getBabySeatGroupDesc(seat.weight)}`;
            doc.text(seatInfo, marginLeft + 28, yPos);
            yPos += 14;
          });
        }
        yPos += 6;
      }

      // Separator between items
      if (index < items.length - 1) {
        yPos += 8;
        doc.moveTo(marginLeft + 12, yPos).lineTo(pageWidth - marginRight, yPos).strokeColor(COLORS.borderGray).lineWidth(0.3).stroke();
        yPos += 14;
      }
    }

    // ===== NOTES SECTION =====
    if (request.notes) {
      yPos += 12;
      if (yPos > doc.page.height - 100) {
        doc.addPage();
        yPos = 50;
      }

      doc.moveTo(marginLeft, yPos).lineTo(pageWidth - marginRight, yPos).strokeColor(COLORS.borderGray).lineWidth(0.5).stroke();
      yPos += 16;

      doc.font(fontBold).fontSize(10).fillColor(COLORS.darkNavy);
      doc.text('OBSERVACIONES', marginLeft, yPos);
      yPos += 5;
      doc.moveTo(marginLeft, yPos + 12).lineTo(marginLeft + 100, yPos + 12).strokeColor(COLORS.gold).lineWidth(1).stroke();
      yPos += 20;

      doc.font(fontRegular).fontSize(9).fillColor(COLORS.darkGray);
      doc.text(request.notes, marginLeft, yPos, { width: contentWidth });
    }

    // ===== FOOTER =====
    // Draw footer at the bottom of the current page
    const footerY = doc.page.height - 42;
    doc.save();
    doc.moveTo(marginLeft, footerY).lineTo(pageWidth - marginRight, footerY).strokeColor(COLORS.gold).lineWidth(0.5).stroke();
    doc.restore();
    doc.font(fontMedium).fontSize(7).fillColor(COLORS.mediumGray);
    doc.text('Azul Cars  \u2022  Servicio Premium de Transfers', marginLeft, footerY + 6, { align: 'center', width: contentWidth, lineBreak: false });
    doc.font(fontLight).fontSize(6.5).fillColor(COLORS.mediumGray);
    doc.text('Este documento es una confirmaci\u00f3n del servicio solicitado. Para modificaciones, contacte con su gestor.', marginLeft, footerY + 17, { align: 'center', width: contentWidth, lineBreak: false });

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
