"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  LayoutDashboard,
  Calculator,
  Building2,
  ChartNoAxesCombined,
  Menu,
  X,
  Languages,
  Database,
  BookOpen,
  ArrowUpRight,
} from "lucide-react";
import { BrandSymbol } from "./brand";
import { useLanguage } from "./language";
export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { t, language, setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);
  const links = [
    {
      href: "/",
      label: t("Overview", "\u0646\u0645\u0627\u06cc \u06a9\u0644\u06cc"),
      icon: LayoutDashboard,
    },
    {
      href: "/predict",
      label: t(
        "Price Estimator",
        "\u0628\u0631\u0622\u0648\u0631\u062f \u0642\u06cc\u0645\u062a",
      ),
      icon: Calculator,
    },
    {
      href: "/properties",
      label: t(
        "Explore Properties",
        "\u062c\u0633\u062a\u062c\u0648\u06cc \u0645\u0644\u06a9",
      ),
      icon: Building2,
    },
    {
      href: "/analytics",
      label: t(
        "Market Analytics",
        "\u062a\u062d\u0644\u06cc\u0644 \u0628\u0627\u0632\u0627\u0631",
      ),
      icon: ChartNoAxesCombined,
    },
  ];
  const navigation = (
    <>
      <Link href="/" className="brand" onClick={() => setOpen(false)}>
        <BrandSymbol />
        <span>
          <strong>AMLAAAK</strong>
          <small>
            {t(
              "REAL ESTATE INTELLIGENCE",
              "\u0647\u0648\u0634\u0645\u0646\u062f\u06cc \u0628\u0627\u0632\u0627\u0631 \u0645\u0633\u06a9\u0646",
            )}
          </small>
        </span>
      </Link>
      <nav
        className="primary-nav"
        aria-label={t("Main navigation", "?????? ????")}
      >
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={path === href ? "page" : undefined}
            onClick={() => setOpen(false)}
          >
            <Icon size={19} />
            {label}
          </Link>
        ))}
      </nav>
      <div className="sidebar-secondary">
        <p>
          {t(
            "ABOUT AMLAAAK",
            "\u062f\u0631\u0628\u0627\u0631\u0647 \u0627\u0645\u0644\u0627\u06a9",
          )}
        </p>
        <Link
          href="/model"
          aria-current={path === "/model" ? "page" : undefined}
          onClick={() => setOpen(false)}
        >
          <BookOpen size={17} />
          {t(
            "Model & Methodology",
            "\u0645\u062f\u0644 \u0648 \u0631\u0648\u0634\u200c\u0634\u0646\u0627\u0633\u06cc",
          )}
        </Link>
        <a
          href="https://github.com/dansonofbass/AMLAAAK#readme"
          target="_blank"
          rel="noreferrer"
        >
          {t("Documentation", "\u0645\u0633\u062a\u0646\u062f\u0627\u062a")}
          <ArrowUpRight size={15} />
        </a>
      </div>
      <div className="sidebar-note">
        <Database size={19} />
        <strong>
          {t(
            "Historical perspective.",
            "\u0646\u06af\u0627\u0647\u06cc \u0628\u0647 \u062f\u0627\u062f\u0647\u200c\u0647\u0627\u06cc \u06af\u0630\u0634\u062a\u0647.",
          )}
        </strong>
        <p>
          {t(
            "Asking prices, not completed transactions.",
            "\u0642\u06cc\u0645\u062a\u200c\u0647\u0627\u06cc \u067e\u06cc\u0634\u0646\u0647\u0627\u062f\u06cc\u060c \u0646\u0647 \u0645\u0639\u0627\u0645\u0644\u0627\u062a \u0642\u0637\u0639\u06cc.",
          )}
        </p>
      </div>
    </>
  );
  return (
    <div className="application">
      <a href="#main-content" className="skip-link">
        {t(
          "Skip to content",
          "\u0631\u0641\u062a\u0646 \u0628\u0647 \u0645\u062d\u062a\u0648\u0627",
        )}
      </a>
      <aside className="sidebar">{navigation}</aside>
      <div className="workspace">
        <header className="app-header">
          <div className="header-start">
            <Dialog.Root open={open} onOpenChange={setOpen}>
              <Dialog.Trigger asChild>
                <button
                  className="button button-ghost button-icon mobile-menu"
                  aria-label={t(
                    "Open navigation",
                    "\u0628\u0627\u0632 \u06a9\u0631\u062f\u0646 \u0645\u0646\u0648",
                  )}
                >
                  <Menu size={21} />
                </button>
              </Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Overlay className="drawer-overlay" />
                <Dialog.Content className="mobile-drawer">
                  <Dialog.Title className="sr-only">
                    {t("Navigation", "\u0645\u0646\u0648")}
                  </Dialog.Title>
                  <Dialog.Description className="sr-only">
                    {t(
                      "Choose an application page.",
                      "\u0635\u0641\u062d\u0647 \u0645\u0648\u0631\u062f \u0646\u0638\u0631 \u0631\u0627 \u0627\u0646\u062a\u062e\u0627\u0628 \u06a9\u0646\u06cc\u062f.",
                    )}
                  </Dialog.Description>
                  <Dialog.Close
                    className="drawer-close button button-ghost button-icon"
                    aria-label={t(
                      "Close navigation",
                      "\u0628\u0633\u062a\u0646 \u0645\u0646\u0648",
                    )}
                  >
                    <X size={20} />
                  </Dialog.Close>
                  {navigation}
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>
            <span className="header-context">
              {links.find((l) => l.href === path)?.label ||
                t(
                  "Model & Methodology",
                  "\u0645\u062f\u0644 \u0648 \u0631\u0648\u0634\u200c\u0634\u0646\u0627\u0633\u06cc",
                )}
            </span>
          </div>
          <div className="header-actions">
            <span className="historical-tag">
              <Database size={14} />
              {t(
                "Historical data",
                "\u062f\u0627\u062f\u0647\u200c\u0647\u0627\u06cc \u062a\u0627\u0631\u06cc\u062e\u06cc",
              )}
            </span>
            <button
              className="button button-outline language-toggle"
              onClick={() => setLanguage(language === "en" ? "fa" : "en")}
              aria-label={t(
                "Switch to Persian",
                "\u062a\u063a\u06cc\u06cc\u0631 \u0632\u0628\u0627\u0646 \u0628\u0647 \u0627\u0646\u06af\u0644\u06cc\u0633\u06cc",
              )}
            >
              <Languages size={17} />
              <span lang={language === "en" ? "fa" : "en"}>
                {language === "en" ? "فارسی" : "English"}
              </span>
            </button>
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className="main-content">
          {children}
        </main>
        <footer className="app-footer">
          <span>
            {t(
              "Historical asking prices · Currency units unverified",
              "قیمت‌های پیشنهادی تاریخی · واحد پول تأیید نشده",
            )}
          </span>
          <Link href="/model">
            {t(
              "Methodology & limitations",
              "\u0631\u0648\u0634\u200c\u0634\u0646\u0627\u0633\u06cc \u0648 \u0645\u062d\u062f\u0648\u062f\u06cc\u062a\u200c\u0647\u0627",
            )}
          </Link>
        </footer>
      </div>
    </div>
  );
}
