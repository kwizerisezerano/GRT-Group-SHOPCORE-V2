import { prisma } from './src/db/prisma';

async function main() {
  const logs = await prisma.paymentLog.findMany({
    where: { transactionId: 'a6266e66-5d2f-4e42-a21d-9da3d46f6126' },
    orderBy: { createdAt: 'asc' }
  });
  console.log(JSON.stringify(logs, null, 2));
}
main().catch(console.error).finally(() => process.exit(0));
