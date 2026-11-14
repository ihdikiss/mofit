import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ADMIN_DEMO_EMAIL,
  ADMIN_DEMO_PASSWORD,
  authenticateAdmin,
  buildFollowUpWhatsAppUrl,
  computeOrderAnalytics,
  createAndSaveOrder,
  filterOrders,
  loadOrders,
  updateOrderStatus,
} from './orderStore';

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
    {fullName: 'سلمى بنعلي', phone: '0652841037', city: 'الداخلة', quantity: 1},
    storage,
    new Date('2026-11-14T10:00:00.000Z'),
  );
  updateOrderStatus(o2.id, 'confirmed', storage);

  const all = loadOrders(storage);
  assert.equal(filterOrders(all, 'confirmed', '').length, 1);
  assert.equal(filterOrders(all, 'pending', '').length, 1);
  assert.equal(filterOrders(all, 'all', '065284').length, 1);
  assert.equal(filterOrders(all, 'all', 'تطوان').length, 1);
  assert.ok(buildFollowUpWhatsAppUrl(o1).startsWith('https://wa.me/212764219385?text='));
});

test('authenticateAdmin validates default demo email and password', () => {
  assert.equal(authenticateAdmin(ADMIN_DEMO_EMAIL, ADMIN_DEMO_PASSWORD), true);
  assert.equal(authenticateAdmin('wrong@dakhlafit.ma', ADMIN_DEMO_PASSWORD), false);
  assert.equal(authenticateAdmin(ADMIN_DEMO_EMAIL, 'wrong'), false);
});
