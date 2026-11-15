import {SupabaseClient} from '@supabase/supabase-js';
import {
  OrderFormInput,
  PACK_TITLE,
  SITE_BASE_URL,
  buildWhatsAppOrderPayload,
} from './landingSections';
import {getSupabaseClient} from './supabaseClient';

/**
 * Default Admin Credentials (Customize before production deployment):
 * Email: admin@dakhlafit.ma
 * Password: DakhlaFit@2026
 */
export const ADMIN_DEMO_EMAIL = 'admin@dakhlafit.ma';
export const ADMIN_DEMO_PASSWORD = 'DakhlaFit@2026';

export const ORDERS_STORAGE_KEY = 'orders';
export const LEGACY_ORDERS_STORAGE_KEY = 'dakhla_fit_orders_v1';
export const PENDING_SYNC_IDS_STORAGE_KEY = 'dakhla_fit_pending_sync_ids_v1';
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

export interface SupabaseOrderRow {
  id: string;
  full_name: string;
  phone: string;
  city: string;
  pack_name: string;
  quantity: number;
  total_price: number;
  status: OrderStatus;
  whatsapp_url: string;
  source_url: string | null;
  created_at: string;
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

export interface RemoteDbError {
  code?: string;
  message: string;
}

export interface OrdersRemoteAdapter {
  insertOrder: (row: SupabaseOrderRow) => Promise<{error: RemoteDbError | null}>;
  upsertOrder: (row: SupabaseOrderRow) => Promise<{error: RemoteDbError | null}>;
  selectOrders: () => Promise<{
    data: SupabaseOrderRow[] | null;
    error: RemoteDbError | null;
  }>;
}

export interface SubmitOrderResult {
  order: OrderRecord;
  syncedToSupabase: boolean;
  schemaMissing: boolean;
  errorMessage?: string;
}

export interface FetchOrdersResult {
  orders: OrderRecord[];
  source: 'supabase' | 'local';
  schemaMissing: boolean;
  errorMessage?: string;
}

export interface UpdateOrderStatusResult {
  orders: OrderRecord[];
  syncedToSupabase: boolean;
  schemaMissing: boolean;
  errorMessage?: string;
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

export function isSupabaseSchemaMissingError(
  error: RemoteDbError | null | undefined,
): boolean {
  if (!error) return false;
  return (
    error.code === 'PGRST205' ||
    error.code === '42P01' ||
    /could not find the table/i.test(error.message) ||
    /relation .*orders.* does not exist/i.test(error.message)
  );
}

export function toSupabaseOrderRow(order: OrderRecord): SupabaseOrderRow {
  return {
    id: order.id,
    full_name: order.fullName,
    phone: order.phone,
    city: order.city,
    pack_name: order.packName,
    quantity: order.quantity,
    total_price: order.totalPrice,
    status: order.status,
    whatsapp_url: order.whatsappUrl,
    source_url: order.sourceUrl ?? null,
    created_at: order.createdAt,
  };
}

export function fromSupabaseOrderRow(row: SupabaseOrderRow): OrderRecord {
  const safeStatus: OrderStatus =
    row.status === 'confirmed' || row.status === 'canceled'
      ? row.status
      : 'pending';
  return {
    id: row.id,
    fullName: row.full_name,
    phone: row.phone,
    city: row.city,
    packName: row.pack_name || PACK_TITLE,
    quantity: Number(row.quantity) || 1,
    totalPrice: Number(row.total_price) || 0,
    status: safeStatus,
    createdAt: row.created_at,
    whatsappUrl: row.whatsapp_url || '',
    sourceUrl: row.source_url ?? SITE_BASE_URL,
  };
}

export function createSupabaseOrdersAdapter(
  client: SupabaseClient | null = getSupabaseClient(),
): OrdersRemoteAdapter | null {
  if (!client) return null;
  return {
    insertOrder: async (row) => {
      const {error} = await client.from('orders').insert(row);
      return {
        error: error ? {code: error.code, message: error.message} : null,
      };
    },
    upsertOrder: async (row) => {
      const {error} = await client
        .from('orders')
        .upsert(row, {onConflict: 'id'});
      return {
        error: error ? {code: error.code, message: error.message} : null,
      };
    },
    selectOrders: async () => {
      const {data, error} = await client
        .from('orders')
        .select('*')
        .order('created_at', {ascending: false});
      return {
        data: (data as SupabaseOrderRow[] | null) ?? null,
        error: error ? {code: error.code, message: error.message} : null,
      };
    },
  };
}

function loadPendingSyncIds(storage: StorageAdapter | null): string[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(PENDING_SYNC_IDS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

function savePendingSyncIds(
  ids: string[],
  storage: StorageAdapter | null,
): void {
  if (!storage) return;
  try {
    if (ids.length === 0) {
      if (storage.removeItem) {
        storage.removeItem(PENDING_SYNC_IDS_STORAGE_KEY);
      } else {
        storage.setItem(PENDING_SYNC_IDS_STORAGE_KEY, '[]');
      }
      return;
    }
    storage.setItem(
      PENDING_SYNC_IDS_STORAGE_KEY,
      JSON.stringify(Array.from(new Set(ids))),
    );
  } catch {
    // Ignore storage errors cleanly
  }
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

export async function submitOrderToStore(
  input: OrderFormInput,
  storage: StorageAdapter | null = getBrowserStorage(),
  nowDate: Date = new Date(),
  remote: OrdersRemoteAdapter | null = createSupabaseOrdersAdapter(),
): Promise<SubmitOrderResult> {
  const record = createAndSaveOrder(input, storage, nowDate);
  if (!remote) {
    return {
      order: record,
      syncedToSupabase: false,
      schemaMissing: false,
    };
  }

  try {
    const {error} = await remote.insertOrder(toSupabaseOrderRow(record));
    if (!error) {
      return {
        order: record,
        syncedToSupabase: true,
        schemaMissing: false,
      };
    }

    const pendingIds = loadPendingSyncIds(storage);
    savePendingSyncIds([...pendingIds, record.id], storage);
    return {
      order: record,
      syncedToSupabase: false,
      schemaMissing: isSupabaseSchemaMissingError(error),
      errorMessage: error.message,
    };
  } catch (err) {
    const pendingIds = loadPendingSyncIds(storage);
    savePendingSyncIds([...pendingIds, record.id], storage);
    return {
      order: record,
      syncedToSupabase: false,
      schemaMissing: false,
      errorMessage: err instanceof Error ? err.message : 'Network error',
    };
  }
}

export async function fetchOrdersFromStore(
  storage: StorageAdapter | null = getBrowserStorage(),
  remote: OrdersRemoteAdapter | null = createSupabaseOrdersAdapter(),
): Promise<FetchOrdersResult> {
  const localOrders = loadOrders(storage);
  if (!remote) {
    return {
      orders: localOrders,
      source: 'local',
      schemaMissing: false,
    };
  }

  try {
    const pendingIds = loadPendingSyncIds(storage);
    if (pendingIds.length > 0) {
      const remainingPending: string[] = [];
      for (const pendingId of pendingIds) {
        const localRecord = localOrders.find((item) => item.id === pendingId);
        if (!localRecord) continue;
        const {error: flushError} = await remote.upsertOrder(
          toSupabaseOrderRow(localRecord),
        );
        if (flushError) {
          remainingPending.push(pendingId);
        }
      }
      savePendingSyncIds(remainingPending, storage);
    }

    const {data, error} = await remote.selectOrders();
    if (error || !data) {
      return {
        orders: localOrders,
        source: 'local',
        schemaMissing: isSupabaseSchemaMissingError(error),
        errorMessage: error?.message,
      };
    }

    const remoteOrders = data
      .map(fromSupabaseOrderRow)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    saveOrders(remoteOrders, storage);
    return {
      orders: remoteOrders,
      source: 'supabase',
      schemaMissing: false,
    };
  } catch (err) {
    return {
      orders: localOrders,
      source: 'local',
      schemaMissing: false,
      errorMessage: err instanceof Error ? err.message : 'Network error',
    };
  }
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

export async function updateOrderStatusInStore(
  orderId: string,
  nextStatus: OrderStatus,
  storage: StorageAdapter | null = getBrowserStorage(),
  remote: OrdersRemoteAdapter | null = createSupabaseOrdersAdapter(),
): Promise<UpdateOrderStatusResult> {
  const updated = updateOrderStatus(orderId, nextStatus, storage);
  const target = updated.find((order) => order.id === orderId);

  if (!remote || !target) {
    return {
      orders: updated,
      syncedToSupabase: false,
      schemaMissing: false,
    };
  }

  try {
    const {error} = await remote.upsertOrder(toSupabaseOrderRow(target));
    if (!error) {
      return {
        orders: updated,
        syncedToSupabase: true,
        schemaMissing: false,
      };
    }

    const pendingIds = loadPendingSyncIds(storage);
    savePendingSyncIds([...pendingIds, orderId], storage);
    return {
      orders: updated,
      syncedToSupabase: false,
      schemaMissing: isSupabaseSchemaMissingError(error),
      errorMessage: error.message,
    };
  } catch (err) {
    const pendingIds = loadPendingSyncIds(storage);
    savePendingSyncIds([...pendingIds, orderId], storage);
    return {
      orders: updated,
      syncedToSupabase: false,
      schemaMissing: false,
      errorMessage: err instanceof Error ? err.message : 'Network error',
    };
  }
}

export function subscribeToSupabaseOrders(
  onOrdersChanged: () => void,
  client: SupabaseClient | null = getSupabaseClient(),
): () => void {
  if (!client) return () => {};
  const channel = client
    .channel('orders-realtime-sync')
    .on(
      'postgres_changes',
      {event: '*', schema: 'public', table: 'orders'},
      () => {
        onOrdersChanged();
      },
    )
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
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
