"use client";

import { useCallback, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getUserPreferences,
  updateUserPreferences,
  type UserPreferences,
  type UserPreferencesUpdate,
} from "@/lib/api";
import { useToast } from "@/app/components/toast-provider";

type PreferenceSave = {
  userId: string;
  patch: UserPreferencesUpdate;
  revision: number;
  isPendingSync?: boolean;
};

const preferenceSaveQueues = new Map<string, Promise<unknown>>();
const pendingPreferenceSyncs = new Set<string>();
const preferenceRevisions = new Map<string, number>();

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  theme: "system",
  sidebar_collapsed: false,
  search: { providers: null, tavily: null },
};

const LOCAL_PREFERENCE_CACHE_PREFIX = "user-preferences:v1";

export function userPreferencesQueryKey(userId: string) {
  return ["user-preferences", userId] as const;
}

export function useUserPreferences(userId: string | undefined) {
  const queryClient = useQueryClient();
  const showToast = useToast();
  const queryKey = userId
    ? userPreferencesQueryKey(userId)
    : ["user-preferences", "signed-out"];
  const query = useQuery({
    queryKey,
    queryFn: async () => {
      if (userId) {
        const pending = readPendingLocalPreferences(userId);
        if (pending) {
          return readLocalPreferences(userId) ?? pending;
        }
      }

      const preferences = await getUserPreferences();
      if (userId) {
        const pending = readPendingLocalPreferences(userId);
        if (pending) {
          return readLocalPreferences(userId) ?? pending;
        }
        writeLocalPreferences(userId, preferences);
      }
      return preferences;
    },
    initialData: userId ? () => readLocalPreferences(userId) : undefined,
    staleTime: 0,
    enabled: Boolean(userId),
    retry: false,
  });
  const mutation = useMutation({
    mutationFn: ({ userId: saveUserId, patch }: PreferenceSave) =>
      saveUserPreferencesInOrder(saveUserId, patch),
    onSuccess: (preferences, variables) => {
      if (
        preferenceRevisions.get(variables.userId) !== variables.revision
      ) {
        return;
      }
      queryClient.setQueryData(
        userPreferencesQueryKey(variables.userId),
        preferences,
      );
      writeLocalPreferences(variables.userId, preferences);
      clearPendingLocalPreferences(variables.userId);
      preferenceRevisions.delete(variables.userId);
    },
    onError: (error: Error) => {
      showToast({
        type: "warning",
        title: "Preferences saved on this device",
        message: `Cloud sync failed: ${error.message}. Your changes are still available locally and will be retried when you're back online.`,
      });
    },
    onSettled: (_data, _error, variables) => {
      if (variables.isPendingSync) {
        pendingPreferenceSyncs.delete(variables.userId);
      }
    },
  });
  const mutate = mutation.mutate;
  const enqueueSave = useCallback(
    (patch: UserPreferencesUpdate, isPendingSync = false) => {
      if (!userId) return;
      const revision = (preferenceRevisions.get(userId) ?? 0) + 1;
      preferenceRevisions.set(userId, revision);
      const key = userPreferencesQueryKey(userId);
      const current =
        queryClient.getQueryData<UserPreferences>(key) ??
        readLocalPreferences(userId) ??
        DEFAULT_USER_PREFERENCES;
      const optimistic = mergeUserPreferences(current, patch);
      const patchToSync = readPendingLocalPreferences(userId)
        ? optimistic
        : patch;
      queryClient.setQueryData(key, optimistic);
      writeLocalPreferences(userId, optimistic);
      writePendingLocalPreferences(userId, optimistic);
      mutate({
        userId,
        patch: patchToSync,
        revision,
        isPendingSync,
      });
    },
    [mutate, queryClient, userId],
  );
  const save = useCallback(
    (patch: UserPreferencesUpdate) => enqueueSave(patch),
    [enqueueSave],
  );
  const retryPendingSync = useCallback(() => {
    if (!userId || pendingPreferenceSyncs.has(userId)) return;
    if (preferenceSaveQueues.has(userId)) return;
    const pending = readPendingLocalPreferences(userId);
    if (!pending) return;
    pendingPreferenceSyncs.add(userId);
    enqueueSave(pending, true);
  }, [enqueueSave, userId]);

  useEffect(() => {
    if (!userId) return;
    retryPendingSync();
    window.addEventListener("online", retryPendingSync);
    window.addEventListener("focus", retryPendingSync);
    return () => {
      window.removeEventListener("online", retryPendingSync);
      window.removeEventListener("focus", retryPendingSync);
    };
  }, [retryPendingSync, userId]);

  return { ...query, save, saveMutation: mutation };
}

