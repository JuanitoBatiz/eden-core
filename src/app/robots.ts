import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = 'https://www.eden-ensaladas.com';

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Puedes bloquear rutas que no quieres que Google indexe:
      // disallow: '/api/', 
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
