"use client";

import Image from "next/image";
import { useId, useState, type ChangeEvent } from "react";

const acceptedImageTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const maximumImageSize = 8 * 1024 * 1024;

export function ImageAssetEditor({
  error,
  fallback,
  label,
  onRemove,
  onUpload,
  pending = false,
  url,
  variant,
}: {
  error?: string;
  fallback: string;
  label: string;
  onRemove: () => void;
  onUpload: (file: File) => void;
  pending?: boolean;
  url: string | null;
  variant: "profile" | "logo" | "banner";
}) {
  const inputId = useId();
  const [fileError, setFileError] = useState("");

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    setFileError("");
    if (!file) return;
    if (!acceptedImageTypes.has(file.type)) {
      setFileError("Choose a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > maximumImageSize) {
      setFileError("The image must be 8 MB or smaller.");
      return;
    }
    onUpload(file);
  }

  return (
    <div className={`image-asset-editor is-${variant}`}>
      <div className="image-asset-preview">
        {url ? (
          <Image
            alt={`${label} preview`}
            height={variant === "banner" ? 360 : 128}
            src={url}
            unoptimized
            width={variant === "banner" ? 1200 : 128}
          />
        ) : (
          <span aria-hidden="true">{fallback}</span>
        )}
      </div>
      <div className="image-asset-details">
        <div>
          <strong>{label}</strong>
          <p>JPEG, PNG, or WebP · 8 MB maximum</p>
        </div>
        <div className="image-asset-actions">
          <label
            className="button button-secondary image-asset-upload"
            htmlFor={inputId}
          >
            {pending ? "Uploading…" : url ? "Replace image" : "Upload image"}
            <input
              accept="image/jpeg,image/png,image/webp"
              disabled={pending}
              id={inputId}
              onChange={chooseFile}
              type="file"
            />
          </label>
          {url && (
            <button
              className="button button-secondary image-asset-remove"
              disabled={pending}
              onClick={onRemove}
              type="button"
            >
              Remove
            </button>
          )}
        </div>
        {(fileError || error) && (
          <p className="image-asset-error" role="alert">
            {fileError || error}
          </p>
        )}
      </div>
    </div>
  );
}
