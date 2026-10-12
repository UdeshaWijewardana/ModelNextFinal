const fs = require("node:fs/promises");
const path = require("node:path");
const sharp = require("sharp");
const { createIdentityPrompt } = require("./identityPrompt");
const {
  identityExtractionSchema,
  mergeIdentityExtractions,
  validateIdentityPayload,
} = require("./identitySchema");

const DOCUMENT_TYPES = new Set(["nic", "license", "passport"]);
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 30_000_000;
const MAX_IMAGE_SIDE = 2400;
const DEFAULT_TIMEOUT_MS = 90_000;

function createOpenAIError(code, message, cause) {
  return Object.assign(new Error(message, cause ? { cause } : undefined), { code });
}

function classifyOpenAIError(error) {
  const status = error?.status;
  const apiCode = String(error?.code || "").toLowerCase();
  if (status === 401 || status === 403 || apiCode.includes("authentication")) {
    return createOpenAIError("OPENAI_AUTHENTICATION_ERROR", "OpenAI authentication failed.", error);
  }
  if (status === 429 && (apiCode.includes("quota") || apiCode.includes("billing") || apiCode.includes("insufficient"))) {
    return createOpenAIError("OPENAI_QUOTA_EXCEEDED", "OpenAI quota is unavailable.", error);
  }
  if (
    error?.name === "AbortError"
    || error?.name === "APIConnectionTimeoutError"
    || apiCode === "etimedout"
    || apiCode === "econnaborted"
  ) {
    return createOpenAIError("OPENAI_TIMEOUT", "OpenAI identity extraction timed out.", error);
  }
  return createOpenAIError("OPENAI_SERVICE_UNAVAILABLE", "OpenAI identity extraction is unavailable.", error);
}

async function prepareImage(filePath) {
  let imageBuffer;
  try {
    const stats = await fs.stat(filePath);
    if (!stats.isFile() || stats.size <= 0 || stats.size > MAX_IMAGE_BYTES) {
      throw new Error("Unsupported image size.");
    }
    imageBuffer = await sharp(filePath, { limitInputPixels: MAX_IMAGE_PIXELS })
      .rotate()
      .resize({
        width: MAX_IMAGE_SIDE,
        height: MAX_IMAGE_SIDE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 85 })
      .toBuffer();
  } catch (error) {
    throw createOpenAIError("IDENTITY_IMAGE_INVALID", "The identity image is invalid or unsupported.", error);
  }
  return `data:image/jpeg;base64,${imageBuffer.toString("base64")}`;
}

function parseResponse(response) {
  if (typeof response?.output_text !== "string") {
    throw createOpenAIError("OPENAI_INVALID_RESPONSE", "OpenAI returned no structured identity result.");
  }
  try {
    return JSON.parse(response.output_text);
  } catch (error) {
    throw createOpenAIError("OPENAI_INVALID_RESPONSE", "OpenAI returned malformed identity JSON.", error);
  }
}

async function requestImageExtraction(client, imageUrl, model, documentType, imageIndex, imageCount, timeoutMs) {
  let response;
  try {
    response = await client.responses.create({
      model,
      input: [{
        role: "user",
        content: [
          { type: "input_text", text: createIdentityPrompt(documentType, imageIndex, imageCount) },
          { type: "input_image", image_url: imageUrl, detail: "high" },
        ],
      }],
      text: {
        format: {
          type: "json_schema",
          name: "identity_document_fields",
          strict: true,
          schema: identityExtractionSchema,
        },
      },
    }, { timeout: timeoutMs, maxRetries: 0 });
  } catch (error) {
    throw classifyOpenAIError(error);
  }
  return validateIdentityPayload(parseResponse(response), documentType);
}

function createOpenAIIdentityExtractor({ client: suppliedClient, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  return async function extractIdentityDocuments({ filePaths, idType }) {
    if (!DOCUMENT_TYPES.has(idType)) {
      throw createOpenAIError("OCR_INVALID_REQUEST", "Unsupported identity document type.");
    }
    const paths = Array.isArray(filePaths) ? filePaths : [];
    const expectedImages = idType === "passport" ? 1 : 2;
    if (paths.length !== expectedImages || paths.some(filePath => typeof filePath !== "string" || !filePath)) {
      throw createOpenAIError("OCR_INVALID_REQUEST", "The required identity document images were not provided.");
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!suppliedClient && !apiKey) {
      throw createOpenAIError("OPENAI_CONFIG_ERROR", "OpenAI API credentials are not configured.");
    }
    const model = (process.env.OPENAI_VISION_MODEL || "gpt-4.1-mini").trim();
    if (!model) throw createOpenAIError("OPENAI_CONFIG_ERROR", "OpenAI Vision model is not configured.");

    let client = suppliedClient;
    if (!client) {
      const OpenAI = require("openai");
      client = new OpenAI({ apiKey, timeout: timeoutMs, maxRetries: 0 });
    }

    try {
      const extractions = [];
      for (let index = 0; index < paths.length; index += 1) {
        const imageUrl = await prepareImage(path.resolve(paths[index]));
        extractions.push(await requestImageExtraction(
          client,
          imageUrl,
          model,
          idType,
          index,
          paths.length,
          timeoutMs,
        ));
      }
      return mergeIdentityExtractions(extractions, idType);
    } catch (error) {
      if (
        error.code === "IDENTITY_IMAGE_INVALID"
        || error.code === "OCR_INVALID_REQUEST"
        || error.code === "OPENAI_AUTHENTICATION_ERROR"
        || error.code === "OPENAI_QUOTA_EXCEEDED"
        || error.code === "OPENAI_TIMEOUT"
        || error.code === "OPENAI_INVALID_RESPONSE"
        || error.code === "OPENAI_CONFIG_ERROR"
      ) throw error;
      throw classifyOpenAIError(error);
    }
  };
}

module.exports = {
  createOpenAIIdentityExtractor,
  prepareImage,
};
