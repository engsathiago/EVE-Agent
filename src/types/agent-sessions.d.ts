// Declares extension points for agent session type augmentation.
export type EVEAgentSessionSkillSourceAugmentation = never;

declare module "eve-agent/plugin-sdk/agent-sessions" {
  interface Skill {
    // EVE relies on the source identifier returned by skill loaders.
    source: string;
  }
}
