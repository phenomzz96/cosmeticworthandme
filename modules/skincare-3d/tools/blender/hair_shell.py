# v0.5.2 hair, checkpoint 1: primary hair SHELL (replaces the 0.5.1 ribbon stack + the 0.5.2 overlay).
# Imported by build-character.py. Works in glTF space (x, y = up, z = forward) and converts to
# Blender (x, -z, y) only when writing mesh data.
#
# Design:
#  * ONE welded quad grid conforming to the scalp: columns are comb paths from the hairline into the
#    low bun, rows run along each path. No stacked sheets, no gaps, a clean silhouette.
#  * UV u = across the strands (columns), v = arc length along them, so a tileable strand texture and
#    the material's anisotropic highlight both follow the real flow direction.
#  * Normals are the shell's own smooth normals (no blending toward scalp normals).
#  * The 0.5.1 hairline curve, bun anchor and _HAIR scalp mask are reused unchanged, so the 2D
#    fallback and the stored `extras.hair` data stay valid.
# Checkpoint 2 adds "hairbun": a single coil-dome mesh seated on the shell (see build_bun).
import bpy, bmesh, math, os, tempfile
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

N_A, N_T = 208, 64          # columns around the head, rows along each comb path
U_REP, V_LEN = 12, 0.48     # texture repeats around the head; glTF units of strand length per tile
TEX = 1024
C = Vector((0.0, 0.18, 0.0))                 # skull centre used for scalp raycasts (as build-hair.mjs)
BUN_DIR = Vector((0.0, -0.36, -1.0)).normalized()

def b2g(v): return Vector((v[0], v[2], -v[1]))
def g2b(v): return (v[0], -v[2], v[1])
def sm(a, b, x):
    t = min(1.0, max(0.0, (x - a) / (b - a))); return t * t * (3 - 2 * t)

# ------------------------------------------------------------------ scalp + hairline
class Scalp:
    def __init__(self, skin):
        M = skin.matrix_world
        V = [b2g(M @ v.co) for v in skin.data.vertices]
        self.T = BVHTree.FromPolygons(V, [tuple(p.vertices) for p in skin.data.polygons])

    def hit(self, d):
        loc, n, _, _ = self.T.ray_cast(C, d, 4.0)
        if loc is None:
            return None
        return loc, (n if n.dot(d) > 0 else -n)

def hairline_fn(HL):
    def y0(al):
        a = abs(al)
        for k in range(1, len(HL)):
            if a <= HL[k][0]:
                (a0, v0), (a1, v1) = HL[k - 1], HL[k]
                return v0 + (v1 - v0) * (a - a0) / (a1 - a0)
        return HL[-1][1]
    # same deterministic wiggle as build-hair.mjs, so the shell edge sits on the established hairline
    return lambda al: (y0(al) + 0.010 * math.sin(5.1 * al + 0.6) + 0.007 * math.sin(13.7 * al + 1.9)
                       + 0.005 * math.sin(29 * abs(al) + 0.3) + 0.003 * math.sin(67 * al + 2.2))

def dir_az(al, el):
    return Vector((math.sin(al) * math.cos(el), math.sin(el), math.cos(al) * math.cos(el)))

def start_dir(scalp, hy, al, dy):
    a, b = -1.3, 1.45
    for _ in range(40):
        m = (a + b) / 2
        h = scalp.hit(dir_az(al, m))
        if h is None or h[0].y < hy(al) + dy:
            a = m
        else:
            b = m
    return dir_az(al, (a + b) / 2)

# ------------------------------------------------------------------ shell geometry
def lateral(al):
    # gentle, smooth S-drift of the comb lines: strands do not run on perfect meridians
    return 0.11 * math.sin(2 * al + 0.5) + 0.05 * math.sin(5 * al + 1.3)

def ridge(al, t):
    r = 0.55 * math.sin(23 * al + 0.7) + 0.30 * math.sin(37 * al + 2.1) + 0.15 * math.sin(61 * al + 4.0)
    return r * (0.75 + 0.25 * math.sin(9 * t + 2 * al))

