import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Ensure the WELCOME system voucher exists.
// Runs hourly so it self-heals within an hour of first deploy (or accidental manual deletion via DB console).
crons.interval(
  "ensure-welcome-voucher",
  { hours: 1 },
  internal.vouchers.ensureWelcomeVoucher,
  {},
);

export default crons;
