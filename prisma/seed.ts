import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

// Bootstraps a fresh database: one default Organization + a superadmin (OWNER)
// who logs in with email/password. Idempotent — safe to run repeatedly and
// from `prisma migrate reset`.

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" });
const prisma = new PrismaClient({ adapter });

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function main() {
  const email = process.env.SUPERADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SUPERADMIN_PASSWORD;
  const orgName = process.env.ORG_NAME?.trim() || "Mersel";

  if (!email || !password) {
    throw new Error(
      "SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD must be set to seed the superadmin.",
    );
  }

  const slug = slugify(orgName) || "org";
  const org = await prisma.organization.upsert({
    where: { slug },
    update: { name: orgName },
    create: { name: orgName, slug },
  });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash },
    create: { email, name: "Super Admin", passwordHash },
  });

  await prisma.membership.upsert({
    where: { userId_orgId: { userId: user.id, orgId: org.id } },
    update: { role: "OWNER" },
    create: { userId: user.id, orgId: org.id, role: "OWNER" },
  });

  console.log(
    `✓ Seeded org "${org.name}" (${org.slug}) + superadmin <${email}> as OWNER.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
