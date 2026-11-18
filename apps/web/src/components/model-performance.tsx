"use client";
import { useQuery } from "@tanstack/react-query";
import { FlaskConical, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { metricsSchema } from "@/lib/contracts";
import { useLanguage } from "./language";
import { LoadingState, ErrorState } from "./status";
export function ModelPerformance() {
  const { t, n } = useLanguage();
  const query = useQuery({
    queryKey: ["model-metrics"],
    queryFn: () => api("model/metrics", metricsSchema),
  });
  if (query.isError)
    return (
      <ErrorState message={query.error.message} retry={() => query.refetch()} />
    );
  if (!query.data) return <LoadingState />;
  const m = query.data;
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            {t(
              "METHODOLOGY / RESEARCH BASELINE",
              "روش‌شناسی / مدل پایه پژوهشی",
            )}
          </span>
          <h1>{t("Model & Methodology", "مدل و روش‌شناسی")}</h1>
          <p>
            {t(
              "Verified artifact metadata, measured evaluation and the limits behind an estimate.",
              "فراداده مدل تأییدشده، ارزیابی اندازه‌گیری‌شده و محدودیت‌های برآورد.",
            )}
          </p>
        </div>
      </div>
      <div className="model-notice">
        <FlaskConical size={24} />
        <div>
          <strong>
            {m.status.mode === "illustrative"
              ? t("Illustrative smoke-test model", "مدل نمایشی برای آزمون")
              : t(
                  "A research estimate, not a certified valuation",
                  "برآورد پژوهشی، نه ارزش‌گذاری تأییدشده",
                )}
          </strong>
          <p>
            {t(
              "The approved Random Forest was trained on a limited historical subset. The larger searchable archive is not its training population. No accuracy for every city or current market is claimed.",
              "جنگل تصادفی تأییدشده روی نمونه تاریخی محدودی آموزش دیده است. آرشیو بزرگ‌تر قابل جستجو، داده آموزشی این مدل نیست. دقت برای تمام شهرها یا بازار امروز ادعا نمی‌شود.",
            )}
          </p>
          <code dir="ltr">
            {t("Model version", "نسخه مدل")}: {m.status.version || "—"}
          </code>
        </div>
      </div>
      {!m.scores ? (
        <section className="state-card">
          <h2>
            {t(
              "No verified evaluation artifact",
              "نتیجه ارزیابی تأییدشده موجود نیست",
            )}
          </h2>
          <p>
            {t(
              "Scores are shown only when provided by the trusted model artifact.",
              "امتیازها فقط در صورت وجود در مدل تأییدشده نمایش داده می‌شوند.",
            )}
          </p>
        </section>
      ) : (
        <>
          <div className="kpi-grid">
            {[
              {
                label: t("Training records", "آگهی‌های آموزش"),
                value: m.train_rows,
              },
              {
                label: t("Validation records", "آگهی‌های اعتبارسنجی"),
                value: m.validation_rows,
              },
              {
                label: t("Test records", "آگهی‌های آزمون"),
                value: m.test_rows,
              },
              {
                label: t(
                  "Eligible training-source sales",
                  "فروش‌های معتبر منبع آموزش",
                ),
                value: m.eligible_rows,
              },
            ].map((c) => (
              <section className="kpi-card" key={c.label}>
                <span className="kpi-label">{c.label}</span>
                <strong>{n(c.value)}</strong>
                <small className="small-note">
                  {t(
                    "Model source subset, not the searchable archive",
                    "نمونه منبع مدل، نه آرشیو قابل جستجو",
                  )}
                </small>
              </section>
            ))}
          </div>
          <section className="table-panel metrics-table">
            <div className="table-toolbar">
              <h2>
                {t(
                  "Random Forest vs. median baseline",
                  "جنگل تصادفی در برابر مدل میانه",
                )}
              </h2>
              <span className="small-note">
                {t("Same held-out test set", "مجموعه آزمون مشترک و مستقل")}
              </span>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>{t("Estimator", "مدل")}</th>
                    <th>MAE ↓</th>
                    <th>RMSE ↓</th>
                    <th>R² ↑</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(m.scores).map(([name, s]) => (
                    <tr key={name}>
                      <td>
                        {name === "random_forest"
                          ? t("Random Forest", "جنگل تصادفی")
                          : t(
                              "Training-median baseline",
                              "مدل پایه میانه آموزش",
                            )}
                      </td>
                      <td title={String(s.mae)}>{n(s.mae, true)}</td>
                      <td title={String(s.rmse)}>{n(s.rmse, true)}</td>
                      <td>
                        <bdi>{n(s.r2, false, 6)}</bdi>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
      <div className="model-meta">
        <section className="panel">
          <ShieldCheck size={21} className="text-accent" />
          <h3>{t("How estimation works", "روش برآورد")}</h3>
          <p>
            {t(
              "The fitted preprocessing pipeline handles missing details, then the existing Random Forest estimates historical asking price. A separate search ranks same-city, same-type properties; their median is descriptive.",
              "پیش‌پردازش آموزش‌دیده مقادیر نامشخص را مدیریت می‌کند؛ سپس جنگل تصادفی موجود قیمت پیشنهادی تاریخی را برآورد می‌کند. جستجویی جداگانه املاک هم‌شهر و هم‌نوع را رتبه‌بندی می‌کند؛ میانه آن‌ها توصیفی است.",
            )}
          </p>
          <p>
            {t(
              "MAE and RMSE are measured in original price units. Lower is better. R² describes explained test-set variation and can be negative.",
              "MAE و RMSE با واحد اصلی قیمت اندازه‌گیری می‌شوند؛ مقدار کمتر بهتر است. R² تغییرات توضیح‌داده‌شده در آزمون را بیان می‌کند و می‌تواند منفی باشد.",
            )}
          </p>
        </section>
        <section className="panel">
          <h3>
            {t(
              "Limitations & responsible use",
              "محدودیت‌ها و استفاده مسئولانه",
            )}
          </h3>
          <p>
            {t(
              "Historical asking prices are not completed sales. Currency units are unverified. No calibrated confidence interval or universal city-level validation is available. Do not use this estimate alone for a financial decision.",
              "قیمت‌های پیشنهادی تاریخی، قیمت معامله قطعی نیستند. واحد پول تأیید نشده است. بازه اطمینان کالیبره‌شده یا اعتبارسنجی برای همه شهرها موجود نیست. این برآورد را تنها مبنای تصمیم مالی قرار ندهید.",
            )}
          </p>
          <p>
            {t("Evaluation split", "تقسیم ارزیابی")}:{" "}
            <bdi>{m.split_method || "—"}</bdi>
          </p>
          <code dir="ltr">
            {t("Training-source revision", "نسخه منبع آموزش")}:{" "}
            {m.source_revision || "—"}
          </code>
        </section>
        <details className="panel panel-body">
          <summary>
            {t("Feature and runtime metadata", "ویژگی‌ها و فراداده اجرا")}
          </summary>
          <p className="small-note">{m.features.join(" · ")}</p>
          <code dir="ltr">
            {Object.entries(m.versions || {})
              .map(([k, v]) => k + " " + v)
              .join(" / ")}
          </code>
        </details>
      </div>
    </>
  );
}