def build_grid(scalp, hy):
    P = np.zeros((N_A, N_T, 3)); AO = np.ones((N_A, N_T)); S = np.zeros((N_A, N_T)); TT = np.zeros(N_T)
    EA = np.ones((N_A, N_T))      # edge ramp (vertex-colour alpha): 0 at the hairline -> 1 inside the hair
    misses = 0
    for i in range(N_A):
        al = -math.pi + (i + 0.5) / N_A * 2 * math.pi
        d0 = start_dir(scalp, hy, al, -0.035)
        mid = (d0 + BUN_DIR + Vector((0, 1.3 * max(0.2, math.cos(al / 2)), 0))).normalized()
        m2 = mid * 2 - (d0 + BUN_DIR) * 0.5 + d0.cross(BUN_DIR) * lateral(al)
        prev = None
        for j in range(N_T):
            # run almost to the bun anchor: stopping at 0.93 left a dark ring of bare scalp around the bun
            t = (j / (N_T - 1)) ** 1.35 * 0.99
            TT[j] = t
            d = (d0 * (1 - t) ** 2 + m2 * (2 * t * (1 - t)) + BUN_DIR * (t * t)).normalized()
            h = scalp.hit(d)
            if h is None:
                misses += 1; h = prev
            prev = h
            p, n = h
            rad = (p - C).normalized()
            od = (n * 0.6 + rad * 0.4).normalized()
            e = p.y - hy(math.atan2(p.x, p.z))                  # height above the hairline
            full = (0.020 + 0.030 * sm(0.30, 0.92, p.y) + 0.006 * sm(0.4, 0.9, abs(p.x))) * (1 - 0.40 * sm(0.75, 0.93, t))
            # Hair lies FLAT at the hairline and builds volume over ~3 cm. Reaching full thickness
            # within the first few mm reads as the rolled lip of a wig cap.
            thick = 0.004 + (full - 0.004) * sm(0.03, 0.32, e)
            thick += 0.0045 * ridge(al, t) * sm(0.08, 0.25, e)
            k = sm(0.0, 0.025, e)                                # emerge flush from under the skin
            off = -0.003 * (1 - k) + thick * k
            P[i, j] = p + od * off
            AO[i, j] = 1.0 - 0.40 * sm(0.70, 0.93, t)
            # Feathered hairline: the viewer cuts strands out of this band strand-by-strand (texture
            # alpha = per-strand cut-off), so the hard cut line becomes thinning hair ends over the
            # darkened scalp. Widest above the ears (the harshest edge), medium at the nape, subtle
            # at the forehead.
            ap = abs(math.atan2(p.x, p.z))
            ear = sm(0.90, 1.15, ap) * (1 - sm(1.95, 2.25, ap))
            band = 0.09 + 0.06 * ear + 0.02 * sm(2.2, 2.6, ap)
            EA[i, j] = sm(0.0, band, e)
    # arc length along each comb path (drives v)
    seg = np.linalg.norm(np.diff(P, axis=1), axis=2)
    S[:, 1:] = np.cumsum(seg, axis=1)
    return P, AO, S, misses, EA

