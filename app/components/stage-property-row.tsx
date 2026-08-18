"use client";

import {
  isMultilinePropertyKind,
  isNumericPropertyKind,
  propertyKind,
  propertyKindAllowsCustom,
  propertyKindHasOptions,
  propertyValueOptions,
  rateLimitUnits,
  type PropertyPreset,
} from "@/lib/stage-properties";
import type { StageProperty } from "@/lib/local-canvas";
import { SearchableSelect } from "@/app/components/searchable-select";

const durationUnits = ["mins", "hours", "days"];
const currencies = ["USD", "EUR", "GBP", "INR"];

type StagePropertyRowProps = {
  property: StageProperty;
  onUpdate: (id: string, patch: Partial<StageProperty>) => void;
  onRemove: (id: string) => void;
};

export function StagePropertyRow({ property, onUpdate, onRemove }: StagePropertyRowProps) {
  const kind = propertyKind(property);
  const numericKind = isNumericPropertyKind(kind);
  const options = (propertyValueOptions[kind] ?? []).map((option) => ({ value: option, label: option }));
  const useCombobox = propertyKindHasOptions(kind);
  const allowCustom = propertyKindAllowsCustom(kind);
  const hasMeta = kind === "cost" || kind === "duration" || kind === "sla" || kind === "rate-limit" || kind === "timeout";

  return (
    <div className={`property-row property-${kind}`}>
      <div className="property-row-header">
        <input
          className="property-name-input"
          value={property.name}
          onChange={(event) => onUpdate(property.id, { name: event.target.value })}
          aria-label="Property name"
        />
        <button type="button" onClick={() => onRemove(property.id)} aria-label={`Remove ${property.name} property`}>
          ×
        </button>
      </div>
      <div className={`property-row-value${hasMeta ? " has-meta" : ""}`}>
        {isMultilinePropertyKind(kind) ? (
          <textarea
            className="property-value-textarea"
            value={property.value}
            onChange={(event) => onUpdate(property.id, { value: event.target.value })}
            placeholder="Add value"
            aria-label={`${property.name} value`}
            rows={3}
          />
        ) : useCombobox ? (
          <SearchableSelect
            className="property-value-select"
            value={property.value}
            options={options}
            onChange={(value) => onUpdate(property.id, { value })}
            ariaLabel={`${property.name} value`}
            allowCustom={allowCustom}
            placeholder="Select or type..."
          />
        ) : (
          <input
            className="property-value-input"
            type={numericKind ? "number" : "text"}
            min={numericKind ? "0" : undefined}
            step={kind === "cost" ? "1" : kind === "temperature" ? "0.1" : undefined}
            inputMode={numericKind ? "numeric" : undefined}
            value={property.value}
            onChange={(event) => onUpdate(property.id, { value: event.target.value })}
            placeholder={numericKind ? "0" : "Add value"}
            aria-label={`${property.name} value`}
          />
        )}
        {kind === "cost" && (
          <SearchableSelect
            className="property-meta-select"
            value={property.currency ?? "USD"}
            options={currencies.map((currency) => ({ value: currency, label: currency }))}
            onChange={(value) => onUpdate(property.id, { currency: value })}
            ariaLabel={`${property.name} currency`}
          />
        )}
        {(kind === "duration" || kind === "sla") && (
          <SearchableSelect
            className="property-meta-select"
            value={property.unit ?? (kind === "sla" ? "days" : "hours")}
            options={durationUnits.map((unit) => ({ value: unit, label: unit }))}
            onChange={(value) => onUpdate(property.id, { unit: value })}
            ariaLabel={`${property.name} unit`}
          />
        )}
        {kind === "rate-limit" && (
          <SearchableSelect
            className="property-meta-select"
            value={property.unit ?? "req/min"}
            options={rateLimitUnits.map((unit) => ({ value: unit, label: unit }))}
            onChange={(value) => onUpdate(property.id, { unit: value })}
            ariaLabel={`${property.name} unit`}
            allowCustom
          />
        )}
        {kind === "timeout" && (
          <SearchableSelect
            className="property-meta-select"
            value={property.unit ?? "mins"}
            options={durationUnits.map((unit) => ({ value: unit, label: unit }))}
            onChange={(value) => onUpdate(property.id, { unit: value })}
            ariaLabel={`${property.name} unit`}
          />
        )}
      </div>
    </div>
  );
}

export type { PropertyPreset };
