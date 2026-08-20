import { ImageResponse } from "next/og";
import { THEME_COLOR, ACCENT_COLOR } from "@/lib/brand";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: THEME_COLOR,
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 100,
            color: ACCENT_COLOR,
            fontWeight: 700,
          }}
        >
          ⚡
        </div>
      </div>
    ),
    { ...size },
  );
}
