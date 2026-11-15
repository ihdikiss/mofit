export interface LandingSection {
  id: string;
  order: number;
  originalFilename: string;
  assetPath: string;
  alt: string;
  ctaLabel: string;
  summary: string;
  isPrimaryOffer: boolean;
}

export interface OrderFormInput {
  fullName: string;
  phone: string;
  city: string;
  address?: string;
  quantity: number;
}

export interface OrderValidationResult {
  valid: boolean;
  errors: Partial<Record<keyof OrderFormInput, string>>;
}

export interface PriceSummary {
  originalPrice: number;
  salePrice: number;
  savings: number;
  discountPercent: number;
  totalPrice: number;
}

export interface WhatsAppPayload {
  message: string;
  url: string;
  totalPrice: number;
  normalizedPhone: string;
}

export const ORIGINAL_PRICE = 599;
export const SALE_PRICE = 439;
export const PACK_TITLE = 'DAKHLA FIT — باقة اللياقة البدنية المتكاملة';
export const STORE_WHATSAPP_NUMBER = '212661000439';
export const SITE_BASE_URL = 'https://morabitfit.vercel.app/';
export const ADMIN_DASHBOARD_URL = 'https://morabitfit.vercel.app/#admin';

export const LANDING_SECTIONS: LandingSection[] = [
  {
    id: 'section-01-hero',
    order: 1,
    originalFilename: '01-الهيرو--العرض-Hero.png',
    assetPath: '/src/assets/images/hero_fixed_spelling_1794660003666.jpg',
    alt: 'الهيرو + العرض (Hero)',
    ctaLabel: 'اطلب الباقة الآن — 439 درهم',
    summary: 'باقة اللياقة البدنية المتكاملة للتدريب المنزلي بدون اشتراكات.',
    isPrimaryOffer: true,
  },
  {
    id: 'section-02-pain-points',
    order: 2,
    originalFilename: '02-شبكة-المشاكل--حالات-الاستخدام-Pain-Points.png',
    assetPath: '/src/assets/images/pain_points_fixed_spelling_1794660507583.jpg',
    alt: 'شبكة المشاكل / حالات الاستخدام (Pain Points)',
    ctaLabel: 'احصل على الحل العملي الآن',
    summary: 'معدات مدمجة وسهلة التخزين تناسب ضيق الوقت والمساحة في المنزل.',
    isPrimaryOffer: false,
  },
  {
    id: 'section-03-how-to-use',
    order: 3,
    originalFilename: '03-طريقة-الاستخدام-How-to-Use.png',
    assetPath: '/src/assets/images/how_to_use_4_steps_clean_1794660792783.jpg',
    alt: 'طريقة الاستخدام (How to Use)',
    ctaLabel: 'ابدأ برنامجك المنزلي الآن',
    summary: '4 خطوات بسيطة: سترة الجري، عجلة التمارين، الدمبلز، والشريط المقاوم.',
    isPrimaryOffer: false,
  },
  {
    id: 'section-04-before-after',
    order: 4,
    originalFilename: '04-إثبات-بصري-قبلبعد-BeforeAfter.png',
    assetPath: '/assets/aistudio/04-_____-____-______-BeforeAfter_004f2ead.png',
    alt: 'إثبات بصري قبل/بعد (Before/After)',
    ctaLabel: 'احجز باقتك بسعر العرض',
    summary: 'تحفيز نمو العضلات وتحسين التحمل العضلي بتدريب منزلي منتظم.',
    isPrimaryOffer: false,
  },
  {
    id: 'section-05-benefits',
    order: 5,
    originalFilename: '05-الفوائد-الأساسية-Benefits.png',
    assetPath: '/assets/aistudio/05-_______-________-Benefits_8a5b1b71.png',
    alt: 'الفوائد الأساسية (Benefits)',
    ctaLabel: 'اطلب الباقة المتكاملة',
    summary: '5 مزايا عملية تجمع بين المقاومة والحركة لجميع المستويات.',
    isPrimaryOffer: false,
  },
  {
    id: 'section-06-trust',
    order: 6,
    originalFilename: '06-الثقة-والتقييمات-Trust.png',
    assetPath: '/src/assets/images/trust_whatsapp_morocco_verified_1794661351154.jpg',
    alt: 'الثقة والتقييمات (Trust)',
    ctaLabel: 'انضم للزبناء واطلب الآن',
    summary: 'تجارب حقيقية عبر واتساب لزبناء اشتروا الباقة في الرباط والدار البيضاء ومراكش وتطوان.',
    isPrimaryOffer: false,
  },
  {
    id: 'section-07-final-cta',
    order: 7,
    originalFilename: '07-الضمان-والطلب-الآن-Final-CTA.png',
    assetPath: '/src/assets/images/final_cta_439_dirham_1794661631387.jpg',
    alt: 'الضمان والطلب الآن (Final CTA)',
    ctaLabel: 'تأكيد الطلب الآن — 439 درهم',
    summary: 'العرض الحالي 439 درهم بدلاً من 599 درهم مع الدفع عند الاستلام.',
    isPrimaryOffer: true,
  },
];

