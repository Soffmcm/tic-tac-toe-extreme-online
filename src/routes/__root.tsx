import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Tic Tac Toe Extreme Online" },
      { name: "description", content: "Play tic tac toe extreme locally or online! play locally on the same device with a friend, or create/join a room to play online!" },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "Tic Tac Toe Extreme Online" },
      { property: "og:description", content: "Play tic tac toe extreme locally or online! play locally on the same device with a friend, or create/join a room to play online!" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "Tic Tac Toe Extreme Online" },
      { name: "twitter:description", content: "Play tic tac toe extreme locally or online! play locally on the same device with a friend, or create/join a room to play online!" },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/44e08e33-a9f7-4df0-a345-337a35ea9dac/id-preview-d3e7b631--80aa4b43-5166-42ea-a6b8-a97c868d0b03.lovable.app-1776796140571.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/44e08e33-a9f7-4df0-a345-337a35ea9dac/id-preview-d3e7b631--80aa4b43-5166-42ea-a6b8-a97c868d0b03.lovable.app-1776796140571.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <>
      <Outlet />
      <Toaster richColors closeButton position="top-center" />
    </>
  );
}
