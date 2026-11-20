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

## Native packaging

CI owns native compilation and its platform/toolchain matrix. The future native packer will validate and collect prebuilt artifacts without compiling or fetching tools. Native output layouts and consumer link validation are not implemented yet, so --kind native continues to fail explicitly. See [the artifact contract and CI implementation plan](../../docs/npm-packaging.md#native-packaging-boundary-and-ci-plan).

## Downloadable CI artifacts

The npm packaging workflow generates a real Web package for relevant source changes, packs it and uploads an Actions Artifact after installation/entry-resolution verification. Open the PR Checks, select the npm packaging run, and download engine-npm-web-COMMIT from Artifacts (also linked from the job summary). Actions downloads a ZIP containing npm .tgz files, provenance.json, SHA256SUMS and README.md. Extract the ZIP before npm install. Artifacts expire after 14 days; they are test packages, not registry releases.

The current CI artifact contains Web only. Editor generation requires prepared host/preview profiles, which this job does not build. Downloading the Web artifact alone does not provide all components needed by CLI editing or full project builds. Native generation remains unavailable.

The common artifact command accepts already-generated component directories, independent of platform:

~~~sh
npm run pack:npm:artifacts -- --package ../engine-web-package --package ../engine-editor-package --output ../engine-npm-artifact
~~~

Only include components that actually exist and passed their own validation. It rejects duplicate packages, mixed release identities and package/version mismatches; it runs npm pack with lifecycle scripts disabled and records commit/dirty status plus tarball hashes. It never compiles engines, fetches tools or publishes to the registry. Future Native jobs can call the same command after their target library packer has validated architecture, ABI and provenance. CI should include target, architecture and configuration in Native Artifact names.
