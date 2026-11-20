// Closed, twisted elliptical ribbon following a torus knot.
export function ribbonMesh(variant, rings = 144, sides = 20) {
  const vertices = [];
  const indices = [];
  const normalize = ([x, y, z]) => {
    const length = Math.hypot(x, y, z);
    return [x / length, y / length, z / length];
  };
  const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
  function center(t) {
    const lobe = 3 * t;
    const r = 0.96 + 0.44 * Math.cos(lobe);
    return [r * Math.cos(t), r * Math.sin(t), 0.54 * Math.sin(lobe)];
  }
  function surface(t, angle) {
    const point = center(t);
    const next = center(t + 0.001);
    const previous = center(t - 0.001);
    const tangent = normalize(next.map((n, i) => n - previous[i]));
    const right = normalize(cross(tangent, [0, 0, 1]));
    const up = cross(right, tangent);
    const twist = t + 0.55 * Math.sin(3 * t);
    const width = 0.48 * (0.8 + 0.2 * Math.cos(3 * t + 0.45));
    const u = width * Math.cos(angle);
    const v = (0.105 + 0.025 * Math.cos(3 * t)) * Math.sin(angle);
    return point.map((p, i) => p
      + right[i] * (u * Math.cos(twist) - v * Math.sin(twist))
      + up[i] * (u * Math.sin(twist) + v * Math.cos(twist)));
  }
  for (let ring = 0; ring <= rings; ring++) {
    const t = ring / rings * Math.PI * 2;
    for (let side = 0; side <= sides; side++) {
      const a = side / sides * Math.PI * 2;
      const point = surface(t, a);
      const dt = surface(t + 0.001, a).map((n, i) => n - point[i]);
      const da = surface(t, a + 0.001).map((n, i) => n - point[i]);
      vertices.push(...point, ...normalize(cross(dt, da)), Math.cos(a));
      if (ring < rings && side < sides) {
        const i = ring * (sides + 1) + side;
        const j = i + sides + 1;
        indices.push(i, j, i + 1, j, j + 1, i + 1);
      }
    }
  }
  return { vertices: new Float32Array(vertices), indices: new Uint16Array(indices) };
}

export const vertexShader = `
attribute vec3 position;
attribute vec3 normal;
attribute float edge;
uniform vec2 rotation;
uniform vec2 fit;
uniform float phase;
uniform float dolly;
uniform vec3 placement;
varying vec3 worldPosition;
varying vec3 worldNormal;
varying float ribbonEdge;
vec3 turn(vec3 p) {
  float a = rotation.x, b = rotation.y;
  p = vec3(p.x, cos(a)*p.y - sin(a)*p.z, sin(a)*p.y + cos(a)*p.z);
  return vec3(cos(b)*p.x + sin(b)*p.z, p.y, -sin(b)*p.x + cos(b)*p.z);
}
void main() {
  vec3 p = position;
  p.z += 0.04 * sin(3.0*p.x + phase) * cos(2.0*p.y);
  vec3 n = normal;
  n.xy -= n.z * vec2(0.12 * cos(3.0*p.x + phase) * cos(2.0*p.y),
                     -0.08 * sin(3.0*p.x + phase) * sin(2.0*p.y));
  p = turn(p);
  worldPosition = p;
  worldNormal = turn(n);
  ribbonEdge = edge;
  float w = 1.0 - dolly * .41 - p.z * .16;
  gl_Position = vec4(p.xy * fit * placement.z + placement.xy, -0.28*p.z, w);
}`;

export const fragmentShader = `
precision mediump float;
varying vec3 worldPosition;
varying vec3 worldNormal;
varying float ribbonEdge;
float panel(vec3 r, vec3 direction, float width, float height) {
  vec3 axis = normalize(cross(vec3(0.,1.,0.), direction));
  vec3 up = cross(direction, axis);
  return step(0., dot(r,direction))
    * (1.-smoothstep(width * .85,width,abs(dot(r,axis))))
    * (1.-smoothstep(height * .80,height,abs(dot(r,up))));
}
void main() {
  vec3 n = normalize(worldNormal);
  vec3 v = normalize(vec3(0.,0.,6.25) - worldPosition);
  vec3 r = reflect(-v,n);
  float key = panel(r, normalize(vec3(-.6,.82,.72)), .70, .23);
  float fill = panel(r, normalize(vec3(.92,.20,.38)), .26, .86);
  float strip = panel(r, normalize(vec3(-.31,-.6,.77)), .73, .064);
  float red = panel(r, normalize(vec3(.16,-.61,-.62)), .88, .60);
  float rim = pow(1.-max(dot(n,v),0.),3.);
  vec3 color = vec3(.025,.026,.028) + vec3(.23,.25,.28)*smoothstep(-.2,.7,r.y);
  color += key * vec3(1.25,1.19,1.08) + fill * vec3(.65,.78,.9) + strip * .68;
  color += red * vec3(1.05,.070,.035) + rim * vec3(.15,.085,.075);
  color += max(dot(n,normalize(vec3(-1.,2.,1.))),0.) * .055;
  color *= 1. - .56 * smoothstep(.69,.97,ribbonEdge);
  color += vec3(1.,.035,.012) * smoothstep(.968,.988,ribbonEdge) * .58;
  color = pow(color/(.47+color),vec3(.72));
  gl_FragColor = vec4(color,1.);
}`;

export const scenePose = {
  hero: { x: .32, y: -.33, scale: .45 }
};
