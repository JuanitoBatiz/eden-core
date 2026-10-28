import type { Metadata, Viewport } from "next";
import { PermissionsProvider } from "@/hooks/usePermissions";
import EdenWelcomeSplash from "@/components/EdenWelcomeSplash";
import { CurtainProvider } from "@/components/site/Curtain";
import "./globals.css";
import "./eden-site.css";

export const metadata: Metadata = {
  title: "Edén | Barra de Ensaladas y Jugos",
  description: "Ordena en línea las ensaladas, jugos y smoothies más frescos y deliciosos de Edén. Recoge en mostrador y disfruta de comida saludable con sabor casero.",
};

export const viewport: Viewport = {
  themeColor: "#1B3B2B",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>
        <PermissionsProvider>
          <CurtainProvider>
            <EdenWelcomeSplash />
            {children}
          </CurtainProvider>
        </PermissionsProvider>
      </body>
    </html>
  );
}
