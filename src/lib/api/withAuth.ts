import { getSessionInfo } from '@/lib/auth/roles';
import { createClient } from '@/lib/supabase/server';
import { ApiError } from './response';
import { ZodError } from 'zod';
import { SupabaseClient } from '@supabase/supabase-js';

export type AuthenticatedRequest = Request & {
  session: any;
  supabase: SupabaseClient;
};

type Context = {
  params?: any;
};

type RouteHandler = (
  req: AuthenticatedRequest,
  context: Context
) => Promise<Response> | Response;

export function withAuth(handler: RouteHandler) {
  return async (req: Request, context: Context) => {
    try {
      const session = await getSessionInfo();
      
      if (!session) {
        return ApiError('No autorizado. Sesión inválida o expirada.', 401);
      }

      const supabase = await createClient();

      // Extender el Request con la sesión y supabase
      const authReq = req as AuthenticatedRequest;
      authReq.session = session;
      authReq.supabase = supabase;

      return await handler(authReq, context);
    } catch (error: any) {
      console.error('[API Error]:', error);
      
      if (error instanceof ZodError) {
        return ApiError('Datos de entrada inválidos', 400, error.flatten().fieldErrors);
      }

      return ApiError(
        error?.message || 'Ocurrió un error interno en el servidor.',
        500
      );
    }
  };
}
