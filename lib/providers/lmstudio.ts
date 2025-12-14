import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import {
  multiselect,
  isCancel,
  cancel,
  confirm,
  text,
  spinner,
  note,
} from "@clack/prompts";
import type { LanguageModel } from "ai";

export function createLMStudioProvider(
  baseURL: string = "http://localhost:1234/v1",
) {
  return createOpenAICompatible({
    name: "lmstudio",
    baseURL,
  });
}

export const lmstudio = createLMStudioProvider();

export interface LMStudioModel {
  id: string;
  object: string;
  owned_by: string;
}

interface LMStudioModelsResponse {
  object: string;
  data: LMStudioModel[];
}

export interface LMStudioConfig {
  baseURL: string;
}

export async function fetchLMStudioModels(
  baseURL: string = "http://localhost:1234/v1",
): Promise<LMStudioModel[] | null> {
  try {
    const response = await fetch(`${baseURL}/models`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.error(
        `Failed to fetch LM Studio models: ${response.status} ${response.statusText}`,
      );
      return null;
    }

    const data = (await response.json()) as LMStudioModelsResponse;
    return data.data || [];
  } catch {
    return null;
  }
}

export async function configureLMStudio(): Promise<LMStudioConfig> {
  const customUrl = await confirm({
    message: "Use custom LM Studio URL? (default: http://localhost:1234/v1)",
    initialValue: false,
  });

  if (isCancel(customUrl)) {
    cancel("Operation cancelled.");
    process.exit(0);
  }

  let baseURL = "http://localhost:1234/v1";

  if (customUrl) {
    const urlInput = await text({
      message: "Enter LM Studio server URL",
      placeholder: "http://localhost:1234/v1",
    });

    if (isCancel(urlInput)) {
      cancel("Operation cancelled.");
      process.exit(0);
    }

    baseURL = urlInput || "http://localhost:1234/v1";
  }

  return { baseURL };
}

export async function selectModelsFromLMStudio(
  baseURL: string,
): Promise<string[]> {
  const s = spinner();
  s.start("Connecting to LM Studio...");

  const lmstudioModels = await fetchLMStudioModels(baseURL);

  if (lmstudioModels === null) {
    s.stop("Failed to connect to LM Studio");
    note(
      `Could not connect to LM Studio at ${baseURL}\n\nMake sure:\n1. LM Studio is running\n2. A model is loaded\n3. The local server is started (Local Server tab → Start Server)`,
      "❌ Connection Failed",
    );
    cancel("Cannot proceed without LM Studio connection.");
    process.exit(1);
  }

  if (lmstudioModels.length === 0) {
    s.stop("No models found");
    note(
      `LM Studio is running but no models are loaded.\n\nPlease load a model in LM Studio and try again.`,
      "⚠️  No Models Available",
    );
    cancel("Cannot proceed without loaded models.");
    process.exit(1);
  }

  s.stop(`Found ${lmstudioModels.length} model(s)`);

  const models = await multiselect({
    message: "Select model(s) to benchmark",
    options: lmstudioModels.map((model) => ({
      value: model.id,
      label: model.id,
      hint: model.owned_by !== "unknown" ? `by ${model.owned_by}` : undefined,
    })),
  });

  if (isCancel(models)) {
    cancel("Operation cancelled.");
    process.exit(0);
  }

  return models.map((m) => `lmstudio/${m}`);
}

export function getLMStudioModel(
  modelId: string,
  baseURL?: string,
): LanguageModel {
  const actualModelId = modelId.startsWith("lmstudio/")
    ? modelId.replace("lmstudio/", "")
    : modelId;
  const provider = createLMStudioProvider(baseURL);
  return provider(actualModelId);
}

export function isLMStudioModel(modelId: string): boolean {
  return modelId.startsWith("lmstudio/");
}
