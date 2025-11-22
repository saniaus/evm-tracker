import { NextResponse } from "next/server";

export async function POST(req: Request) {
  return NextResponse.json({
    type: "frame",
    version: "vNext",
    imageUrl: "https://evm-tracker-mauve.vercel.app/image.png",
    buttons: [
      { title: "Scan Volume", action: "link", target: "https://evm-tracker-mauve.vercel.app" }
    ]
  });
}
