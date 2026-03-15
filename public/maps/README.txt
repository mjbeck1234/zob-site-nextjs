Place a sector-boundaries GeoJSON here so /splits can render the map.

Expected file path:
  public/maps/zob_sectors.geojson

Expected feature properties:
  - id OR name OR sector (string) matching your sector codes (e.g., ZOB12)
  - geometry should be Polygon or MultiPolygon

If the file is missing, /splits will show a friendly "No sector geometry found" message.
