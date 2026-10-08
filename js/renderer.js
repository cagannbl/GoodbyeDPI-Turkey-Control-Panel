'use strict';
// ---------------------------------------------------------------------------
// WebGL2 çizici
// ---------------------------------------------------------------------------

const CHUNK_VS = `#version 300 es
layout(location=0) in uvec4 a_pos;
layout(location=1) in uvec4 a_data;
uniform mat4 u_vp;
uniform vec3 u_offset;
out vec3 v_uv;
out vec2 v_light;
out float v_shade;
out float v_dist;
const float AO[4] = float[4](0.40, 0.60, 0.80, 1.0);
const float SHADE[8] = float[8](0.62, 0.62, 1.0, 0.5, 0.8, 0.8, 0.9, 1.0);
void main() {
  vec3 p = vec3(a_pos.xyz) * (1.0 / 16.0) + u_offset;
  gl_Position = u_vp * vec4(p, 1.0);
  uint w = a_pos.w;
  v_uv = vec3(vec2(a_data.xy) * (1.0 / 16.0), float(w & 255u));
  v_light = vec2(a_data.zw) * (1.0 / 255.0);
  v_shade = AO[(w >> 8u) & 3u] * SHADE[(w >> 10u) & 7u];
  v_dist = length(p.xz) * 0.85 + abs(p.y) * 0.15;
}`;

const CHUNK_FS = `#version 300 es
precision highp float;
precision highp sampler2DArray;
uniform sampler2DArray u_tex;
uniform float u_sun;
uniform vec3 u_sunTint;
uniform vec3 u_fogColor;
uniform vec2 u_fog;
uniform float u_alphaTest;
uniform float u_time;
uniform float u_water;
uniform float u_lava;
uniform float u_gamma;
uniform vec3 u_tint;
uniform vec3 u_ambient;
uniform float u_portal;
uniform float u_endPortal;
in vec3 v_uv;
in vec2 v_light;
in float v_shade;
in float v_dist;
out vec4 o;
float lv(float x) { return mix(pow(0.8, 15.0 * (1.0 - x)), x, u_gamma); }
float lb(float x) { return mix(pow(0.84, 15.0 * (1.0 - x)), x, u_gamma); }
void main() {
  vec3 uv = v_uv;
  if (abs(uv.z - u_water) < 0.5) uv.xy += vec2(sin(u_time * 0.7 + uv.y * 3.0) * 0.04, u_time * 0.06);
  else if (abs(uv.z - u_lava) < 0.5) uv.xy += vec2(sin(u_time * 0.4 + uv.y * 2.0) * 0.06, u_time * 0.025);
  else if (abs(uv.z - u_portal) < 0.5) uv.xy += vec2(sin(u_time * 1.3 + uv.y * 6.0) * 0.08, cos(u_time * 1.1 + uv.x * 5.0) * 0.08 + u_time * 0.1);
  else if (abs(uv.z - u_endPortal) < 0.5) uv.xy = uv.xy * 0.5 + vec2(u_time * 0.01, u_time * 0.007);
  // Keskin pikseller: mip seviyesini en dar ayak izine göre seç (eğik yüzeyler bulanıklaşmaz)
  vec2 tc = v_uv.xy * 16.0;
  vec2 ddx = dFdx(tc), ddy = dFdy(tc);
  float lod = max(0.0, 0.5 * log2(min(dot(ddx, ddx), dot(ddy, ddy))) - 0.25);
  vec4 c = textureLod(u_tex, uv, lod);
  if (c.a < u_alphaTest) discard;
  float sky = lv(v_light.x) * u_sun;
  float bl = lb(v_light.y);
  vec3 light = max(sky * u_sunTint, bl * vec3(1.08, 0.94, 0.74));
  light = max(light, u_ambient);
  vec3 col = c.rgb * light * v_shade * u_tint;
  float f = clamp((v_dist - u_fog.x) / (u_fog.y - u_fog.x), 0.0, 1.0);
  o = vec4(mix(col, u_fogColor, f), c.a);
}`;

const SKY_VS = `#version 300 es
layout(location=0) in vec2 a_pos;
out vec2 v_ndc;
void main() { v_ndc = a_pos; gl_Position = vec4(a_pos, 0.9999, 1.0); }`;

