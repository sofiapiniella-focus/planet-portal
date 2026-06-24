-- ════════════════════════════════════════════════════════════════════
-- PLANET Style Collective Portal — Affiliate / Kit / Shipment data sync
-- Source of truth: kits.json  (as_of 2026-06-22)
-- ════════════════════════════════════════════════════════════════════
--
-- HOW TO RUN
--   1. Supabase Dashboard → SQL Editor → New query.
--   2. Paste this whole file and click "Run".
--   3. Re-runnable: every statement is an idempotent UPSERT, so running it
--      again simply re-applies the source-of-truth values (no duplicates).
--
-- WHAT IT DOES
--   Upserts all 10 affiliates into public.partners, their kits into
--   public.kits, and every kit piece into public.kit_pieces.
--
-- DESIGN NOTES
--   • partners conflict on the UNIQUE column `email`. On conflict we only
--     refresh `name` and `status` — we deliberately DO NOT touch
--     `instagram`, `commission_link`, or `partner_message`, because those
--     are set elsewhere (admin UI / the partner's own note) and kits.json
--     has no authoritative value for them.
--   • kits and kit_pieces have no natural unique key (only their PK), so we
--     assign STABLE hardcoded UUIDs (a0000000-… for kits, b0000000-… for
--     pieces) and conflict on `id`. This is what makes re-runs idempotent.
--   • kits.partner_id is resolved by email subquery, so it stays correct
--     even if a partner row already existed with a different id.
--   • Status map: "Delivered"→Delivered, "Shipped"→Shipped,
--     "To ship"→Preparing (the kits enum has no "To ship").
--   • Carrier, tracking #, ship/delivery dates, addresses, gifted flag,
--     stock-transfer #s, and every special situation (Robin's missing
--     Tranquility Tee, Cindy's stalled Double Angle V Tee swap, Jodie's
--     return-timing question, Ginger's feedback, Carol's keep/return + Tue
--     call) are folded into kits.notes — there are no dedicated columns.
--   • partner_decision (Keep/Return) is set only where kits.json states it
--     (Carol's pieces); all others are left null/undecided.
-- ════════════════════════════════════════════════════════════════════

begin;

-- ─────────────────────────────────────────────────────────────
-- 1) PARTNERS  (conflict on email; preserve instagram/commission/message)
-- ─────────────────────────────────────────────────────────────
insert into public.partners (name, email, status) values
  ('Mitchell Christian', 'houseofpossum@gmail.com',            'Active Partner'),
  ('Carol Davidson',     'carol@caroldavidson.com',            'Active Partner'),
  ('Robin Lamonte',      'admin@helloim50ish.com',             'Active Partner'),
  ('Jodie Filogomo',     'jtouchofstyle@gmail.com',            'Active Partner'),
  ('Marcia Crivorot',    'hello@marciacrivorot.com',           'Active Partner'),
  ('Jenny Pancoast',     'jenny.pancoast@gmail.com',           'Active Partner'),
  ('Ginger Burr',        'ginger@totalimageconsultants.com',   'Active Partner'),
  ('Jan Correll',        'nellenaj@gmail.com',                 'Active Partner'),
  ('Cynthia Sitcov',     'cynthia@theunexpectedsomeone.com',   'Active Partner'),
  ('Cindy Hattersley',   'cynthiahattersley@gmail.com',        'Active Partner')
on conflict (email) do update
  set name   = excluded.name,
      status = excluded.status;

