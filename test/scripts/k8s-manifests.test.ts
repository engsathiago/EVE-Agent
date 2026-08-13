// K8s manifest tests cover the deployable Kubernetes bundle shape.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

type Manifest = Record<string, unknown>;

function readManifest(name: string): Manifest {
  const parsed = parse(readFileSync(`scripts/k8s/manifests/${name}`, "utf8")) as unknown;
  expect(parsed).toBeTypeOf("object");
  expect(parsed).not.toBeNull();
  expect(Array.isArray(parsed)).toBe(false);
  return parsed as Manifest;
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  expect(value, label).toBeTypeOf("object");
  expect(value, label).not.toBeNull();
  expect(Array.isArray(value), label).toBe(false);
  return value as Record<string, unknown>;
}

function asRecords(value: unknown, label: string): Record<string, unknown>[] {
  expect(Array.isArray(value), label).toBe(true);
  return value as Record<string, unknown>[];
}

function asStrings(value: unknown, label: string): string[] {
  expect(Array.isArray(value), label).toBe(true);
  for (const entry of value as unknown[]) {
    expect(entry, label).toBeTypeOf("string");
  }
  return value as string[];
}

function findNamed(records: Record<string, unknown>[], name: string): Record<string, unknown> {
  const record = records.find((entry) => entry.name === name);
  expect(record, name).toBeDefined();
  return record as Record<string, unknown>;
}

describe("k8s manifests", () => {
  it("keeps kustomization resources aligned with shipped manifests", () => {
    const kustomization = readManifest("kustomization.yaml");

    expect(kustomization).toMatchObject({
      apiVersion: "kustomize.config.k8s.io/v1beta1",
      kind: "Kustomization",
    });
    expect(asStrings(kustomization.resources, "kustomization resources").sort()).toEqual([
      "configmap.yaml",
      "deployment.yaml",
      "pvc.yaml",
      "service.yaml",
    ]);
  });

  it("keeps gateway service selectors and ports aligned with deployment labels", () => {
    const deployment = readManifest("deployment.yaml");
    const service = readManifest("service.yaml");
    const deploymentSpec = asRecord(deployment.spec, "deployment spec");
    const selector = asRecord(deploymentSpec.selector, "deployment selector");
    const matchLabels = asRecord(selector.matchLabels, "deployment match labels");
    const template = asRecord(deploymentSpec.template, "deployment template");
    const templateMetadata = asRecord(template.metadata, "deployment template metadata");
    const templateLabels = asRecord(templateMetadata.labels, "deployment template labels");
    const serviceSpec = asRecord(service.spec, "service spec");
    const serviceSelector = asRecord(serviceSpec.selector, "service selector");
    const ports = asRecords(serviceSpec.ports, "service ports");

    expect(deployment).toMatchObject({
      apiVersion: "apps/v1",
      kind: "Deployment",
      metadata: { name: "eve" },
    });
    expect(matchLabels).toEqual({ app: "eve" });
    expect(templateLabels).toMatchObject(matchLabels);
    expect(serviceSelector).toEqual(matchLabels);
    expect(ports).toContainEqual({
      name: "gateway",
      port: 18789,
      protocol: "TCP",
      targetPort: 18789,
    });
  });

  it("keeps deployment mounts, secrets, and security posture deployable", () => {
    const deployment = readManifest("deployment.yaml");
    const spec = asRecord(deployment.spec, "deployment spec");
    const template = asRecord(spec.template, "deployment template");
    const podSpec = asRecord(template.spec, "pod spec");
    const containers = asRecords(podSpec.containers, "containers");
    const gateway = findNamed(containers, "gateway");
    const env = asRecords(gateway.env, "gateway env");
    const volumes = asRecords(podSpec.volumes, "pod volumes");
    const securityContext = asRecord(gateway.securityContext, "gateway security context");

    expect(gateway.command).toEqual(["node", "/app/dist/index.js", "gateway", "run"]);
    expect(findNamed(env, "HOME")).toMatchObject({ value: "/home/node" });
    expect(findNamed(env, "EVE_CONFIG_DIR")).toMatchObject({ value: "/home/node/.eve" });
    expect(findNamed(env, "EVE_GATEWAY_TOKEN")).toMatchObject({
      valueFrom: { secretKeyRef: { key: "EVE_GATEWAY_TOKEN", name: "eve-secrets" } },
    });
    expect(findNamed(volumes, "eve-home")).toMatchObject({
      persistentVolumeClaim: { claimName: "eve-home-pvc" },
    });
    expect(findNamed(volumes, "config")).toMatchObject({ configMap: { name: "eve-config" } });
    expect(securityContext).toMatchObject({
      allowPrivilegeEscalation: false,
      readOnlyRootFilesystem: true,
      runAsNonRoot: true,
    });
  });

  it("keeps config and persistence manifests aligned with the gateway", () => {
    const configMap = readManifest("configmap.yaml");
    const pvc = readManifest("pvc.yaml");
    const data = asRecord(configMap.data, "configmap data");
    const config = JSON.parse(String(data["eve.json"])) as Record<string, unknown>;
    const gateway = asRecord(config.gateway, "eve config gateway");
    const auth = asRecord(gateway.auth, "eve config auth");
    const agents = asRecord(config.agents, "eve config agents");
    const defaults = asRecord(agents.defaults, "eve config agent defaults");
    const pvcSpec = asRecord(pvc.spec, "pvc spec");
    const resources = asRecord(pvcSpec.resources, "pvc resources");
    const requests = asRecord(resources.requests, "pvc resource requests");

    expect(configMap).toMatchObject({
      apiVersion: "v1",
      kind: "ConfigMap",
      metadata: { name: "eve-config" },
    });
    expect(gateway).toMatchObject({ mode: "local", port: 18789 });
    expect(auth).toMatchObject({ mode: "token" });
    expect(defaults).toMatchObject({ workspace: "~/.eve/workspace" });
    expect(data["AGENTS.md"]).toContain("EVE Assistant");
    expect(pvc).toMatchObject({
      apiVersion: "v1",
      kind: "PersistentVolumeClaim",
      metadata: { name: "eve-home-pvc" },
    });
    expect(requests).toMatchObject({ storage: "10Gi" });
  });
});
