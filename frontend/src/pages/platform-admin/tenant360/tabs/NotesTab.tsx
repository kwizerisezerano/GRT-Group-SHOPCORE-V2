import { MessageSquareText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "../tenant360Utils";
import {
  DataList,
  RowCard,
  Section,
} from "../components/Tenant360Primitives";

export function NotesTab({
  note,
  setNote,
  data,
  busy,
  addNote,
}: {
  note: string;
  setNote: (value: string) => void;
  data: any;
  busy: boolean;
  addNote: () => void;
}) {
  return (
    <Section
      title="Internal Notes"
      icon={<MessageSquareText className="h-5 w-5" />}
    >
      <div className="space-y-4">
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Add an internal note for this workspace..."
          className="min-h-28 w-full rounded-2xl border border-slate-200 bg-white p-4 text-sm font-medium outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
        />

        <div className="flex justify-end">
          <Button
            className="rounded-xl bg-blue-700 font-black hover:bg-blue-800"
            disabled={busy || !note.trim()}
            onClick={addNote}
          >
            Save Note
          </Button>
        </div>

        <DataList
          items={data?.notes ?? []}
          empty="No internal notes recorded yet."
          render={(item: any) => (
            <RowCard key={item.id}>
              <div>
                <p className="text-sm font-bold leading-6 text-slate-700">
                  {item.note}
                </p>

                <p className="mt-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                  {item.category} · {formatDateTime(item.created_at)}
                </p>
              </div>
            </RowCard>
          )}
        />
      </div>
    </Section>
  );
}