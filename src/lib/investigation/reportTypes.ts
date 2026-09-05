export interface BriefSectionSelection {
  executiveSummary: boolean;
  keyFindings: boolean;
  leads: boolean;
  keyEntities: boolean;
  bridgeIntelligence: boolean;
  financialIntelligence: boolean;
  geospatialIntelligence: boolean;
  temporalReconstruction: boolean;
  evidence: boolean;
  argusAnalysis: boolean;
  investigationTasks: boolean;
  verificationProvenance: boolean;
}

export interface BriefCustomContent {
  bridgeFindings?: {
    entityId: string;
    label: string;
    communities: string[];
    structuralImpact: string;
    explanation: string;
  }[];
  financialFindings?: {
    id: string;
    title: string;
    amount?: number;
    channel?: string;
    date?: string;
    source?: string;
    target?: string;
    details: string;
  }[];
  temporalFindings?: {
    id: string;
    timeWindow: string;
    title: string;
    details: string;
  }[];
  geographicFindings?: {
    id: string;
    locationName: string;
    eventTitle: string;
    details: string;
  }[];
  argusAnalyses?: {
    id: string;
    question: string;
    response: string;
    contextLabel?: string;
    generatedAt: string;
  }[];
  addedEvidenceIds?: string[];
}

export interface CompleteReportModel {
  investigation: {
    id: string;
    title: string;
    caseNumber: string;
    status: string;
    startDate?: string | null;
    endDate?: string | null;
    leadName?: string | null;
  };
  generatedAt: string;
  sections: BriefSectionSelection;
  executiveSummary: string;
  keyFindings: {
    id: string;
    finding: string;
    whyItMatters: string;
    status: string;
    isInferred: boolean;
  }[];
  leads: {
    id: string;
    title: string;
    category: string;
    priority?: string;
    explanation?: string;
    status: string;
    evidenceCount: number;
  }[];
  entities: {
    id: string;
    label: string;
    type: string;
    relationshipCount: number;
    context?: string;
  }[];
  bridgeIntelligence: {
    entityId: string;
    label: string;
    communities: string[];
    structuralImpact: string;
    explanation: string;
  }[];
  financialIntelligence: {
    id: string;
    title: string;
    amount?: number;
    channel?: string;
    date?: string;
    source?: string;
    target?: string;
    details: string;
  }[];
  geospatialIntelligence: {
    id: string;
    locationName: string;
    eventTitle: string;
    details: string;
  }[];
  temporalReconstruction: {
    id: string;
    timeWindow: string;
    title: string;
    details: string;
  }[];
  evidence: {
    id: string;
    title: string;
    type: string;
    source?: string | null;
    uploadedAt?: string | null;
    status: string;
    hash?: string | null;
  }[];
  argusAnalyses: {
    id: string;
    question: string;
    response: string;
    contextLabel?: string;
    generatedAt: string;
  }[];
  tasks: {
    id: string;
    title: string;
    priority: string;
    status: string;
    whyItMatters?: string;
    expectedOutcome?: string;
    conclusion?: string;
  }[];
  verificationProvenance: {
    verifiedCount: number;
    underReviewCount: number;
    rejectedCount: number;
    aiSuggestedCount: number;
    blockchainStatus: string;
  };
}
