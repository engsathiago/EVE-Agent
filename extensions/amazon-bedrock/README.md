# EVE Amazon Bedrock Provider

Official EVE provider plugin for Amazon Bedrock. It adds Bedrock model discovery, text generation, embeddings, and guardrail-aware provider routing for agents that use AWS-hosted models.

Install from EVE:

```bash
eve plugin add @eve/amazon-bedrock-provider
```

Configure AWS credentials and region through your normal EVE credential/profile setup, then select Bedrock models with the `amazon-bedrock/...` provider prefix.
