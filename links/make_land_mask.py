"""Строит маску суши для глобуса (сетка 2°, 1 бит на клетку, base64).

python3 links/make_land_mask.py land-110m.json > links/assets/land-mask.b64
land-110m.json — из npm-пакета world-atlas@2.0.2 (Natural Earth).
"""
import json, sys, base64
t = json.load(open(sys.argv[1]))
sx, sy = t["transform"]["scale"]; tx, ty = t["transform"]["translate"]
arcs = []
for a in t["arcs"]:
    x = y = 0; pts = []
    for dx, dy in a:
        x += dx; y += dy; pts.append((x*sx+tx, y*sy+ty))
    arcs.append(pts)
def ring(ids):
    out = []
    for i in ids:
        pts = arcs[i] if i >= 0 else arcs[~i][::-1]
        out.extend(pts if not out else pts[1:])
    return out
rings = []
for g in t["objects"]["land"]["geometries"]:
    polys = g["arcs"] if g["type"] == "MultiPolygon" else [g["arcs"]]
    for p in polys:
        for r in p: rings.append(ring(r))
# bucket edges by latitude band for speed
STEP = 2
rows, cols = 180//STEP, 360//STEP
edges = [(r[i], r[(i+1) % len(r)]) for r in rings for i in range(len(r))]
bits = []
for j in range(rows):
    lat = 90 - STEP/2 - j*STEP
    row_edges = [e for e in edges if (e[0][1] > lat) != (e[1][1] > lat)]
    xs = sorted(e[0][0] + (lat-e[0][1])*(e[1][0]-e[0][0])/(e[1][1]-e[0][1]) for e in row_edges)
    for i in range(cols):
        lon = -180 + STEP/2 + i*STEP
        bits.append(sum(1 for x in xs if x > lon) % 2)
by = bytearray()
for k in range(0, len(bits), 8):
    v = 0
    for b in bits[k:k+8]: v = (v << 1) | b
    by.append(v)
print(base64.b64encode(bytes(by)).decode())
# ASCII-превью в stderr
for j in range(0, rows, 3):
    print("".join("#" if bits[j*cols+i] else "." for i in range(0, cols, 2)), file=sys.stderr)
