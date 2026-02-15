import { useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const NavigationProgress = () => {
  const isNavigating = useRouterState({
    select: (s) => s.status === "pending",
  });
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isNavigating) {
      setVisible(true);
      return;
    }
    const timeout = setTimeout(() => setVisible(false), 300);
    return () => clearTimeout(timeout);
  }, [isNavigating]);

  if (!visible) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] h-1 overflow-hidden bg-primary/10">
      <div
        className={`h-full bg-primary transition-all duration-300 ease-out ${
          isNavigating
            ? "animate-[progress_2s_ease-in-out_infinite]"
            : "w-full"
        }`}
      />
    </div>
  );
};
