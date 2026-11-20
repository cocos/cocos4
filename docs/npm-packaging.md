# Engine npm packages

Run from the engine repository using its own installed dependencies (Node 22 recommended):

~~~sh
npm run test:npm
npm run pack:npm -- --kind web --output ../engine-web-package
npm run pack:npm -- --kind editor --base ../engine-web-package --output ../engine-editor-package
~~~

Source defaults to this engine checkout. Outputs must be new directories outside the source. Run npm pack in each generated directory for tarballs.

Prepare engine dependencies, synchronized PAL/adapters, debug information and declarations first. Editor packaging also requires prepared editor/web profiles in bin/.cache/dev-cli. Packaging validates these inputs but does not prepare profiles itself. Browser ESM generation uses the engine's installed @cocos/ccbuild; scripts do not import CLI files or CLI dist outputs.

Native packaging is reserved by --kind native but explicitly unavailable. The CLI consumes installed packages, validates component identities and builds projects. Consumer integration tests stay in the CLI. No generation command publishes to a registry automatically.

## Package contents

Web contains the browser ESM entry, modular JS compilation inputs, feature/platform metadata, declarations, external runtime resources and non-native templates/adapters. It retains candidate platform implementations for the consuming builder to prune. Native launch templates, executables and libraries are excluded.

Editor contains matching host/preview profiles, editor exports and editor resources. Web and Editor identities must match. The consumer resolves installed components and assembles its work view outside node_modules.

A generated Web manifest is validated before Editor packaging. Missing PAL workers or stale prepared profile imports fail before output generation. These checks do not replace full source compilation or consumer runtime tests.

Consumer package configuration, project builds and browser integration tests are documented by the CLI. Those tests stay in the consuming repository and are not generation dependencies.
