# OpenAI Vision identity extraction

This isolated Node.js implementation uses the official OpenAI SDK and Responses API to extract only a name, date of birth, and document number. It preprocesses and validates local images, sends each NIC/licence side separately (or one passport information page), enforces a strict JSON schema, and merges only non-conflicting values. Manually entered registration data is not accepted by this service.

The active registration flow uses this extractor through the existing Express verification endpoint. The deterministic identity matcher and prototype rule remain in the existing verification service; facial liveness remains required.

## Configuration

Set `OPENAI_API_KEY` and optionally `OPENAI_VISION_MODEL` in the backend process environment. The default model is `gpt-4.1-mini`. Do not put API keys in source code, command-line arguments, test files, or logs. The mocked tests do not read `.env` and do not make network requests.

## Local mocked tests

From `server`:

```powershell
node ocr/testOpenAIIdentity.js
```

## Manual live test

Create synthetic test images clearly marked `SAMPLE / NOT VALID`, set your own API key in the backend environment, then from `server` run:

```powershell
node -r dotenv/config ocr/testOpenAIIdentityLive.js nic .\sample-front.png .\sample-back.png
```

For a driving licence, use `license` and two paths. For a passport information page, use `passport` and one path. The script prints only field statuses, not extracted identity values or credentials. This command makes real requests and may incur API charges; it does not enable billing. Live behavior has not been confirmed by the project tests.

## Registration integration

The active registration integration is in `server/ocr/identityVerificationService.js` and uses OpenAI Vision. There is no automatic fallback when OpenAI is unavailable.
