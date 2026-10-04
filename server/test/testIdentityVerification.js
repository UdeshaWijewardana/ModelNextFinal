const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const mongoose = require("mongoose");
const modelRoutes = require("../routes/modelRoutes");

const serverRoot = path.resolve(__dirname, "..");
const imagePath = path.join(__dirname, "test-image.png");
const imageBytes = fs.readFileSync(imagePath);
const savedModels = [];

function createForm({ fullName, birthdate, idType = "nic", image = imageBytes, includeRegistrationFiles = false, livenessSession }) {
  const form = new FormData();
  form.append("fullName", fullName);
  form.append("birthdate", birthdate);
  form.append("idType", idType);
  form.append("verified", "true");
  form.append("verification", JSON.stringify({ verified: true, nameMatch: true, dateOfBirthMatch: true }));
  if (livenessSession) {
    form.append("livenessVerificationId", livenessSession.verificationId);
    form.append("livenessAttemptId", livenessSession.attemptId);
  }
  form.append("idFront", new Blob([image], { type: "image/png" }), "identity-front.png");

  if (includeRegistrationFiles) {
    form.append("idBack", new Blob([image], { type: "image/png" }), "identity-back.png");
    form.append("selfieMedia", new Blob([image], { type: "image/png" }), "selfie.png");
    form.append("email", `ocr-test-${Date.now()}@example.test`);
    form.append("password", "test-only-password");
    form.append("location", "Test location");
    form.append("phone", "0000000000");
    form.append("weight", "60");
    form.append("height", "170");
    form.append("waist", "65");
    form.append("hip", "90");
    form.append("profileImage", new Blob([image], { type: "image/png" }), "profile.png");
    for (let index = 0; index < 6; index += 1) {
      form.append("portfolio", new Blob([image], { type: "image/png" }), `portfolio-${index}.png`);
    }
  }

  return form;
}

async function post(baseUrl, route, form) {
  const response = await fetch(`${baseUrl}/api/models/${route}`, {
    method: "POST",
    body: form,
  });
  return { response, body: await response.json() };
}

async function createCompletedLivenessSession(baseUrl) {
  const startResponse = await fetch(`${baseUrl}/api/models/liveness/start`, { method: "POST" });
  const session = await startResponse.json();
  assert.equal(startResponse.status, 201);
  const completeResponse = await fetch(`${baseUrl}/api/models/liveness/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(session),
  });
  assert.equal(completeResponse.status, 200);
  return session;
}

async function removeStoredUpload(relativePath) {
  if (!relativePath) return;
  try {
    await fs.promises.unlink(path.resolve(serverRoot, relativePath));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

async function testIdentityVerification() {
  assert.equal(mongoose.connection.readyState, 0, "Test must not connect to a real database.");

  const app = express();
  app.use(express.json());
  app.use("/api/models", modelRoutes);
  app.locals.readLocalModels = () => savedModels;
  app.locals.writeLocalModels = (models) => {
    savedModels.splice(0, savedModels.length, ...models);
  };

  const listener = await new Promise((resolve) => {
    const httpServer = app.listen(0, "127.0.0.1", () => resolve(httpServer));
  });
  const baseUrl = `http://127.0.0.1:${listener.address().port}`;
  const createdUploads = [];

  try {
    const correct = await post(baseUrl, "verify-identity", createForm({
      fullName: "John Perera",
      birthdate: "2001-05-12",
    }));
    assert.equal(correct.response.status, 200);
    assert.equal(correct.body.verified, true);
    assert.deepEqual(correct.body.checks, { nameMatch: true, dateOfBirthMatch: true });

    const wrongName = await post(baseUrl, "verify-identity", createForm({
      fullName: "Jane Silva",
      birthdate: "2001-05-12",
    }));
    assert.equal(wrongName.body.verified, false);
    assert.deepEqual(wrongName.body.checks, { nameMatch: false, dateOfBirthMatch: true });

    const wrongDate = await post(baseUrl, "verify-identity", createForm({
      fullName: "John Perera",
      birthdate: "2002-05-12",
    }));
    assert.equal(wrongDate.body.verified, false);
    assert.deepEqual(wrongDate.body.checks, { nameMatch: true, dateOfBirthMatch: false });

    const bothWrong = await post(baseUrl, "verify-identity", createForm({
      fullName: "Jane Silva",
      birthdate: "2002-05-12",
    }));
    assert.equal(bothWrong.body.verified, false);
    assert.deepEqual(bothWrong.body.checks, { nameMatch: false, dateOfBirthMatch: false });

    const unreadable = await post(baseUrl, "verify-identity", createForm({
      fullName: "John Perera",
      birthdate: "2001-05-12",
      image: Buffer.from("not an image"),
    }));
    assert.equal(unreadable.response.status, 400);
    assert.equal(unreadable.body.verified, false);

    const startingCount = savedModels.length;
    const unreadableSession = await createCompletedLivenessSession(baseUrl);
    const unreadableRegistration = await post(baseUrl, "register", createForm({
      fullName: "John Perera",
      birthdate: "2001-05-12",
      image: Buffer.from("not an image"),
      includeRegistrationFiles: true,
      livenessSession: unreadableSession,
    }));
    assert.equal(unreadableRegistration.response.status, 400);
    assert.equal(savedModels.length, startingCount, "Unreadable OCR input must not write to local fallback storage.");

    const mismatchSession = await createCompletedLivenessSession(baseUrl);
    const rejectedRegistration = await post(baseUrl, "register", createForm({
      fullName: "Jane Silva",
      birthdate: "2001-05-12",
      includeRegistrationFiles: true,
      livenessSession: mismatchSession,
    }));
    assert.equal(rejectedRegistration.response.status, 400);
    assert.equal(savedModels.length, startingCount, "OCR mismatch must not write to local fallback storage.");

    const acceptedSession = await createCompletedLivenessSession(baseUrl);
    const acceptedRegistration = await post(baseUrl, "register", createForm({
      fullName: "John Perera",
      birthdate: "2001-05-12",
      includeRegistrationFiles: true,
      livenessSession: acceptedSession,
    }));
    assert.equal(acceptedRegistration.response.status, 201);
    assert.equal(savedModels.length, startingCount + 1, "Local fallback is allowed after OCR passes.");
    createdUploads.push(
      acceptedRegistration.body.model.profileImage,
      ...acceptedRegistration.body.model.portfolioImages,
      acceptedRegistration.body.model.idFrontImage,
      acceptedRegistration.body.model.idBackImage,
      acceptedRegistration.body.model.selfieMedia,
    );

    console.log("Correct identity: passed");
    console.log("Wrong name: rejected");
    console.log("Wrong DOB: rejected");
    console.log("Both mismatched: rejected");
    console.log("Unreadable image: rejected without saving");
    console.log("Forged frontend verification: ignored");
    console.log("OCR mismatch local fallback: not written");
    console.log("OCR-passed local fallback: written");
  } finally {
    await Promise.all(createdUploads.map(removeStoredUpload));
    await new Promise((resolve, reject) => listener.close((error) => error ? reject(error) : resolve()));
  }
}

testIdentityVerification().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});