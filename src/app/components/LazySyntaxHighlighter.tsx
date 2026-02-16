import { type FC, Suspense, lazy } from "react";
import type { SyntaxHighlighterProps } from "react-syntax-highlighter";

const LazyPrism = lazy(() =>
  import("react-syntax-highlighter").then((mod) => ({
    default: mod.Prism,
  })),
);

export const LazySyntaxHighlighter: FC<SyntaxHighlighterProps> = (props) => (
  <Suspense
    fallback={<div className="bg-muted/30 rounded p-4 min-h-[3rem]" />}
  >
    <LazyPrism {...props} />
  </Suspense>
);
