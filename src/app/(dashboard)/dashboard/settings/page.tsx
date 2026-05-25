import { AiSettingsForm } from "@/features/settings/components/ai-settings-form";
import { GitHubAppCard } from "@/features/github-app/components/github-app-card";

export default function SettingsPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <div>
        <span className="eyebrow text-muted-foreground">Ayarlar</span>
        <h1 className="mt-2 text-3xl font-medium tracking-[-0.02em]">
          Hesap{" "}
          <span className="font-serif italic text-primary">ayarların</span>
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          AI sağlayıcını buradan yönetebilirsin. Kendi anahtarını girersen
          üretimler senin endpoint&apos;ine gider — verin paylaşımlı bir modele
          değil, senin seçtiğin yere ulaşır.
        </p>
      </div>

      <GitHubAppCard />
      <AiSettingsForm />
    </div>
  );
}
