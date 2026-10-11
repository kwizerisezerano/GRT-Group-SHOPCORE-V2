import { Users } from "lucide-react";
import { PlatformStatusBadge } from "@/pages/platform-admin/components/PlatformStatusBadge";
import {
  DataList,
  RowCard,
  Section,
} from "../components/Tenant360Primitives";

export function PeopleTab({ data }: { data: any }) {
  return (
    <Section title="People & Roles" icon={<Users className="h-5 w-5" />}>
      <DataList
        items={data?.members ?? []}
        empty="No users found for this workspace."
        render={(member: any) => (
          <RowCard key={member.id || member.user_id}>
            <div>
              <p className="font-black text-slate-950">
                {member.email ||
                  member.full_name ||
                  member.user_id ||
                  "Workspace user"}
              </p>
              <p className="mt-1 text-xs font-bold text-slate-500">
                Role: {member.role || "member"} · Status:{" "}
                {member.status || "active"}
              </p>
            </div>

            <PlatformStatusBadge status={member.role || "member"} />
          </RowCard>
        )}
      />
    </Section>
  );
}