const SKY_FS = `#version 300 es
precision highp float;
uniform mat4 u_invVP;
uniform vec3 u_sunDir;
uniform vec3 u_zenith;
uniform vec3 u_horizon;
uniform vec3 u_sunset;
uniform float u_night;
uniform float u_underwater;
uniform float u_dim;
uniform vec3 u_dimColor;
in vec2 v_ndc;
out vec4 o;
float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
void main() {
  vec4 w = u_invVP * vec4(v_ndc, 1.0, 1.0);
  vec3 d = normalize(w.xyz / w.w);
  float h = d.y;
  vec3 col = mix(u_horizon, u_zenith, pow(clamp(h, 0.0, 1.0), 0.6));
  if (h < 0.0) col = mix(u_horizon, u_horizon * 0.55, clamp(-h * 4.0, 0.0, 1.0));
  float sd = dot(d, u_sunDir);
  col += u_sunset * pow(max(sd, 0.0), 6.0) * (1.0 - clamp(abs(h) * 2.5, 0.0, 1.0));
  col += u_sunset * 0.35 * (1.0 - clamp(abs(h) * 4.0, 0.0, 1.0));
  // Yıldızlar
  if (u_night > 0.01 && h > 0.0) {
    vec3 q = floor(d * 180.0);
    float s = hash(q);
    if (s > 0.9965) col += vec3(0.9, 0.92, 1.0) * u_night * (s - 0.9965) * 280.0 * clamp(h * 4.0, 0.0, 1.0);
  }
  // Kare güneş ve ay
  vec3 t1 = vec3(0.0, 0.0, 1.0);
  vec3 t2 = normalize(cross(u_sunDir, t1));
  if (sd > 0.0) {
    vec3 q = d / sd;
    float u = dot(q, t1), v = dot(q, t2);
    float m = max(abs(u), abs(v));
    if (m < 0.075) col = mix(vec3(1.0, 0.98, 0.8), vec3(1.0, 1.0, 0.95), step(m, 0.05));
    col += vec3(1.0, 0.85, 0.6) * pow(max(sd, 0.0), 220.0) * 0.6;
  } else {
    float md = -sd;
    vec3 q = d / md;
    float u = dot(q, t1), v = dot(q, -t2);
    float m = max(abs(u), abs(v));
    if (m < 0.055) {
      vec2 cell = floor(vec2(u, v) * 60.0);
      float cr = hash(vec3(cell, 3.0));
      col = vec3(0.86, 0.88, 0.95) * (cr > 0.75 ? 0.78 : 1.0);
    }
    col += vec3(0.4, 0.45, 0.6) * pow(max(md, 0.0), 300.0) * 0.4;
  }
  if (u_dim > 0.5 && u_dim < 1.5) col = u_dimColor;
  else if (u_dim > 1.5) {
    vec3 q = floor(d * 260.0);
    float n = hash(q);
    col = u_dimColor * (0.9 + 0.2 * hash(floor(d * 220.0))) + (n > 0.994 ? vec3(0.35, 0.3, 0.45) : vec3(0.0));
  }
  if (u_underwater > 0.5) col = vec3(0.05, 0.12, 0.35);
  o = vec4(col, 1.0);
}`;

const CLOUD_VS = `#version 300 es
layout(location=0) in vec2 a_pos;
uniform mat4 u_vp;
uniform vec3 u_cam;
uniform float u_size;
uniform float u_cloudY;
out vec2 v_world;
out float v_dist;
void main() {
  vec3 p = vec3(a_pos.x * u_size, u_cloudY - u_cam.y, a_pos.y * u_size);
  v_world = p.xz + u_cam.xz;
  v_dist = length(p.xz);
  gl_Position = u_vp * vec4(p, 1.0);
}`;

