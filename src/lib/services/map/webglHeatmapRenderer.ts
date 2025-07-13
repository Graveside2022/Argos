/**
 * WebGL-accelerated heatmap renderer for high-performance visualization
 */

import type { HeatmapLayer } from './heatmapService';

// Interface for gradient stops used in color interpolation
interface GradientStop {
  position: number;
  color: [number, number, number, number];
}

export class WebGLHeatmapRenderer {
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private buffers: {
    position?: WebGLBuffer;
    intensity?: WebGLBuffer;
    indices?: WebGLBuffer;
  } = {};
  private textures: {
    gradient?: WebGLTexture;
  } = {};
  private uniforms: {
    [key: string]: WebGLUniformLocation | null;
  } = {};
  private attributes: {
    [key: string]: number;
  } = {};
  
  // Shader sources
  private vertexShaderSource = `
    attribute vec2 a_position;
    attribute float a_intensity;
    
    uniform mat4 u_projection;
    uniform float u_radius;
    uniform vec2 u_resolution;
    
    varying float v_intensity;
    varying vec2 v_texCoord;
    
    void main() {
      vec2 position = a_position;
      gl_Position = u_projection * vec4(position, 0.0, 1.0);
      gl_PointSize = u_radius * 2.0;
      
      v_intensity = a_intensity;
      v_texCoord = gl_Position.xy * 0.5 + 0.5;
    }
  `;
  
  private fragmentShaderSource = `
    precision mediump float;
    
    uniform sampler2D u_gradient;
    uniform float u_opacity;
    uniform float u_blur;
    
    varying float v_intensity;
    varying vec2 v_texCoord;
    
    void main() {
      vec2 coord = gl_PointCoord - vec2(0.5);
      float dist = length(coord);
      
      if (dist > 0.5) {
        discard;
      }
      
      // Gaussian falloff
      float falloff = exp(-dist * dist * u_blur);
      float intensity = v_intensity * falloff;
      
      // Sample gradient texture
      vec4 color = texture2D(u_gradient, vec2(intensity, 0.5));
      color.a *= u_opacity * falloff;
      
      gl_FragColor = color;
    }
  `;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  /**
   * Initialize WebGL context and resources
   */
  initialize(): void {
    // Get WebGL context
    this.gl = this.canvas.getContext('webgl', {
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true
    });

    if (!this.gl) {
      throw new Error('WebGL not supported');
    }

    const gl = this.gl;

    // Enable blending for transparency
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Create shaders
    const vertexShader = this.createShader(gl.VERTEX_SHADER, this.vertexShaderSource);
    const fragmentShader = this.createShader(gl.FRAGMENT_SHADER, this.fragmentShaderSource);

    if (!vertexShader || !fragmentShader) {
      throw new Error('Failed to create shaders');
    }

    // Create program
    this.program = gl.createProgram();
    if (!this.program) {
      throw new Error('Failed to create program');
    }

    gl.attachShader(this.program, vertexShader);
    gl.attachShader(this.program, fragmentShader);
    gl.linkProgram(this.program);

    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      throw new Error('Failed to link program: ' + gl.getProgramInfoLog(this.program));
    }

    // Get attribute locations
    this.attributes.position = gl.getAttribLocation(this.program, 'a_position');
    this.attributes.intensity = gl.getAttribLocation(this.program, 'a_intensity');

    // Get uniform locations
    this.uniforms.projection = gl.getUniformLocation(this.program, 'u_projection');
    this.uniforms.radius = gl.getUniformLocation(this.program, 'u_radius');
    this.uniforms.resolution = gl.getUniformLocation(this.program, 'u_resolution');
    this.uniforms.gradient = gl.getUniformLocation(this.program, 'u_gradient');
    this.uniforms.opacity = gl.getUniformLocation(this.program, 'u_opacity');
    this.uniforms.blur = gl.getUniformLocation(this.program, 'u_blur');

    // Create buffers
    this.buffers.position = gl.createBuffer();
    this.buffers.intensity = gl.createBuffer();

    // Create default gradient texture
    this.createGradientTexture({
      0.0: '#0000ff',
      0.2: '#00ffff',
      0.4: '#00ff00',
      0.6: '#ffff00',
      0.8: '#ff8800',
      1.0: '#ff0000'
    });

