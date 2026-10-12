const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const sharp = require("sharp");
const { createOpenAIIdentityExtractor } = require("./openaiIdentityService");
const { evaluateIdentityExtraction } = require("./identityVerificationService");

const validResult = {
  fullName: "Jane Doe",
  dateOfBirth: "2000-01-31",
  documentNumber: "200012345678",
};

async function createSyntheticImage(fileName, rotation = 0) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "sample-not-valid-"));
  const filePath = path.join(directory, fileName);
  const svg = Buffer.from(
    '<svg width="600" height="360" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="white"/><text x="20" y="45" font-size="28">SAMPLE / NOT VALID</text></svg>',
  );
  await sharp(svg).rotate(rotation).png().toFile(filePath);
  return { directory, filePath };
}

function mockedClient(responses, onRequest = () => {}) {
  let index = 0;
  return {
    responses: {
      create: async (...args) => {
        onRequest(...args);
        const result = responses[index];
        index += 1;
        if (result instanceof Error) throw result;
        return { output_text: JSON.stringify(result) };
      },
    },
  };
}

async function withImages(callback, rotation = 0) {
  const front = await createSyntheticImage("sample-front.png", rotation);
  const back = await createSyntheticImage("sample-back.png");
  try {
    await callback([front.filePath, back.filePath]);
  } finally {
    await Promise.all([
      fs.rm(front.directory, { recursive: true, force: true }),
      fs.rm(back.directory, { recursive: true, force: true }),
    ]);
  }
}

async function testSuccessfulExtractionAndFrontBackMerge() {
  await withImages(async filePaths => {
    const requests = [];
    const extractor = createOpenAIIdentityExtractor({
      client: mockedClient([
        { ...validResult, documentNumber: null },
        { fullName: null, dateOfBirth: null, documentNumber: "200012345678" },
      ], (request, options) => requests.push({ request, options })),
    });
    const result = await extractor({ filePaths, idType: "nic" });
    assert.deepEqual(result, {
      documentType: "nic",
      ...validResult,
      fieldStatus: {
        fullName: "extracted",
        dateOfBirth: "extracted",
        documentNumber: "extracted",
      },
    });
    assert.equal(requests.length, 2);
    for (const { request, options } of requests) {
      assert.equal(request.text.format.strict, true);
      assert.equal(request.model, process.env.OPENAI_VISION_MODEL?.trim() || "gpt-4.1-mini");
      assert.equal(options.maxRetries, 0);
      assert.equal(request.input[0].content[0].type, "input_text");
      assert.equal(request.input[0].content[1].image_url.startsWith("data:image/jpeg;base64,"), true);
      assert.equal(request.input[0].content[0].text.includes("Jane Doe"), false);
    }
  });
}

async function testRotatedImagesAndMissingFields() {
  await withImages(async filePaths => {
    const extractor = createOpenAIIdentityExtractor({
      client: mockedClient([
        { ...validResult, fullName: null },
        { fullName: null, dateOfBirth: null, documentNumber: null },
      ]),
    });
    const result = await extractor({ filePaths, idType: "nic" });
    assert.equal(result.fullName, null);
    assert.equal(result.dateOfBirth, "2000-01-31");
    assert.equal(result.documentNumber, "200012345678");
    assert.equal(result.fieldStatus.fullName, "unable_to_read");
  }, 90);
}

async function testConflictsAndInvalidImage() {
  await withImages(async filePaths => {
    const extractor = createOpenAIIdentityExtractor({
      client: mockedClient([
        validResult,
        { ...validResult, fullName: "Jane Smith", dateOfBirth: "2001-02-01" },
      ]),
    });
    const result = await extractor({ filePaths, idType: "nic" });
    assert.equal(result.fullName, null);
    assert.equal(result.dateOfBirth, null);
    assert.equal(result.documentNumber, "200012345678");
    await assert.rejects(
      createOpenAIIdentityExtractor({ client: mockedClient([]) })({
        filePaths: [path.join(path.dirname(filePaths[0]), "missing.png"), filePaths[1]],
        idType: "nic",
      }),
      error => error.code === "IDENTITY_IMAGE_INVALID",
    );
  });
}