function localPreferencesKey(userId: string): string {
  return `${LOCAL_PREFERENCE_CACHE_PREFIX}:${userId}`;
}

function pendingLocalPreferencesKey(userId: string): string {
  return `${LOCAL_PREFERENCE_CACHE_PREFIX}:pending:${userId}`;
}

function readLocalPreferences(userId: string): UserPreferences | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const stored = window.localStorage.getItem(localPreferencesKey(userId));
    if (!stored) return undefined;
    const value: unknown = JSON.parse(stored);
    return isUserPreferences(value) ? value : undefined;
  } catch (error) {
    console.error("Could not read locally cached user preferences.", error);
    return undefined;
  }
}

function readPendingLocalPreferences(
  userId: string,
): UserPreferences | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const stored = window.localStorage.getItem(
      pendingLocalPreferencesKey(userId),
    );
    if (!stored) return undefined;
    const value: unknown = JSON.parse(stored);
    return isUserPreferences(value) ? value : undefined;
  } catch (error) {
    console.error("Could not read pending user preference changes.", error);
    return undefined;
  }
}

function writeLocalPreferences(
  userId: string,
  preferences: UserPreferences,
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      localPreferencesKey(userId),
      JSON.stringify(preferences),
    );
  } catch (error) {
    console.error("Could not cache user preferences locally.", error);
  }
}

function writePendingLocalPreferences(
  userId: string,
  preferences: UserPreferences,
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      pendingLocalPreferencesKey(userId),
      JSON.stringify(preferences),
    );
  } catch (error) {
    console.error("Could not cache pending user preference changes.", error);
  }
}

function clearPendingLocalPreferences(userId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(pendingLocalPreferencesKey(userId));
  } catch (error) {
    console.error("Could not clear synced user preference changes.", error);
  }
}

function isUserPreferences(value: unknown): value is UserPreferences {
  if (!isRecord(value) || !isRecord(value.search)) return false;
  const { theme, sidebar_collapsed, search } = value;
  const validProviders =
    search.providers === null ||
    (Array.isArray(search.providers) &&
      search.providers.every(
        (provider) => provider === "tavily" || provider === "octoparse",
      ));
  return (
    (theme === "light" || theme === "dark" || theme === "system") &&
    typeof sidebar_collapsed === "boolean" &&
    validProviders &&
    (search.tavily === null || isRecord(search.tavily))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function saveUserPreferencesInOrder(
  userId: string,
  patch: UserPreferencesUpdate,
): Promise<UserPreferences> {
  const previous = preferenceSaveQueues.get(userId) ?? Promise.resolve();
  const request = previous
    .catch(() => undefined)
    .then(() => updateUserPreferences(patch));
  preferenceSaveQueues.set(userId, request);
  const clearQueue = () => {
    if (preferenceSaveQueues.get(userId) === request) {
      preferenceSaveQueues.delete(userId);
    }
  };
  void request.then(clearQueue, clearQueue);
  return request;
}

export function mergeUserPreferences(
  current: UserPreferences,
  patch: UserPreferencesUpdate,
): UserPreferences {
  const merged: UserPreferences = {
    ...current,
    ...patch,
    search: {
      ...current.search,
      ...patch.search,
    },
  };
  if (patch.search?.tavily) {
    merged.search.tavily = {
      ...(current.search.tavily ?? {}),
      ...patch.search.tavily,
    };
  }
  return merged;
}
