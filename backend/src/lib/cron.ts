import { CronJob } from "cron";
import http from "node:http";
import https from "node:https";

const job = new CronJob("*/14 * * * *", () => {
  const base = process.env.FRONTEND_URL;
  if(!base) return;
  const url = new URL("/health", base).href;
  const client = url.startsWith("https:") ? https : http;

  client
    .get(url, (res) => {
      if(res.statusCode === 200) console.log("Get request sent Successfully");
      else console.log("GEt request failed", res.statusCode)
    })
    .on("error", (e) => {
      console.error("Error while sending request", e)
    })
})

export default job;
