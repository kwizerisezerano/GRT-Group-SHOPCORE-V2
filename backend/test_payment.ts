import { startSubscriptionPayment } from './src/lib/payments/service';
import { prisma } from './src/db/prisma';

async function main() {
  console.log('Initializing test payment...');
  const tenant = await prisma.tenant.findFirst();
  if (!tenant) throw new Error('No tenant found');
  
  const user = await prisma.user.findFirst();

  const res = await startSubscriptionPayment({
    tenantId: tenant.id,
    userId: user?.id || null,
    planCode: 'basic',
    billingCycle: 'monthly',
    amount: 100,
    paymentMethodCode: 'momo', 
    payerPhone: '0791545579',
    email: 'yumvagusengapatrick14@gmail.com',
    name: 'Test User'
  });
  console.log('Payment started! Check your phone to cancel it.');
  console.log('The script will keep running in the background to listen for your cancellation.');
  
  // Keep process alive for 3 minutes so the unref'd poller can work
  await new Promise(resolve => setTimeout(resolve, 180000));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
