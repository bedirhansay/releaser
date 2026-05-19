import { HistoryList } from "@/features/releases/components/history-list";

export default function HistoryPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
      <div>
        <span className="eyebrow text-muted-foreground">Geçmiş</span>
        <h1 className="mt-2 text-3xl font-medium tracking-[-0.02em]">
          Üretilen{" "}
          <span className="font-serif italic text-primary">
            release&apos;ler
          </span>
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Şimdiye kadar ürettiğin tüm release&apos;ler burada. Aramak için
          yazmaya başla; satıra tıklayınca detay açılır, &ldquo;…&rdquo;
          menüsünden silebilirsin.
        </p>
      </div>

      <HistoryList />
    </div>
  );
}
