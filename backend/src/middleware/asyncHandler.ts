import type { Request, Response, NextFunction, RequestHandler } from "express";

/**
 * Express 4 does not forward errors from async handlers automatically.
 * Wrapping with `asyncHandler` catches rejections and hands them to the
 * global error middleware, keeping route code free of try/catch boilerplate.
 */
export const asyncHandler =
  <Req extends Request = Request, Res extends Response = Response>(
    fn: (req: Req, res: Res, next: NextFunction) => Promise<unknown>,
  ): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req as Req, res as Res, next)).catch(next);
  };
