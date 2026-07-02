-- TalentFlow AI — Idempotent seed
-- Runs on every container start via "prisma db execute"
-- All statements use ON CONFLICT DO NOTHING so they are safe to re-run.

-- ─── Users ───────────────────────────────────────────────────────────────────
-- Password for all seed users: Admin@123  (bcrypt cost 10)
INSERT INTO users (id, employee_id, name, email, password_hash, role, title, department, is_active, created_at, updated_at)
VALUES
  (gen_random_uuid()::text, 'EMP001', 'Ashutosh Jha',      'ashutosh@acstechnologies.com', '$2b$10$BuP9GGK5steu4baCxEtfSe1BeYAUaDGWFH31cE9XjvXwRNEpkptbm', 'SUPER_ADMIN', 'Chief Strategy Officer',          'Leadership',       true, now(), now()),
  (gen_random_uuid()::text, 'EMP002', 'Raj Shekhar Perepa','raj@acstechnologies.com',      '$2b$10$BuP9GGK5steu4baCxEtfSe1BeYAUaDGWFH31cE9XjvXwRNEpkptbm', 'DIR_TECH',   'Director — Tech Innovations',     'Technology',       true, now(), now()),
  (gen_random_uuid()::text, 'EMP003', 'Harsha',            'harsha@acstechnologies.com',   '$2b$10$BuP9GGK5steu4baCxEtfSe1BeYAUaDGWFH31cE9XjvXwRNEpkptbm', 'HR',         'HR Manager',                      'Human Resources',  true, now(), now()),
  (gen_random_uuid()::text, 'EMP004', 'Suprriya',          'suprriya@acstechnologies.com', '$2b$10$BuP9GGK5steu4baCxEtfSe1BeYAUaDGWFH31cE9XjvXwRNEpkptbm', 'HR',         'HR Executive',                    'Human Resources',  true, now(), now())
ON CONFLICT (employee_id) DO NOTHING;

-- Patch created_by_id after insert (safe no-op if already set)
UPDATE users SET created_by_id = (SELECT id FROM users WHERE employee_id = 'EMP001')
WHERE employee_id IN ('EMP002','EMP003','EMP004') AND created_by_id IS NULL;

-- ─── Job Descriptions ────────────────────────────────────────────────────────
INSERT INTO job_descriptions (id, title, client, status, openings, location, employment_type, experience_min, experience_max,
  required_skills, raw_content, polished_content, final_content, created_by_id, polished_by_id, created_at, updated_at)
