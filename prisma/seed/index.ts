import {
  EntityType,
  EvidenceType,
  InvestigationStatus,
  PrismaClient,
  RelationshipStatus,
  RelationshipType,
  Role,
} from "@prisma/client";
import { hash } from "bcryptjs";
import { seedQuestionMark } from "./questionMarkSeed";

const db = new PrismaClient();

const WEST_BENGAL_LOCATIONS = [
  { name: "Kolkata", lat: 22.5726, lng: 88.3639, region: "Kolkata Metropolitan" },
  { name: "Howrah", lat: 22.5958, lng: 88.2636, region: "Howrah District" },
  { name: "North 24 Parganas", lat: 22.6167, lng: 88.4, region: "North 24 Parganas" },
  { name: "Malda", lat: 25.0104, lng: 88.1411, region: "Malda District" },
  { name: "Siliguri", lat: 26.7271, lng: 88.3953, region: "Darjeeling District" },
  { name: "Durgapur", lat: 23.5204, lng: 87.3119, region: "Paschim Bardhaman" },
  { name: "Asansol", lat: 23.6739, lng: 86.9524, region: "Paschim Bardhaman" },
] as const;

export type SeedPreset = "demo" | "small" | "medium" | "large";

interface SeedConfig {
  entityCount: number;
  clusterCount: number;
  bridgeCount: number;
  noiseRatio: number;
}

const PRESETS: Record<SeedPreset, SeedConfig> = {
  demo: { entityCount: 25, clusterCount: 3, bridgeCount: 2, noiseRatio: 0.15 },
  small: { entityCount: 40, clusterCount: 4, bridgeCount: 2, noiseRatio: 0.2 },
  medium: { entityCount: 80, clusterCount: 5, bridgeCount: 3, noiseRatio: 0.25 },
  large: { entityCount: 150, clusterCount: 7, bridgeCount: 4, noiseRatio: 0.3 },
};

