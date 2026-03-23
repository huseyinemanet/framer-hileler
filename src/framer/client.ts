import { connect } from "framer-api";
import { env } from "../utils/env.js";

export type FramerClient = Awaited<ReturnType<typeof connect>>;

export async function connectFramer(): Promise<FramerClient> {
  return connect(env.FRAMER_PROJECT_URL, env.FRAMER_API_KEY);
}
