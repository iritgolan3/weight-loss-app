# assets

`elon.glb` — the main character model, loaded by `crossy-tesla.html`
(`DRIVER_MODEL` at the top of its script).

The game works without it: if the file is missing or fails to load, it falls
back to the built-in voxel character.

Keep the web build small. A model straight out of a scanner or a generator is
usually tens of megabytes, which is too heavy to download before a game starts.
Run it through gltf-transform first, e.g.

    npx @gltf-transform/cli optimize source.glb assets/elon.glb \
      --texture-size 1024 --simplify-error 0.002

and check the result is a few MB at most.
