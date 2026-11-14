import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LANDING_SECTIONS,
  calculatePriceSummary,
  normalizeMoroccanPhone,
  validateOrderForm,
  buildWhatsAppOrderPayload,
  EVERGREEN_TIMER_STORAGE_KEY,
  TWENTY_FOUR_HOURS_MS,
  getOrCreateEvergreenDeadline,
  formatRemainingCountdown,
} from './landingSections';

test('preserves all 7 original landing page sections in exact order', () => {
  assert.equal(LANDING_SECTIONS.length, 7);
  assert.equal(LANDING_SECTIONS[0].originalFilename, '01-الهيرو--العرض-Hero.png');
  assert.equal(LANDING_SECTIONS[6].originalFilename, '07-الضمان-والطلب-الآن-Final-CTA.png');
  for (const section of LANDING_SECTIONS) {
    assert.ok(
      section.assetPath.startsWith('/assets/aistudio/') ||
        section.assetPath.startsWith('/src/assets/images/'),
    );
    assert.ok(section.alt.length > 0);
  }
});

test('calculatePriceSummary computes discount and multi-quantity totals', () => {
  const single = calculatePriceSummary(1);
  assert.equal(single.originalPrice, 599);
  assert.equal(single.totalPrice, 439);
  assert.equal(single.savings, 160);
  assert.equal(single.discountPercent, 27);

  const double = calculatePriceSummary(2);
  assert.equal(double.totalPrice, 878);
  assert.equal(double.savings, 320);
});

test('validateOrderForm and normalizeMoroccanPhone handle +212 and local formats', () => {
  assert.equal(normalizeMoroccanPhone('0612345678'), '+212612345678');
  assert.equal(normalizeMoroccanPhone('612345678'), '+212612345678');
  assert.equal(normalizeMoroccanPhone('+212 708394512'), '+212708394512');

  const invalid = validateOrderForm({
    fullName: '',
    phone: '123',
    city: '',
    quantity: 1,
  });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.fullName);
  assert.ok(invalid.errors.phone);
  assert.ok(invalid.errors.city);

  const validNineDigits = validateOrderForm({
    fullName: 'يوسف العلوي',
    phone: '612345678',
    city: 'الرباط',
    quantity: 1,
  });
  assert.equal(validNineDigits.valid, true);
  assert.deepEqual(validNineDigits.errors, {});
});

test('buildWhatsAppOrderPayload constructs dynamic encoded wa.me URL with pack and customer info', () => {
  const payload = buildWhatsAppOrderPayload({
    fullName: 'سلمى بنعلي',
    phone: '0652841037',
    city: 'مراكش',
    quantity: 2,
  });

  assert.equal(payload.normalizedPhone, '+212652841037');
  assert.equal(payload.totalPrice, 878);
  assert.ok(payload.url.startsWith('https://wa.me/212661000439?text='));
  assert.ok(payload.message.includes('سلمى بنعلي'));
  assert.ok(payload.message.includes('+212652841037'));
  assert.ok(payload.message.includes('مراكش'));
  assert.ok(payload.message.includes('878'));
  assert.ok(payload.message.includes('DAKHLA FIT'));
  assert.ok(payload.message.includes('https://morabitfit.vercel.app/'));
});

test('evergreen countdown persists across visits and resets only after 24h expiry', () => {
  const store = new Map<string, string>();
  const mockStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
  };

  const t0 = 1_700_000_000_000;
  const deadline1 = getOrCreateEvergreenDeadline(mockStorage, t0);
  assert.equal(deadline1, t0 + TWENTY_FOUR_HOURS_MS);
  assert.equal(store.get(EVERGREEN_TIMER_STORAGE_KEY), String(deadline1));

  // Returning 3 hours later keeps the exact same deadline
  const tLater = t0 + 3 * 60 * 60 * 1000;
  const deadline2 = getOrCreateEvergreenDeadline(mockStorage, tLater);
  assert.equal(deadline2, deadline1);
  assert.equal(formatRemainingCountdown(deadline2 - tLater), '21:00:00');

  // Returning after 24h expiry rolls into a fresh 24h window
  const tExpired = deadline1 + 5000;
  const deadline3 = getOrCreateEvergreenDeadline(mockStorage, tExpired);
  assert.equal(deadline3, tExpired + TWENTY_FOUR_HOURS_MS);
  assert.equal(formatRemainingCountdown(23 * 3600 * 1000 + 59 * 60 * 1000 + 59 * 1000), '23:59:59');
});