VALUES
  ('jd_data_engineer_001', 'Senior Data Engineer', 'Tahaluf', 'POSTED', 3, 'Dubai, UAE', 'Full-time', 4, 8,
   '["Python","Apache Spark","dbt","SQL","Kafka"]',
   'Looking for a Senior Data Engineer to build and maintain data pipelines.',
   E'## Senior Data Engineer — Tahaluf\n\n### Role Overview\nWe are seeking an experienced Senior Data Engineer to join Tahaluf''s growing data platform team in Dubai.\n\n### Key Responsibilities\n- Design and implement scalable ELT/ETL pipelines using Apache Spark and dbt\n- Build and maintain real-time streaming infrastructure using Kafka and Flink\n- Collaborate with data scientists to productionise ML models\n- Ensure data quality through testing frameworks and observability tooling\n- Mentor junior engineers and contribute to technical roadmap decisions\n\n### Required Skills\n**Must Have:** Python, Apache Spark, dbt, SQL, data warehousing\n**Nice to Have:** Kafka, Flink, Airflow, cloud platforms (AWS/GCP/Azure)\n\n### Qualifications\n- 4–8 years of experience in data engineering\n- Bachelor''s or Master''s in Computer Science, Engineering, or related field',
   E'## Senior Data Engineer — Tahaluf\n\n### Role Overview\nWe are seeking an experienced Senior Data Engineer to join Tahaluf''s growing data platform team in Dubai.\n\n### Key Responsibilities\n- Design and implement scalable ELT/ETL pipelines using Apache Spark and dbt\n- Build and maintain real-time streaming infrastructure using Kafka and Flink\n- Collaborate with data scientists to productionise ML models\n- Ensure data quality through testing frameworks and observability tooling\n- Mentor junior engineers and contribute to technical roadmap decisions\n\n### Required Skills\n**Must Have:** Python, Apache Spark, dbt, SQL, data warehousing\n**Nice to Have:** Kafka, Flink, Airflow, cloud platforms (AWS/GCP/Azure)\n\n### Qualifications\n- 4–8 years of experience in data engineering\n- Bachelor''s or Master''s in Computer Science, Engineering, or related field\n\n### What We Offer\n- Competitive tax-free compensation\n- Flexible working arrangements\n- Visa sponsorship for the right candidate',
   (SELECT id FROM users WHERE employee_id='EMP002'),
   (SELECT id FROM users WHERE employee_id='EMP002'),
   now(), now()),

  ('jd_ml_engineer_001', 'ML Engineer', 'Tahaluf', 'POLISHED', 2, 'Dubai / Remote', 'Full-time', 3, 6,
   '["Python","TensorFlow","PyTorch","MLflow","Kubernetes"]',
   'Need ML Engineer for AI team.',
   E'## ML Engineer — Tahaluf\n\n### Role Overview\nJoin Tahaluf''s AI research and engineering team to build production machine learning systems.\n\n### Key Responsibilities\n- Train, evaluate, and deploy ML models into production at scale\n- Build ML infrastructure: feature stores, model registries, serving endpoints\n- Collaborate with data scientists to move experiments to production\n- Implement monitoring, retraining, and drift detection pipelines\n\n### Required Skills\n**Must Have:** Python, TensorFlow or PyTorch, MLflow or similar, REST APIs\n**Nice to Have:** Kubernetes, Spark, real-time inference, LLMs\n\n### Qualifications\n- 3–6 years ML engineering experience\n- Strong understanding of model lifecycle management',
   NULL,
   (SELECT id FROM users WHERE employee_id='EMP002'),
   (SELECT id FROM users WHERE employee_id='EMP002'),
   now(), now()),

  ('jd_devops_001', 'DevOps Lead', 'Tahaluf', 'RAW', 1, 'Abu Dhabi, UAE', 'Full-time', 6, 12,
   '["Kubernetes","Terraform","AWS","CI/CD","Docker"]',
   'Need DevOps Lead. Kubernetes, Terraform, AWS experience needed. Must manage team of 3.',
   NULL, NULL,
   (SELECT id FROM users WHERE employee_id='EMP002'),
   NULL,
   now(), now())
ON CONFLICT (id) DO NOTHING;

-- ─── JD Posting Sources ───────────────────────────────────────────────────────
INSERT INTO jd_posting_sources (id, jd_id, source, posted_at, url, created_at)
VALUES
  ('src_naukri_001',  'jd_data_engineer_001', 'Naukri',   '2025-06-01', 'https://naukri.com/job/senior-data-engineer-tahaluf',         now()),
  ('src_linkedin_001','jd_data_engineer_001', 'LinkedIn', '2025-06-01', 'https://linkedin.com/jobs/view/senior-data-engineer-tahaluf', now())
ON CONFLICT (id) DO NOTHING;

-- ─── Screening Config ─────────────────────────────────────────────────────────
INSERT INTO screening_configs (id, jd_id, skill_weight, availability_weight, location_weight,
  min_match_score, gap_threshold_months, max_notice_days, preferred_locations, required_skills,
  created_by_id, created_at, updated_at)
VALUES (
  gen_random_uuid()::text,
  'jd_data_engineer_001', 60, 20, 20, 65, 6, 90,
  '["Dubai","Abu Dhabi","Remote"]',
  '["Python","Apache Spark","dbt"]',
  (SELECT id FROM users WHERE employee_id='EMP001'),
  now(), now()
)
ON CONFLICT (jd_id) DO NOTHING;

-- ─── Interview Round Templates ────────────────────────────────────────────────
INSERT INTO interview_round_templates (id, jd_id, round_number, round_name, duration_minutes, interviewers, created_at)
VALUES
  (gen_random_uuid()::text, 'jd_data_engineer_001', 1, 'HR Screening',   45,
   (SELECT json_build_array(id) FROM users WHERE employee_id='EMP003')::jsonb, now()),
  (gen_random_uuid()::text, 'jd_data_engineer_001', 2, 'Technical Round', 90,
   (SELECT json_build_array(id) FROM users WHERE employee_id='EMP002')::jsonb, now())
