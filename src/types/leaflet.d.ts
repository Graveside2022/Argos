// Type definitions for Leaflet extensions and custom implementations

declare module 'leaflet.heat' {
  import * as L from 'leaflet';
  
  export interface HeatLatLngTuple extends Array<number> {
    0: number; // latitude
    1: number; // longitude
    2?: number; // intensity
  }
  
  export interface HeatMapOptions {
    minOpacity?: number;
    maxZoom?: number;
    max?: number;
    radius?: number;
    blur?: number;
    gradient?: { [key: number]: string };
  }
  
  export interface HeatLayer extends L.Layer {
    setLatLngs(latlngs: HeatLatLngTuple[]): this;
    addLatLng(latlng: HeatLatLngTuple): this;
    setOptions(options: HeatMapOptions): this;
    redraw(): this;
  }
  
  export function heatLayer(
    latlngs?: HeatLatLngTuple[],
    options?: HeatMapOptions
  ): HeatLayer;
}

declare module 'leaflet.markercluster' {
  import * as L from 'leaflet';
  
  export interface MarkerClusterGroupOptions extends L.LayerOptions {
    maxClusterRadius?: number | ((zoom: number) => number);
    clusterPane?: string;
    spiderfyOnMaxZoom?: boolean;
    showCoverageOnHover?: boolean;
    zoomToBoundsOnClick?: boolean;
    singleMarkerMode?: boolean;
    disableClusteringAtZoom?: number;
    removeOutsideVisibleBounds?: boolean;
    animate?: boolean;
    animateAddingMarkers?: boolean;
    spiderfyDistanceMultiplier?: number;
    spiderLegPolylineOptions?: L.PolylineOptions;
    chunkedLoading?: boolean;
    chunkInterval?: number;
    chunkDelay?: number;
    chunkProgress?: (processed: number, total: number, elapsed: number) => void;
    polygonOptions?: L.PolylineOptions;
    iconCreateFunction?: (cluster: MarkerCluster) => L.Icon;
  }
  
  export interface MarkerCluster extends L.Marker {
    getChildCount(): number;
    getAllChildMarkers(): L.Marker[];
    spiderfy(): void;
    unspiderfy(): void;
  }
  
  export class MarkerClusterGroup extends L.FeatureGroup {
    constructor(options?: MarkerClusterGroupOptions);
    addLayer(layer: L.Layer): this;
    removeLayer(layer: L.Layer): this;
    addLayers(layers: L.Layer[]): this;
    removeLayers(layers: L.Layer[]): this;
    clearLayers(): this;
    getVisibleParent(marker: L.Marker): MarkerCluster | null;
    refreshClusters(clusters?: MarkerCluster | MarkerCluster[]): this;
    getChildCount(): number;
    getAllChildMarkers(): L.Marker[];
    hasLayer(layer: L.Layer): boolean;
    zoomToShowLayer(layer: L.Layer, callback?: () => void): this;
  }
  
  export function markerClusterGroup(options?: MarkerClusterGroupOptions): MarkerClusterGroup;
}

// Extend Leaflet namespace
declare module 'leaflet' {
  export interface Icon {
    options: IconOptions;
  }
  
  export interface IconOptions {
    iconUrl?: string;
    iconRetinaUrl?: string;
    iconSize?: [number, number];
    iconAnchor?: [number, number];
    popupAnchor?: [number, number];
    tooltipAnchor?: [number, number];
    shadowUrl?: string;
    shadowRetinaUrl?: string;
    shadowSize?: [number, number];
    shadowAnchor?: [number, number];
    className?: string;
  }
}