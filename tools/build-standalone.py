#!/usr/bin/env python3
"""Bundle crossy-tesla.html into one self-contained file.

Everything the page loads from ./vendor is inlined as a data: module in the
import map, so the result runs from a file:// double-click with no server and
no network. Draco-compressed .glb files are the one thing that does not
survive the trip: its decoder has to be fetched from a real directory.

    python3 tools/build-standalone.py [out.html]
"""
import base64, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'dist' / 'crossy-tesla-standalone.html'


def data_url(text_or_bytes):
    raw = text_or_bytes.encode() if isinstance(text_or_bytes, str) else text_or_bytes
    return 'data:text/javascript;base64,' + base64.b64encode(raw).decode()


def read(rel):
    return (ROOT / rel).read_text()


page = read('crossy-tesla.html')

# GLTFLoader reaches for a sibling addon by relative path, which a data: module
# cannot resolve — point it at a mapped name instead.
gltf = read('vendor/addons/loaders/GLTFLoader.js').replace(
    "from '../utils/BufferGeometryUtils.js'", "from 'x-bufferutils'")

imports = {
    'three': data_url((ROOT / 'vendor/three.module.min.js').read_bytes()),
    'x-gltfloader': data_url(gltf),
    'x-bufferutils': data_url(read('vendor/addons/utils/BufferGeometryUtils.js')),
    'x-skeletonutils': data_url(read('vendor/addons/utils/SkeletonUtils.js')),
    'x-meshopt': data_url(read('vendor/meshopt_decoder.module.js')),
}

old_map = '''<script type="importmap">
{
  "imports": {
    "three": "./vendor/three.module.min.js"
  }
}
</script>'''
if old_map not in page:
    raise SystemExit('import map not found in crossy-tesla.html — update this script')
body = ',\n'.join('    "%s": "%s"' % (k, v) for k, v in imports.items())
page = page.replace(old_map, '<script type="importmap">\n{\n  "imports": {\n%s\n  }\n}\n</script>' % body)

for path, name in [
    ('./vendor/addons/loaders/GLTFLoader.js', 'x-gltfloader'),
    ('./vendor/addons/utils/SkeletonUtils.js', 'x-skeletonutils'),
    ('./vendor/meshopt_decoder.module.js', 'x-meshopt'),
]:
    if path not in page:
        raise SystemExit('expected to find %s in the page' % path)
    page = page.replace(path, name)

page = page.replace(
    """ * Standalone page: open crossy-tesla.html over http(s) (module imports need it).
 * three.js r160 is vendored in ./vendor so the game runs offline, with no CDN.
 * See vendor/three-LICENSE.txt (MIT) for three.js and GLTFLoader.""",
    """ * Single-file build — no server, no network, no other files. Just open it.
 * three.js r160 and its loaders (MIT, https://github.com/mrdoob/three.js) are
 * embedded below as data: modules. Built by tools/build-standalone.py from
 * crossy-tesla.html; edit that file, not this one.
 * Draco-compressed .glb models are not supported in this build.""")

# Anything assets/models.json ships has to travel inside the file too.
manifest_path = ROOT / 'assets' / 'models.json'
if manifest_path.exists():
    import json
    listed = json.loads(manifest_path.read_text() or '{}')
    inline = {}
    for entry in listed.values():
        name = entry if isinstance(entry, str) else (entry or {}).get('file')
        model = ROOT / 'assets' / name if name else None
        if model and model.exists():
            inline[name] = 'data:model/gltf-binary;base64,' + base64.b64encode(model.read_bytes()).decode()
    if inline:
        inline['models.json'] = 'data:application/json;base64,' + base64.b64encode(manifest_path.read_bytes()).decode()
        blob = ',\n'.join('"%s":"%s"' % (k, v) for k, v in inline.items())
        page = page.replace('<script type="module">',
                            '<script>window.__crossyAssets={\n%s\n};</script>\n<script type="module">' % blob, 1)
        print('inlined %d shipped model(s)' % (len(inline) - 1))

# no app to go back to next to a downloaded file
page = page.replace('<a class="back" href="index.html" aria-label="Back to the app">&#8592;</a>\n  ', '')

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(page)
print('wrote %s (%.1f MB)' % (OUT, len(page) / 1048576))
