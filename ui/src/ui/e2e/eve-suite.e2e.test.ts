// Control UI tests cover EVE's native product workspace against a mocked Gateway.
import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  canRunPlaywrightChromium,
  installMockGateway,
  resolvePlaywrightChromiumExecutablePath,
  startControlUiE2eServer,
  type ControlUiE2eServer,
  type MockGatewayControls,
  type MockGatewayRequest,
} from "../../test-helpers/control-ui-e2e.ts";

const chromiumExecutablePath = resolvePlaywrightChromiumExecutablePath(chromium.executablePath());
const chromiumAvailable = canRunPlaywrightChromium(chromiumExecutablePath);
const allowMissingChromium = process.env.EVE_UI_E2E_ALLOW_MISSING_CHROMIUM === "1";
const describeE2e = chromiumAvailable || !allowMissingChromium ? describe : describe.skip;
const artifactDir = path.resolve(process.cwd(), ".artifacts/control-ui-e2e/eve-suite");
const baseTime = Date.parse("2026-08-20T12:00:00.000Z");

let server: ControlUiE2eServer;

function paramsOf(request: MockGatewayRequest): Record<string, unknown> {
  if (!request.params || typeof request.params !== "object" || Array.isArray(request.params)) {
    return {};
  }
  return request.params as Record<string, unknown>;
}

async function waitForRequest(
  gateway: MockGatewayControls,
  method: string,
  previousCount: number,
): Promise<MockGatewayRequest> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const requests = await gateway.getRequests(method);
    if (requests.length > previousCount) {
      return requests.at(-1)!;
    }
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 40);
    });
  }
  throw new Error(`Timed out waiting for ${method}`);
}

async function screenshot(page: Page, name: string, artifacts: string[]): Promise<void> {
  const target = path.join(artifactDir, `${name}.png`);
  await page.screenshot({ fullPage: true, path: target });
  artifacts.push(target);
}

