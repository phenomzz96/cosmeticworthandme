# v0.5.2 - build assets/head.glb from the pristine Blender source.
# Run: blender --background tools/blender/head-v052.blend --python tools/blender/build-character.py
#
# The .blend is treated as READ-ONLY source: every run starts from it, applies the deterministic
# steps below and writes the GLB, so the result is reproducible and the source stays editable.
# A snapshot of the built result is also saved to head-v052-built.blend for hand-editing.
#
# Steps: eyes (UV + baked iris texture), skin (UV + tone/roughness maps), hair (hair_shell.py:
#        primary shell + strand texture, and the low coil bun 'hairbun'), then export.
#
# NOTE ON SPACE: Blender is Z-up, glTF/Three.js is Y-up, and the exporter converts on write.
# Mesh-local coordinates here are therefore Blender-space: +z = up, -y = facing forward, +x = model's left.
# Anything ported from the Three.js shaders expects glTF space and must be converted first.
import bpy, math, os, sys, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hair_shell

OUT =os.path.join(os.path.dirname(bpy.data.filepath), '..', '..', 'assets', 'head.glb')
BUILT = os.path.join(os.path.dirname(bpy.data.filepath), 'head-v052-built.blend')

# ---------------------------------------------------------------- helpers
def sstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3 - 2 * t)

def mix(a, b, t):
    return a + (b - a) * t

def vget(mesh, attr='co'):
    n = len(mesh.vertices)
    a = np.empty(n * 3, dtype=np.float64)
    mesh.vertices.foreach_get(attr, a)
    return a.reshape(n, 3)

def vset(mesh, arr, attr='co'):
    mesh.vertices.foreach_set(attr, arr.reshape(-1))
    mesh.update()

# ================================================================ EYES
# Azimuthal-equidistant ("fisheye") map of the eyeball normal: front pole at the texture centre so
# the pupil is not on a UV-sphere pole. check_mapping() guards the two directions against drifting.
EYE_RES = 1024
IR, PR = 0.395, 0.145
THETA_I = math.asin(0.47)
R_I, R_MAX = 0.42, 0.5

def theta_to_r(theta):
    return np.where(theta <= THETA_I,
                    R_I * theta / THETA_I,
                    R_I + (R_MAX - R_I) * (theta - THETA_I) / (math.pi - THETA_I))

def r_to_theta(r):
    return np.where(r <= R_I,
                    r * THETA_I / R_I,
                    THETA_I + (r - R_I) * (math.pi - THETA_I) / (R_MAX - R_I))

def gltf_normal(n):
    """Blender Z-up normal -> glTF/Three.js Y-up normal."""
    return (n.x, n.z, -n.y)

def normal_to_uv(nx, ny, nz):
    theta = np.arccos(np.clip(nz, -1.0, 1.0))
    ang = np.arctan2(ny, nx)
    r = theta_to_r(theta)
    return 0.5 + r * np.cos(ang), 0.5 + r * np.sin(ang)

def check_mapping():
    for raw in ((0, 0, 1), (0, 0.6, 0.8), (-0.3, 0.2, 0.93), (0.7, 0.0, 0.71), (0, 1, 0), (0, 0, -1)):
        d = math.sqrt(sum(c * c for c in raw))
        n = tuple(c / d for c in raw)
        u, v = normal_to_uv(*[np.array(c) for c in n])
        dx, dy = u - 0.5, v - 0.5
        rr = np.hypot(dx, dy)
        th, an = r_to_theta(rr), np.arctan2(dy, dx)
        back = (np.sin(th) * np.cos(an), np.sin(th) * np.sin(an), np.cos(th))
        assert max(abs(float(a) - float(b)) for a, b in zip(n, back)) < 1e-6, (n, back)

# Iris palette: warm honey core -> mid brown -> deep outer, with a soft (never hard-outlined) limbal ring.
I_CORE = np.array([0.54, 0.385, 0.205])
I_MID  = np.array([0.395, 0.265, 0.145])
I_RIM  = np.array([0.205, 0.140, 0.098])
I_LIMB = np.array([0.105, 0.080, 0.070])
PUPIL  = np.array([0.013, 0.011, 0.011])
SCL    = np.array([0.845, 0.818, 0.783])   # warm ivory, not grey (and not paper-white)
SCL_PK = np.array([0.900, 0.735, 0.700])   # inner-corner pink
SCL_CL = np.array([0.820, 0.835, 0.870])   # faint cool cast in the lid-shadowed upper sclera

