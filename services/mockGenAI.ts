// Mock Gemini API for development/demo purposes
export class MockGoogleGenAI {
  apiKey: string;

  constructor(config: { apiKey: string }) {
    this.apiKey = config.apiKey;
  }

  async generateContent(content: any) {
    // Simulate API response with mock data
    return {
      response: {
        text: () => "Mock AI response - feature working without API key"
      }
    };
  }
}

// Export as GoogleGenAI for compatibility
export const GoogleGenAI = MockGoogleGenAI;
