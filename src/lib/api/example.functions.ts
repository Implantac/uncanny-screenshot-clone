import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Example createServerFn. Authenticated; does not disclose server environment.
export const getGreeting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ name: z.string().min(1).max(120) }))
  .handler(async ({ data }) => {
    return { greeting: `Hello, ${data.name}!` };
  });
