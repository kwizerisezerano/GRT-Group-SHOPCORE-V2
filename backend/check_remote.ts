import { fetchRemoteStatus } from './src/lib/payments/lmbtech';
import { applyPaymentResult } from './src/lib/payments/service';
import { prisma } from './src/db/prisma';

async function main() {
  const transaction = await prisma.paymentTransaction.findUnique({
    where: { id: '51f432d6-d233-4f66-90f2-f89cf8f4d994' }
  });
  
  if (!transaction) throw new Error('Transaction not found');

  const remote = await fetchRemoteStatus(transaction.referenceId, {
    tenantId: transaction.tenantId,
    transactionId: transaction.id
  });
  
  console.log('Remote status:', remote);

  if (remote && remote.status !== 'pending') {
    await applyPaymentResult(transaction.referenceId, {
      status: remote.status,
      providerTxnId: remote.providerTxnId,
      message: remote.message,
      source: 'poll'
    });
    console.log('Applied payment result');
  }
}
main().catch(console.error).finally(() => process.exit(0));
