import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const lng = params.get("lng") ?? "-75.5905";
  const lat = params.get("lat") ?? "6.2565";
  const profile = params.get("profile") ?? "driving";
  const minutes = params.get("minutes") ?? "5,10,15";

  const token = process.env.MAPBOX_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "Missing MAPBOX_TOKEN" }, { status: 500 });
  }

  const url = `https://api.mapbox.com/isochrone/v1/mapbox/${profile}/${lng},${lat}?contours_minutes=${minutes}&polygons=true&access_token=${token}`;

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
