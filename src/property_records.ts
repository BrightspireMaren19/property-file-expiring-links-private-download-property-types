export type PropertyRecord = {
  id: string;
  ownerUserId: string;
  kind: "maintenance-request" | "tenant-document" | "inspection-reminder";
  objectKey: string;
  label: string;
};

export interface PropertyRecordStore {
  find(id: string): PropertyRecord | undefined;
}

export class InMemoryPropertyRecords implements PropertyRecordStore {
  private readonly records = new Map<string, PropertyRecord>([
    ["maintenance-1042", {
      id: "maintenance-1042",
      ownerUserId: "user-river-7",
      kind: "maintenance-request",
      objectKey: "tenant-river-7/maintenance/1042-plumber-photo.jpg",
      label: "Kitchen sink repair photo",
    }],
    ["lease-2026", {
      id: "lease-2026",
      ownerUserId: "user-river-7",
      kind: "tenant-document",
      objectKey: "tenant-river-7/documents/lease-2026.pdf",
      label: "2026 lease",
    }],
    ["inspection-oct", {
      id: "inspection-oct",
      ownerUserId: "user-hill-2",
      kind: "inspection-reminder",
      objectKey: "tenant-hill-2/inspections/october-notice.pdf",
      label: "October inspection notice",
    }],
  ]);

  find(id: string): PropertyRecord | undefined {
    return this.records.get(id);
  }
}
