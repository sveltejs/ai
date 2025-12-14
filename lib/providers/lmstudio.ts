import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

/**
 * Creates an LM Studio provider instance.
 *
 * LM Studio is a user interface for running local models.
 * It contains an OpenAI compatible API server that you can use with the AI SDK.
 * You can start the local server under the Local Server tab in the LM Studio UI.
 *
 * @param baseURL - The base URL of the LM Studio server (default: http://localhost:1234/v1)
 * @returns An LM Studio provider instance
 */
export function createLMStudioProvider(
  baseURL: string = "http://localhost:1234/v1",
) {
  return createOpenAICompatible({
    name: "lmstudio",
    baseURL,
  });
}

/**
 * Default LM Studio provider instance using the default port (1234).
 */
export const lmstudio = createLMStudioProvider();

/**
 * Model information returned from LM Studio's /v1/models endpoint
 */
export interface LMStudioModel {
  id: string;
  object: string;
  owned_by: string;
}

interface LMStudioModelsResponse {
  object: string;
  data: LMStudioModel[];
}

/**
 * Fetches available models from an LM Studio server.
 *
 * @param baseURL - The base URL of the LM Studio server (default: http://localhost:1234/v1)
 * @returns Array of available model IDs, or null if the server is not reachable
 */
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
  } catch (error) {
    // Server not running or not reachable
    return null;
  }
}
