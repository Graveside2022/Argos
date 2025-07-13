import * as L from 'leaflet';

declare module 'leaflet' {
  export interface MarkerClusterGroupOptions extends L.LayerOptions {
    maxClusterRadius?: number;
    disableClusteringAtZoom?: number;
    spiderfyOnMaxZoom?: boolean;
    showCoverageOnHover?: boolean;
    zoomToBoundsOnClick?: boolean;
    singleMarkerMode?: boolean;
    animateAddingMarkers?: boolean;
    iconCreateFunction?: (cluster: MarkerCluster) => L.DivIcon;
  }

  export interface MarkerCluster extends L.Layer {
    getAllChildMarkers(): L.Marker[];
    getChildCount(): number;
    getLatLng(): L.LatLng;
  }

  export interface MarkerClusterGroup extends L.FeatureGroup {
    refreshClusters(): void;
    addLayer(layer: L.Layer): this;
    removeLayer(layer: L.Layer): this;
    clearLayers(): this;
    options: MarkerClusterGroupOptions;
  }

  export function markerClusterGroup(options?: MarkerClusterGroupOptions): MarkerClusterGroup;
}