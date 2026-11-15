import React, {useEffect, useMemo, useRef, useState} from 'react';
import Chart from 'chart.js/auto';
import {
  CheckCircle2,
  Clock,
  Lock,
  LogOut,
  MessageCircle,
  Phone,
  RefreshCw,
  Search,
  Store,
  XCircle,
} from 'lucide-react';
import {
  ORDERS_SYNC_CHANNEL,
  OrderRecord,
  OrderStatus,
  authenticateAdmin,
  buildFollowUpWhatsAppUrl,
  computeOrderAnalytics,
  fetchOrdersFromStore,
  filterOrders,
  getAdminSession,
  loadOrders,
  setAdminSession,
  subscribeToSupabaseOrders,
  updateOrderStatusInStore,
} from '../utils/orderStore';

interface AdminDashboardProps {
  onExitAdmin: () => void;
}

function formatArabicDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function getStatusMeta(status: OrderStatus): {
  label: string;
  textClass: string;
  borderClass: string;
  bgClass: string;
} {
  if (status === 'confirmed') {
    return {
      label: 'تم التفعيل بعد الاتصال',
      textClass: 'text-[#00FF66]',
      borderClass: 'border-[#00FF66]/45',
      bgClass: 'bg-[#00FF66]/12',
    };
  }
  if (status === 'canceled') {
    return {
      label: 'ملغى / لم يرد',
      textClass: 'text-[#FF4444]',
      borderClass: 'border-[#FF4444]/45',
      bgClass: 'bg-[#FF4444]/12',
    };
  }
  return {
    label: 'قيد الانتظار',
    textClass: 'text-amber-300',
    borderClass: 'border-amber-400/35',
    bgClass: 'bg-amber-400/10',
  };
}

