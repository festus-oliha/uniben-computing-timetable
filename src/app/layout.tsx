import type { Metadata } from "next";
import { getTimetableData, clashesFor } from "@/lib/data";
import { Nav } from "@/components/Nav";
import { ToastProvider } from "@/components/Toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "Faculty of Computing Timetable — UNIBEN",
  description: "Lecture timetable manager for the Faculty of Computing, University of Benin.",
};

// Always read fresh data: several officers edit the same timetable.
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const data = await getTimetableData();
  const errors = clashesFor(data).filter((c) => c.severity === "error").length;

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;700;800&family=IBM+Plex+Mono:wght@500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap"
        />
      </head>
      <body>
        <ToastProvider>
          <div className="top">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/crest.png" alt="University of Benin crest" />
            <div className="brand">
              <small>University of Benin</small>
              <h1>
                Faculty of Computing <span>Timetable</span>
              </h1>
            </div>
            {data.semester && (
              <div className="session">
                {data.semester.name}
                <b>{data.semester.session}</b>
              </div>
            )}
          </div>
          <Nav clashCount={errors} />
          <main>{children}</main>
        </ToastProvider>
      </body>
    </html>
  );
}
