import React, {useState, useEffect} from 'react';
import {X, CheckCircle2, Minus, Plus, ShieldCheck} from 'lucide-react';
import {
  LandingSection,
  OrderFormInput,
  OrderValidationResult,
  PACK_TITLE,
  calculatePriceSummary,
  validateOrderForm,
} from '../utils/landingSections';
import {OrderRecord, createAndSaveOrder} from '../utils/orderStore';

interface ActionSheetProps {
  section: LandingSection | null;
  onClose: () => void;
  onNavigateSection: (sectionId: string) => void;
}

export function ActionSheet({
  section,
  onClose,
  onNavigateSection,
}: ActionSheetProps) {
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [formData, setFormData] = useState<OrderFormInput>({
    fullName: '',
    phone: '',
    city: '',
    quantity: 1,
  });
  const [validation, setValidation] = useState<OrderValidationResult>({
    valid: true,
    errors: {},
  });
  const [submittedOrder, setSubmittedOrder] = useState<OrderRecord | null>(
    null,
  );

  useEffect(() => {
    if (section) {
      setShowOrderForm(section.isPrimaryOffer);
      setSubmittedOrder(null);
      setValidation({valid: true, errors: {}});
      setFormData({
        fullName: '',
        phone: '',
        city: '',
        quantity: 1,
      });
    }
  }, [section]);

  useEffect(() => {
    if (!section) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [section, onClose]);

  if (!section) return null;

  const priceSummary = calculatePriceSummary(formData.quantity);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = validateOrderForm(formData);
    setValidation(result);
    if (!result.valid) return;

    const savedOrder = createAndSaveOrder(formData);
    setSubmittedOrder(savedOrder);
  };

  const adjustQuantity = (delta: number) => {
    setFormData((prev) => ({
      ...prev,
      quantity: Math.min(10, Math.max(1, prev.quantity + delta)),
    }));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sheet-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        dir="rtl"
        className="w-full max-w-[428px] rounded-t-3xl bg-white bg-[radial-gradient(ellipse_at_top,rgba(0,255,102,0.16)_0%,rgba(255,255,255,1)_52%)] text-[#0a0a0a] border-t-2 border-[#00FF66]/65 shadow-[0_-12px_40px_rgba(0,255,102,0.18)] max-h-[90vh] overflow-y-auto"
      >
        <div className="pt-3 pb-1 flex justify-center">
          <span className="w-10 h-1.5 rounded-full bg-[#00FF66]/75" />
        </div>

        <div className="px-5 pt-2 pb-4 border-b border-[#00FF66]/25 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2
              id="sheet-title"
              className="text-base font-extrabold leading-snug text-[#0a0a0a]"
            >
              {showOrderForm ? PACK_TITLE : section.alt}
            </h2>
            <p className="text-xs text-neutral-600 mt-0.5 leading-relaxed">
              {showOrderForm
                ? 'أكمل بياناتك وسيتصل بك فريقنا لتأكيد الشحن والدفع عند الاستلام'
                : section.summary}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق النافذة"
            className="min-h-[44px] min-w-[44px] shrink-0 rounded-full flex items-center justify-center bg-[#00FF66]/15 hover:bg-[#00FF66]/30 text-[#0a0a0a] border border-[#00FF66]/35 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {submittedOrder ? (
            <div
              data-testid="order-success-screen"
              className="rounded-2xl bg-gradient-to-b from-[#ebfff3] to-white border border-[#00FF66]/65 p-5 text-center space-y-3.5 shadow-[0_8px_28px_rgba(0,255,102,0.15)]"
            >
              <div className="w-14 h-14 rounded-full bg-[#00FF66] text-[#0a0a0a] flex items-center justify-center mx-auto shadow-[0_0_24px_rgba(0,255,102,0.5)]">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-extrabold text-[#065f46]">
                🎉 تم استلام طلبك بنجاح!
              </h3>
              <p className="text-sm text-neutral-700 leading-relaxed">
                سيقوم فريقنا بالاتصال بك قريباً لتأكيد الشحن الدفع عند الاستلام.
              </p>

              <div className="rounded-xl bg-white border border-[#00FF66]/45 p-3.5 text-start text-xs text-[#0a0a0a] space-y-1.5 leading-relaxed">
                <div className="flex items-center justify-between border-b border-neutral-100 pb-1.5">
                  <span className="text-neutral-500">رقم الطلب:</span>
                  <strong className="tabular-nums text-[#047857]">
                    {submittedOrder.id}
                  </strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500">الاسم الكامل:</span>
                  <strong>{submittedOrder.fullName}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500">رقم الهاتف:</span>
                  <strong dir="ltr" className="tabular-nums">
                    {submittedOrder.phone}
                  </strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500">المدينة:</span>
                  <strong>{submittedOrder.city}</strong>
                </div>
                <div className="flex items-center justify-between border-t border-neutral-100 pt-1.5">
                  <span className="text-neutral-500">المجموع ({submittedOrder.quantity}×):</span>
                  <strong className="tabular-nums text-[#047857]">
                    {submittedOrder.totalPrice} درهم (الدفع عند الاستلام)
                  </strong>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-full min-h-[48px] rounded-xl bg-[#00FF66] hover:bg-[#1aff75] text-[#0a0a0a] font-extrabold text-sm shadow-[0_6px_20px_rgba(0,255,102,0.3)] transition-colors cursor-pointer"
              >
                العودة إلى المتجر
              </button>
            </div>
          ) : showOrderForm ? (
            <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
              <div
                role="note"
                className="rounded-xl bg-[#00FF66]/20 border border-[#00FF66]/60 px-3.5 py-2.5 text-xs font-extrabold text-[#064e3b] text-center"
              >
                ⏳ عرض خاص - الأرصدة محدودة
              </div>

              <div className="rounded-2xl bg-[#f4fff8] border border-[#00FF66]/45 p-3.5 flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs text-neutral-600">السعر الإجمالي</div>
                  <div className="flex items-baseline gap-2 tabular-nums">
                    <span className="text-xl font-extrabold text-[#047857]">
                      {priceSummary.totalPrice} درهم
                    </span>
                    <span className="text-xs line-through text-neutral-400">
                      {priceSummary.originalPrice} درهم
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => adjustQuantity(-1)}
                    aria-label="إنقاص الكمية"
                    className="min-h-[44px] min-w-[44px] rounded-xl border border-[#00FF66]/45 bg-white flex items-center justify-center hover:bg-[#00FF66]/15 text-[#0a0a0a] cursor-pointer"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span
                    className="min-w-[28px] text-center font-bold text-base tabular-nums text-[#0a0a0a]"
                    aria-label="الكمية"
                  >
                    {formData.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => adjustQuantity(1)}
                    aria-label="زيادة الكمية"
                    className="min-h-[44px] min-w-[44px] rounded-xl border border-[#00FF66]/45 bg-white flex items-center justify-center hover:bg-[#00FF66]/15 text-[#0a0a0a] cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="order-full-name"
                  className="block text-sm font-bold mb-1.5 text-[#0a0a0a]"
                >
                  الاسم الكامل
                </label>
                <input
                  id="order-full-name"
                  type="text"
                  value={formData.fullName}
                  onChange={(e) =>
                    setFormData((prev) => ({...prev, fullName: e.target.value}))
                  }
                  placeholder="مثال: يوسف العلوي"
                  className="w-full min-h-[48px] rounded-xl border border-neutral-300 bg-white px-3.5 text-base text-[#0a0a0a] placeholder:text-neutral-400 focus:outline-none focus:border-[#00FF66] focus:ring-2 focus:ring-[#00FF66]/30"
                />
                {validation.errors.fullName && (
                  <p className="text-xs text-red-600 mt-1 font-medium" role="alert">
                    {validation.errors.fullName}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="order-phone"
                  className="block text-sm font-bold mb-1.5 text-[#0a0a0a]"
                >
                  رقم الهاتف (مع +212)
                </label>
                <div dir="ltr" className="flex items-stretch rounded-xl border border-neutral-300 bg-white focus-within:border-[#00FF66] focus-within:ring-2 focus-within:ring-[#00FF66]/30 overflow-hidden">
                  <span className="px-3 flex items-center bg-[#00FF66]/20 text-sm font-extrabold text-[#064e3b] border-r border-[#00FF66]/35 tabular-nums select-none">
                    +212
                  </span>
                  <input
                    id="order-phone"
                    type="tel"
                    inputMode="tel"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData((prev) => ({...prev, phone: e.target.value}))
                    }
                    placeholder="612345678"
                    className="w-full min-h-[48px] bg-transparent px-3.5 text-base text-[#0a0a0a] placeholder:text-neutral-400 tabular-nums focus:outline-none"
                  />
                </div>
                {validation.errors.phone && (
                  <p className="text-xs text-red-600 mt-1 font-medium" role="alert">
                    {validation.errors.phone}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="order-city"
                  className="block text-sm font-bold mb-1.5 text-[#0a0a0a]"
                >
                  المدينة
                </label>
                <input
                  id="order-city"
                  type="text"
                  value={formData.city}
                  onChange={(e) =>
                    setFormData((prev) => ({...prev, city: e.target.value}))
                  }
                  placeholder="الدار البيضاء، الرباط، مراكش، الداخلة..."
                  className="w-full min-h-[48px] rounded-xl border border-neutral-300 bg-white px-3.5 text-base text-[#0a0a0a] placeholder:text-neutral-400 focus:outline-none focus:border-[#00FF66] focus:ring-2 focus:ring-[#00FF66]/30"
                />
                {validation.errors.city && (
                  <p className="text-xs text-red-600 mt-1 font-medium" role="alert">
                    {validation.errors.city}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-center gap-2 text-xs text-neutral-700 py-1 font-medium">
                <ShieldCheck className="w-4 h-4 text-[#059669] shrink-0" />
                <span>الدفع عند الاستلام بالمغرب 📦 · توصيل سريع لجميع المدن</span>
              </div>

              <button
                type="submit"
                className="w-full min-h-[52px] rounded-xl bg-[#00FF66] hover:bg-[#1aff75] text-[#0a0a0a] font-extrabold text-base flex items-center justify-center gap-2 shadow-[0_6px_20px_rgba(0,255,102,0.35)] transition-colors cursor-pointer"
              >
                <span>تأكيد الطلب الآن (الدفع عند الاستلام) ✅</span>
              </button>
            </form>
          ) : (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setShowOrderForm(true)}
                className="w-full min-h-[50px] rounded-xl bg-[#00FF66] hover:bg-[#1aff75] text-[#0a0a0a] font-extrabold text-base flex items-center justify-center gap-2 shadow-[0_6px_20px_rgba(0,255,102,0.3)] transition-colors cursor-pointer"
              >
                <span>{section.ctaLabel}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNavigateSection('section-07-final-cta');
                }}
                className="w-full min-h-[48px] rounded-xl border border-neutral-300 font-semibold text-sm text-[#0a0a0a] hover:bg-[#00FF66]/10 transition-colors cursor-pointer"
              >
                الانتقال إلى قسم العرض النهائي
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
