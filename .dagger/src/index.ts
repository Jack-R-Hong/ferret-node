/**
 * Ferret SDK (Svelte) — CI pipeline as a Dagger module.
 *
 * The same gates run locally and in GitHub Actions, so "works in CI" is
 * reproducible on a laptop:
 *
 *   dagger call check --source=.   # svelte-check (type check)
 *   dagger call test  --source=.   # vitest unit + msw contract suite
 *   dagger call pack  --source=.   # svelte-package + publint
 *   dagger call e2e   --source=.   # Playwright security-regression suite
 *   dagger call ci    --source=.   # all of the above, concurrently
 *
 * Every gate runs in its own Node 22 container derived from a shared,
 * content-addressed `base`, so `npm ci` is computed once and reused. The e2e
 * gate uses the official Playwright image instead (browsers preinstalled).
 */
import { dag, Container, Directory, object, func } from "@dagger.io/dagger";

/**
 * Must match the `@playwright/test` version in package.json — the image ships
 * the browsers for exactly that version, and Playwright refuses to run against
 * a mismatched browser build. Bump both together.
 */
const PLAYWRIGHT_IMAGE = "mcr.microsoft.com/playwright:v1.61.1-noble";

@object()
export class Ferret {
	/** Mount sources and run `npm ci` on any Node-equipped base container. */
	private install(ctr: Container, source: Directory): Container {
		return ctr
			.withMountedCache("/root/.npm", dag.cacheVolume("ferret-npm-cache"))
			.withDirectory("/app", source, {
				exclude: [
					"node_modules",
					"dist",
					".svelte-kit",
					".git",
					".dagger/sdk",
					".dagger/node_modules",
					"test-results",
					"playwright-report",
					".playwright",
				],
			})
			.withWorkdir("/app")
			.withExec(["npm", "ci"]);
	}

	/**
	 * Project sources with `npm ci` applied, on Node 22. The npm cache is a
	 * Dagger cache volume so repeat installs are fast; build outputs and
	 * VCS/Dagger artifacts are excluded from the upload.
	 */
	@func()
	base(source: Directory): Container {
		return this.install(dag.container().from("node:22-bookworm-slim"), source);
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
	 * Run the Playwright e2e suite (`npm run test:e2e`) — the XSS/CSRF
	 * security-regression guards from SECURITY-FINDINGS.md plus the flow
	 * happy paths. Runs headless Chromium in the official Playwright image;
	 * playwright.config.ts boots `vite dev` itself and every backend call is
	 * mocked, so no Ferret server is involved. CI=1 makes the config treat the
	 * run as CI (fresh dev server, forbid `.only`, list+html reporters).
	 */
	@func()
	async e2e(source: Directory): Promise<string> {
		return this.install(dag.container().from(PLAYWRIGHT_IMAGE), source)
			.withEnvVariable("CI", "1")
			.withExec(["npm", "run", "test:e2e"])
			.stdout();
	}

	/**
	 * Full CI gate — type-check, test, e2e, and package, each in its own
	 * container and run concurrently. Rejects (fails CI) if any single gate
	 * fails.
	 */
	@func()
	async ci(source: Directory): Promise<string> {
		const [check, test, pack, e2e] = await Promise.all([
			this.check(source),
			this.test(source),
			this.pack(source),
			this.e2e(source),
		]);
		return [
			`=== check ===\n${check}`,
			`=== test ===\n${test}`,
			`=== pack ===\n${pack}`,
			`=== e2e ===\n${e2e}`,
		].join("\n\n");
	}
}
