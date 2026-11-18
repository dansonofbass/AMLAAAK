"use client";
import { AlertCircle, Database, LoaderCircle } from "lucide-react";
import { Button } from "./ui/button";
import { useLanguage } from "./language";
export function LoadingState() {
  const { t } = useLanguage();
  return (
    <div className="state-card" role="status" aria-live="polite">
      <LoaderCircle className="loading-icon" size={25} />
      <h2>{t("Loading historical data", "در حال دریافت داده‌های تاریخی")}</h2>
      <p>
        {t(
          "Your selection is being retrieved securely.",
          "داده‌های انتخاب شما به‌صورت امن دریافت می‌شوند.",
        )}
      </p>
      <div className="loading-skeletons" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}
export function ErrorState({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  const { t, language } = useLanguage();
  return (
    <div className="state-card error-state" role="alert">
      <AlertCircle size={27} />
      <h2>
        {t("Data is temporarily unavailable", "داده‌ها موقتاً در دسترس نیستند")}
      </h2>
      <p>
        {language === "en"
          ? message
          : t(
              "Please retry. No example records have been substituted.",
              "دوباره تلاش کنید. هیچ داده نمایشی جایگزین نشده است.",
            )}
      </p>
      {retry && (
        <Button variant="outline" onClick={retry}>
          {t("Try again", "تلاش دوباره")}
        </Button>
      )}
    </div>
  );
}
export function EmptyState({ reset }: { reset: () => void }) {
  const { t } = useLanguage();
  return (
    <div className="state-card">
      <Database size={27} />
      <h2>
        {t("No matching historical sales", "آگهی فروش تاریخی مطابق یافت نشد")}
      </h2>
      <p>
        {t(
          "Try another city or widen your search range.",
          "شهر دیگری انتخاب کنید یا بازه جستجو را افزایش دهید.",
        )}
      </p>
      <Button variant="outline" onClick={reset}>
        {t("Clear Filters", "پاک کردن فیلترها")}
      </Button>
    </div>
  );
}
