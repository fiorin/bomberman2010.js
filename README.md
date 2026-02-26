# Bomberman 2010 :computer:

### _The Bomberman 2010 modern rework (Version 2)_

**by** [![N|Solid](http://fior.in/img/fiorin.png)](http://fior.in)

## .: Frontend/Game Core :.

The project was evolved in Version 2 as a modern TypeScript + Vite implementation while preserving the original Bomberman visual identity and gameplay spirit.

The following technologies were used in Version 2 development:

| What?      | For what?                                |
| ---------- | ---------------------------------------- |
| Node.js    | Runtime for development/build tools.     |
| Npm        | Dependency management.                   |
| TypeScript | Language used in the modern game logic.  |
| Vite       | Dev server and production bundling.      |
| Vitest     | Automated tests for gameplay behavior.   |
| HTML5 Canvas | Rendering board, players, bombs, fire. |

### Version 2 changes (summary)

- Modern project scaffold with Vite + TypeScript.
- Deterministic gameplay core for board, movement, bombs, fire and items.
- Random map generation with reserved spawn corners.
- Canvas renderer and keyboard input wiring.
- Test, typecheck and build scripts for validation.

### Execution requirements

- Node.js
- Npm

To prepare the environment and run Version 2, run the commands:

```sh
cd src-version-2
npm install
npm run dev
```

### Validation commands

```sh
cd src-version-2
npm run test
npm run typecheck
npm run build
```

### Debrief

There is a README inside Version 2 with implementation notes and completed step details.

#### Click [here to see Version 2 notes](src-version-2/README.md)

The application runs in the browser using the Vite development server.

**by** [![N|Solid](http://fior.in/img/fiorin.png)](http://fior.in)

---

#### Useful links

- [Node.js](https://nodejs.org/en)
- [Vite](https://vitejs.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Vitest](https://vitest.dev/)
