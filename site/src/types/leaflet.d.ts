// Minimal Leaflet type shim for builds that don't include @types/leaflet.
// If you prefer full types, install: npm i -D @types/leaflet
//
// This project uses Leaflet primarily through dynamic imports, and only relies
// on a small subset of the public API. These intentionally-loose types keep
// `tsc --noEmit` happy in CI/build environments.

declare module 'leaflet' {
  export type LatLngExpression = any;
  export type LatLngBoundsExpression = any;

  export interface Layer {
    addTo(map: Map): this;
    remove(): this;
  }

  export interface LayerGroup<T extends Layer = Layer> extends Layer {
    addLayer(layer: T): this;
    removeLayer(layer: T): this;
    clearLayers(): this;
  }

  export interface Map {
    addLayer(layer: Layer): this;
    removeLayer(layer: Layer): this;
    hasLayer(layer: Layer): boolean;

    // Panes
    getPane(name: string): (HTMLElement & { style: any }) | undefined | null;
    createPane(name: string): HTMLElement & { style: any };

    // View helpers
    getZoom(): number;
    setView(center: LatLngExpression, zoom?: number, options?: any): this;
    fitBounds(bounds: LatLngBoundsExpression, options?: any): this;

    // Events
    on(...args: any[]): this;
    off(...args: any[]): this;
  }

  export interface Marker extends Layer {}
  export interface Polyline extends Layer {}
  export interface CircleMarker extends Layer {}
  export interface Icon<T = any> {}
  export interface DivIcon extends Icon {}

  // Default export is the Leaflet namespace (L). Keep it loose.
  const L: any;
  export default L;
}
