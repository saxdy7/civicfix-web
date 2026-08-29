import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.cron("daily audit", "0 2 * * *", internal.dailyAudit.run, {});

export default crons;
