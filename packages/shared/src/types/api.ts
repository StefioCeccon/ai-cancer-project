export interface ApiResponse<T> {
  data: T;
  success: true;
}

export interface ApiError {
  error: string;
  code?: string;
  success: false;
}

export type ApiResult<T> = ApiResponse<T> | ApiError;

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
