// Agent.js
// This handles communication with the Google Gemini API

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

const SYSTEM_INSTRUCTION = `You are an AI Agent managing a dashboard application. 
You can converse with the user and execute tools to change the application state.
If the user asks to change the color, use the changeBackgroundColor tool with a valid CSS color.
If the user asks to add a card or a note, use the addCard tool.
If the user wants a notification, use the addNotification tool.
Always be helpful, concise, and confirm when you perform an action.`;

export const TOOLS = {
  functionDeclarations: [
    {
      name: "changeBackgroundColor",
      description: "Changes the background color of the dashboard to any CSS color (hex, rgb, or color name like 'darkred').",
      parameters: {
        type: "OBJECT",
        properties: {
          color: { type: "STRING" }
        },
        required: ["color"]
      }
    },
    {
      name: "addNotification",
      description: "Shows a notification popup on the screen.",
      parameters: {
        type: "OBJECT",
        properties: {
          message: { type: "STRING", description: "The message to show" }
        },
        required: ["message"]
      }
    },
    {
      name: "addCard",
      description: "Adds a new informational card to the dashboard grid.",
      parameters: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING", description: "The title of the card" },
          content: { type: "STRING", description: "The body content of the card" }
        },
        required: ["title", "content"]
      }
    }
  ]
};

// Formats our local message state to Gemini's expected format
function formatMessagesForGemini(messages) {
  return messages.filter(m => m.role !== 'system').map(msg => {
    let parts = [];
    if (msg.role === 'user') {
      parts.push({ text: msg.content });
    } else if (msg.role === 'assistant') {
      if (msg.functionCall) {
        parts.push({ functionCall: msg.functionCall });
      }
      if (msg.content) {
        parts.push({ text: msg.content });
      }
    } else if (msg.role === 'tool') {
      parts.push({
        functionResponse: {
          name: msg.name,
          response: { result: msg.content }
        }
      });
    }
    
    return {
      role: msg.role === 'assistant' || msg.role === 'tool' ? 'model' : 'user',
      parts
    };
  });
}

export async function callGemini(messages, apiKey) {
  const contents = formatMessagesForGemini(messages);
  
  const payload = {
    systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
    contents,
    tools: [TOOLS],
  };

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || "Failed to call Gemini API");
  }

  const data = await response.json();
  const candidate = data.candidates?.[0];
  
  if (!candidate) throw new Error("No response from model");

  const part = candidate.content.parts[0];
  
  if (part.functionCall) {
    return {
      type: "functionCall",
      functionCall: part.functionCall
    };
  }

  return {
    type: "text",
    text: part.text
  };
}
