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
    queryFn: getUserPreferences,
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
      return { key, previous };
    },
    onError: (error, _patch, rollback) => {
      if (rollback) {
        if (rollback.previous) {
          queryClient.setQueryData(rollback.key, rollback.previous);
        } else {
          queryClient.removeQueries({ queryKey: rollback.key, exact: true });
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