const CLOUD_FS = `#version 300 es
precision highp float;
uniform float u_time;
uniform vec3 u_color;
uniform vec3 u_fogColor;
uniform float u_fogEnd;
in vec2 v_world;
in float v_dist;
out vec4 o;
float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  vec2 p = v_world + vec2(u_time * 1.6, 0.0);
  vec2 c = floor(p / 12.0);
  float n = h2(c) * 0.45 + h2(floor(c / 3.0)) * 0.35 + h2(floor(c / 7.0) + 9.0) * 0.3;
  if (n < 0.68) discard;
  float fade = 1.0 - clamp((v_dist - u_fogEnd * 0.6) / (u_fogEnd * 1.4), 0.0, 1.0);
  o = vec4(mix(u_fogColor, u_color, 0.85), 0.8 * fade);
}`;

const LINE_VS = `#version 300 es
layout(location=0) in vec3 a_pos;
uniform mat4 u_vp;
uniform vec3 u_offset;
void main() { gl_Position = u_vp * vec4(a_pos + u_offset, 1.0); }`;
const LINE_FS = `#version 300 es
precision mediump float;
uniform vec4 u_color;
out vec4 o;
void main() { o = u_color; }`;

const PART_VS = `#version 300 es
layout(location=0) in vec3 a_pos;
layout(location=1) in vec4 a_info; // katman, u, v, ışık
layout(location=2) in float a_size;
uniform mat4 u_vp;
uniform float u_scale;
out vec3 v_info;
out float v_light;
void main() {
  gl_Position = u_vp * vec4(a_pos, 1.0);
  gl_PointSize = min(a_size * u_scale / max(gl_Position.w, 0.1), u_scale * 0.06);
  v_info = a_info.xyz;
  v_light = a_info.w;
}`;
const PART_FS = `#version 300 es
precision highp float;
precision highp sampler2DArray;
uniform sampler2DArray u_tex;
in vec3 v_info;
in float v_light;
out vec4 o;
void main() {
  vec2 uv = v_info.yz + gl_PointCoord * 0.25;
  vec4 c = texture(u_tex, vec3(uv, v_info.x));
  if (v_info.x < 0.0) c = vec4(1.0, 1.0, 1.0, 1.0 - length(gl_PointCoord - 0.5) * 2.0);
  if (c.a < 0.3) discard;
  o = vec4(c.rgb * v_light, c.a);
}`;

const ENT_VS = `#version 300 es
layout(location=0) in vec3 a_pos;
layout(location=1) in vec3 a_color;
layout(location=2) in vec3 a_misc; // u, v, ışık
uniform mat4 u_vp;
out vec3 v_color;
out vec2 v_uv;
out float v_light;
out float v_dist;
void main() {
  gl_Position = u_vp * vec4(a_pos, 1.0);
  v_color = a_color; v_uv = a_misc.xy; v_light = a_misc.z; v_dist = length(a_pos.xz);
}`;
const ENT_FS = `#version 300 es
precision highp float;
uniform vec3 u_fogColor;
uniform vec2 u_fog;
in vec3 v_color;
in vec2 v_uv;
in float v_light;
in float v_dist;
out vec4 o;
float h2(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  float n = h2(floor(v_uv));
  vec3 c = v_color * (0.88 + n * 0.16) * v_light;
  float f = clamp((v_dist - u_fog.x) / (u_fog.y - u_fog.x), 0.0, 1.0);
  o = vec4(mix(c, u_fogColor, f), 1.0);
}`;