ON CONFLICT (jd_id, round_number) DO NOTHING;

-- ─── Candidates ───────────────────────────────────────────────────────────────
INSERT INTO candidates (id, full_name, email, phone, location, current_title, current_company,
  total_experience_years, notice_period_days, expected_salary, source,
  raw_resume_text, parsed_data, is_internal, created_at, updated_at)
VALUES
  ('cand_rahul_001', 'Rahul Kumar', 'rahul.kumar@email.com', '+91 98765 43210',
   'Bangalore, India', 'Senior Data Engineer', 'TechCorp India',
   6, 30, 40000, 'Naukri',
   'Experienced data engineer with 6 years working on large-scale data pipelines...',
   '{"skills":["Python","Apache Spark","dbt","SQL","Kafka"],"education":[{"degree":"B.Tech Computer Science","institution":"IIT Bangalore","year":2019}],"experience":[{"title":"Senior Data Engineer","company":"TechCorp India","from":"2021-08","to":"present"},{"title":"Data Engineer","company":"DataSolutions","from":"2019-06","to":"2021-03"}]}',
   false, now(), now()),

  ('cand_sara_001', 'Sara Al-Amin', 'sara.alamin@email.com', '+971 50 123 4567',
   'Dubai, UAE', 'ML Engineer', 'AI Ventures Dubai',
   4, 0, 28000, 'LinkedIn',
   'ML Engineer with 4 years of experience in deep learning and production ML systems...',
   '{}', false, now(), now()),

  ('cand_ravi_int_001', 'Ravi Sharma', 'ravi.sharma@acstechnologies.com', NULL,
   'Dubai, UAE', 'Cloud Architect', 'ACS Technologies',
   5, 30, NULL, 'Internal',
   NULL, '{}', true, now(), now())
ON CONFLICT (id) DO NOTHING;

-- Patch internal candidate fields
UPDATE candidates SET
  employee_id_ref            = 'EMP017',
  acs_monthly_cost           = 22000,
  diversion_type             = 'FULL',
  diversion_notes            = 'Available for diversion to Tahaluf Cloud Architect role. Strong AWS background.',
  diversion_initiated_by_id  = (SELECT id FROM users WHERE employee_id='EMP001'),
  diversion_initiated_at     = now()
WHERE id = 'cand_ravi_int_001' AND diversion_initiated_by_id IS NULL;

-- ─── Pipeline Entries ─────────────────────────────────────────────────────────
INSERT INTO pipeline_entries (id, candidate_id, jd_id, stage, assigned_hr_id,
  match_score, availability_score, location_score, composite_score,
  is_shortlisted, screening_notes, created_at, updated_at)
VALUES
  (gen_random_uuid()::text, 'cand_rahul_001', 'jd_data_engineer_001', 'SCREENING_CALL',
   (SELECT id FROM users WHERE employee_id='EMP003'),
   91, 85, 70, 86, true,
   'Strong match on all required skills. Minor gap in 2021 to clarify.', now(), now()),

  (gen_random_uuid()::text, 'cand_sara_001', 'jd_ml_engineer_001', 'INTERVIEWING',
   (SELECT id FROM users WHERE employee_id='EMP004'),
   87, 100, 100, 90, true,
   'Excellent match. Immediately available in Dubai.', now(), now())
ON CONFLICT (candidate_id, jd_id) DO NOTHING;

-- ─── Notifications ────────────────────────────────────────────────────────────
INSERT INTO notifications (id, user_id, title, message, type, is_read, link, created_at)
VALUES
  (gen_random_uuid()::text, (SELECT id FROM users WHERE employee_id='EMP003'),
   'AI screening complete', '18 resumes screened for Senior Data Engineer. 6 shortlisted.',
   'SUCCESS', false, '/screening', now()),
  (gen_random_uuid()::text, (SELECT id FROM users WHERE employee_id='EMP001'),
   'Submission pending review', 'Nadia Georgiou''s profile is awaiting Tahaluf response.',
   'INFO', false, '/submissions', now())
ON CONFLICT DO NOTHING;
