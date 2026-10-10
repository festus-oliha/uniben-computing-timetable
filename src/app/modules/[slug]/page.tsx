import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { MODULES, SITE } from "@/lib/site-content";
import { ModuleIcon } from "@/components/brand/ModuleIcon";
import { ModuleHeader, SiteFooter } from "@/components/brand/SiteChrome";
import "../modules.css";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const m = MODULES.find((x) => x.slug === slug);
  return { title: m ? `${m.name} — FaCoMS, University of Benin` : "FaCoMS" };
}

/** A module that is still being built: what it will do, so staff can comment before it is made. */
export default async function ModulePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const m = MODULES.find((x) => x.slug === slug);
  if (!m) notFound();
  if (m.status === "live") redirect(m.href);
  const me = await getCurrentUser();

  return (
    <div className="mp">
      <ModuleHeader module={m.name} signedIn={!!me} />
      <main className="mp-main">
        <div className="mp-icon">
          <ModuleIcon slug={m.slug} size={40} />
        </div>
        <h1>{m.name}</h1>
        <p className="mp-purpose">{m.purpose}</p>
        <p className="mp-state">This module is being built. Here is what it will hold:</p>
        <ul className="mp-plans">
          {m.plans.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        {m.staffOnly && <p className="mp-note">Once built, this module will be open to signed-in staff only.</p>}
        <p className="mp-back">
          <Link href="/">Back to {SITE.name}</Link>
          <Link href="/timetables">Go to Timetables</Link>
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