async function testControlledAPIErrorsAndResponseValidation() {
  await withImages(async filePaths => {
    const cases = [
      [Object.assign(new Error("unauthorized"), { status: 401 }), "OPENAI_AUTHENTICATION_ERROR"],
      [Object.assign(new Error("quota"), { status: 429, code: "insufficient_quota" }), "OPENAI_QUOTA_EXCEEDED"],
      [Object.assign(new Error("timeout"), { name: "APIConnectionTimeoutError" }), "OPENAI_TIMEOUT"],
    ];
    for (const [apiError, expectedCode] of cases) {
      await assert.rejects(
        createOpenAIIdentityExtractor({ client: mockedClient([apiError]) })({
          filePaths,
          idType: "nic",
        }),
        error => error.code === expectedCode,
      );
    }
    await assert.rejects(
      createOpenAIIdentityExtractor({
        client: { responses: { create: async () => ({ output_text: '{"unexpected":true}' }) } },
      })({ filePaths, idType: "nic" }),
      error => error.code === "OPENAI_INVALID_RESPONSE",
    );
  });
}

async function testPassportAndRequestValidation() {
  const image = await createSyntheticImage("sample-passport.png");
  try {
    const extractor = createOpenAIIdentityExtractor({ client: mockedClient([validResult]) });
    const result = await extractor({ filePaths: [image.filePath], idType: "passport" });
    assert.equal(result.documentType, "passport");
    await assert.rejects(
      extractor({ filePaths: [image.filePath], idType: "license" }),
      error => error.code === "OCR_INVALID_REQUEST",
    );
  } finally {
    await fs.rm(image.directory, { recursive: true, force: true });
  }
}

function testExistingMatcherAndPrototypeGate() {
  const evaluate = (fullName, dateOfBirth, documentNumber) => evaluateIdentityExtraction({
    extraction: {
      documentType: "nic",
      fullName,
      dateOfBirth,
      documentNumber,
      fieldStatus: {
        fullName: fullName ? "extracted" : "unable_to_read",
        dateOfBirth: dateOfBirth ? "extracted" : "unable_to_read",
        documentNumber: documentNumber ? "extracted" : "unable_to_read",
      },
    },
    fullName: "Jane Mary Ann Doe",
    birthdate: "2000-01-31",
    idType: "nic",
    identityDocumentNumber: "200012345678",
  });

  const partialName = evaluate("Jane Mary", "2000-01-31", "200012345678");
  assert.equal(partialName.checks.name.status, "partial_match");
  assert.equal(partialName.verified, false);
  assert.equal(partialName.prototypePassed, true);

  const wrongName = evaluate("Other Person", "2000-01-31", "200012345678");
  assert.equal(wrongName.checks.name.status, "mismatch");
  assert.equal(wrongName.verified, false);
  assert.equal(wrongName.prototypePassed, true);

  assert.equal(evaluate("Jane Mary Ann Doe", "2001-01-31", "200012345678").prototypePassed, false);
  assert.equal(evaluate("Jane Mary Ann Doe", "2000-01-31", "200012345679").prototypePassed, false);
  const unreadableName = evaluate(null, "2000-01-31", "200012345678");
  assert.equal(unreadableName.checks.name.status, "unable_to_read");
  assert.equal(unreadableName.prototypePassed, true);
}

async function main() {
  await testSuccessfulExtractionAndFrontBackMerge();
  await testRotatedImagesAndMissingFields();
  await testConflictsAndInvalidImage();
  await testControlledAPIErrorsAndResponseValidation();
  await testPassportAndRequestValidation();
  testExistingMatcherAndPrototypeGate();
  console.log("OpenAI identity unit tests passed (mocked SDK only; no external requests).");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
