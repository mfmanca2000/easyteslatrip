import { ImageResponse } from "next/og";
import { THEME_COLOR, ACCENT_COLOR } from "@/lib/brand";

export const dynamic = "force-static";

const SIZE = 192;

export async function GET() {
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
            fontSize: 108,
            color: ACCENT_COLOR,
            fontWeight: 700,
          }}
        >
          ⚡
        </div>
      </div>
    ),
    { width: SIZE, height: SIZE },
  );
}
