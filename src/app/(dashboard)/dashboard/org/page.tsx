import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { MembersManager } from "@/features/org/components/members-manager";
import { GroupsManager } from "@/features/org/components/groups-manager";

// Org administration — members + groups. Admins/owners only.
export default async function OrgPage() {
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user?.id) redirect("/login");
  if (role !== "OWNER" && role !== "ADMIN") redirect("/dashboard");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-10">
      <div>
        <span className="eyebrow text-muted-foreground">Organizasyon</span>
        <h1 className="mt-2 text-3xl font-medium tracking-[-0.02em]">
          Takım{" "}
          <span className="font-serif italic text-primary">yönetimi</span>
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Üyeleri ekle, rollerini belirle, grupla. Projelere erişimi grup ya da
          kişi bazında proje düzenleme ekranından verirsin.
        </p>
      </div>

      <MembersManager />
      <GroupsManager />
    </div>
  );
}