def eye_rgb(nx, ny, nz):
    """Vectorised iris/sclera. Inputs are glTF-space eyeball normals."""
    rr = np.hypot(nx, ny)
    ang = np.arctan2(ny, nx)
    t = rr / IR
    safe = np.maximum(rr, 1e-6)

    # Radial fibres: irregular (incommensurate frequencies) so they read as crypts, not a grating.
    fib = (0.52 * np.sin(ang * 47.0 + 2.1 * np.sin(ang * 6.3 + rr * 26.0))
           + 0.30 * np.sin(ang * 83.0 + 1.3 + rr * 48.0)
           + 0.18 * np.sin(ang * 139.0 + 0.7 * np.sin(ang * 3.1)))
    fib = 0.5 + 0.5 * np.clip(fib, -1.0, 1.0)
    # Fibre contrast peaks mid-iris, fades at the pupil edge and into the limbus.
    fcon = sstep(0.16, 0.45, t) * (1.0 - sstep(0.80, 1.02, t))

    base = mix(I_CORE[None, :], I_MID[None, :], sstep(0.12, 0.62, t)[:, None])
    base = mix(base, I_RIM[None, :], sstep(0.60, 0.97, t)[:, None])
    shade = (0.80 + 0.40 * fib * fcon)[:, None]
    iris = base * shade

    # Collarette: the slightly raised ring where the pupillary zone meets the ciliary zone.
    coll = (1.0 - sstep(0.0, 0.085, np.abs(t - 0.40))) * 0.34
    iris = mix(iris, I_CORE[None, :] * 1.22, coll[:, None])

    # Limbal ring: soft, dark, and kept just inside the iris edge.
    limb = sstep(0.80, 1.00, t) * (1.0 - 0.55 * sstep(1.00, 1.06, t))
    iris = mix(iris, I_LIMB[None, :], (limb * 0.62)[:, None])

    # Upper iris sits in lid shadow; keeps the eye from looking like a flat printed disc.
    lid = 1.0 - 0.34 * sstep(-0.15, 0.62, ny / safe) * sstep(0.25, 0.92, t)
    iris = iris * lid[:, None]

    # Pupil: crisp edge, near-black, with a hint of warm bounce just outside it.
    pf = 1.0 - sstep(PR - 0.010, PR + 0.006, rr)
    iris = mix(iris, I_CORE[None, :] * 0.55, (sstep(PR + 0.055, PR + 0.004, rr) * 0.30)[:, None])
    iris = mix(iris, PUPIL[None, :], pf[:, None])

    scl = SCL[None, :] * (1.0 - 0.26 * sstep(0.42, 0.98, rr))[:, None]
    scl = mix(scl, SCL_PK[None, :], (0.30 * sstep(0.66, 0.98, np.abs(nx)))[:, None])
    scl = mix(scl, SCL_CL[None, :], (0.22 * sstep(0.10, 0.70, ny / safe))[:, None])

    im = (1.0 - sstep(IR - 0.010, IR + 0.008, rr)) * (nz >= 0)
    out = mix(scl, iris, im[:, None])
    out = out * (1.0 - 0.50 * sstep(0.04, 0.42, ny))[:, None]
    return np.clip(out, 0.0, 1.0)

def build_eyes():
    check_mapping()
    obj = bpy.data.objects['eyes']
    mesh = obj.data
    uv = mesh.uv_layers[0] if mesh.uv_layers else mesh.uv_layers.new(name='UVMap')
    for poly in mesh.polygons:
        for li in poly.loop_indices:
            n = gltf_normal(mesh.vertices[mesh.loops[li].vertex_index].normal)
            u, v = normal_to_uv(*[np.array(float(c)) for c in n])
            uv.data[li].uv = (float(u), float(v))

    R = EYE_RES
    yy, xx = np.meshgrid((np.arange(R) + 0.5) / R, (np.arange(R) + 0.5) / R, indexing='ij')
    dx, dy = (xx - 0.5).ravel(), (yy - 0.5).ravel()
    r = np.hypot(dx, dy)
    th, an = r_to_theta(np.minimum(r, R_MAX)), np.arctan2(dy, dx)
    s = np.sin(th)
    rgb = eye_rgb(s * np.cos(an), s * np.sin(an), np.cos(th))
    rgb[r > R_MAX] = eye_rgb(np.array([0.0]), np.array([0.0]), np.array([-1.0]))[0]

    # pre-encoded JPEG: export uses AUTO so every texture keeps its own format (hair = WebP)
    img = hair_shell.packed_image('iris_albedo', rgb.reshape(R, R, 3), fmt='JPEG', quality=92)

    mat = bpy.data.materials['eyes']
    nt = mat.node_tree
    for n in list(nt.nodes):
        if n.type == 'TEX_IMAGE':
            nt.nodes.remove(n)
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = img
    tex.extension = 'EXTEND'
    tex.location = (bsdf.location.x - 300, bsdf.location.y)
    nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 0.38
    bsdf.inputs['Coat Weight'].default_value = 1.0
    bsdf.inputs['Coat Roughness'].default_value = 0.045
    bsdf.inputs['Specular IOR Level'].default_value = 0.5
    print('eyes: iris texture', R, 'px')

