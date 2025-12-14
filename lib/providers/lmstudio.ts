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
