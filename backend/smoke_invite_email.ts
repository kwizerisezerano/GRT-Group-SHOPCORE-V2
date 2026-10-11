/**
 * Checks what a newly created member actually receives.
 *
 * The requirement is that the invitation carries four things: a sign-in
 * link, the address to sign in with, the role they were given, and a
 * system-generated password. The password is deliberately unreachable from
 * anywhere but the outbound message, so the message itself is what gets
 * asserted — captured in memory rather than sent.
 *
 * Run with:  npx tsx smoke_invite_email.ts
 */
import crypto from "node:crypto";
import { prisma } from "./src/db/prisma";
import { MemoryTransport, setTransport } from "./src/lib/email/transport";
import { createMemberWithGeneratedPassword } from "./src/modules/users/users.service";

let failures = 0;

function check(label: string, condition: boolean, detail?: unknown) {
  if (condition) {
    console.log(`  ok    ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${label}`, detail === undefined ? "" : String(detail));
  }
}

async function main() {
  const mailbox = new MemoryTransport();
  setTransport(mailbox);

  const tenant = await prisma.tenant.findFirst({ select: { id: true, name: true } });
  if (!tenant) throw new Error("No tenant in the database to test against.");

  const owner = await prisma.tenantMember.findFirst({
    where: { tenantId: tenant.id },
    select: { userId: true },
  });
  if (!owner) throw new Error("Tenant has no members to attribute the action to.");

  const email = `invite.${crypto.randomUUID().slice(0, 8)}@example.test`;
  console.log(`\nWorkspace: ${tenant.name}\nMember:    ${email}\n`);

  const created = await createMemberWithGeneratedPassword({
    tenantId: tenant.id,
    email,
    displayName: "Invite Test",
    role: "inventory_officer",
    department: "Operations",
    branchId: null,
    invitedByUserId: owner.userId,
    language: "en",
  });

  try {
    // The email send is fire-and-forget, so give the microtask a turn.
    await new Promise((resolve) => setTimeout(resolve, 50));

    check("exactly one email was produced", mailbox.sent.length === 1, mailbox.sent.length);
    const message = mailbox.sent[0];
    check("addressed to the new member", message?.to === email, message?.to);

    const body = `${message?.text ?? ""}\n${message?.html ?? ""}`;

    check("names the workspace", body.includes(tenant.name));
    check("states the sign-in address", body.includes(email));
    check("states the role in readable form", body.includes("Inventory Officer"), body.slice(0, 200));
    check("carries a sign-in link", /https?:\/\/[^\s"]+\/auth/.test(body));
    check(
      "carries a generated password that is not a placeholder",
      /temporary password ([^\s.]{12,})/.test(message?.text ?? ""),
      message?.text?.match(/temporary password ([^\s.]+)/)?.[1]
    );
    check("warns that the password must be changed", /choose a new password/i.test(body));
    check("mentions the one-time code step", /one-time code/i.test(body));

    // The password must not be readable anywhere but this message.
    const stored = await prisma.user.findUnique({
      where: { id: created.userId },
      select: { passwordHash: true, metadata: true },
    });
    const sentPassword = message?.text?.match(/temporary password ([^\s.]+)/)?.[1] ?? "";
    check("password is stored only as a hash", !stored?.passwordHash.includes(sentPassword));
    check(
      "account is flagged to change it on first sign-in",
      (stored?.metadata as any)?.mustChangePassword === true
    );
    check("the API response carries no credential", !JSON.stringify(created).includes(sentPassword));
  } finally {
    await prisma.user.delete({ where: { id: created.userId } }).catch(() => {});
  }

  console.log(failures === 0 ? "\nAll checks passed.\n" : `\n${failures} check(s) failed.\n`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
