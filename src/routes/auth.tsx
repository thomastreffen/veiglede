import { createFileRoute, Outlet } from "@tanstack/react-router";

/**
 * Layout for /auth/*. Renders only an <Outlet /> so child routes like
 * /auth/callback continue to work; /auth itself is handled by auth.index.tsx.
 */
export const Route = createFileRoute("/auth")({
  component: () => <Outlet />,
});
