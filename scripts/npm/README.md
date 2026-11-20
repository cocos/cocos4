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
