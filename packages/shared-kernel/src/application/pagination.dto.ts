export class PaginationQueryDto {
  page: number = 1;
  limit: number = 20;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC' = 'DESC';
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown[];
  };
}
