import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const origin = params.get("origin");
  const destination = params.get("destination");
  const profile = params.get("profile") ?? "driving";

  if (!origin || !destination) {
    return NextResponse.json(
      { error: "Missing origin or destination" },
      { status: 400 }
    );
  }

  const token = process.env.MAPBOX_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "Missing MAPBOX_TOKEN" }, { status: 500 });
  }

  const url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${origin};${destination}?geometries=geojson&access_token=${token}`;

  const res = await fetch(url);
  if (!res.ok) {
    return NextResponse.json(
      { error: `Mapbox API error: ${res.status}` },
      { status: res.status }
    );
  }

  const data = await res.json();
  return NextResponse.json(data);
}
