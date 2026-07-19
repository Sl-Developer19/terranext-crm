import { siteConfig } from '@/config/site';

/**
 * Root entry. Becomes redirect(login|dashboard) when the auth foundation
 * lands later in Milestone 1; until then it renders the platform identity
 * so the scaffold is verifiable end-to-end.
 */
export default function RootPage() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          TerraNext Global Ventures
        </p>
        <h1 className="mt-2 text-2xl font-semibold">{siteConfig.name}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{siteConfig.description}</p>
      </div>
    </main>
  );
}
