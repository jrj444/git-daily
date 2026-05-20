import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEFAULT_TEMPLATE = `# {{date}} 日报

{{#each projects}}
## {{name}}
{{#each commits}}
- {{message}}
{{/each}}

{{/each}}
{{#unless projects.length}}
（今日无提交记录）
{{/unless}}`;

async function main() {
  const username = process.env.ADMIN_USERNAME || "admin";
  const password = process.env.ADMIN_PASSWORD || "admin12345";
  const displayName = process.env.ADMIN_DISPLAY_NAME || "Admin";

  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await prisma.user.upsert({
    where: { username },
    update: {},
    create: {
      username,
      passwordHash,
      displayName,
      role: "ADMIN",
    },
  });

  // give admin a default template if none
  const existing = await prisma.template.findFirst({
    where: { userId: admin.id, isDefault: true },
  });
  if (!existing) {
    await prisma.template.create({
      data: {
        userId: admin.id,
        name: "默认模板",
        body: DEFAULT_TEMPLATE,
        isDefault: true,
      },
    });
  }

  console.log(`Seed complete. Admin user: ${username}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
