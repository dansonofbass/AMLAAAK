"use client";
import Link from "next/link";
import { useLanguage } from "@/components/language";
export default function NotFound() {
  const { t } = useLanguage();
  return (
    <div className="state-card">
      <h1>{t("Page not found", "صفحه پیدا نشد")}</h1>
      <p>{t("This page does not exist.", "این صفحه وجود ندارد.")}</p>
      <Link href="/">{t("Return to overview", "بازگشت به نمای کلی")}</Link>
    </div>
  );
}