# ================================================================ SKIN
# Cylindrical UVs about the vertical axis, seam at the back of the head (under the hair).
# Only LOW-frequency skin work is baked here - tone variation and roughness zoning - because those
# are smooth and compress to a few hundred KB. The high-frequency pore grain is done analytically
# in the Three.js skin shader instead: a pore map fine enough to read on screen would cost several
# MB of PNG for sub-pixel detail, which is a bad trade for a web app.
SKIN_RES = 1024

def gauss(x, s):
    return np.exp(-(x / s) ** 2)

def build_skin():
    obj = bpy.data.objects['skin']
    mesh = obj.data
    co = vget(mesh)
    z0, z1 = co[:, 2].min(), co[:, 2].max()
    ang = np.arctan2(co[:, 0], -co[:, 1])
    uu = ang / (2 * math.pi) + 0.5
    vv = (co[:, 2] - z0) / (z1 - z0)

    uv = mesh.uv_layers[0] if mesh.uv_layers else mesh.uv_layers.new(name='UVMap')
    nl = len(mesh.loops)
    lv = np.empty(nl, dtype=np.int32)
    mesh.loops.foreach_get('vertex_index', lv)
    lu, lvv = uu[lv].copy(), vv[lv]
    # Seam fix: a polygon straddling the back seam must not interpolate the long way round.
    for poly in mesh.polygons:
        idx = list(poly.loop_indices)
        us = lu[idx]
        if us.max() - us.min() > 0.5:
            for k in idx:
                if lu[k] < 0.5:
                    lu[k] += 1.0
    flat = np.empty(nl * 2, dtype=np.float32)
    flat[0::2] = lu
    flat[1::2] = lvv
    uv.data.foreach_set('uv', flat)

    R = SKIN_RES
    vg, ug = np.meshgrid((np.arange(R) + 0.5) / R, (np.arange(R) + 0.5) / R, indexing='ij')
    a = (ug - 0.5) * 2 * math.pi
    z = z0 + vg * (z1 - z0)
    aa = np.abs(a)

    tzone = gauss(a, 0.34) * sstep(-0.52, -0.30, z) * (1.0 - sstep(0.46, 0.64, z))
    cheek = gauss(aa - 0.48, 0.21) * gauss(z + 0.28, 0.24)
    nose = gauss(a, 0.17) * gauss(z + 0.17, 0.19)
    lips = gauss(a, 0.27) * gauss(z + 0.635, 0.055)
    chin = gauss(a, 0.29) * gauss(z + 0.86, 0.09)
    ears = gauss(aa - 1.36, 0.20) * gauss(z + 0.10, 0.22)
    fore = gauss(a, 0.42) * gauss(z - 0.40, 0.15)

    # Large, very soft mottling so the skin is never a perfectly even wash.
    mot = (0.5 * np.sin(11.0 * a + 2.0 * np.sin(5.0 * z)) * np.sin(7.0 * z + 1.1)
           + 0.5 * np.sin(17.0 * z + 0.6) * np.sin(9.0 * a + 2.3))

    # Albedo: multiplier only ever <= 1 so it fits an 8-bit image with no exposure compensation.
    alb = np.ones((R, R, 3))
    warm = np.clip(0.55 * cheek + 0.42 * nose + 0.60 * ears + 0.30 * chin, 0, 1)
    alb[..., 1] -= 0.045 * warm
    alb[..., 2] -= 0.062 * warm
    alb[..., 0] -= 0.016 * fore
    alb[..., 1] -= 0.006 * fore
    alb -= (0.013 * (0.5 + 0.5 * mot))[..., None]
    alb = np.clip(alb, 0.86, 1.0)

    # Roughness multiplier around 1.0: oilier T-zone and lips, softer cheeks.
    rgh = np.ones((R, R))
    rgh -= 0.15 * tzone + 0.10 * nose + 0.22 * lips
    rgh += 0.08 * cheek + 0.04 * ears
    rgh += 0.030 * mot
    rgh = np.clip(rgh, 0.70, 1.18) / 1.18   # normalised; base roughness restored in Three.js

    def mkimg(name, data, srgb):
        rgb = data if data.ndim == 3 else np.repeat(data[..., None], 3, axis=2)
        return hair_shell.packed_image(name, rgb, fmt='JPEG', quality=92,
                                       colorspace='sRGB' if srgb else 'Non-Color')

    a_img = mkimg('skin_albedo', alb, True)
    # glTF metallic-roughness layout (G = roughness, B = metallic = 0): the exporter can then reuse
    # this JPEG as-is instead of synthesising a new image (which AUTO format writes as PNG, 5x larger).
    r_img = mkimg('skin_rough', np.stack([rgh, rgh, np.zeros_like(rgh)], axis=-1), False)

    mat = bpy.data.materials['skin']
    nt = mat.node_tree
    for n in list(nt.nodes):
        if n.type == 'TEX_IMAGE':
            nt.nodes.remove(n)
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    for i, (img, sock) in enumerate(((a_img, 'Base Color'), (r_img, 'Roughness'))):
        tx = nt.nodes.new('ShaderNodeTexImage')
        tx.image = img
        tx.location = (bsdf.location.x - 420, bsdf.location.y - i * 330)
        if sock == 'Roughness':
            # Roughness from the G channel (glTF layout). Linking the full colour makes the exporter
            # synthesise a new metallic-roughness image, which AUTO image format then writes as PNG.
            sep = nt.nodes.new('ShaderNodeSeparateColor')
            sep.location = (bsdf.location.x - 200, bsdf.location.y - i * 330)
            nt.links.new(tx.outputs['Color'], sep.inputs['Color'])
            nt.links.new(sep.outputs['Green'], bsdf.inputs[sock])
            nt.links.new(sep.outputs['Blue'], bsdf.inputs['Metallic'])
        else:
            nt.links.new(tx.outputs['Color'], bsdf.inputs[sock])
    print('skin: UV + albedo/roughness maps', R, 'px   ROUGH_NORM', round(1.18, 3))

