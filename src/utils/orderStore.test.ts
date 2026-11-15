import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ADMIN_DEMO_EMAIL,
  ADMIN_DEMO_PASSWORD,
  OrdersRemoteAdapter,
  SupabaseOrderRow,
  authenticateAdmin,
  buildFollowUpWhatsAppUrl,
  computeOrderAnalytics,
  createAndSaveOrder,
  fetchOrdersFromStore,
  filterOrders,
  fromSupabaseOrderRow,
  loadOrders,
  submitOrderToStore,
  toSupabaseOrderRow,
  updateOrderStatus,
  updateOrderStatusInStore,
} from './orderStore';
import {normalizeSupabaseUrl} from './supabaseClient';

function createMemoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
  };
}

function createFakeSupabaseAdapter(initialTableReady = true): {
  adapter: OrdersRemoteAdapter;
  setTableReady: (ready: boolean) => void;
  rows: Map<string, SupabaseOrderRow>;
} {
  let tableReady = initialTableReady;
  const rows = new Map<string, SupabaseOrderRow>();
  const missingTableError = {
    code: 'PGRST205',
    message: "Could not find the table 'public.orders' in the schema cache",
  };

  return {
    setTableReady: (ready) => {
      tableReady = ready;
    },
    rows,
    adapter: {
      insertOrder: async (row) => {
        if (!tableReady) return {error: missingTableError};
        rows.set(row.id, row);
        return {error: null};
      },
      upsertOrder: async (row) => {
        if (!tableReady) return {error: missingTableError};
        rows.set(row.id, row);
        return {error: null};
      },
      selectOrders: async () => {
        if (!tableReady) return {data: null, error: missingTableError};
        return {
          data: Array.from(rows.values()),
          error: null,
        };
      },
    },
  };
}

test('createAndSaveOrder stores pending record sorted newest first and updateOrderStatus updates analytics', () => {
  const storage = createMemoryStorage();

  const first = createAndSaveOrder(
    {fullName: 'سلمى بنعلي', phone: '0652841037', city: 'مراكش', quantity: 1},
    storage,
    new Date('2026-11-14T10:00:00.000Z'),
  );
  const second = createAndSaveOrder(
    {fullName: 'يوسف العلوي', phone: '612345678', city: 'الرباط', quantity: 2},
    storage,
    new Date('2026-11-14T11:00:00.000Z'),
  );

  const loaded = loadOrders(storage);
  assert.equal(loaded.length, 2);
  assert.equal(loaded[0].id, second.id);
  assert.equal(loaded[0].status, 'pending');
  assert.equal(loaded[1].id, first.id);

  updateOrderStatus(second.id, 'confirmed', storage);
  updateOrderStatus(first.id, 'canceled', storage);

  const updated = loadOrders(storage);
  const analytics = computeOrderAnalytics(updated);
  assert.equal(analytics.totalLeads, 2);
  assert.equal(analytics.confirmedCount, 1);
  assert.equal(analytics.canceledCount, 1);
  assert.equal(analytics.confirmedRevenue, 878);
  assert.equal(analytics.confirmationRate, 50);
});

test('filterOrders supports status tabs and phone/city search', () => {
  const storage = createMemoryStorage();
  const o1 = createAndSaveOrder(
    {fullName: 'أيوب العمراني', phone: '0764219385', city: 'تطوان', quantity: 1},
    storage,
    new Date('2026-11-14T09:00:00.000Z'),
  );
  const o2 = createAndSaveOrder(
    {fullName: 'سلمى بنعلي', phone: '0652841037', city: 'الداخلة', address: 'حي الوحدة رقم 20', quantity: 1},
    storage,
    new Date('2026-11-14T10:00:00.000Z'),
  );
  updateOrderStatus(o2.id, 'confirmed', storage);

  const all = loadOrders(storage);
  assert.equal(filterOrders(all, 'confirmed', '').length, 1);
  assert.equal(filterOrders(all, 'pending', '').length, 1);
  assert.equal(filterOrders(all, 'all', '065284').length, 1);
  assert.equal(filterOrders(all, 'all', 'تطوان').length, 1);
  assert.equal(filterOrders(all, 'all', 'الوحدة').length, 1);
  assert.ok(buildFollowUpWhatsAppUrl(o1).startsWith('https://wa.me/212764219385?text='));
});