    // Set viewport
    this.resize();
  }

  /**
   * Create a shader
   */
  private createShader(type: number, source: string): WebGLShader | null {
    if (!this.gl) return null;
    const gl = this.gl;
    const shader = gl.createShader(type);
    
    if (!shader) return null;

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compilation error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }

    return shader;
  }

  /**
   * Create gradient texture from color stops
   */
  private createGradientTexture(gradient: Record<number, string>): void {
    if (!this.gl) return;
    const gl = this.gl;
    const width = 256;
    const height = 1;
    const data = new Uint8Array(width * height * 4);

    // Convert gradient stops to RGBA values
    const stops = Object.entries(gradient)
      .map(([key, value]) => ({
        position: parseFloat(key),
        color: this.hexToRgba(value)
      }))
      .sort((a, b) => a.position - b.position);

    // Fill texture data with interpolated colors
    for (let i = 0; i < width; i++) {
      const position = i / (width - 1);
      const color = this.interpolateGradient(position, stops);
      const offset = i * 4;
      
      data[offset] = color[0];
      data[offset + 1] = color[1];
      data[offset + 2] = color[2];
      data[offset + 3] = 255;
    }

    // Create texture
    const texture = gl.createTexture();
    if (!texture) return;

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      width,
      height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      data
    );

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    this.textures.gradient = texture;
  }

  /**
   * Convert hex color to RGBA
   */
  private hexToRgba(hex: string): [number, number, number, number] {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16),
      255
    ] : [0, 0, 0, 255];
  }

  /**
   * Interpolate gradient color at position
   */
  private interpolateGradient(position: number, stops: GradientStop[]): [number, number, number] {
    // Find surrounding stops
    let lower = stops[0];
    let upper = stops[stops.length - 1];

    for (let i = 0; i < stops.length - 1; i++) {
      if (position >= stops[i].position && position <= stops[i + 1].position) {
        lower = stops[i];
        upper = stops[i + 1];
        break;
      }
    }

    // Linear interpolation
    const range = upper.position - lower.position;
    const factor = range > 0 ? (position - lower.position) / range : 0;

    return [
      Math.round(lower.color[0] + (upper.color[0] - lower.color[0]) * factor),
      Math.round(lower.color[1] + (upper.color[1] - lower.color[1]) * factor),
      Math.round(lower.color[2] + (upper.color[2] - lower.color[2]) * factor)
    ];
  }

  /**
   * Clear the canvas
   */
  clear(): void {
    if (!this.gl) return;
    const gl = this.gl;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  /**
   * Render a heatmap layer
   */
  renderLayer(layer: HeatmapLayer): void {
    if (!this.gl || !this.program || layer.points.length === 0) return;

    const gl = this.gl;
    const points = layer.points;
    
    // Use program
    gl.useProgram(this.program);

    // Update gradient texture if needed
    if (layer.config.gradient) {
      this.createGradientTexture(layer.config.gradient);
    }

    // Prepare data arrays
    const positions = new Float32Array(points.length * 2);
    const intensities = new Float32Array(points.length);

    points.forEach((point, i) => {
      // Convert lat/lon to normalized coordinates (-1 to 1)
      // This is simplified - in production you'd use proper map projection
      positions[i * 2] = (point.lon / 180) * 2;
      positions[i * 2 + 1] = (point.lat / 90) * 2;
      intensities[i] = point.intensity;
    });

    // Upload position data
    if (!this.buffers.position) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.position);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(this.attributes.position);
    gl.vertexAttribPointer(this.attributes.position, 2, gl.FLOAT, false, 0, 0);

    // Upload intensity data
    if (!this.buffers.intensity) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.intensity);
    gl.bufferData(gl.ARRAY_BUFFER, intensities, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(this.attributes.intensity);
    gl.vertexAttribPointer(this.attributes.intensity, 1, gl.FLOAT, false, 0, 0);

    // Set uniforms
    const projectionMatrix = this.createProjectionMatrix();
    if (!this.uniforms.projection) return;
    gl.uniformMatrix4fv(this.uniforms.projection, false, projectionMatrix);
    if (this.uniforms.radius) gl.uniform1f(this.uniforms.radius, layer.config.radius);
    if (this.uniforms.resolution) gl.uniform2f(this.uniforms.resolution, this.canvas.width, this.canvas.height);
    if (this.uniforms.opacity) gl.uniform1f(this.uniforms.opacity, layer.opacity);
    if (this.uniforms.blur) gl.uniform1f(this.uniforms.blur, layer.config.blur);

    // Bind gradient texture
    gl.activeTexture(gl.TEXTURE0);
    if (!this.textures.gradient) return;
    gl.bindTexture(gl.TEXTURE_2D, this.textures.gradient);
    if (!this.uniforms.gradient) return;
    gl.uniform1i(this.uniforms.gradient, 0);

    // Draw points
    gl.drawArrays(gl.POINTS, 0, points.length);
  }

  /**
   * Create projection matrix
   */
  private createProjectionMatrix(): Float32Array {
    // Simple orthographic projection
    const matrix = new Float32Array(16);
    
    // Identity matrix
    matrix[0] = 1;
    matrix[5] = 1;
    matrix[10] = 1;
    matrix[15] = 1;
    
    return matrix;
  }

  /**
   * Resize canvas and viewport
   */
  resize(): void {
    if (!this.gl) return;

    const displayWidth = this.canvas.clientWidth;
    const displayHeight = this.canvas.clientHeight;

    if (this.canvas.width !== displayWidth || this.canvas.height !== displayHeight) {
      this.canvas.width = displayWidth;
      this.canvas.height = displayHeight;
      this.gl.viewport(0, 0, displayWidth, displayHeight);
    }
  }

  /**
   * Destroy renderer and clean up resources
   */
  destroy(): void {
    if (!this.gl) return;

    // Delete buffers
    Object.values(this.buffers).forEach(buffer => {
      if (buffer && this.gl) this.gl.deleteBuffer(buffer);
    });

    // Delete textures
    Object.values(this.textures).forEach(texture => {
      if (texture && this.gl) this.gl.deleteTexture(texture);
    });

    // Delete program
    if (this.program) {
      this.gl.deleteProgram(this.program);
    }

    // Clear references
    this.gl = null;
    this.program = null;
    this.buffers = {};
    this.textures = {};
    this.uniforms = {};
    this.attributes = {};
  }
}