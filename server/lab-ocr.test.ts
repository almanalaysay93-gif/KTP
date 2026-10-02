import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";

describe("Python Lab OCR and PDF Parser Integration", () => {
  const adminCaller = appRouter.createCaller({
    user: {
      id: 1,
      email: "share@spmcdvo.net",
      name: "Admin",
      role: "admin",
      openId: "admin-id",
      loginMethod: "test",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { ip: "127.0.0.1", headers: {} } as any,
    res: { clearCookie: () => {} } as any,
  });

  it("extracts structured lab values and date from digital PDF lab sheet", async () => {
    const pdfPath = path.resolve(process.cwd(), "scripts", "test_sample_lab.pdf");
    expect(fs.existsSync(pdfPath)).toBe(true);

    const pdfBuffer = fs.readFileSync(pdfPath);
    const base64 = pdfBuffer.toString("base64");

    const res = await adminCaller.clinical.parseLabDocument({
      base64,
      fileName: "test_sample_lab.pdf",
    });

    expect(res.success).toBe(true);
    expect(res.detectedDate).toBe("2026-09-22");
    expect(res.extractedCount).toBeGreaterThanOrEqual(7);

    const testsMap = new Map(res.tests.map((t) => [t.testName, t.value]));
    expect(testsMap.get("Serum Creatinine") || testsMap.get("Creatinine")).toBe("88.0");
    expect(testsMap.get("Tacrolimus trough")).toBe("8.4");
    expect(testsMap.get("Hemoglobin")).toBe("128");
    expect(testsMap.get("WBC")).toBe("6.8");
  });

  it("extracts structured lab values and date from scanned lab sheet image using RapidOCR", async () => {
    const imgPath = path.resolve(process.cwd(), "scripts", "test_sample_lab.png");
    expect(fs.existsSync(imgPath)).toBe(true);

    const imgBuffer = fs.readFileSync(imgPath);
    const base64 = imgBuffer.toString("base64");

    const res = await adminCaller.clinical.parseLabDocument({
      base64,
      fileName: "test_sample_lab.png",
    });

    expect(res.success).toBe(true);
    expect(res.detectedDate).toBe("2026-09-20");
    expect(res.extractedCount).toBeGreaterThanOrEqual(5);

    const testsMap = new Map(res.tests.map((t) => [t.testName, t.value]));
    expect(testsMap.get("Creatinine")).toBe("92.5");
    expect(testsMap.get("Tacrolimus trough")).toBe("7.8");
    expect(testsMap.get("BUN")).toBe("5.4");
  });

  it("extracts structured lab values and date from Excel spreadsheet", async () => {
    const xlsxPath = path.resolve(process.cwd(), "scripts", "test_sample_lab.xlsx");
    expect(fs.existsSync(xlsxPath)).toBe(true);

    const xlsxBuffer = fs.readFileSync(xlsxPath);
    const base64 = xlsxBuffer.toString("base64");

    const res = await adminCaller.clinical.parseLabDocument({
      base64,
      fileName: "test_sample_lab.xlsx",
    });

    expect(res.success).toBe(true);
    expect(res.detectedDate).toBe("2026-09-24");
    expect(res.extractedCount).toBeGreaterThanOrEqual(4);

    const testsMap = new Map(res.tests.map((t) => [t.testName, t.value]));
    expect(testsMap.get("Creatinine")).toBe("90");
    expect(testsMap.get("Tacrolimus trough")).toBe("7.5");
    expect(testsMap.get("BUN")).toBe("5");
    expect(testsMap.get("Hemoglobin")).toBe("135");
  });
});