test('authenticateAdmin validates default demo email and password', () => {
  assert.equal(authenticateAdmin(ADMIN_DEMO_EMAIL, ADMIN_DEMO_PASSWORD), true);
  assert.equal(authenticateAdmin('wrong@dakhlafit.ma', ADMIN_DEMO_PASSWORD), false);
  assert.equal(authenticateAdmin(ADMIN_DEMO_EMAIL, 'wrong'), false);
});

test('normalizeSupabaseUrl strips /rest/v1 suffix and row mappers round-trip accurately', () => {
  assert.equal(
    normalizeSupabaseUrl('https://raaompkdkyghhyuxfnen.supabase.co/rest/v1/'),
    'https://raaompkdkyghhyuxfnen.supabase.co',
  );
  assert.equal(
    normalizeSupabaseUrl('https://raaompkdkyghhyuxfnen.supabase.co'),
    'https://raaompkdkyghhyuxfnen.supabase.co',
  );

  const storage = createMemoryStorage();
  const sample = createAndSaveOrder(
    {fullName: 'كريم المرابط', phone: '612345678', city: 'الداخلة', address: 'حي المسيرة زنقة 4', quantity: 2},
    storage,
    new Date('2026-11-15T12:00:00.000Z'),
  );
  const row = toSupabaseOrderRow(sample);
  const restored = fromSupabaseOrderRow(row);
  assert.deepEqual(restored, sample);

  // Fallback extraction from whatsapp_url when remote row lacks address column
  const restoredFromWhatsappOnly = fromSupabaseOrderRow({
    ...row,
    address: null,
  });
  assert.equal(restoredFromWhatsappOnly.address, 'حي المسيرة زنقة 4');
});

test('submitOrderToStore, fetchOrdersFromStore, and updateOrderStatusInStore sync cleanly with Supabase and recover pending local orders', async () => {
  const storage = createMemoryStorage();
  const fake = createFakeSupabaseAdapter(false);

  // 1. Submit while schema is missing: saves locally, flags schemaMissing
  const offlineSubmit = await submitOrderToStore(
    {fullName: 'سعيد بوزيد', phone: '0611223344', city: 'أكادير', quantity: 1},
    storage,
    new Date('2026-11-15T10:00:00.000Z'),
    fake.adapter,
  );
  assert.equal(offlineSubmit.syncedToSupabase, false);
  assert.equal(offlineSubmit.schemaMissing, true);

  const preSchemaFetch = await fetchOrdersFromStore(storage, fake.adapter);
  assert.equal(preSchemaFetch.source, 'local');
  assert.equal(preSchemaFetch.schemaMissing, true);
  assert.equal(preSchemaFetch.orders.length, 1);

  // 2. Now table is created: fetch flushes pending order automatically & pulls from Supabase
  fake.setTableReady(true);
  const postSchemaFetch = await fetchOrdersFromStore(storage, fake.adapter);
  assert.equal(postSchemaFetch.source, 'supabase');
  assert.equal(postSchemaFetch.schemaMissing, false);
  assert.equal(postSchemaFetch.orders.length, 1);
  assert.equal(fake.rows.size, 1);

  // 3. Submit another order directly to Supabase and update status
  const onlineSubmit = await submitOrderToStore(
    {fullName: 'ندى التازي', phone: '0699887766', city: 'فاس', quantity: 2},
    storage,
    new Date('2026-11-15T11:00:00.000Z'),
    fake.adapter,
  );
  assert.equal(onlineSubmit.syncedToSupabase, true);
  assert.equal(fake.rows.size, 2);

  const statusUpdate = await updateOrderStatusInStore(
    onlineSubmit.order.id,
    'confirmed',
    storage,
    fake.adapter,
  );
  assert.equal(statusUpdate.syncedToSupabase, true);
  assert.equal(fake.rows.get(onlineSubmit.order.id)?.status, 'confirmed');
});
