export const DEMO_FIRM_NAME = "Northline Brokerage (demo)";

export const DEMO_DATA_LABEL =
  "Synthetic demonstration data. These are not real customers, accounts, or transactions.";

export const DEMO_BUSINESS_DATE = "2026-11-06";

export const DEMO_PASSWORD = "Demo1234!";

export const DEMO_APPROVAL_THRESHOLD = "250000.00";

export const DEMO_CUTOFF_TIME = "16:00";

export const DEMO_TIMEZONE = "America/Chicago";

export const DEMO_USERS = [
  {
    id: "user_maya_chen",
    name: "Maya Chen",
    email: "maya.chen@northline.demo",
    role: "MAKER",
    title: "Cash analyst",
  },
  {
    id: "user_jordan_hale",
    name: "Jordan Hale",
    email: "jordan.hale@northline.demo",
    role: "CHECKER",
    title: "Cash approver",
  },
  {
    id: "user_priya_shah",
    name: "Priya Shah",
    email: "priya.shah@northline.demo",
    role: "ADMIN",
    title: "Operations manager",
  },
] as const;
