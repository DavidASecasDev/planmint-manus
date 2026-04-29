/**
 * Tests for syncRently.ts performance optimizations (v2).
 * Validates the structural changes: multi-page processing, parallel detail fetching,
 * smart enrichment logic, and early termination.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const SYNC_FILE = path.resolve(__dirname, "syncRently.ts");
const syncSource = fs.readFileSync(SYNC_FILE, "utf-8");

// Also check the client-side sync context
const CONTEXT_FILE = path.resolve(__dirname, "../client/src/contexts/RentlySyncContext.tsx");
const contextSource = fs.readFileSync(CONTEXT_FILE, "utf-8");

describe("syncRently.ts performance optimizations", () => {
  describe("Multi-page processing per request", () => {
    it("should define PAGES_PER_REQUEST constant > 1 and <= 5 (Cloudflare safe)", () => {
      const match = syncSource.match(/const PAGES_PER_REQUEST\s*=\s*(\d+)/);
      expect(match).toBeTruthy();
      const value = parseInt(match![1]);
      expect(value).toBeGreaterThan(1);
      expect(value).toBeLessThanOrEqual(5); // must stay under Cloudflare 100s timeout
    });

    it("should define REQUEST_DEADLINE_MS under 100s to prevent Cloudflare 524", () => {
      const match = syncSource.match(/const REQUEST_DEADLINE_MS\s*=\s*(\d[\d_]*)/);
      expect(match).toBeTruthy();
      const value = parseInt(match![1].replace(/_/g, ""));
      expect(value).toBeLessThan(100_000); // Cloudflare limit
      expect(value).toBeGreaterThan(30_000); // must be useful
    });

    it("should check deadline at the start of each page iteration", () => {
      expect(syncSource).toContain("Date.now() - requestStartTime > REQUEST_DEADLINE_MS");
    });

    it("should skip detail enrichment when approaching deadline", () => {
      expect(syncSource).toContain("timeRemaining > 20_000");
    });

    it("should have a multi-page loop in the handler", () => {
      // The handler should loop up to PAGES_PER_REQUEST pages
      expect(syncSource).toContain("for (let pageIdx = 0; pageIdx < PAGES_PER_REQUEST");
    });

    it("should track cumulative totals across pages in a single request", () => {
      expect(syncSource).toContain("totalBookingsFetched");
      expect(syncSource).toContain("totalInsertedCount");
      expect(syncSource).toContain("totalDetailsFetched");
    });
  });

  describe("Parallel detail enrichment", () => {
    it("should define DETAIL_CONCURRENCY constant", () => {
      const match = syncSource.match(/const DETAIL_CONCURRENCY\s*=\s*(\d+)/);
      expect(match).toBeTruthy();
      const value = parseInt(match![1]);
      expect(value).toBeGreaterThanOrEqual(3);
      expect(value).toBeLessThanOrEqual(10);
    });

    it("should have a fetchDetailsInParallel function", () => {
      expect(syncSource).toContain("async function fetchDetailsInParallel");
    });

    it("should use Promise.allSettled for parallel fetching", () => {
      expect(syncSource).toContain("Promise.allSettled");
    });

    it("should process in chunks of concurrency", () => {
      // The parallel function should slice into chunks
      expect(syncSource).toContain("chunk = bookingIds.slice(i, i + concurrency)");
    });

    it("should call fetchDetailsInParallel instead of sequential loop", () => {
      // The old pattern was a for loop calling fetchBookingDetail one by one
      // The new pattern calls fetchDetailsInParallel
      expect(syncSource).toContain("detailsMap = await fetchDetailsInParallel(");
    });
  });

  describe("Smart enrichment", () => {
    it("should check for status changes to decide enrichment", () => {
      expect(syncSource).toContain("statusChanged");
      expect(syncSource).toContain("previousStatus");
    });

    it("should track existing status codes from DB", () => {
      expect(syncSource).toContain("rently_status_code");
      expect(syncSource).toContain("existingStatusMap");
    });

    it("should still enrich new bookings", () => {
      expect(syncSource).toContain("isNew");
    });

    it("should still enrich bookings without detail", () => {
      expect(syncSource).toContain("!hasDetail");
    });

    it("should still enrich active status bookings", () => {
      expect(syncSource).toContain("isActiveStatus");
    });
  });

  describe("Early termination", () => {
    it("should define EARLY_TERM_UNCHANGED_PAGES constant", () => {
      const match = syncSource.match(/const EARLY_TERM_UNCHANGED_PAGES\s*=\s*(\d+)/);
      expect(match).toBeTruthy();
      const value = parseInt(match![1]);
      expect(value).toBeGreaterThanOrEqual(3);
    });

    it("should track consecutive unchanged pages", () => {
      expect(syncSource).toContain("consecutiveUnchangedPages");
    });

    it("should break out of loop after enough unchanged pages", () => {
      expect(syncSource).toContain("consecutiveUnchangedPages >= EARLY_TERM_UNCHANGED_PAGES");
    });

    it("should log early termination", () => {
      expect(syncSource).toContain("Early termination");
    });
  });

  describe("Client-side sync context optimizations", () => {
    it("should NOT have artificial sleep between pages", () => {
      // The old code had: if (hasMore) await sleep(300);
      expect(contextSource).not.toMatch(/await sleep\(\d+\)/);
    });

    it("should still have pause/cancel support", () => {
      expect(contextSource).toContain("pauseRequestedRef");
      expect(contextSource).toContain("cancelRequestedRef");
    });
  });

  describe("Preserved functionality", () => {
    it("should still have vehicle status sync", () => {
      expect(syncSource).toContain("async function syncVehicleStatuses");
    });

    it("should still archive old reservations on completion", () => {
      expect(syncSource).toContain("archive_old_reservations");
    });

    it("should still handle Cancelada status properly", () => {
      expect(syncSource).toContain('estado_entrega = "Cancelada"');
      expect(syncSource).toContain('estado_devolucion = "Cancelada"');
    });

    it("should still handle Completada status properly", () => {
      expect(syncSource).toContain("estado_terminada_at");
    });

    it("should still use upsert for new reservations", () => {
      expect(syncSource).toContain(".upsert(newReservations");
    });

    it("should never overwrite confirmed datetimes", () => {
      expect(syncSource).toContain("delete updateData.confirmed_entrega_datetime");
      expect(syncSource).toContain("delete updateData.confirmed_devolucion_datetime");
    });

    it("should still support test_only mode", () => {
      expect(syncSource).toContain("test_only");
      expect(syncSource).toContain("Conexión exitosa");
    });

    it("should still support sync_vehicles action", () => {
      expect(syncSource).toContain('action === "sync_vehicles"');
    });
  });
});