def make_mesh(P, AO, S, mat, EA=None):
    idx = lambda i, j: (i % N_A) * N_T + j
    verts = [g2b(P[i, j]) for i in range(N_A) for j in range(N_T)]
    faces, fuv = [], []
    for i in range(N_A):
        for j in range(N_T - 1):
            q = (idx(i, j), idx(i + 1, j), idx(i + 1, j + 1), idx(i, j + 1))
            u0, u1 = i / N_A * U_REP, (i + 1) / N_A * U_REP      # seam: last column gets u = U_REP
            i1 = (i + 1) % N_A
            uv = [(u0, S[i, j] / V_LEN), (u1, S[i1, j] / V_LEN), (u1, S[i1, j + 1] / V_LEN), (u0, S[i, j + 1] / V_LEN)]
            faces.append(q); fuv.append(uv)
    # orient outward: test one face against the radial direction
    a, b, c = (Vector(P[0, N_T // 2]), Vector(P[1, N_T // 2]), Vector(P[1, N_T // 2 + 1]))
    flip = (b - a).cross(c - a).dot(a - C) < 0
    if flip:
        faces = [tuple(reversed(f)) for f in faces]; fuv = [list(reversed(u)) for u in fuv]
    me = bpy.data.meshes.new('hair')
    me.from_pydata(verts, [], faces)
    me.update()
    for p in me.polygons:
        p.use_smooth = True
    uvl = me.uv_layers.new(name='UVMap')
    for p, uv in zip(me.polygons, fuv):
        for li, val in zip(p.loop_indices, uv):
            uvl.data[li].uv = val
    ca = me.color_attributes.new(name='Color', type='FLOAT_COLOR', domain='POINT')
    col = np.ones((N_A * N_T, 4), np.float32)
    col[:, :3] = AO.reshape(-1)[:, None]
    ca.data.foreach_set('color', col.ravel())
    if EA is not None:
        # exported as custom attribute _EDGE (the glTF exporter drops vertex-colour alpha it sees as unused)
        ea = me.attributes.new(name='_EDGE', type='FLOAT', domain='POINT')
        ea.data.foreach_set('value', EA.reshape(-1).astype(np.float32))
    me.materials.append(mat)
    return me, flip

# ------------------------------------------------------------------ strand texture
def pnoise(x, n, rng):
    """Periodic 1-D value noise with n lattice points over [0,1)."""
    vals = rng.random(n)
    xs = np.mod(x, 1.0) * n
    i0 = np.floor(xs).astype(np.int64) % n
    f = xs - np.floor(xs); f = f * f * (3 - 2 * f)
    return vals[i0] * (1 - f) + vals[(i0 + 1) % n] * f

def strand_albedo(R=TEX, seed=7):
    """Tileable dark-brown strand texture: columns = across strands, rows = along strands."""
    rng = np.random.default_rng(seed)
    U, V = np.meshgrid((np.arange(R) + 0.5) / R, (np.arange(R) + 0.5) / R)
    # Combed hair is nearly straight: only a slight drift. Strong sinusoidal wander plus high
    # contrast read as wood grain (first attempt), not hair.
    warp = (0.0025 * np.sin(2 * np.pi * (V + pnoise(U, 6, rng)))
            + 0.0012 * np.sin(2 * np.pi * (3 * V + pnoise(U, 17, rng))))
    clump = pnoise(U + warp, 22, rng)                          # soft sections of hair
    strand = pnoise(U + 1.4 * warp, 240, rng)                  # individual strand groups
    fine = pnoise(U + 1.8 * warp, 640, rng)                    # single-strand grain
    L = 0.35 * clump + 0.35 * strand + 0.30 * fine
    L = (L - L.mean()) / L.std()
    sheen = 0.04 * np.sin(2 * np.pi * (V + pnoise(U, 22, rng)))  # very soft light-catching along length
    val = np.clip(1.0 + 0.13 * L + sheen, 0.72, 1.28)
    warmth = pnoise(U + warp, 22, rng) - 0.5
    base = np.array([0.228, 0.150, 0.100])                    # dark brown (sRGB), measured in-render
    rgb = base[None, None, :] * val[..., None]
    rgb[..., 0] *= 1 + 0.05 * warmth
    rgb[..., 2] *= 1 - 0.05 * warmth
    # Alpha = per-strand cut-off for the feathered hairline (constant along a strand, varying across
    # strands, with a slow change along the length so wisps end at different points). Separate RNG so
    # the colour channels stay identical to the accepted texture.
    rng2 = np.random.default_rng(seed + 100)
    s = (0.55 * pnoise(U + 1.4 * warp, 260, rng2) + 0.45 * pnoise(U + 1.8 * warp, 700, rng2)
         + 0.12 * np.sin(2 * np.pi * (2 * V + pnoise(U, 50, rng2))))
    s = (s - s.min()) / (s.max() - s.min())
    s = np.round(s * 15) / 15        # 16 levels: enough for a cut-off, and WebP stores alpha losslessly
    return np.concatenate([np.clip(rgb, 0, 1), s[..., None]], axis=-1)

def packed_image(name, rgb, fmt='WEBP', quality=90, colorspace='sRGB'):
    R = rgb.shape[0]; has_a = rgb.shape[2] == 4
    img = bpy.data.images.new(name + '_src', R, R, alpha=has_a)
    px = np.ones((R, R, 4), np.float32); px[..., :rgb.shape[2]] = rgb
    img.pixels = px.ravel()
    path = os.path.join(tempfile.mkdtemp(), name + ('.webp' if fmt == 'WEBP' else '.jpg'))
    img.filepath_raw = path; img.file_format = fmt
    img.save(quality=quality)
    bpy.data.images.remove(img)
    out = bpy.data.images.load(path); out.pack(); out.name = name
    out.colorspace_settings.name = colorspace
    return out

def shell_material(img):
    mat = bpy.data.materials.new('hair_shell')
    mat.use_nodes = True
    nt = mat.node_tree; bsdf = nt.nodes['Principled BSDF']
    tx = nt.nodes.new('ShaderNodeTexImage'); tx.image = img
    ca = nt.nodes.new('ShaderNodeVertexColor'); ca.layer_name = 'Color'
    mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.blend_type = 'MULTIPLY'
    mx.inputs['Factor'].default_value = 1.0
    nt.links.new(tx.outputs['Color'], mx.inputs['A'])
    nt.links.new(ca.outputs['Color'], mx.inputs['B'])
    nt.links.new(mx.outputs['Result'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 0.42
    return mat

# ------------------------------------------------------------------ low bun (checkpoint 2)
# Replaces the 0.5.1 bun (ellipsoid core + 14 open plate-ribbons + 4 stray ribbon ends).
# A CONTINUOUS dome whose surface is shaped into pressed coil wraps:
#  * rounded crests with crease lines along an Archimedean spiral (~2.3 turns) = hair wound into a bun;
#  * spiral-strip TOPOLOGY: the mesh is one strip wound along the spiral, consecutive turns sharing
#    their crease vertices, so every crease is an edge loop (creases cut diagonally across a ring
#    mesh rendered as staircase highlights); the centre is a ringed patch, not a fan (fan = starburst);
#  * UVs follow the wraps; one texture tile per wrap makes the u-seam an exact integer jump (invisible);
#  * the rim is raycast onto the ACTUAL shell surface and sunk into it: no hollow, no dark crescent.
# Tried and rejected (see checkpoint-2 report): a plain dome with UVs around its axis (smooth egg,
# onion rings, starburst pole) and a coiled tube (read as a loose spring / snail shell at oblique angles).
# Local frame at the bun anchor: a = scalp normal (outward), ex/ey span the footprint.
BUN_RX, BUN_RY, BUN_H = 0.26, 0.205, 0.20   # footprint semi-axes and height above the shell
BUN_P = 2.2                                  # superellipse profile: rounded top, steep sides
BUN_NTU, BUN_M = 64, 6                       # samples per turn along the spiral, across one wrap
BUN_TURNS = 2.3                              # visible wraps
BUN_CREASE = 0.022                           # depth of the crease between wraps
BUN_EMBED = 0.004                            # rim sunk into the shell surface
BUN_TWIST = 0.10                             # strands slightly diagonal to the wraps
BUN_VLEN = 0.48                              # strand-length scale of the shell texture

def shell_bvh(P):
    V = [Vector(P[i, j]) for i in range(N_A) for j in range(N_T)]
    F = [(i * N_T + j, ((i + 1) % N_A) * N_T + j, ((i + 1) % N_A) * N_T + j + 1, i * N_T + j + 1)
         for i in range(N_A) for j in range(N_T - 1)]
    return BVHTree.FromPolygons(V, F)

def build_bun(scalp, P, mat):
    O, a = scalp.hit(BUN_DIR)
    a = a.normalized()
    ex = Vector((0.0, 1.0, 0.0)).cross(a).normalized()
    ey = a.cross(ex).normalized()
    shell = shell_bvh(P)

    def base(X, Y):
        """Height of the shell surface above the anchor plane at footprint point (X, Y)."""
        q = O + ex * X + ey * Y
        loc, _, _, _ = shell.ray_cast(q + a * 0.8, -a, 1.6)
        if loc is None:
            h = scalp.hit((q - C).normalized())
            return (h[0] - O).dot(a) + 0.012 if h else 0.0
        return (loc - O).dot(a)

    th0 = -math.pi / 2                       # coil start / tail and UV seam at the underside

    def surf(w, thp):
        """Undisplaced dome point at meridian coordinate w (0 centre .. 1 rim) and angle thp."""
        th = thp + th0
        m = 1 + 0.035 * math.sin(2 * th + 0.7) + 0.02 * math.sin(3 * th + 2.1)   # soft, irregular outline
        H = BUN_H * (1 + 0.04 * math.sin(th + 0.3))
        psi = min(1.0, max(0.0, w)) * math.pi / 2
        rho = math.sin(psi) ** (2 / BUN_P); zn = math.cos(psi) ** (2 / BUN_P)
        X, Y = BUN_RX * m * rho * math.cos(th), BUN_RY * m * rho * math.sin(th)
        return O + ex * X + ey * Y + a * (base(X, Y) + (H + BUN_EMBED) * zn - BUN_EMBED)

    # ---- spiral-strip topology: mesh lines follow the wraps, so every crease is an edge loop
    NTU, M = BUN_NTU, BUN_M
    K = int(round(NTU * BUN_TURNS)); Teff = K / NTU
    win = lambda k: (k / NTU) / Teff                     # inner edge of the wrap at sample k
    wout = lambda k: min(win(k) + 1 / Teff, 1.0)         # outer edge (= next turn's inner edge, or the rim)
    verts, info, ids = [], [], {}
    def add(p, w, thp, cr):
        verts.append(p); info.append((w, thp, cr)); return len(verts) - 1
    CENTER = add(surf(0.0, 0.0), 0.0, 0.0, 1.0)
    TIP = add(surf(1.0, 2 * math.pi * K / NTU), 1.0, 2 * math.pi * K / NTU, 0.0)
    def S(k, m):
        if k == K: return TIP
        if m == M and k + NTU <= K: return S(k + NTU, 0)
        if k == 0 and m == 0: return CENTER
        key = ('s', k, m)
        if key not in ids:
            w = win(k) + (wout(k) - win(k)) * m / M; thp = 2 * math.pi * k / NTU
            ids[key] = add(surf(w, thp), w, thp, math.sqrt(math.sin(math.pi * m / M)))
        return ids[key]
    def R(k, r):                              # centre patch inside the first turn: rings, not a fan
        if r == 0 or k == 0: return CENTER
        if r == M: return S(k, 0)
        if k == NTU: return S(0, r)
        key = ('r', k, r)
        if key not in ids:
            w = win(k) * r / M; thp = 2 * math.pi * k / NTU
            # rounded crest AT the centre (the tucked end reads as a small knob); a crease there
            # read as a dark puckered navel
            ids[key] = add(surf(w, thp), w, thp, math.sqrt(math.cos(math.pi / 2 * r / M)))
        return ids[key]
    faces, corners = [], []
    def quad(vs, cs):
        seen, fv, fc = set(), [], []
        for v, c in zip(vs, cs):
            if v not in seen: seen.add(v); fv.append(v); fc.append(c)
        if len(fv) >= 3: faces.append(tuple(fv)); corners.append(fc)
    for k in range(K):
        for m in range(M):
            quad((S(k, m), S(k + 1, m), S(k + 1, m + 1), S(k, m + 1)),
                 (('s', k, m), ('s', k + 1, m), ('s', k + 1, m + 1), ('s', k, m + 1)))
    for k in range(NTU):
        for r in range(M):
            quad((R(k, r), R(k + 1, r), R(k + 1, r + 1), R(k, r + 1)),
                 (('r', k, r), ('r', k + 1, r), ('r', k + 1, r + 1), ('r', k, r + 1)))
    f = faces[len(faces) // 3]
    p0, p1, p2 = (verts[i] for i in f[:3])
    flip = (p1 - p0).cross(p2 - p0).dot(p0 - O) < 0
    if flip:
        faces = [tuple(reversed(x)) for x in faces]; corners = [list(reversed(c)) for c in corners]

    me = bpy.data.meshes.new('hairbun')
    me.from_pydata([g2b(v) for v in verts], [], faces); me.update()
    for p in me.polygons: p.use_smooth = True

    # ---- wraps: rounded crest, crease exactly on the edge loops (displaced along smooth normals)
    nrm = np.array([list(b2g(v.normal)) for v in me.vertices])
    co = np.array([list(v) for v in verts])
    wv = np.array([x[0] for x in info]); crest = np.array([x[2] for x in info])
    # crease applied right up to the rim: fading it there left the outer wrap flat, a "saucer" ledge;
    # with it, the last wrap rolls down into the hair (the rim stays embedded, so no gap can open)
    fade = np.array([sm(0.0, 0.18, x) for x in wv])
    co = co - nrm * (BUN_CREASE * (1 - crest) * fade)[:, None]
    for k, v in enumerate(me.vertices):
        v.co = g2b(co[k])
    me.update()

    # ---- UVs: v = length along the spiral, u = across the wrap (one tile per wrap: u-seam is an exact
    # integer jump, so the strand texture is continuous); the centre patch continues the wrap at u in [-1, 0]
    vk = [0.0]
    for k in range(1, K + 1):
        wm = lambda kk: win(kk) + 0.5 * (wout(kk) - win(kk))
        vk.append(vk[-1] + (surf(wm(k), 2 * math.pi * k / NTU) - surf(wm(k - 1), 2 * math.pi * (k - 1) / NTU)).length)
    vk = [x / BUN_VLEN for x in vk]
    def uv(c):
        kind, k, m = c
        # centre patch v is shifted so it continues the strip across the coil's start line; its
        # remaining v-jump then falls on the first wrap's crease, where a break looks natural
        v = vk[k] if kind == 's' else vk[k] - vk[NTU]
        u = m / M if kind == 's' else -1 + m / M
        return (u + BUN_TWIST * v, v)
    uvl = me.uv_layers.new(name='UVMap')
    for poly, cs in zip(me.polygons, corners):
        for li, c in zip(poly.loop_indices, cs):
            uvl.data[li].uv = uv(c)

    # ---- AO: creases darker, soft contact shadow at the rim, tucked centre
    ao = ((0.70 + 0.30 * (crest * fade + (1 - fade)))
          * (1 - np.array([0.22 * sm(0.82, 1.0, x) for x in wv]))
          * (1 - np.array([0.06 * (1 - sm(0.0, 0.15, x)) for x in wv])))
    ca = me.color_attributes.new(name='Color', type='FLOAT_COLOR', domain='POINT')
    col = np.ones((len(verts), 4), np.float32); col[:, :3] = ao[:, None]
    ca.data.foreach_set('color', col.ravel())

    # Triangulate HERE rather than leaving it to the glTF exporter: near the coil centre some quads
    # are strongly skewed, and the exporter's fixed diagonal folded two tiny triangles over (a dark
    # notch in the render). BEAUTY picks the diagonal that keeps the triangles well-shaped.
    bm = bmesh.new(); bm.from_mesh(me)
    bmesh.ops.triangulate(bm, faces=bm.faces[:], quad_method='BEAUTY', ngon_method='BEAUTY')
    bm.to_mesh(me); bm.free(); me.update()
    # Known: one sub-pixel sliver (~0.0006 units) remains at the coil's start cusp; collapsing short
    # edges there (dissolve_degenerate) was tried and produced MORE folded slivers, so it is left.
    # self-check on the FINAL triangles: winding vs own smooth normals (folded / inverted)
    bad = sum(1 for p in me.polygons
              if p.normal.dot(sum((me.vertices[i].normal for i in p.vertices), Vector())) < 0)
    print(f'hair bun self-check: {bad} inverted triangles of {len(me.polygons)}')
    me.materials.append(mat)
    return me, flip

# ------------------------------------------------------------------ entry point
def build():
    head = bpy.data.objects['head']
    hd = head['hair'].to_dict()
    hy = hairline_fn(hd['hairline'])
    scalp = Scalp(bpy.data.objects['skin'])

    old = bpy.data.objects['hair']; old.name = 'hair_old'
    old.data.name = 'hair_old'   # free the MESH name too: glTF mesh names come from mesh data, and tests key on 'hair'
    bpy.data.objects.remove(old, do_unlink=True)   # 0.5.1 ribbons + bun: fully replaced
    # 0.5.1 alpha-blended fringe strip: the shell's own feathered edge replaces it (left in, it showed
    # as blurry streaks under the new edge). Still present in the source .blend.
    fr = bpy.data.objects.get('hairline')
    if fr:
        bpy.data.objects.remove(fr, do_unlink=True)

    P, AO, S, misses, EA = build_grid(scalp, hy)
    img = packed_image('hair_strands', strand_albedo())
    mat = shell_material(img)
    me, flip = make_mesh(P, AO, S, mat, EA)
    ob = bpy.data.objects.new('hair', me)
    ob.parent = head
    bpy.context.scene.collection.objects.link(ob)

    bme, bflip = build_bun(scalp, P, mat)          # same material -> same texture, colour and highlight
    bob = bpy.data.objects.new('hairbun', bme)
    bob.parent = head
    bpy.context.scene.collection.objects.link(bob)

    hd['tool'] = 'tools/blender/hair_shell.py (vỏ tóc + chân tóc mềm + búi); lông mày/mi: tools/build-hair.mjs'
    hd['bun']['mesh'] = {'type': 'coiled dome', 'rx': BUN_RX, 'ry': BUN_RY, 'h': BUN_H,
                         'turns': BUN_TURNS}   # 'c' (anchor) and 'r' unchanged for compatibility
    head['hair'] = hd
    print(f'hair shell: {len(me.vertices)} verts, {len(me.polygons)} quads, scalp misses {misses}, winding flipped {flip}')
    print(f'hair bun: {len(bme.vertices)} verts, {len(bme.polygons)} polys, '
          f'{sum(len(p.vertices) - 2 for p in bme.polygons)} tris, winding flipped {bflip}')
