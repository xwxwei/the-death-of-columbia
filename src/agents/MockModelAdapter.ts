import { ModelAdapter, ModelRequest, ModelResponse } from "./ModelAdapter";

export class MockModelAdapter implements ModelAdapter {
  async complete(request: ModelRequest): Promise<ModelResponse> {
    return {
      text: `[mock:${request.purpose}] ${request.prompt.slice(0, 220)}`,
      usage: {
        promptTokens: Math.ceil(request.prompt.length / 4),
        completionTokens: 32,
        totalTokens: Math.ceil(request.prompt.length / 4) + 32
      }
    };
  }
}