export function AdminDashboard({onExitAdmin}: AdminDashboardProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() =>
    getAdminSession(),
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [schemaSetupRequired, setSchemaSetupRequired] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const chartCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstanceRef = useRef<Chart | null>(null);

  const refreshOrders = async (showSpinner = false) => {
    if (showSpinner) setIsLoadingOrders(true);
    try {
      const result = await fetchOrdersFromStore();
      setOrders(result.orders);
      setSchemaSetupRequired(result.schemaMissing);
    } finally {
      if (showSpinner) setIsLoadingOrders(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      setOrders([]);
      setSchemaSetupRequired(false);
      return;
    }

    setOrders(loadOrders());
    void refreshOrders(true);

    const handleStorageSync = () => {
      setOrders(loadOrders());
    };
    window.addEventListener('storage', handleStorageSync);

    let channel: BroadcastChannel | null = null;
    if ('BroadcastChannel' in window) {
      channel = new window.BroadcastChannel(ORDERS_SYNC_CHANNEL);
      channel.onmessage = () => {
        setOrders(loadOrders());
      };
    }

    const unsubscribeRealtime = subscribeToSupabaseOrders(() => {
      void refreshOrders(false);
    });

    return () => {
      window.removeEventListener('storage', handleStorageSync);
      channel?.close();
      unsubscribeRealtime();
    };
  }, [isAuthenticated]);

  const analytics = useMemo(() => computeOrderAnalytics(orders), [orders]);

  const filteredOrders = useMemo(
    () => filterOrders(orders, statusFilter, searchQuery),
    [orders, statusFilter, searchQuery],
  );

  useEffect(() => {
    if (!isAuthenticated || !chartCanvasRef.current) return;

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
      chartInstanceRef.current = null;
    }

    const confirmed = analytics.confirmedCount;
    const unconfirmedOrCanceled = analytics.unconfirmedOrCanceledCount;
    const hasData = confirmed + unconfirmedOrCanceled > 0;

    chartInstanceRef.current = new Chart(chartCanvasRef.current, {
      type: 'doughnut',
      data: {
        labels: hasData
          ? ['المشترين الفعليين', 'غير مفعل / ملغى']
          : ['لا توجد طلبات'],
        datasets: [
          {
            data: hasData ? [confirmed, unconfirmedOrCanceled] : [1],
            backgroundColor: hasData ? ['#00FF66', '#FF4444'] : ['#27272a'],
            borderColor: '#111113',
            borderWidth: 3,
            hoverOffset: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            enabled: hasData,
            backgroundColor: '#18181b',
            titleColor: '#ffffff',
            bodyColor: '#ffffff',
            borderColor: 'rgba(255,255,255,0.16)',
            borderWidth: 1,
          },
        },
      },
    });

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [
    isAuthenticated,
    analytics.confirmedCount,
    analytics.unconfirmedOrCanceledCount,
  ]);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (authenticateAdmin(email, password)) {
      setAdminSession(true);
      setIsAuthenticated(true);
      setAuthError('');
      setPassword('');
    } else {
      setAuthError('البريد الإلكتروني أو كلمة المرور غير صحيحة.');
    }
  };

  const handleLogout = () => {
    setAdminSession(false);
    setIsAuthenticated(false);
    setEmail('');
    setPassword('');
    setAuthError('');
  };

  const handleStatusChange = async (
    orderId: string,
    nextStatus: OrderStatus,
  ) => {
    setOrders((prev) =>
      prev.map((order) =>
        order.id === orderId ? {...order, status: nextStatus} : order,
      ),
    );
    const result = await updateOrderStatusInStore(orderId, nextStatus);
    setOrders(result.orders);
    if (result.schemaMissing) {
      setSchemaSetupRequired(true);
    }
  };

  if (!isAuthenticated) {
    return (
      <div
        dir="rtl"
        className="min-h-screen w-full bg-[#0a0a0a] text-white flex flex-col justify-center items-center px-4 py-10"
      >
        <div className="w-full max-w-md rounded-2xl bg-[#111113] border border-white/12 p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="space-y-2 text-center">
            <div className="w-12 h-12 rounded-xl bg-[#00FF66]/15 border border-[#00FF66]/40 text-[#00FF66] flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-extrabold text-white tracking-tight">
              DAKHLA FIT — بوابة الإدارة
            </h1>
            <p className="text-sm text-white/65">
              سجل الدخول لإدارة طلبات الزبناء وتأكيد المكالمات
            </p>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-4" noValidate>
            <div>
              <label
                htmlFor="admin-email"
                className="block text-sm font-bold mb-1.5 text-white"
              >
                البريد الإلكتروني
              </label>
              <input
                id="admin-email"
                type="email"
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@dakhlafit.ma"
                required
                className="w-full min-h-[48px] rounded-xl border border-white/15 bg-[#0a0a0a] px-3.5 text-base text-white placeholder:text-white/35 focus:outline-none focus:border-[#00FF66]"
              />
            </div>

            <div>
              <label
                htmlFor="admin-password"
                className="block text-sm font-bold mb-1.5 text-white"
              >
                كلمة المرور
              </label>
              <input
                id="admin-password"
                type="password"
                dir="ltr"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                className="w-full min-h-[48px] rounded-xl border border-white/15 bg-[#0a0a0a] px-3.5 text-base text-white placeholder:text-white/35 focus:outline-none focus:border-[#00FF66]"
              />
            </div>

            {authError && (
              <p
                role="alert"
                className="rounded-xl bg-[#FF4444]/12 border border-[#FF4444]/40 px-3.5 py-2.5 text-xs font-bold text-[#FF4444]"
              >
                {authError}
              </p>
            )}

            <button
              type="submit"
              className="w-full min-h-[50px] rounded-xl bg-[#00FF66] hover:bg-[#1aff75] text-[#0a0a0a] font-extrabold text-base cursor-pointer transition-colors"
            >
              تسجيل الدخول إلى لوحة الإدارة
            </button>
          </form>

          <button
            type="button"
            onClick={onExitAdmin}
            className="w-full min-h-[44px] rounded-xl border border-white/15 text-white/80 hover:bg-white/8 text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <Store className="w-4 h-4" />
            <span>العودة إلى المتجر</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen w-full bg-[#0a0a0a] text-white">
      <header className="border-b border-white/10 bg-[#0a0a0a]/95 sticky top-0 z-30 backdrop-blur-sm">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-base sm:text-lg font-extrabold text-[#00FF66] whitespace-nowrap shrink-0">
              DAKHLA FIT
            </span>
            <span className="text-white/30" aria-hidden="true">
              /
            </span>
            <h1 className="text-sm sm:text-base font-bold text-white whitespace-nowrap">
              <span className="sm:hidden">الإدارة</span>
              <span className="hidden sm:inline">لوحة إدارة الطلبات</span>
            </h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onExitAdmin}
              className="min-h-[40px] px-3 sm:px-4 py-2 rounded-lg border border-white/15 text-xs sm:text-sm font-semibold text-white hover:bg-white/10 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
            >
              <Store className="w-4 h-4" />
              <span>المتجر</span>
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="min-h-[40px] px-3 sm:px-4 py-2 rounded-lg bg-white/10 hover:bg-[#FF4444]/20 border border-white/10 hover:border-[#FF4444]/40 text-xs sm:text-sm font-semibold text-white hover:text-[#FF4444] flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>تسجيل الخروج</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1280px] mx-auto px-4 sm:px-6 py-6 space-y-6">
        <section
          aria-label="ملخص الأداء والمبيعات"
          className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch"
        >
          <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl bg-[#111113] border border-white/12 p-5 flex flex-col justify-between gap-2">
              <span className="text-xs font-semibold text-white/65">
                إجمالي الطلبات (Total Leads)
              </span>
              <div
                data-testid="kpi-total-leads"
                className="text-3xl font-black text-white tabular-nums"
              >
                {analytics.totalLeads}
              </div>
              <span className="text-xs text-amber-300 tabular-nums">
                {analytics.pendingCount} طلب قيد الانتظار
              </span>
            </div>

            <div className="rounded-2xl bg-[#111113] border border-white/12 p-5 flex flex-col justify-between gap-2">
              <span className="text-xs font-semibold text-white/65">
                المبيعات المؤكدة (Confirmed)
              </span>
              <div
                data-testid="kpi-confirmed-sales"
                className="text-3xl font-black text-[#00FF66] tabular-nums"
              >
                {analytics.confirmedCount}
              </div>
              <span className="text-xs text-white/75 tabular-nums">
                {analytics.confirmedRevenue} درهم مبيعات مؤكدة
              </span>
            </div>

            <div className="rounded-2xl bg-[#111113] border border-white/12 p-5 flex flex-col justify-between gap-2">
              <span className="text-xs font-semibold text-white/65">
                نسبة التأكيد (Confirmation Rate)
              </span>
              <div
                data-testid="kpi-confirmation-rate"
                className="text-3xl font-black text-white tabular-nums"
              >
                {analytics.confirmationRate}%
              </div>
              <span className="text-xs text-[#FF4444] tabular-nums">
                {analytics.canceledCount} ملغى / لم يرد
              </span>
            </div>
          </div>

          <div className="lg:col-span-4 rounded-2xl bg-[#111113] border border-white/12 p-5 flex items-center justify-between gap-4">
            <div className="space-y-3 min-w-0">
              <h2 className="text-sm font-extrabold text-white">
                توزيع حالة الطلبات
              </h2>
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-xs bg-[#00FF66] shrink-0"
                    aria-hidden="true"
                  />
                  <span className="text-white/85">المشترين الفعليين:</span>
                  <strong className="text-[#00FF66] tabular-nums">
                    {analytics.confirmedCount}
                  </strong>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-xs bg-[#FF4444] shrink-0"
                    aria-hidden="true"
                  />
                  <span className="text-white/85">غير مفعل / ملغى:</span>
                  <strong className="text-[#FF4444] tabular-nums">
                    {analytics.unconfirmedOrCanceledCount}
                  </strong>
                </div>
              </div>
            </div>

            <div className="relative w-28 h-28 shrink-0">
              <canvas
                ref={chartCanvasRef}
                aria-label="مخطط مقارنة المشترين المؤكدين بالطلبات غير المفعلة"
              />
            </div>
          </div>
        </section>

        <section
          aria-label="قائمة طلبات الزبناء"
          className="rounded-2xl bg-[#111113] border border-white/12 overflow-hidden"
        >
          <div className="p-4 sm:p-5 border-b border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div
              role="tablist"
              aria-label="تصفية الطلبات حسب الحالة"
              className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-1.5 p-1 rounded-xl bg-[#0a0a0a] border border-white/10"
            >
              {(
                [
                  {key: 'all', label: 'الكل', count: analytics.totalLeads},
                  {
                    key: 'confirmed',
                    label: 'تم التفعيل',
                    count: analytics.confirmedCount,
                  },
                  {
                    key: 'pending',
                    label: 'قيد الانتظار',
                    count: analytics.pendingCount,
                  },
                  {
                    key: 'canceled',
                    label: 'ملغى',
                    count: analytics.canceledCount,
                  },
                ] as const
              ).map((tab) => {
                const isActive = statusFilter === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setStatusFilter(tab.key)}
                    className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center justify-center gap-1.5 ${
                      isActive
                        ? 'bg-[#00FF66] text-[#0a0a0a]'
                        : 'text-white/75 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className="tabular-nums opacity-85">
                      ({tab.count})
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:w-80">
                <Search className="w-4 h-4 text-white/45 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث برقم الهاتف أو المدينة..."
                  aria-label="البحث برقم الهاتف أو المدينة"
                  className="w-full min-h-[44px] rounded-xl border border-white/15 bg-[#0a0a0a] pr-10 pl-3.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-[#00FF66]"
                />
              </div>
              <button
                type="button"
                onClick={() => void refreshOrders(true)}
                disabled={isLoadingOrders}
                aria-label="تحديث قائمة الطلبات"
                className="min-h-[44px] px-3 rounded-xl border border-white/15 bg-[#0a0a0a] hover:bg-white/10 text-xs font-bold text-white flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-60 transition-colors"
              >
                <RefreshCw
                  className={`w-4 h-4 text-[#00FF66] ${
                    isLoadingOrders ? 'animate-spin' : ''
                  }`}
                />
                <span>تحديث</span>
              </button>
            </div>
          </div>

          {schemaSetupRequired && (
            <div
              role="alert"
              className="mx-4 sm:mx-5 mt-4 rounded-xl border border-amber-400/40 bg-amber-400/10 p-3.5 text-xs text-amber-200 leading-relaxed"
            >
              <strong>تنبيه إعداد Supabase:</strong> جدول{' '}
              <code dir="ltr" className="text-white font-bold">
                public.orders
              </code>{' '}
              غير منشأ بعد في مشروعك. نفّذ ملف{' '}
              <code dir="ltr" className="text-white font-bold">
                supabase/schema.sql
              </code>{' '}
              في Supabase SQL Editor لتفعيل المزامنة السحابية الفورية (الطلبات المحلية محفوظة ومُحمّلة أدناه).
            </div>
          )}

          {filteredOrders.length === 0 ? (
            <div className="p-10 text-center space-y-3">
              <p className="text-sm font-bold text-white/80">
                {orders.length === 0
                  ? 'لا توجد طلبات مسجلة بعد. عند إرسال أول طلب من صفحة المتجر سيظهر هنا فوراً.'
                  : 'لا توجد طلبات مطابقة لمعايير البحث أو التصفية الحالية.'}
              </p>
              {orders.length === 0 ? (
                <button
                  type="button"
                  onClick={onExitAdmin}
                  className="min-h-[44px] px-5 py-2 rounded-xl bg-[#00FF66] hover:bg-[#1aff75] text-[#0a0a0a] font-extrabold text-sm cursor-pointer transition-colors"
                >
                  الانتقال إلى المتجر لاختبار الطلب
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter('all');
                    setSearchQuery('');
                  }}
                  className="min-h-[44px] px-5 py-2 rounded-xl border border-white/15 text-white hover:bg-white/10 font-semibold text-sm cursor-pointer transition-colors"
                >
                  عرض جميع الطلبات
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm text-right border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-xs text-white/60 bg-white/[0.02]">
                      <th className="py-3 px-4 font-bold">الاسم الكامل</th>
                      <th className="py-3 px-4 font-bold">رقم الهاتف</th>
                      <th className="py-3 px-4 font-bold">المدينة</th>
                      <th className="py-3 px-4 font-bold">الباقة المطلوبة</th>
                      <th className="py-3 px-4 font-bold">التوقيت</th>
                      <th className="py-3 px-4 font-bold">التحقق بعد الاتصال</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {filteredOrders.map((order) => {
                      const statusMeta = getStatusMeta(order.status);
                      return (
                        <tr
                          key={order.id}
                          className="hover:bg-white/[0.03] transition-colors"
                        >
                          <td className="py-3.5 px-4 align-middle">
                            <div className="font-bold text-white">
                              {order.fullName}
                            </div>
                            <div className="text-xs text-white/50 tabular-nums">
                              {order.id}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 align-middle">
                            <div className="flex items-center gap-2">
                              <a
                                href={`tel:${order.phone}`}
                                dir="ltr"
                                className="inline-flex items-center gap-1.5 text-[#00FF66] hover:underline font-bold tabular-nums"
                              >
                                <Phone className="w-3.5 h-3.5" />
                                <span>{order.phone}</span>
                              </a>
                              <a
                                href={buildFollowUpWhatsAppUrl(order)}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={`مراسلة ${order.fullName} عبر واتساب`}
                                className="p-1.5 rounded-lg bg-[#00FF66]/12 text-[#00FF66] hover:bg-[#00FF66]/25 transition-colors"
                              >
                                <MessageCircle className="w-4 h-4" />
                              </a>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 align-middle text-white/90 font-semibold">
                            {order.city}
                          </td>
                          <td className="py-3.5 px-4 align-middle">
                            <div className="text-white/90 font-semibold">
                              الكمية: {order.quantity}
                            </div>
                            <div className="text-xs text-[#00FF66] font-extrabold tabular-nums">
                              {order.totalPrice} درهم
                            </div>
                          </td>
                          <td className="py-3.5 px-4 align-middle text-xs text-white/70 tabular-nums">
                            {formatArabicDateTime(order.createdAt)}
                          </td>
                          <td className="py-3.5 px-4 align-middle">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md border text-xs font-bold ${statusMeta.bgClass} ${statusMeta.borderClass} ${statusMeta.textClass}`}
                              >
                                {order.status === 'confirmed' ? (
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                ) : order.status === 'canceled' ? (
                                  <XCircle className="w-3.5 h-3.5" />
                                ) : (
                                  <Clock className="w-3.5 h-3.5" />
                                )}
                                <span>{statusMeta.label}</span>
                              </span>

                              <select
                                value={order.status}
                                onChange={(e) =>
                                  handleStatusChange(
                                    order.id,
                                    e.target.value as OrderStatus,
                                  )
                                }
                                aria-label={`تغيير حالة طلب ${order.fullName}`}
                                className="min-h-[38px] rounded-lg border border-white/20 bg-[#0a0a0a] px-2.5 text-xs font-bold text-white focus:outline-none focus:border-[#00FF66] cursor-pointer"
                              >
                                <option value="pending">
                                  🟡 قيد الانتظار (Pending)
                                </option>
                                <option value="confirmed">
                                  🟢 تم التفعيل بعد الاتصال (Confirmed)
                                </option>
                                <option value="canceled">
                                  🔴 ملغى / لم يرد (Canceled)
                                </option>
                              </select>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden divide-y divide-white/10">
                {filteredOrders.map((order) => {
                  const statusMeta = getStatusMeta(order.status);
                  return (
                    <div key={order.id} className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-white">
                            {order.fullName}
                          </div>
                          <div className="text-xs text-white/55 tabular-nums">
                            {order.id} · {formatArabicDateTime(order.createdAt)}
                          </div>
                        </div>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-bold shrink-0 ${statusMeta.bgClass} ${statusMeta.borderClass} ${statusMeta.textClass}`}
                        >
                          <span>{statusMeta.label}</span>
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <a
                            href={`tel:${order.phone}`}
                            dir="ltr"
                            className="inline-flex items-center gap-1 text-[#00FF66] font-bold tabular-nums"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            <span>{order.phone}</span>
                          </a>
                          <a
                            href={buildFollowUpWhatsAppUrl(order)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[#00FF66]/15 text-[#00FF66] font-bold"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>واتساب</span>
                          </a>
                        </div>
                        <div className="text-white/85 font-semibold tabular-nums">
                          {order.city} · {order.quantity}× ({order.totalPrice}{' '}
                          درهم)
                        </div>
                      </div>

                      <div>
                        <select
                          value={order.status}
                          onChange={(e) =>
                            handleStatusChange(
                              order.id,
                              e.target.value as OrderStatus,
                            )
                          }
                          aria-label={`تغيير حالة طلب ${order.fullName}`}
                          className="w-full min-h-[44px] rounded-xl border border-white/20 bg-[#0a0a0a] px-3 text-xs font-bold text-white focus:outline-none focus:border-[#00FF66] cursor-pointer"
                        >
                          <option value="pending">
                            🟡 قيد الانتظار (Pending)
                          </option>
                          <option value="confirmed">
                            🟢 تم التفعيل بعد الاتصال (Confirmed)
                          </option>
                          <option value="canceled">
                            🔴 ملغى / لم يرد (Canceled)
                          </option>
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