# ================================================================ MOUTH
# The mouth cavity (a dark ellipsoid behind the lip slit, built by build-hair.mjs into the 'brows' mesh so
# nothing shows through the slit) was near-black: the closed mouth read as a hard black line with black
# corners. Lift it to a deep warm shadow tone. Only cavity vertices change; brows/lashes are untouched.
CAVITY_RGB = (0.30, 0.15, 0.13)

def soften_mouth_cavity():
    obj = bpy.data.objects['brows']; me = obj.data; M = obj.matrix_world
    lm = bpy.data.objects['head']['landmarks'].to_dict()['mouth']
    c = np.array([0.0, lm[1] + 0.015, lm[2] - 0.19]); r = np.array([0.21, 0.05, 0.11]) * 1.15   # as build-hair.mjs
    co = np.array([[w.x, w.z, -w.y] for w in (M @ v.co for v in me.vertices)])                # Blender -> glTF
    inside = (((co - c) / r) ** 2).sum(1) <= 1.0
    ca = me.color_attributes['Color']
    n = len(ca.data); buf = np.empty(n * 4, np.float32); ca.data.foreach_get('color', buf); buf = buf.reshape(n, 4)
    vi = (np.arange(len(me.vertices)) if ca.domain == 'POINT'
          else np.array([l.vertex_index for l in me.loops], dtype=np.int64))
    sel = inside[vi]
    before = buf[sel, :3].mean(0) if sel.any() else None
    buf[sel, :3] = CAVITY_RGB
    ca.data.foreach_set('color', buf.ravel())
    print(f'mouth cavity: {int(inside.sum())} verts recoloured (was mean {np.round(before, 3) if before is not None else "-"})')

# ================================================================ export
def clean_scene():
    for name in ('Cube', 'Camera', 'Light'):
        o = bpy.data.objects.get(name)
        if o:
            bpy.data.objects.remove(o, do_unlink=True)

def export_glb():
    bpy.ops.export_scene.gltf(
        filepath=os.path.abspath(OUT),
        export_format='GLB',
        use_selection=False,
        export_yup=True,
        # AUTO keeps each packed image's own format: skin/eye maps are pre-encoded JPEG q92,
        # hair maps WebP (EXT_texture_webp, decoded by Three.js r160 GLTFLoader - verified).
        export_image_format='AUTO',
        export_materials='EXPORT',
        export_extras=True,
        export_attributes=True,
    )

clean_scene()
build_eyes()
build_skin()
hair_shell.build()
soften_mouth_cavity()
export_glb()
bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(BUILT), copy=True)
print('DONE', os.path.getsize(os.path.abspath(OUT)), 'bytes')
