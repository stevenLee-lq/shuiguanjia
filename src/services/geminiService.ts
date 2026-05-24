import { GoogleGenAI } from "@google/genai";

// 不在模块加载时 new GoogleGenAI：浏览器端 apiKey 为空时 SDK 会抛错，导致整站白屏
const apiKey = (process.env.GEMINI_API_KEY || "").trim();
let ai: GoogleGenAI | null = null;
function getAi(): GoogleGenAI | null {
  if (!apiKey) return null;
  if (!ai) ai = new GoogleGenAI({ apiKey });
  return ai;
}

const MOCK_DATA_CONTEXT = `
当前用户：连云港协鑫生物质发电有限公司
2024年年计划用水量：1,200,000 m³
第一季度用水量：280,000 m³
第二季度用水量：320,000 m³
第三季度用水量：300,000 m³
年累计用水量：900,000 m³
水源类型占比：地表水 (45%), 地下水 (15%), 自来水 (40%)
2023年总用水量：1,150,000 m³
2022年总用水量：1,180,000 m³
`;

export async function askGemini(question: string) {
  const client = getAi();
  if (!client) {
    return "未配置 GEMINI_API_KEY。请在项目根目录创建 .env 并写入：GEMINI_API_KEY=你的密钥，然后重新启动开发服务器。";
  }
  try {
    const response = await client.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `
        你是一个专业的水务管理助手。基于以下公司水务数据回答用户问题：
        ${MOCK_DATA_CONTEXT}
        
        如果用户询问图表，请在回答中包含 [CHART:LINE_3YEARS] 这样的标签，以便前端渲染。
        当前的询问是：${question}
      `,
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return "抱歉，我现在无法处理您的请求。";
  }
}