class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance' });
    if (!gl) throw new Error('WebGL2 desteklenmiyor');
    this.gl = gl;
    this.progChunk = this.program(CHUNK_VS, CHUNK_FS);
    this.progSky = this.program(SKY_VS, SKY_FS);
    this.progCloud = this.program(CLOUD_VS, CLOUD_FS);
    this.progLine = this.program(LINE_VS, LINE_FS);
    this.progPart = this.program(PART_VS, PART_FS);
    this.progEnt = this.program(ENT_VS, ENT_FS);

    this.proj = M4.create(); this.view = M4.create(); this.vp = M4.create(); this.invVP = M4.create();
    this.tmp = M4.create(); this.tmp2 = M4.create();
    this.planes = new Float32Array(24);

    this.initTextures();
    this.initQuadIndex(400000);

    // Tam ekran üçgen (gökyüzü)
    this.skyVAO = gl.createVertexArray();
    gl.bindVertexArray(this.skyVAO);
    const sb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, sb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    // Bulut düzlemi
    this.cloudVAO = gl.createVertexArray();
    gl.bindVertexArray(this.cloudVAO);
    const cb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    // Seçim kutusu çizgileri
    this.lineVAO = gl.createVertexArray();
    gl.bindVertexArray(this.lineVAO);
    const lb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, lb);
    const e = 0.002, L = [];
    const c0 = -e, c1 = 1 + e;
    const P = [[c0, c0, c0], [c1, c0, c0], [c1, c0, c1], [c0, c0, c1], [c0, c1, c0], [c1, c1, c0], [c1, c1, c1], [c0, c1, c1]];
    const E = [0, 1, 1, 2, 2, 3, 3, 0, 4, 5, 5, 6, 6, 7, 7, 4, 0, 4, 1, 5, 2, 6, 3, 7];
    for (const i of E) L.push(...P[i]);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(L), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

    // Parçacıklar
    this.partVAO = gl.createVertexArray();
    gl.bindVertexArray(this.partVAO);
    this.partVBO = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.partVBO);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 32, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 32, 28);

    // Varlıklar (mob'lar, kol)
    this.entVAO = gl.createVertexArray();
    gl.bindVertexArray(this.entVAO);
    this.entVBO = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.entVBO);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 36, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 36, 12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 36, 24);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.quadIBO);

    // Tek blok (el / çatlak)
    this.itemVAO = gl.createVertexArray();
    gl.bindVertexArray(this.itemVAO);
    this.itemVBO = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.itemVBO);
    gl.enableVertexAttribArray(0); gl.vertexAttribIPointer(0, 4, gl.UNSIGNED_SHORT, 12, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribIPointer(1, 4, gl.UNSIGNED_BYTE, 12, 8);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.quadIBO);
    gl.bindVertexArray(null);

    this.stats = { chunks: 0, faces: 0 };
  }

  program(vs, fs) {
    const gl = this.gl;
    const mk = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('Shader hatası: ' + gl.getShaderInfoLog(s));
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, mk(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('Program hatası: ' + gl.getProgramInfoLog(p));
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name] = gl.getUniformLocation(p, info.name); }
    return { p, u };
  }

  initTextures() {
    const gl = this.gl;
    const n = texLayers.length;
    const data = new Uint8Array(16 * 16 * 4 * n);
    for (let i = 0; i < n; i++) data.set(texLayers[i], i * 1024);
    this.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.tex);
    gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.RGBA8, 16, 16, n, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_NEAREST);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAX_LEVEL, 4);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.REPEAT);
    const aniso = gl.getExtension('EXT_texture_filter_anisotropic');
    if (aniso) gl.texParameterf(gl.TEXTURE_2D_ARRAY, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(4, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
  }

  initQuadIndex(maxQuads) {
    const gl = this.gl;
    const idx = new Uint32Array(maxQuads * 6);
    for (let q = 0, v = 0, i = 0; q < maxQuads; q++, v += 4) {
      idx[i++] = v; idx[i++] = v + 1; idx[i++] = v + 2; idx[i++] = v; idx[i++] = v + 2; idx[i++] = v + 3;
    }
    this.maxQuads = maxQuads;
    this.quadIBO = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.quadIBO);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
  }

  makeMeshVAO(data) {
    const gl = this.gl;
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribIPointer(0, 4, gl.UNSIGNED_SHORT, 12, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribIPointer(1, 4, gl.UNSIGNED_BYTE, 12, 8);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.quadIBO);
    gl.bindVertexArray(null);
    return { vao, vbo };
  }

  uploadChunk(chunk, mesh) {
    this.freeChunk(chunk);
    const g = { o: null, oc: 0, t: null, tc: 0 };
    if (mesh.opaqueCount) { g.o = this.makeMeshVAO(mesh.opaque); g.oc = Math.min(mesh.opaqueCount / 4, this.maxQuads) * 6; }
    if (mesh.transCount) { g.t = this.makeMeshVAO(mesh.trans); g.tc = Math.min(mesh.transCount / 4, this.maxQuads) * 6; }
    chunk.gpu = g;
  }

  freeChunk(chunk) {
    const g = chunk.gpu;
    if (!g) return;
    const gl = this.gl;
    for (const m of [g.o, g.t]) if (m) { gl.deleteBuffer(m.vbo); gl.deleteVertexArray(m.vao); }
    chunk.gpu = null;
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2) * (this.resScale || 1);
    const w = Math.floor(this.canvas.clientWidth * dpr), h = Math.floor(this.canvas.clientHeight * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    this.gl.viewport(0, 0, w, h);
  }

  setChunkUniforms(S) {
    const gl = this.gl, u = this.progChunk.u;
    gl.useProgram(this.progChunk.p);
    gl.uniformMatrix4fv(u.u_vp, false, this.vp);
    gl.uniform1f(u.u_sun, S.sun);
    gl.uniform3fv(u.u_sunTint, S.sunTint);
    gl.uniform3fv(u.u_fogColor, S.fogColor);
    gl.uniform2f(u.u_fog, S.fogStart, S.fogEnd);
    gl.uniform1f(u.u_time, S.time);
    gl.uniform1f(u.u_water, TEX.water);
    gl.uniform1f(u.u_lava, TEX.lava);
    gl.uniform1f(u.u_gamma, S.gamma);
    gl.uniform3f(u.u_tint, 1, 1, 1);
    gl.uniform3fv(u.u_ambient, S.ambient || [0.05, 0.05, 0.05]);
    gl.uniform1f(u.u_portal, TEX.nether_portal);
    gl.uniform1f(u.u_endPortal, TEX.end_portal);
    gl.uniform1i(u.u_tex, 0);
  }

  // S: sahne durumu (main.js tarafından doldurulur)
  render(S) {
    const gl = this.gl;
    this.resize();
    const aspect = this.canvas.width / this.canvas.height;
    const far = S.renderDist * 16 + 64;
    M4.perspective(this.proj, S.fov * Math.PI / 180, aspect, 0.05, far + 200);
    M4.rotX(this.tmp, -S.pitch);
    M4.rotY(this.tmp2, -S.yaw);
    M4.mul(this.view, this.tmp, this.tmp2);
    if (S.roll) { M4.rotZ(this.tmp, S.roll); M4.mul(this.view, this.tmp, this.view); }
    M4.mul(this.vp, this.proj, this.view);
    M4.invert(this.invVP, this.vp);
    M4.frustum(this.planes, this.vp);

    gl.clearColor(S.fogColor[0], S.fogColor[1], S.fogColor[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.tex);

    // Gökyüzü
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.depthMask(false);
    const su = this.progSky.u;
    gl.useProgram(this.progSky.p);
    gl.uniformMatrix4fv(su.u_invVP, false, this.invVP);
    gl.uniform3fv(su.u_sunDir, S.sunDir);
    gl.uniform3fv(su.u_zenith, S.zenith);
    gl.uniform3fv(su.u_horizon, S.horizon);
    gl.uniform3fv(su.u_sunset, S.sunset);
    gl.uniform1f(su.u_night, S.night);
    gl.uniform1f(su.u_underwater, S.underwater ? 1 : 0);
    gl.uniform1f(su.u_dim, S.dim || 0);
    gl.uniform3fv(su.u_dimColor, S.dimColor || [0, 0, 0]);
    gl.bindVertexArray(this.skyVAO);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // Opak dünya
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(true);
    gl.enable(gl.CULL_FACE);
    gl.disable(gl.BLEND);
    this.setChunkUniforms(S);
    const u = this.progChunk.u;
    gl.uniform1f(u.u_alphaTest, 0.5);
    const cam = S.cam;
    const visible = [];
    let faces = 0;
    for (const c of S.chunks) {
      const g = c.gpu;
      if (!g) continue;
      const ox = c.cx * 16 - cam[0], oz = c.cz * 16 - cam[2];
      if (!boxInFrustum(this.planes, ox, -cam[1], oz, ox + 16, c.maxY + 2 - cam[1], oz + 16)) continue;
      visible.push(c);
      if (!g.o) continue;
      gl.uniform3f(u.u_offset, ox, -cam[1], oz);
      gl.bindVertexArray(g.o.vao);
      gl.drawElements(gl.TRIANGLES, g.oc, gl.UNSIGNED_INT, 0);
      faces += g.oc / 6;
    }
    this.stats.chunks = visible.length;

    // Varlıklar
    if (S.entityVerts && S.entityCount) this.drawEntities(S.entityVerts, S.entityCount, this.vp, S);

    // Seçim kutusu
    if (S.selection) {
      const lu = this.progLine.u;
      gl.useProgram(this.progLine.p);
      gl.uniformMatrix4fv(lu.u_vp, false, this.vp);
      gl.uniform3f(lu.u_offset, S.selection[0] - cam[0], S.selection[1] - cam[1], S.selection[2] - cam[2]);
      gl.uniform4f(lu.u_color, 0, 0, 0, 0.6);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.bindVertexArray(this.lineVAO);
      gl.drawArrays(gl.LINES, 0, 24);
    }

    // Kırılma çatlağı
    if (S.crack) {
      const [x, y, z, stage] = S.crack;
      const m = buildBlockMesh(B.STONE, 1, 1, TEX['crack' + stage]);
      this.setChunkUniforms(S);
      gl.uniform1f(u.u_alphaTest, 0.1);
      gl.uniform1f(u.u_sun, 1);
      gl.uniform3f(u.u_sunTint, 1, 1, 1);
      gl.uniform3f(u.u_offset, x - cam[0], y - cam[1], z - cam[2]);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.enable(gl.POLYGON_OFFSET_FILL);
      gl.polygonOffset(-1, -1);
      gl.depthMask(false);
      gl.bindVertexArray(this.itemVAO);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.itemVBO);
      gl.bufferData(gl.ARRAY_BUFFER, m.u8.subarray(0, m.n * 12), gl.DYNAMIC_DRAW);
      gl.drawElements(gl.TRIANGLES, m.n / 4 * 6, gl.UNSIGNED_INT, 0);
      gl.disable(gl.POLYGON_OFFSET_FILL);
      gl.depthMask(true);
    }

    // Bulutlar
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.CULL_FACE);
    gl.depthMask(false);
    if (S.clouds) {
      const cu = this.progCloud.u;
      gl.useProgram(this.progCloud.p);
      gl.uniformMatrix4fv(cu.u_vp, false, this.vp);
      gl.uniform3fv(cu.u_cam, cam);
      gl.uniform1f(cu.u_size, far * 1.6);
      gl.uniform1f(cu.u_cloudY, 112);
      gl.uniform1f(cu.u_time, S.time);
      gl.uniform3fv(cu.u_color, S.cloudColor);
      gl.uniform3fv(cu.u_fogColor, S.fogColor);
      gl.uniform1f(cu.u_fogEnd, far);
      gl.bindVertexArray(this.cloudVAO);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    // Yarı saydam (su, buz) — uzaktan yakına
    this.setChunkUniforms(S);
    gl.uniform1f(u.u_alphaTest, 0.01);
    gl.enable(gl.CULL_FACE);
    visible.sort((a, b) => {
      const da = (a.cx * 16 + 8 - cam[0]) ** 2 + (a.cz * 16 + 8 - cam[2]) ** 2;
      const db = (b.cx * 16 + 8 - cam[0]) ** 2 + (b.cz * 16 + 8 - cam[2]) ** 2;
      return db - da;
    });
    for (const c of visible) {
      const g = c.gpu;
      if (!g.t) continue;
      gl.uniform3f(u.u_offset, c.cx * 16 - cam[0], -cam[1], c.cz * 16 - cam[2]);
      gl.bindVertexArray(g.t.vao);
      gl.drawElements(gl.TRIANGLES, g.tc, gl.UNSIGNED_INT, 0);
      faces += g.tc / 6;
    }
    this.stats.faces = faces;

    // Parçacıklar
    if (S.particleCount) {
      gl.depthMask(true);
      gl.disable(gl.BLEND);
      const pu = this.progPart.u;
      gl.useProgram(this.progPart.p);
      gl.uniformMatrix4fv(pu.u_vp, false, this.vp);
      gl.uniform1f(pu.u_scale, this.canvas.height * 0.9);
      gl.uniform1i(pu.u_tex, 0);
      gl.bindVertexArray(this.partVAO);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.partVBO);
      gl.bufferData(gl.ARRAY_BUFFER, S.particleData.subarray(0, S.particleCount * 8), gl.DYNAMIC_DRAW);
      gl.drawArrays(gl.POINTS, 0, S.particleCount);
    }

    // El / elde tutulan blok
    if (S.hand) this.drawHand(S, aspect);
    gl.bindVertexArray(null);
    gl.depthMask(true);
  }

  drawEntities(verts, count, vp, S) {
    const gl = this.gl;
    const eu = this.progEnt.u;
    gl.useProgram(this.progEnt.p);
    gl.uniformMatrix4fv(eu.u_vp, false, vp);
    gl.uniform3fv(eu.u_fogColor, S.fogColor);
    gl.uniform2f(eu.u_fog, S.fogStart, S.fogEnd);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(this.entVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.entVBO);
    gl.bufferData(gl.ARRAY_BUFFER, verts.subarray(0, count * 9), gl.DYNAMIC_DRAW);
    gl.drawElements(gl.TRIANGLES, count / 4 * 6, gl.UNSIGNED_INT, 0);
    gl.enable(gl.CULL_FACE);
  }

  drawHand(S, aspect) {
    const gl = this.gl;
    const H = S.hand;
    gl.depthMask(true);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    M4.perspective(this.tmp2, 70 * Math.PI / 180, aspect, 0.01, 10);
    const handProj = new Float32Array(this.tmp2);
    const m = M4.create(), t = M4.create();
    const sw = H.swing, s1 = Math.sin(sw * Math.PI), s2 = Math.sin(Math.sqrt(sw) * Math.PI);
    M4.translate(m, 0.6 - s2 * 0.3 + H.bobX, -0.6 + H.bobY + s1 * 0.12 - H.lower * 0.6, -0.95 - s1 * 0.25);
    M4.rotY(t, -s2 * 0.6); M4.mul(m, m, t);
    M4.rotX(t, -s1 * 1.1); M4.mul(m, m, t);
    if (H.id) {
      const cross = H.id >= 256 || RENDER[H.id] === R_CROSS;
      M4.rotY(t, cross ? -0.4 : Math.PI / 4 + 0.25); M4.mul(m, m, t);
      M4.scale(t, 0.36, 0.36, 0.36); M4.mul(m, m, t);
      M4.translate(t, -0.5, -0.5, -0.5); M4.mul(m, m, t);
      M4.mul(m, handProj, m);
      const mesh = buildBlockMesh(H.id, H.sky, H.blk);
      this.setChunkUniforms(S);
      const u = this.progChunk.u;
      gl.uniformMatrix4fv(u.u_vp, false, m);
      gl.uniform3f(u.u_offset, 0, 0, 0);
      gl.uniform2f(u.u_fog, 1000, 2000);
      gl.uniform1f(u.u_alphaTest, 0.5);
      gl.enable(gl.DEPTH_TEST);
      gl.depthMask(true);
      gl.disable(gl.CULL_FACE);
      gl.disable(gl.BLEND);
      gl.bindVertexArray(this.itemVAO);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.itemVBO);
      gl.bufferData(gl.ARRAY_BUFFER, mesh.u8.subarray(0, mesh.n * 12), gl.DYNAMIC_DRAW);
      gl.drawElements(gl.TRIANGLES, mesh.n / 4 * 6, gl.UNSIGNED_INT, 0);
    } else {
      // Çıplak kol
      M4.translate(t, 0.12, 0.05, 0.1); M4.mul(m, m, t);
      M4.rotX(t, 0.9); M4.mul(m, m, t);
      M4.rotZ(t, -0.15); M4.mul(m, m, t);
      const verts = new Float32Array(24 * 9);
      const n = addBox(verts, 0, m, -0.13, -0.13, -0.6, 0.13, 0.13, 0.25, [0.86, 0.66, 0.5], Math.max(0.15, H.light), 4);
      gl.enable(gl.DEPTH_TEST);
      this.drawEntities(verts, n, handProj, { fogColor: S.fogColor, fogStart: 1000, fogEnd: 2000 });
    }
  }
}
