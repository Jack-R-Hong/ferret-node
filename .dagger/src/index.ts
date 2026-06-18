/**
 * Ferret SDK (Svelte) — CI pipeline as a Dagger module.
 *
 * The same gates run locally and in GitHub Actions, so "works in CI" is
 * reproducible on a laptop:
 *
 *   dagger call check --source=.   # svelte-check (type check)
 *   dagger call test  --source=.   # vitest unit + msw contract suite
 *   dagger call pack  --source=.   # svelte-package + publint
 *   dagger call ci    --source=.   # all of the above, concurrently
 *
 * Every gate runs in its own Node 22 container derived from a shared,
 * content-addressed `base`, so `npm ci` is computed once and reused.
 */
import { dag, Container, Directory, object, func } from "@dagger.io/dagger";

@object()
export class Ferret {
	/**
	 * Project sources with `npm ci` applied, on Node 22. The npm cache is a
	 * Dagger cache volume so repeat installs are fast; build outputs and
	 * VCS/Dagger artifacts are excluded from the upload.
	 */
	@func()
	base(source: Directory): Container {
		return dag
			.container()
			.from("node:22-bookworm-slim")
			.withMountedCache("/root/.npm", dag.cacheVolume("ferret-npm-cache"))
			.withDirectory("/app", source, {
				exclude: [
					"node_modules",
					"dist",
					".svelte-kit",
					".git",
					".dagger/sdk",
					".dagger/node_modules",
				],
			})
			.withWorkdir("/app")
			.withExec(["npm", "ci"]);
	}

	/** Type-check the SDK: `svelte-kit sync && svelte-check`. */
	@func()
	async check(source: Directory): Promise<string> {
		return this.base(source).withExec(["npm", "run", "check"]).stdout();
	}

	/** Run the Vitest unit + msw contract suite (`npm run test:run`). */
	@func()
	async test(source: Directory): Promise<string> {
		return this.base(source).withExec(["npm", "run", "test:run"]).stdout();
	}

	/** Build and validate the publishable package: `svelte-package && publint`. */
	@func()
	async pack(source: Directory): Promise<string> {
		return this.base(source).withExec(["npm", "run", "package"]).stdout();
	}

	/**
	 * Full CI gate — type-check, test, and package, each in its own container
	 * and run concurrently. Rejects (fails CI) if any single gate fails.
	 */
	@func()
	async ci(source: Directory): Promise<string> {
		const [check, test, pack] = await Promise.all([
			this.check(source),
			this.test(source),
			this.pack(source),
		]);
		return [`=== check ===\n${check}`, `=== test ===\n${test}`, `=== pack ===\n${pack}`].join(
			"\n\n",
		);
	}
}
