export const JOB_CATEGORIES = [
  {
    id: "software",
    label: "Software Development & Programming",
    icon: "💻",
    subcategories: [
      "Web Development",
      "Mobile App Development",
      "Backend Engineering",
      "Full-Stack Development",
      "API Integration",
      "DevOps and Cloud Engineering",
      "AI/ML Development",
    ],
    skills: [
      "Python", "JavaScript", "TypeScript", "React", "Node.js", "Java",
      "Go", "Rust", "AWS", "Docker", "Kubernetes", "GraphQL", "AI Tools",
    ],
  },
  {
    id: "design",
    label: "Design & Creative",
    icon: "🎨",
    subcategories: [
      "Graphic Design",
      "Logo Design",
      "UI/UX Design",
      "Product Design",
      "Motion Graphics",
      "Illustration",
      "Branding",
    ],
    skills: [
      "Figma", "Adobe Photoshop", "Illustrator", "After Effects",
      "Sketch", "InDesign", "Canva", "Blender", "Cinema 4D",
    ],
  },
  {
    id: "writing",
    label: "Writing & Content Creation",
    icon: "✍️",
    subcategories: [
      "Blog Writing",
      "Copywriting",
      "Technical Writing",
      "Ghostwriting",
      "SEO Content",
      "Script Writing",
      "Editing and Proofreading",
    ],
    skills: [
      "SEO", "Content Strategy", "Editing", "Storytelling",
      "WordPress", "Grammarly", "AP Style", "Chicago Style",
    ],
  },
  {
    id: "marketing",
    label: "Digital Marketing",
    icon: "📣",
    subcategories: [
      "Social Media Marketing",
      "Search Engine Optimization (SEO)",
      "Search Engine Marketing (SEM)",
      "Email Marketing",
      "Affiliate Marketing",
      "Marketing Strategy",
      "Influencer Outreach",
    ],
    skills: [
      "Google Ads", "Meta Ads", "Analytics", "Content Marketing",
      "HubSpot", "Mailchimp", "SEMrush", "Ahrefs", "TikTok Ads",
    ],
  },
  {
    id: "data",
    label: "Data & Analytics",
    icon: "📊",
    subcategories: [
      "Data Analysis",
      "Data Visualization",
      "Business Intelligence",
      "Data Engineering",
      "Statistical Analysis",
      "Market Research",
      "Machine Learning",
    ],
    skills: [
      "SQL", "Excel", "Power BI", "Tableau", "Python", "R",
      "Spark", "dbt", "Snowflake", "BigQuery",
    ],
  },
  {
    id: "admin",
    label: "Administrative Support & Virtual Assistance",
    icon: "🗂️",
    subcategories: [
      "Virtual Assistant Services",
      "Data Entry",
      "Internet Research",
      "Appointment Scheduling",
      "Customer Support",
      "Project Coordination",
    ],
    skills: [
      "Microsoft Office", "Google Workspace", "CRM Systems",
      "Slack", "Notion", "Asana", "Trello", "Zendesk",
    ],
  },
  {
    id: "finance",
    label: "Accounting & Finance",
    icon: "💰",
    subcategories: [
      "Bookkeeping",
      "Financial Analysis",
      "Tax Preparation",
      "Payroll Management",
      "Budget Planning",
      "Financial Modeling",
    ],
    skills: [
      "QuickBooks", "Excel", "Xero", "Financial Reporting",
      "GAAP", "SAP", "NetSuite", "Sage",
    ],
  },
  {
    id: "multimedia",
    label: "Video, Audio & Multimedia",
    icon: "🎬",
    subcategories: [
      "Video Editing",
      "Podcast Production",
      "Audio Editing",
      "Animation",
      "Voice-over Work",
      "YouTube Content Production",
    ],
    skills: [
      "Premiere Pro", "DaVinci Resolve", "Audition", "Final Cut Pro",
      "Logic Pro", "Ableton", "After Effects", "CapCut",
    ],
  },
  {
    id: "consulting",
    label: "Business Consulting & Project Management",
    icon: "📋",
    subcategories: [
      "Business Strategy",
      "Startup Consulting",
      "Operations Consulting",
      "Project Management",
      "Process Improvement",
      "HR Consulting",
    ],
    skills: [
      "Agile", "Scrum", "Business Planning", "Operations",
      "PMP", "PRINCE2", "Lean", "Six Sigma", "OKRs",
    ],
  },
  {
    id: "engineering",
    label: "Engineering & Architecture",
    icon: "⚙️",
    subcategories: [
      "CAD Drafting",
      "Civil Engineering",
      "Mechanical Engineering",
      "Architectural Design",
      "Product Engineering",
      "3D Modeling",
    ],
    skills: [
      "AutoCAD", "SolidWorks", "Revit", "SketchUp",
      "MATLAB", "ANSYS", "Rhino", "3ds Max",
    ],
  },
];

export function getCategoryById(id) {
  return JOB_CATEGORIES.find((c) => c.id === id) || null;
}

export function getCategoryLabel(id) {
  return getCategoryById(id)?.label || id;
}

export function getCategoryIcon(id) {
  return getCategoryById(id)?.icon || "📌";
}
