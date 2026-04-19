import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function analyzeFoodImage(base64Image: string, userQuantity?: string) {
  try {
    const prompt = userQuantity 
      ? `The user has specified the quantity as: "${userQuantity}". Analyze this food image and calculate the nutritional content based on this specific quantity. Identify the food items accurately. Calculate the total nutritional content (calories, protein, carbs, fat) based on standard USDA nutritional data. Ensure the calorie count is consistent with the macronutrients (4 kcal/g for protein/carbs, 9 kcal/g for fat). Return the data in JSON format.`
      : `Analyze this food image with extreme precision. Identify the food items and estimate their weight/portion sizes accurately. If the portion size is ambiguous or unclear from the image (e.g., hidden depth, unknown container size), set 'needsClarification' to true and provide a 'clarificationQuestion' asking the user for the specific weight or quantity. Otherwise, calculate the total nutritional content (calories, protein, carbs, fat) based on standard USDA nutritional data. Ensure the calorie count is consistent with the macronutrients (4 kcal/g for protein/carbs, 9 kcal/g for fat). Return the data in JSON format.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: [
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: base64Image.split(',')[1],
          },
        },
        {
          text: prompt,
        },
      ],
      config: {
        temperature: 0,
        seed: 42,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            foodName: { type: Type.STRING },
            calories: { type: Type.INTEGER },
            protein: { type: Type.INTEGER },
            carbs: { type: Type.INTEGER },
            fat: { type: Type.INTEGER },
            needsClarification: { type: Type.BOOLEAN },
            clarificationQuestion: { type: Type.STRING },
          },
          required: ["foodName", "calories", "protein", "carbs", "fat"],
        },
      },
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Error analyzing image:", error);
    throw error;
  }
}

export async function analyzeFoodText(foodName: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: `Provide highly accurate nutritional data for a standard portion of "${foodName}". 
      Estimate the calories, protein, carbs, and fat in grams. 
      Use standard nutritional databases (like USDA) for consistency. 
      Ensure the calorie count matches the macros (4/4/9 rule).
      Return the data in JSON format.`,
      config: {
        temperature: 0,
        seed: 42,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            calories: { type: Type.INTEGER },
            protein: { type: Type.INTEGER },
            carbs: { type: Type.INTEGER },
            fat: { type: Type.INTEGER },
          },
          required: ["calories", "protein", "carbs", "fat"],
        },
      },
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Error analyzing text:", error);
    throw error;
  }
}

export async function getNutritionAdvice(userMessage: string, mealHistory: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are a Gen Z nutrition assistant for a college student. 
      The user's meal history for today is: ${mealHistory}.
      User says: "${userMessage}"
      Provide helpful, concise, and relatable advice. Use Gen Z slang occasionally but keep it professional enough for health. 
      Focus on calorie balance and macronutrients (protein, carbs, fat) if available. 
      Encourage them to stay within their goals while enjoying college life.`,
    });
    return response.text;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Sorry, I'm feeling a bit sluggish. Can you try again?";
  }
}
