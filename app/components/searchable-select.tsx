"use client";

import { useEffect, useRef, useState } from "react";

export type SearchableOption = { value: string; label: string };

type SearchableSelectProps = {
  value: string;
  options: SearchableOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
  allowCustom?: boolean;
  placeholder?: string;
};

export function SearchableSelect({
  value,
  options,
  onChange,
  ariaLabel,
  className = "",
  allowCustom = false,
  placeholder = "Select...",
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value)?.label ?? value;
  const normalizedQuery = query.trim();
  const filtered = options.filter((option) => option.label.toLowerCase().includes(query.toLowerCase()));
  const exactMatch = options.some((option) => option.label.toLowerCase() === normalizedQuery.toLowerCase() || option.value.toLowerCase() === normalizedQuery.toLowerCase());
  const showCustomOption = allowCustom && normalizedQuery.length > 0 && !exactMatch;

  function commitCustom(nextValue: string) {
    const trimmed = nextValue.trim();
    if (!trimmed) return;
    onChange(trimmed);
    setOpen(false);
    setQuery("");
  }

  useEffect(() => {
    if (!open) return;
    function handleOutside(event: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        if (allowCustom && normalizedQuery) commitCustom(normalizedQuery);
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [allowCustom, normalizedQuery, open]);

  return (
    <div ref={wrapRef} className={`searchable-select ${className}`.trim()}>
      <button
        type="button"
        className="searchable-select-trigger"
        onClick={() => {
          setOpen((current) => !current);
          setQuery("");
        }}
        aria-label={ariaLabel}
        aria-expanded={open}
      >
        {selected || placeholder}
        <span>⌄</span>
      </button>
      {open && (
        <div className="searchable-select-menu">
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setOpen(false);
                setQuery("");
              } else if (event.key === "Enter") {
                event.preventDefault();
                if (filtered.length === 1) {
                  onChange(filtered[0].value);
                  setOpen(false);
                  setQuery("");
                } else if (showCustomOption) {
                  commitCustom(normalizedQuery);
                } else if (filtered.length > 0) {
                  onChange(filtered[0].value);
                  setOpen(false);
                  setQuery("");
                }
              }
            }}
            placeholder="Search or type..."
            aria-label={`Search ${ariaLabel}`}
          />
          {filtered.length || showCustomOption ? (
            <div className="searchable-select-options">
              {filtered.map((option) => (
                <button
                  type="button"
                  key={option.value}
                  className={option.value === value ? "selected" : ""}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  {option.label}
                </button>
              ))}
              {showCustomOption && (
                <button type="button" className="searchable-select-custom" onClick={() => commitCustom(normalizedQuery)}>
                  Use &quot;{normalizedQuery}&quot;
                </button>
              )}
            </div>
          ) : (
            <small className="searchable-select-empty">No matches</small>
          )}
        </div>
      )}
    </div>
  );
}
