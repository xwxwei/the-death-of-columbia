export type ModelPurpose = "gm" | "npc" | "adjudicator";

export interface ModelRequest {
  purpose: ModelPurpose;
  system: string;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ModelResponse {
  text: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

export interface ModelAdapter {
  complete(request: ModelRequest): Promise<ModelResponse>;
}
