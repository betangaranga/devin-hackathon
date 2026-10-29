// GENERADO por scripts/gen-topics-index.mjs — no editar a mano.
import type { TopicMeta } from "@/lib/topics";

import t0 from "./agua";
import t1 from "./calor";
import t2 from "./granizo";
import t3 from "./inundacion";
import t4 from "./patrimonio";
import t5 from "./ruido";
import t6 from "./servicios";
import t7 from "./sismo";
import t8 from "./vial";

export const TOPICS: TopicMeta[] = [t0, t1, t2, t3, t4, t5, t6, t7, t8];
export const SCORED_TOPICS = TOPICS.filter((t) => t.scored);
export const TOPIC_BY_KEY = new Map(TOPICS.map((t) => [t.key, t]));