-- ─────────────────────────────────────────────────────────────
-- 2) KITS  (stable UUIDs a0000000-…-0000000000NN; conflict on id)
--    partner_id resolved by email so it survives pre-existing rows.
-- ─────────────────────────────────────────────────────────────
insert into public.kits (id, partner_id, status, ship_date, tracking_number, return_by_date, notes) values
  ('a0000000-0000-4000-8000-000000000001',
   (select id from public.partners where email = 'houseofpossum@gmail.com'),
   'Delivered', '2026-06-08', '1Z11JR320322005022', null,
   'House of Possum (Content Creator). Box BOX-001. UPS 1Z11JR320322005022. Shipped 2026-06-08, delivered 2026-06-10. Box arrived, reel posted; commission link live. Two Putty pieces removed - he did not receive them. Remaining pieces from handwritten slip - confirm.'),

  ('a0000000-0000-4000-8000-000000000002',
   (select id from public.partners where email = 'carol@caroldavidson.com'),
   'Delivered', '2026-06-11', '1Z11JR320318248680', null,
   'Carol Davidson Inc (Stylist). UPS 1Z11JR320318248680. Shipped 2026-06-11, delivered 2026-06-16. Confirmed against typed stock transfer TR-00591. Keeping both jackets (Cropped Asymmetrical - Mint + Triple Collar - Black), maybe the Metallic Mini Seed Stitch sweater; returning the White Jackie O Top + the Mint Big Pocket Pants (arrived dirty). Call Tue Jun 23 11am ET to settle payment + returns + promo.'),

  ('a0000000-0000-4000-8000-000000000003',
   (select id from public.partners where email = 'admin@helloim50ish.com'),
   'Delivered', '2026-06-11', '1Z11JR320336582454', null,
   'Rooms Revamped / Hello I''m 50ish (Content Creator). UPS 1Z11JR320336582454. Shipped 2026-06-11, delivered 2026-06-18. ISSUE: arrived with only 5 of 6 items - the Pima Cotton Tranquility Luxury Boxy Tee was on the stock transfer sheet (TR-00590) but MISSING from the box. Needs apology + the missing tee shipped. Prepaid return label included (RMA #100073). Ships to Park City UT.'),

  ('a0000000-0000-4000-8000-000000000004',
   (select id from public.partners where email = 'jtouchofstyle@gmail.com'),
   'Delivered', '2026-06-17', '1Z11JR320339406648', null,
   'J Touch of Style (Stylist). UPS 1Z11JR320339406648. Shipped 2026-06-17, delivered 2026-06-18 (Sun City AZ). Gave feedback: has worn 3 of the 5 items; asked when to return the box (needs an answer). Dealing with a sick husband, so a little delayed. Pieces from handwritten slip - confirm.'),

  ('a0000000-0000-4000-8000-000000000005',
   (select id from public.partners where email = 'hello@marciacrivorot.com'),
   'Delivered', '2026-06-16', '1Z11JR320305506522', null,
   'Marcia Crivorot (Stylist). UPS 1Z11JR320305506522. Shipped 2026-06-16, delivered Fri 2026-06-19. Confirmed against typed stock transfer TR-00197. Ships to 12 Rose St, White Plains, NY 10605.'),

  ('a0000000-0000-4000-8000-000000000006',
   (select id from public.partners where email = 'jenny.pancoast@gmail.com'),
   'Delivered', '2026-06-15', '1Z11JR320310453641', null,
   'Jenny Pancoast Styling (Stylist). UPS 1Z11JR320310453641. Shipped 2026-06-15, delivered Fri 2026-06-19. Confirmed against typed stock transfer TR-00196. Ships to Greenville SC.'),

  ('a0000000-0000-4000-8000-000000000007',
   (select id from public.partners where email = 'ginger@totalimageconsultants.com'),
   'Delivered', '2026-06-16', '1Z11JR320307656983', null,
   'Total Image Consultants (Stylist). UPS 1Z11JR320307656983. Shipped 2026-06-16, delivered Sat 2026-06-20. Confirmed against typed stock transfer TR-00198. Feedback: LOVES the groovy striped crewneck + the metallic crochet boatneck (both look and feel great); was surprised she did not love a couple of the others. Matches the picks Sofia emailed her.'),

  ('a0000000-0000-4000-8000-000000000008',
   (select id from public.partners where email = 'nellenaj@gmail.com'),
   'Shipped', '2026-06-19', '1Z11JR320338632888', null,
   'Silver is the New Blonde (Content Creator). UPS 1Z11JR320338632888. Shipped 2026-06-19, arriving Tue 2026-06-23. Confirmed against typed stock transfer TR-00201. Ships to 22 Misty Cove II, Hilton Head SC 29928.'),

  ('a0000000-0000-4000-8000-000000000009',
   (select id from public.partners where email = 'cynthia@theunexpectedsomeone.com'),
   'Preparing', null, null, null,
   'The Unexpected Someone (Content Creator). Status "To ship" (mapped to Preparing). GIFTED UGC collab - no return expected. For July 19 black-tie wedding. She sent her McLean VA shipping address - ready to ship now.'),

  ('a0000000-0000-4000-8000-000000000010',
   (select id from public.partners where email = 'cynthiahattersley@gmail.com'),
   'Preparing', null, null, null,
   'Cindy Hattersley Design / Rough Luxe (Content Creator). Status "To ship" (mapped to Preparing). STALLED on a swap: Cindy (via assistant Leslie) asked to swap in the Double Angle V Tee (white) + French Terry Drop Pocket Tee (asphalt). Drop Pocket Tee is in stock but the Double Angle V Tee is OUT OF STOCK. Sofia asked Leslie for an alternative - awaiting their reply before shipping. Pieces from handwritten slip - confirm.')
