import { Router } from "express";

import { categoriesRouter } from "./routes/categories.js";
import { gigsRouter } from "./routes/gigs.js";
import { bookingsRouter } from "./routes/bookings.js";
import { milestonesRouter } from "./routes/milestones.js";
import { creatorsRouter } from "./routes/creators.js";
import { usersRouter } from "./routes/users.js";
import { readLimiter } from "./middleware/rateLimit.js";

export const apiRouter = Router();

// Read limiter blankets every /api call. Write endpoints layer their own
// tighter limit on top per route.
apiRouter.use(readLimiter);

apiRouter.use("/categories", categoriesRouter);
apiRouter.use("/gigs", gigsRouter);
apiRouter.use("/bookings", bookingsRouter);
apiRouter.use("/milestones", milestonesRouter);
apiRouter.use("/creators", creatorsRouter);
apiRouter.use("/users", usersRouter);
