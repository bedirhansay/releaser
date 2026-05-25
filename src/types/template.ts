// Editable release-template model. A template is an ordered list of sections;
// each section has a heading and an AI instruction describing what content the
// model should draft for it. Because every section is AI-filled, the document
// structure is entirely user-defined.

export interface TemplateSection {
  /** Stable id (cuid-ish / nanoid) so reordering & edits keep identity. */
  id: string;
  /** Markdown heading text, e.g. "🟡 RISK DEFINITION". */
  heading: string;
  /** What the AI should write here, in the user's words. */
  instruction: string;
}

export interface TemplateDefinition {
  sections: TemplateSection[];
}

/**
 * Opinionated starter template modelled on the Mersel/finsel release doc.
 * Users get this on first run and edit it freely — headings and instructions
 * are all changeable.
 */
export const DEFAULT_TEMPLATE_SECTIONS: TemplateSection[] = [
  {
    id: "meta",
    heading: "📋 Release Meta",
    instruction:
      "Bir başlık bloğu üret: ürün adı, sürüm (vYYYY-MM-DD biçiminde), tarih, risk seviyesi (LOW/MEDIUM/HIGH). Ardından imza (sign-off) için Code Owner, QA / Business ve Management satırları oluştur; isimleri _([isim])_ gibi placeholder bırak. İlgili PR linklerini de listele.",
  },
  {
    id: "system-impact",
    heading: "⚙️ System Impact / Risk Definition",
    instruction:
      "Bu sürümün deploy öncesi/sonrası sistemsel etkilerini ve risklerini madde madde yaz. Migration, config (appsettings), seed/version değişiklikleri, manifest güncellemeleri varsa belirt. Yoksa 'Belirgin risk yok' yaz.",
  },
  {
    id: "dependencies",
    heading: "🔗 Dependencies",
    instruction:
      "Bu sürümün bağımlı olduğu dış servis, ortam değişkeni veya önkoşul deploy'ları listele. Yoksa 'Yok' yaz.",
  },
  {
    id: "features",
    heading: "🚀 Features / Business Value",
    instruction:
      "Kullanıcıya değer katan yeni özellikleri iş değeri odağıyla yaz. Önce kısa bir özet, sonra alan başlıklarına göre gruplanmış detaylı maddeler. PR/commit referanslarını parantez içinde ekle.",
  },
  {
    id: "bugfixes",
    heading: "🐞 Bug Fixes",
    instruction:
      "Düzeltilen hataları alanlara (Fatura, Rapor, UI, vb.) göre gruplayarak madde madde yaz. Her madde ne düzeldiğini net anlatsın.",
  },
  {
    id: "backend",
    heading: "🛠️ Backend Changes",
    instruction:
      "Backend repolarındaki teknik değişiklikleri (API, migration, servis, performans, refactor) geliştirici odağıyla özetle.",
  },
  {
    id: "frontend",
    heading: "💻 Frontend Changes",
    instruction:
      "Frontend repolarındaki değişiklikleri (yeni bileşenler, UI/UX, refactor, lokalizasyon) özetle.",
  },
  {
    id: "operational",
    heading: "⚡ Operational Checklist",
    instruction:
      "Deploy için PRE/POST aşamalı operasyonel kontrol listesi üret (manifest güncelle, DB backup al, seed version arttır vb.). Tablo biçiminde Phase | Task | Status | Notes sütunlarıyla yaz; Status alanını 'Başlatılmadı' bırak.",
  },
  {
    id: "rollback",
    heading: "⚠️ Incident Response / Rollback",
    instruction:
      "Bir tetikleyici (TRIGGER), aksiyon (ACTION) ve tahmini süre (ETA) ile geri dönüş planı yaz. Örn. Sentry'de artan 500 hataları → eski sürüme dön → < 120 sn.",
  },
  {
    id: "monitoring",
    heading: "📊 Monitoring",
    instruction:
      "Deploy sonrası izlenecek noktaları listele: Sentry, Grafana, live logs, smoke test, business sign-off. Placeholder link/checkbox bırak.",
  },
];
