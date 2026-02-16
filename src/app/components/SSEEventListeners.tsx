import { useQueryClient } from "@tanstack/react-query";
import { type FC, type PropsWithChildren, useCallback, useRef } from "react";
import { projectDetailQuery, sessionDetailQuery } from "../../lib/api/queries";
import { useServerEventListener } from "../../lib/sse/hook/useServerEventListener";

const DEBOUNCE_MS = 500;

export const SSEEventListeners: FC<PropsWithChildren> = ({ children }) => {
  const queryClient = useQueryClient();
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const debouncedInvalidate = useCallback(
    (key: string, invalidateFn: () => Promise<void>) => {
      const existing = timersRef.current.get(key);
      if (existing) {
        clearTimeout(existing);
      }
      timersRef.current.set(
        key,
        setTimeout(() => {
          timersRef.current.delete(key);
          invalidateFn();
        }, DEBOUNCE_MS),
      );
    },
    [],
  );

  useServerEventListener("sessionListChanged", async (event) => {
    debouncedInvalidate(`sessionList:${event.projectId}`, () =>
      queryClient.invalidateQueries({
        queryKey: projectDetailQuery(event.projectId).queryKey,
      }),
    );
  });

  useServerEventListener("sessionChanged", async (event) => {
    debouncedInvalidate(`session:${event.projectId}:${event.sessionId}`, () =>
      queryClient.invalidateQueries({
        queryKey: sessionDetailQuery(event.projectId, event.sessionId).queryKey,
      }),
    );
  });

  useServerEventListener("agentSessionChanged", async (event) => {
    debouncedInvalidate(`agentSession:${event.agentSessionId}`, () =>
      queryClient.invalidateQueries({
        predicate: (query) => {
          const queryKey = query.queryKey;
          return (
            Array.isArray(queryKey) &&
            queryKey[0] === "projects" &&
            queryKey[1] === event.projectId &&
            queryKey[2] === "agent-sessions" &&
            queryKey[3] === event.agentSessionId
          );
        },
      }),
    );
  });

  useServerEventListener("virtualConversationUpdated", async (event) => {
    debouncedInvalidate(`session:${event.projectId}:${event.sessionId}`, () =>
      queryClient.invalidateQueries({
        queryKey: sessionDetailQuery(event.projectId, event.sessionId).queryKey,
      }),
    );
  });

  return <>{children}</>;
};
