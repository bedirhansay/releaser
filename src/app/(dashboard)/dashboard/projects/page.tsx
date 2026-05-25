import { ProjectsList } from "@/features/projects/components/projects-list";

export default function ProjectsPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
      <div>
        <span className="eyebrow text-muted-foreground">Projeler</span>
        <h1 className="mt-2 text-3xl font-medium tracking-[-0.02em]">
          Projelerin{" "}
          <span className="font-serif italic text-primary">burada</span>
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Bir proje birden fazla repo&apos;yu (örneğin backend + frontend) tek
          bir release altında toplar. Buradan proje oluştur, repo&apos;larını
          düzenle ve tek seferde hepsini kapsayan release notları üret.
        </p>
      </div>

      <ProjectsList />
    </div>
  );
}