export function calculatePriceSummary(quantity: number): PriceSummary {
  const safeQty = Number.isFinite(quantity) && quantity >= 1 ? Math.floor(quantity) : 1;
  const savings = ORIGINAL_PRICE - SALE_PRICE;
  const discountPercent = Math.round((savings / ORIGINAL_PRICE) * 100);
  return {
    originalPrice: ORIGINAL_PRICE * safeQty,
    salePrice: SALE_PRICE,
    savings: savings * safeQty,
    discountPercent,
    totalPrice: SALE_PRICE * safeQty,
  };
}

export function normalizeMoroccanPhone(rawPhone: string): string {
  const digits = rawPhone.replace(/[^\d]/g, '');
  if (digits.startsWith('212') && digits.length >= 12) {
    return `+${digits}`;
  }
  if (digits.startsWith('0') && digits.length === 10) {
    return `+212${digits.slice(1)}`;
  }
  if ((digits.startsWith('6') || digits.startsWith('7')) && digits.length === 9) {
    return `+212${digits}`;
  }
  return rawPhone.trim();
}

export function validateOrderForm(input: OrderFormInput): OrderValidationResult {
  const errors: Partial<Record<keyof OrderFormInput, string>> = {};
  const trimmedName = input.fullName.trim();
  const digits = input.phone.replace(/[^\d]/g, '');
  const trimmedCity = input.city.trim();
  const trimmedAddress = (input.address ?? '').trim();

  if (trimmedName.length < 2) {
    errors.fullName = 'يرجى إدخال الاسم الكامل';
  }

  const isValidMoroccan =
    /^0[567]\d{8}$/.test(digits) ||
    /^[567]\d{8}$/.test(digits) ||
    /^212[567]\d{8}$/.test(digits);

  if (!isValidMoroccan) {
    errors.phone = 'يرجى إدخال رقم هاتف مغربي صحيح (مثال: 612345678)';
  }

  if (trimmedCity.length < 2) {
    errors.city = 'يرجى إدخال المدينة';
  }

  if (trimmedAddress.length < 3) {
    errors.address = 'يرجى إدخال العنوان الكامل للتوصيل';
  }

  if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 10) {
    errors.quantity = 'يرجى اختيار كمية بين 1 و 10';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function buildWhatsAppOrderPayload(input: OrderFormInput): WhatsAppPayload {
  const pricing = calculatePriceSummary(input.quantity);
  const normalizedPhone = normalizeMoroccanPhone(input.phone);
  const qty = Math.min(10, Math.max(1, Math.floor(input.quantity || 1)));
  const trimmedAddress = (input.address ?? '').trim();

  const lines = [
    `طلب جديد من ${PACK_TITLE}`,
    `الاسم الكامل: ${input.fullName.trim()}`,
    `رقم الهاتف: ${normalizedPhone}`,
    `المدينة: ${input.city.trim()}`,
  ];
  if (trimmedAddress) {
    lines.push(`العنوان: ${trimmedAddress}`);
  }
  lines.push(
    `الكمية: ${qty}`,
    `المجموع: ${pricing.totalPrice} درهم (الدفع عند الاستلام بالمغرب)`,
    `الرابط: ${SITE_BASE_URL}`,
  );
  const message = lines.join('\n');

  const url = `https://wa.me/${STORE_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

  return {
    message,
    url,
    totalPrice: pricing.totalPrice,
    normalizedPhone,
  };
}

export const EVERGREEN_TIMER_STORAGE_KEY = 'dakhla_fit_offer_deadline_v1';
export const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

export function getOrCreateEvergreenDeadline(
  storage: StorageLike | null,
  nowMs: number = Date.now(),
): number {
  if (storage) {
    try {
      const saved = storage.getItem(EVERGREEN_TIMER_STORAGE_KEY);
      if (saved) {
        const parsed = Number(saved);
        if (
          Number.isFinite(parsed) &&
          parsed > nowMs &&
          parsed <= nowMs + TWENTY_FOUR_HOURS_MS
        ) {
          return parsed;
        }
      }
      const nextDeadline = nowMs + TWENTY_FOUR_HOURS_MS;
      storage.setItem(EVERGREEN_TIMER_STORAGE_KEY, String(nextDeadline));
      return nextDeadline;
    } catch {
      return nowMs + TWENTY_FOUR_HOURS_MS;
    }
  }
  return nowMs + TWENTY_FOUR_HOURS_MS;
}

export function formatRemainingCountdown(remainingMs: number): string {
  const clampedSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const hours = Math.floor(clampedSeconds / 3600);
  const minutes = Math.floor((clampedSeconds % 3600) / 60);
  const seconds = clampedSeconds % 60;
  return [hours, minutes, seconds]
    .map((unit) => String(unit).padStart(2, '0'))
    .join(':');
}

