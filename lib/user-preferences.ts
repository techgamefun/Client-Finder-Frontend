"use client";

import { useCallback } from "react";
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
};

const preferenceSaveQueues = new Map<string, Promise<unknown>>();

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
      const preferences = await getUserPreferences();
      if (userId) writeLocalPreferences(userId, preferences);
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
    onMutate: async ({ userId: saveUserId, patch }) => {
      const key = userPreferencesQueryKey(saveUserId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<UserPreferences>(key);
      queryClient.setQueryData<UserPreferences>(
        key,
        mergeUserPreferences(previous ?? DEFAULT_USER_PREFERENCES, patch),
      );
      const optimistic = queryClient.getQueryData<UserPreferences>(key);
      if (optimistic) writeLocalPreferences(saveUserId, optimistic);
      return { key, previous };
    },
    onError: (error, _patch, rollback) => {
      if (rollback) {
        if (rollback.previous) {
          queryClient.setQueryData(rollback.key, rollback.previous);
          writeLocalPreferences(_patch.userId, rollback.previous);
        } else {
          queryClient.removeQueries({ queryKey: rollback.key, exact: true });
          removeLocalPreferences(_patch.userId);
        }
      }
      showToast({
        type: "error",
        title: "Could not save preferences",
        message: error.message,
      });
    },
    onSuccess: (preferences, variables) => {
      queryClient.setQueryData(
        userPreferencesQueryKey(variables.userId),
        preferences,
      );
      writeLocalPreferences(variables.userId, preferences);
    },
  });
  const mutate = mutation.mutate;
  const save = useCallback(
    (patch: UserPreferencesUpdate) => {
      if (userId) mutate({ userId, patch });
    },
    [mutate, userId],
  );

  return { ...query, save, saveMutation: mutation };
}

function localPreferencesKey(userId: string): string {
  return `${LOCAL_PREFERENCE_CACHE_PREFIX}:${userId}`;
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

function removeLocalPreferences(userId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(localPreferencesKey(userId));
  } catch (error) {
    console.error("Could not clear locally cached user preferences.", error);
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
