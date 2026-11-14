import {useEffect, useState} from 'react';
import heroFixedImg from './assets/images/hero_fixed_spelling_1794660003666.jpg';
import painPointsFixedImg from './assets/images/pain_points_fixed_spelling_1794660507583.jpg';
import howToUseFixedImg from './assets/images/how_to_use_4_steps_clean_1794660792783.jpg';
import trustFixedImg from './assets/images/trust_whatsapp_morocco_verified_1794661351154.jpg';
import finalCtaFixedImg from './assets/images/final_cta_439_dirham_1794661631387.jpg';
import {
  LANDING_SECTIONS,
  LandingSection,
  formatRemainingCountdown,
  getOrCreateEvergreenDeadline,
} from './utils/landingSections';
import {ActionSheet} from './components/ActionSheet';
import {AdminDashboard} from './components/AdminDashboard';

export default function App() {
  const [isAdminRoute, setIsAdminRoute] = useState<boolean>(() =>
    typeof window !== 'undefined'
      ? window.location.hash.startsWith('#admin')
      : false,
  );
  const [activeSection, setActiveSection] = useState<LandingSection | null>(
    null,
  );
  const [countdownText, setCountdownText] = useState<string>('23:59:59');

  useEffect(() => {
    const handleHashChange = () => {
      setIsAdminRoute(window.location.hash.startsWith('#admin'));
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    if (isAdminRoute) return;
    const updateCountdown = () => {
      const now = Date.now();
      const deadline = getOrCreateEvergreenDeadline(window.localStorage, now);
      setCountdownText(formatRemainingCountdown(deadline - now));
    };

    updateCountdown();
    const intervalId = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(intervalId);
  }, [isAdminRoute]);

  const handleExitAdmin = () => {
    if (typeof window !== 'undefined') {
      window.location.hash = '';
      setIsAdminRoute(false);
    }
  };

  if (isAdminRoute) {
    return <AdminDashboard onExitAdmin={handleExitAdmin} />;
  }

  const scrollToSection = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({behavior: 'smooth', block: 'start'});
    }
  };

  const openCheckoutDrawer = () => {
    setActiveSection(LANDING_SECTIONS[0]);
  };

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-white bg-[radial-gradient(ellipse_at_top,rgba(0,255,102,0.16)_0%,rgba(255,255,255,1)_46%)] text-[#0a0a0a]">
      <header className="border-b border-[#00FF66]/35 bg-white/90 backdrop-blur-sm">
        <div className="mobile-shell px-4 py-3 flex items-center justify-between gap-4">
          <span className="text-base font-extrabold tracking-tight text-[#0a0a0a] whitespace-nowrap shrink-0">
            DAKHLA FIT
          </span>
          <button
            type="button"
            onClick={openCheckoutDrawer}
            className="min-h-[40px] px-3.5 py-2 rounded-lg bg-[#00FF66] text-[#0a0a0a] text-xs font-extrabold whitespace-nowrap shrink-0 cursor-pointer hover:bg-[#1aff75] shadow-[0_4px_14px_rgba(0,255,102,0.3)] transition-colors"
          >
            اطلب الآن · 439 درهم
          </button>
        </div>
      </header>

      <main className="mobile-shell px-3 pt-3 pb-[92px]">
        <div className="rounded-[14px] overflow-hidden border border-[#00FF66]/40 bg-white shadow-[0_10px_32px_rgba(0,255,102,0.14)]">
          {LANDING_SECTIONS.map((section) => (
            <button
              key={section.id}
              id={section.id}
              type="button"
              onClick={() => setActiveSection(section)}
              aria-label={section.alt}
              className="section-image-button scroll-mt-4"
            >
              <img
                src={
                  section.order === 1
                    ? heroFixedImg
                    : section.order === 2
                      ? painPointsFixedImg
                      : section.order === 3
                        ? howToUseFixedImg
                        : section.order === 6
                          ? trustFixedImg
                          : section.order === 7
                            ? finalCtaFixedImg
                            : section.assetPath
                }
                alt={section.alt}
                loading={section.order === 1 ? 'eager' : 'lazy'}
                referrerPolicy="no-referrer"
              />
            </button>
          ))}
        </div>

        <section
          aria-label="Files included"
          aria-hidden="true"
          className="hidden"
        >
          <strong>Files included:</strong>
          <ol>
            {LANDING_SECTIONS.map((section) => (
              <li key={section.id}>
                <button
                  type="button"
                  onClick={() => scrollToSection(section.id)}
                >
                  {section.originalFilename}
                </button>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <div
        data-testid="sticky-cta-bar"
        className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[428px] z-40 px-3 pt-2 pb-[max(8px,env(safe-area-inset-bottom))] bg-white/95 backdrop-blur-md border-t border-[#00FF66]/40 shadow-[0_-6px_24px_rgba(0,255,102,0.12)]"
      >
        <div
          className="pointer-events-auto mb-[6px] flex items-center justify-center gap-2 text-[13px] leading-tight whitespace-nowrap"
          aria-live="off"
        >
          <span className="text-neutral-700 font-semibold">
            ⏳ ينتهي العرض التفضيلي خلال:
          </span>
          <span
            dir="ltr"
            data-testid="evergreen-countdown"
            className="font-extrabold text-[#047857] bg-[#00FF66]/20 px-2 py-0.5 rounded-md tabular-nums tracking-wide text-[13.5px]"
          >
            {countdownText}
          </span>
        </div>
        <button
          type="button"
          onClick={openCheckoutDrawer}
          className="pointer-events-auto w-full min-h-[50px] rounded-2xl bg-[#00FF66] hover:bg-[#1aff75] text-[#0a0a0a] font-extrabold text-[15px] flex items-center justify-center gap-2 cta-neon-pulse cursor-pointer transition-colors"
        >
          <span>⚡ اطلب الباقة الآن (الدفع عند الاستلام)</span>
        </button>
      </div>

      <ActionSheet
        section={activeSection}
        onClose={() => setActiveSection(null)}
        onNavigateSection={scrollToSection}
      />
    </div>
  );
}
