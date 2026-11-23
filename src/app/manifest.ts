import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "함께 보는 무대",
    short_name: "함께 보는 무대",
    description: "휠체어·고령·저시력 관객을 위한 올림픽공원 공연 관람 안내",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#3182f6",
    lang: "ko",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
