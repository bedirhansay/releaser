import { auth } from "@/auth";
import { TemplatesList } from "@/features/templates/components/templates-list";

export default async function TemplatesPage() {
  const session = await auth();
  const isAdmin =
    session?.user?.role === "OWNER" || session?.user?.role === "ADMIN";
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
      <div>
        <span className="eyebrow text-muted-foreground">Şablonlar</span>
        <h1 className="mt-2 text-3xl font-medium tracking-[-0.02em]">
          Release{" "}
          <span className="font-serif italic text-primary">şablonların</span>
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          AI her release&apos;i bu yapıda üretir; bölümleri ve başlıkları sen
          belirlersin. Her bölüm için bir başlık ve AI&apos;a verilecek bir
          talimat tanımla.
        </p>
      </div>

      <TemplatesList isAdmin={isAdmin} />
    </div>
  );
}
