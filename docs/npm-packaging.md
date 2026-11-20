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

## Native packaging boundary and CI plan

Native generation is not implemented by this PR. Keep the native command's explicit failure until the following artifact contract and a real target have been validated. A successful template/application compile is not a validated engine SDK package.

Responsibilities:

- Target CI jobs select toolchains, engine commit, target OS, architecture, ABI, Debug/Release, static/shared linkage and feature profile. They compile and test native artifacts using reproducible commands.
- A future native packer consumes an explicit artifact manifest. It validates identities, required files and hashes and creates the package directory. It must not invoke CMake, download toolchains or compile as a side effect.
- CI invokes the same packer, runs npm pack, installs/links a consumer smoke project, then uploads tarballs and provenance to Actions Artifacts. Local engine developers can use the same commands for reproduction; ordinary game developers consume the packages.
- Target libraries and host tools remain separate. An Android target package must not contain a Windows host executable. Include an executable only when it is a required host tool or explicitly defined runtime launcher, not merely because a template build produced one.

The artifact manifest must record engine commit/release identity, target platform/architecture, ABI/API or deployment minimum, compiler and toolchain versions, configuration, linkage, feature profile, required headers/link inputs/runtime dependencies, symbols or symbol provenance, and hashes for every shipped file. Reject mixed profiles, foreign-platform binaries, missing files and escaping paths. Reusing caches requires these identities to match; do not relabel old binaries as a new commit.

PR builds should produce test packages for relevant native changes, using change filters and a documented platform matrix. Shared native or binding changes run the representative cross-platform matrix; platform-specific changes run that target and affected dependencies. Daily/release jobs cover the full matrix. Packaging-only changes test collection against fixtures or matching cached artifacts. No PR job publishes to the npm registry; release-tag publication is a separate operation.

Implementation order:

1. Start with one Windows or Android target and define a stable library/install layout. The current native-compile-platforms workflow builds template applications and does not yet establish this layout or upload npm packages.
2. Add manifest validation and collection tests, then a real package and consumer link/run smoke test.
3. Add a packaging/upload stage after successful target compilation, with platform/architecture/configuration/commit in artifact names and an installation guide.
4. Expand to other platforms and full daily/release matrices. Until these steps are implemented, native packaging stays unavailable and Web/Editor packaging remains independent.

## Downloadable CI artifacts

The npm packaging workflow generates a real Web package for relevant source changes, packs it and uploads an Actions Artifact after installation/entry-resolution verification. Open the PR Checks, select the npm packaging run, and download engine-npm-web-COMMIT from Artifacts (also linked from the job summary). Actions downloads a ZIP containing npm .tgz files, provenance.json, SHA256SUMS and README.md. Extract the ZIP before npm install. Artifacts expire after 14 days; they are test packages, not registry releases.

The current CI artifact contains Web only. Editor generation requires prepared host/preview profiles, which this job does not build. Downloading the Web artifact alone does not provide all components needed by CLI editing or full project builds. Native generation remains unavailable.

The common artifact command accepts already-generated component directories, independent of platform:

~~~sh
npm run pack:npm:artifacts -- --package ../engine-web-package --package ../engine-editor-package --output ../engine-npm-artifact
~~~

Only include components that actually exist and passed their own validation. It rejects duplicate packages, mixed release identities and package/version mismatches; it runs npm pack with lifecycle scripts disabled and records commit/dirty status plus tarball hashes. It never compiles engines, fetches tools or publishes to the registry. Future Native jobs can call the same command after their target library packer has validated architecture, ABI and provenance. CI should include target, architecture and configuration in Native Artifact names.