const FIRST_NAMES = [
  "Arjun", "Priya", "Rahul", "Sneha", "Vikram", "Ananya", "Debashis", "Meera",
  "Sourav", "Kavita", "Amit", "Poulomi", "Subhash", "Rina", "Tanmoy",
];
const LAST_NAMES = [
  "Banerjee", "Mukherjee", "Chatterjee", "Das", "Ghosh", "Sen", "Bose", "Roy",
  "Mondal", "Sarkar", "Dutta", "Pal", "Nath", "Kar", "Biswas",
];
const ORG_NAMES = [
  "Eastern Trade Consortium", "Bengal Logistics Ltd", "Metro Finance Group",
  "Delta Shipping Co", "Heritage Exports", "Northern Commodities",
];
const REL_TYPES = Object.values(RelationshipType);
const REL_STATUSES: RelationshipStatus[] = [
  RelationshipStatus.DIRECT,
  RelationshipStatus.DIRECT,
  RelationshipStatus.VERIFIED,
  RelationshipStatus.AI_SUGGESTED,
  RelationshipStatus.UNDER_REVIEW,
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function generateName(): string {
  return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
}

function generatePhone(): string {
  return `+91${Math.floor(7000000000 + Math.random() * 2999999999)}`;
}

export async function seedDatabase(preset: SeedPreset = "demo") {
  const config = PRESETS[preset];
  console.log(`Seeding with preset: ${preset}`, config);

  await db.auditLog.deleteMany();
  await db.aIInsight.deleteMany();
  await db.candidateFinding.deleteMany();
  await db.relationshipEvidence.deleteMany();
  await db.eventEvidence.deleteMany();
  await db.relationship.deleteMany();
  await db.event.deleteMany();
  await db.entityAlias.deleteMany();
  await db.entity.deleteMany();
  await db.evidenceItem.deleteMany();
  await db.location.deleteMany();
  await db.investigation.deleteMany();
  await db.user.deleteMany();

  const password = await hash("password123", 10);
  const users = await Promise.all(
    (["ADMIN", "INVESTIGATOR", "ANALYST", "SUPERVISOR"] as Role[]).map((role, i) =>
      db.user.create({
        data: {
          email: `${role.toLowerCase()}@demo.local`,
          name: `Demo ${role.charAt(0) + role.slice(1).toLowerCase()}`,
          role,
          password,
        },
      })
    )
  );

  const investigator = users.find((u) => u.role === Role.INVESTIGATOR)!;
  const startDate = new Date("2024-01-01");
  const endDate = new Date("2025-06-30");

  const investigation = await db.investigation.create({
    data: {
      title: "Operation Riverside — Cross-District Network Analysis",
      description:
        "Synthetic investigation examining interconnected entities across West Bengal districts. Multiple clusters linked through bridge entities with supporting documentary evidence.",
      status: InvestigationStatus.ACTIVE,
      caseNumber: "INV-2024-WB-0847",
      startDate,
      endDate,
      leadId: investigator.id,
    },
  });

  const locations = await Promise.all(
    WEST_BENGAL_LOCATIONS.map((loc) =>
      db.location.create({
        data: {
          investigationId: investigation.id,
          name: loc.name,
          latitude: loc.lat,
          longitude: loc.lng,
          region: loc.region,
        },
      })
    )
  );

  const entitiesPerCluster = Math.floor(config.entityCount / config.clusterCount);
  const allEntities: { id: string; label: string; type: EntityType; cluster: number }[] = [];
  const clusterEntities: string[][] = [];

  for (let c = 0; c < config.clusterCount; c++) {
    const cluster: string[] = [];
    const clusterSize = c === 0 ? entitiesPerCluster + (config.entityCount % config.clusterCount) : entitiesPerCluster;

    for (let i = 0; i < clusterSize; i++) {
      const typeRoll = Math.random();
      let type: EntityType;
      let label: string;

      if (typeRoll < 0.35) {
        type = EntityType.PERSON;
        label = generateName();
      } else if (typeRoll < 0.5) {
        type = EntityType.PHONE;
        label = generatePhone();
      } else if (typeRoll < 0.65) {
        type = EntityType.ORGANIZATION;
        label = pick(ORG_NAMES) + ` Unit ${c + 1}`;
      } else if (typeRoll < 0.8) {
        type = EntityType.ACCOUNT;
        label = `ACC-${100000 + Math.floor(Math.random() * 900000)}`;
      } else {
        type = EntityType.VEHICLE;
        label = `WB-${String.fromCharCode(65 + c)}${Math.floor(10 + Math.random() * 89)}-${1000 + Math.floor(Math.random() * 9000)}`;
      }

      const entity = await db.entity.create({
        data: {
          investigationId: investigation.id,
          type,
          label,
          description: `Cluster ${c + 1} entity`,
          metadata: { cluster: c },
        },
      });

      if (type === EntityType.PERSON && Math.random() > 0.5) {
        await db.entityAlias.create({
          data: { entityId: entity.id, alias: `${label.split(" ")[0]} B.` },
        });
      }

      cluster.push(entity.id);
      allEntities.push({ id: entity.id, label, type, cluster: c });
    }
    clusterEntities.push(cluster);
  }

  const bridgeEntities: string[] = [];
  for (let b = 0; b < config.bridgeCount; b++) {
    const bridgeName = generateName();
    const bridge = await db.entity.create({
      data: {
        investigationId: investigation.id,
        type: EntityType.PERSON,
        label: bridgeName,
        description: `Bridge entity connecting clusters ${b + 1} and ${(b + 2) % config.clusterCount + 1}`,
        metadata: { bridge: true, connectsClusters: [b, (b + 1) % config.clusterCount] },
      },
    });
    bridgeEntities.push(bridge.id);
    allEntities.push({ id: bridge.id, label: bridgeName, type: EntityType.PERSON, cluster: -1 });
  }

  const evidenceItems = await Promise.all([
    db.evidenceItem.create({
      data: {
        investigationId: investigation.id,
        title: "Financial Transaction Report Q1 2024",
        type: EvidenceType.FINANCIAL,
        status: "REVIEWED",
        source: "Banking records (synthetic)",
        normalizedContent:
          "Transaction records show multiple transfers between accounts ACC-482910 and ACC-739201 during January-March 2024. Total volume: 2.4M INR across 47 transactions.",
        uploadedAt: new Date("2024-03-15"),
        processedAt: new Date("2024-03-16"),
      },
    }),
    db.evidenceItem.create({
      data: {
        investigationId: investigation.id,
        title: "Communication Log — Metro District",
        type: EvidenceType.COMMUNICATION,
        status: "REVIEWED",
        source: "Telecom analysis (synthetic)",
        normalizedContent:
          "Call records indicate frequent communication between +917034567890 and +918123456789 between Feb 1-28, 2024. Peak activity on weekends.",
        uploadedAt: new Date("2024-04-01"),
        processedAt: new Date("2024-04-02"),
      },
    }),
    db.evidenceItem.create({
      data: {
        investigationId: investigation.id,
        title: "Field Observation Report — Siliguri",
        type: EvidenceType.REPORT,
        status: "EXTRACTED",
        source: "Field team (synthetic)",
        normalizedContent:
          "Subject observed meeting with two associates at Siliguri market area on 2024-05-12. Vehicle WB-C45-3847 parked nearby. Subject departed toward Malda direction.",
        uploadedAt: new Date("2024-05-13"),
        processedAt: new Date("2024-05-14"),
      },
    }),
    db.evidenceItem.create({
      data: {
        investigationId: investigation.id,
        title: "Entity Registry Export",
        type: EvidenceType.STRUCTURED_DATA,
        status: "REVIEWED",
        source: "Corporate registry (synthetic)",
        mimeType: "application/json",
        normalizedContent: JSON.stringify({
          organizations: ORG_NAMES.slice(0, 3),
          registrations: ["2020-03", "2021-07", "2022-11"],
        }),
        uploadedAt: new Date("2024-02-10"),
        processedAt: new Date("2024-02-10"),
      },
    }),
  ]);

  const relationships: { id: string; sourceId: string; targetId: string; status: RelationshipStatus }[] = [];

  for (let c = 0; c < config.clusterCount; c++) {
    const cluster = clusterEntities[c];
    const internalEdges = Math.floor(cluster.length * 1.5);
    for (let e = 0; e < internalEdges; e++) {
      const source = pick(cluster);
      let target = pick(cluster);
      while (target === source) target = pick(cluster);

      const existing = relationships.find(
        (r) =>
          (r.sourceId === source && r.targetId === target) ||
          (r.sourceId === target && r.targetId === source)
      );
      if (existing) continue;

      const status = pick(REL_STATUSES);
      const rel = await db.relationship.create({
        data: {
          investigationId: investigation.id,
          sourceId: source,
          targetId: target,
          type: pick(REL_TYPES),
          status,
          confidence: status === RelationshipStatus.AI_SUGGESTED ? 0.4 + Math.random() * 0.4 : undefined,
          discoveredAt: randomDate(startDate, endDate),
          verifiedAt: status === RelationshipStatus.VERIFIED ? randomDate(startDate, endDate) : undefined,
        },
      });
      relationships.push({ id: rel.id, sourceId: source, targetId: target, status });
    }
  }

  for (let b = 0; b < bridgeEntities.length; b++) {
    const bridge = bridgeEntities[b];
    const clusterA = clusterEntities[b % config.clusterCount];
    const clusterB = clusterEntities[(b + 1) % config.clusterCount];

    const sourceA = pick(clusterA);
    const sourceB = pick(clusterB);

    const relA = await db.relationship.create({
      data: {
        investigationId: investigation.id,
        sourceId: bridge,
        targetId: sourceA,
        type: RelationshipType.ASSOCIATED_WITH,
        status: RelationshipStatus.VERIFIED,
        discoveredAt: randomDate(startDate, endDate),
        verifiedAt: randomDate(startDate, endDate),
      },
    });
    relationships.push({ id: relA.id, sourceId: bridge, targetId: sourceA, status: RelationshipStatus.VERIFIED });

    const relB = await db.relationship.create({
      data: {
        investigationId: investigation.id,
        sourceId: bridge,
        targetId: sourceB,
        type: RelationshipType.COMMUNICATED_WITH,
        status: RelationshipStatus.VERIFIED,
        discoveredAt: randomDate(startDate, endDate),
        verifiedAt: randomDate(startDate, endDate),
      },
    });
    relationships.push({ id: relB.id, sourceId: bridge, targetId: sourceB, status: RelationshipStatus.VERIFIED });
  }

  const noiseCount = Math.floor(relationships.length * config.noiseRatio);
  for (let n = 0; n < noiseCount; n++) {
    const source = pick(allEntities).id;
    let target = pick(allEntities).id;
    while (target === source) target = pick(allEntities).id;

    const existing = relationships.find(
      (r) =>
        (r.sourceId === source && r.targetId === target) ||
        (r.sourceId === target && r.targetId === source)
    );
    if (existing) continue;

    try {
      const rel = await db.relationship.create({
        data: {
          investigationId: investigation.id,
          sourceId: source,
          targetId: target,
          type: pick(REL_TYPES),
          status: RelationshipStatus.AI_SUGGESTED,
          confidence: 0.2 + Math.random() * 0.3,
          discoveredAt: randomDate(startDate, endDate),
        },
      });
      relationships.push({ id: rel.id, sourceId: source, targetId: target, status: RelationshipStatus.AI_SUGGESTED });
    } catch {
      // skip duplicate
    }
  }

  for (let i = 0; i < Math.min(relationships.length, evidenceItems.length * 3); i++) {
    const rel = relationships[i];
    const evidence = evidenceItems[i % evidenceItems.length];
    try {
      await db.relationshipEvidence.create({
        data: {
          relationshipId: rel.id,
          evidenceId: evidence.id,
          excerpt: `Supporting reference from ${evidence.title}`,
        },
      });
    } catch {
      // skip duplicate
    }
  }

  const eventTitles = [
    "Meeting observed", "Financial transfer", "Phone call logged",
    "Vehicle movement", "Document exchange", "Border crossing noted",
    "Account activity spike", "Communication burst",
  ];

  for (let i = 0; i < config.entityCount; i++) {
    const entity = allEntities[i % allEntities.length];
    const location = pick(locations);
    await db.event.create({
      data: {
        investigationId: investigation.id,
        title: pick(eventTitles),
        description: `Event involving ${entity.label}`,
        occurredAt: randomDate(startDate, endDate),
        entityId: entity.id,
        locationId: location.id,
      },
    });
  }

  await db.candidateFinding.create({
    data: {
      investigationId: investigation.id,
      evidenceId: evidenceItems[2].id,
      type: "RELATIONSHIP",
      status: "PENDING",
      confidence: 0.72,
      label: "Proposed connection via field observation",
      description: "Field report suggests new association between observed subjects",
      data: {
        sourceLabel: allEntities[0]?.label,
        targetLabel: bridgeEntities.length > 0 ? allEntities.find((e) => e.id === bridgeEntities[0])?.label : "Unknown",
        relationshipType: "ASSOCIATED_WITH",
      },
      sourceExcerpt: evidenceItems[2].normalizedContent?.slice(0, 200),
    },
  });

  console.log(`Seed complete: ${allEntities.length} entities, ${relationships.length} relationships, ${locations.length} locations`);

  await seedQuestionMark(db);

  return { investigation, users };
}

export async function provisionDemoInvestigator() {
  const password = await hash("password123", 10);
  return db.user.upsert({
    where: { email: "investigator@demo.local" },
    update: { name: "Demo Investigator", role: Role.INVESTIGATOR, password },
    create: {
      email: "investigator@demo.local",
      name: "Demo Investigator",
      role: Role.INVESTIGATOR,
      password,
    },
    select: { id: true, role: true },
  });
}
