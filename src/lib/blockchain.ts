import { ethers } from "ethers";

const SEPOLIA_CHAIN_ID = 11155111;
const DEFAULT_RPC_URL = "https://ethereum-sepolia-rpc.publicnode.com";
const DEFAULT_CONTRACT_ADDRESS = "0x1074d4d3975dCC53185994fb8E1718AdDeBDa8ec";

const EVIDENCE_CUSTODY_ABI = [
  "function anchorEvidence(bytes32 evidenceId, bytes32 evidenceHash, bytes32 agencyId)",
  "function createTransfer(bytes32 transferId, bytes32 evidenceId, bytes32 fromAgency, bytes32 toAgency, bytes32 evidenceHash)",
  "function confirmTransfer(bytes32 transferId, bytes32 receivingAgency)",
  "function getEvidenceAnchor(bytes32 evidenceId) view returns (bytes32 evidenceHash, uint64 timestamp, address anchoredBy, bool exists)",
  "function getTransfer(bytes32 transferId) view returns (tuple(bytes32 evidenceId, bytes32 evidenceHash, bytes32 fromAgency, bytes32 toAgency, uint64 createdAt, uint64 confirmedAt, address createdBy, address confirmedBy, uint8 status))",
] as const;

type AnchorEvidenceInput = { evidenceId: string; evidenceHash: string; agencyId: string };

export type AnchorEvidenceResponse = AnchorEvidenceInput & {
  txHash: string;
  blockNumber: number;
  status: "ANCHORED";
};

export type EvidenceAnchor = {
  evidenceId: string;
  evidenceHash: string;
  timestamp: number;
  anchoredBy: string;
  exists: boolean;
};

export type VerifyEvidenceResponse = {
  evidenceId: string;
  anchored: boolean;
  anchoredHash: string;
  currentHash: string;
  verified: boolean;
  status: "NOT_ANCHORED" | "INTEGRITY_VERIFIED" | "INTEGRITY_VIOLATION";
};

export type CustodyTransfer = {
  transferId: string;
  evidenceId: string;
  evidenceHash: string;
  fromAgency: string;
  toAgency: string;
  createdAt: number;
  confirmedAt: number;
  createdBy: string;
  confirmedBy: string;
  status: "NONE" | "PENDING" | "CONFIRMED" | "REJECTED";
};

function getConfig() {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey || !/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    throw new Error("Blockchain wallet configuration is unavailable");
  }
  const contractAddress = process.env.CONTRACT_ADDRESS || DEFAULT_CONTRACT_ADDRESS;
  if (!ethers.isAddress(contractAddress)) throw new Error("Blockchain contract configuration is invalid");
  return {
    rpcUrl: process.env.RPC_URL || DEFAULT_RPC_URL,
    privateKey,
    contractAddress,
  };
}

function getContract() {
  const config = getConfig();
  const provider = new ethers.JsonRpcProvider(config.rpcUrl, SEPOLIA_CHAIN_ID, { staticNetwork: true });
  return new ethers.Contract(config.contractAddress, EVIDENCE_CUSTODY_ABI, new ethers.Wallet(config.privateKey, provider));
}

function toBytes32(value: string): string {
  const clean = value.replace(/^0x/, "");
  if (!/^[0-9a-fA-F]{64}$/.test(clean)) throw new Error("Expected a 32-byte hexadecimal value");
  return `0x${clean}`;
}

export async function anchorEvidence(input: AnchorEvidenceInput): Promise<AnchorEvidenceResponse> {
  const transaction = await getContract().anchorEvidence(ethers.id(input.evidenceId), toBytes32(input.evidenceHash), ethers.id(input.agencyId));
  const receipt = await transaction.wait();
  if (!receipt) throw new Error("Blockchain transaction was not confirmed");
  return { ...input, txHash: transaction.hash, blockNumber: receipt.blockNumber, status: "ANCHORED" };
}

export async function getEvidenceAnchor(evidenceId: string): Promise<EvidenceAnchor> {
  const result = await getContract().getEvidenceAnchor(ethers.id(evidenceId));
  return { evidenceId, evidenceHash: result[0], timestamp: Number(result[1]), anchoredBy: result[2], exists: result[3] };
}

export async function verifyEvidence(input: { evidenceId: string; currentHash: string }): Promise<VerifyEvidenceResponse> {
  const anchor = await getEvidenceAnchor(input.evidenceId);
  const currentHash = toBytes32(input.currentHash);
  const verified = anchor.exists && anchor.evidenceHash.toLowerCase() === currentHash.toLowerCase();
  return {
    evidenceId: input.evidenceId,
    anchored: anchor.exists,
    anchoredHash: anchor.evidenceHash,
    currentHash,
    verified,
    status: !anchor.exists ? "NOT_ANCHORED" : verified ? "INTEGRITY_VERIFIED" : "INTEGRITY_VIOLATION",
  };
}

export async function createTransfer(input: { transferId: string; evidenceId: string; fromAgency: string; toAgency: string; evidenceHash: string }) {
  const transaction = await getContract().createTransfer(ethers.id(input.transferId), ethers.id(input.evidenceId), ethers.id(input.fromAgency), ethers.id(input.toAgency), toBytes32(input.evidenceHash));
  const receipt = await transaction.wait();
  if (!receipt) throw new Error("Blockchain transaction was not confirmed");
  return { ...input, txHash: transaction.hash, blockNumber: receipt.blockNumber, status: "PENDING" as const };
}

export async function confirmTransfer(input: { transferId: string; receivingAgency: string }) {
  const transaction = await getContract().confirmTransfer(ethers.id(input.transferId), ethers.id(input.receivingAgency));
  const receipt = await transaction.wait();
  if (!receipt) throw new Error("Blockchain transaction was not confirmed");
  return { ...input, txHash: transaction.hash, blockNumber: receipt.blockNumber, status: "CONFIRMED" as const };
}

export async function getTransfer(transferId: string): Promise<CustodyTransfer> {
  const result = await getContract().getTransfer(ethers.id(transferId));
  const statuses = ["NONE", "PENDING", "CONFIRMED", "REJECTED"] as const;
  return {
    transferId,
    evidenceId: result.evidenceId,
    evidenceHash: result.evidenceHash,
    fromAgency: result.fromAgency,
    toAgency: result.toAgency,
    createdAt: Number(result.createdAt),
    confirmedAt: Number(result.confirmedAt),
    createdBy: result.createdBy,
    confirmedBy: result.confirmedBy,
    status: statuses[Number(result.status)] || "NONE",
  };
}