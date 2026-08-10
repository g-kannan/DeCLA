import type { DataflowSummary } from "@/lib/api";

type DataflowPickerProps = {
  dataflows: DataflowSummary[];
  activeId: string;
  onChange: (id: string) => void;
  hint?: string;
};

export function DataflowPicker({ dataflows, activeId, onChange, hint }: DataflowPickerProps) {
  return (
    <section className="project-card picker-card">
      <div className="project-heading">
        <label className="project-switcher">
          <span>Dataflow</span>
          <select value={activeId} onChange={(event) => onChange(event.target.value)} aria-label="Select dataflow">
            {dataflows.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        {hint && <span className="version-line">{hint}</span>}
      </div>
    </section>
  );
}
