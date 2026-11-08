import express from "express";

import { getOverview, updateException, type ExceptionUpdate } from "./desk/overview.js";
import { HttpError } from "./http.js";

const app = express();
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, demo: true });
});

app.get("/api/overview", async (_req, res, next) => {
  try {
    res.json(await getOverview());
  } catch (error) {
    next(error);
  }
});

app.post("/api/exceptions/:id", async (req, res, next) => {
  try {
    const id = req.params.id;
    if (typeof id !== "string" || id.length === 0) {
      throw new HttpError("Missing break id.", 400);
    }
    await updateException(id, req.body as ExceptionUpdate);
    res.json(await getOverview());
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  console.error(error);
  res.status(500).json({ error: "The desk could not complete that request." });
});

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`Cash desk API at http://localhost:${port}`);
});
