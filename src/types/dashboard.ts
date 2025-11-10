// Dashboard stats types
export interface ManagerDashboardStats {
  projects: {
    total: number;
    completed: number;
  };
  batches: {
    total: number;
    completed: number;
  };
  tasks: {
    total: number;
    completed: number;
  };
  metrics: {
    total_annotators: number;
    total_reviews: number;
    avg_annotation_time_seconds: number;
    daily_throughput: number;
    otd_rate_percent: number;
  };
}

export interface AnnotatorDashboardStats {
  available_tasks: number;
  rejected_tasks: number;
  my_annotated_tasks: number;
  my_tasks_approved: number;
  my_tasks_under_review: number;
  my_avg_time_seconds: number;
}

export interface ReviewerDashboardStats {
  needs_review_tasks: number;
  ready_for_delivery_tasks: number;
  all_tasks_count: number;
  my_reviews_completed: number;
  my_review_throughput: number;
}