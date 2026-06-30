import { describe, it, expect } from "vitest";
import axios from "axios";

describe("Xexun API Token Validation", () => {
  it("should authenticate with tracker.xexun.com using XEXUN_API_TOKEN", async () => {
    const token = process.env.XEXUN_API_TOKEN;
    expect(token).toBeDefined();
    expect(token!.length).toBeGreaterThan(50);

    // Call the dept tree endpoint to validate the token works
    const now = Date.now();
    const fiveMinAgo = now - 300000;

    const response = await axios.get(
      "https://tracker.xexun.com/web-manager/gpsInfo/pageGpsInfoMap",
      {
        params: {
          startTime: fiveMinAgo.toString(),
          endTime: now.toString(),
          imei: "861045082965297,",
          pageNum: "1",
          smoothness: "0",
          alg: "0",
          pageSize: "1",
          isDisData: "0",
          _t: now.toString(),
        },
        headers: {
          Authorization: `Bearer ${token}`,
        },
        timeout: 15000,
      }
    );

    expect(response.status).toBe(200);
    expect(response.data.code).toBe(200);
    expect(response.data.data).toBeDefined();
    expect(response.data.data.total).toBeGreaterThanOrEqual(0);
  }, 20000);

  it("should have XEXUN_DEPT_ID configured", () => {
    const deptId = process.env.XEXUN_DEPT_ID;
    expect(deptId).toBeDefined();
    expect(deptId).toBe("9355");
  });
});