describeE2e("EVE native workspace mocked Gateway E2E", () => {
  beforeAll(async () => {
    if (!chromiumAvailable) {
      throw new Error(
        `Playwright Chromium is not installed at ${chromiumExecutablePath}. Install it or set EVE_UI_E2E_ALLOW_MISSING_CHROMIUM=1 only for an intentional skip.`,
      );
    }
    server = await startControlUiE2eServer();
  });

  afterAll(async () => {
    await server?.close();
  });

  it("loads every product surface and sends project, environment, Studio, and catalog mutations", async () => {
    await rm(artifactDir, { recursive: true, force: true });
    await mkdir(artifactDir, { recursive: true });
    const rawVideoDir = path.join(artifactDir, "raw-video");
    await mkdir(rawVideoDir, { recursive: true });
    const screenshots: string[] = [];
    const videos: string[] = [];
    const browser: Browser = await chromium.launch({ executablePath: chromiumExecutablePath });
    let context: BrowserContext | undefined;
    let page: Page | undefined;
    try {
      context = await browser.newContext({
        locale: "en-US",
        viewport: { width: 1600, height: 1000 },
        recordVideo: { dir: rawVideoDir, size: { width: 1600, height: 1000 } },
        serviceWorkers: "block",
      });
      page = await context.newPage();
      page.setDefaultTimeout(10_000);
      const studioArtifact = {
        id: "studio_demo",
        title: "EVE launch brief",
        filename: "launch.md",
        kind: "document",
        mediaType: "text/markdown",
        createdAt: baseTime,
        updatedAt: baseTime,
        version: 3,
        publishedResultId: "result_launch",
        sizeBytes: 640,
        editable: true,
        previewKind: "markdown",
      };
      const gateway = await installMockGateway(page, {
        methodResponses: {
          "projects.list": {
            projects: [
              {
                id: "project_launch",
                slug: "eve-launch",
                name: "EVE Launch",
                description: "VPS rollout and launch operations",
                icon: "🚀",
                color: "#8b5cf6",
                boardId: "eve-launch",
                primaryPath: "/srv/eve/launch",
                createdAt: baseTime,
                updatedAt: baseTime,
                archived: false,
                folders: [
                  {
                    path: "/srv/eve/launch",
                    label: "launch",
                    primary: true,
                    addedAt: baseTime,
                  },
                ],
              },
            ],
          },
          "intelligence.environments.list": {
            environments: [
              {
                id: "env_research",
                name: "Research sandbox",
                image: "eve/runtime:latest",
                status: "running",
                createdAt: baseTime,
                updatedAt: baseTime,
                expiresAt: baseTime + 7_200_000,
                ttlMinutes: 120,
                cpu: 2,
                memoryMb: 4096,
                persistent: true,
                network: false,
                workspace: "/var/lib/eve/environments/env_research/workspace",
                runtimeError: "",
                expired: false,
                snapshots: [{ image: "eve-snapshot:research-v1", createdAt: baseTime }],
              },
            ],
          },
          "intelligence.studio.list": {
            artifacts: [studioArtifact],
            templates: [
              { id: "document", filename: "document.md", label: "document" },
              { id: "website", filename: "site.html", label: "website" },
            ],
          },
          "intelligence.studio.get": {
            ...studioArtifact,
            content: "# EVE Launch\n\nA complete independent agent platform.",
            versions: [{ version: 3, sha256: "abc123", sizeBytes: 640, createdAt: baseTime }],
          },
          "intelligence.integrations.list": {
            items: [
              {
                id: "plugin:intelligence",
                kind: "plugin",
                name: "EVE Intelligence",
                description: "Native intelligence and operations plane",
                source: "EVE",
                installed: true,
                enabled: true,
                authType: "setup",
                requiredEnv: [],
                version: "1.0.0",
              },
              {
                id: "channel:telegram",
                kind: "channel",
                name: "Telegram",
                description: "Telegram communication channel",
                source: "EVE",
                installed: true,
                enabled: true,
                authType: "credentials",
                requiredEnv: ["TELEGRAM_BOT_TOKEN"],
              },
              {
                id: "mcp:research",
                kind: "mcp",
                name: "research",
                description: "Remote MCP server at mcp.example.test",
                source: "remote",
                installed: true,
                enabled: true,
                authType: "oauth",
                requiredEnv: [],
              },
            ],
            counts: {
              total: 3,
              installed: 3,
              enabled: 3,
              byKind: { plugin: 1, channel: 1, mcp: 1 },
            },
          },
          "intelligence.status": {
            traces: { total: 48, completed: 46, failed: 2 },
            results: { total: 12, ready: 9, approved: 3 },
            flows: { total: 7, running: 2 },
            evals: { total: 6, datasets: 4 },
            router: { observations: 320, models: 5 },
            experiments: [{ id: "experiment_1", status: "running" }],
            workers: { nodes: [{ id: "vps-1" }], jobs: [{ id: "job-1" }] },
            modelLab: { models: 3, active: "eve-coder" },
            packages: { available: [{ name: "software" }], installed: [] },
          },
        },
      });

      expect((await page.goto(`${server.baseUrl}projects`))?.status()).toBe(200);
      await page.locator(".eve-suite__item .card-title", { hasText: "EVE Launch" }).waitFor({
        state: "visible",
      });
      await screenshot(page, "01-projects", screenshots);
      await page.getByLabel("Name").fill("Research OS");
      await page.getByLabel("Description").fill("Long-lived research workspace");
      await page.getByLabel("Primary folder").fill("/srv/eve/research");
      const projectsBefore = (await gateway.getRequests("projects.create")).length;
      await gateway.deferNext("projects.create");
      await page.getByRole("button", { name: "Create project" }).click();
      const projectRequest = await waitForRequest(gateway, "projects.create", projectsBefore);
      expect(paramsOf(projectRequest)).toMatchObject({
        name: "Research OS",
        description: "Long-lived research workspace",
        primaryPath: "/srv/eve/research",
      });
      await gateway.resolveDeferred("projects.create", { id: "project_research" });

      expect((await page.goto(`${server.baseUrl}environments`))?.status()).toBe(200);
      await page.getByText("Research sandbox", { exact: true }).waitFor({ state: "visible" });
      await screenshot(page, "02-environments", screenshots);
      const controlBefore = (await gateway.getRequests("intelligence.environments.control")).length;
      await gateway.deferNext("intelligence.environments.control");
      await page.getByRole("button", { name: "restart" }).click();
      const controlRequest = await waitForRequest(
        gateway,
        "intelligence.environments.control",
        controlBefore,
      );
      expect(paramsOf(controlRequest)).toMatchObject({ id: "env_research", action: "restart" });
      await gateway.resolveDeferred("intelligence.environments.control", {});

      expect((await page.goto(`${server.baseUrl}studio`))?.status()).toBe(200);
      await page.getByText("EVE launch brief", { exact: true }).waitFor({ state: "visible" });
      await page.getByText("EVE launch brief", { exact: true }).click();
      await page.locator(".eve-suite__code").waitFor({ state: "visible" });
      await screenshot(page, "03-studio", screenshots);
      await page.locator(".eve-suite__code").fill("# EVE Launch\n\nReady for VPS deployment.");
      const saveBefore = (await gateway.getRequests("intelligence.studio.save")).length;
      await gateway.deferNext("intelligence.studio.save");
      await page.getByRole("button", { name: "Save version" }).click();
      const saveRequest = await waitForRequest(gateway, "intelligence.studio.save", saveBefore);
      expect(paramsOf(saveRequest)).toMatchObject({
        id: "studio_demo",
        content: "# EVE Launch\n\nReady for VPS deployment.",
      });
      await gateway.resolveDeferred("intelligence.studio.save", {
        ...studioArtifact,
        version: 4,
      });

      const importBefore = (await gateway.getRequests("intelligence.studio.import")).length;
      await gateway.deferNext("intelligence.studio.import");
      await page.locator(".eve-suite__file-input").setInputFiles({
        name: "operator-note.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("Imported through EVE Studio."),
      });
      const importRequest = await waitForRequest(
        gateway,
        "intelligence.studio.import",
        importBefore,
      );
      expect(paramsOf(importRequest)).toMatchObject({
        filename: "operator-note.txt",
        title: "operator-note.txt",
        dataBase64: Buffer.from("Imported through EVE Studio.").toString("base64"),
      });
      await gateway.resolveDeferred("intelligence.studio.import", {
        ...studioArtifact,
        id: "studio_imported",
        title: "operator-note.txt",
        filename: "operator-note.txt",
      });

      const downloadPromise = page.waitForEvent("download");
      await page.getByRole("button", { name: "Download" }).click();
      expect((await downloadPromise).suggestedFilename()).toBe("launch.md");

      const deleteBefore = (await gateway.getRequests("intelligence.studio.delete")).length;
      await gateway.deferNext("intelligence.studio.delete");
      await page.getByRole("button", { name: "Delete" }).click();
      const deleteRequest = await waitForRequest(
        gateway,
        "intelligence.studio.delete",
        deleteBefore,
      );
      expect(paramsOf(deleteRequest)).toMatchObject({ id: "studio_demo" });
      await gateway.resolveDeferred("intelligence.studio.delete", { ok: true, id: "studio_demo" });

      expect((await page.goto(`${server.baseUrl}integrations`))?.status()).toBe(200);
      await page.getByText("EVE Intelligence", { exact: true }).waitFor({ state: "visible" });
      await page.getByText("Telegram", { exact: true }).waitFor({ state: "visible" });
      await page.getByLabel("Search catalog").fill("telegram");
      await page.getByText("EVE Intelligence", { exact: true }).waitFor({ state: "hidden" });
      await page.getByLabel("Search catalog").fill("");
      await page.getByRole("button", { name: "MCP", exact: true }).click();
      await page.getByText("research", { exact: true }).waitFor({ state: "visible" });
      await page.getByText("Telegram", { exact: true }).waitFor({ state: "hidden" });
      await page.getByRole("button", { name: "All", exact: true }).click();
      await page.getByText("Telegram", { exact: true }).waitFor({ state: "visible" });
      expect(await page.locator("a.btn[href='/mcp']").count()).toBe(1);
      await screenshot(page, "04-integrations", screenshots);

      expect((await page.goto(`${server.baseUrl}intelligence`))?.status()).toBe(200);
      await page.getByText("Operational intelligence loop", { exact: true }).waitFor({
        state: "visible",
      });
      expect(
        await page
          .locator("[data-testid='intelligence-grid'] .eve-suite__intelligence-card")
          .count(),
      ).toBe(9);
      await screenshot(page, "05-intelligence", screenshots);

      const video = page.video();
      await context.close();
      context = undefined;
      if (video) {
        const rawPath = await video.path();
        const target = path.join(artifactDir, "eve-suite-flow.webm");
        await copyFile(rawPath, target);
        videos.push(target);
      }
    } catch (error) {
      if (page) {
        await page.screenshot({
          fullPage: true,
          path: path.join(artifactDir, "failure.png"),
        });
        await writeFile(path.join(artifactDir, "failure.html"), await page.content(), "utf8");
      }
      throw error;
    } finally {
      await page?.close().catch(() => {});
      await context?.close().catch(() => {});
      await browser.close().catch(() => {});
      await rm(rawVideoDir, { recursive: true, force: true });
    }

    await writeFile(
      path.join(artifactDir, "manifest.json"),
      `${JSON.stringify({ screenshots, videos }, null, 2)}\n`,
      "utf8",
    );
  });
});
