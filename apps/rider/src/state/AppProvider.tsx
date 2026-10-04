import { AppProvider as SharedProvider } from "@pepo/session/AppProvider";
import type { ReactNode } from "react";
export { useApp } from "@pepo/session/AppProvider";
export function AppProvider({ children }: { children: ReactNode }) {
  return <SharedProvider appRole="passenger">{children}</SharedProvider>;
}
