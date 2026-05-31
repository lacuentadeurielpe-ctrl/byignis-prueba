import { NextResponse } from 'next/server';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  details?: any;
}

export function ApiSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function ApiError(error: string, status = 400, details?: any) {
  return NextResponse.json({ success: false, error, details }, { status });
}
