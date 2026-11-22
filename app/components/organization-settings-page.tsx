"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deleteOrganizationImage,
  getAuthSession,
  updateOrganizationDescription,
  uploadOrganizationImage,
  type AuthSession,
  type OrganizationImageAsset,
} from "@/lib/api";
import { ImageAssetEditor } from "./image-asset-editor";
import { PageLoading } from "./page-loading";

export function OrganizationSettingsPage() {
  const sessionQuery = useQuery({
    queryKey: ["auth-session"],
    queryFn: getAuthSession,
    retry: false,
  });

  if (sessionQuery.isLoading) {
    return (
      <PageLoading
        label="Loading organization settings"
        variant="organization-settings"
      />
    );
  }
  if (sessionQuery.isError) {
    return (
      <p className="alert alert-error" role="alert">
        Could not load organization settings: {sessionQuery.error.message}
      </p>
    );
  }
  if (!sessionQuery.data) {
    return (
      <PageLoading
        label="Loading organization settings"
        variant="organization-settings"
      />
    );
  }
  if (sessionQuery.data.user.role !== "admin") {
    return (
      <section className="panel organization-access-panel" role="alert">
        <h1>Organization settings restricted</h1>
        <p>Only organization administrators can manage these settings.</p>
      </section>
    );
  }

  return <OrganizationSettingsForm session={sessionQuery.data} />;
}

function OrganizationSettingsForm({ session }: { session: AuthSession }) {
  const queryClient = useQueryClient();
  const [description, setDescription] = useState(
    session.organization_description ?? "",
  );
  const [lastEditedAsset, setLastEditedAsset] =
    useState<OrganizationImageAsset | null>(null);
  const imageMutation = useMutation<
    { url: string } | void,
    Error,
    { asset: OrganizationImageAsset; file: File | null }
  >({
    mutationFn: ({ asset, file }) =>
      file
        ? uploadOrganizationImage(asset, file)
        : deleteOrganizationImage(asset),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["auth-session"] });
    },
  });
  const descriptionMutation = useMutation({
    mutationFn: updateOrganizationDescription,
    onSuccess: async (result) => {
      setDescription(result.description ?? "");
      await queryClient.invalidateQueries({ queryKey: ["auth-session"] });
    },
  });
  const imageError = imageMutation.isError
    ? imageMutation.error.message
    : undefined;
  const currentDescription = session.organization_description ?? "";
  const hasDescriptionChanged = description.trim() !== currentDescription;

  function uploadImage(asset: OrganizationImageAsset, file: File) {
    setLastEditedAsset(asset);
    imageMutation.mutate({ asset, file });
  }

  function removeImage(asset: OrganizationImageAsset) {
    setLastEditedAsset(asset);
    imageMutation.mutate({ asset, file: null });
  }

  return (
    <div className="organization-settings-page">
      <header className="organization-settings-heading">
        <p className="eyebrow">ADMINISTRATION</p>
        <h1>Organization settings</h1>
        <p className="heading-copy">
          Manage your organization description and workspace branding.
        </p>
      </header>

      <section
        aria-labelledby="organization-branding-heading"
        className="panel organization-settings-panel"
      >
        <header className="organization-settings-section-heading">
          <div>
            <h2 id="organization-branding-heading">Organization branding</h2>
            <p>Images appear on your organization workspace.</p>
          </div>
        </header>
        <ImageAssetEditor
          error={lastEditedAsset === "banner" ? imageError : undefined}
          fallback="Banner preview"
          label="Organization banner"
          onRemove={() => removeImage("banner")}
          onUpload={(file) => uploadImage("banner", file)}
          pending={imageMutation.isPending}
          url={session.organization_banner_url}
          variant="banner"
        />
        <div className="organization-settings-logo">
          <ImageAssetEditor
            error={lastEditedAsset === "logo" ? imageError : undefined}
            fallback={session.organization_name.slice(0, 1).toUpperCase()}
            label="Organization logo"
            onRemove={() => removeImage("logo")}
            onUpload={(file) => uploadImage("logo", file)}
            pending={imageMutation.isPending}
            url={session.organization_logo_url}
            variant="logo"
          />
        </div>
      </section>

      <section
        aria-labelledby="organization-description-heading"
        className="panel organization-settings-panel"
      >
        <header className="organization-settings-section-heading">
          <div>
            <h2 id="organization-description-heading">Description</h2>
            <p>Give members a short introduction to your organization.</p>
          </div>
        </header>
        <form
          className="organization-settings-description-form"
          onSubmit={(event) => {
            event.preventDefault();
            descriptionMutation.mutate(description.trim() || null);
          }}
        >
          <label htmlFor="organization-description">
            Organization description
          </label>
          <textarea
            id="organization-description"
            maxLength={1000}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Describe what your organization does"
            rows={4}
            value={description}
          />
          <div className="organization-settings-description-footer">
            <span>{description.length}/1000</span>
            <div>
              <button
                className="button button-secondary"
                disabled={
                  descriptionMutation.isPending || !hasDescriptionChanged
                }
                onClick={() => {
                  setDescription(currentDescription);
                  descriptionMutation.reset();
                }}
                type="button"
              >
                Reset
              </button>
              <button
                className="button button-primary"
                disabled={
                  descriptionMutation.isPending || !hasDescriptionChanged
                }
                type="submit"
              >
                {descriptionMutation.isPending ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
          {descriptionMutation.isError && (
            <p className="alert alert-error" role="alert">
              Could not save description: {descriptionMutation.error.message}
            </p>
          )}
        </form>
      </section>
    </div>
  );
}
