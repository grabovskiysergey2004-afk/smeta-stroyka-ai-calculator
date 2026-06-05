export type ProposalStatus = "draft" | "ready" | "sent";

export type Proposal = {
  id: string;
  projectId: string;
  estimateLineIds: string[];
  status: ProposalStatus;
  marginPercent: number;
  taxPercent: number;
  paymentTerms: string;
  warrantyTerms: string;
};
