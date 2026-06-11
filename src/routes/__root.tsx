import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { I18nProvider } from "@/i18n/provider";
import { Toaster } from "@/components/ui/sonner";
import { InstallPrompt } from "@/components/InstallPrompt";

function shouldRegisterSW() {
  if (typeof window === "undefined") return false;
  if (!("serviceWorker" in navigator)) return false;
  if (!import.meta.env.PROD) return false;
  if (window.top !== window.self) return false;
  const host = window.location.hostname;
  if (host.startsWith("id-preview--") || host.startsWith("preview--")) return false;
  if (host === "lovableproject.com" || host.endsWith(".lovableproject.com")) return false;
  if (host === "lovableproject-dev.com" || host.endsWith(".lovableproject-dev.com")) return false;
  if (host === "beta.lovable.dev" || host.endsWith(".beta.lovable.dev")) return false;
  if (new URLSearchParams(window.location.search).get("sw") === "off") return false;
  return true;
}

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-serif text-7xl text-foreground">404</h1>
        <h2 className="mt-4 font-serif text-2xl text-foreground">Off the map</h2>
        <p className="mt-2 text-sm text-muted-foreground">This route doesn't exist in your roadbook.</p>
        <div className="mt-6">
          <Link to="/" className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2 text-sm text-primary-foreground hover:bg-primary/90">
            Back home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-serif text-2xl text-foreground">This page didn't load</h1>
        <p className="mt-2 text-sm text-muted-foreground">Something went wrong. Try again or head home.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button onClick={() => { router.invalidate(); reset(); }} className="rounded-full bg-primary px-5 py-2 text-sm text-primary-foreground">Try again</button>
          <a href="/" className="rounded-full border border-input px-5 py-2 text-sm">Go home</a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Veiglede — AI-drevet roadtrip-planlegger" },
      { name: "description", content: "Veiglede er en moderne AI-drevet roadtrip-planlegger for folk som elsker veien — ikke bare målet." },
      // theme-color: dark cockpit by default, warm sand for users in light mode.
      // Matches the standalone PWA background so iOS doesn't flash white on launch.
      { name: "theme-color", content: "#13131c", media: "(prefers-color-scheme: dark)" },
      { name: "theme-color", content: "#f7f3ea", media: "(prefers-color-scheme: light)" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      // black-translucent lets us draw under the status bar / Dynamic Island.
      // Combined with `viewport-fit=cover` and the `.pt-safe` / `top:0` CSS
      // rules in styles.css, headers stay clear of the iOS clock & battery.
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Veiglede" },
      { name: "format-detection", content: "telephone=no" },
      { property: "og:title", content: "Veiglede — AI-drevet roadtrip-planlegger" },
      { name: "twitter:title", content: "Veiglede — AI-drevet roadtrip-planlegger" },
      { property: "og:description", content: "Veiglede er en moderne AI-drevet roadtrip-planlegger for folk som elsker veien — ikke bare målet." },
      { name: "twitter:description", content: "Veiglede er en moderne AI-drevet roadtrip-planlegger for folk som elsker veien — ikke bare målet." },
      { property: "og:image", content: "https://veiglede.no/og-image.jpg" },
      { name: "twitter:image", content: "https://veiglede.no/og-image.jpg" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      {
        rel: "preconnect",
        href: "https://fonts.googleapis.com",
      },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Archivo+Black&family=Inter:wght@300;400;500;600;700;800&display=swap",
      },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      {
        rel: "icon",
        type: "image/svg+xml",
        // Veiglede chevron favicon — keep visually in sync with
        // <LogoGlyph /> in src/components/VeigledeLogo.tsx.
        href:
          'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="%2313131c"/><path d="M16 5 L29 28 L22 28 L16 16 L10 28 L3 28 Z" fill="%23f0a35a"/></svg>',
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

const themeInit = `(function(){try{var t=localStorage.getItem('veiglede.theme');if(t==='light'){document.documentElement.classList.add('light');}}catch(e){}})();`;

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nb">
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  if (typeof window !== "undefined") {
    // Start cloud sync once on the client
    import("@/lib/cloud-sync").then((m) => m.startCloudSync());
  }
  // Service worker registration disabled while debugging PWA issues on iOS.
  // useEffect(() => {
  //   if (shouldRegisterSW()) {
  //     navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  //   }
  // }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <Outlet />
        <InstallPrompt />
        <Toaster position="top-center" richColors />
      </I18nProvider>
    </QueryClientProvider>
  );
}
