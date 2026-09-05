"use client";

import { RefreshCw, TriangleAlert } from "lucide-react";
import { Button, EmptyState } from "@/components/ui/primitives";

export function DataLoadError({
  title = "This data could not be loaded",
  error,
  onRetry,
  isRetrying = false,
}: {
  title?: string;
  error: unknown;
  onRetry: () => unknown;
  isRetrying?: boolean;
}) {
  return (
    <EmptyState
      icon={<TriangleAlert className="size-5" />}
      title={title}
      body={
        error instanceof Error
          ? error.message
          : "The server did not return the requested data."
      }
      action={
        <Button
          variant="secondary"
          loading={isRetrying}
          onClick={() => void onRetry()}
        >
          <RefreshCw className="size-4" />
          Try again
        </Button>
      }
    />
  );
}
