"use client";

import { config } from "@fortawesome/fontawesome-svg-core";
import AuthProvider from "@/core/auth/AuthProvider";
import AppLayout from "@/shared/components/layout/AppLayout";
import { GlobalToastHost } from "@/shared/components/ui";

config.autoAddCss = false;

export default function Providers({ children }) {
  return (
    <AuthProvider>
      <GlobalToastHost />
      <AppLayout>{children}</AppLayout>
    </AuthProvider>
  );
}
