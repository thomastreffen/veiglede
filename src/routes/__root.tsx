import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

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
      { name: "theme-color", content: "#13131c" },
      { property: "og:title", content: "Veiglede — AI-drevet roadtrip-planlegger" },
      { name: "twitter:title", content: "Veiglede — AI-drevet roadtrip-planlegger" },
      { property: "og:description", content: "Veiglede er en moderne AI-drevet roadtrip-planlegger for folk som elsker veien — ikke bare målet." },
      { name: "twitter:description", content: "Veiglede er en moderne AI-drevet roadtrip-planlegger for folk som elsker veien — ikke bare målet." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/93e77409-39d5-477d-888d-43a81e0b203c/id-preview-8a4df014--87475a04-b786-464d-9515-5abff27287c0.lovable.app-1779865700617.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/93e77409-39d5-477d-888d-43a81e0b203c/id-preview-8a4df014--87475a04-b786-464d-9515-5abff27287c0.lovable.app-1779865700617.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
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
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}
