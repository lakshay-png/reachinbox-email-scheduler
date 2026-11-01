import { PrismaClient } from "@prisma/client";


const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.upsert({
    where: {
      googleId: "dev-google-user",
    },

    update: {},

    create: {
      googleId: "dev-google-user",
      name: "Development User",
      email: "dev@reachinbox.local",
    },
  });

  const sender = await prisma.sender.upsert({
    where: {
      userId_email: {
        userId: user.id,
        email: "demo-sender@reachinbox.local",
      },
    },

    update: {},

    create: {
      email: "demo-sender@reachinbox.local",
      displayName: "Demo Sender",
      hourlyLimit: 200,
      minDelayMs: 2000,
      userId: user.id,
    },
  });

  console.log("Development user created/reused.");
  console.log("Sender ID:", sender.id);
  console.log("Sender email:", sender.email);
}

main()
  .catch(async (error) => {
    console.error("Seed failed:", error);
    throw error;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });