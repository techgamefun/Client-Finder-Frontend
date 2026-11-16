"use client";

import { useState, type KeyboardEvent } from "react";

interface DomainChipInputProps {
  label: string;
  domains: string[];
  onChange: (domains: string[]) => void;
  placeholder: string;
  maxDomains: number;
}

export function DomainChipInput({
  label,
  domains,
  onChange,
  placeholder,
  maxDomains,
}: DomainChipInputProps) {
  const [draft, setDraft] = useState("");

  function addDraft() {
    const additions = draft
      .split(",")
      .map((domain) => domain.trim().toLowerCase())
      .filter(Boolean);
    if (additions.length > 0) {
      onChange([...new Set([...domains, ...additions])].slice(0, maxDomains));
      setDraft("");
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addDraft();
    }
    if (event.key === "Backspace" && !draft && domains.length > 0) {
      onChange(domains.slice(0, -1));
    }
  }

  return (
    <div className="domain-chip-field">
      <label>{label}</label>
      <div className="domain-chip-control">
        <div className="domain-chip-list">
          {domains.map((domain) => (
            <span className="domain-chip" key={domain}>
              {domain}
              <button
                aria-label={`Remove ${domain}`}
                onClick={() =>
                  onChange(domains.filter((item) => item !== domain))
                }
                type="button"
              >
                ×
              </button>
            </span>
          ))}
          <input
            aria-label={`${label} domain`}
            maxLength={255}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={domains.length >= maxDomains ? "Domain limit reached" : placeholder}
            value={draft}
          />
        </div>
        <button
          className="domain-chip-add"
          disabled={!draft.trim() || domains.length >= maxDomains}
          onClick={addDraft}
          type="button"
        >
          Add
        </button>
      </div>
      <span className="domain-chip-help">
        Enter or comma to add · {domains.length}/{maxDomains}
      </span>
    </div>
  );
}
