# Licences

## This game

**GLASS JAW — Championship Boxing**

All original code, character designs, written content, music compositions and
sound design in this repository are the work of this project.

The game ships no third-party assets of any kind: no images, no audio files, no
fonts, no data files. Everything is generated at runtime by the code here.

---

## Third-party software (development only)

These are build and test dependencies. They are **not** included in the built
game — `npm run build` produces an HTML file and a JavaScript bundle containing
only this project's own code.

### TypeScript — Apache License 2.0

Copyright (c) Microsoft Corporation.

Licensed under the Apache License, Version 2.0. You may obtain a copy of the
licence at <http://www.apache.org/licenses/LICENSE-2.0>. Distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
implied.

*Used for*: compile-time type checking (`tsc --noEmit`). Emits no runtime code.

### Vite — MIT License

Copyright (c) 2019-present, VoidZero Inc. and Vite contributors.

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the above copyright notice and this permission notice being included
in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.

*Used for*: development server and production bundling.

### esbuild — MIT License

Copyright (c) 2020 Evan Wallace. Same MIT terms as above.

*Used for*: bundling (via Vite), and compiling the TypeScript test suite for
Node's test runner.

### Playwright — Apache License 2.0

Copyright (c) Microsoft Corporation. Same Apache-2.0 terms as above.

*Used for*: the automated end-to-end playtest (`npm run playtest`). Never
imported by the game.

---

## Assets

**None.** This project intentionally contains zero asset files.

If you fork this project and add assets, record them here with their source,
author and licence before shipping.

---

## Web platform APIs

Canvas 2D, Web Audio, Gamepad, Web Storage and `requestAnimationFrame` are open
web standards implemented by browsers. They carry no licensing obligation.
