"use client";

import { useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query-client";
import UserAccessRealtimeBridge from "@/providers/UserAccessRealtimeBridge";

export default function QueryProvider({ children }) {
  const [queryClient] = useState(() => getQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <UserAccessRealtimeBridge />
      {children}
    </QueryClientProvider>
  );
}
