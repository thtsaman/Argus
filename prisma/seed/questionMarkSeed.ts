import fs from "fs";
import path from "path";
import {
  EntityType,
  EvidenceType,
  EvidenceStatus,
  InvestigationStatus,
  PrismaClient,
  RelationshipStatus,
  RelationshipType,
  CandidateType,
  CandidateStatus,
} from "@prisma/client";

const CASE_NUMBER = "INV-2026-WB-0999";
const CASE_TITLE = "Operation Question Mark — Cross-State Examination Paper Leak Investigation";

export async function seedQuestionMark(db: PrismaClient) {
  console.log("Checking Operation Question Mark seed status...");

  // Check if investigation already exists
  const existingInv = await db.investigation.findUnique({
    where: { caseNumber: CASE_NUMBER },
  });

  if (existingInv) {
    console.log(`Investigation '${CASE_TITLE}' (${CASE_NUMBER}) already exists. Cleaning existing data for re-seeding...`);
    // Delete existing child records for idempotency
    await db.$transaction(async (tx) => {
      await tx.candidateFinding.deleteMany({ where: { investigationId: existingInv.id } });
      await tx.relationshipEvidence.deleteMany({ where: { relationship: { investigationId: existingInv.id } } });
      await tx.eventEvidence.deleteMany({ where: { event: { investigationId: existingInv.id } } });
      await tx.transaction.deleteMany({ where: { investigationId: existingInv.id } });
      await tx.financialEntity.deleteMany({ where: { investigationId: existingInv.id } });
      await tx.investigationTask.deleteMany({ where: { investigationId: existingInv.id } });
      await tx.relationship.deleteMany({ where: { investigationId: existingInv.id } });
      await tx.event.deleteMany({ where: { investigationId: existingInv.id } });
      await tx.entityAlias.deleteMany({ where: { entity: { investigationId: existingInv.id } } });
      await tx.entity.deleteMany({ where: { investigationId: existingInv.id } });
      await tx.evidenceItem.deleteMany({ where: { investigationId: existingInv.id } });
      await tx.location.deleteMany({ where: { investigationId: existingInv.id } });
      await tx.investigation.delete({ where: { id: existingInv.id } });
    });
  }

  // Find or use a demo investigator user if available
  const investigatorUser = await db.user.findFirst({
    where: { role: "INVESTIGATOR" },
  });

  // 1. Create Investigation
  const investigation = await db.investigation.create({
    data: {
      title: CASE_TITLE,
      description:
        "A fictional cross-state investigation examining four examination-paper leak incidents reported across West Bengal, Bihar, and Odisha between February and August 2026. Investigators are examining whether recurring people, organizations, communications, financial activity, vehicle movements, and examination logistics indicate a connected network. The available evidence identifies several investigative leads but does not establish a single mastermind or criminal responsibility.",
      status: InvestigationStatus.ARCHIVED,
      caseNumber: CASE_NUMBER,
      startDate: new Date("2026-02-10"),
      endDate: new Date("2026-08-20"),
      leadId: investigatorUser?.id || null,
    },
  });

  console.log(`Created investigation: ${investigation.title} (${investigation.id})`);

  // 2. Read Evidence Files & Create Evidence Records
  const seedDir = path.join(process.cwd(), "prisma", "seed", "questionMark");
  
  // Mapping of filenames to evidence titles and types
  const fileConfigs: Record<
    string,
    { title: string; type: EvidenceType; source: string; description: string }
  > = {
    "01_incident_reports.pdf": {
      title: "Cross-State Incident Reports — EX-01 to EX-04",
      type: EvidenceType.REPORT,
      source: "Inter-State Examination Security Coordination Cell",
      description: "Official synthesis report documenting four examination paper leak incidents in West Bengal, Bihar, and Odisha between Feb and Aug 2026.",
    },
    "02_communication_records.csv": {
      title: "Telecom & Communication Records Log",
      type: EvidenceType.COMMUNICATION,
      source: "Telecom Provider Extraction / Lawful Intercept Log",
      description: "Log of call timestamps, durations, and phone numbers connecting subjects prior to and on incident dates.",
    },
    "03_printing_and_dispatch_records.csv": {
      title: "Printing & Logistics Dispatch Manifest",
      type: EvidenceType.DOCUMENT,
      source: "SecurePrint Solutions / Facility Audit Log",
      description: "Records of examination paper printing packets, shipment IDs, assigned personnel, vehicles, and destination depots.",
    },
    "04_financial_transactions.csv": {
      title: "Financial Ledger & Account Transfer Records",
      type: EvidenceType.FINANCIAL,
      source: "Banking Intelligence & Transaction Records",
      description: "Statement of bank transfers between accounts ACC-1042, ACC-2098, ACC-3181, and ACC-4420 around incident dates.",
    },
    "05_vehicle_movement_records.csv": {
      title: "Vehicle Movement & Highway Transit Logs",
      type: EvidenceType.REPORT,
      source: "Highway Transport Register & Surveillance Records",
      description: "Log of vehicle transit timestamps and location arrivals for WB12AB1234, WB08XY7742, and OD05EF7788.",
    },
    "06_employment_records.csv": {
      title: "Corporate Employment & Roster Registry",
      type: EvidenceType.STRUCTURED_DATA,
      source: "HR & Contractor Registry Audit",
      description: "Employment affiliations for Eastern Examination Services, MeritEdge Academy, SecurePrint Solutions, and RapidRoute Logistics.",
    },
    "07_warehouse_access_logs.csv": {
      title: "Warehouse & Security Access Control Logs",
      type: EvidenceType.DOCUMENT,
      source: "SecurePrint Dispatch Floor Security Access Register",
      description: "Electronic badge and visitor log entries at the Durgapur printing dispatch facility and warehouse area.",
    },
    "08_witness_statements.md": {
      title: "Investigative Witness Statements (01-03)",
      type: EvidenceType.DOCUMENT,
      source: "Field Investigation Witness Transcripts",
      description: "Depositions from warehouse employees, exam staff, and transport depot staff regarding physical observations.",
    },
    "09_digital_circulation_report.md": {
      title: "Digital Circulation & Messaging Analysis Report",
      type: EvidenceType.REPORT,
      source: "Cyber Forensics & Social Media Monitoring Unit",
      description: "Forensic report detailing early digital circulation timestamps of leaked examination paper PDFs in private messaging channels.",
    },
    "10_investigator_notes.md": {
      title: "Senior Investigator Summary Notes & Hypotheses",
      type: EvidenceType.REPORT,
      source: "Lead Investigator Case Summary",
      description: "Analytical summary outlining known facts, investigative gaps, key uncertainties, and recommended next steps.",
    },
  };

  const evidenceMap = new Map<string, string>(); // filename -> evidenceId

  for (const [filename, config] of Object.entries(fileConfigs)) {
    const filePath = path.join(seedDir, filename);
    let content = "";
    let sizeBytes = 0;

    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      sizeBytes = stats.size;
      // Read text files (skip binary PDF content string, provide text excerpt)
      if (filename.endsWith(".pdf")) {
        content = "PDF Document: Operation Question Mark Cross-State Examination Paper Leak Investigation Incident Reports. Covers incidents EX-01 (Kolkata/Durgapur), EX-02 (Patna), EX-03 (Bhubaneswar), and EX-04 (Asansol/Kolkata).";
      } else {
        content = fs.readFileSync(filePath, "utf-8");
      }
    }

    const item = await db.evidenceItem.create({
      data: {
        investigationId: investigation.id,
        title: config.title,
        description: config.description,
        type: config.type,
        status: EvidenceStatus.REVIEWED,
        source: config.source,
        fileName: filename,
        mimeType: filename.endsWith(".pdf") ? "application/pdf" : filename.endsWith(".csv") ? "text/csv" : "text/markdown",
        normalizedContent: content,
        rawContent: content,
        metadata: {
          originalFilename: filename,
          fileSizeBytes: sizeBytes,
        },
        uploadedAt: new Date("2026-08-21T09:00:00Z"),
        processedAt: new Date("2026-08-21T09:15:00Z"),
      },
    });

    evidenceMap.set(filename, item.id);
  }

  // 3. Create Locations
  const locationConfigs = [
    { name: "Kolkata Examination Warehouse", lat: 22.5726, lng: 88.3639, region: "Kolkata, West Bengal", address: "Central Exam Depot, Kolkata" },
    { name: "SecurePrint Solutions — Durgapur", lat: 23.5204, lng: 87.3119, region: "Paschim Bardhaman, West Bengal", address: "Industrial Zone, Durgapur" },
    { name: "Patna Regional Depot", lat: 25.5941, lng: 85.1376, region: "Patna, Bihar", address: "State Transit Depot, Patna" },
    { name: "Bhubaneswar Regional Depot", lat: 20.2961, lng: 85.8245, region: "Bhubaneswar, Odisha", address: "Regional Materials Hub, Bhubaneswar" },
    { name: "Asansol Examination Centre", lat: 23.6739, lng: 86.9524, region: "Paschim Bardhaman, West Bengal", address: "District Exam Centre, Asansol" },
  ];

  const locationMap = new Map<string, string>();
  for (const loc of locationConfigs) {
    const l = await db.location.create({
      data: {
        investigationId: investigation.id,
        name: loc.name,
        latitude: loc.lat,
        longitude: loc.lng,
        region: loc.region,
        address: loc.address,
      },
    });
    locationMap.set(loc.name, l.id);
  }

  // 4. Create Trusted Entities
  const entityConfigs: { label: string; type: EntityType; description: string; metadata?: any }[] = [
    // People
    { label: "Arjun Mehta", type: EntityType.PERSON, description: "Examination Logistics Coordinator at Eastern Examination Services. Appears in logistics and communications around EX-01, EX-02, and EX-04." },
    { label: "Vikram Sethi", type: EntityType.PERSON, description: "Coaching Operator at MeritEdge Academy. Key communications bridge entity appearing around multiple incidents." },
    { label: "Neha Sharma", type: EntityType.PERSON, description: "Regional Coordinator at MeritEdge Academy. Appears in communication logs around EX-01, EX-02, and EX-03." },
    { label: "Rahul Verma", type: EntityType.PERSON, description: "Production Supervisor at SecurePrint Solutions (until March 2026). Appears in printing dispatch and warehouse logs." },
    { label: "Karan Das", type: EntityType.PERSON, description: "Transport Contractor at RapidRoute Logistics. Appears in logistics and communication logs around EX-03 and EX-04." },
    { label: "Sana Khan", type: EntityType.PERSON, description: "Accounts Executive at Eastern Examination Services. Operational administrative communications." },
    { label: "Rohan Gupta", type: EntityType.PERSON, description: "Regional Examination Coordinator at Eastern Examination Services. Professional administrative contact." },
    { label: "Meera Iyer", type: EntityType.PERSON, description: "Administrative Officer at Eastern Examination Services. Administrative office contact." },
    { label: "Aakash Roy", type: EntityType.PERSON, description: "Warehouse and Dispatch Assistant at SecurePrint Solutions. Present during dispatch and warehouse access." },
    { label: "Nitin Das", type: EntityType.PERSON, description: "Vehicle Operator at RapidRoute Logistics. Vehicle scheduling contact." },
    { label: "Pooja Sen", type: EntityType.PERSON, description: "Centre Administrator at MeritEdge Academy. Educational administration officer." },
    { label: "Imran Ali", type: EntityType.PERSON, description: "External Service Vendor at SecurePrint Solutions. Logged in visitor access log on day of EX-04 dispatch." },

    // Organizations
    { label: "Eastern Examination Services", type: EntityType.ORGANIZATION, description: "Primary organization responsible for examination logistics and administration." },
    { label: "MeritEdge Academy", type: EntityType.ORGANIZATION, description: "Private coaching institute network operating across West Bengal and Bihar." },
    { label: "SecurePrint Solutions", type: EntityType.ORGANIZATION, description: "Security printing contractor facility located in Durgapur." },
    { label: "RapidRoute Logistics", type: EntityType.ORGANIZATION, description: "Transport and logistics contractor hired for examination paper transit." },

    // Vehicles
    { label: "WB12AB1234", type: EntityType.VEHICLE, description: "Logistics transport vehicle used in EX-01 and EX-02 movements." },
    { label: "WB08XY7742", type: EntityType.VEHICLE, description: "Logistics transport vehicle used in EX-04 movements." },
    { label: "OD05EF7788", type: EntityType.VEHICLE, description: "Logistics transport vehicle used in EX-03 movements." },

    // Accounts
    { label: "ACC-1042", type: EntityType.ACCOUNT, description: "Payer bank account used for consulting and training payments." },
    { label: "ACC-2098", type: EntityType.ACCOUNT, description: "Recipient account associated with multiple pre-incident consulting payments." },
    { label: "ACC-3181", type: EntityType.ACCOUNT, description: "Transport contractor account used for logistics payments." },
    { label: "ACC-4420", type: EntityType.ACCOUNT, description: "Route logistics recipient account." },
  ];

  const entityMap = new Map<string, string>();
  for (const ent of entityConfigs) {
    const e = await db.entity.create({
      data: {
        investigationId: investigation.id,
        label: ent.label,
        type: ent.type,
        description: ent.description,
        metadata: ent.metadata ?? undefined,
      },
    });
    entityMap.set(ent.label, e.id);
  }

  // 5. Create Relationships with Provenance Links
  const relationshipConfigs: {
    source: string;
    target: string;
    type: RelationshipType;
    status: RelationshipStatus;
    confidence?: number;
    description: string;
    evidenceFilename: string;
    excerpt: string;
  }[] = [
    // Employment & Organizational Structure
    {
      source: "Arjun Mehta",
      target: "Eastern Examination Services",
      type: RelationshipType.EMPLOYED_BY,
      status: RelationshipStatus.VERIFIED,
      description: "Examination Logistics Coordinator at Eastern Examination Services",
      evidenceFilename: "06_employment_records.csv",
      excerpt: "Arjun Mehta, Eastern Examination Services, Examination Logistics Coordinator, 2025-01-10 to Present",
    },
    {
      source: "Vikram Sethi",
      target: "MeritEdge Academy",
      type: RelationshipType.EMPLOYED_BY,
      status: RelationshipStatus.VERIFIED,
      description: "Coaching Operator at MeritEdge Academy",
      evidenceFilename: "06_employment_records.csv",
      excerpt: "Vikram Sethi, MeritEdge Academy, Coaching Operator, 2024-04-01 to Present",
    },
    {
      source: "Neha Sharma",
      target: "MeritEdge Academy",
      type: RelationshipType.EMPLOYED_BY,
      status: RelationshipStatus.VERIFIED,
      description: "Regional Coordinator at MeritEdge Academy",
      evidenceFilename: "06_employment_records.csv",
      excerpt: "Neha Sharma, MeritEdge Academy, Regional Coordinator, 2025-06-15 to Present",
    },
    {
      source: "Rahul Verma",
      target: "SecurePrint Solutions",
      type: RelationshipType.EMPLOYED_BY,
      status: RelationshipStatus.VERIFIED,
      description: "Production Supervisor at SecurePrint Solutions",
      evidenceFilename: "06_employment_records.csv",
      excerpt: "Rahul Verma, SecurePrint Solutions, Production Supervisor, 2024-06-01 to 2026-03-15",
    },
    {
      source: "Karan Das",
      target: "RapidRoute Logistics",
      type: RelationshipType.EMPLOYED_BY,
      status: RelationshipStatus.VERIFIED,
      description: "Transport Contractor at RapidRoute Logistics",
      evidenceFilename: "06_employment_records.csv",
      excerpt: "Karan Das, RapidRoute Logistics, Transport Contractor, 2025-02-01 to Present",
    },
    {
      source: "Aakash Roy",
      target: "SecurePrint Solutions",
      type: RelationshipType.EMPLOYED_BY,
      status: RelationshipStatus.VERIFIED,
      description: "Warehouse and Dispatch Assistant at SecurePrint Solutions",
      evidenceFilename: "06_employment_records.csv",
      excerpt: "Aakash Roy, SecurePrint Solutions, Warehouse and Dispatch Assistant, 2025-01-20 to Present",
    },
    {
      source: "Sana Khan",
      target: "Eastern Examination Services",
      type: RelationshipType.EMPLOYED_BY,
      status: RelationshipStatus.VERIFIED,
      description: "Accounts Executive at Eastern Examination Services",
      evidenceFilename: "06_employment_records.csv",
      excerpt: "Sana Khan, Eastern Examination Services, Accounts Executive",
    },
    {
      source: "Rohan Gupta",
      target: "Eastern Examination Services",
      type: RelationshipType.EMPLOYED_BY,
      status: RelationshipStatus.VERIFIED,
      description: "Regional Examination Coordinator at Eastern Examination Services",
      evidenceFilename: "06_employment_records.csv",
      excerpt: "Rohan Gupta, Eastern Examination Services, Regional Examination Coordinator",
    },
    {
      source: "Meera Iyer",
      target: "Eastern Examination Services",
      type: RelationshipType.EMPLOYED_BY,
      status: RelationshipStatus.VERIFIED,
      description: "Administrative Officer at Eastern Examination Services",
      evidenceFilename: "06_employment_records.csv",
      excerpt: "Meera Iyer, Eastern Examination Services, Administrative Officer",
    },
    {
      source: "Nitin Das",
      target: "RapidRoute Logistics",
      type: RelationshipType.EMPLOYED_BY,
      status: RelationshipStatus.VERIFIED,
      description: "Vehicle Operator at RapidRoute Logistics",
      evidenceFilename: "06_employment_records.csv",
      excerpt: "Nitin Das, RapidRoute Logistics, Vehicle Operator",
    },
    {
      source: "Pooja Sen",
      target: "MeritEdge Academy",
      type: RelationshipType.EMPLOYED_BY,
      status: RelationshipStatus.VERIFIED,
      description: "Centre Administrator at MeritEdge Academy",
      evidenceFilename: "06_employment_records.csv",
      excerpt: "Pooja Sen, MeritEdge Academy, Centre Administrator",
    },

    // Communications
    {
      source: "Arjun Mehta",
      target: "Vikram Sethi",
      type: RelationshipType.COMMUNICATED_WITH,
      status: RelationshipStatus.VERIFIED,
      confidence: 0.95,
      description: "Repeated phone communications recorded 1 day prior to EX-01, EX-02, and EX-04 incidents.",
      evidenceFilename: "02_communication_records.csv",
      excerpt: "2026-02-13 10:14 Arjun Mehta -> Vikram Sethi (8 min 12 sec), 2026-04-21 18:26, 2026-08-18 06:54",
    },
    {
      source: "Vikram Sethi",
      target: "Neha Sharma",
      type: RelationshipType.COMMUNICATED_WITH,
      status: RelationshipStatus.VERIFIED,
      confidence: 0.92,
      description: "Direct communications on the morning of reported leaks for EX-01 and EX-02.",
      evidenceFilename: "02_communication_records.csv",
      excerpt: "2026-02-14 07:42 Vikram Sethi -> Neha Sharma, 2026-04-22 08:17 Vikram Sethi -> Neha Sharma",
    },
    {
      source: "Karan Das",
      target: "Neha Sharma",
      type: RelationshipType.COMMUNICATED_WITH,
      status: RelationshipStatus.VERIFIED,
      confidence: 0.88,
      description: "Phone communication on the evening prior to EX-03 paper leak in Odisha.",
      evidenceFilename: "02_communication_records.csv",
      excerpt: "2026-07-08 16:48 Karan Das -> Neha Sharma (6 min 3 sec)",
    },
    {
      source: "Rahul Verma",
      target: "Arjun Mehta",
      type: RelationshipType.COMMUNICATED_WITH,
      status: RelationshipStatus.UNDER_REVIEW,
      confidence: 0.75,
      description: "Phone call on the evening before EX-04 dispatch.",
      evidenceFilename: "02_communication_records.csv",
      excerpt: "2026-08-17 19:12 Rahul Verma -> Arjun Mehta (4 min 36 sec)",
    },

    // Logistics & Vehicles
    {
      source: "Rahul Verma",
      target: "WB12AB1234",
      type: RelationshipType.ASSOCIATED_WITH,
      status: RelationshipStatus.VERIFIED,
      description: "Supervisor associated with dispatch shipments SP-260212-17 and SP-260420-11 transported by WB12AB1234.",
      evidenceFilename: "03_printing_and_dispatch_records.csv",
      excerpt: "2026-02-12 Rahul Verma, SecurePrint Solutions, Shipment SP-260212-17, Vehicle WB12AB1234",
    },
    {
      source: "Karan Das",
      target: "OD05EF7788",
      type: RelationshipType.ASSOCIATED_WITH,
      status: RelationshipStatus.VERIFIED,
      description: "Transport contractor associated with vehicle OD05EF7788 during EX-03 dispatch.",
      evidenceFilename: "03_printing_and_dispatch_records.csv",
      excerpt: "2026-07-08 SecurePrint Solutions, Vehicle OD05EF7788 to Bhubaneswar Regional Depot",
    },
    {
      source: "Rahul Verma",
      target: "WB08XY7742",
      type: RelationshipType.ASSOCIATED_WITH,
      status: RelationshipStatus.VERIFIED,
      description: "Supervisor associated with EX-04 dispatch packet transported by vehicle WB08XY7742.",
      evidenceFilename: "03_printing_and_dispatch_records.csv",
      excerpt: "2026-08-17 Rahul Verma, Shipment SP-260817-22, Vehicle WB08XY7742 to Asansol Examination Centre",
    },

    // Financial
    {
      source: "ACC-1042",
      target: "ACC-2098",
      type: RelationshipType.TRANSACTED_WITH,
      status: RelationshipStatus.UNDER_REVIEW,
      confidence: 0.85,
      description: "Multiple high-value payments (INR 85k, 62k, 73k) near EX-01, EX-02, and EX-04 incident dates.",
      evidenceFilename: "04_financial_transactions.csv",
      excerpt: "2026-02-10 ACC-1042 -> ACC-2098 (85,000), 2026-04-18 (62,000), 2026-08-15 (73,000)",
    },
    {
      source: "ACC-3181",
      target: "ACC-4420",
      type: RelationshipType.TRANSACTED_WITH,
      status: RelationshipStatus.VERIFIED,
      confidence: 0.90,
      description: "Transport logistics payments coinciding with EX-03 and EX-04 dispatch schedules.",
      evidenceFilename: "04_financial_transactions.csv",
      excerpt: "2026-07-06 ACC-3181 -> ACC-4420 (41,000), 2026-08-16 (18,000)",
    },
  ];

  for (const rel of relationshipConfigs) {
    const sourceId = entityMap.get(rel.source);
    const targetId = entityMap.get(rel.target);
    const evidenceId = evidenceMap.get(rel.evidenceFilename);

    if (sourceId && targetId) {
      const createdRel = await db.relationship.create({
        data: {
          investigationId: investigation.id,
          sourceId,
          targetId,
          type: rel.type,
          status: rel.status,
          confidence: rel.confidence ?? null,
          description: rel.description,
        },
      });

      if (evidenceId) {
        await db.relationshipEvidence.create({
          data: {
            relationshipId: createdRel.id,
            evidenceId,
            excerpt: rel.excerpt,
          },
        });
      }
    }
  }

  // 6. Create Timeline Events
  const eventConfigs = [
    {
      title: "EX-01: West Bengal State Eligibility Examination Paper Leak",
      description: "A digital copy of the examination paper (WB-SEE-2026-SET-B.pdf) was circulated in private groups approximately 18 hours before the exam.",
      occurredAt: new Date("2026-02-14T08:00:00Z"),
      entityLabel: "Arjun Mehta",
      locationName: "Kolkata Examination Warehouse",
      evidenceFilename: "01_incident_reports.pdf",
    },
    {
      title: "Pre-EX-01 Dispatch & Transit to Kolkata",
      description: "Shipment SP-260212-17 containing exam packets moved via vehicle WB12AB1234 from SecurePrint Durgapur to Kolkata Warehouse.",
      occurredAt: new Date("2026-02-13T22:15:00Z"),
      entityLabel: "Rahul Verma",
      locationName: "SecurePrint Solutions — Durgapur",
      evidenceFilename: "03_printing_and_dispatch_records.csv",
    },
    {
      title: "EX-02: Bihar State Recruitment Examination Paper Leak",
      description: "Examination paper Bihar-SRE-2026-SET-2.pdf reported circulating in private messaging groups prior to scheduled examination in Patna.",
      occurredAt: new Date("2026-04-22T09:00:00Z"),
      entityLabel: "Vikram Sethi",
      locationName: "Patna Regional Depot",
      evidenceFilename: "01_incident_reports.pdf",
    },
    {
      title: "EX-03: Odisha Technical Recruitment Examination Paper Leak",
      description: "Technical exam paper Odisha-TR-2026-MATH.pdf circulated hours before exam. Vehicle OD05EF7788 recorded at Bhubaneswar depot.",
      occurredAt: new Date("2026-07-09T08:30:00Z"),
      entityLabel: "Karan Das",
      locationName: "Bhubaneswar Regional Depot",
      evidenceFilename: "01_incident_reports.pdf",
    },
    {
      title: "EX-04: West Bengal Regional Recruitment Examination Paper Leak",
      description: "Examination paper WB-RRE-2026-PAPER-A.pdf reported circulating at 22:31 on Aug 17. Printing dispatch logs reference SecurePrint Durgapur.",
      occurredAt: new Date("2026-08-18T09:00:00Z"),
      entityLabel: "Arjun Mehta",
      locationName: "Asansol Examination Centre",
      evidenceFilename: "01_incident_reports.pdf",
    },
    {
      title: "SecurePrint Vendor Visit & Rapid Access Sequence",
      description: "External vendor Imran Ali logged for printer maintenance at 14:55, followed 8 minutes later by dispatch assistant Aakash Roy.",
      occurredAt: new Date("2026-08-17T14:55:00Z"),
      entityLabel: "Imran Ali",
      locationName: "SecurePrint Solutions — Durgapur",
      evidenceFilename: "07_warehouse_access_logs.csv",
    },
  ];

  for (const evt of eventConfigs) {
    const entityId = evt.entityLabel ? entityMap.get(evt.entityLabel) : null;
    const locationId = evt.locationName ? locationMap.get(evt.locationName) : null;
    const evidenceId = evt.evidenceFilename ? evidenceMap.get(evt.evidenceFilename) : null;

    const createdEvent = await db.event.create({
      data: {
        investigationId: investigation.id,
        title: evt.title,
        description: evt.description,
        occurredAt: evt.occurredAt,
        entityId: entityId ?? undefined,
        locationId: locationId ?? undefined,
      },
    });

    if (evidenceId) {
      await db.eventEvidence.create({
        data: {
          eventId: createdEvent.id,
          evidenceId,
          excerpt: evt.description,
        },
      });
    }
  }

  // 7. Create Candidate Findings (Extraction/Review records preserved)
  const candidateConfigs = [
    {
      evidenceFilename: "07_warehouse_access_logs.csv",
      type: CandidateType.ENTITY,
      status: CandidateStatus.VERIFIED,
      label: "Imran Ali (External Service Vendor)",
      description: "Extracted vendor visitor record at SecurePrint Solutions prior to EX-04 dispatch.",
      data: { person: "Imran Ali", location: "SecurePrint Visitor Area", time: "2026-08-17 14:55" },
    },
    {
      evidenceFilename: "04_financial_transactions.csv",
      type: CandidateType.RELATIONSHIP,
      status: CandidateStatus.PENDING,
      label: "ACC-1042 → ACC-2098 Consulting Transfer",
      description: "Unverified beneficial ownership link for account ACC-2098 receiving recurring pre-incident transfers.",
      data: { from: "ACC-1042", to: "ACC-2098", totalAmount: 220000 },
    },
  ];

  for (const cand of candidateConfigs) {
    const evidenceId = evidenceMap.get(cand.evidenceFilename);
    if (evidenceId) {
      await db.candidateFinding.create({
        data: {
          investigationId: investigation.id,
          evidenceId,
          type: cand.type,
          status: cand.status,
          confidence: 0.85,
          label: cand.label,
          description: cand.description,
          data: cand.data,
          sourceExcerpt: cand.description,
        },
      });
    }
  }

  // 8. Create Initial Evidence-Grounded Investigation Tasks for Operation Question Mark
  const vikramEntityId = entityMap.get("Vikram Sethi");
  const arjunEntityId = entityMap.get("Arjun Mehta");
  const acc2098EntityId = entityMap.get("ACC-2098 (Consulting Account)");
  const vehicleEntityId = entityMap.get("WB12AB1234 (Logistics Van)");

  const taskConfigs = [
    {
      title: "Verify the purpose of Vikram Sethi and Arjun Mehta communications around EX-01 and EX-02",
      description: "Call detail records confirm multiple phone communications between Vikram Sethi and Arjun Mehta during the EX-01 and EX-02 dispatch windows.",
      whyItMatters: "Communication records confirm contact around two incident periods, but the available evidence does not document the purpose of the communication.",
      priority: "HIGH" as const,
      status: "OPEN" as const,
      sourceType: "ARGUS_SUGGESTED" as const,
      expectedOutcome: "Determine whether the communication was routine administrative contact or related to examination logistics.",
      entityId: vikramEntityId,
      evidenceId: evidenceMap.get("02_call_detail_records.csv"),
    },
    {
      title: "Verify beneficial ownership of ACC-2098",
      description: "Bank transaction logs reflect pre-incident transfers totaling ₹2.2L into account ACC-2098 prior to the EX-02 incident.",
      whyItMatters: "Financial activity involving the account occurs near multiple incident periods, but ownership is not independently verified.",
      priority: "HIGH" as const,
      status: "OPEN" as const,
      sourceType: "LEAD_DERIVED" as const,
      expectedOutcome: "Associate or rule out the account's connection to an investigation entity.",
      entityId: acc2098EntityId,
      evidenceId: evidenceMap.get("04_financial_transactions.csv"),
    },
    {
      title: "Verify whether vehicle WB12AB1234 was carrying examination material during the EX-01 logistics window",
      description: "Toll plaza camera logs record vehicle WB12AB1234 traversing the NH-16 corridor during the EX-01 transit timeframe.",
      whyItMatters: "Vehicle movement overlaps with relevant examination-material logistics, but current evidence does not establish what was transported.",
      priority: "MEDIUM" as const,
      status: "OPEN" as const,
      sourceType: "ARGUS_SUGGESTED" as const,
      expectedOutcome: "Confirm or rule out the vehicle's involvement in the documented dispatch activity.",
      entityId: vehicleEntityId,
      evidenceId: evidenceMap.get("05_toll_plaza_camera_logs.csv"),
    },
    {
      title: "Compare Vikram Sethi's activity across EX-01, EX-02 and EX-03",
      description: "Cross-reference entity call logs, site visits, and organizational affiliations surrounding MeritEdge Academy.",
      whyItMatters: "The entity appears in records surrounding multiple incident periods across West Bengal and Bihar.",
      priority: "MEDIUM" as const,
      status: "IN_PROGRESS" as const,
      sourceType: "INVESTIGATOR_CREATED" as const,
      expectedOutcome: "Determine whether there is a consistent documented pattern or whether the overlap is coincidental.",
      entityId: vikramEntityId,
      evidenceId: evidenceMap.get("01_fir_leak_reports.pdf"),
    },
  ];

  for (const t of taskConfigs) {
    await db.investigationTask.create({
      data: {
        investigationId: investigation.id,
        title: t.title,
        description: t.description,
        whyItMatters: t.whyItMatters,
        priority: t.priority,
        status: t.status,
        sourceType: t.sourceType,
        expectedOutcome: t.expectedOutcome,
        entityId: t.entityId,
        evidenceId: t.evidenceId,
      },
    });
  }

  // 9. Import and seed Financial Trail dataset from operation_question_mark_financial_seed.json
  const financialSeedPath = path.join(process.cwd(), "prisma", "seed", "questionMark", "operation_question_mark_financial_seed.json");
  if (fs.existsSync(financialSeedPath)) {
    const rawFin = fs.readFileSync(financialSeedPath, "utf-8");
    const finData = JSON.parse(rawFin);

    // Create synthetic evidence references for financial ledgers
    const finEvidenceMap = new Map<string, string>();
    for (const ref of finData.evidence_refs || []) {
      const createdEvidence = await db.evidenceItem.create({
        data: {
          investigationId: investigation.id,
          title: ref.title,
          description: ref.description,
          type: EvidenceType.FINANCIAL,
          status: EvidenceStatus.EXTRACTED,
          source: `Synthetic Financial Ledger (${ref.incident})`,
          fileName: `${ref.key}.csv`,
          normalizedContent: `Financial ledger transaction extract for incident ${ref.incident}. Supporting money flow analysis.`,
        },
      });
      finEvidenceMap.set(ref.key, createdEvidence.id);
    }

    // Seed Financial Entities
    const finEntityDbMap = new Map<string, string>();
    for (const fe of finData.financial_entities || []) {
      let linkedEntityId: string | null = null;
      if (fe.linkedPerson) {
        linkedEntityId = entityMap.get(fe.linkedPerson) || null;
      }

      const createdFe = await db.financialEntity.create({
        data: {
          investigationId: investigation.id,
          type: fe.type as any,
          identifier: fe.identifier,
          label: fe.label,
          linkedEntityId,
          attributionStatus: fe.attributionStatus as any,
          note: fe.note,
        },
      });
      finEntityDbMap.set(fe.key, createdFe.id);
    }

    // Seed Transactions
    for (const tx of finData.transactions || []) {
      const senderId = finEntityDbMap.get(tx.from);
      const receiverId = finEntityDbMap.get(tx.to);

      if (senderId && receiverId) {
        await db.transaction.create({
          data: {
            id: tx.id,
            investigationId: investigation.id,
            senderFinancialEntityId: senderId,
            receiverFinancialEntityId: receiverId,
            amount: tx.amount,
            currency: tx.currency || "INR",
            timestamp: new Date(tx.timestamp),
            channel: tx.channel as any,
            purpose: tx.purpose,
            incident: tx.incident,
            sourceEvidenceId: tx.evidenceRef ? finEvidenceMap.get(tx.evidenceRef) || null : null,
          },
        });
      }
    }

    // Seed Financial Signals as Candidate Findings
    for (const sig of finData.derived_demo_signals || []) {
      const anchorFeId = sig.anchorEntity ? finEntityDbMap.get(sig.anchorEntity) : null;
      const primaryEvidenceId = Array.from(finEvidenceMap.values())[0] || null;

      if (primaryEvidenceId) {
        await db.candidateFinding.create({
          data: {
            investigationId: investigation.id,
            evidenceId: primaryEvidenceId,
            type: CandidateType.RELATIONSHIP,
            status: CandidateStatus.PENDING,
            confidence: 0.90,
            label: sig.title,
            description: sig.explanation,
            sourceExcerpt: sig.doNotClaim,
            data: {
              signalKey: sig.key,
              type: sig.type,
              priority: sig.priority,
              anchorTransaction: sig.anchorTransaction || null,
              anchorEntity: sig.anchorEntity || null,
              anchorFinancialEntityId: anchorFeId || null,
            },
          },
        });
      }
    }

    // Seed Financial Tasks
    for (const ft of finData.investigation_tasks || []) {
      await db.investigationTask.create({
        data: {
          investigationId: investigation.id,
          title: ft.title,
          description: ft.whyItMatters,
          whyItMatters: ft.whyItMatters,
          priority: ft.priority as any,
          status: ft.status as any,
          sourceType: "ARGUS_SUGGESTED",
          expectedOutcome: ft.expectedOutcome,
          entityId: acc2098EntityId || null,
        },
      });
    }

    console.log(`Seeded Financial Trail: ${finData.financial_entities?.length || 0} financial entities, ${finData.transactions?.length || 0} transactions, ${finData.derived_demo_signals?.length || 0} signals.`);
  }

  console.log(`Successfully seeded Operation Question Mark dataset: ${entityConfigs.length} entities, ${relationshipConfigs.length} relationships, ${eventConfigs.length} events, ${taskConfigs.length} tasks.`);
}
