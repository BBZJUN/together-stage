import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "함께 보는 무대",
    short_name: "함께 보는 무대",
    description: "휠체어·고령·저시력 관객을 위한 올림픽공원 공연 관람 안내",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    lang: "ko",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
