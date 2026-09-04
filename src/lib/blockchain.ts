type AnchorEvidenceInput = {
  evidenceId: string;
  evidenceHash: string;
  agencyId: string;
};

type AnchorEvidenceResponse = {
  evidenceId: string;
  evidenceHash: string;
  agencyId: string;
  txHash: string;
  blockNumber: number;
  status: "ANCHORED";
};

type VerifyEvidenceInput = {
  evidenceId: string;
  currentHash: string;
};

export type VerifyEvidenceResponse = {
  evidenceId: string;
  anchored: boolean;
  anchoredHash: string;
  currentHash: string;
  verified: boolean;
  status: "NOT_ANCHORED" | "INTEGRITY_VERIFIED" | "INTEGRITY_VIOLATION";
};

const REQUEST_TIMEOUT_MS = 60_000;

class BlockchainServiceError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "BlockchainServiceError";
  }
}

async function request<T>(endpoint: string, body: object): Promise<T> {
  const baseUrl = process.env.BLOCKCHAIN_SERVICE_URL || "http://localhost:4300";
  const headers: HeadersInit = { "Content-Type": "application/json" };
  const apiKey = process.env.BLOCKCHAIN_SERVICE_API_KEY;
  if (apiKey) headers["x-argus-api-key"] = apiKey;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}${endpoint}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });
    const text = await response.text();
    let payload: { data?: T; error?: string } = {};
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      payload = {};
    }

    if (!response.ok) {
      throw new BlockchainServiceError(
        payload.error || `Blockchain service returned HTTP ${response.status}`,
        response.status,
      );
    }
    if (!payload.data) throw new BlockchainServiceError("Blockchain service returned an invalid response");
    return payload.data;
  } catch (error) {
    if (error instanceof BlockchainServiceError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new BlockchainServiceError("Blockchain service request timed out");
    }
    throw new BlockchainServiceError("Blockchain service is unavailable");
  } finally {
    clearTimeout(timeout);
  }
}

export function anchorEvidence(input: AnchorEvidenceInput) {
  return request<AnchorEvidenceResponse>("/api/evidence/anchor", input);
}

export function verifyEvidence(input: VerifyEvidenceInput) {
  return request<VerifyEvidenceResponse>("/api/evidence/verify", input);
}