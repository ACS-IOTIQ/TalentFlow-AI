import { PrismaClient, UserRole } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  const hash = (pw: string) => bcrypt.hashSync(pw, 12)

  // ── ACS Team ──────────────────────────────────────────────────────────────
  const ashutosh = await prisma.user.upsert({
    where: { employeeId: 'EMP001' },
    update: {},
    create: {
      employeeId: 'EMP001',
      name: 'Ashutosh Jha',
      email: 'ashutosh@acstechnologies.com',
      passwordHash: hash('Admin@123'),
      role: UserRole.SUPER_ADMIN,
      title: 'Chief Strategy Officer',
      department: 'Leadership',
      isActive: true,
    },
  })

  const raj = await prisma.user.upsert({
    where: { employeeId: 'EMP002' },
    update: {},
    create: {
      employeeId: 'EMP002',
      name: 'Raj Shekhar Perepa',
      email: 'raj@acstechnologies.com',
      passwordHash: hash('Admin@123'),
      role: UserRole.DIR_TECH,
      title: 'Director — Tech Innovations',
      department: 'Technology',
      isActive: true,
      createdById: ashutosh.id,
    },
  })

  const harsha = await prisma.user.upsert({
    where: { employeeId: 'EMP003' },
    update: {},
    create: {
      employeeId: 'EMP003',
      name: 'Harsha',
      email: 'harsha@acstechnologies.com',
      passwordHash: hash('Admin@123'),
      role: UserRole.HR,
      title: 'HR Manager',
      department: 'Human Resources',
      isActive: true,
      createdById: ashutosh.id,
    },
  })

  const suprriya = await prisma.user.upsert({
    where: { employeeId: 'EMP004' },
    update: {},
    create: {
      employeeId: 'EMP004',
      name: 'Suprriya',
      email: 'suprriya@acstechnologies.com',
      passwordHash: hash('Admin@123'),
      role: UserRole.HR,
      title: 'HR Executive',
      department: 'Human Resources',
      isActive: true,
      createdById: ashutosh.id,
    },
  })

  // ── Sample JDs ────────────────────────────────────────────────────────────
  const jd1 = await prisma.jobDescription.upsert({
    where: { id: 'jd_data_engineer_001' },
    update: {},
    create: {
      id: 'jd_data_engineer_001',
      title: 'Senior Data Engineer',
      client: 'Tahaluf',
      status: 'POSTED',
      openings: 3,
      location: 'Dubai, UAE',
      employmentType: 'Full-time',
      experienceMin: 4,
      experienceMax: 8,
      requiredSkills: ['Python', 'Apache Spark', 'dbt', 'SQL', 'Kafka'],
      rawContent: 'Looking for a Senior Data Engineer to build and maintain data pipelines.',
      polishedContent: `## Senior Data Engineer — Tahaluf

### Role Overview
We are seeking an experienced Senior Data Engineer to join Tahaluf's growing data platform team in Dubai. You will be responsible for designing, building, and optimising large-scale data pipelines that power business intelligence and ML workloads across the organisation.

### Key Responsibilities
- Design and implement scalable ELT/ETL pipelines using Apache Spark and dbt
- Build and maintain real-time streaming infrastructure using Kafka and Flink
- Collaborate with data scientists to productionise ML models
- Ensure data quality through testing frameworks and observability tooling
- Mentor junior engineers and contribute to technical roadmap decisions

### Required Skills
**Must Have:** Python, Apache Spark, dbt, SQL, data warehousing
**Nice to Have:** Kafka, Flink, Airflow, cloud platforms (AWS/GCP/Azure)

### Qualifications
- 4–8 years of experience in data engineering
- Bachelor's or Master's in Computer Science, Engineering, or related field`,
      finalContent: `## Senior Data Engineer — Tahaluf

### Role Overview
We are seeking an experienced Senior Data Engineer to join Tahaluf's growing data platform team in Dubai. You will be responsible for designing, building, and optimising large-scale data pipelines that power business intelligence and ML workloads across the organisation.

### Key Responsibilities
- Design and implement scalable ELT/ETL pipelines using Apache Spark and dbt
- Build and maintain real-time streaming infrastructure using Kafka and Flink
- Collaborate with data scientists to productionise ML models
- Ensure data quality through testing frameworks and observability tooling
- Mentor junior engineers and contribute to technical roadmap decisions

### Required Skills
**Must Have:** Python, Apache Spark, dbt, SQL, data warehousing
**Nice to Have:** Kafka, Flink, Airflow, cloud platforms (AWS/GCP/Azure)

### Qualifications
- 4–8 years of experience in data engineering
- Bachelor's or Master's in Computer Science, Engineering, or related field

### What We Offer
- Competitive tax-free compensation
- Flexible working arrangements
- Visa sponsorship for the right candidate`,
      createdById: raj.id,
      polishedById: raj.id,
    },
  })

  await prisma.jobDescription.upsert({
    where: { id: 'jd_ml_engineer_001' },
    update: {},
    create: {
      id: 'jd_ml_engineer_001',
      title: 'ML Engineer',
      client: 'Tahaluf',
      status: 'POLISHED',
      openings: 2,
      location: 'Dubai / Remote',
      employmentType: 'Full-time',
      experienceMin: 3,
      experienceMax: 6,
      requiredSkills: ['Python', 'TensorFlow', 'PyTorch', 'MLflow', 'Kubernetes'],
      rawContent: 'Need ML Engineer for AI team.',
      polishedContent: `## ML Engineer — Tahaluf

### Role Overview
Join Tahaluf's AI research and engineering team to build production machine learning systems that impact millions of users across the MENA region.

### Key Responsibilities
- Train, evaluate, and deploy ML models into production at scale
- Build ML infrastructure: feature stores, model registries, serving endpoints
- Collaborate with data scientists to move experiments to production
- Implement monitoring, retraining, and drift detection pipelines

### Required Skills
**Must Have:** Python, TensorFlow or PyTorch, MLflow or similar, REST APIs
**Nice to Have:** Kubernetes, Spark, real-time inference, LLMs

### Qualifications
- 3–6 years ML engineering experience
- Strong understanding of model lifecycle management`,
      createdById: raj.id,
      polishedById: raj.id,
    },
  })

  await prisma.jobDescription.upsert({
    where: { id: 'jd_devops_001' },
    update: {},
    create: {
      id: 'jd_devops_001',
      title: 'DevOps Lead',
      client: 'Tahaluf',
      status: 'RAW',
      openings: 1,
      location: 'Abu Dhabi, UAE',
      employmentType: 'Full-time',
      experienceMin: 6,
      experienceMax: 12,
      requiredSkills: ['Kubernetes', 'Terraform', 'AWS', 'CI/CD', 'Docker'],
      rawContent: 'Need DevOps Lead. Kubernetes, Terraform, AWS experience needed. Must manage team of 3.',
      createdById: raj.id,
    },
  })

  // ── Sample Screening Config ───────────────────────────────────────────────
  await prisma.screeningConfig.upsert({
    where: { jdId: 'jd_data_engineer_001' },
    update: {},
    create: {
      jdId: 'jd_data_engineer_001',
      skillWeight: 60,
      availabilityWeight: 20,
      locationWeight: 20,
      minMatchScore: 65,
      gapThresholdMonths: 6,
      maxNoticeDays: 90,
      preferredLocations: ['Dubai', 'Abu Dhabi', 'Remote'],
      requiredSkills: ['Python', 'Apache Spark', 'dbt'],
      createdById: ashutosh.id,
    },
  })

  // ── Posting Sources ───────────────────────────────────────────────────────
  await prisma.jDPostingSource.upsert({
    where: { id: 'src_naukri_001' },
    update: {},
    create: {
      id: 'src_naukri_001',
      jdId: 'jd_data_engineer_001',
      source: 'Naukri',
      postedAt: new Date('2025-06-01'),
      url: 'https://naukri.com/job/senior-data-engineer-tahaluf',
    },
  })

  await prisma.jDPostingSource.upsert({
    where: { id: 'src_linkedin_001' },
    update: {},
    create: {
      id: 'src_linkedin_001',
      jdId: 'jd_data_engineer_001',
      source: 'LinkedIn',
      postedAt: new Date('2025-06-01'),
      url: 'https://linkedin.com/jobs/view/senior-data-engineer-tahaluf',
    },
  })

  // ── Sample Candidates ─────────────────────────────────────────────────────
  const rahul = await prisma.candidate.upsert({
    where: { id: 'cand_rahul_001' },
    update: {},
    create: {
      id: 'cand_rahul_001',
      fullName: 'Rahul Kumar',
      email: 'rahul.kumar@email.com',
      phone: '+91 98765 43210',
      location: 'Bangalore, India',
      currentTitle: 'Senior Data Engineer',
      currentCompany: 'TechCorp India',
      totalExperienceYears: 6,
      noticePeriodDays: 30,
      expectedSalary: 40000,
      source: 'Naukri',
      rawResumeText: 'Experienced data engineer with 6 years working on large-scale data pipelines...',
      parsedData: {
        skills: ['Python', 'Apache Spark', 'dbt', 'SQL', 'Kafka'],
        education: [{ degree: 'B.Tech Computer Science', institution: 'IIT Bangalore', year: 2019 }],
        experience: [
          { title: 'Senior Data Engineer', company: 'TechCorp India', from: '2021-08', to: 'present' },
          { title: 'Data Engineer', company: 'DataSolutions', from: '2019-06', to: '2021-03' },
        ],
      },
    },
  })

  const sara = await prisma.candidate.upsert({
    where: { id: 'cand_sara_001' },
    update: {},
    create: {
      id: 'cand_sara_001',
      fullName: 'Sara Al-Amin',
      email: 'sara.alamin@email.com',
      phone: '+971 50 123 4567',
      location: 'Dubai, UAE',
      currentTitle: 'ML Engineer',
      currentCompany: 'AI Ventures Dubai',
      totalExperienceYears: 4,
      noticePeriodDays: 0,
      expectedSalary: 28000,
      source: 'LinkedIn',
      rawResumeText: 'ML Engineer with 4 years of experience in deep learning and production ML systems...',
    },
  })

  // Internal resource candidate
  await prisma.candidate.upsert({
    where: { id: 'cand_ravi_int_001' },
    update: {},
    create: {
      id: 'cand_ravi_int_001',
      fullName: 'Ravi Sharma',
      email: 'ravi.sharma@acstechnologies.com',
      location: 'Dubai, UAE',
      currentTitle: 'Cloud Architect',
      currentCompany: 'ACS Technologies',
      totalExperienceYears: 5,
      noticePeriodDays: 30,
      source: 'Internal',
      isInternal: true,
      employeeIdRef: 'EMP017',
      acsMonthlyCost: 22000,
      diversionType: 'FULL',
      diversionNotes: 'Available for diversion to Tahaluf Cloud Architect role. Strong AWS background.',
      diversionInitiatedById: ashutosh.id,
      diversionInitiatedAt: new Date(),
    },
  })

  // ── Pipeline Entries ──────────────────────────────────────────────────────
  const pe1 = await prisma.pipelineEntry.upsert({
    where: { candidateId_jdId: { candidateId: 'cand_rahul_001', jdId: 'jd_data_engineer_001' } },
    update: {},
    create: {
      candidateId: 'cand_rahul_001',
      jdId: 'jd_data_engineer_001',
      stage: 'SCREENING_CALL',
      assignedHrId: harsha.id,
      matchScore: 91,
      availabilityScore: 85,
      locationScore: 70,
      compositeScore: 86,
      isShortlisted: true,
      screeningNotes: 'Strong match on all required skills. Minor gap in 2021 to clarify.',
    },
  })

  await prisma.pipelineEntry.upsert({
    where: { candidateId_jdId: { candidateId: 'cand_sara_001', jdId: 'jd_ml_engineer_001' } },
    update: {},
    create: {
      candidateId: 'cand_sara_001',
      jdId: 'jd_ml_engineer_001',
      stage: 'INTERVIEWING',
      assignedHrId: suprriya.id,
      matchScore: 87,
      availabilityScore: 100,
      locationScore: 100,
      compositeScore: 90,
      isShortlisted: true,
      screeningNotes: 'Excellent match. Immediately available in Dubai.',
    },
  })

  // ── Red Flags ─────────────────────────────────────────────────────────────
  await prisma.candidateRedFlag.create({
    data: {
      candidateId: 'cand_rahul_001',
      jdId: 'jd_data_engineer_001',
      flagType: 'employment_gap',
      severity: 'WARNING',
      description: '5-month employment gap between March and August 2021. No explanation provided in resume.',
      excerpt: 'DataSolutions (Jun 2019 – Mar 2021) → TechCorp India (Aug 2021 – present)',
    },
  }).catch(() => {})

  // ── Interview Rounds ──────────────────────────────────────────────────────
  await prisma.interviewRoundTemplate.upsert({
    where: { jdId_roundNumber: { jdId: 'jd_data_engineer_001', roundNumber: 1 } },
    update: {},
    create: {
      jdId: 'jd_data_engineer_001',
      roundNumber: 1,
      roundName: 'HR Screening',
      durationMinutes: 45,
      interviewers: [harsha.id],
    },
  })

  await prisma.interviewRoundTemplate.upsert({
    where: { jdId_roundNumber: { jdId: 'jd_data_engineer_001', roundNumber: 2 } },
    update: {},
    create: {
      jdId: 'jd_data_engineer_001',
      roundNumber: 2,
      roundName: 'Technical Round',
      durationMinutes: 90,
      interviewers: [raj.id],
    },
  })

  // ── Notifications ─────────────────────────────────────────────────────────
  await prisma.notification.createMany({
    data: [
      {
        userId: harsha.id,
        title: 'AI screening complete',
        message: '18 resumes screened for Senior Data Engineer. 6 shortlisted.',
        type: 'SUCCESS',
        link: '/screening',
      },
      {
        userId: ashutosh.id,
        title: 'Submission pending review',
        message: 'Nadia Georgiou\'s profile is awaiting Tahaluf response.',
        type: 'INFO',
        link: '/submissions',
      },
    ],
    skipDuplicates: true,
  })

  console.log('✅ Seed complete!')
  console.log('')
  console.log('Login credentials:')
  console.log('  Ashutosh Jha (CSO):  ashutosh@acstechnologies.com / Admin@123')
  console.log('  Raj Shekhar (Dir):   raj@acstechnologies.com / Admin@123')
  console.log('  Harsha (HR):         harsha@acstechnologies.com / Admin@123')
  console.log('  Suprriya (HR):       suprriya@acstechnologies.com / Admin@123')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
