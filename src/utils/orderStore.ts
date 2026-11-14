import {
  OrderFormInput,
  PACK_TITLE,
  SITE_BASE_URL,
  buildWhatsAppOrderPayload,
} from './landingSections';

/**
 * Default Admin Credentials (Customize before production deployment):
 * Email: admin@dakhlafit.ma
 * Password: DakhlaFit@2026
 */
export const ADMIN_DEMO_EMAIL = 'admin@dakhlafit.ma';
export const ADMIN_DEMO_PASSWORD = 'DakhlaFit@2026';

export const ORDERS_STORAGE_KEY = 'orders';
export const LEGACY_ORDERS_STORAGE_KEY = 'dakhla_fit_orders_v1';
export const ADMIN_SESSION_STORAGE_KEY = 'dakhla_fit_admin_session_v1';

export type OrderStatus = 'pending' | 'confirmed' | 'canceled';

export interface OrderRecord {
  id: string;
  fullName: string;
  phone: string;
  city: string;
  packName: string;
  quantity: number;
  totalPrice: number;
  status: OrderStatus;
  createdAt: string;
  whatsappUrl: string;
  sourceUrl?: string;
}

export interface OrderAnalytics {
  totalLeads: number;
  pendingCount: number;
  confirmedCount: number;
  canceledCount: number;
  unconfirmedOrCanceledCount: number;
  confirmedRevenue: number;
  confirmationRate: number;
}

export interface StorageAdapter {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem?: (key: string) => void;
}

function getBrowserStorage(): StorageAdapter | null {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return null;
}

function generateOrderId(nowMs: number): string {
  const suffix = String(nowMs).slice(-4);
  const rand = Math.floor(10 + Math.random() * 90);
  return `DF-${suffix}${rand}`;
}

export function loadOrders(
  storage: StorageAdapter | null = getBrowserStorage(),
): OrderRecord[] {
  if (!storage) return [];
  try {
    const raw =
      storage.getItem(ORDERS_STORAGE_KEY) ||
      storage.getItem(LEGACY_ORDERS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return (parsed as OrderRecord[]).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  } catch {
    return [];
  }
}

export const ORDERS_SYNC_CHANNEL = 'dakhla_fit_orders_sync';

export function saveOrders(
  orders: OrderRecord[],
  storage: StorageAdapter | null = getBrowserStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders));
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const channel = new window.BroadcastChannel(ORDERS_SYNC_CHANNEL);
      channel.postMessage({type: 'orders_updated'});
      channel.close();
    }
  } catch {
    // Ignore storage quota errors cleanly
  }
}

export function createAndSaveOrder(
  input: OrderFormInput,
  storage: StorageAdapter | null = getBrowserStorage(),
  nowDate: Date = new Date(),
): OrderRecord {
  const payload = buildWhatsAppOrderPayload(input);
  const qty = Math.min(10, Math.max(1, Math.floor(input.quantity || 1)));
  const record: OrderRecord = {
    id: generateOrderId(nowDate.getTime()),
    fullName: input.fullName.trim(),
    phone: payload.normalizedPhone,
    city: input.city.trim(),
    packName: PACK_TITLE,
    quantity: qty,
    totalPrice: payload.totalPrice,
    status: 'pending',
    createdAt: nowDate.toISOString(),
    whatsappUrl: payload.url,
    sourceUrl: SITE_BASE_URL,
  };

  const existing = loadOrders(storage);
  saveOrders([record, ...existing], storage);
  return record;
}

export function updateOrderStatus(
  orderId: string,
  nextStatus: OrderStatus,
  storage: StorageAdapter | null = getBrowserStorage(),
): OrderRecord[] {
  const existing = loadOrders(storage);
  const updated = existing.map((order) =>
    order.id === orderId ? {...order, status: nextStatus} : order,
  );
  saveOrders(updated, storage);
  return updated;
}

export function computeOrderAnalytics(orders: OrderRecord[]): OrderAnalytics {
  const totalLeads = orders.length;
  let pendingCount = 0;
  let confirmedCount = 0;
  let canceledCount = 0;
  let confirmedRevenue = 0;

  for (const order of orders) {
    if (order.status === 'confirmed') {
      confirmedCount += 1;
      confirmedRevenue += order.totalPrice;
    } else if (order.status === 'canceled') {
      canceledCount += 1;
    } else {
      pendingCount += 1;
    }
  }

  const unconfirmedOrCanceledCount = pendingCount + canceledCount;
  const confirmationRate =
    totalLeads > 0 ? Math.round((confirmedCount / totalLeads) * 100) : 0;

  return {
    totalLeads,
    pendingCount,
    confirmedCount,
    canceledCount,
    unconfirmedOrCanceledCount,
    confirmedRevenue,
    confirmationRate,
  };
}

export function filterOrders(
  orders: OrderRecord[],
  statusFilter: 'all' | OrderStatus,
  searchQuery: string,
): OrderRecord[] {
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const digitsQuery = searchQuery.replace(/[^\d]/g, '');
  const localDigitsQuery = digitsQuery.startsWith('0')
    ? digitsQuery.slice(1)
    : digitsQuery;

  return orders.filter((order) => {
    if (statusFilter !== 'all' && order.status !== statusFilter) {
      return false;
    }
    if (!normalizedQuery) return true;

    const cityMatch = order.city.toLowerCase().includes(normalizedQuery);
    const nameMatch = order.fullName.toLowerCase().includes(normalizedQuery);
    const idMatch = order.id.toLowerCase().includes(normalizedQuery);
    const orderDigits = order.phone.replace(/[^\d]/g, '');
    const phoneMatch =
      order.phone.toLowerCase().includes(normalizedQuery) ||
      (digitsQuery.length > 0 && orderDigits.includes(digitsQuery)) ||
      (localDigitsQuery.length > 0 && orderDigits.includes(localDigitsQuery));

    return cityMatch || nameMatch || idMatch || phoneMatch;
  });
}

export function authenticateAdmin(email: string, password: string): boolean {
  return (
    email.trim().toLowerCase() === ADMIN_DEMO_EMAIL.toLowerCase() &&
    password === ADMIN_DEMO_PASSWORD
  );
}

export function getAdminSession(
  storage: StorageAdapter | null = getBrowserStorage(),
): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(ADMIN_SESSION_STORAGE_KEY) === 'authenticated';
  } catch {
    return false;
  }
}

export function setAdminSession(
  isAuthenticated: boolean,
  storage: StorageAdapter | null = getBrowserStorage(),
): void {
  if (!storage) return;
  try {
    if (isAuthenticated) {
      storage.setItem(ADMIN_SESSION_STORAGE_KEY, 'authenticated');
    } else if (storage.removeItem) {
      storage.removeItem(ADMIN_SESSION_STORAGE_KEY);
    } else {
      storage.setItem(ADMIN_SESSION_STORAGE_KEY, '');
    }
  } catch {
    // Ignore storage errors
  }
}

export function buildFollowUpWhatsAppUrl(order: OrderRecord): string {
  const phoneDigits = order.phone.replace(/[^\d]/g, '');
  const message = `مرحباً ${order.fullName}، نتواصل معك من فريق DAKHLA FIT بخصوص طلبك (${order.id}) لباقة اللياقة إلى مدينة ${order.city}.`;
  return `https://wa.me/${phoneDigits}?text=${encodeURIComponent(message)}`;
}
