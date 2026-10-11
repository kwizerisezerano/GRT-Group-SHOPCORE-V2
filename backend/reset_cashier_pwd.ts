import { prisma } from "./src/db/prisma";
import { emailBlindIndex } from "./src/lib/crypto";
import { hashPassword } from "./src/lib/password";

async function main() {
  const email = "globaltech@gmail.com";
  const newPassword = "Password123!";
  
  const user = await prisma.user.findUnique({
    where: { emailHash: emailBlindIndex(email) }
  });

  if (!user) {
    console.log("Cashier user not found!");
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(newPassword) }
  });

  console.log("Successfully reset Cashier password!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
