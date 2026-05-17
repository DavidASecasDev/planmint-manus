-- Seed transfer_pricing table with LimoMallorca B2B 2026 tariffs
-- This script inserts all zone × vehicle combinations for point_to_point transfers
-- and all vehicle × duration combinations for pack transfers.
-- 
-- organization_id is set dynamically from the first organization found.
-- commission_price = base_price * 1.5 (50% commission)
--
-- Run this ONCE to populate the table. After that, manage via the admin panel.

DO $$
DECLARE
  org_id UUID;
BEGIN
  -- Get the first organization_id from the organizations table
  SELECT id INTO org_id FROM organizations LIMIT 1;
  
  IF org_id IS NULL THEN
    RAISE EXCEPTION 'No organization found. Please create an organization first.';
  END IF;

  -- Delete existing pricing data (clean slate)
  DELETE FROM transfer_pricing WHERE organization_id = org_id;

  -- ═══════════════════════════════════════════════════════════════════
  -- POINT-TO-POINT TRANSFERS (29 zones × 5 vehicles = 145 rows)
  -- ═══════════════════════════════════════════════════════════════════

  INSERT INTO transfer_pricing (organization_id, zone_key, zone_label, vehicle_type, base_price, commission_price, service_type, pack_duration, is_active) VALUES
  -- Alaró
  (org_id, 'alaro', 'Alaró', 'mb_eqe', 132, 198, 'point_to_point', NULL, true),
  (org_id, 'alaro', 'Alaró', 's_class', 150, 225, 'point_to_point', NULL, true),
  (org_id, 'alaro', 'Alaró', 'v_class', 150, 225, 'point_to_point', NULL, true),
  (org_id, 'alaro', 'Alaró', 'iv_class', 150, 225, 'point_to_point', NULL, true),
  (org_id, 'alaro', 'Alaró', 'sprinter', 352, 528, 'point_to_point', NULL, true),
  -- Alcudia
  (org_id, 'alcudia', 'Alcudia', 'mb_eqe', 167, 251, 'point_to_point', NULL, true),
  (org_id, 'alcudia', 'Alcudia', 's_class', 196, 294, 'point_to_point', NULL, true),
  (org_id, 'alcudia', 'Alcudia', 'v_class', 196, 294, 'point_to_point', NULL, true),
  (org_id, 'alcudia', 'Alcudia', 'iv_class', 196, 294, 'point_to_point', NULL, true),
  (org_id, 'alcudia', 'Alcudia', 'sprinter', 374, 561, 'point_to_point', NULL, true),
  -- Algaida
  (org_id, 'algaida', 'Algaida', 'mb_eqe', 97, 146, 'point_to_point', NULL, true),
  (org_id, 'algaida', 'Algaida', 's_class', 123, 185, 'point_to_point', NULL, true),
  (org_id, 'algaida', 'Algaida', 'v_class', 123, 185, 'point_to_point', NULL, true),
  (org_id, 'algaida', 'Algaida', 'iv_class', 123, 185, 'point_to_point', NULL, true),
  (org_id, 'algaida', 'Algaida', 'sprinter', 330, 495, 'point_to_point', NULL, true),
  -- Andratx
  (org_id, 'andratx', 'Andratx', 'mb_eqe', 132, 198, 'point_to_point', NULL, true),
  (org_id, 'andratx', 'Andratx', 's_class', 161, 242, 'point_to_point', NULL, true),
  (org_id, 'andratx', 'Andratx', 'v_class', 161, 242, 'point_to_point', NULL, true),
  (org_id, 'andratx', 'Andratx', 'iv_class', 161, 242, 'point_to_point', NULL, true),
  (org_id, 'andratx', 'Andratx', 'sprinter', 341, 512, 'point_to_point', NULL, true),
  -- Cala d'Or
  (org_id, 'cala_dor', 'Cala d''Or', 'mb_eqe', 163, 245, 'point_to_point', NULL, true),
  (org_id, 'cala_dor', 'Cala d''Or', 's_class', 189, 284, 'point_to_point', NULL, true),
  (org_id, 'cala_dor', 'Cala d''Or', 'v_class', 189, 284, 'point_to_point', NULL, true),
  (org_id, 'cala_dor', 'Cala d''Or', 'iv_class', 189, 284, 'point_to_point', NULL, true),
  (org_id, 'cala_dor', 'Cala d''Or', 'sprinter', 385, 578, 'point_to_point', NULL, true),
  -- Cala Millor
  (org_id, 'cala_millor', 'Cala Millor', 'mb_eqe', 176, 264, 'point_to_point', NULL, true),
  (org_id, 'cala_millor', 'Cala Millor', 's_class', 207, 311, 'point_to_point', NULL, true),
  (org_id, 'cala_millor', 'Cala Millor', 'v_class', 207, 311, 'point_to_point', NULL, true),
  (org_id, 'cala_millor', 'Cala Millor', 'iv_class', 207, 311, 'point_to_point', NULL, true),
  (org_id, 'cala_millor', 'Cala Millor', 'sprinter', 407, 611, 'point_to_point', NULL, true),
  -- Cala Ratjada
  (org_id, 'cala_ratjada', 'Cala Ratjada', 'mb_eqe', 189, 284, 'point_to_point', NULL, true),
  (org_id, 'cala_ratjada', 'Cala Ratjada', 's_class', 218, 327, 'point_to_point', NULL, true),
  (org_id, 'cala_ratjada', 'Cala Ratjada', 'v_class', 218, 327, 'point_to_point', NULL, true),
  (org_id, 'cala_ratjada', 'Cala Ratjada', 'iv_class', 218, 327, 'point_to_point', NULL, true),
  (org_id, 'cala_ratjada', 'Cala Ratjada', 'sprinter', 424, 636, 'point_to_point', NULL, true),
  -- Deia
  (org_id, 'deia', 'Deia', 'mb_eqe', 141, 212, 'point_to_point', NULL, true),
  (org_id, 'deia', 'Deia', 's_class', 169, 254, 'point_to_point', NULL, true),
  (org_id, 'deia', 'Deia', 'v_class', 169, 254, 'point_to_point', NULL, true),
  (org_id, 'deia', 'Deia', 'iv_class', 169, 254, 'point_to_point', NULL, true),
  (org_id, 'deia', 'Deia', 'sprinter', 358, 537, 'point_to_point', NULL, true),
  -- Formentor
  (org_id, 'formentor', 'Formentor', 'mb_eqe', 194, 291, 'point_to_point', NULL, true),
  (org_id, 'formentor', 'Formentor', 's_class', 231, 347, 'point_to_point', NULL, true),
  (org_id, 'formentor', 'Formentor', 'v_class', 231, 347, 'point_to_point', NULL, true),
  (org_id, 'formentor', 'Formentor', 'iv_class', 231, 347, 'point_to_point', NULL, true),
  (org_id, 'formentor', 'Formentor', 'sprinter', 440, 660, 'point_to_point', NULL, true),
  -- Illetas
  (org_id, 'illetas', 'Illetas', 'mb_eqe', 97, 146, 'point_to_point', NULL, true),
  (org_id, 'illetas', 'Illetas', 's_class', 121, 182, 'point_to_point', NULL, true),
  (org_id, 'illetas', 'Illetas', 'v_class', 121, 182, 'point_to_point', NULL, true),
  (org_id, 'illetas', 'Illetas', 'iv_class', 121, 182, 'point_to_point', NULL, true),
  (org_id, 'illetas', 'Illetas', 'sprinter', 297, 446, 'point_to_point', NULL, true),
  -- Inca
  (org_id, 'inca', 'Inca', 'mb_eqe', 132, 198, 'point_to_point', NULL, true),
  (org_id, 'inca', 'Inca', 's_class', 154, 231, 'point_to_point', NULL, true),
  (org_id, 'inca', 'Inca', 'v_class', 154, 231, 'point_to_point', NULL, true),
  (org_id, 'inca', 'Inca', 'iv_class', 154, 231, 'point_to_point', NULL, true),
  (org_id, 'inca', 'Inca', 'sprinter', 325, 488, 'point_to_point', NULL, true),
  -- Llucmajor
  (org_id, 'llucmajor', 'Llucmajor', 'mb_eqe', 92, 138, 'point_to_point', NULL, true),
  (org_id, 'llucmajor', 'Llucmajor', 's_class', 123, 185, 'point_to_point', NULL, true),
  (org_id, 'llucmajor', 'Llucmajor', 'v_class', 123, 185, 'point_to_point', NULL, true),
  (org_id, 'llucmajor', 'Llucmajor', 'iv_class', 123, 185, 'point_to_point', NULL, true),
  (org_id, 'llucmajor', 'Llucmajor', 'sprinter', 297, 446, 'point_to_point', NULL, true),
  -- Magaluf
  (org_id, 'magaluf', 'Magaluf', 'mb_eqe', 110, 165, 'point_to_point', NULL, true),
  (org_id, 'magaluf', 'Magaluf', 's_class', 136, 204, 'point_to_point', NULL, true),
  (org_id, 'magaluf', 'Magaluf', 'v_class', 136, 204, 'point_to_point', NULL, true),
  (org_id, 'magaluf', 'Magaluf', 'iv_class', 136, 204, 'point_to_point', NULL, true),
  (org_id, 'magaluf', 'Magaluf', 'sprinter', 297, 446, 'point_to_point', NULL, true),
  -- Manacor
  (org_id, 'manacor', 'Manacor', 'mb_eqe', 145, 218, 'point_to_point', NULL, true),
  (org_id, 'manacor', 'Manacor', 's_class', 176, 264, 'point_to_point', NULL, true),
  (org_id, 'manacor', 'Manacor', 'v_class', 176, 264, 'point_to_point', NULL, true),
  (org_id, 'manacor', 'Manacor', 'iv_class', 176, 264, 'point_to_point', NULL, true),
  (org_id, 'manacor', 'Manacor', 'sprinter', 341, 512, 'point_to_point', NULL, true),
  -- Marratxí
  (org_id, 'marratxi', 'Marratxí', 'mb_eqe', 88, 132, 'point_to_point', NULL, true),
  (org_id, 'marratxi', 'Marratxí', 's_class', 117, 176, 'point_to_point', NULL, true),
  (org_id, 'marratxi', 'Marratxí', 'v_class', 117, 176, 'point_to_point', NULL, true),
  (org_id, 'marratxi', 'Marratxí', 'iv_class', 117, 176, 'point_to_point', NULL, true),
  (org_id, 'marratxi', 'Marratxí', 'sprinter', 275, 413, 'point_to_point', NULL, true),
  -- Palma
  (org_id, 'palma', 'Palma', 'mb_eqe', 79, 119, 'point_to_point', NULL, true),
  (org_id, 'palma', 'Palma', 's_class', 112, 168, 'point_to_point', NULL, true),
  (org_id, 'palma', 'Palma', 'v_class', 112, 168, 'point_to_point', NULL, true),
  (org_id, 'palma', 'Palma', 'iv_class', 112, 168, 'point_to_point', NULL, true),
  (org_id, 'palma', 'Palma', 'sprinter', 253, 380, 'point_to_point', NULL, true),
  -- Palmanova
  (org_id, 'palmanova', 'Palmanova', 'mb_eqe', 106, 159, 'point_to_point', NULL, true),
  (org_id, 'palmanova', 'Palmanova', 's_class', 132, 198, 'point_to_point', NULL, true),
  (org_id, 'palmanova', 'Palmanova', 'v_class', 132, 198, 'point_to_point', NULL, true),
  (org_id, 'palmanova', 'Palmanova', 'iv_class', 132, 198, 'point_to_point', NULL, true),
  (org_id, 'palmanova', 'Palmanova', 'sprinter', 308, 462, 'point_to_point', NULL, true),
  -- Pollença
  (org_id, 'pollenca', 'Pollença', 'mb_eqe', 172, 258, 'point_to_point', NULL, true),
  (org_id, 'pollenca', 'Pollença', 's_class', 200, 300, 'point_to_point', NULL, true),
  (org_id, 'pollenca', 'Pollença', 'v_class', 200, 300, 'point_to_point', NULL, true),
  (org_id, 'pollenca', 'Pollença', 'iv_class', 200, 300, 'point_to_point', NULL, true),
  (org_id, 'pollenca', 'Pollença', 'sprinter', 391, 587, 'point_to_point', NULL, true),
  -- Portals
  (org_id, 'portals', 'Portals', 'mb_eqe', 88, 132, 'point_to_point', NULL, true),
  (org_id, 'portals', 'Portals', 's_class', 123, 185, 'point_to_point', NULL, true),
  (org_id, 'portals', 'Portals', 'v_class', 123, 185, 'point_to_point', NULL, true),
  (org_id, 'portals', 'Portals', 'iv_class', 123, 185, 'point_to_point', NULL, true),
  (org_id, 'portals', 'Portals', 'sprinter', 286, 429, 'point_to_point', NULL, true),
  -- Porto Colom
  (org_id, 'porto_colom', 'Porto Colom', 'mb_eqe', 145, 218, 'point_to_point', NULL, true),
  (org_id, 'porto_colom', 'Porto Colom', 's_class', 172, 258, 'point_to_point', NULL, true),
  (org_id, 'porto_colom', 'Porto Colom', 'v_class', 172, 258, 'point_to_point', NULL, true),
  (org_id, 'porto_colom', 'Porto Colom', 'iv_class', 172, 258, 'point_to_point', NULL, true),
  (org_id, 'porto_colom', 'Porto Colom', 'sprinter', 380, 570, 'point_to_point', NULL, true),
  -- Porto Cristo
  (org_id, 'porto_cristo', 'Porto Cristo', 'mb_eqe', 158, 237, 'point_to_point', NULL, true),
  (org_id, 'porto_cristo', 'Porto Cristo', 's_class', 183, 275, 'point_to_point', NULL, true),
  (org_id, 'porto_cristo', 'Porto Cristo', 'v_class', 183, 275, 'point_to_point', NULL, true),
  (org_id, 'porto_cristo', 'Porto Cristo', 'iv_class', 183, 275, 'point_to_point', NULL, true),
  (org_id, 'porto_cristo', 'Porto Cristo', 'sprinter', 385, 578, 'point_to_point', NULL, true),
  -- Puigpunyent
  (org_id, 'puigpunyent', 'Puigpunyent', 'mb_eqe', 123, 185, 'point_to_point', NULL, true),
  (org_id, 'puigpunyent', 'Puigpunyent', 's_class', 147, 221, 'point_to_point', NULL, true),
  (org_id, 'puigpunyent', 'Puigpunyent', 'v_class', 147, 221, 'point_to_point', NULL, true),
  (org_id, 'puigpunyent', 'Puigpunyent', 'iv_class', 147, 221, 'point_to_point', NULL, true),
  (org_id, 'puigpunyent', 'Puigpunyent', 'sprinter', 286, 429, 'point_to_point', NULL, true),
  -- Sa Pobla
  (org_id, 'sa_pobla', 'Sa Pobla', 'mb_eqe', 141, 212, 'point_to_point', NULL, true),
  (org_id, 'sa_pobla', 'Sa Pobla', 's_class', 163, 245, 'point_to_point', NULL, true),
  (org_id, 'sa_pobla', 'Sa Pobla', 'v_class', 163, 245, 'point_to_point', NULL, true),
  (org_id, 'sa_pobla', 'Sa Pobla', 'iv_class', 163, 245, 'point_to_point', NULL, true),
  (org_id, 'sa_pobla', 'Sa Pobla', 'sprinter', 341, 512, 'point_to_point', NULL, true),
  -- Santa Eugenia
  (org_id, 'santa_eugenia', 'Santa Eugenia', 'mb_eqe', 132, 198, 'point_to_point', NULL, true),
  (org_id, 'santa_eugenia', 'Santa Eugenia', 's_class', 152, 228, 'point_to_point', NULL, true),
  (org_id, 'santa_eugenia', 'Santa Eugenia', 'v_class', 152, 228, 'point_to_point', NULL, true),
  (org_id, 'santa_eugenia', 'Santa Eugenia', 'iv_class', 152, 228, 'point_to_point', NULL, true),
  (org_id, 'santa_eugenia', 'Santa Eugenia', 'sprinter', 330, 495, 'point_to_point', NULL, true),
  -- Sta. Margalida
  (org_id, 'sta_margalida', 'Sta. Margalida', 'mb_eqe', 172, 258, 'point_to_point', NULL, true),
  (org_id, 'sta_margalida', 'Sta. Margalida', 's_class', 198, 297, 'point_to_point', NULL, true),
  (org_id, 'sta_margalida', 'Sta. Margalida', 'v_class', 198, 297, 'point_to_point', NULL, true),
  (org_id, 'sta_margalida', 'Sta. Margalida', 'iv_class', 198, 297, 'point_to_point', NULL, true),
  (org_id, 'sta_margalida', 'Sta. Margalida', 'sprinter', 402, 603, 'point_to_point', NULL, true),
  -- Santa Maria
  (org_id, 'santa_maria', 'Santa Maria', 'mb_eqe', 123, 185, 'point_to_point', NULL, true),
  (org_id, 'santa_maria', 'Santa Maria', 's_class', 147, 221, 'point_to_point', NULL, true),
  (org_id, 'santa_maria', 'Santa Maria', 'v_class', 147, 221, 'point_to_point', NULL, true),
  (org_id, 'santa_maria', 'Santa Maria', 'iv_class', 147, 221, 'point_to_point', NULL, true),
  (org_id, 'santa_maria', 'Santa Maria', 'sprinter', 303, 455, 'point_to_point', NULL, true),
  -- Santa Ponça
  (org_id, 'santa_ponca', 'Santa Ponça', 'mb_eqe', 114, 171, 'point_to_point', NULL, true),
  (org_id, 'santa_ponca', 'Santa Ponça', 's_class', 141, 212, 'point_to_point', NULL, true),
  (org_id, 'santa_ponca', 'Santa Ponça', 'v_class', 141, 212, 'point_to_point', NULL, true),
  (org_id, 'santa_ponca', 'Santa Ponça', 'iv_class', 141, 212, 'point_to_point', NULL, true),
  (org_id, 'santa_ponca', 'Santa Ponça', 'sprinter', 319, 479, 'point_to_point', NULL, true),
  -- Sóller
  (org_id, 'soller', 'Sóller', 'mb_eqe', 141, 212, 'point_to_point', NULL, true),
  (org_id, 'soller', 'Sóller', 's_class', 167, 251, 'point_to_point', NULL, true),
  (org_id, 'soller', 'Sóller', 'v_class', 167, 251, 'point_to_point', NULL, true),
  (org_id, 'soller', 'Sóller', 'iv_class', 167, 251, 'point_to_point', NULL, true),
  (org_id, 'soller', 'Sóller', 'sprinter', 341, 512, 'point_to_point', NULL, true),
  -- Valldemossa
  (org_id, 'valldemossa', 'Valldemossa', 'mb_eqe', 132, 198, 'point_to_point', NULL, true),
  (org_id, 'valldemossa', 'Valldemossa', 's_class', 158, 237, 'point_to_point', NULL, true),
  (org_id, 'valldemossa', 'Valldemossa', 'v_class', 158, 237, 'point_to_point', NULL, true),
  (org_id, 'valldemossa', 'Valldemossa', 'iv_class', 158, 237, 'point_to_point', NULL, true),
  (org_id, 'valldemossa', 'Valldemossa', 'sprinter', 330, 495, 'point_to_point', NULL, true);

  -- ═══════════════════════════════════════════════════════════════════
  -- PACK TRANSFERS (5 vehicles × 4 durations = 20 rows)
  -- ═══════════════════════════════════════════════════════════════════

  INSERT INTO transfer_pricing (organization_id, zone_key, zone_label, vehicle_type, base_price, commission_price, service_type, pack_duration, is_active) VALUES
  -- MB EQE (Premium)
  (org_id, '_pack', 'Pack (Disposición)', 'mb_eqe', 220, 330, 'pack', '2h', true),
  (org_id, '_pack', 'Pack (Disposición)', 'mb_eqe', 374, 561, 'pack', '4h', true),
  (org_id, '_pack', 'Pack (Disposición)', 'mb_eqe', 682, 1023, 'pack', '8h', true),
  (org_id, '_pack', 'Pack (Disposición)', 'mb_eqe', 959, 1439, 'pack', '12h', true),
  -- MB S Class (VIP)
  (org_id, '_pack', 'Pack (Disposición)', 's_class', 253, 380, 'pack', '2h', true),
  (org_id, '_pack', 'Pack (Disposición)', 's_class', 462, 693, 'pack', '4h', true),
  (org_id, '_pack', 'Pack (Disposición)', 's_class', 843, 1265, 'pack', '8h', true),
  (org_id, '_pack', 'Pack (Disposición)', 's_class', 1085, 1628, 'pack', '12h', true),
  -- MB V Class (Minivan)
  (org_id, '_pack', 'Pack (Disposición)', 'v_class', 253, 380, 'pack', '2h', true),
  (org_id, '_pack', 'Pack (Disposición)', 'v_class', 462, 693, 'pack', '4h', true),
  (org_id, '_pack', 'Pack (Disposición)', 'v_class', 843, 1265, 'pack', '8h', true),
  (org_id, '_pack', 'Pack (Disposición)', 'v_class', 1085, 1628, 'pack', '12h', true),
  -- MB IV Class (XL Van)
  (org_id, '_pack', 'Pack (Disposición)', 'iv_class', 253, 380, 'pack', '2h', true),
  (org_id, '_pack', 'Pack (Disposición)', 'iv_class', 462, 693, 'pack', '4h', true),
  (org_id, '_pack', 'Pack (Disposición)', 'iv_class', 843, 1265, 'pack', '8h', true),
  (org_id, '_pack', 'Pack (Disposición)', 'iv_class', 1085, 1628, 'pack', '12h', true),
  -- MB Sprinter (Minibus)
  (org_id, '_pack', 'Pack (Disposición)', 'sprinter', 440, 660, 'pack', '2h', true),
  (org_id, '_pack', 'Pack (Disposición)', 'sprinter', 853, 1280, 'pack', '4h', true),
  (org_id, '_pack', 'Pack (Disposición)', 'sprinter', 1309, 1964, 'pack', '8h', true),
  (org_id, '_pack', 'Pack (Disposición)', 'sprinter', 1859, 2789, 'pack', '12h', true);

  RAISE NOTICE 'Successfully seeded % point-to-point + 20 pack pricing rows for org %', 145, org_id;
END $$;