on conflict (id) do update
  set partner_id      = excluded.partner_id,
      status          = excluded.status,
      ship_date       = excluded.ship_date,
      tracking_number = excluded.tracking_number,
      return_by_date  = excluded.return_by_date,
      notes           = excluded.notes;

-- ─────────────────────────────────────────────────────────────
-- 3) KIT PIECES  (stable UUIDs b0000000-…-00000000KKPP; conflict on id)
--    KK = kit number (01-10), PP = piece number within that kit.
--    piece_name / color split on the first " - " from kits.json.
-- ─────────────────────────────────────────────────────────────
insert into public.kit_pieces (id, kit_id, piece_name, color, partner_decision) values
  -- Kit 01 — Mitchell Christian
  ('b0000000-0000-4000-8000-000000000101', 'a0000000-0000-4000-8000-000000000001', 'Cotton Top (1314CT)',              'Bold Stripe [confirm]',     null),
  ('b0000000-0000-4000-8000-000000000102', 'a0000000-0000-4000-8000-000000000001', 'Nylon Big Pocket Pants (04N)',     'Black [confirm]',           null),
  ('b0000000-0000-4000-8000-000000000103', 'a0000000-0000-4000-8000-000000000001', 'Nylon Top (5327N)',                'Black [confirm]',           null),
  ('b0000000-0000-4000-8000-000000000104', 'a0000000-0000-4000-8000-000000000001', 'Cotton Half Moon Shirt (1317CT)',  'Nautical Stripe [confirm]', null),
  ('b0000000-0000-4000-8000-000000000105', 'a0000000-0000-4000-8000-000000000001', 'Nylon Big Pocket Pants (04N)',     'Marina [confirm]',          null),

  -- Kit 02 — Carol Davidson  (keep/return decisions present in source)
  ('b0000000-0000-4000-8000-000000000201', 'a0000000-0000-4000-8000-000000000002', 'Nylon Big Pocket Pants',               'Mint (RETURNING - arrived dirty)', 'Return'),
  ('b0000000-0000-4000-8000-000000000202', 'a0000000-0000-4000-8000-000000000002', 'Nylon Cropped Asymmetrical Jacket',    'Mint (KEEPING)',                   'Keep'),
  ('b0000000-0000-4000-8000-000000000203', 'a0000000-0000-4000-8000-000000000002', 'Nylon Triple Collar Jacket',           'Black (KEEPING)',                  'Keep'),
  ('b0000000-0000-4000-8000-000000000204', 'a0000000-0000-4000-8000-000000000002', 'Pima Cotton Jackie O Top',             'White (RETURNING)',                'Return'),
  ('b0000000-0000-4000-8000-000000000205', 'a0000000-0000-4000-8000-000000000002', 'Pima Cotton Metallic Mini Seed Stitch','White/Silver (considering)',       null),

  -- Kit 03 — Robin Lamonte  (piece 05 = the missing Tranquility Tee)
  ('b0000000-0000-4000-8000-000000000301', 'a0000000-0000-4000-8000-000000000003', 'Cotton Flood Pants',                       'White',           null),
  ('b0000000-0000-4000-8000-000000000302', 'a0000000-0000-4000-8000-000000000003', 'Cotton Half Moon Shirt',                   'Chambray Stripe', null),
  ('b0000000-0000-4000-8000-000000000303', 'a0000000-0000-4000-8000-000000000003', 'Linen Crop Pant',                          'Fawn',            null),
  ('b0000000-0000-4000-8000-000000000304', 'a0000000-0000-4000-8000-000000000003', 'Linen Triple Collar Jacket',               'Fawn',            null),
  ('b0000000-0000-4000-8000-000000000305', 'a0000000-0000-4000-8000-000000000003', 'Pima Cotton Tranquility Luxury Boxy Tee',  'MISSING (not in box)', null),

  -- Kit 04 — Jodie Filogomo
  ('b0000000-0000-4000-8000-000000000401', 'a0000000-0000-4000-8000-000000000004', 'Style 291B',           'White [confirm]',           null),
  ('b0000000-0000-4000-8000-000000000402', 'a0000000-0000-4000-8000-000000000004', 'Cotton Top (4090CT)',  'Nautical Stripe [confirm]', null),
  ('b0000000-0000-4000-8000-000000000403', 'a0000000-0000-4000-8000-000000000004', 'Cotton Flood Pants (4098CT)', 'Cameo [confirm]',     null),
  ('b0000000-0000-4000-8000-000000000404', 'a0000000-0000-4000-8000-000000000004', 'Knit Sweater (292K)',  'White/Midnight [confirm]',  null),
  ('b0000000-0000-4000-8000-000000000405', 'a0000000-0000-4000-8000-000000000004', 'Tee (035T)',           'White [confirm]',           null),

  -- Kit 05 — Marcia Crivorot
  ('b0000000-0000-4000-8000-000000000501', 'a0000000-0000-4000-8000-000000000005', 'Pima Cotton Cool Hoodie',       'Putty',              null),
  ('b0000000-0000-4000-8000-000000000502', 'a0000000-0000-4000-8000-000000000005', 'Pima Cotton Mini Seed Stitch',  'Peony',              null),
  ('b0000000-0000-4000-8000-000000000503', 'a0000000-0000-4000-8000-000000000005', 'Crushed Nylon Cropped Gaucho',  'Guacamole (size 2)', null),

  -- Kit 06 — Jenny Pancoast
  ('b0000000-0000-4000-8000-000000000601', 'a0000000-0000-4000-8000-000000000006', 'Nylon Chic Bomber',                  'Sky',   null),
  ('b0000000-0000-4000-8000-000000000602', 'a0000000-0000-4000-8000-000000000006', 'Nylon Cropped Sailor Jacket',        'White', null),
  ('b0000000-0000-4000-8000-000000000603', 'a0000000-0000-4000-8000-000000000006', 'Nylon Signature Architectural Skirt','Mint',  null),
  ('b0000000-0000-4000-8000-000000000604', 'a0000000-0000-4000-8000-000000000006', 'Organza Jackie O Top',               'Mint',  null),
  ('b0000000-0000-4000-8000-000000000605', 'a0000000-0000-4000-8000-000000000006', 'Pima Cotton Frayed Tank',            'White', null),

  -- Kit 07 — Ginger Burr
  ('b0000000-0000-4000-8000-000000000701', 'a0000000-0000-4000-8000-000000000007', 'Cotton Metallic Crochet Boatneck Sweater', 'Stone/Gold',      null),
  ('b0000000-0000-4000-8000-000000000702', 'a0000000-0000-4000-8000-000000000007', 'Pima Cotton Groovy Stripe Crewneck Sweater','Lava/Chartreuse', null),
  ('b0000000-0000-4000-8000-000000000703', 'a0000000-0000-4000-8000-000000000007', 'Pima Cotton Jackie O Top',                 'Peacock',         null),
  ('b0000000-0000-4000-8000-000000000704', 'a0000000-0000-4000-8000-000000000007', 'Vegan Leather Bell Bottom Pants',          'Black',           null),
  ('b0000000-0000-4000-8000-000000000705', 'a0000000-0000-4000-8000-000000000007', 'Vegan Leather Mini Cargo Vest',            'Fawn',            null),

  -- Kit 08 — Jan Correll
  ('b0000000-0000-4000-8000-000000000801', 'a0000000-0000-4000-8000-000000000008', 'Cotton Balloon Sleeve Shirt',        'White/Chambray Stripe', null),
  ('b0000000-0000-4000-8000-000000000802', 'a0000000-0000-4000-8000-000000000008', 'Cotton Flood Pants',                 'Chambray Stripe',       null),
  ('b0000000-0000-4000-8000-000000000803', 'a0000000-0000-4000-8000-000000000008', 'Pima Cotton Hamptons Crewneck Sweater','Black',               null),
  ('b0000000-0000-4000-8000-000000000804', 'a0000000-0000-4000-8000-000000000008', 'Pima Cotton Jackie O Top',           'Chili',                 null),

  -- Kit 09 — Cynthia Sitcov  (gifted set)
  ('b0000000-0000-4000-8000-000000000901', 'a0000000-0000-4000-8000-000000000009', 'Nylon Triple Collar Jacket', 'Vapor', null),
  ('b0000000-0000-4000-8000-000000000902', 'a0000000-0000-4000-8000-000000000009', 'Nylon Big Pocket Pants',     'Vapor', null),

  -- Kit 10 — Cindy Hattersley
  ('b0000000-0000-4000-8000-000000001001', 'a0000000-0000-4000-8000-000000000010', 'Cotton Flood Pants (4098)',  'White [confirm]',    null),
  ('b0000000-0000-4000-8000-000000001002', 'a0000000-0000-4000-8000-000000000010', 'Pima Cotton Jackie O Top (1026)', 'White [confirm]', null),
  ('b0000000-0000-4000-8000-000000001003', 'a0000000-0000-4000-8000-000000000010', 'Linen Crop Pant (505LIN)',   'Black [confirm]',    null),
  ('b0000000-0000-4000-8000-000000001004', 'a0000000-0000-4000-8000-000000000010', 'Knit Sweater (290K)',        'Capri [confirm]',    null),
  ('b0000000-0000-4000-8000-000000001005', 'a0000000-0000-4000-8000-000000000010', 'Luxury Boxy Tee (9791)',     'Lipstick [confirm]', null)
on conflict (id) do update
  set kit_id           = excluded.kit_id,
      piece_name       = excluded.piece_name,
      color            = excluded.color,
      partner_decision = excluded.partner_decision;

commit;

-- ─────────────────────────────────────────────────────────────
-- OPTIONAL: remove the local test seed row ("Ava Monroe") if present.
-- It uses a different email so it does NOT conflict with anything above;
-- it is left untouched by default. Uncomment to delete it (kit + pieces
-- cascade automatically via the FK on delete cascade).
-- ─────────────────────────────────────────────────────────────
-- delete from public.partners where email = 'partner@example.com';

-- ─────────────────────────────────────────────────────────────
-- VERIFY (optional): run after to eyeball the result.
-- ─────────────────────────────────────────────────────────────
-- select p.name, k.status, k.ship_date, k.tracking_number,
--        count(kp.id) as pieces
-- from public.partners p
-- left join public.kits k on k.partner_id = p.id
-- left join public.kit_pieces kp on kp.kit_id = k.id
-- group by p.name, k.status, k.ship_date, k.tracking_number
-- order by p.name;
